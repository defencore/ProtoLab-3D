"""Independent native checks for seven measured side mounts.

Finite local 4 mm wall coupons and their explicitly drilled ports represent the
authorized attachment stack. They do not infer unseen case ribs or a load/IP
rating, and never extend the permitted cavity for unrelated components.
"""
import itertools
import math

import FreeCAD as App
import Part


def box(bounds):
    return Part.makeBox(
        *(bounds['max'][i] - bounds['min'][i] for i in range(3)),
        App.Vector(*bounds['min']),
    )


def unit(values):
    vector = App.Vector(*values)
    assert abs(vector.Length - 1) < 1e-6, ('non-unit fixture direction', values)
    return vector


def local_box(bounds, frame):
    return place_shape(box(bounds), frame)


def place_shape(shape, frame):
    for axis, angle in zip(
        [App.Vector(1, 0, 0), App.Vector(0, 1, 0), App.Vector(0, 0, 1)],
        frame['rotation'],
    ):
        if angle:
            shape.rotate(App.Vector(0, 0, 0), axis, angle)
    shape.translate(App.Vector(*frame['at']))
    return shape


def axial_cylinder(radius, minimum, maximum, frame):
    assert radius > 0 and maximum > minimum
    return place_shape(Part.makeCylinder(
        radius, maximum - minimum, App.Vector(minimum, 0, 0), App.Vector(1, 0, 0),
    ), frame)


def external_hardware_regions(mounting):
    """Bounded, per-ID permissions for the declared exterior stack only."""
    assert mounting['expectedMountCount'] == len(mounting['mounts']) == 7
    assert mounting['caseWallThicknessMm'] == 4 and mounting['exteriorScrewsIncluded']
    regions = {}
    for row in mounting['mounts']:
        ids, stack, frame = row['hardwareIds'], row['screwStack'], row['frame']
        assert ids['nut'] == row['nutId']
        assert stack['lengthMm'] == 11
        assert abs(stack['underHeadLocalX'] + 5.3) < 1e-8
        assert abs(stack['tipLocalX'] - (stack['underHeadLocalX'] + stack['lengthMm'])) < 1e-8
        assert stack['headSizeMm'] == 5.5 and stack['headHeightMm'] == 3
        head = axial_cylinder(stack['headSizeMm'] / 2,
                              stack['underHeadLocalX'] - stack['headHeightMm'],
                              stack['underHeadLocalX'], frame)
        shank = axial_cylinder(row['nutSize']['boreMm'] / 2,
                               stack['underHeadLocalX'], stack['tipLocalX'], frame)
        regions[ids['screw']] = {'shape': head.fuse(shank), 'mountId': row['id'], 'role': 'screw'}
        assert {entry['id'] for entry in row['outerStack']} == {ids['washer'], ids['seal']}
        for entry in row['outerStack']:
            role = 'washer' if entry['id'] == ids['washer'] else 'seal'
            expected = {'washer': (-5.3, -4.8, 7, 3.2), 'seal': (-4.8, -4, 10, 3.2)}[role]
            actual = tuple(entry[key] for key in ['minLocalX', 'maxLocalX', 'outerDiameterMm', 'innerDiameterMm'])
            assert all(abs(a-b) < 1e-8 for a, b in zip(actual, expected)), (row['id'], role, actual)
            annulus = axial_cylinder(entry['outerDiameterMm'] / 2,
                                      entry['minLocalX'], entry['maxLocalX'], frame)
            bore = axial_cylinder(entry['innerDiameterMm'] / 2,
                                   entry['minLocalX'] - .01, entry['maxLocalX'] + .01, frame)
            regions[entry['id']] = {'shape': annulus.cut(bore), 'mountId': row['id'], 'role': role}
    assert len(regions) == 21, 'Exterior hardware IDs must be unique across all seven mounts'
    assert all(row['shape'].isValid() and row['shape'].isClosed() for row in regions.values())
    return regions


def hex_socket(row):
    x, y = row['centre']
    origin = App.Vector(x, y, row['minZ'])
    length = row['maxZ'] - row['minZ']
    outer = Part.makeCylinder(row['radius'], length, origin)
    radius = row['innerAcrossFlatsMm'] / math.sqrt(3)
    points = [
        App.Vector(
            x + radius * math.cos(math.radians(row['innerHexClockDegrees'] + angle)),
            y + radius * math.sin(math.radians(row['innerHexClockDegrees'] + angle)),
            row['minZ'] - .01,
        ) for angle in range(0, 360, 60)
    ]
    inner = Part.Face(Part.Wire(Part.makePolygon(points + points[:1]).Edges))
    return outer.cut(inner.extrude(App.Vector(0, 0, length + .02)))


def projected_minimum(bounds, point, direction):
    return min(
        (App.Vector(*corner) - point).dot(direction)
        for corner in itertools.product(
            [bounds.XMin, bounds.XMax],
            [bounds.YMin, bounds.YMax],
            [bounds.ZMin, bounds.ZMax],
        )
    )


def convex_hull(points):
    points = sorted(set(points))

    def cross(origin, first, second):
        return ((first[0] - origin[0]) * (second[1] - origin[1])
                - (first[1] - origin[1]) * (second[0] - origin[0]))

    lower, upper = [], []
    for point in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    for point in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


def nut_outline(row):
    radius = row['nutSize']['acrossFlatsMm'] / math.sqrt(3)
    return [(radius * math.cos(math.radians(angle + 30)),
             radius * math.sin(math.radians(angle + 30)))
            for angle in range(0, 360, 60)]


def native_hex_polygon(row, points):
    vertices = [App.Vector(x, y, 0) for x, y in points]
    shape = Part.Face(Part.Wire(Part.makePolygon(vertices + vertices[:1]).Edges))
    shape = shape.extrude(App.Vector(0, 0, row['nutSize']['thicknessMm']))
    shape = place_shape(shape, row['nutPlacement'])
    assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1
    return shape


def native_direction(row, values):
    direction = App.Vector(*values)
    for axis, angle in zip(
        [App.Vector(1, 0, 0), App.Vector(0, 1, 0), App.Vector(0, 0, 1)],
        row['nutPlacement']['rotation'],
    ):
        direction = App.Rotation(axis, angle).multVec(direction)
    return direction


def planar_nut_envelopes(row):
    """Conservative filled hex and exact planar Minkowski slide sweep."""
    direction = native_direction(row, [0, 1, 0])
    outward = unit(row['insertion']['outward'])
    assert (direction - outward).Length < 1e-7, 'nut sweep frame direction differs'
    distance = App.Vector(*row['insertion']['translation']).Length
    assert (direction * distance - App.Vector(*row['insertion']['translation'])).Length < 1e-7
    points = nut_outline(row)
    return (native_hex_polygon(row, points),
            native_hex_polygon(row, convex_hull(points + [(x, y + distance) for x, y in points])))


def audit_loading_well(row, records, shapes, nut, overlap, removed_exterior_ids, brass_service_ids):
    """Continuous first leg from below the actual well mouth, before body assembly."""
    data = row['insertion']['loadingWell']
    direction = native_direction(row, [1, 0, 0])
    outward, translation = unit(data['outward']), App.Vector(*data['translation'])
    assert (direction-outward).Length < 1e-7, 'loading leg does not follow native +X / frame -W'
    distance = translation.Length
    assert (direction*distance-translation).Length < 1e-7, 'loading leg has the wrong sign or length'
    tangent = App.Vector(*row['insertion']['translation'])
    tangent_distance = tangent.Length
    points = [(x, y+tangent_distance) for x, y in nut_outline(row)]
    sweep = native_hex_polygon(row, convex_hull(points + [(x+distance, y) for x, y in points]))
    start = nut.copy()
    start.translate(tangent+translation)
    start_gap = projected_minimum(start.BoundBox, App.Vector(*data['bottomMouth']), outward)
    removed = set(data['removedIds']) | removed_exterior_ids
    assert removed <= {record['id'] for record in records}
    assert 'parallel-base' not in removed
    detachable = {
        record['id'] for record in records
        if record['id'] in {'case-lower-body','case-lower-cradle','case-pwm-backing'}
        or record['id'].startswith('case-electronics-')
        or record['id'] in brass_service_ids
        or record['id'] in {'case-lid-screw-'+str(i) for i in range(1, 5)}
        or record['id'] in {
            'case-servo-driver-hat', 'case-heltec-v4', 'case-adc-cjmcu1220',
            'case-buck-1', 'case-buck-2', 'case-lc-filter-1', 'case-lc-filter-2',
            'case-test-clip-carrier', 'case-test-clip-red', 'case-test-clip-black',
            'case-pwm-mosfet', 'case-pwm-keeper',
        }
    }
    assert set(data['removedIds']) <= detachable, 'Loading step removes a retained upper component'
    violations = []
    start_host_overlap = 0
    for record, target in zip(records, shapes):
        if record['id'] == row['nutId'] or record['id'] in removed:
            continue
        if record['id'] == 'parallel-base':
            start_host_overlap = abs(overlap(start, target))
        volume = abs(overlap(sweep, target))
        if volume > .001:
            violations.append({'target': record['id'], 'overlapMm3': volume})
    passed = (not violations and start_host_overlap < .001
              and start_gap >= data['minimumStartGapMm'])
    return {'passed': passed, 'method': 'Conservative filled outer-hex planar Minkowski prism',
            'transformedNativeXMatchesOutward': True,
            'sweptEnvelopeVolumeMm3': sweep.Volume,
            'actualStartHostOverlapMm3': start_host_overlap,
            'wholeNutBeyondWellMouthGapMm': start_gap,
            'minimumStartGapMm': data['minimumStartGapMm'],
            'bottomMouth': data['bottomMouth'], 'outward': data['outward'],
            'translation': data['translation'], 'removedIds': sorted(removed),
            'violations': violations,
            'sequence': 'With the lower body and declared attachments absent, lift the nut from below the loading well, then slide it tangentially into the captive pocket. Exterior screws are installed after the insert enters the case.'}


def audit_exterior_stack(row, records, by_id, overlap, permissions, working_fit, working_ring_fit):
    frame, port, stack = row['frame'], row['wallPort'], row['screwStack']
    assert port['normalThicknessMm'] == 4 and port['diameterMm'] == 3.4
    assert port['couponHalfWidthMm'] >= 8
    half = port['couponHalfWidthMm']
    coupon = local_box({'min': [-4, -half, -half], 'max': [0, half, half]}, frame)
    drilled_port = axial_cylinder(port['diameterMm'] / 2, -4.01, .01, frame)
    residual_wall = coupon.cut(drilled_port)
    assert residual_wall.isValid() and residual_wall.isClosed() and len(residual_wall.Solids) == 1
    ids = row['hardwareIds']
    axis, origin = unit(row['inwardAxis']), App.Vector(*frame['at'])
    screw, nut, washer, seal = [by_id[ids[role]] for role in ['screw', 'nut', 'washer', 'seal']]
    violations = []
    wall_hits = []
    nominal_panel_hits = []
    nominal_ring_hits = []
    fit_contract, fit_region = working_fit
    ring_contract, ring_regions = working_ring_fit
    # These coupons retain the former nominal wall reference. The later
    # plate trial does not locate a real wall transition through this band.
    for record in records:
        volume = abs(overlap(by_id[record['id']], residual_wall))
        if volume > .001 and record['id'] == fit_contract['componentId']:
            nominal_common = by_id[record['id']].common(residual_wall)
            assert not nominal_common.isNull() and nominal_common.isValid()
            residual = nominal_common.cut(fit_region)
            residual_volume = 0 if residual.isNull() else abs(residual.Volume)
            nominal_panel_hits.append({
                'id': record['id'], 'status': 'previous-nominal-reference-mismatch',
                'previousNominalOutsideVolume': volume,
                'residualOutsideWorkingRegion': residual_volume,
                'volumeUnit': 'mm3', 'passed': residual_volume < .001,
            })
            volume = residual_volume
        if volume > .001 and record['id']in ring_regions:
            nominal_common=by_id[record['id']].common(residual_wall)
            assert not nominal_common.isNull()and nominal_common.isValid()
            residual=nominal_common.cut(ring_regions[record['id']])
            residual_volume=0 if residual.isNull()else abs(residual.Volume)
            nominal_ring_hits.append({'id':record['id'],'status':ring_contract['status'],'previousNominalOutsideVolume':volume,'residualOutsideRequestedFrontRegion':residual_volume,'volumeUnit':'mm3','passed':residual_volume<.001})
            volume=residual_volume
        if volume > .001:
            wall_hits.append({'target': record['id'], 'overlapMm3': volume})
    if wall_hits:
        violations.append({'id': 'residual-wall-material', 'violations': wall_hits})
    bounded = []
    for role in ['screw', 'washer', 'seal']:
        id = ids[role]
        outside = by_id[id].cut(permissions[id]['shape'])
        volume = 0 if outside.isNull() else abs(outside.Volume)
        bounded.append({'id': id, 'role': role, 'outsideFiniteZoneMm3': volume, 'passed': volume < .001})
        if volume >= .001:
            violations.append({'id': id, 'outsideFiniteZoneMm3': volume})

    def axial_extrema(shape):
        values = [(vertex.Point-origin).dot(axis) for vertex in shape.Vertexes]
        assert values
        return min(values), max(values)

    screw_min, screw_tip = axial_extrema(screw)
    nut_min, nut_max = axial_extrema(nut)
    expected_head_min = stack['underHeadLocalX'] - stack['headHeightMm']
    engagement = (abs(screw_min-expected_head_min) < 1e-6
                  and abs(screw_tip-stack['tipLocalX']) < 1e-6
                  and abs(nut_min-row['nutPocket']['axialStartMm']) < 1e-6
                  and abs(nut_max-nut_min-row['nutSize']['thicknessMm']) < 1e-6
                  and screw_tip >= nut_max + .5
                  and row['bossLocalBounds']['max'][0]-screw_tip >= .49)
    if not engagement:
        violations.append({'id': 'actual-axial-reach', 'headMinimumLocalX': screw_min,
                           'tipLocalX': screw_tip, 'nutInterval': [nut_min, nut_max]})
    core = axial_cylinder(1, -3.9, -.1, frame)
    missing_core = core.cut(screw).Volume
    if missing_core > 1e-5:
        violations.append({'id': 'shank-through-drilled-port', 'missingCoreMm3': missing_core})

    def contact_area(moving, receiving, sign):
        initial = abs(overlap(moving, receiving))
        assert initial < .001, (row['id'], 'initial stack overlap', initial)
        probe = moving.copy()
        probe.translate(axis * (sign * .01))
        return (abs(overlap(probe, receiving))-initial) / .01

    contacts = {
        'headOnSteelWasher': contact_area(washer, screw, -1),
        'steelWasherOnSeal': contact_area(washer, seal, 1),
        'sealOnNominalOuterWall': contact_area(seal, residual_wall, 1),
    }
    minima = {'headOnSteelWasher': 10, 'steelWasherOnSeal': 25, 'sealOnNominalOuterWall': 60}
    for id, area in contacts.items():
        if area < minima[id]:
            violations.append({'id': id, 'contactAreaMm2': area, 'minimumAreaMm2': minima[id]})
    tool_start = origin + axis * (expected_head_min-.01)
    tool = Part.makeCylinder(1.5, 25, tool_start, axis * -1)
    tool_hits = []
    for record in records:
        volume = abs(overlap(tool, by_id[record['id']]))
        if volume > .001:
            tool_hits.append({'target': record['id'], 'overlapMm3': volume})
    if tool_hits:
        violations.append({'id': 'external-3mm-tool', 'violations': tool_hits})
    return {'passed': not violations, 'hardwareIds': ids,
            'normalWallThicknessMm': 4, 'drilledPortDiameterMm': port['diameterMm'],
            'wallCouponVolumeMm3': coupon.Volume, 'remainingWallVolumeMm3': residual_wall.Volume,
            'residualWallViolations': wall_hits, 'finiteZones': bounded,
            'nominalWallCouponIntersections': nominal_panel_hits,
            'fullRealWallFitVerified': False,
            'actualScrewTipLocalX': screw_tip, 'actualNutIntervalLocalX': [nut_min, nut_max],
            'tailBeyondNutMm': screw_tip-nut_max,
            'recessedTailMm': row['bossLocalBounds']['max'][0]-screw_tip,
            'fullNutEngagement': engagement, 'missingShankCoreMm3': missing_core,
            'nominalStackContactAreasMm2': contacts,
            'externalTool': {'diameterMm': 3, 'lengthMm': 25, 'violations': tool_hits},
            'unmodeledInsulatingFitShimMm': row['nominalGapMm'],
            'violations': violations,
            'nominalRingFitIntersections':nominal_ring_hits,
            'limits': 'Local nominal4mm wall and0.8mm compressed-seal bench study. Plate-band mismatch and the two named ring/cushion prints\' requested new-minus-reference front-stock mismatch are reported separately against this unchanged coupon. No real wall removal or measured transition is inferred. Every other part and all material outside the exact per-ID regions remain strict. Fit the actual boss gap with insulation after trial; actual gaps, wall deflection, seal compression, clamping force and ingress protection are not established.'}


def audit_wall_mounts(case, shapes, overlap, mounting, case_fit):
    records = case['components']
    assert len(records) == len(shapes)
    by_id = {record['id']: shape for record, shape in zip(records, shapes)}
    plate = by_id['parallel-base']
    allowed, _ = case_fit['enclosure_fixture'](case['caseEnvelope'], closed=False)
    working_fit = case_fit['working_panel_fit_region'](case['caseEnvelope'])
    working_ring_fit=case_fit['working_ring_fit_regions'](case['caseEnvelope'])
    failures, mount_rows, rib_rows, network_rows, tool_rows = [], [], [], [], []

    def check(passed, id, **detail):
        if not passed:
            failures.append({'id': id, **detail})

    mounts = mounting['mounts']
    assert {row['side'] for row in mounts} == {'front', 'rear', 'left', 'right'}
    assert len(mounts) == 7 and len({row['id'] for row in mounts}) == 7
    assert {side: sum(row['side'] == side for row in mounts) for side in ['front', 'rear', 'left', 'right']} == {'front': 2, 'rear': 2, 'left': 1, 'right': 2}
    measured = {'front': [30, 184], 'rear': [60, 154], 'left': [75], 'right': [25, 125]}
    for side, positions in measured.items():
        axis = 1 if side in ['left', 'right'] else 0
        actual = sorted(row['axisPoint'][axis] for row in mounts if row['side'] == side)
        assert all(abs(a-b) < 1e-7 for a,b in zip(actual, positions)), (side, actual, positions)
    assert all(abs(row['axisPoint'][2]-.5) < 1e-7 for row in mounts), 'Measured rim-minus20mm axis datum'
    assert mounting['requiresMeasuredCaseWall'] is False
    assert mounting['caseWallThicknessMm'] == 4
    assert mounting['exteriorScrewsIncluded'] is True
    permissions = external_hardware_regions(mounting)
    removed_exterior_ids = set(permissions)
    outside, _, exterior_rows, working_study, ring_study = case_fit['component_containment'](
        case['caseEnvelope'], records, shapes, closed=False, mounting=mounting,
    )
    check(not outside, 'nominal-reference-and-provisional-panel-region', violations=outside)

    for row in mounts:
        id = row['id']
        axis = unit(row['inwardAxis'])
        wall_point = App.Vector(*row['cavityWallPoint'])
        # Confirm that metadata names the real measured inner boundary and
        # points inward, rather than a convenient plane through the boss.
        inside = wall_point + axis * .01
        outside_point = wall_point - axis * .01
        boundary_correct = (
            case_fit['point_inside'](case['caseEnvelope'], *inside, False)
            and not case_fit['point_inside'](case['caseEnvelope'], *outside_point, False)
        )
        check(boundary_correct, id + '-wall-boundary-direction')

        contact = plate.common(local_box(row['contactLocalProbe'], row['frame']))
        # The coupon represents only the known inner-wall boundary; its
        # arbitrary outward extent is not an assumed physical wall thickness.
        wall_coupon = box(row['wallProbe']).cut(allowed)
        assert wall_coupon.Volume > 0 and contact.Volume > 0, (id, 'empty wall-gap probe')
        gap = contact.distToShape(wall_coupon)[0]
        nominal_gap = row['nominalGapMm']
        gap_passed = abs(gap - nominal_gap) <= .01
        check(gap_passed, id + '-wall-fit-gap', gapMm=gap, nominalGapMm=nominal_gap)

        root_bounds = {'min': list(row['rootProbe']['min']),
                       'max': list(row['rootProbe']['max'])}
        # An above-panel probe could pass on the original bare plate alone.
        # This finite prism must cross the actual boss-to-panel interface.
        root_bounds['min'][2] = min(root_bounds['min'][2], mounting['panelRearZ'] - 1)
        assert root_bounds['max'][2] >= mounting['panelRearZ'] + .5
        root = box(root_bounds)
        occupied = plate.common(root).Volume
        missing = root.cut(plate).Volume
        root_passed = occupied >= row['minimumRootVolumeMm3'] and missing < 1e-5
        check(root_passed, id + '-panel-root', occupiedVolumeMm3=occupied,
              missingVolumeMm3=missing)

        nut = by_id[row['nutId']]
        exterior_stack = audit_exterior_stack(row, records, by_id, overlap, permissions, working_fit,working_ring_fit)
        check(exterior_stack['passed'], id + '-exterior-stack', violations=exterior_stack['violations'])
        pocket = row['nutPocket']
        origin = App.Vector(*row['frame']['at'])
        bore = Part.makeCylinder(
            row['boreDiameterMm'] / 2,
            row['bossLocalBounds']['max'][0] - row['bossLocalBounds']['min'][0] + .2,
            origin + axis * (row['bossLocalBounds']['min'][0] - .1), axis,
        )
        blocked_bore = abs(overlap(bore, plate))
        bore_passed = blocked_bore < 1e-5
        check(bore_passed, id + '-through-bore', blockedVolumeMm3=blocked_bore)

        cheeks = []
        intervals = [
            ('load', row['bossLocalBounds']['min'][0], pocket['axialStartMm']),
            ('inner', pocket['axialStartMm'] + pocket['axialLengthMm'],
             row['bossLocalBounds']['max'][0]),
        ]
        for name, lower, upper in intervals:
            length = upper - lower - .2
            assert length > 0, (id, name, 'no finite retaining cheek')
            annulus = Part.makeCylinder(
                row['nutSize']['acrossFlatsMm'] / 2 - .1, length,
                origin + axis * (lower + .1), axis,
            ).cut(Part.makeCylinder(
                row['boreDiameterMm'] / 2, length + .02,
                origin + axis * (lower + .09), axis,
            ))
            missing_cheek = annulus.cut(plate).Volume
            passed = missing_cheek < 1e-5
            check(passed, id + '-' + name + '-continuous-cheek',
                  missingVolumeMm3=missing_cheek, probeThicknessMm=length)
            cheeks.append({'id': name, 'passed': passed, 'nominalThicknessMm': upper - lower,
                            'probeThicknessMm': length, 'missingVolumeMm3': missing_cheek})

        initial_nut_overlap = abs(overlap(nut, plate))
        outward_nut = nut.copy()
        outward_nut.translate(axis * -.01)
        outward_seat_area = (abs(overlap(outward_nut, plate)) - initial_nut_overlap) / .01
        inner_gap = pocket['axialLengthMm'] - row['nutSize']['thicknessMm']
        assert inner_gap >= 0
        inward_nut = nut.copy()
        inward_nut.translate(axis * (inner_gap + .01))
        inward_seat_area = (abs(overlap(inward_nut, plate)) - initial_nut_overlap) / .01
        bearing_passed = (initial_nut_overlap < .001
                          and min(outward_seat_area, inward_seat_area) >= row['minimumNutSeatAreaMm2'])
        check(bearing_passed, id + '-actual-nut-axial-capture',
              loadSeatAreaMm2=outward_seat_area, innerSeatAreaMm2=inward_seat_area)
        anti_rotation = []
        for angle in [-30, 30]:
            rotated = nut.copy()
            rotated.rotate(origin, axis, angle)
            volume = abs(overlap(rotated, plate))
            passed = volume > .001
            check(passed, id + '-hex-anti-rotation-' + str(angle), overlapMm3=volume)
            anti_rotation.append({'angleDegrees': angle, 'passed': passed,
                                  'blockingVolumeMm3': volume})
        entry = row['insertion']
        outward = unit(entry['outward'])
        translation = App.Vector(*entry['translation'])
        assert abs(outward.dot(axis)) < 1e-6, (id, 'nut entry is not tangential')
        assert translation.dot(outward) > 0
        assert (translation - outward * translation.dot(outward)).Length < 1e-6
        start = nut.copy()
        start.translate(translation)
        start_gap = projected_minimum(
            start.BoundBox, App.Vector(*entry['mouth']), outward,
        )
        entry_violations = []
        envelope, sweep = planar_nut_envelopes(row)
        outside_envelope = nut.cut(envelope)
        outside_volume = 0 if outside_envelope.isNull() else abs(outside_envelope.Volume)
        assert outside_volume < 1e-6, (id, 'actual nut outside conservative envelope', outside_volume)
        for record, target in zip(records, shapes):
            if record['id'] == row['nutId'] or record['id'] in removed_exterior_ids:
                continue
            volume = abs(overlap(sweep, target))
            if volume > .001:
                entry_violations.append({'target': record['id'], 'overlapMm3': volume})
        entry_passed = start_gap >= entry['minimumStartGapMm'] and not entry_violations
        check(entry_passed, id + '-complete-nut-entry', startGapMm=start_gap,
              violations=entry_violations)
        brass_service_ids={id for support in case['mechanicalStructure']['brassSupports']['supports']for id in support['retainedComponentIds']+support['removedBeforeWithdrawalIds']}
        loading_well = audit_loading_well(row, records, shapes, nut, overlap, removed_exterior_ids, brass_service_ids)
        check(loading_well['passed'], id + '-complete-loading-well-entry',
              violations=loading_well['violations'],
              startHostOverlapMm3=loading_well['actualStartHostOverlapMm3'],
              startGapMm=loading_well['wholeNutBeyondWellMouthGapMm'])
        mount_rows.append({
            'id': id, 'side': row['side'],
            'passed': (boundary_correct and gap_passed and root_passed and entry_passed and loading_well['passed']
                       and bore_passed and bearing_passed
                       and exterior_stack['passed']
                       and all(r['passed'] for r in cheeks + anti_rotation)),
            'axisPoint': row['axisPoint'], 'inwardAxis': row['inwardAxis'],
            'nominalReferenceGapMm': gap, 'adoptedNominalGapMm': nominal_gap,
            'actualBossGapMeasured': False,
            'rootVolumeMm3': occupied, 'missingRootVolumeMm3': missing,
            'rootJointProbe': root_bounds,
            'nutId': row['nutId'],
            'exteriorStack': exterior_stack,
            'loadingWellInsertion': loading_well,
            'nutEntryRemovedIds': sorted(removed_exterior_ids),
            'continuousNutSweep': {
                'method': 'Conservative filled outer-hex planar Minkowski prism',
                'actualNutOutsideEnvelopeMm3': outside_volume,
                'filledEnvelopeVolumeMm3': envelope.Volume,
                'sweptEnvelopeVolumeMm3': sweep.Volume,
                'transformedNativeYMatchesOutward': True,
            },
            'blockedBoreVolumeMm3': blocked_bore, 'retainingCheeks': cheeks,
            'initialNutOverlapMm3': initial_nut_overlap,
            'actualLoadSeatAreaMm2': outward_seat_area,
            'actualInnerSeatAreaMm2': inward_seat_area,
            'minimumNutSeatAreaMm2': row['minimumNutSeatAreaMm2'],
            'antiRotation': anti_rotation,
            'wholeNutBeyondMouthGapMm': start_gap,
            'minimumStartGapMm': entry['minimumStartGapMm'],
            'nutEntryViolations': entry_violations,
        })

    for row in mounting['ribWitnesses']:
        probe = box(row)
        missing = probe.cut(plate).Volume
        passed = missing < 1e-5
        check(passed, row['id'], missingVolumeMm3=missing)
        rib_rows.append({'id': row['id'], 'passed': passed,
                         'probeVolumeMm3': probe.Volume, 'missingVolumeMm3': missing})

    for row in mounting['networkRegions']:
        network = plate.common(box(row))
        passed = (network.isValid() and network.isClosed()
                  and len(network.Solids) == 1
                  and network.Volume >= row['minimumVolumeMm3'])
        check(passed, row['id'], solids=len(network.Solids), volumeMm3=network.Volume)
        network_rows.append({'id': row['id'], 'passed': passed,
                             'solids': len(network.Solids), 'volumeMm3': network.Volume})

    # Tool schemas are intentionally explicit: these are source-bound hollow
    # working envelopes, not a solid cylinder exempting the complete connector.
    for row in mounting['toolReserves']:
        tool = hex_socket(row)
        violations = []
        for record, target in zip(records, shapes):
            if record['id'] in row['removedIds']:
                continue
            volume = abs(overlap(tool, target))
            if volume > .001:
                violations.append({'target': record['id'], 'overlapMm3': volume})
        passed = not violations
        check(passed, row['id'], violations=violations)
        tool_rows.append({'id': row['id'], 'passed': passed, 'removedIds': row['removedIds'],
                          'outerRadiusMm': row['radius'],
                          'innerAcrossFlatsMm': row['innerAcrossFlatsMm'],
                          'minimumZ': row['minZ'], 'maximumZ': row['maxZ'],
                          'violations': violations})

    return {
        'passed': not failures, 'mounts': mount_rows, 'ribWitnesses': rib_rows,
        'ribNetworks': network_rows, 'toolReserves': tool_rows,
        'outsideCavityViolations': outside, 'failures': failures,
        'validationScope': 'local-wall-hardware-bench-and-provisional-panel-fit-study',
        'fullCaseFitVerified': False,
        'workingPanelFit': case['caseEnvelope']['workingPanelFit'],
        'workingPanelFitStudy': working_study,
        'workingRingFit':case['caseEnvelope']['workingRingFit'],
        'workingRingFitStudy':ring_study,
        'authorizedExteriorHardware': exterior_rows,
        'requiresMeasuredCaseWall': False,
        'limits': ('The former nominal inner taper and seven finite nominal 4 mm wall coupons; '
                   'only their declared 3.4 mm ports are drilled. Exterior hardware '
                   'is limited by per-ID finite zones. The declared plate band and exact ring/cushion '
                   'new-minus-reference front-stock regions do not establish a re-measured full cavity, actual wall transition or boss gaps. '
                   'Its nominal coupon conflicts are reported separately. The nominal 0.2 mm boss gap requires '
                   'an insulating fit shim when present; no wall-pulling, seal compression, '
                   'clamp force, ingress protection or structural rating is established. '
                   'Captive nuts are inserted before installing the panel in the case. '
                   'Tool envelopes qualify only their declared geometry and removal sequence.'),
    }
