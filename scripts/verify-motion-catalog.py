"""Run inside FreeCAD through the MCP console after verify-motion-catalog.ts.

Jobs run one at a time on the GUI event loop. The report is updated after every job.
Existing user documents are preserved. Source catalog dimensions are checked against
native solid bounds; preview mounting voids are checked separately by the TS tests.
"""
import json, math, time
from pathlib import Path
import FreeCAD as App
import Part
from PySide import QtCore

_motion_output=Path(__file__).resolve().parents[1]/'test-results/motion-library'
_motion_cases=json.loads((_motion_output/'cases.json').read_text())
_motion_report={'freecad':'.'.join(App.Version()[:3]),'cases':[],'done':False}
_motion_started=time.perf_counter()
_motion_original=App.ActiveDocument.Name if App.ActiveDocument else None

def _motion_case(index):
    case=_motion_cases[index]
    record={'id':case['id'],'passed':False}
    doc=None
    try:
        scope={'App':App,'Part':Part,'math':math}
        exec(case['code'],scope)
        solids=scope['components']
        for shape in solids:
            assert not shape.isNull() and shape.isValid() and shape.isClosed(), 'Invalid or open solid'
            assert len(shape.Solids)==1 and shape.Volume>0, 'Each physical component needs one positive solid'
        shape=Part.makeCompound(solids)
        b=shape.optimalBoundingBox(False,False)
        actual=[b.XLength,b.YLength,b.ZLength]
        error=max(abs(a-e) for a,e in zip(actual,case['dimensions']))
        assert error<.05, ('Source dimension mismatch',actual,case['dimensions'])
        for i,first in enumerate(solids):
            for second in solids[i+1:]:
                if not first.BoundBox.intersect(second.BoundBox):continue
                overlap=first.common(second).Volume
                assert overlap<max(1e-6,min(first.Volume,second.Volume)*1e-6), ('Components intersect',overlap)
        if case['save']:
            doc=App.newDocument('MotionCatalogAudit')
            sentinel=doc.addObject('App::FeaturePython','ExistingUserObject')
            exec(case['macro'],{})
            roots=[o for o in doc.RootObjects if o!=sentinel]
            assert len(roots)==1 and sentinel in doc.Objects,'Macro changed unrelated document content'
            root=roots[0]
            assert root.PartId==case['partId']
            objects=list(root.Group) if root.TypeId=='App::Part' else [root]
            assert len(objects)==len(solids),'Wrapper component mismatch'
            stem=case['partId']
            step=str(_motion_output/(stem+'.step'))
            Part.export(objects,step)
            restored=Part.Shape();restored.read(step)
            assert restored.isValid() and len(restored.Solids)==len(solids),'STEP round-trip mismatch'
            root_name=root.Name
            saved_labels=[o.Label for o in objects]
            fcstd=str(_motion_output/(stem+'.FCStd'));doc.saveAs(fcstd)
            App.closeDocument(doc.Name);doc=App.openDocument(fcstd)
            reopened=doc.getObject(root_name)
            assert reopened and reopened.PartId==case['partId'],'FCStd identity mismatch'
            restored_objects=list(reopened.Group) if reopened.TypeId=='App::Part' else [reopened]
            assert [o.Label for o in restored_objects]==saved_labels,'FCStd labels changed'
            assert all(o.Shape.isValid() for o in doc.Objects if hasattr(o,'Shape'))
            record['stepRoundtrip']=True;record['fcstdRoundtrip']=True
        record.update(passed=True,solids=len(solids),dimensions=actual,maxBoundsError=error)
    except Exception as error:
        record['error']=str(error)
    finally:
        if doc and doc.Name in App.listDocuments():App.closeDocument(doc.Name)
    _motion_report['cases'].append(record)
    _motion_report.update(passed=sum(r['passed'] for r in _motion_report['cases']),failed=sum(not r['passed'] for r in _motion_report['cases']),total=len(_motion_cases),elapsedSeconds=time.perf_counter()-_motion_started,done=index+1==len(_motion_cases))
    (_motion_output/'validation.json').write_text(json.dumps(_motion_report,indent=2))
    if index+1<len(_motion_cases):QtCore.QTimer.singleShot(0,lambda:_motion_case(index+1))
    elif _motion_original and _motion_original in App.listDocuments():App.setActiveDocument(_motion_original)

QtCore.QTimer.singleShot(0,lambda:_motion_case(0))
print('Started',len(_motion_cases),'native motion-catalog checks.')
