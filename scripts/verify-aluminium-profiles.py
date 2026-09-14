#!/usr/bin/env python3
"""Run prepared aluminium profiles in native FreeCAD and round-trip STEP solids."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('cases', nargs='?', default='/tmp/protolab-aluminium-cases.json')
parser.add_argument('--freecad-lib', default='/Applications/FreeCAD.app/Contents/Resources/lib')
parser.add_argument('--output', default='/tmp/protolab-aluminium-results.json')
args = parser.parse_args()
sys.path.insert(0,args.freecad_lib)
import FreeCAD as App
import Part

cases=json.loads(Path(args.cases).read_text())
results=[]
checked_at=datetime.now(timezone.utc).isoformat()
with tempfile.TemporaryDirectory(prefix='protolab-aluminium-qa-') as folder:
    for i,case in enumerate(cases):
        doc=App.newDocument('AluminiumQA'+str(i))
        started=time.perf_counter()
        record={'id':case['id'],'codeSha256':hashlib.sha256(case['code'].encode()).hexdigest(),'passed':False}
        try:
            exec(case['code'],{})
            obj=next(o for o in doc.Objects if 'PartId' in o.PropertiesList)
            shape=obj.Shape
            assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0,'Invalid/open/disconnected extrusion'
            bounds=shape.optimalBoundingBox(False,False)
            actual=[bounds.XLength,bounds.YLength,bounds.ZLength]
            p=case['parameters']
            assert all(abs(a-b)<1e-5 for a,b in zip(actual,[p['width'],p['height'],p['length']])),'Section envelope differs from preview'
            relative_error=abs(shape.Volume-case['volume'])/case['volume']
            assert relative_error<.001,'Cross-section area differs from preview'
            checked=0
            for probe in case['probes']:
                point=App.Vector(*probe['point'])
                # Exclude only points within preview tessellation tolerance of a boundary.
                if shape.distToShape(Part.Vertex(point))[0]<.002 and not shape.isInside(point,1e-7,False):
                    continue
                assert shape.isInside(point,1e-7,False)==probe['inside'],f'Cross-section occupancy mismatch at {probe["point"]}'
                checked+=1
            assert checked>=500,'Insufficient section probes'
            # A true extrusion has the same section near both cut ends.
            for probe in case['probes'][::17]:
                x,y,_=probe['point']
                assert shape.isInside(App.Vector(x,y,-p['length']/2+.01),1e-7,False)==shape.isInside(App.Vector(x,y,p['length']/2-.01),1e-7,False),'Slots do not run through full length'
            step=str(Path(folder)/(case['id']+'.step'))
            Part.export([obj],step)
            restored=Part.Shape();restored.read(step)
            assert restored.isValid() and len(restored.Solids)==1,'STEP lost valid solid'
            assert abs(restored.Volume-shape.Volume)<max(.001,shape.Volume*1e-6),'STEP volume changed'
            record.update(passed=True,dimensions=actual,volume=shape.Volume,relativePreviewVolumeError=relative_error,sectionProbes=checked,stepRoundtrip=True)
        except Exception as error:record['error']=str(error)
        finally:App.closeDocument(doc.Name)
        record['durationSeconds']=time.perf_counter()-started
        results.append(record)
        report={'checkedAt':checked_at,'freecadVersion':App.Version(),'casesRequested':len(cases),'passed':sum(r['passed'] for r in results),'failed':sum(not r['passed'] for r in results),'cases':results}
        Path(args.output).write_text(json.dumps(report,indent=2))
        print(json.dumps(record),flush=True)
sys.exit(any(not r['passed'] for r in results))
