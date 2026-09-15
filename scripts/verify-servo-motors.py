"""Validate servo motor macros with a FreeCAD-enabled Python.

Prepare with: node --import tsx scripts/verify-servo-motors.ts [cases.json]
Run with: python scripts/verify-servo-motors.py [cases.json] [report.json]
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

cases = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-servo-motors-cases.json').read_text())
output = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/protolab-servo-motors-results.json')
started = time.perf_counter()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]), 'cases': []}

# Independent reference geometry read directly from the unmodified manufacturer
# STEP. Its deliberate overlapping components must not be mistaken for a new
# intersection introduced by the preview/export integration.
source_step = Path(__file__).resolve().parents[1] / 'public/references/st3215-hs-manufacturer.step'
source_shape = Part.Shape()
source_shape.read(str(source_step))
source_labels = ['Middle case', 'Front cover', 'Rear cover and pivot', 'Motor',
                 'Circuit board', 'Output gear and shaft', 'Front output disc', 'Rear idler disc']
source_solids = source_shape.Solids
source_rear = source_solids[2]
fixed_rear = Part.makeSolid(source_rear.Shells[0])
for index, shell in enumerate(source_rear.Shells[1:]):
    cavity = Part.makeSolid(shell)
    if index == 6:
        cavity.translate(App.Vector(0, -0.00001, 0))
    fixed_rear = fixed_rear.cut(cavity)
assert fixed_rear.isValid() and abs(fixed_rear.Volume - source_rear.Volume) < 1e-6
source_solids[2] = fixed_rear
source_exploded = [(0, 0, 0), (0, 0, 25), (0, 0, -25), (55, 0, 0),
                   (0, -40, 0), (0, 0, 45), (0, 0, 60), (0, 0, -45)]

def source_component(label, case):
    if case['parameters']['model'] != 'waveshare-st3215-hs' or label not in source_labels:
        return None
    index = source_labels.index(label)
    shape = source_solids[index].copy()
    shape.rotate(App.Vector(), App.Vector(1, 0, 0), 90)
    shape.translate(App.Vector(25.5, 0, 24.1))
    if index in (5, 6):
        shape.rotate(App.Vector(), App.Vector(0, 0, 1), case['parameters']['outputAngle'])
    if case['state'] == 'exploded':
        shape.translate(App.Vector(*source_exploded[index]))
    return shape

def check_shape(shape):
    assert not shape.isNull() and shape.isValid(), 'Invalid shape'
    assert len(shape.Solids) == 1 and shape.Volume > 0, 'Expected one positive solid per physical component'
    assert shape.isClosed(), 'Open component shell'

def check_catalog(root, expected):
    assert expected, 'Every fixed servo model must retain its catalog identity in every pose'
    assert root.CatalogDesignation == expected['designation']
    assert root.CatalogSource == expected['source']
    assert json.loads(root.CatalogDimensions) == expected['dimensions']
    assert json.loads(root.CatalogAttributes) == expected['attributes']
    assert json.loads(root.CatalogAttributeConditions) == expected['attributeConditions']

with tempfile.TemporaryDirectory(prefix='protolab-servo-motors-') as directory:
    for case in cases:
        record = {'name': case['name'], 'passed': False, 'codeSha256': hashlib.sha256(case['script'].encode()).hexdigest()}
        doc = App.newDocument('ServoMotorsAudit')
        try:
            sentinel = doc.addObject('App::FeaturePython', 'ExistingObject')
            exec(case['script'], {})
            roots = [obj for obj in doc.RootObjects if obj != sentinel]
            assert len(roots) == 1 and doc.getObject(sentinel.Name), 'The macro must preserve existing document objects'
            root = roots[0]
            assert root.PartId == case['id'] and root.ModelState == case['state']
            assert json.loads(root.Configuration) == case['parameters']
            check_catalog(root, case['catalog'])
            children = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert len(children) == len(case['components']), 'Preview/CAD component count mismatch'
            bound_errors, volume_errors = [], []
            references = {}
            for child, expected in zip(children, case['components']):
                check_shape(child.Shape)
                reference = source_component(child.Label, case)
                if reference is not None:
                    references[child.Label] = reference
                    assert abs(child.Shape.Volume - reference.Volume) < 1e-6, 'Source STEP volume changed'
                    assert abs(child.Shape.Area - reference.Area) < 1e-5, 'Source STEP surface area changed'
                    expected_box = reference.optimalBoundingBox(False, False)
                    actual_box = child.Shape.optimalBoundingBox(False, False)
                    for key in ['XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax']:
                        assert abs(getattr(expected_box, key) - getattr(actual_box, key)) < 1e-5
                if len(children) > 1:
                    assert child.Label == expected['name'], 'Preview/CAD component label mismatch'
                b = child.Shape.optimalBoundingBox(False, False)
                for actual, wanted in zip([b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax], expected['min'] + expected['max']):
                    bound_errors.append(abs(actual - wanted))
                    assert abs(actual - wanted) < 0.05, (child.Label, actual, wanted)
                error = abs(child.Shape.Volume - expected['volume']) / child.Shape.Volume
                volume_errors.append(error)
                assert error < 0.015, (child.Label, 'Preview/CAD volume mismatch', error)
            intersections = []
            source_intersections = []
            for i, first in enumerate(children):
                for second in children[i + 1:]:
                    common = first.Shape.common(second.Shape)
                    overlap = 0 if common.isNull() else common.Volume
                    if overlap > max(1e-6, min(first.Shape.Volume, second.Shape.Volume) * 1e-6):
                        row = {'first': first.Label, 'second': second.Label, 'volume': overlap}
                        if first.Label in references and second.Label in references:
                            original_overlap = references[first.Label].common(references[second.Label]).Volume
                            assert abs(overlap - original_overlap) < 0.001, 'Intersection differs from source STEP'
                            source_intersections.append(row)
                        else:
                            intersections.append(row)
            assert not intersections, ('Physical components intersect', intersections)
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
            step = str(Path(directory) / 'servo-motors.step')
            volume = sum(child.Shape.Volume for child in children)
            Part.export(children, step)
            restored = Part.Shape()
            restored.read(step)
            assert restored.isValid() and len(restored.Solids) == len(children), 'STEP component mismatch'
            # The original ST3215 contains trimmed spline surfaces whose STEP
            # reserialization changes integral volume by about 0.003 percent.
            roundtrip_tolerance = 5e-5 if references else 1e-5
            assert abs(restored.Volume - volume) < max(0.001, volume * roundtrip_tolerance), 'STEP changed volume'
            name, labels = root.Name, [child.Label for child in children]
            fcstd = str(Path(directory) / 'servo-motors.FCStd')
            doc.saveAs(fcstd)
            App.closeDocument(doc.Name)
            doc = App.openDocument(fcstd)
            root = doc.getObject(name)
            assert json.loads(root.Configuration) == case['parameters']
            assert root.PartId == case['id'] and root.ModelState == case['state']
            check_catalog(root, case['catalog'])
            reopened = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert [child.Label for child in reopened] == labels, 'FCStd component mismatch'
            for child in reopened:
                check_shape(child.Shape)
            record.update(passed=True, components=len(reopened), maxBoundsError=max(bound_errors),
                          maxRelativeVolumeError=max(volume_errors), intersections=intersections,
                          independentMovement=len(reopened) > 1, stepRoundtrip=True, fcstdRoundtrip=True,
                          catalogMetadata=bool(case['catalog']), sourceComponentsChecked=len(references),
                          preservedSourceIntersections=source_intersections)
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
