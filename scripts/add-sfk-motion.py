"""Attach persistent, bounded native FreeCAD motion expressions to a neutral actuator.

No custom Python document proxy is needed after this script has run. Edit the
MotionControl object's AngleCommand (degrees) to move it. Persisted expressions
limit the actual OutputAngle to -20..20 even after reopening the document.

CLI: FreeCAD-enabled python scripts/add-sfk-motion.py [neutral.FCStd] [motion.FCStd] [cases.json]
GUI: load this module into a namespace and call run(input_path, output_path, cases_path).
The input document is preserved; the motion assembly is saved under a separate name.
"""
import json
import math
import os
from pathlib import Path
import sys

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

VERSION = '7'
OUTPUT_PIVOT = (19.5, 0, 15.0)
CRANK_RADIUS = 13.0
FORK_RADIAL_RANGE = (12.6, 14.2)
NEUTRAL_DRIVE_PHASE = 90


def kinematics(angle):
    radians = math.radians(angle)
    return CRANK_RADIUS * math.tan(radians), CRANK_RADIUS / math.cos(radians)


def features(root):
    result = []
    for item in root.Group:
        if item.TypeId == 'App::Part':
            result.extend(features(item))
        elif hasattr(item, 'Shape') and hasattr(item, 'AssemblyOccurrenceId'):
            result.append(item)
    return result


def world_shape(item):
    shape = item.Shape.copy()
    shape.Placement = item.getGlobalPlacement()
    return shape


def mass_centre(shape):
    volume = sum(solid.Volume for solid in shape.Solids)
    result = App.Vector()
    for solid in shape.Solids:
        result += solid.CenterOfMass * (solid.Volume / volume)
    return result


def motion_category(item):
    identity = item.AssemblyOccurrenceId
    label = item.Label
    if (identity == 'coupling' or
        identity == 'gearmotor' and '/ Output shaft' in label or
        identity == 'ball-screw' and '/ Screw shaft' in label or
        identity.startswith('screw-bearing-') and '/ Inner ring' in label or
        identity.startswith('fixed-locknut-') or
        identity in ['support-circlip', 'fixed-inner-sleeve', 'fixed-shoulder-sleeve', 'floating-inner-sleeve']):
        return 'screw'
    if identity == 'ball-screw' or identity == 'nut-yoke' or identity.startswith('nut-flange-'):
        return 'nut'
    if (identity in ['output-shaft', 'output-end-cap', 'output-front-crank', 'output-rear-crank'] or
        identity.startswith('output-bearing-') and '/ Inner ring' in label or
        identity.startswith('output-') and any(word in identity for word in ['clamp', 'circlip', 'spacer'])):
        return 'output'
    return None


def add_property(obj, kind, name, description):
    if name not in obj.PropertiesList:
        obj.addProperty(kind, name, 'Mechanism', description)


def attach_motion(doc, root=None, part_id='sfk-rotary-actuator', drive_offset_z=0, output_pivot_x=None):
    root = root or next(item for item in doc.RootObjects if hasattr(item, 'PartId') and item.PartId == part_id)
    if getattr(root, 'MotionExpressionsVersion', None) == VERSION:
        return root
    assert not hasattr(root, 'MotionExpressionsVersion'), 'Build a neutral source document before attaching the current motion definition.'
    assert root.TypeId == 'App::Part', 'Expected a complete actuator assembly.'
    configuration = json.loads(root.Configuration)
    assert abs(configuration.get('outputAngle', 0)) < 1e-9, 'Start from the neutral actuator document.'
    physical = features(root)
    assert not any(item.AssemblyOccurrenceId == 'drive-rocker' or item.AssemblyOccurrenceId.startswith('drive-hinge-')
                   for item in physical), 'Use the fixed-drive source assembly for this motion definition.'
    assert not any(item.AssemblyOccurrenceId in ['output-front-pin', 'output-rear-pin', 'output-front-roller', 'output-rear-roller']
                   for item in physical), 'Use the closed-fork source assembly with integral cover pins.'
    output_pivot = App.Vector(OUTPUT_PIVOT[0] if output_pivot_x is None else output_pivot_x, 0, OUTPUT_PIVOT[2] + drive_offset_z)
    old_materials = {item.Name: list(item.ViewObject.ShapeAppearance) for item in physical} if App.GuiUp else {}
    # App::Part depends on its children. A separate controller avoids a dependency
    # cycle when child placements reference the controlling angle.
    control = doc.addObject('App::FeaturePython', 'MotionControl')
    control.Label = 'Angle control · -20° to +20°'
    control.addProperty('App::PropertyFloatConstraint', 'AngleCommand', 'Mechanism',
                        'Requested shaft angle in degrees. Persisted expressions clip the actual OutputAngle to -20..20.')
    control.AngleCommand = (0, -20, 20, 0.1)
    add_property(control, 'App::PropertyAngle', 'OutputAngle', 'Actual output angle, clipped to the mechanical -20..20 degree range.')
    control.setExpression('OutputAngle', 'min(max(AngleCommand * 1 deg, -20 deg), 20 deg)')
    control.setEditorMode('OutputAngle', 1)
    add_property(control, 'App::PropertyLength', 'PinRadius', 'Pin distance from the output shaft along each closed radial fork slot.')
    control.setExpression('PinRadius', '13 mm / cos(OutputAngle)')
    control.setEditorMode('PinRadius', 1)
    add_property(control, 'App::PropertyLength', 'NutTravelFromCentre', 'Ball-nut displacement along the fixed screw from its centre position.')
    control.setExpression('NutTravelFromCentre', '13 mm * tan(OutputAngle)')
    control.setEditorMode('NutTravelFromCentre', 1)
    add_property(control, 'App::PropertyAngle', 'ScrewRotation', 'Physical screw rotation for a right-hand 2.5 mm lead.')
    control.setExpression('ScrewRotation', '-360 deg * (NutTravelFromCentre / 2.5 mm)')
    control.setEditorMode('ScrewRotation', 1)
    add_property(root, 'App::PropertyLink', 'MotionControl', 'Edit this control object to change the mechanism angle.')
    add_property(root, 'App::PropertyLength', 'DriveOffsetZ', 'Parallel drive-axis offset from the original frame datum.')
    root.DriveOffsetZ = drive_offset_z
    root.setEditorMode('DriveOffsetZ', 1)
    root.MotionControl = control
    if 'OutputAngle' in root.PropertiesList:
        root.removeProperty('OutputAngle')
    root.addProperty('App::PropertyAngle', 'OutputAngle', 'Mechanism', 'Current output angle; edit MotionControl.AngleCommand.')
    root.setExpression('OutputAngle', control.Name + '.OutputAngle')
    root.setEditorMode('OutputAngle', 1)
    add_property(root, 'App::PropertyLength', 'NutTravelFromCentre', 'Ball-nut displacement along the fixed screw from its centre position.')
    root.setExpression('NutTravelFromCentre', control.Name + '.NutTravelFromCentre')
    root.setEditorMode('NutTravelFromCentre', 1)
    add_property(root, 'App::PropertyAngle', 'ScrewRotation', 'Physical screw rotation for a right-hand 2.5 mm lead.')
    root.setExpression('ScrewRotation', control.Name + '.ScrewRotation')
    root.setEditorMode('ScrewRotation', 1)
    add_property(root, 'App::PropertyLength', 'PinRadius', 'Current pin distance along the closed radial fork slots.')
    root.setExpression('PinRadius', control.Name + '.PinRadius')
    root.setEditorMode('PinRadius', 1)
    add_property(root, 'App::PropertyString', 'MotionExpressionsVersion', 'Persistent native motion definition version.')
    root.MotionExpressionsVersion = VERSION
    add_property(root, 'App::PropertyString', 'MotionLaw', 'Mechanism displacement and direction law.')
    root.MotionLaw = ('Edit MotionControl.AngleCommand in degrees; actual OutputAngle is clipped to -20..20; '
                      'nut displacement=13*tan(angle) mm; pin radius=13/cos(angle) mm within the closed radial fork slots; '
                      'motor and screw supports stay fixed; neutral drive phase=90 degrees; right-hand screw lead 2.5 mm/revolution.')

    definitions = {
        'screw': ('ScrewSpin', 'Rotating screw, coupling and motor shaft', App.Vector(0, 0, 28 + drive_offset_z), (1, 0, 0), 'ScrewRotation'),
        'nut': ('NutSlide', 'Quarter-turned ball nut and cover with integral pins', App.Vector(), None, 'NutTravelFromCentre'),
        'output': ('OutputMotion', 'Output shaft and opposed closed radial forks', output_pivot, (0, 1, 0), 'OutputAngle'),
    }
    groups = {}
    for key, (name, label, origin, axis, expression) in definitions.items():
        group = doc.addObject('App::Part', name)
        group.Label = label
        group.Placement = App.Placement(origin, App.Rotation())
        root.addObject(group)
        groups[key] = group
    for item in physical:
        category = motion_category(item)
        if category is None:
            continue
        global_placement = item.getGlobalPlacement()
        group = groups[category]
        group.addObject(item)
        item.Placement = group.getGlobalPlacement().inverse().multiply(global_placement)
        add_property(item, 'App::PropertyPlacement', 'NeutralGlobalPlacement', 'Original neutral placement before motion grouping.')
        item.NeutralGlobalPlacement = global_placement
    for key, (_, _, _, axis, expression) in definitions.items():
        group = groups[key]
        if axis is None:
            group.setExpression('Placement.Base.x', control.Name + '.' + expression)
            continue
        for coordinate, value in zip('xyz', axis):
            group.setExpression('Placement.Rotation.Axis.' + coordinate, str(value))
        group.setExpression('Placement.Rotation.Angle', control.Name + '.' + expression)
    doc.recompute()
    assert all(groups[key].Group for key in groups), 'A motion group has no physical children.'
    assert len(features(root)) == len(physical), 'Motion grouping changed the physical component count.'
    if App.GuiUp:
        for item in features(root):
            item.ViewObject.ShapeAppearance = old_materials[item.Name]
            item.ViewObject.DisplayMode = 'Shaded'
    return root


def verify_motion(doc, root, cases_path=None, drive_offset_z=0, output_pivot_x=None):
    output_pivot = App.Vector(OUTPUT_PIVOT[0] if output_pivot_x is None else output_pivot_x, 0, OUTPUT_PIVOT[2] + drive_offset_z)
    children = features(root)
    control = root.MotionControl
    control.AngleCommand = 0
    doc.recompute()
    neutral = {item.Name: world_shape(item) for item in children}
    reference = None
    if cases_path:
        cases = json.loads(Path(cases_path).read_text())
        reference = {case['parameters']['outputAngle']: case for case in cases
                     if case['mode'] == getattr(root, 'GeometryMode', 'simple') and case['parameters']['motorModel'] == json.loads(root.Configuration)['motorModel']}
    results = []
    for angle in [-20, -10, 0, 10, 20, 0]:
        control.AngleCommand = angle
        doc.recompute()
        displacement, pin_radius = kinematics(angle)
        assert abs(root.NutTravelFromCentre.Value - displacement) < 1e-8
        assert abs(root.PinRadius.Value - pin_radius) < 1e-8
        assert abs(root.ScrewRotation.Value + 360 * displacement / 2.5) < 1e-7
        pin = App.Vector(output_pivot.x + displacement, 0, 28 + drive_offset_z)
        local_pin = App.Rotation(App.Vector(0, 1, 0), -angle).multVec(pin - output_pivot)
        closure_error = abs(local_pin.x)
        assert closure_error < 1e-8, ('The linear cover pins must stay on the rotating radial fork centerlines', angle, closure_error)
        assert abs(local_pin.z - pin_radius) < 1e-8
        assert FORK_RADIAL_RANGE[0] < local_pin.z < FORK_RADIAL_RANGE[1]
        actual = {item.ComponentIndex: world_shape(item) for item in children}
        for item in children:
            shape = actual[item.ComponentIndex]
            assert shape.isValid() and shape.isClosed() and shape.Volume > 0
            if motion_category(item) is None:
                assert (mass_centre(shape) - mass_centre(neutral[item.Name])).Length < 1e-7, ('Stationary component moved', item.Label)
        helix_check = None
        if getattr(root, 'GeometryMode', 'simple') == 'full':
            screw_item = next(item for item in children if item.AssemblyOccurrenceId == 'ball-screw' and '/ Screw shaft' in item.Label)
            screw = actual[screw_item.ComponentIndex]
            phase = math.radians(NEUTRAL_DRIVE_PHASE + root.ScrewRotation.Value)
            # At x=-5 the reference right-hand 2.5 mm raceway has two complete
            # turns from x=0. A point within its groove is void; the opposite
            # azimuth and the core remain solid. This checks real helix phase
            # against nut travel without rebuilding the Full assembly per pose.
            radial = 3.8
            groove = App.Vector(-5, radial*math.sin(phase), 28+drive_offset_z-radial*math.cos(phase))
            opposite = App.Vector(-5, -radial*math.sin(phase), 28+drive_offset_z+radial*math.cos(phase))
            core = App.Vector(-5, 0, 28 + drive_offset_z)
            assert not screw.isInside(groove,1e-7,False), ('Screw raceway phase does not follow nut travel', angle)
            assert screw.isInside(opposite,1e-7,False) and screw.isInside(core,1e-7,False), ('Screw stock/core check failed', angle)
            helix_check = {'groovePointIsVoid': True, 'oppositeAndCoreAreSolid': True, 'axialPosition': -5}
        if reference and angle in reference:
            scope = {'App': App, 'Part': Part, 'math': math}
            exec(reference[angle]['source'], scope)
            assert len(scope['components']) == len(children), 'Static and moving assemblies contain different components.'
            errors = []
            for index, (shape, record) in enumerate(zip(scope['components'], scope['component_metadata']), 1):
                item = next(child for child in children if child.ComponentIndex == index)
                assert item.AssemblyOccurrenceId == record['AssemblyOccurrenceId']
                a, b = actual[index].optimalBoundingBox(False, False), shape.optimalBoundingBox(False, False)
                error = max(abs(first-second) for first, second in zip(
                    [a.XMin,a.YMin,a.ZMin,a.XMax,a.YMax,a.ZMax],
                    [b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]))
                errors.append(error)
                assert error < 1e-5, ('Native motion differs from the static pose', item.Label, error)
            results.append({'angle': angle, 'nutTravel': displacement, 'pinRadius': pin_radius,
                            'slotClosureError': closure_error, 'maxStaticPoseBoundsError': max(errors),
                            **({'nativeHelixPhase':helix_check} if helix_check else {})})
        else:
            results.append({'angle': angle, 'nutTravel': displacement, 'pinRadius': pin_radius,
                            'slotClosureError': closure_error,
                            **({'nativeHelixPhase':helix_check} if helix_check else {})})
    # Dynamic FloatConstraint bounds are not serialized by FreeCAD. The persisted
    # expression is the actual limiter, including programmatic edits after reopen.
    control.AngleCommand = 30
    doc.recompute()
    assert control.OutputAngle.Value == 20
    control.AngleCommand = -30
    doc.recompute()
    assert control.OutputAngle.Value == -20
    control.AngleCommand = 0
    doc.recompute()
    return results


def run(input_path=None, output_path=None, cases_path=None, part_id='sfk-rotary-actuator', drive_offset_z=0, output_pivot_x=None):
    directory = Path.cwd() / 'test-results/sfk-rotary-actuator/assembly-v2'
    input_path = Path(input_path or directory / 'sfk0825-0deg.FCStd').resolve()
    output_path = Path(output_path or input_path.with_name('sfk0825-motion.FCStd')).resolve()
    assert input_path != output_path, 'Save the motion assembly separately from the source document.'
    cases_path = Path(cases_path) if cases_path else input_path.with_name('cases.json')
    doc = App.openDocument(str(input_path))
    try:
        source_root = next(item for item in doc.RootObjects if hasattr(item, 'PartId') and item.PartId == part_id)
        color_baseline = {item.ComponentIndex: list(item.ViewObject.ShapeAppearance[0].DiffuseColor)[:3]
                          for item in features(source_root)} if App.GuiUp else {}
        root = attach_motion(doc, part_id=part_id, drive_offset_z=drive_offset_z, output_pivot_x=output_pivot_x)
        checks = verify_motion(doc, root, cases_path if cases_path.exists() else None, drive_offset_z=drive_offset_z, output_pivot_x=output_pivot_x)
        root_name = root.Name
        # Render previews separately with render-sfk-actuator.py, whose explicit
        # camera avoids FreeCAD's animated view transition during scripted saves.
        doc.saveAs(str(output_path))
        App.closeDocument(doc.Name)
        doc = App.openDocument(str(output_path))
        root = doc.getObject(root_name)
        reopened_checks = verify_motion(doc, root, cases_path if cases_path.exists() else None, drive_offset_z=drive_offset_z, output_pivot_x=output_pivot_x)
        color_errors = []
        if App.GuiUp:
            for item in features(root):
                material = item.ViewObject.ShapeAppearance[0]
                actual = list(material.DiffuseColor)[:3]
                expected = color_baseline[item.ComponentIndex]
                error = max(abs(a-b) for a,b in zip(actual, expected))
                assert error < 1e-5, ('Motion FCStd changes component color', item.Label, actual, expected)
                assert item.ViewObject.DisplayMode == 'Shaded' and material.Transparency == 0
                color_errors.append(error)
        report = {'file': str(output_path), 'freecad': '.'.join(App.Version()[:3]),
                  'gui': bool(App.GuiUp), 'passed': True, 'poseChecks': checks,
                  'reopenedPoseChecks': reopened_checks,
                  'physicalComponents': len(features(root)),
                  'angleControl': root.MotionControl.Name + '.AngleCommand',
                  'colorsPreserved': bool(App.GuiUp), 'maxColorDifference': max(color_errors) if color_errors else None,
                  'motionGroups': {item.Name: len(item.Group) for item in doc.Objects if item.TypeId == 'App::Part' and item != root}}
        report_name = 'full-motion-report.json' if getattr(root, 'GeometryMode', 'simple') == 'full' else 'motion-report.json'
        output_path.with_name(report_name).write_text(json.dumps(report, indent=2))
        print(json.dumps(report), flush=True)
        return report
    finally:
        if doc and doc.Name in App.listDocuments():
            App.closeDocument(doc.Name)


if __name__ == '__main__':
    run(*sys.argv[1:4])
