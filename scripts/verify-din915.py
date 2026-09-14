#!/usr/bin/env python3
"""Check DIN 915 macro solids, cylindrical point, shoulder, socket and STEP export.

Prepare with node --import tsx scripts/verify-din915.ts, then run this script with
a FreeCAD-capable Python. These four optional native checks do not run in CI.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import tempfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('cases', nargs='?', default='/tmp/protolab-din915-cases.json')
parser.add_argument('--freecad-lib', default='/Applications/FreeCAD.app/Contents/Resources/lib')
parser.add_argument('--output', default='/tmp/protolab-din915-results.json')
args = parser.parse_args()
sys.path.insert(0, args.freecad_lib)
import FreeCAD as App
import Part

cases = json.loads(Path(args.cases).read_text())
results = []
checked_at = datetime.now(timezone.utc).isoformat()
with tempfile.TemporaryDirectory(prefix='protolab-din915-qa-') as folder:
    for index, case in enumerate(cases):
        doc = App.newDocument('DIN915QA'+str(index))
        started = time.perf_counter()
        record = {'id': case['id'], 'codeSha256': hashlib.sha256(case['code'].encode()).hexdigest(), 'passed': False}
        try:
            exec(case['code'], {})
            obj = next(obj for obj in doc.Objects if 'PartId' in obj.PropertiesList)
            shape = obj.Shape
            p = case['parameters']
            assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1 and shape.Volume > 0, 'Invalid screw solid'
            # OCC's optimal box adds a conservative gap for trimmed helical faces.
            # Measure actual surface vertices at a tighter deflection than the assertion.
            vertices, _ = shape.tessellate(.003)
            dimensions = [max(getattr(v,axis) for v in vertices)-min(getattr(v,axis) for v in vertices) for axis in ('x','y','z')]
            assert all(abs(a-b) < .025 for a,b in zip(dimensions,[p['diameter'],p['diameter'],p['length']])), 'Incorrect overall diameter/length'
            relative_error = abs(shape.Volume-case['previewVolume'])/case['previewVolume']
            assert relative_error < .015, 'Preview/native volume mismatch'
            def inside(r, angle, z):
                return shape.isInside(App.Vector(r*math.cos(angle),r*math.sin(angle),z-p['length']/2),1e-7,True)
            # Z is the full cylindrical segment, before the shoulder transition.
            for fraction in [.1,.9]:
                for i in range(12):
                    a = (i+.17)*math.pi/6
                    assert inside(p['tipDiameter']/2-.005,a,p['tipLength']*fraction), 'Point cylinder missing material'
                    assert not inside(p['tipDiameter']/2+.005,a,p['tipLength']*fraction), 'Point cylinder exceeds dp'
            # Below the thread root, the shoulder follows its conical envelope.
            fraction = .25
            r = p['tipDiameter']/2+(p['diameter']-p['tipDiameter'])/2*fraction
            z = p['tipLength']+p['dogShoulderLength']*fraction
            assert inside(r-.005,.173,z) and not inside(r+.005,.173,z), 'Shoulder transition differs from preview'
            floor = p['length']-p['driveDepth']
            assert inside(0,0,floor-.005) and not inside(0,0,floor+.005), 'Incorrect blind socket depth'
            for i in range(6):
                a = i*math.pi/3
                z = p['length']-p['driveDepth']/2
                assert not inside(p['driveWidth']/2-.005,a,z), 'Hex socket too narrow'
                assert inside(p['driveWidth']/2+.005,a,z), 'Hex socket too wide'
            assert obj.CatalogSource == 'references/din915-dimensions.png', 'Reference source missing'
            assert 'length' not in json.loads(obj.CatalogDimensions), 'Prototype length incorrectly verified'
            step = str(Path(folder)/(str(index)+'.step'))
            Part.export([obj],step)
            restored = Part.Shape()
            restored.read(step)
            assert restored.isValid() and len(restored.Solids) == 1, 'STEP lost solid'
            assert abs(restored.Volume-shape.Volume) < max(.01,shape.Volume*1e-5), 'STEP volume changed'
            record.update(passed=True,dimensions=dimensions,volume=shape.Volume,relativePreviewVolumeError=relative_error,pointProbes=48,socketProbes=14,shoulderProbes=2,stepRoundtrip=True)
        except Exception as error:
            record['error'] = str(error)
        finally:
            App.closeDocument(doc.Name)
        record['durationSeconds'] = time.perf_counter()-started
        results.append(record)
        report = {'checkedAt': checked_at, 'freecadVersion': App.Version(), 'casesRequested': len(cases), 'passed': sum(row['passed'] for row in results), 'failed': sum(not row['passed'] for row in results), 'cases': results}
        Path(args.output).write_text(json.dumps(report,indent=2))
        print(json.dumps(record),flush=True)
sys.exit(any(not row['passed'] for row in results))
