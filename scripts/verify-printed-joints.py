"""Execute production macros, inspect native solids, motion and STEP/FCStd round trips.

Run verify-printed-joints.ts first, then use a FreeCAD-enabled Python interpreter.
Generated evidence stays under ignored test-results/printed-joints/.
"""
import json
import os
from pathlib import Path
import sys
import traceback

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

output = Path('test-results/printed-joints').resolve()
cases = json.loads((output / 'cases.json').read_text())
report = {'freecad': App.Version(), 'cases': []}


def inspect(shape):
    assert shape.isValid() and shape.isClosed() and shape.Volume > 0
    assert len(shape.Solids) == 1, 'A physical printed part must be one solid'
    surfaces = {}
    for face in shape.Faces:
        name = type(face.Surface).__name__
        surfaces[name] = surfaces.get(name, 0) + 1
    assert len(shape.Faces) < 100, 'Investigate unnecessary topology growth'
    b = shape.optimalBoundingBox(False, False)
    return {'volume': shape.Volume, 'faces': len(shape.Faces), 'surfaces': surfaces,
            'bounds': [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]}


def compare_roundtrip(original, restored):
    assert restored.isValid() and restored.isClosed()
    assert len(restored.Solids) == len(original.Solids) == 2
    assert abs(restored.Volume - original.Volume) < max(1e-6, original.Volume * 1e-8)
    a, b = original.optimalBoundingBox(False, False), restored.optimalBoundingBox(False, False)
    assert max(abs(getattr(a, k) - getattr(b, k)) for k in
               ['XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax']) < 1e-5


for index, case in enumerate(cases):
    row = {'name': case['name'], 'passed': False}
    doc = None
    try:
        doc = App.newDocument('PrintedJointAudit')
        exec(case['script'], {})
        features = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
        assert len(features) == 2
        shapes = [obj.Shape for obj in features]
        row['components'] = [inspect(shape) for shape in shapes]
        root = next(obj for obj in doc.Objects if hasattr(obj, 'PartId'))
        identity_keys = ['LibraryId', 'PresetId', 'LibraryEntryId', 'ConfigurationKey', 'ModelState', 'Configuration']
        root_identity = {key: getattr(root, key) for key in identity_keys}
        assert root.LibraryId == case['partId'] and root.ModelState == case['state']
        assert shapes[0].common(shapes[1]).Volume < 1e-7, 'Unexpected rigid-body intersection'
        row['intersectionVolume'] = shapes[0].common(shapes[1]).Volume
        whole = Part.makeCompound(shapes)
        bounds = whole.optimalBoundingBox(False, False)
        assert max(abs(a-b) for a, b in zip(
            [bounds.XLength, bounds.YLength, bounds.ZLength], case['dimensions'])) < 0.03
        if case['state'] == 'print':
            assert all(abs(shape.BoundBox.ZMin) < 1e-6 for shape in shapes)
            assert shapes[0].distToShape(shapes[1])[0] >= 7.999
        if case['state'] == 'assembled':
            distance = None
            axis = None
            if case['partId'] in ['printed-dovetail-joint', 'printed-tongue-groove-joint']:
                distance, axis = case['parameters']['length'] + 8, App.Vector(0, 1, 0)
                p = case['parameters']
                n, h, c = p['tongueWidth'], p['tongueHeight'], p['clearance']
                head = p.get('headWidth', n)
                slope = (head-n)/(2*h)
                slot_bottom = n/2 + slope*c + c*(1+slope*slope)**0.5
                slot_top = slot_bottom + slope*h
                expected = [p['length']*(p['width']*p['baseThickness']+(n+head)*h/2),
                            p['length']*(p['width']*(h+p['baseThickness'])-(slot_bottom+slot_top)*h)]
                for shape, volume, data in zip(shapes, expected, row['components']):
                    assert abs(shape.Volume-volume) < 1e-6
                    assert set(data['surfaces']) == {'Plane'}
            elif case['partId'] == 'printed-pin-joint':
                p = case['parameters']
                distance, axis = p['engagement'] + p['endClearance'] + 8, App.Vector(0, 0, 1)
                assert 'Cylinder' in row['components'][0]['surfaces']
                assert 'Cone' in row['components'][0]['surfaces']
                assert row['components'][1]['surfaces'].get('Cylinder') == 1
                r, c, h = p['pinDiameter']/2, p['tipChamfer'], p['engagement']
                import math
                expected_pin = p['width']**2*p['baseThickness'] + math.pi*r*r*(h-c) + math.pi*c/3*(r*r+r*(r-c)+(r-c)**2)
                expected_socket = p['width']**2*(h+p['endClearance']+p['wall']-p['faceGap']) - math.pi*(r+p['clearance']/2)**2*(h+p['endClearance']-p['faceGap'])
                assert abs(shapes[0].Volume - expected_pin) < 1e-6
                assert abs(shapes[1].Volume - expected_socket) < 1e-6
            elif case['partId'] == 'printed-snap-joint':
                p = case['parameters']
                L, b, t, e = p['length'], p['width'], p['thickness'], p['hook']
                r, w, c = p['rootRadius'], p['wall'], p['clearance']
                rear, bottom = r+L, w+c+e
                hook = Part.Face(Part.makePolygon([
                    App.Vector(rear,-b/2,bottom), App.Vector(rear,-b/2,bottom-e),
                    App.Vector(rear+e,-b/2,bottom), App.Vector(rear,-b/2,bottom),
                ])).extrude(App.Vector(0,b,0))
                captured = hook.copy()
                captured.translate(App.Vector(-c-min(e,w)/2,0,0))
                assert captured.common(shapes[1]).Volume > 1e-7, 'Catch must block an undeformed withdrawing hook'
                for step in range(41):
                    lifted = hook.copy()
                    lifted.translate(App.Vector(-(rear+e+p['releaseTab']+p['anchor']+8)*step/40,0,e))
                    assert lifted.common(shapes[1]).Volume < 1e-7, 'Lifted hook release envelope is blocked'
                radii = [face.Surface.Radius for face in shapes[0].Faces
                         if type(face.Surface).__name__ == 'Cylinder']
                assert len(radii) == 2 and all(abs(value-r) < 1e-8 for value in radii)
                row['snapHookEnvelope'] = {
                    'undeformedHookCaptured': True, 'hookLift': e, 'releaseSamples': 41,
                    'rootFilletRadii': radii,
                    'scope': 'Isolated hook/catch envelope only; no elastic beam simulation or force test',
                }
            if axis:
                for step in range(41):
                    moved = shapes[1].copy()
                    moved.translate(axis * (distance * step / 40))
                    assert shapes[0].common(moved).Volume < 1e-7, 'Blocked rigid insertion path'
                row['axialPathSamples'] = 41
        filename = output / f'case-{index:03d}'
        whole.exportStep(str(filename) + '.step')
        compare_roundtrip(whole, Part.read(str(filename) + '.step'))
        row['stepRoundtrip'] = True
        before = [(obj.Label, obj.ESKDIdentityJSON) for obj in features]
        doc.saveAs(str(filename) + '.FCStd')
        App.closeDocument(doc.Name)
        doc = App.openDocument(str(filename) + '.FCStd')
        restored_features = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
        restored_root = next(obj for obj in doc.Objects if hasattr(obj, 'PartId'))
        assert {key: getattr(restored_root, key) for key in identity_keys} == root_identity
        row['rootIdentityRoundtrip'] = True
        assert [(obj.Label, obj.ESKDIdentityJSON) for obj in restored_features] == before
        compare_roundtrip(whole, Part.makeCompound([obj.Shape for obj in restored_features]))
        row['fcstdRoundtrip'] = True
        row['passed'] = True
    except Exception:
        row['error'] = traceback.format_exc()
    finally:
        if doc:
            App.closeDocument(doc.Name)
        report['cases'].append(row)
        report['passed'] = sum(item['passed'] for item in report['cases'])
        report['failed'] = sum(not item['passed'] for item in report['cases'])
        (output / 'native-report.json').write_text(json.dumps(report, indent=2))

print(json.dumps({'passed': report['passed'], 'failed': report['failed'], 'report': str(output / 'native-report.json')}))
sys.exit(bool(report['failed']))
