"""Check actual panel battery module CAD, service paths and native exports.

Prepare cases with verify-panel-battery-module.ts, then run using FreeCAD's
bundled Python. The optional argument selects the generated fixture folder.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

sys.path.append('/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
import MeshPart

output = Path(globals().get('BATTERY_MODULE_OUTPUT', sys.argv[1] if len(sys.argv) > 1 else Path.cwd() / 'test-results' / 'panel-battery-module'))
only_ids = globals().get('BATTERY_MODULE_ONLY_IDS')
report = list(globals().get('BATTERY_MODULE_PREVIOUS_REPORT', []))


def bounds_intersect(a, b):
    aa, bb = a.BoundBox, b.BoundBox
    return not (aa.XMax < bb.XMin or bb.XMax < aa.XMin or aa.YMax < bb.YMin or bb.YMax < aa.YMin or aa.ZMax < bb.ZMin or bb.ZMax < aa.ZMin)


def overlap(a, b):
    return a.common(b).Volume if bounds_intersect(a, b) else 0


def shifted(shape, x=0, y=0, z=0):
    result = shape.copy()
    result.translate(App.Vector(x, y, z))
    return result


def assert_clear(a, b, context, tolerance=1e-5):
    volume = overlap(a, b)
    if volume >= tolerance:
        common = a.common(b)
        raise AssertionError((*context, 'interference in mm3', volume, 'regions', [(solid.Volume, str(solid.BoundBox)) for solid in common.Solids]))


def native_scope(code):
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(code, scope)
    return scope


def valid_components(case, scope):
    shapes = scope['components']
    definitions = case['pieces']
    assert len(shapes) == len(definitions) == len(scope['component_labels']), case['id']
    result = {}
    for definition, shape in zip(definitions, shapes):
        id = definition['id']
        assert id not in result, (case['id'], 'duplicate component ID', id)
        assert shape.isValid() and shape.isClosed() and shape.Volume > 0 and len(shape.Solids) > 0, (case['id'], id, 'invalid, empty or open physical component')
        if definition['supply'] == 'manufactured':
            assert len(shape.Solids) == 1, (case['id'], id, 'manufactured detail must be one solid', len(shape.Solids))
        result[id] = shape
    return result


def canonical_step(shape, path):
    shape.exportStep(str(path))
    canonical = Part.read(str(path))
    assert canonical.isValid() and canonical.isClosed(), (str(path), 'STEP validity')
    assert len(canonical.Solids) == len(shape.Solids), (str(path), 'STEP solid count')
    relative_error = abs(canonical.Volume-shape.Volume)/shape.Volume
    comparison = {'file': path.name, 'sourceVolume': shape.Volume, 'stepVolume': canonical.Volume, 'rawVolumeRelativeError': relative_error, 'method': 'mass-property comparison'}
    if relative_error >= 1e-5:
        assert relative_error < 1e-4, (str(path), 'STEP mass integration discrepancy', relative_error)
        removed, added = shape.cut(canonical), canonical.cut(shape)
        assert abs(removed.Volume)+abs(added.Volume) < 1e-6 and not removed.Solids and not added.Solids, (str(path), 'STEP changed physical material')
        aa, bb = shape.BoundBox, canonical.BoundBox
        bounds_error = max(abs(getattr(aa, key)-getattr(bb, key)) for key in ['XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax'])
        assert bounds_error < 1e-6, (str(path), 'STEP bounds changed', bounds_error)
        common = shape.common(canonical)
        common_error = abs(common.Volume-shape.Volume)/shape.Volume
        assert common.isValid() and common.isClosed() and common_error < 1e-8, (str(path), 'STEP does not cover source')
        assert abs(shape.Area-canonical.Area)/shape.Area < 1e-4, (str(path), 'STEP surface integration discrepancy')
        comparison.update(method='mass-integration discrepancy / geometrically identical boolean proof', removedVolume=removed.Volume, addedVolume=added.Volume, boundsMaximumError=bounds_error, commonVolumeRelativeError=common_error)
    return canonical, comparison


def print_audit(case, by_id):
    assert set(by_id) == set(case['printIds']), (case['id'], 'print layout must contain exactly the PETG manufacturing details', list(by_id))
    assembled = native_scope(case['assembledCode'])
    originals = {definition['id']: shape for definition, shape in zip(case['assembledPieces'], assembled['components'])}
    result = []
    for id, shape in by_id.items():
        assert abs(shape.BoundBox.ZMin) < 1e-6, (case['id'], id, 'part not on print bed', shape.BoundBox.ZMin)
        assert abs(shape.Volume-originals[id].Volume)/shape.Volume < 1e-8, (case['id'], id, 'print pose changes material')
        bed_faces = [face for face in shape.Faces if isinstance(face.Surface, Part.Plane) and abs(face.BoundBox.ZMin) < 1e-6 and abs(face.BoundBox.ZMax) < 1e-6]
        bed_area = sum(face.Area for face in bed_faces)
        assert bed_area > 10, (case['id'], id, 'insufficient planar bed face', bed_area)
        for other_id, other in by_id.items():
            if other_id != id:
                assert_clear(shape, other, (case['id'], id, other_id, 'print part placement'))
        name = case['id'] + '_' + id
        canonical, comparison = canonical_step(shape, output/(name+'.step'))
        mesh = MeshPart.meshFromShape(Shape=canonical, LinearDeflection=0.05, AngularDeflection=0.15, Relative=False)
        assert mesh.isSolid() and not mesh.hasNonManifolds(), (name, 'STL is open or non-manifold')
        mesh.write(str(output/(name+'.stl')))
        roofs = []
        for face in shape.Faces:
            if not isinstance(face.Surface, Part.Plane) or face.BoundBox.ZMin < 0.01:
                continue
            if face.normalAt(0, 0).z < -0.999 and face.Area > 0.5:
                roofs.append({'height': face.CenterOfMass.z, 'area': face.Area})
        result.append({'id': id, 'bedArea': bed_area, 'downwardHorizontalFaces': roofs, 'step': comparison, 'stl': name+'.stl'})
    return result


def state_shapes(case, key):
    native = native_scope(case[key])
    return dict(zip([piece['id'] for piece in case['assembledPieces']], native['components']))


def rotated(shape, x, y, angle):
    result = shape.copy()
    result.rotate(App.Vector(x, y, 0), App.Vector(0, 0, 1), angle)
    return result


_closure_cache = {}


def closure_audit(case, by_id):
    d, fixture = case['layout'], case['closureFixture']
    closed = by_id if case['state'] == 'assembled' else state_shapes(case, 'assembledCode')
    released = by_id if case['state'] == 'unlocked' else state_shapes(case, 'unlockedCode')
    lid, frame, slider = closed['lid'], closed['frame'], closed['latch-slider']
    assert lid.distToShape(frame)[0] < 1e-6, (case['id'], 'lid lacks a positive bezel seat')
    assert abs(slider.Volume-released['latch-slider'].Volume)/slider.Volume < 1e-8, (case['id'], 'release changes printed bolt material')
    # Localize retention to each actual hook and the right keeper: contact at
    # an unrelated flange cannot accidentally satisfy the capture proof.
    edge = d['openingLength']/2
    for y in [-13, 13]:
        roi = Part.makeBox(8, 8.2, 8, App.Vector(-edge-4, y-4.1, -3))
        assert overlap(shifted(lid, z=.3).common(roi), frame) > .01, (case['id'], 'left hook lacks under-rim capture', y)
    keeper = Part.makeBox(3.2, 18.2, 7.5, App.Vector(37.5, -14.1, -3.3))
    assert overlap(shifted(lid, z=.3).common(keeper), slider) > .01, (case['id'], 'closed bolt does not capture the right keeper')
    assert_clear(released['latch-slider'], keeper, (case['id'], 'retracted bolt still projects into keeper envelope'))
    assert overlap(shifted(slider, z=.3), frame) > .01, (case['id'], 'slider can leave channel upwards')
    assert overlap(shifted(slider, z=-.4), closed['latch-cover']) > .01, (case['id'], 'removable lower cover does not retain slider')
    for displacement in [-.4, .4]:
        assert overlap(shifted(slider, y=displacement), frame) > .01, (case['id'], 'slider lacks lateral channel registration', displacement)
    assert slider.BoundBox.ZMax < d['flangeTop']-.2, (case['id'], 'actuator protrudes above the bezel')
    key = hashlib.sha256(fixture['code'].encode()).hexdigest()
    if key not in _closure_cache:
        _closure_cache[key] = native_scope(fixture['code'])['components']
    generated = _closure_cache[key]
    assert len(generated) == len(fixture['entries']), (case['id'], 'closure pose count')
    fixed_slider_ids = [id for id in closed if id not in ['latch-slider', 'latch-spring']]
    lid_ids = {'lid'} | {id for id in closed if id.startswith('lid-foam')}
    fixed_lid_ids = [id for id in released if id not in lid_ids and id != 'extraction-ribbon']
    final_lid = None
    for entry, moving in zip(fixture['entries'], generated):
        assert moving.isValid() and moving.isClosed() and len(moving.Solids) == 1, (case['id'], entry['id'], 'invalid production closure pose')
        if entry['role'] == 'slider':
            travel = entry['travel']
            if travel < 0 or travel > fixture['constants']['stroke']:
                assert overlap(moving, frame)+overlap(moving, closed['latch-cover']) > .01, (case['id'], 'missing positive slider travel stop', travel)
                continue
            expected = shifted(slider, x=travel)
            assert abs(moving.Volume-expected.Volume)/expected.Volume < 1e-8, (case['id'], entry['id'], 'slider material changed')
            assert (moving.Solids[0].CenterOfMass-expected.Solids[0].CenterOfMass).Length < 1e-6, (case['id'], entry['id'], 'incorrect sliding pose')
            for id in fixed_slider_ids:
                assert_clear(moving, closed[id], (case['id'], 'slider travel', travel, id))
            # Approach a recessed thumb pad from above through the bezel slot.
            finger = Part.makeCylinder(3, 12, App.Vector(50.5+travel, -5, 3.75))
            for id in ['frame', 'lid', 'power-connector', 'balance-socket']:
                assert_clear(finger, closed[id], (case['id'], 'recessed actuator finger access', travel, id))
        elif entry['role'] == 'installation':
            # The latch is fitted before the donor board, rear tray and holder
            # rails; those later subassemblies cover its rear access route.
            for id in ['frame', 'power-connector', 'latch-cover-insert-1', 'latch-cover-insert-2', 'latch-spring']:
                assert_clear(moving, released[id], (case['id'], 'rear bolt insertion with normal released spring held on fixed post', entry['deltaZ'], id))
        else:
            part_id = entry['partId']
            expected = closed[part_id].copy()
            expected.rotate(App.Vector(-edge, 0, 4), App.Vector(0, 1, 0), entry['angle'])
            expected.translate(App.Vector(entry['withdraw'], 0, entry['lift']))
            assert abs(moving.Volume-expected.Volume)/expected.Volume < 1e-8, (case['id'], entry['id'], 'lid motion changes material')
            assert (moving.Solids[0].CenterOfMass-expected.Solids[0].CenterOfMass).Length < 1e-6, (case['id'], entry['id'], 'production lid pose differs from independent rigid transform')
            for id in fixed_lid_ids:
                # Attached compressible foam initially presses the cells. The
                # manually fed ribbon is deliberately absent from rigid motion
                # proof; the printed lid and hooks receive no such exemption.
                if part_id.startswith('lid-foam') and id.startswith('cell-'):
                    continue
                assert_clear(moving, released[id], (case['id'], 'hook insertion/removal path', part_id, entry['angle'], entry['withdraw'], entry['lift'], id))
            if part_id == 'lid' and entry['lift'] == 35:
                final_lid = moving
    spring_key = hashlib.sha256(fixture['springCode'].encode()).hexdigest()
    if spring_key not in _closure_cache:
        _closure_cache[spring_key] = native_scope(fixture['springCode'])['components']
    assert len(fixture['springPoses']) == len(_closure_cache[spring_key]), (case['id'], 'spring installation pose count')
    for pose, spring in zip(fixture['springPoses'], _closure_cache[spring_key]):
        for id in ['frame', 'power-connector', 'latch-cover-insert-1', 'latch-cover-insert-2']:
            assert_clear(spring, closed[id], (case['id'], 'spring loading/release into bare bezel', pose, id))
        if pose['phase'] == 'release':
            assert_clear(spring, slider, (case['id'], 'spring release to neutral bolt seat', pose))
    opened = state_shapes(case, 'openCode')
    assert final_lid is not None and (final_lid.Solids[0].CenterOfMass-opened['lid'].Solids[0].CenterOfMass).Length < 1e-6, (case['id'], 'displayed open state is not the qualified removal pose')
    # Installed spring references use the same bought-in library and retain
    # clearance around the single 6 mm fixed guide post. No spring-rate or life result
    # follows from these nominal coil dimensions.
    case['_springEnvelope'] = []
    for state, scope, length in [('closed', closed, 9), ('released', released, 5)]:
        spring = scope['latch-spring']
        # Ordinary BSpline bounds include control-pole overshoot (~0.18 mm
        # here). Use native optimal bounds, then prove exact end-plane fit
        # against both outside slabs and contact with the actual seats.
        bb = spring.optimalBoundingBox()
        assert abs(bb.XLength-length) < .002 and abs(bb.YLength-8) < .002 and abs(bb.ZLength-8) < .002, (case['id'], state, 'spring wire envelope does not match installed 8 OD x length', str(bb))
        left = fixture['constants']['fixedSeat']-length
        right = fixture['constants']['fixedSeat']
        assert abs(bb.XMin-left) < .002 and abs(bb.XMax-right) < .002, (case['id'], state, 'spring misses its axial seats')
        outside = [Part.makeBox(100, 30, 30, App.Vector(left-100, -20, -20)), Part.makeBox(100, 30, 30, App.Vector(right, -20, -20))]
        outside_volume = [overlap(spring, slab) for slab in outside]
        assert max(outside_volume) < 1e-6, (case['id'], state, 'actual spring crosses either axial seat', outside_volume)
        seat_distance = [spring.distToShape(scope[id])[0] for id in ['frame', 'latch-slider']]
        assert max(seat_distance) < .002, (case['id'], state, 'actual coil does not bear on both end seats', seat_distance)
        case['_springEnvelope'].append({'state': state, 'installedLength': length, 'optimalBounds': [bb.XMin, bb.YMin, bb.ZMin, bb.XMax, bb.YMax, bb.ZMax], 'outsideAxialSlabVolumes': outside_volume, 'actualSeatDistances': seat_distance, 'conservativeSolidHeight': 2.8, 'coilBindMargin': length-2.8, 'fixedPostMargin': length-4})
        assert length-2.8 >= 2.2-1e-9, (case['id'], state, 'insufficient conservative unground coil-bind margin')
        assert length-4 >= 1-1e-9, (case['id'], state, 'slider seat reaches fixed spring post before travel stop')
        for id in ['frame', 'latch-slider', 'latch-cover', 'holder-clamp-right', 'lid']:
            assert_clear(spring, scope[id], (case['id'], state, 'spring pocket/guide clearance', id))
    for i in range(1, 3):
        screw, insert = closed['latch-cover-screw-'+str(i)], closed['latch-cover-insert-'+str(i)]
        assert abs(screw.BoundBox.ZMin+13.8) < 1e-6, (case['id'], 'latch cover screw head is not flush', i)
        assert screw.BoundBox.ZMax >= insert.BoundBox.ZMax+2.5, (case['id'], 'latch cover screw lacks full insert engagement', i)
    return ['both left under-rim hooks and the right bolt keeper positively capture the seated lid', 'same rigid slider clears its 4 mm stroke, is retained on three axes, meets positive stops and remains recessed with thumb access', 'production lid and foam clear tilt 0..17 degrees, hook withdrawal 0..4 mm and lift 0..35 mm; open state matches final pose', 'nominal 8 OD x 10 free x 0.4 wire six-coil spring spans both seats at 9/5 mm with 2.2 mm conservative coil-bind and 1 mm fixed-post margin', 'neutral rigid bolt fits from the rear with cover removed and normal 5 mm compressed spring held on fixed post; sampled axial spring loading/release clears bare bezel; install before PCB/tray/holder rails', 'spring force, PETG wear, foam compression and manual ribbon feeding require physical qualification']


def ribbon_audit(case, by_id):
    d = case['layout']
    ribbon = by_id['extraction-ribbon']
    assert len(ribbon.Solids) == 1, (case['id'], 'fabric sling route is disconnected')
    assert abs(ribbon.BoundBox.XLength-d['strapWidth']) < 1e-6, (case['id'], 'fabric strip width changed')
    for id, shape in by_id.items():
        if id != 'extraction-ribbon':
            assert_clear(ribbon, shape, (case['id'], 'actual sling route', id))
    for y in d['pinRows']:
        point = App.Vector(0, y, -22.9)
        assert ribbon.isInside(point, 1e-6, False), (case['id'], 'sling does not pass below every cell', y)
        assert point.z < d['cellZ']-d['cellDiameter']/2, (case['id'], 'sling lies above cell underside')
    for y, z in case['ribbonRoute']:
        assert ribbon.isInside(App.Vector(0, y, z), 1e-6, False), (case['id'], 'ribbon route datum differs from physical solid', y, z)
    # This proves clearance of the two strip legs, not the ability to pass the
    # undeformed upper finger loop through the slit. Feeding is a manual soft
    # material operation and remains a physical qualification requirement.
    closed = by_id if case['state'] == 'assembled' else state_shapes(case, 'assembledCode')
    slit = Part.makeBox(d['strapWidth']+.4, 2.4, d['lidTop']-d['lidBottom']+.4, App.Vector(-d['strapWidth']/2-.2, -1.2, d['lidBottom']-.2))
    assert_clear(closed['lid'], slit, (case['id'], 'shared slit does not clear both ribbon legs'))
    finger = Part.makeCylinder(4, d['strapWidth']+2, App.Vector(-d['strapWidth']/2-1, 0, 18.5), App.Vector(1, 0, 0))
    for id in ['extraction-ribbon', 'frame', 'lid', 'power-connector', 'balance-socket']:
        assert_clear(finger, closed[id], (case['id'], 'sling finger-loop access', id))
    return ['single continuous 12 x 0.4 mm soft sling clears source tray, contacts, cells and enclosure, including every floor band', 'sling crosses beneath every cell and both legs clear the shared lid slit; accessible finger loop', 'manual loop compression, seam flexibility and removal loads require physical qualification; no rigid feeding or load decoupling claim']


def mating_audit(case, by_id):
    fixture, d = case['matingFixture'], case['layout']
    scope = native_scope(fixture['code'])
    mate = scope['shape'].copy()
    assert mate.isValid() and mate.isClosed() and len(mate.Solids) == 1
    rotation, translation = fixture['placement']['rotation'], fixture['placement']['translation']
    assert rotation == [0, 0, 0], (case['id'], 'update side interface proof for changed PCB header orientation')
    outward = App.Vector(*fixture['outwardAxis'])
    assert fixture['outwardAxis'] == [-v for v in fixture['insertionAxis']] == [-1, 0, 0], (case['id'], 'source right-angle insertion axis changed')
    mate.translate(App.Vector(*fixture['fullyMatedTranslation']))
    mate.translate(App.Vector(*translation))
    centre = App.Vector(*fixture['interfaceOrigin'])+App.Vector(0, -fixture['rowSpan']/2, 0)+App.Vector(*translation)
    tip = App.Vector(*fixture['contactTip'])+App.Vector(*translation)
    closed = by_id if case['state'] == 'assembled' else state_shapes(case, 'assembledCode')
    header = closed['balance-socket']
    assert any(solid.isInside(tip-outward*.05, 1e-6, False) for solid in header.Solids), (case['id'], 'declared mating datum is not aligned to actual bent-pin contact tip')
    assert not any(solid.isInside(tip+outward*.05, 1e-6, False) for solid in header.Solids), (case['id'], 'declared male contact tip extends farther than the source geometry')
    assert abs(header.optimalBoundingBox().XMin-d['bodyLeft']) < .002, (case['id'], 'right-angle shroud is not flush with the module side wall')
    # Panel and its separate M4 clamp hardware are absent: this is the user's
    # explicitly withdrawn module, not an installed-panel access claim.
    obstructions = [id for id in closed if id != 'host-panel' and not id.startswith('panel-')]
    assert mate.BoundBox.XMax-fixture['approachTravel'] < d['bodyLeft']-.9, (case['id'], 'side mate starts inside the wall instead of fully outside the module')
    for travel in range(int(fixture['approachTravel'])+1):
        moved = shifted(mate, x=-travel)
        for id in obstructions:
            assert_clear(moved, closed[id], (case['id'], 'side matched housing approach with module withdrawn', travel, id))
    # Start solid and nonparallel face prisms cover the complete straight
    # approach, including the intervals between sampled installation poses.
    for face in mate.Faces:
        assert isinstance(face.Surface, Part.Plane), (case['id'], 'update continuous mating sweep for a curved housing face')
        if abs(face.normalAt(0, 0).dot(outward)) < 1e-8:
            continue
        swept = face.extrude(outward*fixture['approachTravel'])
        if swept.Volume < 0:
            swept.reverse()
        assert swept.isValid() and swept.isClosed() and swept.Volume > 0, (case['id'], 'invalid straight side mating sweep')
        for id in obstructions:
            assert_clear(swept, closed[id], (case['id'], 'continuous side approach through keyed wall opening', id))
    reverse = mate.copy()
    reverse.rotate(centre, outward, 180)
    reverse.translate(outward*4.5)
    assert min(vertex.Point.dot(outward) for vertex in reverse.Vertexes) > tip.dot(outward)+.5, (case['id'], 'reverse side housing reaches contact tips before shell blocks')
    assert overlap(reverse, header) > .01, (case['id'], 'reversed right-angle housing is not blocked by asymmetric shroud guides')
    return ['actual bent-pin contact tips align with the authored right-angle mate and the shroud is flush with the module wall', 'authored nominal 2.54 mm housing continuously clears the keyed side opening and all module parts over its '+str(fixture['approachTravel'])+' mm side approach; host panel and M4 mounting hardware are removed', 'asymmetric shroud blocks reversed housing before pin contact; applies only to the authored pair, delivered fit unqualified']


_path_proof_cache = {}


def path_audit(case, by_id, kind, verifier):
    # Only byte-identical canonical production scenes and complete fixture
    # definitions may share a proof within this one process. Current-state
    # solids, interfaces and exports are still checked for every case.
    payload = {
        'assembled': case['assembledCode'],
        'unlocked': case['unlockedCode'],
        'open': case['openCode'],
        'fixture': case['closureFixture'] if kind == 'closure' else case['matingFixture'],
    }
    key = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    case.setdefault('_pathAuditCache', {})[kind] = {'key': key, 'reusedFrom': None}
    if key in _path_proof_cache:
        prior = _path_proof_cache[key]
        case['_pathAuditCache'][kind]['reusedFrom'] = prior['case']
        if kind == 'closure':
            case['_springEnvelope'] = prior['springEnvelope']
        return prior['checks']
    checks = verifier(case, by_id)
    _path_proof_cache[key] = {'case': case['id'], 'checks': checks, 'springEnvelope': case.get('_springEnvelope', [])}
    return checks


def nut_and_holder_audit(case, by_id):
    d = case['layout']
    groups = [
        ('case-nut-', d['caseHoles'], ['frame', 'rear-tray']),
        ('holder-clamp-nut-', d['holderClampAxes'], ['holder-clamp-left', 'holder-clamp-right']),
        ('xt-nut-', [[d['xtCentre'][0], d['xtCentre'][1]+s*12.5] for s in [-1, 1]], ['frame']),
        ('panel-nut-', d['panelHoles'], ['panel-clamp-left', 'panel-clamp-right']),
    ]
    for prefix, centres, owners in groups:
        for i, (x, y) in enumerate(centres):
            id = prefix+str(i+1)
            nut = by_id[id]
            owner = Part.makeCompound([by_id[name] for name in owners])
            assert_clear(nut, owner, (case['id'], id, 'nut pocket fit'))
            assert overlap(rotated(nut, x, y, 20), owner) > .01, (case['id'], id, 'pocket does not prevent nut rotation')
            # The screw loads each nut toward the named housing shoulder.
            direction = -1 if prefix == 'holder-clamp-nut-' else 1
            assert overlap(shifted(nut, z=direction*.9), owner) > .01, (case['id'], id, 'nut lacks axial load-bearing shoulder')
    holder = by_id['holder']
    for name in ['holder-clamp-left', 'holder-clamp-right']:
        clamp = by_id[name]
        assert overlap(shifted(holder, z=.2), clamp) > .01, (case['id'], name, 'rail cannot retain purchased holder')
        assert_clear(clamp, holder, (case['id'], name, 'rail cuts into purchased holder at rest'))
    if 'host-panel' in by_id:
        for name in ['panel-clamp-left', 'panel-clamp-right']:
            clamp = by_id[name]
            assert clamp.distToShape(by_id['host-panel'])[0] < 1e-6, (case['id'], name, 'rear panel strip does not seat on host panel')
            assert overlap(shifted(clamp, z=.1), by_id['host-panel']) > .01, (case['id'], name, 'rear panel strip has no bearing land')
    return ['M3 rail, shell and XT nuts plus M4 panel nuts fit anti-rotation pockets with positive axial load shoulders', 'two removable M3 rails retain the unchanged purchased holder; two rear strips clamp the host panel']


def fit_audit(case, by_id):
    d = case['layout']
    checks = []
    retention = []
    manufactured = {definition['id'] for definition in case['pieces'] if definition['supply'] == 'manufactured'}
    ids = list(by_id)
    for i, id in enumerate(ids):
        for other_id in ids[i+1:]:
            pair = {id, other_id}
            # These nominal envelopes describe intentional thread displacement
            # or compressible material. Every exception is restricted to its
            # mating component; it never exempts adjacent case or PCB material.
            intentional = (
                'frame' in pair and any(value.startswith('latch-cover-insert-') for value in pair)
                or 'rear-tray' in pair and any(value.startswith('board-screw-') for value in pair)
                or any(value.startswith('cell-') for value in pair) and any(value.startswith('lid-foam-') for value in pair)
                or 'holder' in pair and any(value.startswith('cell-') for value in pair)
            )
            if intentional:
                continue
            # Avoid source-internal purchased hardware comparisons. The
            # installed source model itself is checked against every fabricated
            # item and the reference panel; hardware fasteners are also checked.
            if id not in manufactured and other_id not in manufactured and not pair.intersection({'host-panel', 'holder', 'power-connector', 'balance-socket'}):
                continue
            assert_clear(by_id[id], by_id[other_id], (case['id'], id, other_id))
    checks.append('no unintended fabricated-to-physical or panel interference; only specified thread/foam engagement exempted')
    frame, tray, board = by_id['frame'], by_id['rear-tray'], by_id['prepared-board']
    assert frame.distToShape(tray)[0] < 1e-6, (case['id'], 'rear tray has no positive shell seat')
    assert overlap(frame, shifted(tray, z=.1)) > .01, (case['id'], 'rear tray can pass through shell datum')
    assert tray.distToShape(board)[0] < 1e-6, (case['id'], 'PCB is not supported')
    assert overlap(tray, shifted(board, z=-.1)) > .01, (case['id'], 'PCB lacks positive standoff seat')
    for x, y in d['balanceSupportAxes']:
        roi = Part.makeCylinder(3.01, 1, App.Vector(x, y, d['boardBottom']-.5))
        assert board.isInside(App.Vector(x, y, d['boardBottom']+.75), 1e-6, False), (case['id'], 'balance header support misses prepared PCB', x, y)
        assert overlap(tray, shifted(board, z=-.1).common(roi)) > .1, (case['id'], 'extra balance connector land does not support PCB', x, y)
    header = by_id['balance-socket']
    assert header.distToShape(board)[0] < 1e-6 and overlap(shifted(header, z=-.05), board) > .01, (case['id'], 'right-angle housing lacks a positive PCB bearing seat')
    for x, y in d['boardReliefs']:
        circular = Part.makeCylinder(4.999, 3.5, App.Vector(x, y, d['boardBottom']-1))
        lead = Part.makeBox(x-d['boardLeft']+.1, 9.998, 3.5, App.Vector(d['boardLeft']-.05, y-4.999, d['boardBottom']-1))
        assert_clear(board, circular, (case['id'], 'PCB clamp post relief', x, y))
        assert_clear(board, lead, (case['id'], 'PCB clamp relief is not open to stock edge', x, y))
    checks.append('rear tray, main PCB, both extra header lands and right-angle housing have positive bearing seats; both left clamp slots open to PCB edge')
    for name, points, diameter, shape, low, high in [
        ('holder solder tails', d['holderPins'], 1.8, board, d['boardBottom'], d['boardTop']),
        ('PCB standoff fasteners', d['boardHoles'], 3.4, board, d['boardBottom'], d['boardTop']),
        ('main-board balance socket tails', d['balancePins'], 1.1, board, d['boardBottom'], d['boardTop']),
    ]:
        for x, y in points:
            probe = Part.makeCylinder(diameter/2-.001, high-low+2, App.Vector(x, y, low-1))
            assert overlap(shape, probe) < 1e-6, (case['id'], name, 'blocked installation-critical drill hole', x, y)
    checks.append('actual FR4 preparation clears every holder tail, fixing screw and 2.54 mm balance contact')
    # Record supplier retention-tab engagement separately. Its exact imported
    # plastic is unmodified, and its elastic fit with a delivered protected
    # cell has not been qualified by this rigid CAD audit. Bound this known
    # source overlap to the outer 0.5 mm skin and local end retention regions;
    # a new deep or central obstruction must still fail.
    holder_scope = native_scope(case['holderCode'])
    plastic = []
    for label, shape in zip(holder_scope['component_labels'], holder_scope['components']):
        if 'spring contact' not in label:
            plastic.append(shifted(shape, z=d['holderZ']))
    assert plastic, (case['id'], 'supplier holder body not identified')
    cells = [(id, shape) for id, shape in by_id.items() if id.startswith('cell-')]
    assert len(cells) == d['cells'], (case['id'], 'wrong number of source-size cell references')
    for id, cell in cells:
        for insulator in plastic:
            common = cell.common(insulator)
            if common.Volume > 1e-5:
                assert common.Volume < 16, (case['id'], id, 'source clip engagement increased', common.Volume)
                row = d['pinRows'][int(id.split('-')[-1])-1]
                inner = Part.makeCylinder(d['cellDiameter']/2-.5, d['cellLength'], App.Vector(-d['cellLength']/2, row, d['cellZ']), App.Vector(1, 0, 0))
                assert overlap(inner, insulator) < 1e-5, (case['id'], id, 'source plastic penetrates deeper than bounded clip skin')
                regions = []
                for solid in common.Solids:
                    bb = solid.BoundBox
                    assert bb.XMax < -13.5 or bb.XMin > 13.5, (case['id'], id, 'source plastic crosses central cell region', bb)
                    regions.append({'volume': solid.Volume, 'min': [bb.XMin, bb.YMin, bb.ZMin], 'max': [bb.XMax, bb.YMax, bb.ZMax]})
                retention.append({'cell': id, 'status': 'KNOWN_UNQUALIFIED_SOURCE_CLIP_ENGAGEMENT', 'volume': common.Volume, 'regions': regions, 'limitation': 'Rigid supplier plastic/reference-cell overlap; verify delivered protected cell fit and elastic retention physically. This is not a zero-clearance purchased-cell fit result.'})
        for raised in [.5, 2, 5, 10, 20, 35]:
            moved = shifted(cell, z=raised)
            for obstruction in (manufactured - {'lid'}) | {'power-connector', 'balance-socket'}:
                assert_clear(moved, by_id[obstruction], (case['id'], id, obstruction, 'vertical cell service path', raised))
    checks.append('source-size protected cells clear every printed enclosure part and have a 35 mm enclosure service lift; source clip engagement reported separately')
    checks += path_audit(case, by_id, 'closure', closure_audit)
    checks += ribbon_audit(case, by_id)
    checks += path_audit(case, by_id, 'mating', mating_audit)
    if 'host-panel' in by_id:
        panel = by_id['host-panel']
        assert frame.distToShape(panel)[0] < 1e-6, (case['id'], 'bezel does not seat on panel top')
        assert overlap(panel, shifted(frame, z=-.1)) > .01, (case['id'], 'bezel does not retain module above cutout')
        for raised in [.1, 5, 20, 45]:
            assert_clear(shifted(frame, z=raised), panel, (case['id'], 'shell insertion through panel opening', raised))
        passage = native_scope(case['panelPassageCode'])['shape']
        assert_clear(passage, panel, (case['id'], 'declared panel passage differs from actual reference cutout'))
        lower_halfspace = Part.makeBox(400, 400, 100, App.Vector(-200, -200, -100))
        for id, shape in by_id.items():
            if id == 'host-panel' or id.startswith('panel-'):
                continue
            lower = shape.common(lower_halfspace)
            outside = lower.cut(passage)
            assert abs(outside.Volume) < 1e-5, (case['id'], id, 'module cannot continuously pass through panel aperture after M4 mounting hardware is removed', outside.Volume, [(solid.Volume, str(solid.BoundBox)) for solid in outside.Solids])
        checks.append('every actual module part below bezel Z0 fits the straight cutout passage, proving continuous vertical removal after M4 panel hardware is removed')
        checks.append('clearance cutout accepts shell while the flat front flange positively seats on host panel')
    # Check that the modeled standard screws span the actual stack and retain
    # their mating nuts/insert rather than ending in an empty clearance bore.
    for i in range(1, 5):
        tie = by_id['case-screw-'+str(i)]
        nut = by_id['case-nut-'+str(i)]
        assert tie.BoundBox.ZMin <= nut.BoundBox.ZMin-.5 and tie.BoundBox.ZMax > 4, (case['id'], 'case tie does not engage captured stack', i)
        rail_screw = by_id['holder-clamp-screw-'+str(i)]
        rail_nut = by_id['holder-clamp-nut-'+str(i)]
        assert rail_screw.BoundBox.ZMax >= rail_nut.BoundBox.ZMax+.5, (case['id'], 'holder screw has insufficient complete thread past nut', i)
        assert abs(rail_screw.BoundBox.ZMin-d['baseBottom']) < 1e-6, (case['id'], 'holder pan head protrudes below rear tray', i)
        panel_screw, panel_nut = by_id['panel-screw-'+str(i)], by_id['panel-nut-'+str(i)]
        assert panel_screw.BoundBox.ZMin <= panel_nut.BoundBox.ZMin-.5, (case['id'], 'panel screw does not protrude through nut', i)
    checks += nut_and_holder_audit(case, by_id)
    checks.append('M3 shell ties and holder rails plus M4 panel nuts have usable standard screw reach')
    return checks, retention


def export_wrapper(case):
    if not case.get('wrapper'):
        return None
    prior = {doc.Name for doc in App.listDocuments().values()}
    scope = native_scope(case['wrapper'])
    doc = scope.get('doc') or App.ActiveDocument
    assert doc is not None, (case['id'], 'wrapper did not create a document')
    features = [obj for obj in doc.Objects if obj.TypeId == 'PartDesign::Feature' or obj.TypeId == 'Part::Feature']
    assert len(features) == len(case['pieces']), (case['id'], 'wrapper feature count', len(features))
    for obj, definition in zip(features, case['pieces']):
        assert obj.Shape.isValid() and obj.Shape.isClosed(), (case['id'], obj.Label, 'wrapper shape')
        assert obj.LibraryId == definition['libraryId'], (case['id'], definition['id'], 'source identity lost in macro')
        assert json.loads(obj.ConfigurationJSON) == definition['parameters'], (case['id'], definition['id'], 'source parameters changed in macro')
        assert obj.Supply == definition['supply'], (case['id'], definition['id'], 'supply classification changed in macro')
        if any(token in definition['id'].split('-') for token in ['screw', 'nut', 'insert', 'washer', 'stop']):
            assert ('M4' if definition['id'].startswith('panel-') else 'M3') in obj.Label, (case['id'], definition['id'], 'wrong fastener family in CAD export')
            assert '2-56' not in obj.Label and 'M2.184' not in obj.Label, (case['id'], definition['id'], 'obsolete holder fastener in CAD export')
    fcstd = output/(case['id']+'.FCStd')
    doc.recompute()
    doc.saveAs(str(fcstd))
    name = doc.Name
    App.closeDocument(name)
    reopened = App.openDocument(str(fcstd))
    reopened_features = [obj for obj in reopened.Objects if obj.TypeId == 'PartDesign::Feature' or obj.TypeId == 'Part::Feature']
    assert len(reopened_features) == len(features), (case['id'], 'FCStd feature round trip')
    manufactured = [obj.Shape for obj, definition in zip(reopened_features, case['pieces']) if definition['supply'] == 'manufactured']
    assert manufactured, (case['id'], 'no manufactured export shapes')
    exported = Part.makeCompound(manufactured)
    _, comparison = canonical_step(exported, output/(case['id']+'.step'))
    App.closeDocument(reopened.Name)
    for doc_name in list(App.listDocuments()):
        if doc_name not in prior:
            App.closeDocument(doc_name)
    return {'fcstd': fcstd.name, 'features': len(features), 'manufacturedSolids': len(exported.Solids), 'step': comparison}


for case in json.loads((output/'cases.json').read_text()):
    if only_ids is not None and case['id'] not in only_ids:
        continue
    scope = native_scope(case['code'])
    by_id = valid_components(case, scope)
    checks = ['valid closed physical components; manufactured details are single solids']
    retention = []
    if case['state'] in ['assembled', 'unlocked', 'open']:
        fit_checks, retention = fit_audit(case, by_id)
        checks += fit_checks
    print_parts = print_audit(case, by_id) if case['state'] == 'print-layout' else []
    if print_parts:
        checks += ['unchanged physical print parts, flat bed faces, separated placement and watertight native STL export']
    exported = export_wrapper(case) if not globals().get('BATTERY_MODULE_SKIP_EXPORT') else None
    mating_reference = {'id': case['matingFixture']['id'], 'codeSHA256': hashlib.sha256(case['matingFixture']['code'].encode()).hexdigest(), 'limitations': case['matingFixture']['limitations']} if case['state'] in ['assembled', 'unlocked', 'open'] else None
    closure_reference = {'codeSHA256': hashlib.sha256(case['closureFixture']['code'].encode()).hexdigest(), 'springCodeSHA256': hashlib.sha256(case['closureFixture']['springCode'].encode()).hexdigest(), 'rigidPoses': len(case['closureFixture']['entries']), 'springPoses': len(case['closureFixture']['springPoses'])} if case['state'] in ['assembled', 'unlocked', 'open'] else None
    record = {'id': case['id'], 'state': case['state'], 'codeSHA256': hashlib.sha256(case['code'].encode()).hexdigest(), 'components': len(by_id), 'checks': checks, 'sourceRetentionEngagement': retention, 'matingReference': mating_reference, 'closureReference': closure_reference, 'springEnvelope': case.get('_springEnvelope', []), 'pathAuditCache': case.get('_pathAuditCache', {}), 'printParts': print_parts, 'export': exported, 'result': 'PASS'}
    report = [item for item in report if item['id'] != case['id']] + [record]
    (output/'validation.json').write_text(json.dumps({'units': 'mm', 'cases': report}, indent=2)+'\n')
    print('PASS', case['id'], len(by_id), 'components', flush=True)
print('Completed', len(report), 'native cases', flush=True)
