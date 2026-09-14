#!/usr/bin/env python3
"""Check prepared bevel previews against native FreeCAD solids and exported assemblies.

Prepare with node --import tsx scripts/verify-bevel-pair.ts [cases.json] [--matrix].
Run this script with a FreeCAD-capable Python. The default smoke batch stays small;
--matrix on the preparation command adds all presets, states and shaft-hole shapes.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('cases', nargs='?', default='/tmp/protolab-bevel-pair-cases.json')
parser.add_argument('--freecad-lib', default='/Applications/FreeCAD.app/Contents/Resources/lib')
parser.add_argument('--output', default='/tmp/protolab-bevel-pair-results.json')
parser.add_argument('--bop-check', action='store_true', help='Also run the slower native Boolean self-interference analyzer.')
parser.add_argument('--intersections', action='store_true', help='Measure assembled pair overlap as an explicit geometric diagnostic.')
args = parser.parse_args()
sys.path.insert(0, args.freecad_lib)
import FreeCAD as App
import Part

cases = json.loads(Path(args.cases).read_text())
results = []
started = time.perf_counter()
checked_at = datetime.now(timezone.utc).isoformat()

def shape_bounds(shape):
    # Tessellation bounds avoid inflated boxes for trimmed analytic bore intersections.
    shape.tessellate(.003)
    b = shape.optimalBoundingBox(True, False)
    return [[b.XMin, b.YMin, b.ZMin], [b.XMax, b.YMax, b.ZMax]]

def compare_bounds(actual, expected, label):
    largest_error = 0.0
    for a, e in zip(actual, expected):
        for value, target in zip(a, e):
            largest_error = max(largest_error, abs(value-target))
            assert abs(value-target) < .025, f'{label}: bounds {actual} != {expected}'
    return largest_error

def valid_component(shape, label):
    assert not shape.isNull() and shape.isValid(), f'{label}: invalid BRep'
    assert len(shape.Solids) == 1 and shape.Volume > 0, f'{label}: expected one positive-volume solid'
    assert shape.isClosed(), f'{label}: open shell'
    if args.bop_check:
        shape.check(True)

with tempfile.TemporaryDirectory(prefix='protolab-bevel-qa-') as folder:
    for index, case in enumerate(cases):
        doc = App.newDocument('BevelQA'+str(index))
        case_started = time.perf_counter()
        record = {'id': case['id'], 'state': case['state'], 'parameters': case['parameters'], 'codeSha256': hashlib.sha256(case['code'].encode()).hexdigest(), 'passed': False}
        try:
            exec(case['code'], {})
            roots = [obj for obj in doc.Objects if 'PartId' in obj.PropertiesList]
            assert len(roots) == 1 and roots[0].PartId == 'bevel-gear-pair', 'Missing root metadata'
            root = roots[0]
            objects = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert len(objects) == len(case['components']), 'Incorrect number of independently editable components'
            volumes = []
            volume_errors = []
            bounds_errors = []
            for obj, expected in zip(objects, case['components']):
                valid_component(obj.Shape, expected['side'])
                bounds_errors.append(compare_bounds(shape_bounds(obj.Shape), expected['bounds'], expected['side']))
                assert abs(obj.Shape.Volume-expected['volume']) <= max(.02, expected['volume']*.015), f'{expected["side"]}: preview/native volume mismatch'
                volumes.append(obj.Shape.Volume)
                volume_errors.append(abs(obj.Shape.Volume-expected['volume'])/expected['volume'])
            for point in case['annuli']:
                shape = objects[point['component']].Shape
                assert shape.isInside(App.Vector(*point['inside']), 1e-7, True), point['name']+': missing material below the root plane'
                assert not shape.isInside(App.Vector(*point['outside']), 1e-7, True), point['name']+': nonplanar ridge above the root plane'
            if args.intersections and case['state'] == 'assembled' and len(objects) == 2:
                intersection = objects[0].Shape.common(objects[1].Shape)
                assert intersection.isNull() or intersection.isValid(), 'Pair intersection produced an invalid Boolean result'
                record['pairIntersectionVolume'] = 0.0 if intersection.isNull() else intersection.Volume
            before = [shape_bounds(obj.Shape) for obj in objects]
            if len(objects) > 1:
                placement = App.Placement(objects[0].Placement)
                objects[0].Placement.Base = placement.Base+App.Vector(4,3,2)
                doc.recompute()
                for i in range(1,len(objects)):
                    compare_bounds(shape_bounds(objects[i].Shape),before[i],'Unmoved component')
                assert abs(shape_bounds(objects[0].Shape)[0][0]-before[0][0][0]-4) < .025, 'First component did not move independently'
                objects[0].Placement = placement
                doc.recompute()
            step = Path(folder)/('case-'+str(index)+'.step')
            Part.export(objects,str(step))
            imported = Part.Shape()
            imported.read(str(step))
            assert imported.isValid() and len(imported.Solids) == len(objects), 'STEP roundtrip lost solid components'
            assert abs(imported.Volume-sum(volumes)) < max(.02,sum(volumes)*1e-5), 'STEP roundtrip changed volume'
            fcstd = Path(folder)/('case-'+str(index)+'.FCStd')
            doc.recompute()
            doc.saveAs(str(fcstd))
            App.closeDocument(doc.Name)
            doc = App.openDocument(str(fcstd))
            root = next(obj for obj in doc.Objects if 'PartId' in obj.PropertiesList)
            restored = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert len(restored) == len(objects), 'FCStd roundtrip lost assembly structure'
            for obj, expected in zip(restored,case['components']):
                valid_component(obj.Shape,expected['side'])
                compare_bounds(shape_bounds(obj.Shape),expected['bounds'],'FCStd '+expected['side'])
            record.update(passed=True,components=len(restored),annulusChecks=len(case['annuli']),volumes=volumes,relativeVolumeErrors=volume_errors,maxBoundsError=max(bounds_errors),independentMovement=len(restored)>1,stepRoundtrip=True,fcstdRoundtrip=True)
        except Exception as error:
            record['error'] = str(error)
        finally:
            App.closeDocument(doc.Name)
        record['durationSeconds'] = time.perf_counter()-case_started
        results.append(record)
        report = {'checkedAt':checked_at,'freecadVersion':App.Version(),'casesRequested':len(cases),'checks':['valid closed one-solid components','preview/native component bounds and volume','planar front/back root annuli','independent component movement','STEP roundtrip','FCStd roundtrip'],'bopCheck':args.bop_check,'intersectionDiagnostic':args.intersections,'elapsedSeconds':time.perf_counter()-started,'passed':sum(row['passed'] for row in results),'failed':sum(not row['passed'] for row in results),'cases':results}
        Path(args.output).parent.mkdir(parents=True,exist_ok=True)
        Path(args.output).write_text(json.dumps(report,indent=2))
        print(json.dumps(record),flush=True)
failed = sum(not row['passed'] for row in results)
print(json.dumps({'passed':len(results)-failed,'total':len(results),'failed':failed,'output':args.output}),flush=True)
sys.exit(bool(failed))
