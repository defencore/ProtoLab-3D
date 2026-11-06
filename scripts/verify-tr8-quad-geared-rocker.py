"""Native geometry proof for the independent four-output geared rocker.

Capture the current TypeScript model first. Exact-source prototype caching and
unchanged global pair caching keep the representative motion proof practical.
Insertion checks use critical stations, not a dense simulation of every part.
"""
import hashlib
import itertools
import json
import math
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'test-results/tr8-quad-geared-rocker')
capture = out / 'capture.json'
data = json.loads(capture.read_text())
assert data['schemaVersion'] == 6, 'Capture the welded through-slot end discs and slim fork.'
started = time.monotonic()
paths_only = '--paths-only' in sys.argv[2:]
probe_only = paths_only or '--early-only' in sys.argv[2:] or '--limits-only' in sys.argv[2:]
report_path = out / ('paths-native-report.json' if paths_only else 'early-native-report.json' if probe_only else 'native-report.json')
sources = dict(data['sources'], **data['dependencySources'], **data['preserved'])
for file, expected in sources.items():
    assert hashlib.sha256(Path(file).read_bytes()).hexdigest() == expected, ('Source changed after capture', file)
report = {'passed': False, 'captureSha256': hashlib.sha256(capture.read_bytes()).hexdigest(),
          'verifierSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'sources': sources, 'poses': [], 'publicMacros': [], 'exports': {}, 'paths': {}}
prototype_cache = {}
pair_cache = {}
support_cache = {}
roles = data['roleIds']
fixed = data['layout']
epsilon = 1e-4


def matrix(elements):
    return App.Matrix(*[elements[column * 4 + row] for row in range(4) for column in range(4)])


channel_frames = [matrix(elements) for elements in data['channelTransforms']]
panel_frames = [matrix(elements) for elements in data['panelTransforms']]
drive_frames = [frame.multiply(matrix(source)) for frame, source in zip(channel_frames, data['sourceTransforms'])]
directions = [frame.multVec(App.Vector(1, 0, 0)) - frame.multVec(App.Vector()) for frame in channel_frames]


def save(stage):
    report['elapsedSeconds'] = time.monotonic() - started
    report['cachedPrototypeSources'] = len(prototype_cache)
    report['cachedCollisionPairs'] = len(pair_cache)
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(stage, flush=True)


def execute(source, reuse=True):
    scope = {'App': App, 'Part': Part, 'math': math}
    if reuse:
        scope['_quad_rocker_cache'] = prototype_cache
    exec(source, scope)
    return scope


def valid(shape):
    return not shape.isNull() and shape.isValid() and shape.isClosed() and bool(shape.Solids) and shape.Volume > 0


def overlap(first, second):
    a, b = first.BoundBox, second.BoundBox
    if any(min(getattr(a, key + 'Max'), getattr(b, key + 'Max')) -
           max(getattr(a, key + 'Min'), getattr(b, key + 'Min')) < 1e-8 for key in 'XYZ'):
        return 0.0
    return abs(first.common(second).Volume)


def group(scope, row):
    assert len(scope['components']) == len(scope['component_metadata']) == len(scope['component_labels'])
    groups, children, metadata = {}, {}, {}
    for shape, record, label in zip(scope['components'], scope['component_metadata'], scope['component_labels']):
        assert valid(shape), ('Invalid native child', record['AssemblyOccurrenceId'], label)
        identity = record['AssemblyOccurrenceId']
        groups.setdefault(identity, []).append(shape)
        children.setdefault(identity, []).append((shape, label))
        metadata.setdefault(identity, record)
    records = {key: shapes[0] if len(shapes) == 1 else Part.makeCompound(shapes) for key, shapes in groups.items()}
    assert set(records) == {item['id'] for item in row['occurrences']}
    for item in row['occurrences']:
        if item['requireSingleSolid']:
            assert len(records[item['id']].Solids) == 1, ('Disconnected manufactured detail', item['id'])
    return records, children, metadata


def identity(letter, role):
    return letter + '-' + roles[role]


def canonical(shape, channel, drive=False):
    result = shape.copy()
    result.transformShape((drive_frames if drive else channel_frames)[channel].inverse())
    return result


def prove_axes(records):
    result = []
    for channel, letter in enumerate('abcd'):
        shaft = records[identity(letter, 'shaft')]
        cylinders = [face.Surface for face in shaft.Faces
                     if type(face.Surface).__name__ == 'Cylinder' and abs(face.Surface.Radius - 3) < 1e-7]
        assert cylinders, ('No physical Ø6 journal', letter)
        expected = directions[channel]
        for surface in cylinders:
            axis, point = surface.Axis, surface.Center
            assert abs(abs(axis.dot(expected)) - 1) < 1e-8
            assert point.cross(expected).Length < 1e-7, ('Output axis misses common center', letter, point)
        bounds = canonical(shaft, channel).optimalBoundingBox(False, False)
        assert abs(bounds.XMin - fixed['shaftTip']) < 1e-7
        assert bounds.XMin > 0
        result.append({'channel': letter, 'minimumRadius': bounds.XMin,
                       'axis': [expected.x, expected.y, expected.z]})
    distances = []
    for first, second in itertools.combinations('abcd', 2):
        gap = records[identity(first, 'shaft')].distToShape(records[identity(second, 'shaft')])[0]
        assert gap > 1e-3, ('Concurrent axes require separated finite shafts', first, second, gap)
        distances.append({'first': first, 'second': second, 'gap': gap})
    return {'shafts': result, 'finiteShaftGaps': distances}


def prove_center_contacts(records, children):
    result = []
    for channel, letter in enumerate('abcd'):
        clip = records[identity(letter, 'centerClip')]
        bearing_id = identity(letter, 'innerBearing')
        bearing = records[bearing_id]
        assert overlap(clip, bearing) < 1e-6
        assert clip.distToShape(bearing)[0] < 1e-7
        probe = clip.copy()
        probe.translate(directions[channel] * epsilon)
        contact = {'channel': letter, 'innerArea': 0, 'outerArea': 0, 'shieldArea': 0}
        for child, label in children[bearing_id]:
            area = overlap(probe, child) / epsilon
            if 'Inner ring' in label:
                contact['innerArea'] += area
            elif 'Outer ring' in label:
                contact['outerArea'] += area
                contact['outerGap'] = clip.distToShape(child)[0]
            elif 'shield' in label.lower():
                contact['shieldArea'] += area
                contact['shieldGap'] = min(contact.get('shieldGap', 100), clip.distToShape(child)[0])
        assert contact['innerArea'] > 2
        assert contact['outerArea'] < 1e-5 and contact['shieldArea'] < 1e-5
        assert contact['outerGap'] > .25 and contact['shieldGap'] > .04
        result.append(contact)
    return result


def prove_bearing_seats(records, metadata, row, children=None):
    housing = Part.makeCompound([records[identity(letter, 'case')] for letter in 'abcd'] + [records[roles['cross']]])
    items = {item['id']: item for item in row['occurrences']}
    result = []
    for key, item in items.items():
        if item['libraryId'] not in ['ball-bearing', 'flanged-ball-bearing']:
            continue
        parameters = json.loads(metadata[key]['ConfigurationJSON'])
        radius = parameters['outer'] / 2
        axis = placement_rotation(item).multVec(App.Vector(0, 0, 1))
        center = App.Vector(*item['placement']['translation'])
        allowance = .015 if item['libraryId'] == 'flanged-ball-bearing' else .005
        origin = center - axis * .5
        probe = Part.makeCylinder(radius + allowance + .01, 1, origin, axis).cut(Part.makeCylinder(radius + allowance, 1, origin, axis))
        ratio = overlap(probe, housing) / probe.Volume
        assert ratio > .99, ('Bearing outer race lacks a continuous housing seat', key, ratio)
        body_length = parameters['width'] - parameters.get('flangeWidth', 0)
        body_origin = center - axis * (parameters['width'] / 2)
        body_probe = Part.makeCylinder(radius + allowance + .01, body_length, body_origin, axis).cut(Part.makeCylinder(radius + allowance, body_length, body_origin, axis))
        support_length = overlap(body_probe, housing) / (body_probe.Volume / body_length)
        minimum = body_length if 'flangeWidth' in parameters else min(body_length, fixed['innerBearingR'] + parameters['width'] / 2 - fixed['coreWindowRadius'])
        assert support_length >= minimum - .001, ('Bearing seat supports too little of the outer body', key, support_length, minimum)
        detail = {'occurrence': key, 'outerSeatSupportRatio': ratio, 'outerBodySupportLengthMm': support_length, 'minimumSupportLengthMm': minimum}
        if 'flangeWidth' not in parameters:
            origin = center + axis * (parameters['width'] / 2 - minimum)
            band = Part.makeCylinder(radius + allowance + .01, minimum, origin, axis).cut(Part.makeCylinder(radius + allowance, minimum, origin, axis))
            assert overlap(band, housing) / band.Volume > .99
            detail['fullCircumferenceBandOutsideAccessWindowMm'] = minimum
        if children is not None:
            contact = {'outerRing': 0, 'innerRing': 0, 'shield': 0}
            for child, label in children[key]:
                if 'outer ring' in label.lower():
                    kind = 'outerRing'
                elif 'inner ring' in label.lower():
                    kind = 'innerRing'
                elif 'shield' in label.lower():
                    kind = 'shield'
                else:
                    continue
                moved = child.copy()
                moved.translate(axis * -epsilon)
                contact[kind] += overlap(moved, housing) / epsilon
            assert contact['outerRing'] > (15 if 'flangeWidth' in parameters else 1), ('No positive outer-race locating shoulder', key, contact)
            assert contact['innerRing'] < 1e-5 and contact['shield'] < 1e-5, ('Housing shoulder rubs a rotating bearing part', key, contact)
            detail['axialShoulderContactAreasMm2'] = contact
        result.append(detail)
    assert len(result) == 16
    return result


def prove_shared_panels(records, metadata):
    ids = [identity(letter, 'case') for letter in 'abcd']
    configurations = {}
    for index, key in enumerate(ids):
        configuration = json.loads(metadata[key]['ESKDIdentityJSON'])['configurationKey']
        configurations.setdefault(configuration, []).append(index)
    assert len(configurations) == 2 and sorted(map(len, configurations.values())) == [2, 2]
    assert sorted(sorted(group) for group in configurations.values()) == [[0, 2], [1, 3]], 'The two opposite-bend definitions must pair A/C and B/D.'
    difference = 0
    for group in configurations.values():
        reference = records[ids[group[0]]].copy()
        reference.transformShape(panel_frames[group[0]].inverse())
        for index in group:
            local = records[ids[index]].copy()
            local.transformShape(panel_frames[index].inverse())
            difference = max(difference, abs(reference.cut(local).Volume) + abs(local.cut(reference).Volume))
            assert len(local.Solids) == 1
    assert difference < 1e-6, ('Properly placed panels are not the same physical body', difference)
    assert len(records[roles['cross']].Solids) == 1
    discs = ['upper-' + roles['endDisc'], 'lower-' + roles['endDisc']]
    assert len({json.loads(metadata[key]['ESKDIdentityJSON'])['configurationKey'] for key in discs}) == 1
    return {'formedConfigurations': 2, 'quantityPerConfiguration': 2, 'panelQuantity': 4, 'properPlacementMaterialDifference': difference, 'centralBearingConnectors': 1, 'identicalEndDiscs': 2}


def prove_case_clamps(records, row):
    housing = Part.makeCompound([records[identity(letter, 'case')] for letter in 'abcd'])
    items = {item['id']: item for item in row['occurrences']}
    lower = Part.makePlane(200, 200, App.Vector(-100, -100, -100))
    upper = Part.makePlane(200, 200, App.Vector(-100, -100, 100))
    result = []
    for bolt_id in [key for key in records if key.startswith(roles['caseBolt'] + '-')]:
        nut_id = bolt_id.replace(roles['caseBolt'] + '-', roles['caseNut'] + '-')
        bolt, nut = records[bolt_id], records[nut_id]
        tip = bolt.distToShape(lower)[0] - 100
        head_top = 100 - bolt.distToShape(upper)[0]
        nut_bottom = nut.distToShape(lower)[0] - 100
        nut_top = 100 - nut.distToShape(upper)[0]
        assert abs(head_top - 1.65 - fixed['tabThickness']) < 1e-7, ('Clamp head does not seat on its upper sheet', bolt_id, head_top)
        assert abs(nut_top + fixed['tabThickness']) < 1e-7, ('Clamp nut does not seat on its lower sheet', nut_id, nut_top)
        extension = nut_bottom - tip
        assert .5 - 1e-7 <= extension <= 2 + 1e-7, ('Clamp bolt thread engagement or projection is wrong', bolt_id, extension)
        head_probe, nut_probe = bolt.copy(), nut.copy()
        head_probe.translate(App.Vector(0, 0, -epsilon))
        nut_probe.translate(App.Vector(0, 0, epsilon))
        head_area = overlap(head_probe, housing) / epsilon
        nut_area = overlap(nut_probe, housing) / epsilon
        assert head_area > 10 and nut_area > 10, ('Clamp lacks positive head or nut support', bolt_id, head_area, nut_area)
        center = App.Vector(*items[bolt_id]['placement']['translation'])
        hole_radii = [face.Surface.Radius for face in housing.Faces
                      if type(face.Surface).__name__ == 'Cylinder'
                      and abs(abs(face.Surface.Axis.z) - 1) < 1e-7
                      and math.hypot(face.Surface.Center.x - center.x, face.Surface.Center.y - center.y) < 1e-6
                      and 1.5 < face.Surface.Radius < 2.5]
        assert hole_radii, ('No actual clearance-hole surface at clamp station', bolt_id)
        clearance = max(hole_radii)
        footprints = []
        for moving, z in [(head_probe, fixed['tabThickness'] - epsilon), (nut_probe, -fixed['tabThickness'])]:
            reference = Part.makeBox(20, 20, epsilon, App.Vector(center.x - 10, center.y - 10, z)).cut(Part.makeCylinder(clearance, 3 * epsilon, App.Vector(center.x, center.y, z - epsilon)))
            footprints.append(overlap(moving, reference) / epsilon)
        assert head_area >= footprints[0] * .99 and nut_area >= footprints[1] * .99, ('Clamp seat is cropped by a sheet edge or bend', bolt_id, head_area, nut_area, footprints)
        result.append({'bolt': bolt_id, 'actualGripMm': 2 * fixed['tabThickness'],
                       'actualTipZ': tip, 'projectionBeyondNutMm': extension,
                       'headSupportAreaMm2': head_area, 'nutSupportAreaMm2': nut_area,
                       'headSupportFootprintRatio': head_area / footprints[0],
                       'nutSupportFootprintRatio': nut_area / footprints[1]})
    assert len(result) == 4
    return result


def prove_sheet_panels(records):
    sheet = data['sheetPanel']
    positive, negative = data['flatPatterns']
    assert positive['loops'] == negative['loops'] and positive['circles'] == negative['circles'], 'Opposite folds must use one common laser-cut blank.'
    assert positive['thickness'] == negative['thickness'] == 3
    assert len(positive['bends']) == len(negative['bends']) == 2
    assert all(b['angle'] == 90 and b['innerRadius'] == sheet['innerRadius'] for p in [positive, negative] for b in p['bends'])
    assert all(b['direction'] == 'up' for b in positive['bends']) and all(b['direction'] == 'down' for b in negative['bends'])
    result = []
    for index, letter in enumerate('abcd'):
        panel = records[identity(letter, 'case')].copy()
        panel.transformShape(panel_frames[index].inverse())
        radii = [face.Surface.Radius for face in panel.Faces if type(face.Surface).__name__ == 'Cylinder']
        for radius in [sheet['innerRadius'], sheet['outerRadius']]:
            assert sum(abs(r - radius) < 1e-7 for r in radii) >= 2, ('True-radius sheet bend missing', letter, radius)
        probes = []
        for sign in [-1, 1]:
            for n, t, z in [(20 - 3 / math.sqrt(2), sign * 23.9, 4.5 - 3 / math.sqrt(2)), (23.5, sign * 25.5, 1.5)]:
                n = n if index % 2 == 0 else 34 - n
                probe = Part.makeBox(.1, .1, .1, App.Vector(n - .05, t - .05, z - .05))
                ratio = overlap(probe, panel) / probe.Volume
                assert ratio > .99, ('Formed bend or flange lost its sheet stock', letter, n, t, z, ratio)
                probes.append(ratio)
        wall = Part.makeBox(2.9, .1, .1, App.Vector(15.55, -.05, fixed['lever'] + 9.95))
        assert overlap(wall, panel) / wall.Volume > .99
        for n in [15.4, 18.6]:
            outside = Part.makeBox(.1, .1, .1, App.Vector(n - .05, -.05, fixed['lever'] + 9.95))
            assert overlap(outside, panel) < 1e-7, ('Wall stock exceeds the declared3mm sheet', letter, n)
        plain_seats = []
        for t, z in [(0, 0), (-fixed['channelRadius'], fixed['lever']), (fixed['channelRadius'], fixed['lever'])]:
            origin = App.Vector(15.6, t, z)
            probe = Part.makeCylinder(5.5, 2.8, origin, App.Vector(1, 0, 0)).cut(Part.makeCylinder(5.05, 2.8, origin, App.Vector(1, 0, 0)))
            ratio = overlap(probe, panel) / probe.Volume
            assert ratio > .99, ('Bearing seat still has a flange recess', letter, t, z, ratio)
            plain_seats.append(ratio)
        back_faces = []
        for t in [fixed['channelRadius'] - 8, fixed['channelRadius'] + 8]:
            origin = App.Vector(15.6 if index % 2 == 0 else 18.1, t, fixed['lever'] + fixed['motorSpacing'])
            probe = Part.makeCylinder(2.8, .3, origin, App.Vector(1, 0, 0)).cut(Part.makeCylinder(2, .3, origin, App.Vector(1, 0, 0)))
            ratio = overlap(probe, panel) / probe.Volume
            assert ratio > .99, ('Unused reverse motor countersink was not removed', letter, t, ratio)
            back_faces.append(ratio)
        foot = [face.Surface.Radius for face in panel.Faces if type(face.Surface).__name__ == 'Cylinder' and abs(abs(face.Surface.Axis.x) - 1) < 1e-7 and abs(face.Surface.Center.y) < 1e-7 and abs(face.Surface.Center.z) < 1e-7 and abs(face.Surface.Radius - sheet['bearingFootRadius']) < 1e-7]
        assert foot, ('Missing actual circular bearing foot', letter)
        land = min(foot) - 5.01
        assert land >= 3
        result.append({'panel': letter, 'fold': 1 if index % 2 == 0 else -1, 'bendAndFlangeStockRatios': probes, 'wallThicknessMm': 3, 'plainBearingSeatWallRatios': plain_seats, 'unusedMotorBackFaceStockRatios': back_faces, 'actualCenterFreeEdgeLandMm': land})
    cylinder = Part.makeCylinder(100, 200, App.Vector(0, 0, -100))
    side = next(face for face in cylinder.Faces if type(face.Surface).__name__ == 'Cylinder')
    housing = Part.makeCompound([records[identity(letter, 'case')] for letter in 'abcd'])
    diameter = 2 * (100 - housing.distToShape(side)[0])
    assert diameter < 75, ('Sheet housing exceeds the accepted75mm class', diameter)
    reference_file = Path('test-results/tr8-quad-geared-rocker-eye-arm-through/capture.json')
    reference = json.loads(reference_file.read_text())['poses'][0]
    current = data['poses'][0]
    for row in [reference, current]:
        assert any(item['id'] == roles['cross'] for item in row['occurrences'])
    old_key = next(item['geometryKey'] for item in reference['occurrences'] if item['id'] == roles['cross'])
    new_key = next(item['geometryKey'] for item in current['occurrences'] if item['id'] == roles['cross'])
    assert old_key == new_key, 'The approved central bearing connector changed.'
    def body_source(row):
        for block in re.split(r'(?=^scope = _quad_rocker_source\()', row['source'], flags=re.M)[1:]:
            if f'"AssemblyOccurrenceId":"{roles["cross"]}"' in block:
                return block.split('\n', 1)[0]
        raise AssertionError('Missing central bearing connector source')
    assert body_source(reference) == body_source(current), 'Central connector native geometry is not byte-identical.'
    return {'commonFlatBlank': True, 'formedPairs': result, 'actualPanelCylinderDiameterMm': diameter,
            'centralConnectorUnchanged': True, 'centralConnectorReference': str(reference_file)}


def prove_bare_panel_closure(records):
    panels = [records[identity(letter, 'case')] for letter in 'abcd']
    offsets = [70, 40, 20, 12, 10, 8, 7.6, 7.5, 7.3, 6, 5, 4, 3, 2, 1, .5, .2, .1, .05, .01, 0]
    for offset in offsets:
        moved = []
        for frame, panel in zip(panel_frames, panels):
            direction = frame.multVec(App.Vector(0, 0, 1)) - frame.multVec(App.Vector())
            copy = panel.copy()
            copy.translate(direction * offset)
            moved.append(copy)
        for first, second in itertools.combinations(range(4), 2):
            assert overlap(moved[first], moved[second]) < 1e-6, ('Opposite-fold panels cannot close', offset, first, second)
    return {'stations': len(offsets), 'pairChecks': 6 * len(offsets), 'barePanels': True}


def prove_pin_engagement(records, row):
    result = []
    for channel, letter in enumerate('abcd'):
        fork = canonical(records[identity(letter, 'fork')], channel)
        shaft = canonical(records[identity(letter, 'shaft')], channel)
        for shape in [fork, shaft]:
            shape.rotate(App.Vector(), App.Vector(1, 0, 0), -row['angles'][channel])
        material = []
        for station in [fixed['forkHubR'] - 1.5, fixed['forkHubR'] + 1.5]:
            probe = Part.makeBox(.2, .2, .2, App.Vector(station - .1, -.1, 4.4))
            ratio = overlap(probe, fork) / probe.Volume
            assert ratio > .99, ('Native fork lost its upper hub material', letter, station, ratio)
            material.append(ratio)
        straight_arm = []
        for station in [fixed['forkHubR'] - 2.8, fixed['forkHubR'] + 2.8]:
            for reach in [6, 8, 9]:
                probe = Part.makeBox(.2, .2, .2, App.Vector(station - .1, -.1, -reach - .1))
                ratio = overlap(probe, fork) / probe.Volume
                assert ratio > .99, ('Straight eye arm has missing full-thickness stock', letter, station, reach, ratio)
                straight_arm.append(ratio)
        guide = Part.makeCylinder(.95, 19.3, App.Vector(fixed['forkHubR'], 0, -13.25))
        assert overlap(guide, fork) < 1e-6, ('Eye-to-web guide bore is blind', letter)
        guide_wall = []
        for start in [-13.1, 5.1]:
            origin = App.Vector(fixed['forkHubR'], 0, start)
            probe = Part.makeCylinder(1.02, .2, origin).cut(Part.makeCylinder(1.01, .2, origin))
            ratio = overlap(probe, fork) / probe.Volume
            assert ratio > .99, ('Guide bore lacks material at an exit', letter, start, ratio)
            guide_wall.append(ratio)
        support = []
        for host, starts in [(fork, [-4.5, 3.5]), (shaft, [-2.5, 1.5])]:
            for start in starts:
                origin = App.Vector(fixed['forkHubR'], 0, start)
                probe = Part.makeCylinder(1.02, 1, origin).cut(Part.makeCylinder(1.01, 1, origin))
                ratio = overlap(probe, host) / probe.Volume
                assert ratio > .99, ('Cross-pin has no surrounding host material', letter, start, ratio)
                support.append(ratio)
        result.append({'channel': letter, 'hubMaterialRatios': material, 'fullThicknessStraightArmMaterialRatios': straight_arm, 'throughEyeToWebBore': True, 'guideExitWallMaterialRatios': guide_wall, 'forkAndShaftPinSupportRatios': support})
    return result


def prove_follower_retention(records, row):
    result = []
    for channel, letter in enumerate('abcd'):
        fork = canonical(records[identity(letter, 'fork')], channel)
        nut = canonical(records[identity(letter, 'nut')], channel)
        for shape in [fork, nut]:
            shape.rotate(App.Vector(), App.Vector(1, 0, 0), -row['angles'][channel])
        # Read the actual analytic follower surfaces, independent of the layout equation.
        groups = {}
        for face in nut.Faces:
            surface = face.Surface
            if type(surface).__name__ != 'Cylinder' or abs(surface.Radius - 2) > 1e-7 or abs(abs(surface.Axis.x) - 1) > 1e-7:
                continue
            side = -1 if face.CenterOfMass.x < fixed['channelRadius'] else 1
            bounds = face.optimalBoundingBox(False, False)
            previous = groups.get(side)
            groups[side] = {'lo': min(bounds.XMin, previous['lo']) if previous else bounds.XMin,
                            'hi': max(bounds.XMax, previous['hi']) if previous else bounds.XMax,
                            'y': surface.Center.y, 'z': surface.Center.z}
        assert set(groups) == {-1, 1}, ('Two physical follower pins required', letter, groups)
        fork_bounds = fork.optimalBoundingBox(False, False)
        pins = []
        for side, pin in sorted(groups.items()):
            assert abs(pin['y']) < 1e-7, ('Follower axis not centered in fork slot', letter, pin)
            radius = -pin['z']
            reserve = -fork_bounds.ZMin - radius - 2
            assert reserve >= 2, ('Follower can approach the open mouth', letter, reserve)
            support = []
            for rail in [-1, 1]:
                # A 4 mm-long band covers the full pin diameter, over its real axial span.
                y = rail * 2.1
                probe = Part.makeBox(pin['hi'] - pin['lo'], .1, 4,
                                     App.Vector(pin['lo'], y - .05, pin['z'] - 2))
                supported_length = overlap(probe, fork) / (.1 * 4)
                assert supported_length >= fixed['forkThickness'] - 1e-5, ('Follower rail misses part of its diameter', letter, side, rail, supported_length)
                support.append(supported_length)
            closed_point = Part.Vertex(App.Vector((pin['lo'] + pin['hi']) / 2, pin['y'], pin['z'] + 2))
            closed_gap = closed_point.distToShape(fork)[0]
            assert closed_gap > .04
            if abs(row['angles'][channel]) < 1e-8:
                assert closed_gap <= .3, ('Neutral follower is too far from its closed end', letter, side, closed_gap)
            pins.append({'side': side, 'actualPinRadiusFromPivot': radius,
                         'fullDiameterRailSupportLengths': support, 'closedEndGap': closed_gap,
                         'openMouthReserveBeyondPin': reserve})
        result.append({'channel': letter, 'pins': pins})
    return result


def prove_plain_source_interfaces(records, children, row):
    result = []
    items = {item['id']: item for item in row['occurrences']}
    for channel, letter in enumerate('abcd'):
        screw = canonical(records[identity(letter, 'screw')], channel, drive=True)
        supports, contacts = [], []
        for suffix, center in [('screw-front-bearing', -2.1), ('screw-rear-bearing', 33.1)]:
            origin = App.Vector(center - 1.5, 0, 0)
            journal = Part.makeCylinder(3, 3, origin, App.Vector(1, 0, 0)).cut(Part.makeCylinder(2.99, 3, origin, App.Vector(1, 0, 0)))
            ratio = overlap(journal, screw) / journal.Volume
            assert ratio > .99, ('Shifted bearing lacks its full Ø6 journal', letter, suffix, ratio)
            supports.append(ratio)
            bearing_id = letter + '-' + suffix
            clip_id = letter + ('-gear-clip' if 'front' in suffix else '-screw-rear-clip')
            clip = records[clip_id]
            axis = placement_rotation(items[bearing_id]).multVec(App.Vector(0, 0, 1))
            moved = clip.copy()
            moved.translate(axis * -epsilon)
            contact = {'innerRing': 0, 'outerRing': 0, 'shield': 0}
            for child, label in children[bearing_id]:
                kind = 'innerRing' if 'inner ring' in label.lower() else 'outerRing' if 'outer ring' in label.lower() else 'shield' if 'shield' in label.lower() else None
                if kind:
                    contact[kind] += overlap(moved, child) / epsilon
            assert clip.distToShape(records[bearing_id])[0] < 1e-7
            assert contact['innerRing'] > 10 and contact['outerRing'] < 1e-5 and contact['shield'] < 1e-5, ('Shifted clip contacts the wrong bearing part', clip_id, contact)
            contacts.append(contact)
        gap = records[letter + '-driven-gear'].distToShape(records[letter + '-gear-clip'])[0]
        assert abs(gap - .2) < 1e-6, ('Gear does not clear shifted front clip', letter, gap)
        result.append({'channel': letter, 'fullJournalSupportRatios': supports, 'clipContactAreasMm2': contacts, 'gearClipGapMm': gap})
    return result


def prove_end_cap_mates(records, metadata, row):
    items = {item['id']: item for item in row['occurrences']}
    result = []
    for label, members, axis in [('upper-', 'ac', App.Vector(0, 0, 1)), ('lower-', 'bd', App.Vector(0, 0, -1))]:
        disc_id = label + roles['endDisc']
        item = items[disc_id]
        frame = App.Placement(App.Vector(*item['placement']['translation']), placement_rotation(item)).toMatrix()
        local = records[disc_id].copy()
        local.transformShape(frame.inverse())
        ports = []
        for x, y in [(25, 0), (-25, 0), (0, 25), (0, -25)]:
            bore = Part.makeCylinder(2.95, 3.2, App.Vector(x, y, -.1))
            assert overlap(bore, local) < 1e-7, ('Wire port is not through the end disc', disc_id, x, y)
            for z in [.01, 2.95]:
                chamfer = Part.makeCylinder(3.4, .04, App.Vector(x, y, z)).cut(Part.makeCylinder(3.3, .04, App.Vector(x, y, z)))
                assert overlap(chamfer, local) < 1e-7, ('Wire-port edge chamfer missing', disc_id, x, y, z)
            origin = App.Vector(x, y, 1.4)
            wall = Part.makeCylinder(3.4, .2, origin).cut(Part.makeCylinder(3.3, .2, origin))
            ratio = overlap(wall, local) / wall.Volume
            assert ratio > .99, ('Wire port lacks adjacent disc material', disc_id, x, y, ratio)
            ports.append({'center': [x, y], 'throughBore': True, 'bothFaceChamfers': True, 'wallSupportRatio': ratio})
        seated = records[disc_id].copy()
        seated.translate(axis * -epsilon)
        shoulders = Part.makeCompound([records[identity(letter, 'case')] for letter in members])
        area = overlap(seated, shoulders) / epsilon
        assert area > 5, ('End disc does not seat on its wall shoulders', disc_id, area)
        protrusions = []
        for letter in members:
            panel = records[identity(letter, 'case')].copy()
            panel.transformShape(frame.inverse())
            protrusion = panel.optimalBoundingBox(False, False).ZMax - fixed['endDiscThickness']
            assert abs(protrusion - .5) < 1e-6, ('Wall tongue does not protrude for welding', letter, protrusion)
            protrusions.append(protrusion)
        result.append({'disc': disc_id, 'wirePorts': ports, 'wallShoulderSeatArea': area, 'weldTongueProtrusions': protrusions})
    return result


def prove_stops(row, records, metadata):
    cases = Part.makeCompound([records[identity(letter, 'case')] for letter in 'abcd'])
    results = []
    for channel, letter in enumerate('abcd'):
        angle = row['angles'][channel]
        source_angle = row['driveAngles'][channel]
        world_nut = records[identity(letter, 'nut')]
        nut = canonical(world_nut, channel, drive=True)
        case = canonical(cases, channel, drive=True)
        center = fixed['screwCenter'] - fixed['lever'] * math.tan(math.radians(source_angle))
        half = fixed['nutLength'] / 2
        bounds = nut.optimalBoundingBox(False, False)
        assert abs(bounds.XMin - (center - half)) < 1e-6
        assert abs(bounds.XMax - (center + half)) < 1e-6
        outside = 0
        for low, high in [(-100, -1e-6), (31 + 1e-6, 100)]:
            tool = Part.makeBox(high - low, bounds.YLength + 2, bounds.ZLength + 2,
                                App.Vector(low, bounds.YMin - 1, bounds.ZMin - 1))
            outside += overlap(nut, tool)
        assert outside < 1e-7, ('Actual nut material exceeds wall planes', letter, angle, outside)
        callout = json.loads(metadata[identity(letter, 'nut')]['ThreadFeaturesJSON'])[0]
        active_length = fixed['nutLength'] - 2 * fixed['nutEndReliefDepth']
        assert abs(callout['length'] - active_length) < 1e-8
        inverse = drive_frames[channel].inverse()
        origin = inverse.multVec(App.Vector(*callout['origin']))
        axis = inverse.multVec(App.Vector(*callout['axis'])) - inverse.multVec(App.Vector())
        assert (origin - App.Vector(center - active_length / 2, 0, 0)).Length < 1e-7
        assert (axis - App.Vector(1, 0, 0)).Length < 1e-8
        screw_callout = json.loads(metadata[identity(letter, 'screw')]['ThreadFeaturesJSON'])[0]
        assert (screw_callout['pitch'], screw_callout['lead'], screw_callout['starts']) == (2, 4, 2)
        assert abs(screw_callout['length'] - 31) < 1e-8
        assert inverse.multVec(App.Vector(*screw_callout['origin'])).Length < 1e-7
        detail = {'channel': letter, 'angle': angle, 'sourceNutCenterX': center, 'materialOutsideWalls': outside}
        if abs(angle) == 20:
            sign = -1 if source_angle > 0 else 1
            probe = nut.copy()
            probe.translate(App.Vector(sign * epsilon, 0, 0))
            area = overlap(probe, case) / epsilon
            assert area > 10, ('Missing positive wall stop', letter, angle, area)
            beyond = nut.copy()
            beyond.translate(App.Vector(fixed['screwCenter'] - fixed['lever'] * math.tan(math.radians(source_angle + math.copysign(.1, source_angle))) - center, 0, 0))
            assert overlap(beyond, case) > .01, ('Overtravel misses wall', letter, angle)
            detail['stopArea'] = area
            bearing_gaps = []
            for suffix in ['screw-front-bearing', 'screw-rear-bearing']:
                candidate = letter + '-' + suffix
                assert candidate in records
                bearing_gaps.append(world_nut.distToShape(records[candidate])[0])
                assert overlap(beyond, canonical(records[candidate], channel, drive=True)) < 1e-6
            assert min(bearing_gaps) > .19
            detail['bearingGap'] = min(bearing_gaps)
        results.append(detail)
    return results


def placement_rotation(item):
    x, y, z = item['placement']['rotation']
    return App.Rotation(App.Vector(0, 0, 1), z).multiply(App.Rotation(App.Vector(0, 1, 0), y)).multiply(App.Rotation(App.Vector(1, 0, 0), x))


def prove_fork_access(records, row):
    housing = Part.makeCompound([records[identity(letter, 'case')] for letter in 'abcd'] +
                                [records[roles['cross']]] +
                                [records[label + roles['endDisc']] for label in ['upper-', 'lower-']] +
                                [shape for key, shape in records.items() if key.startswith(roles['caseBolt'] + '-') or key.startswith(roles['caseNut'] + '-')])
    items = {item['id']: item for item in row['occurrences']}
    output_roles = [roles[name] for name in ['case', 'fork', 'nut', 'shaft', 'innerBearing', 'outerBearing', 'forkPin', 'centerClip']]
    output_ids = [key for key in records if key == roles['cross'] or key.startswith(roles['caseBolt'] + '-') or key.startswith(roles['caseNut'] + '-') or any(key.endswith('-' + suffix) for suffix in output_roles) or '-output-head-bolt-' in key]
    result = {}
    for channel, letter in enumerate('ab'):
        local = {key: canonical(shape, channel) for key, shape in records.items()}
        wall = canonical(housing, channel)
        fork, nut = local[identity(letter, 'fork')], local[identity(letter, 'nut')]
        loading = [(40, -15), (20, -15), (10, -15), (0, -15), (0, -7), (0, -1), (0, 0)]
        for radial, vertical in loading:
            moving = fork.copy()
            moving.translate(App.Vector(radial, 0, vertical))
            assert overlap(moving, wall) < 1e-6, ('Redesigned fork cannot side-load into welded housing', letter, radial, vertical)
        for radial, vertical in loading:
            moving = nut.copy()
            moving.translate(App.Vector(radial, 0, vertical))
            for target in [wall, fork]:
                assert overlap(moving, target) < 1e-6, ('Follower pins cannot enter redesigned open slots', letter, radial, vertical)
        pin_id = identity(letter, 'forkPin')
        inverse = channel_frames[channel].inverse()
        world_axis = placement_rotation(items[pin_id]).multVec(App.Vector(0, 0, 1))
        axis = inverse.multVec(world_axis) - inverse.multVec(App.Vector())
        offsets = [12, 8, 6, 4, 2, 1, 0]
        for offset in offsets:
            moving = local[pin_id].copy()
            moving.translate(axis * offset)
            for key in output_ids:
                if key != pin_id:
                    assert overlap(moving, local[key]) < 1e-6, ('Redesigned fork blocks vertical hub-pin access', letter, offset, key)
            assert overlap(moving, wall) < 1e-6
        control = local[pin_id].copy()
        control.translate(App.Vector(0, .2, 0))
        assert overlap(control, local[identity(letter, 'shaft')]) + overlap(control, fork) > .01
        result[letter] = {'forkSideLoadingStations': len(loading), 'nutOpenMouthLoadingStations': len(loading),
                          'verticalPinEntryStations': len(offsets), 'misalignmentControl': True,
                          'weldedHousingPresent': True, 'motorsAndGearsInstalledAfterward': True}
    return result


def prove_paths(records, row):
    panels = [records[identity(letter, 'case')] for letter in 'abcd']
    walls = Part.makeCompound(panels)
    housing = Part.makeCompound(panels + [records[roles['cross']]] + [records[label + roles['endDisc']] for label in ['upper-', 'lower-']])
    items = {item['id']: item for item in row['occurrences']}
    paths = {}
    # Long upper walls enter from above; their inverted mates enter from below.
    offsets = [70, 40, 20, 12, 10, 8, 7.6, 7.5, 7.3, 6, 5, 4, 3, 2, 1, .5, .2, .1, .05, .01, 0]
    for offset in offsets:
        moved = []
        for frame, panel in zip(panel_frames, panels):
            direction = frame.multVec(App.Vector(0, 0, 1)) - frame.multVec(App.Vector())
            copy = panel.copy()
            copy.translate(direction * offset)
            moved.append(copy)
        for first, second in itertools.combinations(range(4), 2):
            volume = overlap(moved[first], moved[second])
            assert volume < 1e-6, ('Shared panels cannot interlock', offset, first, second, volume)
    paths['panelInterlocking'] = {'stations': len(offsets), 'pairChecks': len(offsets) * 6, 'opposingPairsEnterFromOppositeZSides': True}
    report['paths'] = paths
    save('critical panel-interlocking stations passed')
    # Clamp the empty shared frame before the internal drive hardware is installed.
    bolt_ids = [key for key in records if key.startswith(roles['caseBolt'] + '-')]
    assert len(bolt_ids) == 4
    for bolt_id in bolt_ids:
        bolt = records[bolt_id]
        nut_id = bolt_id.replace(roles['caseBolt'] + '-', roles['caseNut'] + '-')
        axis = placement_rotation(items[bolt_id]).multVec(App.Vector(0, 0, 1))
        bolt_offsets = [20, 14, 10, 6, 4, 2, 0]
        for offset in bolt_offsets:
            moving = bolt.copy()
            moving.translate(axis * offset)
            assert overlap(moving, walls) < 1e-6, ('Housing bolt entry blocked', bolt_id, offset)
        paths[bolt_id] = {'stations': len(bolt_offsets), 'nutInstalledAfterBolt': True}
        nut = records[nut_id]
        center = App.Vector(*items[nut_id]['placement']['translation'])
        nut_offsets = [-8, -4.1, -4, -3.9, -2.2, -1.6, -1, -.4, 0]
        for offset in nut_offsets:
            moving = nut.copy()
            moving.rotate(center, axis, 720 * offset)
            moving.translate(axis * offset)
            assert overlap(moving, bolt) < 1e-6, ('M3 nut helix phase mismatch', nut_id, offset)
            assert overlap(moving, walls) < 1e-6, ('Housing nut access blocked', nut_id, offset)
        paths[nut_id] = {'stations': len(nut_offsets), 'threadLead': .5, 'rotationDegreesPerMillimeter': 720}
    save('housing bolt and nut insertion passed')
    # Fit and weld the slotted end discs on the bare, clamped frame first.
    bare_targets = panels + [records[key] for key in records if key.startswith(roles['caseBolt'] + '-') or key.startswith(roles['caseNut'] + '-')]
    for label in ['upper-', 'lower-']:
        disc_id = label + roles['endDisc']
        axis = placement_rotation(items[disc_id]).multVec(App.Vector(0, 0, 1))
        offsets = [20, 10, 5, 3.6, 3.5, 3, 1, 0]
        for offset in offsets:
            moving = records[disc_id].copy()
            moving.translate(axis * offset)
            for target in bare_targets:
                assert overlap(moving, target) < 1e-6, ('End disc cannot enter its through wall slots', disc_id, offset)
        paths[disc_id] = {'stations': len(offsets), 'throughSlotInsertion': True, 'weldBeforeMechanisms': True}
    output_roles = [roles[name] for name in ['case', 'fork', 'nut', 'shaft', 'innerBearing', 'outerBearing', 'forkPin', 'centerClip']]
    output_ids = [key for key in records if key == roles['cross'] or key.startswith(roles['caseBolt'] + '-') or key.startswith(roles['caseNut'] + '-') or any(key.endswith('-' + suffix) for suffix in output_roles) or '-output-head-bolt-' in key]
    # A and B cover the two source-drive orientations; opposite channels repeat these routes.
    for channel, letter in enumerate('ab'):
        local = {key: canonical(shape, channel) for key, shape in records.items()}
        wall = canonical(housing, channel)
        fork_id, nut_id = identity(letter, 'fork'), identity(letter, 'nut')
        fork, nut = local[fork_id], local[nut_id]
        loading = [(40, -15), (20, -15), (10, -15), (0, -15), (0, -7), (0, -1), (0, 0)]
        for radial, vertical in loading:
            moving = fork.copy()
            moving.translate(App.Vector(radial, 0, vertical))
            assert overlap(moving, wall) < 1e-6, ('Fork side loading into welded frame blocked', letter, radial, vertical)
        paths[letter + '-forkLoading'] = {'stations': len(loading), 'sideEntryIntoWeldedHousing': True, 'sourceHardwareAbsent': True}
        for radial, vertical in loading:
            moving = nut.copy()
            moving.translate(App.Vector(radial, 0, vertical))
            for target in [wall, fork]:
                assert overlap(moving, target) < 1e-6, ('Nut side loading through open fork mouths blocked', letter, radial, vertical)
        paths[letter + '-nutLoading'] = {'stations': len(loading), 'sideEntryIntoWeldedHousing': True, 'integralPinsThroughOpenMouths': True}
        bearing_offsets = [24, 12, 8, 4, 1, 0]
        outer = local[identity(letter, 'outerBearing')]
        inner = local[identity(letter, 'innerBearing')]
        for role, bearing in [('outerBearing', outer), ('innerBearing', inner)]:
            for offset in bearing_offsets:
                moving = bearing.copy()
                moving.translate(App.Vector(offset, 0, 0))
                for target in [wall, fork] + ([outer] if role == 'innerBearing' else []):
                    assert overlap(moving, target) < 1e-6, ('Output bearing insertion blocked', letter, role, offset)
            paths[letter + '-' + role] = {'stations': len(bearing_offsets), 'shaftAbsent': True}
        shaft_id = identity(letter, 'shaft')
        shaft = local[shaft_id]
        shaft_offsets = [35, 20, 10, 6, 4, 2, 1, .3, 0]
        for offset in shaft_offsets:
            moving = shaft.copy()
            moving.translate(App.Vector(offset, 0, 0))
            for target in [wall, fork, inner, outer]:
                assert overlap(moving, target) < 1e-6, ('Round shaft axial insertion blocked', letter, offset)
        paths[letter + '-shaft'] = {'stations': len(shaft_offsets), 'pinAndClipInstalledAfterward': True}
        inverse = channel_frames[channel].inverse()
        clip_id = identity(letter, 'centerClip')
        opening_world = placement_rotation(items[clip_id]).multVec(App.Vector(0, 1, 0))
        opening = inverse.multVec(opening_world) - inverse.multVec(App.Vector())
        clip_offsets = [12, 8, 5, 4.1, 3.9, 3, 1, .2, 0]
        for offset in clip_offsets:
            moving = local[clip_id].copy()
            moving.translate(opening * -offset)
            for key in output_ids:
                if key not in [clip_id, shaft_id]:
                    assert overlap(moving, local[key]) < 1e-6, ('Center-clip access blocked', letter, offset, key)
        paths[letter + '-centerClip'] = {'stations': len(clip_offsets), 'elasticSnapAgainstOwnShaftAllowed': True}
        pin_id = identity(letter, 'forkPin')
        pin_axis_world = placement_rotation(items[pin_id]).multVec(App.Vector(0, 0, 1))
        pin_axis = inverse.multVec(pin_axis_world) - inverse.multVec(App.Vector())
        assert abs(pin_axis.z - 1) < 1e-8
        pin_offsets = [12, 8, 6, 4, 2, 1, 0]
        for offset in pin_offsets:
            moving = local[pin_id].copy()
            moving.translate(pin_axis * offset)
            for key in output_ids:
                if key != pin_id:
                    assert overlap(moving, local[key]) < 1e-6, ('Vertical fork-pin entry blocked', letter, offset, key)
        control = local[pin_id].copy()
        control.translate(App.Vector(0, .2, 0))
        assert overlap(control, shaft) + overlap(control, fork) > .01
        paths[letter + '-forkPin'] = {'stations': len(pin_offsets), 'oppositeNutSideEntry': True, 'motorsAndGearsInstalledAfterward': True, 'misalignmentControl': True}
        source_screw = canonical(records[identity(letter, 'screw')], channel, drive=True)
        source_nut = canonical(records[nut_id], channel, drive=True)
        source_case = canonical(housing, channel, drive=True)
        wrong = source_screw.copy()
        wrong.rotate(App.Vector(), App.Vector(1, 0, 0), 90)
        assert overlap(wrong, source_nut) > .1
        periodic = source_screw.copy()
        periodic.translate(App.Vector(4, 0, 0))
        assert overlap(periodic, source_nut) < 1e-6
        feed_offsets = [-50, -30, -28.6, -28.5, -25, -23.5, -23.1, -16, -8, -7.9, -7.5, 0]
        for offset in feed_offsets:
            moving = source_screw.copy()
            moving.rotate(App.Vector(), App.Vector(1, 0, 0), 90 * offset)
            moving.translate(App.Vector(offset, 0, 0))
            assert overlap(moving, source_nut) < 1e-6, ('TR8 helical feed blocked', letter, offset)
            assert overlap(moving, source_case) < 1e-6, ('Screw cannot enter empty bearing seats', letter, offset)
        paths[letter + '-screwFeed'] = {'stations': len(feed_offsets), 'rotationDegreesPerMillimeter': 90, 'wrongPhaseControl': True, 'oneLeadControl': True}
        motor_id = next(key for key, item in items.items() if key.startswith(letter + '-') and item['libraryId'] in ['surpass-2838', 'surpass-2845'])
        motor = canonical(records[motor_id], channel, drive=True)
        motor_offsets = [35, 25, 15, 8, 4, 1, 0]
        for offset in motor_offsets:
            moving = motor.copy()
            moving.translate(App.Vector(offset, 0, 0))
            assert overlap(moving, source_case) < 1e-6, ('Motor rear-passage insertion blocked', letter, offset)
        paths[letter + '-motor'] = {'stations': len(motor_offsets), 'gearsInstalledAfterward': True}
        report['paths'] = paths
        save('critical internal assembly routes passed for channel ' + letter)
    paths['totalStations'] = sum(value['stations'] for value in paths.values() if isinstance(value, dict))
    return paths


def export_neutral(row, records, metadata):
    doc = App.newDocument('TR8QuadGearedRocker')
    config = doc.addObject('App::FeaturePython', 'Mechanism')
    for key, value in [('PartId', data['partId']), ('Motor', row['motor']), ('GeometryMode', 'full'), ('CaptureSHA256', report['captureSha256'])]:
        config.addProperty('App::PropertyString', key, 'Configuration')
        setattr(config, key, value)
    for letter in 'ABCD':
        config.addProperty('App::PropertyAngle', 'Output' + letter, 'Configuration')
        setattr(config, 'Output' + letter, 0)
    exported = []
    for item in row['occurrences']:
        key = item['id']
        obj = doc.addObject('Part::Feature', key.replace('-', '_'))
        obj.Label, obj.Shape = item['name'], records[key]
        for name, value in metadata[key].items():
            if isinstance(value, str):
                obj.addProperty('App::PropertyString', name, 'ProtoLab')
                setattr(obj, name, value)
        exported.append(obj)
    doc.recompute()
    stem = 'TR8x4-quad-geared-rocker-' + row['motor']
    fcstd, step = out / (stem + '.FCStd'), out / (stem + '.step')
    doc.saveAs(str(fcstd))
    Part.export(exported, str(step))
    imported = Part.read(str(step))
    source = Part.makeCompound(list(records.values()))
    assert valid(imported)
    assert len(imported.Solids) == len(source.Solids)
    error = abs(imported.Volume - source.Volume) / source.Volume
    assert error < 1e-6, ('STEP volume changed', error)
    a, b = imported.optimalBoundingBox(False, False), source.optimalBoundingBox(False, False)
    for key in 'XYZ':
        for end in ['Min', 'Max']:
            assert abs(getattr(a, key + end) - getattr(b, key + end)) < 1e-5
    panel_step = None
    if row['motor'] == data['primary']:
        panel_object = next(obj for obj in exported if obj.AssemblyOccurrenceId == identity('a', 'case'))
        panel_step = out / 'TR8x4-quad-identical-CNC-panel.step'
        Part.export([panel_object], str(panel_step))
        panel_roundtrip = Part.read(str(panel_step))
        assert valid(panel_roundtrip) and len(panel_roundtrip.Solids) == 1
        assert abs(panel_roundtrip.Volume - panel_object.Shape.Volume) < 1e-5
    App.closeDocument(doc.Name)
    reopened = App.openDocument(str(fcstd))
    physical = [obj for obj in reopened.Objects if hasattr(obj, 'AssemblyOccurrenceId')]
    assert len(physical) == len(records) and all(valid(obj.Shape) for obj in physical)
    App.closeDocument(reopened.Name)
    return {'fcstd': str(fcstd), 'step': str(step), 'occurrences': len(records), 'nativeSolids': len(source.Solids), 'stepVolumeRelativeError': error, 'stepBoundsTolerance': 1e-5, 'fcstdReopenedValid': True, **({'panelStep': str(panel_step)} if panel_step else {})}


def seed_verified_neutral_pairs():
    evidence_path = out / 'before-route-change-early-native-report.json'
    old_capture_path = out / 'before-route-change-capture.json'
    old_verifier_path = out / 'before-route-change-verifier.py'
    previous = json.loads(evidence_path.read_text())
    old_data = json.loads(old_capture_path.read_text())
    assert previous['captureSha256'] == hashlib.sha256(old_capture_path.read_bytes()).hexdigest()
    assert previous['verifierSha256'] == hashlib.sha256(old_verifier_path.read_bytes()).hexdigest()
    assert "'Redesigned fork cannot side-load into welded housing', 'a', 10, -14" in previous.get('error', '')
    old, current = old_data['poses'][0], data['poses'][0]
    assert old['source'] == current['source'], 'Cannot inherit intersections after any native-model change.'
    assert old_data['dependencySources'] == data['dependencySources'] and old_data['preserved'] == data['preserved']
    assert old['occurrences'] == current['occurrences']
    detail = previous['poses'][0]
    assert detail['sourceSha256'] == hashlib.sha256(current['source'].encode()).hexdigest()
    assert not detail['collisions'] and detail['checkedPairs'] == len(current['occurrences']) * (len(current['occurrences']) - 1) // 2
    assert detail['reusedPairs'] == 0, 'Expected direct neutral intersection evidence.'
    for index, first in enumerate(current['occurrences']):
        for second in current['occurrences'][:index]:
            pair_cache[tuple(sorted([first['geometryKey'], second['geometryKey']]))] = 0.0
    report['inheritedNeutralIntersectionEvidence'] = {
        'report': str(evidence_path), 'reportSha256': hashlib.sha256(evidence_path.read_bytes()).hexdigest(),
        'capture': str(old_capture_path), 'savedVerifier': str(old_verifier_path),
        'exactNativeSourceUnchanged': True, 'physicalPairs': detail['checkedPairs'],
        'scope': 'Only clear material-intersection pairs are reused. Every other check, including the corrected loading path, runs again.'}


try:
    if '--reuse-clear-neutral-pairs' in sys.argv[2:]:
        seed_verified_neutral_pairs()
    if paths_only:
        row = data['poses'][0]
        assert all(angle == 0 for angle in row['angles'])
        scope = execute(row['source'])
        records, children, metadata = group(scope, row)
        report['pinEngagement'] = prove_pin_engagement(records, row)
        report['endCapMates'] = prove_end_cap_mates(records, metadata, row)
        report['paths'] = prove_paths(records, row)
        report['neutralSourceSha256'] = hashlib.sha256(row['source'].encode()).hexdigest()
        for file, expected in sources.items():
            assert hashlib.sha256(Path(file).read_bytes()).hexdigest() == expected, ('Source changed during paths', file)
        report['pathsPassed'] = True
        save('assembly paths passed')
        sys.exit(0)
    selected = data['poses'][:3] if '--limits-only' in sys.argv[2:] else data['poses'][:1] if '--early-only' in sys.argv[2:] else data['poses']
    for row in selected:
        scope = execute(row['source'])
        records, children, metadata = group(scope, row)
        detail = {'key': row['key'], 'motor': row['motor'], 'angles': row['angles'], 'nativeChildren': len(scope['components']),
                  'sourceSha256': hashlib.sha256(row['source'].encode()).hexdigest(),
                  'occurrences': len(records), 'collisions': [], 'checkedPairs': 0, 'reusedPairs': 0}
        report['poses'].append(detail)
        detail['pinEngagement'] = prove_pin_engagement(records, row)
        detail['followerRetention'] = prove_follower_retention(records, row)
        detail['plainSourceInterfaces'] = prove_plain_source_interfaces(records, children, row)
        save('native source built ' + row['key'])
        for index, first in enumerate(row['occurrences']):
            for second in row['occurrences'][:index]:
                cache_key = tuple(sorted([first['geometryKey'], second['geometryKey']]))
                if cache_key in pair_cache:
                    volume = pair_cache[cache_key]
                    detail['reusedPairs'] += 1
                else:
                    volume = overlap(records[first['id']], records[second['id']])
                    pair_cache[cache_key] = volume
                detail['checkedPairs'] += 1
                if volume > 1e-6:
                    detail['collisions'].append([first['id'], second['id'], volume])
        assert not detail['collisions'], ('Native assembly collisions', detail['collisions'])
        detail['radialAxes'] = prove_axes(records)
        bounds = Part.makeCompound(list(records.values())).optimalBoundingBox(False, False)
        assert abs(bounds.XLength - 66) < 1e-5 and abs(bounds.YLength - 66) < 1e-5
        assert abs(bounds.ZLength - 2 * fixed['panelHigh']) < 1e-5
        detail['envelope'] = [bounds.XLength, bounds.YLength, bounds.ZLength]
        support_key = tuple(sorted(item['geometryKey'] for item in row['occurrences'] if item['libraryId'] in ['ball-bearing', 'flanged-ball-bearing'] or item['id'] == roles['cross'] or any(item['id'].endswith('-' + roles[role]) for role in ['case', 'endDisc'])))
        if support_key not in support_cache:
            support_cache[support_key] = (prove_shared_panels(records, metadata), prove_bearing_seats(records, metadata, row, children), prove_end_cap_mates(records, metadata, row), prove_case_clamps(records, row), prove_sheet_panels(records))
        else:
            detail['fixedBearingSupportReused'] = True
        detail['sharedPanels'], detail['bearingSeats'], detail['endCapMates'], detail['caseClamps'], detail['sheetPanels'] = support_cache[support_key]
        detail['centerClipContacts'] = prove_center_contacts(records, children)
        detail['stops'] = prove_stops(row, records, metadata)
        if '--housing-access' in sys.argv[2:] and all(angle == 0 for angle in row['angles']):
            detail['barePanelClosure'] = prove_bare_panel_closure(records)
            save('opposite-fold bare panel closure passed')
        if '--fork-access' in sys.argv[2:] and all(angle == 0 for angle in row['angles']):
            detail['forkAccess'] = prove_fork_access(records, row)
            save('redesigned fork side loading and pin access passed')
        if not probe_only and row['motor'] == data['primary'] and all(angle == 0 for angle in row['angles']):
            previous_path_file = out / 'paths-native-report.json'
            previous_paths = json.loads(previous_path_file.read_text()) if previous_path_file.exists() else {}
            if previous_paths.get('pathsPassed') and previous_paths.get('neutralSourceSha256') == hashlib.sha256(row['source'].encode()).hexdigest() and previous_paths.get('verifierSha256') == report['verifierSha256']:
                report['paths'] = previous_paths['paths']
                report['pathsReusedFrom'] = str(previous_path_file)
            else:
                report['paths'] = prove_paths(records, row)
            save('early neutral geometry and access proof passed')
        if not probe_only and all(angle == 0 for angle in row['angles']):
            report['exports'][row['motor']] = export_neutral(row, records, metadata)
        detail['completed'] = True
        save('completed ' + row['key'])
    if probe_only:
        for file, expected in sources.items():
            assert hashlib.sha256(Path(file).read_bytes()).hexdigest() == expected, ('Source changed during checkpoint', file)
        assert all(pose.get('completed') for pose in report['poses'])
        report['passed'] = True
        report['earlyPassed'] = True
        report['checkpointPassed'] = True
        report['optionalPublicMacroAndExportSuiteExecuted'] = False
        report['verificationScope'] = 'Selected Full native poses and requested focused paths only; optional broad paths, public macros and exports were not run.'
        save('early proof passed')
        sys.exit(0)
    assert len(report['poses']) == len(data['poses']) and all(row.get('completed') for row in report['poses'])
    for macro in data['macros']:
        doc = App.newDocument('QuadPublicMacroCheck')
        sentinel = doc.addObject('Part::Feature', 'Sentinel')
        sentinel.Shape = Part.makeBox(1, 1, 1)
        before = {obj.Name for obj in doc.Objects}
        execute(Path(macro['path']).read_text(), reuse=False)
        objects = [obj for obj in doc.Objects if obj.Name not in before and hasattr(obj, 'AssemblyOccurrenceId')]
        expected = next(row for row in report['poses'] if row['motor'] == macro['motor'] and all(angle == 0 for angle in row['angles']))
        assert len(objects) == expected['nativeChildren'] and all(valid(obj.Shape) for obj in objects)
        assert {obj.AssemblyOccurrenceId for obj in objects} == {item['id'] for item in data['poses'][0]['occurrences']}
        assert len({obj.AssemblyOccurrenceId for obj in objects if getattr(obj, 'LibraryId', '') in ['surpass-2838', 'surpass-2845']}) == 4
        assert len({obj.AssemblyOccurrenceId for obj in objects if getattr(obj, 'LibraryId', '') == 'ball-bearing'}) == 4
        assert abs(sentinel.Shape.Volume - 1) < 1e-9
        report['publicMacros'].append({'path': macro['path'], 'motor': macro['motor'], 'mode': macro['mode'], 'validChildren': len(objects), 'sentinelPreserved': True})
        App.closeDocument(doc.Name)
        save('public macro passed ' + macro['motor'] + ' ' + macro['mode'])
    for file, expected in sources.items():
        assert hashlib.sha256(Path(file).read_bytes()).hexdigest() == expected, ('Source changed during proof', file)
    report['passed'] = True
    save('passed')
except BaseException as error:
    if isinstance(error, SystemExit) and error.code == 0:
        raise
    report['error'] = str(error)
    save('FAILED')
    raise
