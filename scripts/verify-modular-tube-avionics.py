#!/usr/bin/env python3
"""Audit generated native solids and export per-part manufacturing references."""
import json
import hashlib
import math
from pathlib import Path
import sys
import time

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
import MeshPart

output = Path(sys.argv[1] if len(sys.argv) > 1 else 'test-results/modular-tube-avionics').resolve()
fixture = json.loads((output / 'native-input.json').read_text())
report = {'scope': 'Native CAD geometry and manufacturing envelope only; no load, seal, cooling or vibration qualification.', 'fixtureSha256': hashlib.sha256((output / 'native-input.json').read_bytes()).hexdigest(), 'printed': [], 'payload': [], 'references': [], 'interferences': [], 'declaredPreloads': [], 'errors': [], 'issues': fixture['issues']}
expected_prints = {
    str(Path(item['material']) / (item['id'] + suffix))
    for item in fixture['printed'] for suffix in ('.stl', '.step')
} | {
    str(Path('camera-19') / item['material'] / (item['id'] + suffix))
    for item in fixture['alternate'] for suffix in ('.stl', '.step')
}
for stale in (output / 'printed').rglob('*'):
    if stale.suffix in ('.stl', '.step') and str(stale.relative_to(output / 'printed')) not in expected_prints:
        stale.unlink()
doc = App.newDocument('ModularTubeAvionicsAudit')
shapes = []
started = time.time()

def evaluate(item):
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(compile(item['python'], item['id'], 'exec'), scope)
    return scope['shape']

def record(item, shape, kind):
    bb = shape.BoundBox
    row = {'id': item['id'], 'valid': shape.isValid(), 'closed': shape.isClosed(), 'solids': len(shape.Solids), 'faces': len(shape.Faces), 'volume': shape.Volume, 'bounds': [bb.XMin, bb.YMin, bb.ZMin, bb.XMax, bb.YMax, bb.ZMax], 'surfaces': sorted(set(type(face.Surface).__name__ for face in shape.Faces))}
    report[kind].append(row)
    if not row['valid'] or not row['closed'] or shape.Volume <= 0:
        report['errors'].append({'id': item['id'], 'failure': 'Invalid or empty native solid'})
    if item.get('module') != 'template':
        obj = doc.addObject('PartDesign::Feature', 'Item%03d' % len(doc.Objects))
        obj.Label = item['id']; obj.Shape = shape
        obj.addProperty('App::PropertyBool', 'ReferenceOnly', 'ProtoLab identity')
        obj.ReferenceOnly = kind == 'references'
        component = item.get('component', {})
        values = {
            'LibraryId': component.get('libraryId', item.get('libraryId', 'manufactured-detail')),
            'PresetId': component.get('presetId', ''),
            'OccurrenceId': component.get('id', item['id']),
            'ConfigurationJSON': json.dumps(component.get('parameters', {})),
            'InstalledPlacementJSON': json.dumps(component.get('placement', {})),
            'ModelState': component.get('state', 'default'),
            'Supply': component.get('supply', 'manufactured'),
            'ManufacturingJSON': json.dumps(component.get('manufacturing', {})),
            'ProcurementJSON': json.dumps(component.get('procurement', {})),
            'CatalogEvidenceJSON': json.dumps(item.get('catalog', {})),
            'SourceNotes': component.get('notes', ''),
        }
        for key, value in values.items():
            obj.addProperty('App::PropertyString', key, 'ProtoLab identity')
            setattr(obj, key, value)
    return row

def lower_cover_removal(items, moving_ids):
    moving = [(name, shape) for name, shape, _ in items if name in moving_ids]
    fixed = [(name, shape) for name, shape, _ in items if name not in moving_ids]
    result = {'direction': [0, 0, -1], 'travel': 50, 'movingIds': [name for name, _ in moving], 'tubeCertificate': [], 'certifiedIntervals': 0, 'distanceEvaluations': 0, 'failures': [], 'scope': 'Rigid closed radio/lid subassembly; intermodule leads disconnected. No TPU deformation assumed for withdrawal.'}
    window_prism = evaluate(fixture['lowerCoverWindow'])
    outer_tube = Part.makeCylinder(45, 460, App.Vector(-150, 0, 0), App.Vector(1, 0, 0))
    for name, shape in moving:
        outside_xy = shape.cut(window_prism)
        residual = outside_xy.common(outer_tube)
        volume = sum(solid.Volume for solid in residual.Solids) if not residual.isNull() else 0
        certified = volume < 0.01 and shape.BoundBox.ZMax <= -20
        result['tubeCertificate'].append({'id': name, 'outsideWindowInsideOuterTubeVolume': volume, 'maxZ': shape.BoundBox.ZMax, 'certified': certified})
        if not certified: result['failures'].append({'id': name, 'failure': 'Cannot certify lower-window passage by monotonic outward translation'})
    # Outside the XY window all moving material starts outside R45 at Z<0;
    # downward motion monotonically increases its radial distance. Material
    # inside the window remains in its open lower half-space. This covers the
    # complete stroke against the tube, including initial peripheral contact.
    moving_shape = Part.makeCompound([shape for _, shape in moving])
    sweep_bounds = App.BoundBox(moving_shape.BoundBox)
    end_bounds = App.BoundBox(moving_shape.BoundBox)
    end_bounds.ZMin -= 50
    end_bounds.ZMax -= 50
    sweep_bounds.add(end_bounds)
    result['excludedBySweptBounds'] = [name for name, shape in fixed if not sweep_bounds.intersect(shape.BoundBox)]
    fixed = [(name, shape) for name, shape in fixed if sweep_bounds.intersect(shape.BoundBox)]
    result['stationaryCandidates'] = [name for name, _ in fixed]
    fixed_shape = Part.makeCompound([shape for _, shape in fixed])
    pending = [(0.0, 50.0)]
    while pending and not result['failures']:
        low, high = pending.pop()
        midpoint = (low + high) / 2
        shifted = moving_shape.copy(); shifted.translate(App.Vector(0, 0, -midpoint))
        clearance = shifted.distToShape(fixed_shape)[0]
        result['distanceEvaluations'] += 1
        if clearance >= (high - low) / 2 - 1e-7:
            result['certifiedIntervals'] += 1
            continue
        if clearance < 1e-7:
            for name, shape in moving:
                moved = shape.copy(); moved.translate(App.Vector(0, 0, -midpoint))
                for other_name, other in fixed:
                    if not moved.BoundBox.intersect(other.BoundBox): continue
                    common = moved.common(other)
                    volume = sum(solid.Volume for solid in common.Solids) if not common.isNull() else 0
                    if volume > 0.01: result['failures'].append({'moving': name, 'stationary': other_name, 'travel': midpoint, 'volume': volume})
        if result['failures']: break
        if high - low <= 1e-4:
            result['failures'].append({'interval': [low, high], 'clearance': clearance, 'failure': 'Continuous clearance certificate unresolved'})
        else:
            pending.extend([(low, midpoint), (midpoint, high)])
    result['passed'] = not result['failures']
    return result

def retained_tpu_carrier_checks(items):
    """Guard the retained-bed design's real bypasses, feet and removed feathers."""
    carrier = items['nose-pi-carrier']
    tpu = items['nose-pi-cushion']
    frame = items['nose-base-frame']
    result = {'scope': 'Current carrier for the printed 7E3 bed; geometry and direct support only, not material or fatigue qualification.',
              'bypassSections': [], 'removedFeathers': [], 'directSupports': [], 'errors': []}
    for x, ys in [(-156, (-24.5, 24.5)), (-115.9, (-24.5, 24.5)),
                  (-163, (-16, 16)), (-108, (-16, 16)),
                  (-170, (-12, 12)), (-101.5, (-12, 12))]:
        for y in ys:
            edges = carrier.common(Part.makeLine(App.Vector(x, y, -6.1), App.Vector(x, y, -2.9))).Edges
            height = edges[0].Length if len(edges) == 1 else 0
            row = {'x': x, 'y': y, 'continuousSegments': len(edges), 'heightMm': height,
                   'requiredHeightMm': 3, 'passed': len(edges) == 1 and height >= 3 - 1e-6}
            result['bypassSections'].append(row)
            if not row['passed']: result['errors'].append({'failure': 'Missing or thin bypass/end-return section', 'section': row})
    for x in (-171.9, -99.01):
        for y in (-30.6, -18.4, 18.4, 30.6):
            edges = carrier.common(Part.makeLine(App.Vector(x, y, -9), App.Vector(x, y, 0))).Edges
            row = {'x': x, 'y': y, 'passed': not edges, 'remainingEdgeCount': len(edges)}
            result['removedFeathers'].append(row)
            if edges: result['errors'].append({'failure': 'Superseded feather margin remains', 'section': row})
    feet = [(-165, y, 3) for y in (-29, -20, 20, 29)] + [(-107, y, 6) for y in (-29, 29)]
    for x, y, width in feet:
        area = width * 2.4
        def fraction(shape, z):
            probe = Part.makeBox(width, 2.4, 0.01, App.Vector(x - width / 2, y - 1.2, z))
            common = shape.common(probe)
            volume = sum(s.Volume for s in common.Solids) if not common.isNull() else 0
            return volume / (area * 0.01)
        values = {'hardFoot': fraction(carrier, -8.69),
                  'existingTpuFloor': fraction(tpu, -8.61),
                  'printedPetgBacking': fraction(frame, -11.01)}
        row = {'x': x, 'y': y, 'footAreaMm2': area, 'backingFractions': values,
               'passed': all(abs(v - 1) < 1e-5 for v in values.values())}
        result['directSupports'].append(row)
        if not row['passed']: result['errors'].append({'failure': 'Missing foot or incomplete direct backing', 'support': row})
    result['passed'] = not result['errors']
    return result

try:
    for item in fixture['printed']:
        try:
            shape = evaluate(item)
            row = record(item, shape, 'printed')
            if len(shape.Solids) != 1:
                report['errors'].append({'id': item['id'], 'failure': 'Printed detail is not one connected solid', 'solids': len(shape.Solids)})
            if item['module'] in ('flight', 'spool', 'power', 'tail') and item['id'] not in ('grandado-through-cover', 'flight-lower-cover'):
                outside = shape.cut(Part.makeCylinder(42.81, 1000, App.Vector(-400, 0, 0), App.Vector(1, 0, 0)))
                row['outsideInsertionEnvelopeVolume'] = sum(solid.Volume for solid in outside.Solids) if not outside.isNull() else 0
                if row['outsideInsertionEnvelopeVolume'] > 0.01: report['errors'].append({'id': item['id'], 'failure': 'Outside R42.8 insertion envelope with 0.01 mm numerical allowance', 'volume': row['outsideInsertionEnvelopeVolume']})
            if item['id'] in ('grandado-through-cover', 'flight-lower-cover'):
                outer_radius = fixture['coverDatums']['outerRadius']
                outside = shape.cut(Part.makeCylinder(outer_radius + 0.0001, 140, App.Vector(-70, 0, 0), App.Vector(1, 0, 0)))
                row['outsideSmoothCoverVolume'] = sum(solid.Volume for solid in outside.Solids) if not outside.isNull() else 0
                if row['outsideSmoothCoverVolume'] > 0.01: report['errors'].append({'id': item['id'], 'failure': 'External protrusion beyond the authored smooth cover', 'outerRadius': outer_radius, 'volume': row['outsideSmoothCoverVolume']})
            manufacturing = evaluate({**item, 'python': item['manufacturingPython']}) if item.get('manufacturingPython') else shape
            assert manufacturing.isValid() and manufacturing.isClosed() and len(manufacturing.Solids) == 1, 'Invalid manufacturing form'
            volume_error = abs(manufacturing.Volume - shape.Volume)
            if volume_error > max(0.01, shape.Volume * 1e-6):
                report['errors'].append({'id': item['id'], 'failure': 'Installed and manufacturing forms change material volume', 'volumeError': volume_error})
            laid = manufacturing.copy()
            angles = item.get('printRotation', [0, 0, 0])
            rotation = App.Rotation(App.Vector(0, 0, 1), angles[2]).multiply(App.Rotation(App.Vector(0, 1, 0), angles[1])).multiply(App.Rotation(App.Vector(1, 0, 0), angles[0]))
            laid.Placement = App.Placement(App.Vector(), rotation).multiply(laid.Placement)
            bb = laid.BoundBox
            row['printSize'] = [bb.XLength, bb.YLength, bb.ZLength]
            row['fits256'] = max(row['printSize']) <= 256.001
            if not row['fits256']: report['errors'].append({'id': item['id'], 'failure': 'Printer envelope exceeded'})
            laid.translate(App.Vector(-bb.XMin, -bb.YMin, -bb.ZMin))
            target = output / 'printed' / item['material']; target.mkdir(parents=True, exist_ok=True)
            laid.exportStep(str(target / (item['id'] + '.step')))
            MeshPart.meshFromShape(Shape=laid, LinearDeflection=0.15, AngularDeflection=0.25, Relative=False).write(str(target / (item['id'] + '.stl')))
            if item['module'] != 'template': shapes.append((item['id'], shape, 'printed'))
        except Exception as error:
            report['errors'].append({'id': item['id'], 'failure': str(error)})
        (output / 'native-report.json').write_text(json.dumps(report, indent=2) + '\n')
    for item in fixture['payload']:
        try:
            shape = evaluate(item); record(item, shape, 'payload'); shapes.append((item['id'], shape, 'payload'))
        except Exception as error:
            report['errors'].append({'id': item['id'], 'failure': str(error)})
    for item in fixture.get('references', []):
        try:
            shape = evaluate(item); record(item, shape, 'references'); shapes.append((item['id'], shape, 'references'))
        except Exception as error:
            report['errors'].append({'id': item['id'], 'failure': str(error)})
    # Unselected cans are fitting gauges, not physical procurement objects. Inspect
    # their interfaces explicitly, retaining known supplier-proxy fit conflicts.
    cell_shapes = []
    report['cellFittingReferences'] = []
    for item in fixture.get('cellReferences', []):
        try:
            shape = evaluate(item)
            row = record(item, shape, 'references')
            row['genericCellReference'] = True
            cell_shapes.append((item['id'], shape, 'references'))
            analytic = len(shape.Solids) == 1 and len(shape.Faces) == 3 and set(row['surfaces']) == {'Cylinder', 'Plane'}
            report['cellFittingReferences'].append({'id': item['id'], 'analyticCylinder': analytic})
            if not analytic: report['errors'].append({'id': item['id'], 'failure': 'Cell fitting gauge must remain one analytic cylinder'})
        except Exception as error:
            report['errors'].append({'id': item['id'], 'failure': str(error)})
    tube = evaluate(fixture['tube'])
    report['tubeGeometry'] = {'valid': tube.isValid(), 'closed': tube.isClosed(), 'solids': len(tube.Solids), 'faces': len(tube.Faces), 'volume': tube.Volume}
    if not tube.isValid() or len(tube.Solids) != 1:
        report['errors'].append({'failure': 'Cut tube reference must remain a valid single solid'})
    tube.exportStep(str(output / 'cut-tube-reference.step'))
    report['tubeInterferences'] = []
    for name, shape, _ in [*shapes, *cell_shapes]:
        if not tube.BoundBox.intersect(shape.BoundBox): continue
        common = tube.common(shape)
        volume = sum(solid.Volume for solid in common.Solids) if not common.isNull() else 0
        if volume > 0.01: report['tubeInterferences'].append({'id': name, 'volume': volume})
    if report['tubeInterferences']:
        report['errors'].append({'failure': 'Installed physical parts intersect the cut tube', 'details': report['tubeInterferences']})
    side_witness = Part.makeBox(10, 1, 2, App.Vector(-5, 43.5, -1))
    bottom_witness = Part.makeBox(10, 2, 1, App.Vector(-5, -1, -44.5))
    side_stock = tube.common(side_witness).Volume
    bottom_stock = tube.common(bottom_witness).Volume
    report['tubeAccess'] = {'sideWitnessVolume': side_stock, 'sideWitnessExpected': side_witness.Volume, 'bottomWindowWitnessVolume': bottom_stock}
    if abs(side_stock - side_witness.Volume) > 0.01 or bottom_stock > 0.01:
        report['errors'].append({'failure': 'Tube must retain the side wall and open bottom cover access'})
    current_by_id = {item[0]: item[1] for item in shapes}
    report['piCarrierRetainedBedStructure'] = retained_tpu_carrier_checks(current_by_id)
    for error in report['piCarrierRetainedBedStructure']['errors']:
        report['errors'].append({'id': 'nose-pi-carrier', **error})
    # The filled measured exterior is a separate fitting gauge, not replacement
    # supplier geometry. It cannot inspect the cavity occupied by the liner.
    holder_study = fixture['holderFitting']
    report['measuredHolderFit'] = {
        'observations': holder_study['observations'],
        'scope': 'Measured exterior versus the surrounding installed structure, and conservative full-length unbent terminal corridors. This does not reconstruct the purchased holder cavity, contacts, actual base bearing patches or contact stiffness.',
        'completeProductFitVerified': False,
        'gauges': [],
    }
    holder_gauges = []
    for item in holder_study['gauges']:
        gauge = evaluate(item)
        exterior = item['id'] == 'power-holder-measured-envelope'
        omitted = {'power-extra-3s-holder'} | ({'power-holder-cell-liner'} if exterior else set())
        row = {'id': item['id'], 'referenceOnly': True,
               'valid': gauge.isValid() and gauge.isClosed() and len(gauge.Solids) == 1,
               'comparisonExclusions': sorted(omitted), 'intersections': []}
        for name, other, kind in [*shapes, ('cut-tube-reference', tube, 'tube')]:
            if kind == 'references' or name in omitted or not gauge.BoundBox.intersect(other.BoundBox):
                continue
            common = gauge.common(other)
            volume = sum(s.Volume for s in common.Solids)
            if volume > .01:
                row['intersections'].append({'id': name, 'volume': volume})
        row['passed'] = row['valid'] and not row['intersections']
        report['measuredHolderFit']['gauges'].append(row)
        if not row['passed']:
            report['errors'].append({'failure': 'Measured holder fitting reserve is blocked', 'details': row})
        holder_gauges.append(gauge)
    report['measuredHolderFit']['passed'] = len(holder_gauges) == 4 and all(r['passed'] for r in report['measuredHolderFit']['gauges'])
    if len(holder_gauges) != 4:
        report['errors'].append({'failure': 'Measured holder requires one exterior and three terminal fitting reserves'})
    Part.makeCompound(holder_gauges).exportStep(str(output / 'holder-measured-fit-reserves.step'))
    # Inspect the complete installed core, not only fabricated end discs. Covers,
    # fairing and radial screws are fitted after insertion through the tube.
    insertion_skip = {'grandado-through-cover', 'flight-lower-cover', 'nose-shell', 'nose-shell-screw-1', 'nose-shell-screw-2'}
    insertion_envelope = Part.makeCylinder(42.8001, 1000, App.Vector(-400, 0, 0), App.Vector(1, 0, 0))
    report['installedCoreInsertion'] = []
    for name, shape, kind in shapes:
        if kind == 'references' or name in insertion_skip or (name.startswith('tube-anchor-') and not name.startswith('tube-anchor-nut-')): continue
        outside = shape.cut(insertion_envelope)
        volume = sum(solid.Volume for solid in outside.Solids) if not outside.isNull() else 0
        report['installedCoreInsertion'].append({'id': name, 'outsideR42_8Volume': volume})
        if volume > 0.01: report['errors'].append({'id': name, 'failure': 'Installed core cannot pass the specified insertion envelope', 'volume': volume})
    report['cableRoutes'] = []
    route_shapes = []
    for item in fixture['cableRoutes']:
        gauge = evaluate(item)
        row = {'id': item['id'], 'valid': gauge.isValid(), 'closed': gauge.isClosed(), 'solids': len(gauge.Solids), 'volume': gauge.Volume, 'xBounds': [gauge.BoundBox.XMin, gauge.BoundBox.XMax], 'intersections': []}
        for name, other, _ in [*shapes, *cell_shapes, ('cut-tube-reference', tube, 'reference')]:
            if not gauge.BoundBox.intersect(other.BoundBox): continue
            common = gauge.common(other)
            volume = sum(solid.Volume for solid in common.Solids) if not common.isNull() else 0
            if volume > 0.01: row['intersections'].append({'id': name, 'volume': volume})
        row['passed'] = row['valid'] and row['closed'] and row['solids'] == 1 and not row['intersections'] and abs(row['xBounds'][0] + 175) < 1e-4 and abs(row['xBounds'][1] - 262) < 1e-4
        report['cableRoutes'].append(row)
        if not row['passed']: report['errors'].append({'failure': 'Complete Ø6 cable reserve failed', 'details': row})
        route_shapes.append(gauge)
    Part.makeCompound(route_shapes).exportStep(str(output / 'two-d6-cable-reserves.step'))
    report['fittingCouponChecks'] = []
    for item in fixture['fittingCoupons']:
        coupon = evaluate(item)
        clearance = item['keyClearance']
        skin = (12 - 6 - clearance) / 2
        solid_length = coupon.common(Part.makeLine(App.Vector(2, 12, 0), App.Vector(2, 12, 12))).Length
        row = {'keyClearance': clearance, 'valid': coupon.isValid(), 'solids': len(coupon.Solids), 'minimumFloorRoofAndSide': skin, 'nativeVerticalStockLength': solid_length}
        row['passed'] = row['valid'] and row['solids'] == 1 and skin >= 2.7 - 1e-7 and abs(solid_length - 2 * skin) < 1e-5
        report['fittingCouponChecks'].append(row)
        if not row['passed']: report['errors'].append({'failure': 'Fitting coupon wall check failed', 'details': row})
    tail = current_by_id['power-aft-disc']
    report['tailWallChecks'] = {'id': 'power-aft-disc', 'postRadialWalls': [], 'formerJointStock': []}
    for y in [-10, 10]:
        length = tail.common(Part.makeLine(App.Vector(260, y + 1.7, 33), App.Vector(260, y + 4.1, 33))).Length
        report['tailWallChecks']['postRadialWalls'].append(length)
        if abs(length - 2.4) > 1e-5: report['errors'].append({'failure': 'Tail compression post wall is not 2.4 mm', 'y': y, 'length': length})
    for y, z in [(-26, 18), (26, 18), (0, -22)]:
        witness = Part.makeBox(3.6, 6.3, 6.3, App.Vector(250.2, y - 3.15, z - 3.15))
        missing = sum(s.Volume for s in witness.cut(tail).Solids)
        report['tailWallChecks']['formerJointStock'].append({'y': y, 'z': z, 'missingVolume': missing})
        if missing > .001: report['errors'].append({'failure': 'Former tail keys or fitting cavities remain', 'y': y, 'z': z, 'missingVolume': missing})
    if 'tail-baffle' in current_by_id:
        report['errors'].append({'failure': 'Retired separate tail baffle remains installed'})
    artifact_witness = Part.makeBox(3, 0.1, 0.1, App.Vector(-234, 23.9, -0.1))
    current_feather = current_by_id['nose-base-frame'].common(artifact_witness).Volume
    historic_input = output.parent / 'modular-tube-avionics-before-lid-radio-camera-correction' / 'native-input.json'
    before_feather = None
    if historic_input.exists():
        previous = json.loads(historic_input.read_text())
        before = evaluate(next(item for item in previous['printed'] if item['id'] == 'nose-base-frame'))
        before_feather = before.common(artifact_witness).Volume
    report['cameraFeatherRegression'] = {'beforeVolume': before_feather, 'afterVolume': current_feather, 'witnessBounds': [-234, 23.9, -0.1, -231, 24, 0]}
    if current_feather > 1e-5: report['errors'].append({'failure': 'Thin side feather remains in the camera cable opening', 'volume': current_feather})
    report['lowerCoverRemoval'] = lower_cover_removal(shapes, set(fixture['lowerCoverPartIds']))
    if not report['lowerCoverRemoval']['passed']: report['errors'].append({'failure': 'Lower cover/radio withdrawal failed', 'details': report['lowerCoverRemoval']['failures']})
    # Report material penetration for review; intentionally fitted contact still requires judgment.
    observed_contacts = {}
    for i, (first_id, first, first_kind) in enumerate(shapes):
        for second_id, second, second_kind in shapes[i + 1:]:
            if not first.BoundBox.intersect(second.BoundBox): continue
            common = first.common(second)
            volume = sum(solid.Volume for solid in common.Solids) if not common.isNull() else 0
            observed_contacts[frozenset((first_id, second_id))] = volume
            if volume > 0.01:
                pair = {first_id, second_id}
                power_spec = next((spec for spec in fixture.get('powerContacts', []) if set(spec['ids']) == pair and volume <= spec['maximumVolume']), None)
                pi_spec = next((spec for spec in fixture.get('piContacts', []) if set(spec['ids']) == pair and volume <= spec['maximumVolume']), None)
                camera_spec = next((spec for spec in fixture.get('cameraContacts', []) if set(spec['ids']) == pair and volume <= spec['maximumVolume']), None)
                flight_spec = next((spec for spec in fixture.get('flightContacts', []) if set(spec['ids']) == pair and volume <= spec['maximumVolume']), None)
                auxiliary_spec = next((spec for spec in fixture.get('auxiliaryContacts', []) if set(spec['ids']) == pair and volume <= spec['maximumVolume']), None)
                row = {'first': first_id, 'second': second_id, 'volume': volume}
                if power_spec or pi_spec or camera_spec or flight_spec or auxiliary_spec:
                    contact_spec = camera_spec or pi_spec or power_spec or flight_spec or auxiliary_spec
                    report['declaredPreloads'].append({**row, 'nominalCompression': contact_spec['interference'], 'physicalQualification': 'Required; uncompressed TPU geometry shown'})
                else: report['interferences'].append(row)
    report['cellReferenceInterfaces'] = {
        'scope': 'Generic unselected cans. Existing supplier reconstruction/contact overlaps remain unresolved source-fit evidence; only explicitly bounded new TPU contacts are accepted as designed preload.',
        'completeProductFitVerified': False,
        'sourceReferenceOverlaps': [],
        'newPrintedContacts': [],
    }
    for cell_id, cell, _ in cell_shapes:
        own_holder = 'power-ups-3s' if cell_id.startswith('power-ups-') else 'power-extra-3s-holder'
        for other_id, other, _ in shapes:
            if not cell.BoundBox.intersect(other.BoundBox): continue
            # Avoid compound Boolean ambiguity at the supplier's separate contacts.
            volume = sum(cell.common(solid).Volume for solid in other.Solids)
            pair = {cell_id, other_id}
            observed_contacts[frozenset(pair)] = volume
            if volume <= 0.01: continue
            row = {'first': cell_id, 'second': other_id, 'volume': volume}
            if other_id == own_holder:
                report['cellReferenceInterfaces']['sourceReferenceOverlaps'].append(row)
                continue
            spec = next((s for s in fixture.get('powerContacts', []) if set(s['ids']) == pair and volume <= s['maximumVolume']), None)
            if spec:
                report['cellReferenceInterfaces']['newPrintedContacts'].append({**row, 'nominalCompression': spec['interference']})
            else: report['interferences'].append(row)
    report['powerPreloadChecks'] = []
    for spec in fixture.get('powerContacts', []):
        volume = observed_contacts.get(frozenset(spec['ids']), 0)
        passed = spec['expectedVolume'] - 0.02 <= volume <= spec['maximumVolume']
        reference_only = any('-cell-reference-' in name for name in spec['ids'])
        report['powerPreloadChecks'].append({**spec, 'referenceOnly': reference_only, 'volume': volume, 'passed': passed})
        if not passed: report['errors'].append({'failure': 'Power retention contact missing or excessive', 'ids': spec['ids'], 'volume': volume})
    report['cameraPreloadChecks'] = []
    for spec in fixture.get('cameraContacts', []):
        volume = observed_contacts.get(frozenset(spec['ids']), 0)
        passed = spec['expectedVolume'] - 0.02 <= volume <= spec['maximumVolume']
        report['cameraPreloadChecks'].append({**spec, 'volume': volume, 'passed': passed})
        if not passed: report['errors'].append({'failure': 'Camera contact missing or excessive', 'ids': spec['ids'], 'volume': volume})
    report['cameraSupportEngineering'] = fixture.get('cameraSupportEngineering')
    report['flightPreloadChecks'] = []
    expected_flight_pairs = {frozenset(('flight-board-isolator', f'flight-cassette-washer-{i}')) for i in range(1, 5)}
    if {frozenset(spec['ids']) for spec in fixture.get('flightContacts', [])} != expected_flight_pairs or len(fixture.get('flightContacts', [])) != 4:
        report['errors'].append({'failure': 'Exactly four common-isolator clamp preload pairs are required'})
    for spec in fixture.get('flightContacts', []):
        volume = observed_contacts.get(frozenset(spec['ids']), 0)
        passed = spec['expectedVolume'] - 0.02 <= volume <= spec['maximumVolume']
        report['flightPreloadChecks'].append({**spec, 'volume': volume, 'passed': passed})
        if not passed: report['errors'].append({'failure': 'Cassette isolator preload missing or excessive', 'ids': spec['ids'], 'volume': volume})
    report['piPreloadChecks'] = []
    for spec in fixture.get('piContacts', []):
        volume = observed_contacts.get(frozenset(spec['ids']), 0)
        passed = spec['expectedVolume'] - 0.02 <= volume <= spec['maximumVolume']
        report['piPreloadChecks'].append({**spec, 'volume': volume, 'passed': passed})
        if not passed: report['errors'].append({'failure': 'Pi support contact missing or excessive', 'ids': spec['ids'], 'volume': volume})
    report['auxiliaryPreloadChecks'] = []
    auxiliary_specs = fixture.get('auxiliaryContacts', [])
    if auxiliary_specs:
        report['errors'].append({'failure': 'The bolted split auxiliary trays must not retain the retired single-tray TPU preload claim'})
    for spec in auxiliary_specs:
        volume = observed_contacts.get(frozenset(spec['ids']), 0)
        passed = spec['expectedVolume'] - 0.02 <= volume <= spec['maximumVolume']
        report['auxiliaryPreloadChecks'].append({**spec, 'volume': volume, 'passed': passed})
        if not passed: report['errors'].append({'failure': 'Auxiliary retention contact missing or excessive', 'ids': spec['ids'], 'volume': volume})
    report['alternatePrinted'] = []
    for item in fixture['alternate']:
        try:
            shape = evaluate(item)
            if not shape.isValid() or len(shape.Solids) != 1: report['errors'].append({'id': 'camera-19/' + item['id'], 'failure': 'Alternate nose detail invalid or disconnected'})
            manufacturing = evaluate({**item, 'python': item['manufacturingPython']}) if item.get('manufacturingPython') else shape
            assert manufacturing.isValid() and manufacturing.isClosed() and len(manufacturing.Solids) == 1, 'Invalid manufacturing form'
            volume_error = abs(manufacturing.Volume - shape.Volume)
            if volume_error > max(0.01, shape.Volume * 1e-6):
                report['errors'].append({'id': item['id'], 'failure': 'Installed and manufacturing forms change material volume', 'volumeError': volume_error})
            laid = manufacturing.copy()
            angles = item.get('printRotation', [0, 0, 0])
            rotation = App.Rotation(App.Vector(0, 0, 1), angles[2]).multiply(App.Rotation(App.Vector(0, 1, 0), angles[1])).multiply(App.Rotation(App.Vector(1, 0, 0), angles[0]))
            laid.Placement = App.Placement(App.Vector(), rotation).multiply(laid.Placement)
            bb = laid.BoundBox
            report['alternatePrinted'].append({'id': item['id'], 'valid': shape.isValid(), 'solids': len(shape.Solids), 'volume': shape.Volume, 'faces': len(shape.Faces), 'printSize': [bb.XLength, bb.YLength, bb.ZLength]})
            if max(bb.XLength, bb.YLength, bb.ZLength) > 256.001: report['errors'].append({'id': 'camera-19/' + item['id'], 'failure': 'Alternate print exceeds printer envelope'})
            laid.translate(App.Vector(-bb.XMin, -bb.YMin, -bb.ZMin))
            target = output / 'printed' / 'camera-19' / item['material']; target.mkdir(parents=True, exist_ok=True)
            laid.exportStep(str(target / (item['id'] + '.step')))
            MeshPart.meshFromShape(Shape=laid, LinearDeflection=0.15, AngularDeflection=0.25, Relative=False).write(str(target / (item['id'] + '.stl')))
        except Exception as error: report['errors'].append({'id': 'camera-19/' + item['id'], 'failure': str(error)})
    doc.recompute()
    doc.saveAs(str(output / 'assembly.FCStd'))
    physical_objects = [obj for obj in doc.Objects if hasattr(obj, 'Shape') and not obj.ReferenceOnly]
    reference_objects = [obj for obj in doc.Objects if hasattr(obj, 'Shape') and obj.ReferenceOnly]
    Part.export(physical_objects, str(output / 'assembly.step'))
    if reference_objects: Part.export(reference_objects, str(output / 'reference-installation-envelopes.step'))
    round_trip = Part.read(str(output / 'assembly.step'))
    report['stepRoundTrip'] = {'valid': round_trip.isValid(), 'solids': len(round_trip.Solids), 'volume': round_trip.Volume}
    if not round_trip.isValid(): report['errors'].append({'failure': 'STEP round trip invalid'})
    expected_count = len(doc.Objects)
    expected_volume = sum(obj.Shape.Volume for obj in doc.Objects if hasattr(obj, 'Shape'))
    physical_volume = sum(obj.Shape.Volume for obj in physical_objects)
    expected_solids = sum(len(obj.Shape.Solids) for obj in physical_objects)
    report['stepRoundTrip']['sourceVolume'] = physical_volume
    report['stepRoundTrip']['relativeVolumeError'] = abs(round_trip.Volume - physical_volume) / physical_volume
    report['stepRoundTrip']['sourceSolids'] = expected_solids
    if len(round_trip.Solids) != expected_solids or report['stepRoundTrip']['relativeVolumeError'] > 1e-5:
        report['errors'].append({'failure': 'STEP round trip changed solid count or volume beyond 1e-5 relative comparison tolerance'})
    App.closeDocument(doc.Name)
    doc = App.openDocument(str(output / 'assembly.FCStd'))
    restored = [obj.Shape for obj in doc.Objects if hasattr(obj, 'Shape')]
    report['fcstdRoundTrip'] = {'valid': all(shape.isValid() for shape in restored), 'objects': len(doc.Objects), 'volume': sum(shape.Volume for shape in restored)}
    report['fcstdRoundTrip']['physicalObjects'] = sum(not obj.ReferenceOnly for obj in doc.Objects)
    report['fcstdRoundTrip']['referenceObjects'] = sum(obj.ReferenceOnly for obj in doc.Objects)
    report['fcstdRoundTrip']['identityRecords'] = sum(bool(getattr(obj, 'LibraryId', '')) and bool(getattr(obj, 'OccurrenceId', '')) for obj in doc.Objects)
    if report['fcstdRoundTrip']['identityRecords'] != expected_count: report['errors'].append({'failure': 'FCStd identity metadata missing after reload'})
    if not report['fcstdRoundTrip']['valid'] or len(doc.Objects) != expected_count or abs(report['fcstdRoundTrip']['volume'] - expected_volume) > 0.01:
        report['errors'].append({'failure': 'FCStd round trip changed native shapes'})
    report['completed'] = True
finally:
    report['elapsedSeconds'] = time.time() - started
    report['passed'] = report.get('completed', False) and not report['errors'] and not report['interferences']
    (output / 'native-report.json').write_text(json.dumps(report, indent=2) + '\n')
    App.closeDocument(doc.Name)
print(json.dumps({'report': str(output / 'native-report.json'), 'errors': len(report['errors']), 'interferences': len(report['interferences']), 'passed': report['passed']}))
if not report['passed']:
    raise SystemExit(1)
