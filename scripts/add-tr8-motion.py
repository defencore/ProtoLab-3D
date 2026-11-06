"""Attach saved native FreeCAD expressions for the compact fixed TR8 mechanism.

The controller remains usable after reopening without an installed Python proxy.
All source solids and SourceRGB records are preserved; only placements move.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

PART_ID = 'tr8-compact-actuator'
RADIUS, LEAD = 10.0, 8.0
PIVOT = (0, 0, 0)
SCREW_ORIGIN = (0, 0, 10)


def features(root):
    values = []
    for item in root.Group:
        if item.TypeId == 'App::Part':
            values.extend(features(item))
        elif hasattr(item, 'Shape') and hasattr(item, 'AssemblyOccurrenceId'):
            values.append(item)
    return values


def world_shape(item):
    shape = item.Shape.copy()
    shape.Placement = item.getGlobalPlacement()
    return shape


def category(item):
    identity, label = item.AssemblyOccurrenceId, item.Label
    if (identity in ['lead-screw', 'coupling'] or
        identity == 'gearmotor' and '/ Output shaft' in label or
        identity.startswith('screw-bearing-') and '/ Inner ring' in label or
        identity.startswith('screw-circlip-') or
        identity in ['fixed-inner-spacer', 'fixed-outer-spacer', 'floating-inner-spacer', 'floating-outer-spacer']):
        return 'screw'
    if identity in ['lead-nut', 'nut-yoke'] or identity.startswith('nut-flange-'):
        return 'nut'
    if (identity in ['output-shaft', 'output-end-cap', 'output-front-crank', 'output-rear-crank'] or
        identity.startswith('output-bearing-') and '/ Inner ring' in label or
        identity.startswith('output-') and any(word in identity for word in ['clamp', 'circlip', 'spacer'])):
        return 'output'
    return None


def add_property(item, kind, name, description):
    if name not in item.PropertiesList:
        item.addProperty(kind, name, 'Mechanism', description)


def attach_motion(doc):
    root = next(item for item in doc.RootObjects if getattr(item, 'PartId', None) == PART_ID)
    assert not hasattr(root, 'MotionControl'), 'Choose a neutral static source document.'
    assert abs(json.loads(root.Configuration)['outputAngle']) < 1e-9
    physical = features(root)
    control = doc.addObject('App::FeaturePython', 'MotionControl')
    control.Label = 'Angle control · -20° to +20°'
    control.addProperty('App::PropertyFloatConstraint', 'AngleCommand', 'Mechanism')
    control.AngleCommand = (0, -20, 20, 0.1)
    expressions = [
        ('App::PropertyAngle', 'OutputAngle', 'min(max(AngleCommand * 1 deg, -20 deg), 20 deg)'),
        ('App::PropertyLength', 'NutTravelFromCentre', '10 mm * tan(OutputAngle)'),
        ('App::PropertyLength', 'PinRadius', '10 mm / cos(OutputAngle)'),
        ('App::PropertyAngle', 'ScrewRotation', '-360 deg * (NutTravelFromCentre / 8 mm)'),
    ]
    for kind, name, expression in expressions:
        add_property(control, kind, name, 'Native persisted TR8 mechanism expression.')
        control.setExpression(name, expression)
        control.setEditorMode(name, 1)
        add_property(root, kind, name, 'Read-only result; edit Angle control.AngleCommand.')
        root.setExpression(name, control.Name+'.'+name)
        root.setEditorMode(name, 1)
    add_property(root, 'App::PropertyLink', 'MotionControl', 'Edit this control to move the mechanism.')
    root.MotionControl = control
    add_property(root, 'App::PropertyString', 'MotionExpressionsVersion', 'Fixed compact TR8 motion contract.')
    root.MotionExpressionsVersion = 'TR8-1'
    root.MotionLaw = 'Nut travel=10*tan(angle) mm; pin radius=10/cos(angle); screw rotation=-360*travel/8 degrees; fixed supports; output range±20deg.'
    definitions = {
        'screw': ('ScrewSpin', SCREW_ORIGIN, (1, 0, 0), 'ScrewRotation'),
        'nut': ('NutSlide', (0, 0, 0), None, 'NutTravelFromCentre'),
        'output': ('OutputMotion', PIVOT, (0, 1, 0), 'OutputAngle'),
    }
    groups = {}
    for key, (name, origin, axis, expression) in definitions.items():
        group = doc.addObject('App::Part', name)
        group.Placement = App.Placement(App.Vector(*origin), App.Rotation())
        root.addObject(group)
        groups[key] = group
    for item in physical:
        name = category(item)
        if name is None:
            continue
        before = item.getGlobalPlacement()
        groups[name].addObject(item)
        item.Placement = groups[name].getGlobalPlacement().inverse().multiply(before)
    for key, (_, _, axis, expression) in definitions.items():
        group = groups[key]
        if axis is None:
            group.setExpression('Placement.Base.x', control.Name+'.'+expression)
        else:
            for coordinate, value in zip('xyz', axis):
                group.setExpression('Placement.Rotation.Axis.'+coordinate, str(value))
            group.setExpression('Placement.Rotation.Angle', control.Name+'.'+expression)
    doc.recompute()
    assert all(group.Group for group in groups.values())
    assert len(features(root)) == len(physical)
    return root


def bvalues(shape):
    b = shape.optimalBoundingBox(False, False)
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]


def load_static_references(doc, root, cases_path):
    source_cases = json.loads(Path(cases_path).read_text())
    source_configuration = json.loads(root.Configuration)
    reference = {item['parameters']['outputAngle']: item for item in source_cases
                 if item['mode'] == root.GeometryMode and item['parameters']['motorModel'] == source_configuration['motorModel']}
    audit_path = Path(cases_path).with_name('native-report.json')
    audit = json.loads(audit_path.read_text())
    assert audit['casesSha256'] == hashlib.sha256(Path(cases_path).read_bytes()).hexdigest()
    references = {}
    for angle, case in reference.items():
        proof = next(item for item in audit['cases'] if item['name'] == case['name'])
        assert proof['passed'] and proof['codeSha256'] == hashlib.sha256(case['script'].encode()).hexdigest()
        path = Path(cases_path).with_name(case['name']+'.FCStd')
        assert path.is_file(), ('Audit each static pose before attaching motion', path)
        source_doc = doc if Path(doc.FileName).resolve() == path.resolve() else App.openDocument(str(path))
        try:
            source_root = next(item for item in source_doc.RootObjects if getattr(item, 'PartId', None) == PART_ID)
            assert json.loads(source_root.Configuration) == case['parameters'] and source_root.GeometryMode == case['mode']
            values = sorted(features(source_root), key=lambda item: item.ComponentIndex)
            assert len(values) == proof['components']
            references[angle] = [(world_shape(item), item.AssemblyOccurrenceId) for item in values]
        finally:
            if source_doc != doc:
                App.closeDocument(source_doc.Name)
    return reference, references


def verify_motion(doc, root, reference_data):
    children = features(root)
    controller = root.MotionControl
    reference, references = reference_data
    controller.AngleCommand = 0
    doc.recompute()
    neutral = {item.Name: world_shape(item) for item in children}
    rows = []
    for angle in [-20, -10, 0, 10, 20, 0]:
        controller.AngleCommand = angle
        doc.recompute()
        travel = RADIUS*math.tan(math.radians(angle))
        radius = RADIUS/math.cos(math.radians(angle))
        assert abs(root.NutTravelFromCentre.Value-travel) < 1e-8
        assert abs(root.PinRadius.Value-radius) < 1e-8
        assert abs(root.ScrewRotation.Value+360*travel/LEAD) < 1e-7
        local_pin = App.Rotation(App.Vector(0, 1, 0), -angle).multVec(App.Vector(travel, 0, 10))
        assert abs(local_pin.x) < 1e-8 and abs(local_pin.z-radius) < 1e-8
        actual = {item.ComponentIndex: world_shape(item) for item in children}
        for item in children:
            shape = actual[item.ComponentIndex]
            assert shape.isValid() and shape.isClosed() and shape.Volume > 0
            if category(item) is None:
                assert max(abs(a-b) for a, b in zip(bvalues(shape), bvalues(neutral[item.Name]))) < 1e-7
        max_error = None
        if angle in reference:
            errors = []
            assert len(references[angle]) == len(children)
            for index, (shape, identity) in enumerate(references[angle], 1):
                physical = next(item for item in children if item.ComponentIndex == index)
                assert physical.AssemblyOccurrenceId == identity
                error = max(abs(a-b) for a, b in zip(bvalues(shape), bvalues(actual[index])))
                assert error < 1e-5, ('Motion differs from the configured static pose', angle, physical.Label, error)
                errors.append(error)
            max_error = max(errors)
        phase_check = None
        if root.GeometryMode == 'full':
            screw = actual[next(item.ComponentIndex for item in children if item.AssemblyOccurrenceId == 'lead-screw')]
            phase = math.radians(root.ScrewRotation.Value)
            r = 3.6
            groove = App.Vector(0, r*math.sin(phase+math.pi/4), 10-r*math.cos(phase+math.pi/4))
            crest = App.Vector(0, r*math.sin(phase), 10-r*math.cos(phase))
            assert not screw.isInside(groove, 1e-7, False), ('Four-start groove phase changed', angle)
            assert screw.isInside(crest, 1e-7, False) and screw.isInside(App.Vector(0, 0, 10), 1e-7, False)
            phase_check = {'groovePointIsVoid': True, 'crestAndCoreAreSolid': True, 'azimuthPeriodDegrees': 90}
        rows.append({'angle': angle, 'nutTravel': travel, 'pinRadius': radius,
                     'slotClosureError': abs(local_pin.x), 'maxStaticPoseBoundsError': max_error,
                     **({'nativeHelixPhase': phase_check} if phase_check else {})})
    for command, expected in [(30, 20), (-30, -20)]:
        controller.AngleCommand = command
        doc.recompute()
        assert controller.OutputAngle.Value == expected
    controller.AngleCommand = 0
    doc.recompute()
    return rows


def run(input_path, output_path, cases_path):
    input_path, output_path, cases_path = map(lambda path: Path(path).resolve(), [input_path, output_path, cases_path])
    assert input_path != output_path
    doc = App.openDocument(str(input_path))
    try:
        source_root = next(item for item in doc.RootObjects if getattr(item, 'PartId', None) == PART_ID)
        reference_data = load_static_references(doc, source_root, cases_path)
        root = attach_motion(doc)
        colors = {item.ComponentIndex: list(item.SourceRGB) for item in features(root)}
        checks = verify_motion(doc, root, reference_data)
        root_name = root.Name
        doc.saveAs(str(output_path))
        App.closeDocument(doc.Name)
        doc = App.openDocument(str(output_path))
        root = doc.getObject(root_name)
        reopened = verify_motion(doc, root, reference_data)
        assert all(list(item.SourceRGB) == colors[item.ComponentIndex] for item in features(root))
        report = {'partId': PART_ID, 'file': str(output_path), 'passed': True, 'gui': bool(App.GuiUp),
                  'freecad': '.'.join(App.Version()[:3]), 'physicalComponents': len(features(root)),
                  'poseChecks': checks, 'reopenedPoseChecks': reopened, 'angleControl': root.MotionControl.Name+'.AngleCommand',
                  'colorsPreserved': False, 'sourceRGBPreserved': True,
                  'casesSha256': hashlib.sha256(cases_path.read_bytes()).hexdigest()}
        name = 'full-motion-report.json' if root.GeometryMode == 'full' else 'motion-report.json'
        output_path.with_name(name).write_text(json.dumps(report, indent=2))
        print(json.dumps({'passed': True, 'file': str(output_path), 'poses': len(checks), 'reopenedPoses': len(reopened)}), flush=True)
        return report
    finally:
        if doc and doc.Name in App.listDocuments():
            App.closeDocument(doc.Name)


if __name__ == '__main__':
    run(*sys.argv[1:4])
