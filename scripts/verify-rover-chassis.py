"""Validate fixed supplier chassis macros with a FreeCAD-enabled Python.

Prepare with: node --import tsx scripts/verify-rover-chassis.ts [cases.json]
Run with: python scripts/verify-rover-chassis.py [cases.json] [report.json]
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

cases = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-rover-chassis-cases.json').read_text())
output = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/protolab-rover-chassis-results.json')
started = time.perf_counter()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]), 'cases': []}

def check_shape(shape, expected_solids=None):
    assert not shape.isNull() and shape.isValid(), 'Invalid shape'
    assert shape.Solids and shape.Volume > 0, 'Expected closed positive supplier solids'
    if expected_solids is not None:
        assert len(shape.Solids) == expected_solids, 'Supplier component solid count changed'
    assert all(s.isValid() and s.isClosed() and s.Volume > 0 for s in shape.Solids), 'Invalid source solid'
    assert shape.isClosed(), 'Open component shell'

with tempfile.TemporaryDirectory(prefix='protolab-supplier-chassis-') as directory:
    for case in cases:
        record = {'name': case['name'], 'sourceUrl':case['sourceUrl'], 'sourceSha256':case['sourceSha256'], 'passed': False, 'codeSha256': hashlib.sha256(case['script'].encode()).hexdigest()}
        doc = App.newDocument('ChassisAudit')
        try:
            sentinel = doc.addObject('App::FeaturePython', 'ExistingObject')
            exec(case['script'], {})
            roots = [obj for obj in doc.RootObjects if obj != sentinel]
            assert len(roots) == 1 and doc.getObject(sentinel.Name), 'The macro must preserve existing document objects'
            root = roots[0]
            assert root.PartId == case['id'] and root.ModelState == case['state']
            assert json.loads(root.Configuration) == case['parameters']
            children = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert len(children) == len(case['components']), 'Preview/CAD component count mismatch'
            bound_errors, volume_errors = [], []
            for child, expected in zip(children, case['components']):
                check_shape(child.Shape, expected.get('sourceSolids', 1))
                assert abs(child.Shape.Volume - expected['sourceVolume']) <= max(1e-5, expected['sourceVolume']*1e-8), 'Native source volume changed'
                # Trimmed supplier NURBS may have loose analytical bounds; sample the actual trimmed surfaces.
                points, _ = child.Shape.tessellate(0.025)
                b = App.BoundBox()
                for point in points: b.add(point)
                for actual, wanted in zip([b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax], expected['min'] + expected['max']):
                    bound_errors.append(abs(actual - wanted))
                    assert abs(actual - wanted) < 0.12, (child.Label, actual, wanted)
                error = abs(child.Shape.Volume - expected['volume']) / child.Shape.Volume
                volume_errors.append(error)
                assert error < 0.015, (child.Label, 'Preview/CAD volume mismatch', error)
            # Original purchased electronics contain contacting pins/pads. Inspect
            # source frame/drive mating separately and report inherited source fit.
            intersections = []
            if case['state'] == 'assembled':
                for i, first in enumerate(children):
                    for j in range(i+1,len(children)):
                        second = children[j]
                        roles = {case['components'][i]['group'],case['components'][j]['group']}
                        if roles != {'structure','drive'} or not first.Shape.BoundBox.intersect(second.Shape.BoundBox):
                            continue
                        common = first.Shape.common(second.Shape)
                        overlap = 0 if common.isNull() else common.Volume
                        if overlap > max(1e-5,min(first.Shape.Volume,second.Shape.Volume)*1e-6):
                            intersections.append({'first':first.Label,'second':second.Label,'volume':overlap})
            if len(children) > 1:
                before = [App.Vector(child.Shape.Solids[0].CenterOfMass) for child in children]
                saved = App.Placement(children[0].Placement)
                delta = App.Vector(3, -4, 5)
                children[0].Placement.Base += delta
                doc.recompute()
                assert (children[0].Shape.Solids[0].CenterOfMass - before[0] - delta).Length < 1e-6
                for child, old in zip(children[1:], before[1:]):
                    assert (child.Shape.Solids[0].CenterOfMass - old).Length < 1e-6
                children[0].Placement = saved
                doc.recompute()
            step = str(Path(directory) / 'chassis.step')
            # OCC integrates a compound around a common reference point. For
            # complex NURBS this can differ numerically from summed solid
            # integrals even before export. Compare per-solid integrals on
            # both sides without relaxing the STEP roundtrip tolerance.
            volume = sum(solid.Volume for child in children for solid in child.Shape.Solids)
            Part.export(children, step)
            restored = Part.Shape()
            restored.read(step)
            expected_step_solids = sum(len(c.Shape.Solids) for c in children)
            restored_step_solids = len(restored.Solids)
            restored_step_valid = restored.isValid()
            record.update(stepExpectedSolids=expected_step_solids, stepRestoredSolids=restored_step_solids,
                          stepShapeValid=restored_step_valid)
            assert restored_step_valid and restored_step_solids == expected_step_solids, 'STEP component mismatch'
            restored_volume = sum(solid.Volume for solid in restored.Solids)
            step_relative_volume_error = abs(restored_volume - volume) / volume
            record.update(stepSourceSolidVolume=volume, stepRestoredSolidVolume=restored_volume,
                          stepRelativeVolumeError=step_relative_volume_error)
            assert abs(restored_volume - volume) < max(0.001, volume * 1e-5), 'STEP changed volume'
            name, labels = root.Name, [child.Label for child in children]
            fcstd = str(Path(directory) / 'chassis.FCStd')
            doc.saveAs(fcstd)
            App.closeDocument(doc.Name)
            doc = App.openDocument(fcstd)
            root = doc.getObject(name)
            reopened = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert [child.Label for child in reopened] == labels, 'FCStd component mismatch'
            for child in reopened:
                check_shape(child.Shape)
            record.update(passed=True, components=len(reopened), solids=sum(len(c.Shape.Solids) for c in reopened), maxBoundsError=max(bound_errors),
                          maxRelativeVolumeError=max(volume_errors), sourceFrameDriveInterferences=intersections,
                          independentMovement=len(reopened) > 1, stepRoundtrip=True,
                          stepRelativeVolumeError=step_relative_volume_error, fcstdRoundtrip=True)
        except Exception as error:
            record['error'] = str(error)
        finally:
            if doc and doc.Name in App.listDocuments():
                App.closeDocument(doc.Name)
        report['cases'].append(record)
        report.update(passed=sum(row['passed'] for row in report['cases']),
                      failed=sum(not row['passed'] for row in report['cases']),
                      elapsedSeconds=time.perf_counter() - started)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2))
        print(json.dumps(record), flush=True)
print(json.dumps({'passed': report['passed'], 'failed': report['failed'], 'output': str(output)}), flush=True)
sys.exit(bool(report['failed']))
