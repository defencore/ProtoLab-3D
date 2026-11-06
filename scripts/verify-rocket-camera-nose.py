"""Check the camera nose's physical-unit CAD, overlap, STEP and Ethernet access.

First run verify-rocket-camera-nose.ts. Use a FreeCAD-enabled Python runtime.
This is a geometric audit, not structural, electrical or optical qualification.
"""
from datetime import datetime, timezone
from copy import deepcopy
from pathlib import Path
import hashlib
import json
import math
import os
import shutil
import sys
import time
import traceback

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

output = Path(sys.argv[1] if len(sys.argv) > 1 else 'test-results/rocket-camera-nose').resolve()
manifest = json.loads((output / 'cases.json').read_text())
assert manifest['schemaVersion'] == 1 and manifest['units'] == 'mm'
cases = manifest['cases']
if os.environ.get('ROCKET_CAMERA_CASE'):
    cases = [case for case in cases if os.environ['ROCKET_CAMERA_CASE'] in case['name']]
assert cases, 'No native audit cases selected.'
volume_tolerance = manifest['limits']['overlapVolume']
envelope_tolerance = manifest['limits']['envelope']
started = time.perf_counter()
report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'units': 'mm',
    'freecad': '.'.join(App.Version()[:3]),
    'validatorSHA256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'manifestSHA256': hashlib.sha256((output / 'cases.json').read_bytes()).hexdigest(),
    'overlapVolumeTolerance': volume_tolerance,
    'statement': 'Physical purchased units are compared as complete compounds; their internal solids are not treated as independent mating products. Every overlap above the stated tolerance fails without an exemption list.',
    'cases': [],
}
collision_cache = {}
step_cache = {}


def bounds(shape):
    box = shape.optimalBoundingBox(False, False)
    return [box.XMin, box.YMin, box.ZMin], [box.XMax, box.YMax, box.ZMax]


def validate_solid(shape, name, single=False):
    assert not shape.isNull() and shape.isValid() and shape.isClosed(), name + ': invalid/open topology'
    assert shape.Solids and shape.Volume > 0 and math.isfinite(shape.Volume), name + ': no positive solid volume'
    assert all(solid.isClosed() and solid.Volume > 0 for solid in shape.Solids), name + ': invalid constituent solid'
    if single:
        assert len(shape.Solids) == 1, name + ': a manufactured detail must be one connected solid'


def compare_envelope(shape, expected, name):
    low, high = bounds(shape)
    for axis in range(3):
        assert abs(low[axis] - expected['min'][axis]) <= envelope_tolerance, (name, 'minimum', axis, low, expected['min'])
        assert abs(high[axis] - expected['max'][axis]) <= envelope_tolerance, (name, 'maximum', axis, high, expected['max'])
    return low, high


def intersection_box_volume(first, second):
    a, b = first.BoundBox, second.BoundBox
    return math.prod(max(0, min(getattr(a, axis + 'Max'), getattr(b, axis + 'Max')) - max(getattr(a, axis + 'Min'), getattr(b, axis + 'Min'))) for axis in 'XYZ')


def box_distance(first, second):
    a, b = first.BoundBox, second.BoundBox
    return math.sqrt(sum(max(0, getattr(a, axis + 'Min') - getattr(b, axis + 'Max'), getattr(b, axis + 'Min') - getattr(a, axis + 'Max')) ** 2 for axis in 'XYZ'))


def pairwise(units):
    overlaps = []
    minimum = None
    positive = None
    native_common_queries = 0
    native_distance_queries = 0
    for index, (first_id, first) in enumerate(units):
        for second_id, second in units[index + 1:]:
            if intersection_box_volume(first, second) > volume_tolerance:
                common = first.common(second)
                native_common_queries += 1
                assert common.isNull() or common.isValid(), 'Invalid Boolean overlap result: ' + first_id + '/' + second_id
                shared = common.Volume
                assert math.isfinite(shared) and shared >= -1e-8
                if shared > volume_tolerance:
                    overlaps.append({'first': first_id, 'second': second_id, 'volume': shared})
            lower_bound = box_distance(first, second)
            if positive is None or lower_bound <= positive['distance'] + 1e-8:
                distance = first.distToShape(second)[0]
                native_distance_queries += 1
                assert math.isfinite(distance) and distance >= -1e-8
                item = {'first': first_id, 'second': second_id, 'distance': distance}
                if minimum is None or distance < minimum['distance']:
                    minimum = item
                if distance > 1e-6 and (positive is None or distance < positive['distance']):
                    positive = item
    return {
        'pairCount': len(units) * (len(units) - 1) // 2,
        'nativeCommonQueries': native_common_queries,
        'nativeDistanceQueries': native_distance_queries,
        'minimumUnitDistance': minimum,
        'minimumPositiveUnitClearance': positive,
        'overlaps': overlaps,
    }


def _pl_transform(shape, translation, rotation):
    for axis, angle in zip([App.Vector(1, 0, 0), App.Vector(0, 1, 0), App.Vector(0, 0, 1)], rotation):
        if angle:
            shape.rotate(App.Vector(0, 0, 0), axis, angle)
    shape.translate(App.Vector(*translation))
    return shape


def expression_shape(code):
    return eval(code, {'App': App, 'Part': Part, 'math': math, '_pl_transform': _pl_transform})


def cylinder_containment(specification, units):
    free = expression_shape(specification['shapeCode'])
    validate_solid(free, specification['id'])
    lower, upper = bounds(free)
    targets = [(component_id, units[component_id]) for component_id in specification['componentIds']]
    xmin = min([lower[0]] + [target.BoundBox.XMin for _, target in targets]) - 1
    xmax = max([upper[0]] + [target.BoundBox.XMax for _, target in targets]) + 1
    ymin = min([lower[1]] + [target.BoundBox.YMin for _, target in targets]) - 1
    ymax = max([upper[1]] + [target.BoundBox.YMax for _, target in targets]) + 1
    slab = Part.makeBox(xmax - xmin, ymax - ymin, upper[2] - lower[2], App.Vector(xmin, ymin, lower[2]))
    cylinders = [face for face in free.Faces if isinstance(face.Surface, Part.Cylinder)]
    assert len(cylinders) == 1, 'The shoulder fit envelope must have one cylindrical lateral face.'
    lateral_face = cylinders[0]
    checks = []
    for component_id, target in targets:
        clipped = target.common(slab)
        if clipped.isNull() or clipped.Volume <= 1e-8:
            checks.append({'componentId': component_id, 'insideAxialRegion': False, 'outsideVolume': 0, 'radialClearance': None})
            continue
        outside = clipped.cut(free)
        volume = 0 if outside.isNull() else outside.Volume
        assert math.isfinite(volume) and volume >= -1e-8
        distance = clipped.distToShape(lateral_face)[0]
        assert math.isfinite(distance) and distance >= -1e-8
        checks.append({'componentId': component_id, 'insideAxialRegion': True, 'outsideVolume': volume, 'radialClearance': distance})
    radial = [check for check in checks if check['radialClearance'] is not None]
    return {
        'id': specification['id'],
        'radius': lateral_face.Surface.Radius,
        'zRange': [lower[2], upper[2]],
        'minimumRadialClearance': min(radial, key=lambda check: check['radialClearance']) if radial else None,
        'checks': checks,
    }


def save_report():
    report['elapsedSeconds'] = time.perf_counter() - started
    report['passed'] = sum(case['status'] == 'passed' for case in report['cases'])
    report['failed'] = sum(case['status'] != 'passed' for case in report['cases'])
    (output / 'native-report.json').write_text(json.dumps(report, indent=2) + '\n')


def step_material_parity(original, restored):
    """Distinguish OCC volume-integration drift from changed material geometry.

    STEP may split/reparameterize trimmed surfaces. If their integrated volumes
    differ, require both exact Boolean material differences to be empty within
    the same material-volume tolerance used for unit collision checks.
    """
    difference = abs(restored.Volume - original.Volume)
    result = {'integratedVolumeDifference': difference}
    if difference > max(0.001, original.Volume * 1e-7):
        # Pair solids by their unchanged bounding envelopes. Avoid a compound-wide
        # Boolean: source purchased products intentionally contain touching solids.
        unmatched = list(restored.Solids)
        volumes = [0.0, 0.0]
        for solid in original.Solids:
            low, high = bounds(solid)
            def score(candidate):
                other_low, other_high = bounds(candidate)
                return max(abs(a-b) for a,b in zip(low+high, other_low+other_high))
            candidate = min(unmatched, key=score)
            assert score(candidate) <= envelope_tolerance, 'STEP changed a constituent solid envelope.'
            unmatched.remove(candidate)
            missing, added = solid.cut(candidate), candidate.cut(solid)
            assert all(shape.isNull() or shape.isValid() for shape in (missing, added)), 'Invalid STEP material-difference Boolean.'
            volumes = [total + (0.0 if shape.isNull() else abs(shape.Volume)) for total, shape in zip(volumes, (missing, added))]
        assert not unmatched, 'STEP changed the constituent solid count.'
        result['constituentSolidsChecked'] = len(original.Solids)
        result['missingMaterialVolume'], result['addedMaterialVolume'] = volumes
        assert sum(volumes) <= volume_tolerance, 'STEP changed material geometry: ' + json.dumps(result)
    return result


def required_contacts(specifications, units):
    result = []
    for specification in specifications:
        a, b = units[specification['first']], units[specification['second']]
        plane = specification['z']
        face_areas = []
        for shape in [a, b]:
            selected = [face for face in shape.Faces if face.BoundBox.ZLength < 1e-5 and abs(face.BoundBox.ZMin - plane) < 1e-5]
            assert selected, 'Missing support plane: ' + str(specification)
            face_areas.append(sum(face.Area for face in selected))
        distance = a.distToShape(b)[0]
        initial = a.common(b)
        initial_overlap = 0 if initial.isNull() else initial.Volume
        assert distance < 1e-5 and initial_overlap <= 1e-4, ('Window backing contact', specification, distance, initial_overlap)
        # OCC can omit a coincident face in a zero-volume Common. Measure the
        # shared planar bearing area from two independent virtual normal strokes.
        # These copies are diagnostic probes; the assembled CAD is unchanged.
        samples = []
        for stroke in [0.01, 0.005]:
            moved = b.copy()
            moved.translate(App.Vector(0, 0, -stroke))
            common = a.common(moved)
            volume = 0 if common.isNull() else common.Volume
            samples.append({'virtualStroke': stroke, 'overlapVolume': volume, 'area': volume / stroke})
        area = min(sample['area'] for sample in samples)
        assert abs(samples[0]['area'] - samples[1]['area']) < max(0.02, area * 0.001), ('Unstable contact-area measurement', specification, samples)
        assert area >= specification['minimumArea'] and min(face_areas) >= specification['minimumArea'], ('Insufficient window bearing area', specification, area, face_areas)
        result.append({**specification, 'distance': distance, 'initialOverlap': initial_overlap, 'contactArea': area, 'planarFaceAreas': face_areas, 'measurementSamples': samples})
    return result


def window_dog_check(units):
    ring = units['window-retainer']
    released = ring.copy()
    released.translate(App.Vector(0, 0, -0.8))
    frame_overlap = released.common(units['load-frame']).Volume
    assert frame_overlap > 100, 'The cassette must positively block the ring release stroke.'
    turned = ring.copy()
    turned.rotate(App.Vector(0, 0, 0), App.Vector(0, 0, 1), -10)
    locked_overlap = turned.common(units['nose-shell']).Volume
    assert locked_overlap > 1, 'The window dogs must block rotation before rear release.'
    service = released.copy()
    service.rotate(App.Vector(0, 0, 0), App.Vector(0, 0, 1), -10)
    service_overlap = service.common(units['nose-shell']).Volume
    assert service_overlap <= 1e-4, 'Released ring must turn without cutting housing material.'
    return {'releaseTravel': 0.8, 'frameBlockedVolume': frame_overlap, 'lockedRotationBlockedVolume': locked_overlap, 'releasedRotationOverlap': service_overlap, 'scope': 'Nominal geometry only; printed fits and loads need qualification.'}


def export_print_detail(case, source, component_id):
    """Export a validated printed detail, with its lowest face at print Z=0."""
    import Mesh
    import MeshPart

    folder = Path(os.environ.get('ROCKET_CAMERA_PRINT_DIR', str(output / 'print'))).resolve()
    folder.mkdir(parents=True, exist_ok=True)
    shape = source.copy(True, False)
    flat_ids = {'pi-cradle', 'ups-cradle', 'ups-cell-cover', 'camera-screw-lock-left', 'camera-screw-lock-right'}
    rotation = case.get('printedRotations', {}).get(component_id, [0, 90, 0] if component_id in flat_ids else [0, 0, 0])
    for axis, angle in zip([App.Vector(1, 0, 0), App.Vector(0, 1, 0), App.Vector(0, 0, 1)], rotation):
        if angle:
            shape.rotate(App.Vector(0, 0, 0), axis, angle)
    translation = [0, 0, -bounds(shape)[0][2]]
    shape.translate(App.Vector(*translation))
    validate_solid(shape, component_id + ' print export', single=True)
    native_low, native_high = bounds(shape)
    suffix = 'carrier' if component_id == 'tpu-carrier' else component_id
    stem = 'rocket-camera-nose-' + case['presetId'] + '-' + suffix
    step = folder / (stem + '.step')
    stl = folder / (stem + '.stl')
    fcstd = folder / (stem + '.FCStd')
    shape.exportStep(str(step))
    restored = Part.Shape()
    restored.read(str(step))
    validate_solid(restored, component_id + ' STEP reload', single=True)
    compare_envelope(restored, {'min': native_low, 'max': native_high}, component_id + ' STEP reload')
    parity = step_material_parity(shape, restored)
    # The curved web/hoop junctions need finer tessellation to share closed edges.
    linear, angular = (0.002, 0.015) if component_id == 'load-frame' else (0.05, 0.08)
    mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=linear, AngularDeflection=angular, Relative=False)
    assert mesh.isSolid() and mesh.Volume > 0, 'The printable detail mesh must be closed with positive volume.'
    mesh.write(str(stl))
    reloaded = Mesh.Mesh(str(stl))
    assert reloaded.isSolid() and reloaded.Volume > 0, 'The saved STL must be closed with positive volume.'
    mesh_bounds = reloaded.BoundBox
    for index, axis in enumerate('XYZ'):
        assert abs(getattr(mesh_bounds, axis + 'Min') - native_low[index]) <= 0.06
        assert abs(getattr(mesh_bounds, axis + 'Max') - native_high[index]) <= 0.06
    assert abs(reloaded.Volume - shape.Volume) / shape.Volume <= 0.01, 'STL volume differs from native detail by more than 1%.'
    printing = App.newDocument('RocketCameraDetailPrint')
    try:
        feature = printing.addObject('PartDesign::Feature', 'PrintedDetail')
        feature.Label = component_id + ' · provisional print orientation'
        feature.Shape = shape
        feature.addProperty('App::PropertyString', 'SourceCase').SourceCase = case['name']
        feature.addProperty('App::PropertyString', 'SourceMacroSHA256').SourceMacroSHA256 = case['macroSHA256']
        feature.addProperty('App::PropertyString', 'PrintOrientation').PrintOrientation = 'Each detail uses its declared provisional printing rotation and has its lowest face translated to Z=0. Qualify orientation, supports and material before use.'
        printing.recompute()
        printing.saveAs(str(fcstd))
    finally:
        App.closeDocument(printing.Name)
    record = {'files': [str(step), str(stl), str(fcstd)], 'componentId': component_id, 'translation': translation, 'rotation': rotation, 'orientation': 'Declared provisional printing rotation; lowest native Z is translated to 0. Supports, layers and material require selection in the slicer.', 'solidCount': len(shape.Solids), 'min': native_low, 'max': native_high, 'nativeVolume': shape.Volume, 'stlVolume': reloaded.Volume, 'stlClosed': reloaded.isSolid(), 'triangleCount': reloaded.CountFacets, 'linearDeflection': linear, 'angularDeflection': angular, 'sourceMacroSHA256': case['macroSHA256'], 'stepMaterialParity': parity}
    (folder / (stem + '-print-report.json')).write_text(json.dumps(record, indent=2) + '\n')
    return record


for case in cases:
    case_started = time.perf_counter()
    result = {'name': case['name'], 'id': case['id'], 'presetId': case['presetId'], 'state': case['state'], 'macroSHA256': case['macroSHA256'], 'status': 'running'}
    if 'csiCablePlan' in case:
        result['csiCablePlan'] = case['csiCablePlan']
    doc = App.newDocument('RocketCameraAudit')
    try:
        macro = (output / case['macroFile']).read_text()
        assert hashlib.sha256(macro.encode()).hexdigest() == case['macroSHA256'], 'The prepared macro changed.'
        sentinel = doc.addObject('App::FeaturePython', 'ExistingObject')
        exec(compile(macro, case['macroFile'], 'exec'), {})
        roots = [obj for obj in doc.RootObjects if obj != sentinel]
        assert len(roots) == 1, 'Macro must preserve the pre-existing document object and create one root.'
        root = roots[0]
        assert root.PartId == case['id'] and root.ModelState == case['state']
        assert json.loads(root.Configuration) == case['parameters']
        features = sorted([obj for obj in doc.Objects if obj.TypeId == 'Part::Feature' and hasattr(obj, 'Shape')], key=lambda obj: getattr(obj, 'ComponentIndex', 1))
        assert features, 'The macro created no physical features.'
        for feature in features:
            validate_solid(feature.Shape, feature.Label)
        aggregate = Part.makeCompound([feature.Shape for feature in features])
        low, high = compare_envelope(aggregate, case, case['name'])
        actual_dimensions = [high[axis] - low[axis] for axis in range(3)]
        assert all(abs(actual - expected) <= envelope_tolerance for actual, expected in zip(actual_dimensions, case['declaredDimensions'])), 'Declared native envelope mismatch.'
        result.update({'featureCount': len(features), 'solidCount': len(aggregate.Solids), 'volume': aggregate.Volume, 'min': low, 'max': high, 'dimensions': actual_dimensions})
        if case['kind'] == 'assembly':
            assert len(features) == len(case['components']), 'Physical occurrence/native feature counts differ.'
            units = []
            component_results = []
            for feature, expected in zip(features, case['components']):
                assert feature.LibraryId == expected['libraryId'], (feature.Label, 'library ID', feature.LibraryId, expected['libraryId'])
                assert json.loads(feature.ConfigurationJSON) == expected['parameters'], (feature.Label, 'library parameters')
                assert feature.Supply == expected['supply'], (feature.Label, 'supply policy')
                validate_solid(feature.Shape, expected['id'], expected['supply'] == 'manufactured')
                minimum, maximum = compare_envelope(feature.Shape, expected, expected['id'])
                component_results.append({'id': expected['id'], 'libraryId': expected['libraryId'], 'supply': expected['supply'], 'solidCount': len(feature.Shape.Solids), 'volume': feature.Shape.Volume, 'min': minimum, 'max': maximum})
                units.append((expected['id'], feature.Shape))
            result['components'] = component_results
            result['libraryUnitCounts'] = {
                library_id: sum(component['libraryId'] == library_id for component in component_results)
                for library_id in sorted({component['libraryId'] for component in component_results})
            }
            result['manufacturedUnitCount'] = sum(component['supply'] == 'manufactured' for component in component_results)
            signature = hashlib.sha256(json.dumps({
                'validatorSHA256': report['validatorSHA256'],
                'orderedUnits': [(component_id, hashlib.sha256(shape.exportBrepToString().encode()).hexdigest()) for component_id, shape in units],
            }, separators=(',', ':')).encode()).hexdigest()
            result['nativePhysicalGeometrySHA256'] = signature
            if signature in collision_cache:
                cached = collision_cache[signature]
                result['physicalUnitCollisions'] = deepcopy(cached['result'])
                result['physicalUnitCollisions']['reusedFromByteIdenticalGeometry'] = cached['name']
            else:
                result['physicalUnitCollisions'] = pairwise(units)
                collision_cache[signature] = {'name': case['name'], 'result': deepcopy(result['physicalUnitCollisions'])}
            assert not result['physicalUnitCollisions']['overlaps'], 'Physical units overlap: ' + json.dumps(result['physicalUnitCollisions']['overlaps'])
            by_unit_id = dict(units)
            result['keepouts'] = []
            for keepout in case['keepouts']:
                shape = expression_shape(keepout['shapeCode'])
                validate_solid(shape, keepout['id'])
                checked = []
                for component_id in keepout['componentIds']:
                    target = by_unit_id[component_id]
                    common = shape.common(target)
                    shared = 0 if common.isNull() else common.Volume
                    assert math.isfinite(shared) and shared >= -1e-8
                    checked.append({'componentId': component_id, 'volume': shared, 'distance': shape.distToShape(target)[0]})
                result['keepouts'].append({'id': keepout['id'], 'checks': checked})
            result['containment'] = [cylinder_containment(specification, by_unit_id) for specification in case['containment']]
            result['requiredContacts'] = required_contacts(case.get('requiredContacts', []), by_unit_id)
            if case.get('windowDogCheck'):
                result['windowDogLock'] = window_dog_check(by_unit_id)
        elif case['manufactured']:
            validate_solid(aggregate, case['name'], single=True)
        step_file = output / (case['name'] + '.step')
        exact_geometry = hashlib.sha256(aggregate.exportBrepToString().encode()).hexdigest()
        cached_step = step_cache.get(exact_geometry)
        if cached_step is None:
            aggregate.exportStep(str(step_file))
            restored = Part.Shape()
            restored.read(str(step_file))
            validate_solid(restored, case['name'] + ' STEP reload')
            assert len(restored.Solids) == len(aggregate.Solids), 'STEP changed the solid count.'
            parity = step_material_parity(aggregate, restored)
            step_cache[exact_geometry] = {
                'file': step_file,
                'sha256': hashlib.sha256(step_file.read_bytes()).hexdigest(),
                'shape': restored.copy(True, False),
                'parity': deepcopy(parity),
                'case': case['name'],
            }
        else:
            assert hashlib.sha256(cached_step['file'].read_bytes()).hexdigest() == cached_step['sha256'], 'Validated STEP bytes changed.'
            shutil.copyfile(cached_step['file'], step_file)
            assert hashlib.sha256(step_file.read_bytes()).hexdigest() == cached_step['sha256'], 'STEP copy changed.'
            restored = cached_step['shape'].copy(True, False)
            parity = deepcopy(cached_step['parity'])
        compare_envelope(restored, case, case['name'] + ' STEP reload')
        result['stepRoundTrip'] = {'file': step_file.name, 'solidCount': len(restored.Solids), 'volumeDifference': abs(restored.Volume - aggregate.Volume), 'materialParity': parity}
        if cached_step is not None:
            result['stepRoundTrip'].update({'reusedFromByteIdenticalNativeGeometry': cached_step['case'], 'nativeBRepSHA256': exact_geometry, 'stepSHA256': cached_step['sha256']})
        if case['kind'] == 'assembly':
            for keepout in result['keepouts']:
                assert all(check['volume'] <= volume_tolerance for check in keepout['checks']), 'Routing/service keepout intersects physical structure: ' + json.dumps(keepout)
            for fit in result['containment']:
                assert all(check['outsideVolume'] <= volume_tolerance for check in fit['checks']), 'Cassette material extends outside the shoulder free cylinder: ' + json.dumps(fit)
            if case['parameters'].get('packaging') == 'tpu-compact' and case['state'] == 'assembled':
                assert 'tpu-carrier' in by_unit_id, 'The one-piece print carrier must be an explicit physical occurrence.'
                result['carrierPrint'] = export_print_detail(case, by_unit_id['tpu-carrier'], 'tpu-carrier')
            if case['parameters'].get('packaging') == 'structural-ogive' and case['state'] == 'assembled':
                printed_ids = [component['id'] for component in case['components'] if 'printing' in component.get('manufacturing', {}).get('processes', [])]
                result['printedDetails'] = [export_print_detail(case, by_unit_id[component_id], component_id) for component_id in printed_ids]
        result['status'] = 'passed'
    except Exception as error:
        result['status'] = 'failed'
        result['error'] = str(error)
        result['traceback'] = traceback.format_exc()
    finally:
        App.closeDocument(doc.Name)
        result['elapsedSeconds'] = time.perf_counter() - case_started
        report['cases'].append(result)
        save_report()
        print(result['status'].upper() + ' ' + case['name'] + (' ' + result.get('error', '') if result['status'] != 'passed' else ''), flush=True)

print('Native audit: %d passed, %d failed in %.2f seconds.' % (report['passed'], report['failed'], report['elapsedSeconds']), flush=True)
sys.exit(1 if report['failed'] else 0)
