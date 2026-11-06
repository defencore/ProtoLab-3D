"""Independent OpenCascade checks for the public geared-rocker CAD recipe.

Run the TypeScript capture first, then this file with FreeCAD's Python runtime.
The checks concern rigid geometry and assembly clearances, not load capacity.
Pass the output directory followed by --resume to finish an interrupted export
check without repeating completed tests against the identical capture file.
"""
import hashlib
import json
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'test-results/tr8-geared-rocker')
capture = out / 'capture.json'
data = json.loads(capture.read_text())
assert data['schemaVersion'] == 3, 'Regenerate the current mechanism capture.'
started = time.monotonic()
report = {
    'passed': False,
    'captureSha256': hashlib.sha256(capture.read_bytes()).hexdigest(),
    'verifierSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'poses': [],
    'publicMacros': [],
    'sources': dict(data.get('sources', {}), **data.get('motorSources', {}), **data.get('dependencySources', {})),
}
elapsed_offset = 0
if '--resume' in sys.argv[2:]:
    previous = json.loads((out / 'native-report.json').read_text())
    assert previous['captureSha256'] == report['captureSha256'], 'Resume requires the identical captured source.'
    previous.setdefault('resumedFromVerifierSha256', []).append(previous['verifierSha256'])
    previous['verifierSha256'] = report['verifierSha256']
    previous['passed'] = False
    previous.pop('error', None)
    elapsed_offset = previous['elapsedSeconds']
    report = previous
completed = {(row['execution'], row['mode'], row['angle']) for row in report['poses'] if row.get('completed') is True}


def save(stage):
    report['elapsedSeconds'] = elapsed_offset + time.monotonic() - started
    (out / 'native-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(stage, flush=True)


def execute(source):
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(source, scope)
    return scope


def valid(shape):
    return (not shape.isNull() and shape.isValid() and shape.isClosed()
            and len(shape.Solids) > 0 and shape.Volume > 0)


def overlap(first, second):
    a, b = first.BoundBox, second.BoundBox
    if any(min(getattr(a, k + 'Max'), getattr(b, k + 'Max'))
           - max(getattr(a, k + 'Min'), getattr(b, k + 'Min')) < 1e-8 for k in 'XYZ'):
        return 0.0
    return abs(first.common(second).Volume)


try:
    for row in data['poses']:
        key = (row['execution'], row['mode'], row['angle'])
        if key in completed and not (row['mode'] == 'full' and row['angle'] == 0 and row['execution'] not in report.get('exports', {})):
            continue
        scope = execute(row['source'])
        shapes = scope['components']
        assert all(valid(s) for s in shapes), ('invalid native child', row['mode'], row['angle'])
        groups = {}
        for shape, metadata in zip(shapes, scope['component_metadata']):
            groups.setdefault(metadata['AssemblyOccurrenceId'], []).append(shape)
        records = {key: group[0] if len(group) == 1 else Part.makeCompound(group)
                   for key, group in groups.items()}
        assert set(records) == {p['id'] for p in row['occurrences']}, ('native occurrence identities', row['angle'])
        for item in row['occurrences']:
            shape = records[item['id']]
            assert valid(shape), ('invalid native component', row['mode'], row['angle'], item['id'])
            if item['requireSingleSolid']:
                assert len(shape.Solids) == 1, ('disconnected manufactured part', item['id'])
        checked = 0
        collisions = []
        for index, first in enumerate(row['occurrences']):
            for second in row['occurrences'][:index]:
                volume = overlap(records[first['id']], records[second['id']])
                checked += 1
                if volume > 1e-6:
                    collisions.append({'first': first['id'], 'second': second['id'], 'volumeMm3': volume})
        details = {
            'execution': row['execution'], 'mode': row['mode'], 'angle': row['angle'],
            'occurrences': len(records), 'validManufacturedSolids': True,
            'nativeChildren': len(shapes),
            'pairChecks': checked, 'collisions': collisions,
        }
        report['poses'] = [p for p in report['poses'] if (p['execution'], p['mode'], p['angle']) != key]
        report['poses'].append(details)
        save('pose ' + row['execution'] + ' ' + row['mode'] + ' ' + str(row['angle']))
        if row['mode'] == 'simple' and row['angle'] == 0:
            supports = []
            for identity, body_offset in [('screw-front-bearing', .3), ('screw-rear-bearing', -.3)]:
                item = next(p for p in row['occurrences'] if p['id'] == identity)
                centre = item['placement']['translation']
                origin = App.Vector(centre[0] + body_offset - .4, centre[1], centre[2])
                axis = App.Vector(1, 0, 0)
                probe = Part.makeCylinder(5.4, .8, origin, axis).cut(Part.makeCylinder(5.02, .8, origin, axis))
                fraction = overlap(probe, records['frame']) / probe.Volume
                assert fraction > .99, ('screw bearing has no surrounding frame seat', identity, fraction)
                outer = next(s for s, m, label in zip(shapes, scope['component_metadata'], scope['component_labels'])
                             if m['AssemblyOccurrenceId'] == identity and 'Flanged outer ring' in label)
                axial_distance = outer.distToShape(records['frame'])[0]
                assert axial_distance < 1e-6, ('screw bearing flange has no axial frame shoulder', identity, axial_distance)
                supports.append({'id': identity, 'radialSupportFraction': fraction, 'flangeShoulderGapMm': axial_distance})
            report['screwBearingSeats'] = supports
        # The external nut corners stop on the carrier; relieved central faces
        # remain clear of the bearing at the same nominal axial stations.
        if abs(row['angle']) == 20:
            front_stop = row['angle'] > 0
            boundary = data['layout']['threadStart'] if front_stop else data['layout']['threadEnd']
            nut = records['nut']
            coarse = nut.BoundBox
            tight = nut.optimalBoundingBox(False, False)
            actual = tight.XMin if front_stop else tight.XMax
            assert abs(actual-boundary) < 1e-6, ('nut does not stop at the exact wall plane', row['execution'], row['angle'], actual, boundary)
            # Trimmed helical B-spline control points can inflate BoundBox.
            # Independently reject any real material outside the wall plane.
            outside_origin = boundary-60-.000001 if front_stop else boundary+.000001
            outside = nut.common(Part.makeBox(60, 100, 100, App.Vector(outside_origin, -50, -50)))
            assert abs(outside.Volume) < 1e-8, ('nut material breaches exact wall stop', row['execution'], row['angle'], outside.Volume)
            gap = nut.distToShape(records['frame'])[0]
            assert gap < 1e-6, ('no physical wall contact at the permitted limit', gap)
            bearing_id = 'screw-front-bearing' if front_stop else 'screw-rear-bearing'
            bearing_gap = nut.distToShape(records[bearing_id])[0]
            assert bearing_gap > .19, ('nut stop loads a bearing instead of carrier corners', bearing_gap)
            direction = -1 if front_stop else 1
            probe = nut.copy()
            probe.translate(App.Vector(direction*.0001, 0, 0))
            footprint = overlap(probe, records['frame'])/.0001
            assert footprint > 10, ('insufficient wall-stop contact footprint', footprint)
            overtravel = data['layout']['lever'] * (math.tan(math.radians(20.1))-math.tan(math.radians(20)))
            wrong = nut.copy()
            wrong.translate(App.Vector(direction*overtravel, 0, 0))
            stop_collision = overlap(wrong, records['frame'])
            assert stop_collision > .1, ('nut passes the nominal 20 degree wall stop', stop_collision)
            assert overlap(wrong, records[bearing_id]) < 1e-6, 'Bearing contacts before the relieved wall stop.'
            details['wallStop'] = {'planeX': boundary, 'coarseBoundX': coarse.XMin if front_stop else coarse.XMax,
                                  'optimalBoundX': actual, 'outsideMaterialVolumeMm3': abs(outside.Volume), 'contactGapMm': gap, 'bearingGapMm': bearing_gap,
                                  'thinProbeFootprintMm2': footprint, 'overtravel20_1degFrameOverlapMm3': stop_collision}
        if row['angle'] == 0:
            assert abs(records['screw-front-bearing'].BoundBox.XMax-data['layout']['threadStart']) < 1e-6
            assert abs(records['screw-rear-bearing'].BoundBox.XMin-data['layout']['threadEnd']) < 1e-6
            features = next(json.loads(m['ThreadFeaturesJSON']) for m in scope['component_metadata'] if m['AssemblyOccurrenceId']=='screw')
            assert features[0]['length'] == 31 and features[0]['origin'][0] == 0, 'Working thread must span both bearing inner faces.'
        if row['mode'] == 'full':
            screw = records[data['ids']['screw']]
            nut = records[data['ids']['nut']]
            wrong = screw.copy()
            wrong.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), 90)
            control = overlap(wrong, nut)
            assert control > .1, ('full-mode screw has no phase-sensitive thread', control)
            details['wrongPhaseThreadOverlapMm3'] = control
            moved = nut.copy()
            moved.translate(App.Vector(4, 0, 0))
            advanced = overlap(screw, moved)
            assert advanced < 1e-6, ('TR8x4 lead advance does not mate', advanced)
            details['oneLeadAdvanceOverlapMm3'] = advanced
            if row['angle'] == 0:
                contacts = []
                for clip_id, bearing_id, direction in [
                        ('gear-clip', 'screw-front-bearing', (1, 0, 0)),
                        ('screw-rear-clip', 'screw-rear-bearing', (-1, 0, 0)),
                        ('output-clip', 'output-lower-bearing', (0, 0, 1))]:
                    clip = records[clip_id]
                    probe = clip.copy()
                    probe.translate(App.Vector(*direction) * .0001)
                    children = [(shape, label) for shape, metadata, label in zip(shapes, scope['component_metadata'], scope['component_labels'])
                                if metadata['AssemblyOccurrenceId'] == bearing_id]
                    inner = next(shape for shape, label in children if label.endswith('/ Inner ring'))
                    inner_gap = clip.distToShape(inner)[0]
                    inner_footprint = overlap(probe, inner) / .0001
                    assert inner_gap < 1e-6 and inner_footprint > 5, ('E-clip misses bearing inner face', clip_id, inner_gap, inner_footprint)
                    other_gap = min(clip.distToShape(shape)[0] for shape, label in children if not label.endswith('/ Inner ring'))
                    other_footprint = sum(overlap(probe, shape) for shape, label in children if not label.endswith('/ Inner ring')) / .0001
                    assert other_gap > .15 and other_footprint < 1e-6, ('E-clip rubs stationary bearing parts', clip_id, other_gap, other_footprint)
                    contacts.append({'id': clip_id, 'innerEdgeGapMm': inner_gap, 'thinProbeInnerFootprintMm2': inner_footprint,
                                     'minimumOtherPartsGapMm': other_gap, 'thinProbeOtherFootprintMm2': other_footprint})
                report['directEClipContacts'] = contacts
                assert not any('shim' in identity or 'spacer' in identity or 'sleeve' in identity for identity in records), 'Removed bearing spacers remain.'
                gear = records['driven-gear']
                frame_gap = gear.distToShape(records['frame'])[0]
                bearing_gap = gear.distToShape(records['screw-front-bearing'])[0]
                assert frame_gap > 2.99 and bearing_gap > 2.99, ('pinned gear is clamped to case or bearing', frame_gap, bearing_gap)
                report['gearClearances'] = {'frameGapMm': frame_gap, 'bearingGapMm': bearing_gap}
                assert records['frame'].isInside(App.Vector(-1.5, 12, 0), 1e-7, True), 'Motor plate is not flat at X=-3...0.'
                assert not records['frame'].isInside(App.Vector(-4.5, 12, 0), 1e-7, True), 'Old offset motor plate remains.'
                # The integral nut pins enter through the open radial fork ends.
                # Keep the frame, screw and nut stationary during this real path.
                run_insertion = row['execution'] == data['primary'] and 'insertionPaths' not in report
                insertion = report.get('insertionPaths', {'forkSteps': 0, 'shaftSteps': 0, 'crossPinSteps': 0, 'screwFeedSteps': 0,
                    'frontBearingSteps': 0, 'gearSteps': 0, 'gearPinSteps': 0, 'eClipRadialSteps': 0, 'maximumOverlapMm3': 0.0})
                for step in range(101 if run_insertion else 0):
                    offset = -50 + step * .5
                    moving = records['screw'].copy()
                    moving.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), 90 * offset)
                    moving.translate(App.Vector(offset, 0, 0))
                    for target in ['frame', 'nut']:
                        volume = overlap(moving, records[target])
                        insertion['maximumOverlapMm3'] = max(insertion['maximumOverlapMm3'], volume)
                        assert volume < 1e-6, ('bare screw axial installation obstructed', offset, target, volume)
                    insertion['screwFeedSteps'] += 1
                wrong = records['screw'].copy()
                wrong.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), -45)
                wrong.translate(App.Vector(.5, 0, 0))
                control = overlap(wrong, records['nut'])
                assert control > .1, ('screw-feed sign control did not interfere', control)
                insertion['wrongFeedSignOverlapMm3'] = control
                for step in range(41 if run_insertion else 0):
                    offset = -20 + step * .5
                    for identity, targets, counter in [
                            ('screw-front-bearing', ['frame', 'screw'], 'frontBearingSteps'),
                            ('driven-gear', [key for key in records if key != 'driven-gear' and key not in data['ids']['gearPins']], 'gearSteps'),
                            ('motor-pinion', [key for key in records if key != 'motor-pinion' and key not in data['ids']['gearPins']], 'gearSteps')]:
                        moving = records[identity].copy()
                        moving.translate(App.Vector(offset, 0, 0))
                        for target in targets:
                            volume = overlap(moving, records[target])
                            insertion['maximumOverlapMm3'] = max(insertion['maximumOverlapMm3'], volume)
                            assert volume < 1e-6, ('round gear-stack installation obstructed', identity, step, target, volume)
                        insertion[counter] += 1
                gear_controls = []
                for identity, gear_id, shaft_id in [('screw-gear-pin', 'driven-gear', 'screw'), ('motor-gear-pin', 'motor-pinion', 'motor')]:
                    item = next(p for p in row['occurrences'] if p['id'] == identity)
                    assert records[identity].BoundBox.XMax <= data['layout']['gearStart'] - .99, ('gear pin reaches toothed face', identity)
                    assert records[identity].BoundBox.XMin >= data['layout']['gearHubStart'], ('gear pin reaches outside hub end', identity)
                    rx, ry, rz = item['placement']['rotation']
                    rotation = App.Rotation(App.Vector(0, 0, 1), rz).multiply(App.Rotation(App.Vector(0, 1, 0), ry)).multiply(App.Rotation(App.Vector(1, 0, 0), rx))
                    direction = rotation.multVec(App.Vector(0, 0, 1))
                    for step in range(61 if run_insertion else 0):
                        moving = records[identity].copy()
                        moving.translate(direction * (30 - step * .5))
                        for target in [key for key in records if key != identity]:
                            volume = overlap(moving, records[target])
                            insertion['maximumOverlapMm3'] = max(insertion['maximumOverlapMm3'], volume)
                            assert volume < 1e-6, ('gear spring-pin installation obstructed', identity, step, target, volume)
                        insertion['gearPinSteps'] += 1
                    wrong_pin = records[identity].copy()
                    wrong_pin.translate(App.Vector(.3, 0, 0))
                    shaft_collision = overlap(wrong_pin, records[shaft_id])
                    assert shaft_collision > .01, ('gear pin does not pass a real shaft cross-hole', identity, shaft_collision)
                    wrong_gear = records[gear_id].copy()
                    wrong_gear.translate(App.Vector(.15, 0, 0))
                    axial_collision = overlap(wrong_gear, records[identity])
                    assert axial_collision > .01, ('cross-pin fails to retain gear axially', identity, axial_collision)
                    gear_controls.append({'id': identity, 'wrongPinShaftOverlapMm3': shaft_collision, 'gearAxialShiftPinOverlapMm3': axial_collision})
                report['gearPinControls'] = gear_controls
                for step in range(25 if run_insertion else 0):
                    for identity in data['ids']['forks']:
                        moving = records[identity].copy()
                        moving.translate(App.Vector(0, -12 + step * .5, 0))
                        for target in ['frame', 'nut', 'screw']:
                            volume = overlap(moving, records[target])
                            insertion['maximumOverlapMm3'] = max(insertion['maximumOverlapMm3'], volume)
                            assert volume < 1e-6, ('fork plate radial insertion obstructed', identity, step, target, volume)
                        insertion['forkSteps'] += 1
                # Slide the round shaft through both bearing bores and both
                # round plate bores before installing transverse spring pins.
                for step in range(71 if run_insertion else 0):
                    moving = records['output-shaft'].copy()
                    moving.translate(App.Vector(0, 0, 35 - step * .5))
                    for target in ['frame', *data['ids']['forks'], 'output-upper-bearing', 'output-lower-bearing']:
                        volume = overlap(moving, records[target])
                        insertion['maximumOverlapMm3'] = max(insertion['maximumOverlapMm3'], volume)
                        assert volume < 1e-6, ('headed shaft insertion obstructed', step, target, volume)
                    insertion['shaftSteps'] += 1
                pin_controls = []
                for identity in data['ids']['crossPins']:
                    for step in range(41 if run_insertion else 0):
                        moving = records[identity].copy()
                        moving.translate(App.Vector(20 - step * .5, 0, 0))
                        for target in ['frame', 'output-shaft', *data['ids']['forks'], 'output-upper-bearing', 'output-lower-bearing']:
                            volume = overlap(moving, records[target])
                            insertion['maximumOverlapMm3'] = max(insertion['maximumOverlapMm3'], volume)
                            assert volume < 1e-6, ('transverse pin insertion obstructed', identity, step, target, volume)
                        insertion['crossPinSteps'] += 1
                    wrong = records[identity].copy()
                    wrong.translate(App.Vector(0, 0, .5))
                    control = overlap(wrong, records['output-shaft'])
                    assert control > .1, ('misaligned pin does not hit shaft material', identity, control)
                    pin_controls.append({'id': identity, 'misalignedShaftOverlapMm3': control})
                report['crossPinControls'] = pin_controls
                # Standard E-clips snap elastically into the groove. The nominal
                # installed profile may meet shaft material during that snap;
                # reject surrounding hardware obstructions, not elastic contact.
                clip_paths = []
                for identity, shaft_id in [('gear-clip', 'screw'), ('screw-rear-clip', 'screw'), ('output-clip', 'output-shaft')]:
                    item = next(p for p in row['occurrences'] if p['id'] == identity)
                    rx, ry, rz = item['placement']['rotation']
                    rotation = App.Rotation(App.Vector(0, 0, 1), rz).multiply(App.Rotation(App.Vector(0, 1, 0), ry)).multiply(App.Rotation(App.Vector(1, 0, 0), rx))
                    opening = rotation.multVec(App.Vector(0, 1, 0))
                    shaft_peak = 0.0
                    for step in range(25 if run_insertion else 0):
                        moving = records[identity].copy()
                        moving.translate(opening * (-12 + step * .5))
                        shaft_peak = max(shaft_peak, overlap(moving, records[shaft_id]))
                        for target in [key for key in records if key not in [identity, shaft_id]]:
                            volume = overlap(moving, records[target])
                            assert volume < 1e-6, ('E-clip radial access obstructed by hardware', identity, step, target, volume)
                        insertion['eClipRadialSteps'] += 1
                    clip_paths.append({'id': identity, 'nominalProfileSnapShaftOverlapMm3': shaft_peak,
                                       'elasticSnapNotSimulated': True})
                report['eClipRadialAccess'] = clip_paths
                report['insertionPaths'] = insertion
                doc = App.newDocument('TR8GearedRocker')
                doc.addObject('App::FeaturePython', 'Mechanism').addProperty('App::PropertyAngle', 'OutputAngle', 'Configuration')
                doc.Mechanism.OutputAngle = 0
                doc.Mechanism.addProperty('App::PropertyString', 'PartId', 'Configuration')
                doc.Mechanism.PartId = data['partId']
                doc.Mechanism.addProperty('App::PropertyString', 'GeometryMode', 'Configuration')
                doc.Mechanism.GeometryMode = 'full'
                doc.Mechanism.addProperty('App::PropertyString', 'Motor', 'Configuration')
                doc.Mechanism.Motor = row['execution']
                exported = []
                for item in row['occurrences']:
                    identity = item['id']
                    obj = doc.addObject('Part::Feature', identity.replace('-', '_'))
                    obj.Shape = records[identity]
                    child_index = next(index for index, metadata in enumerate(scope['component_metadata'])
                                       if metadata['AssemblyOccurrenceId'] == identity)
                    obj.Label = item['name']
                    metadata = scope['component_metadata'][child_index]
                    for key in ['LibraryId', 'ConfigurationJSON', 'Supply', 'AssemblyOccurrenceId', 'ESKDIdentityJSON', 'ThreadFeaturesJSON']:
                        if key in metadata:
                            obj.addProperty('App::PropertyString', key, 'ProtoLab')
                            setattr(obj, key, metadata[key])
                    exported.append(obj)
                doc.recompute()
                stem = next(e['stem'] for e in data['executions'] if e['id'] == row['execution'])
                fcstd, step = out / (stem + '.FCStd'), out / (stem + '.step')
                doc.saveAs(str(fcstd))
                Part.export(exported, str(step))
                imported = Part.read(str(step))
                source = Part.makeCompound(list(records.values()))
                assert valid(imported), 'STEP export is not a valid closed assembly'
                volume_error = abs(imported.Volume - source.Volume)
                assert volume_error < max(1e-4, source.Volume * 1e-6), ('STEP changed assembly volume', imported.Volume, source.Volume)
                imported_bounds, source_bounds = imported.optimalBoundingBox(False, False), source.optimalBoundingBox(False, False)
                for axis in 'XYZ':
                    for end in ['Min', 'Max']:
                        assert abs(getattr(imported_bounds, axis + end) - getattr(source_bounds, axis + end)) < 1e-5
                report.setdefault('exports', {})[row['execution']] = {'fcstd': str(fcstd), 'step': str(step), 'occurrences': len(exported), 'stepRoundtripValid': True, 'stepRoundtripVolumeRelativeError': volume_error/source.Volume}
                App.closeDocument(doc.Name)
        details['completed'] = True
        save('completed ' + row['execution'] + ' ' + row['mode'] + ' ' + str(row['angle']))
    assert not any(row['collisions'] for row in report['poses']), ('assembly intersections', report['poses'])
    assert len(report['poses']) == len(data['poses']) and all(p.get('completed') for p in report['poses']), 'Incomplete native motion proof.'
    for row in data.get('macros', []):
        doc = App.newDocument('GearedRockerVerification')
        sentinel = doc.addObject('Part::Feature', 'Sentinel')
        sentinel.Shape = Part.makeBox(1, 1, 1)
        before = set(o.Name for o in doc.Objects)
        execute(Path(row['path']).read_text())
        objects = [o for o in doc.Objects if o.Name not in before and hasattr(o, 'AssemblyOccurrenceId')]
        assert objects and all(valid(o.Shape) for o in objects), ('public macro invalid children', row['path'])
        expected_children = next(p['nativeChildren'] for p in report['poses'] if p['execution'] == row['execution'] and p['mode'] == row['mode'])
        assert len(objects) == expected_children, ('public macro valid child count', len(objects))
        identities = {o.AssemblyOccurrenceId for o in objects}
        expected_identities = {p['id'] for p in data['poses'][0]['occurrences']}
        assert identities == expected_identities, ('public macro physical occurrences', identities, expected_identities)
        bearings = {o.AssemblyOccurrenceId for o in objects if getattr(o, 'LibraryId', '') == 'flanged-ball-bearing'}
        motors = {o.AssemblyOccurrenceId for o in objects if getattr(o, 'LibraryId', '') in ['surpass-2845', 'surpass-2838']}
        assert len(bearings) == 4 and len(motors) == 1
        for obj in objects:
            if obj.AssemblyOccurrenceId not in ['screw', 'nut']:
                continue
            features = json.loads(obj.ThreadFeaturesJSON)
            assert len(features) == 1
            assert (features[0]['pitch'], features[0]['lead'], features[0]['starts']) == (2, 4, 2)
        assert abs(sentinel.Shape.Volume - 1) < 1e-9
        report['publicMacros'].append({'execution': row['execution'], 'path': row['path'], 'validChildren': len(objects), 'occurrences': len(identities), 'bearingOccurrences': len(bearings), 'motorOccurrences': len(motors), 'sentinelPreserved': True})
        App.closeDocument(doc.Name)
        save('public macro ' + row['execution'] + ' ' + row['mode'])
    report['passed'] = True
    save('passed')
except BaseException as error:
    report['error'] = str(error)
    save('FAILED')
    raise
