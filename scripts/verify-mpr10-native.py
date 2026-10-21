#!/usr/bin/env python3
"""Validate and export one freshly prepared MPR.10 revision with native FreeCAD.

Prepare cases with scripts/verify-mpr10-native.ts. Run this with a FreeCAD-enabled
Python; on macOS set PYTHONPATH to FreeCAD.app/Contents/Resources/lib. All four
prepared poses must pass before export. The report and archive describe this run
only; predecessor reports and unlisted print files are never included.
"""
import argparse
import ast
import collections
import concurrent.futures
import csv
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

import FreeCAD as App
import Part


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def result_summary(result):
    summary = {key: result[key] for key in ['id', 'passed', 'errors', 'interferences', 'outsideBore',
               'components', 'printedComponents', 'solidCount', 'seconds'] if key in result}
    summary['bearingPressFitCount'] = len(result.get('bearingPressFits', []))
    summary['pinPressFitCount'] = len(result.get('pressFits', []))
    return summary


def common_shape(a, b):
    """Try reverse operand order for exact surface-only OCC contacts."""
    try:
        common = a.common(b)
    except Exception as first:
        try:
            common = b.common(a)
        except Exception:
            raise first
    return common


def intersection_volume(a, b):
    common = common_shape(a, b)
    return 0.0 if common.isNull() or not common.Solids else common.Volume


def bearing_press_fit(case, ra, rb, a, b, volume):
    """Allow only measured contact inside one specified outer-race seat annulus."""
    if ra['libraryId'] == 'ball-bearing':
        bearing, body = ra, rb
    elif rb['libraryId'] == 'ball-bearing':
        bearing, body = rb, ra
    else:
        return None
    match = re.fullmatch(r'channel-([1-4])-(output-bearing-(16|34)|screw-bearing-(24|28))', bearing['id'])
    if not match:
        return None
    output = 'output-bearing' in bearing['id']
    if body['id'] != ('upper-disc' if output else 'front-deck'):
        return None
    interference = float(case['parameters'].get('bearingPressFit', 0))
    if interference <= 0:
        return None
    radius = float(bearing['parameters']['outer']) / 2
    width = float(bearing['parameters']['width'])
    seat_radius = radius - interference / 2
    theta = (int(match.group(1)) - 1) * 90
    rotation = App.Rotation(App.Vector(0, 0, 1), theta)
    start = float(match.group(3) if output else match.group(4))
    origin = rotation.multVec(App.Vector(start, 0, case['layout']['outputZ']) if output else
                              App.Vector(case['layout']['screwX'], case['layout']['screwY'], start))
    axis = rotation.multVec(App.Vector(1, 0, 0) if output else App.Vector(0, 0, 1))
    tolerance = 1e-5
    outside = Part.makeCylinder(radius + tolerance, width + 2 * tolerance,
                                origin - axis * tolerance, axis)
    inside = Part.makeCylinder(seat_radius - tolerance, width + 4 * tolerance,
                               origin - axis * (2 * tolerance), axis)
    annulus = outside.cut(inside)
    contact = common_shape(a, b)
    unexpected = contact.cut(annulus).Volume
    upper_volume = math.pi * (radius ** 2 - seat_radius ** 2) * width
    return {'bearing': bearing['id'], 'body': body['id'],
            'diametralInterference': interference, 'radialInterference': interference / 2,
            'volume': volume, 'analyticFullAnnulusVolume': upper_volume,
            'volumeOutsideSeatAnnulus': unexpected,
            'passed': unexpected <= 1e-4 and 0 < volume <= upper_volume + 1e-3}


def press_fit_pair(a, b):
    return (
        a.endswith('-rocker') and b == a[:-len('rocker')] + 'follower-pin'
    ) or (
        b.endswith('-rocker') and a == b[:-len('rocker')] + 'follower-pin'
    )


def follower_pilot_press_fit(ra, rb, a, b, volume):
    """Prove the pin contact lies entirely in the Ø3/Ø2.9 pilot annulus."""
    if not press_fit_pair(ra['id'], rb['id']):
        return None
    pin_record, pin = (ra, a) if ra['id'].endswith('-follower-pin') else (rb, b)
    channel = int(re.fullmatch(r'channel-([1-4])-follower-pin', pin_record['id']).group(1))
    theta = math.radians((channel - 1) * 90)
    axis = App.Vector(math.cos(theta), math.sin(theta), 0)
    bounds = pin.BoundBox
    center = App.Vector((bounds.XMin + bounds.XMax) / 2, (bounds.YMin + bounds.YMax) / 2,
                        (bounds.ZMin + bounds.ZMax) / 2)
    length = bounds.XLength if channel in [1, 3] else bounds.YLength
    tolerance = 1e-5
    outer = Part.makeCylinder(1.5 + tolerance, length + 2 * tolerance,
                              center - axis * (length / 2 + tolerance), axis)
    inner = Part.makeCylinder(1.45 - tolerance, length + 4 * tolerance,
                              center - axis * (length / 2 + 2 * tolerance), axis)
    contact = common_shape(a, b)
    unexpected = contact.cut(outer.cut(inner)).Volume
    cb = contact.BoundBox
    contact_length = cb.XLength if channel in [1, 3] else cb.YLength
    upper_volume = math.pi * (1.5 ** 2 - 1.45 ** 2) * contact_length
    return {'a': ra['id'], 'b': rb['id'], 'volume': volume,
            'pinDiameter': 3, 'pilotDiameter': 2.9, 'measuredEngagement': contact_length,
            'analyticFullAnnulusVolume': upper_volume, 'volumeOutsidePilotAnnulus': unexpected,
            'passed': unexpected <= 1e-5 and volume <= upper_volume + 1e-3}


def execute(case, diagnostic=False):
    scope = {'App': App, 'Part': Part, 'math': math}
    # Keep the module's own manufactured-detail checks active.
    code = case['code']
    if diagnostic:
        # Continue past fabricated-detail failures to collect all local issues.
        # This mode cannot export, and each invalid shape still fails check_case.
        code = code.replace('raise ValueError("Invalid manufactured library detail:',
                            'print("Invalid manufactured library detail:')
    exec(code, scope)
    if len(scope['components']) != len(case['components']):
        raise ValueError('Geometry and component metadata counts differ.')
    return scope


def component_source_hashes(case):
    """Hash the actual native generator, independent of component labels."""
    hashes = []
    for statement in ast.parse(case['code']).body:
        if not isinstance(statement, ast.Assign) or not isinstance(statement.value, ast.Call):
            continue
        call = statement.value
        if isinstance(call.func, ast.Name) and call.func.id == '_pl_component':
            source = ast.literal_eval(call.args[0])
            hashes.append(hashlib.sha256(source.encode()).hexdigest())
    if len(hashes) != len(case['components']):
        raise ValueError('Cannot prove component generator identity for incremental checks.')
    return dict(zip((record['id'] for record in case['components']), hashes))


def unchanged_pair_proof(case, baseline_case, baseline_result):
    """Reuse only identical native generators with a common rigid displacement.

    Identical local native source and unchanged relative placement preserve the
    intersection exactly. Changed frame geometry, shortened hardware and any
    changed relative placement always require a fresh native Boolean.
    """
    if not baseline_result['passed'] or baseline_result['id'] != case['id']:
        raise ValueError('Incremental checks require the corresponding passed baseline pose.')
    old_sources, new_sources = component_source_hashes(baseline_case), component_source_hashes(case)
    old_records = {record['id']: record for record in baseline_case['components']}
    displacement = {}
    for record in case['components']:
        name = record['id']
        if name in old_records and old_sources[name] == new_sources[name]:
            displacement[name] = physical_placement(record).multiply(
                physical_placement(old_records[name]).inverse()).toMatrix().A
    measured_fits = {}
    for fit in baseline_result.get('bearingPressFits', []):
        measured_fits[tuple(sorted((fit['bearing'], fit['body'])))] = ('bearingPressFits', fit)
    for fit in baseline_result.get('pressFits', []):
        measured_fits[tuple(sorted((fit['a'], fit['b'])))] = ('pressFits', fit)

    def unchanged(a, b):
        if a not in displacement or b not in displacement:
            return False
        return max(abs(x - y) for x, y in zip(displacement[a], displacement[b])) <= 1e-9

    return unchanged, measured_fits, sorted(displacement)


def check_case(case, diagnostic=False, baseline=None):
    started = time.time()
    result = {'id': case['id'], 'errors': [], 'interferences': [],
              'pressFits': [], 'bearingPressFits': [], 'outsideBore': []}
    try:
        scope = execute(case, diagnostic)
        shapes, records = scope['components'], case['components']
        unchanged, measured_fits, unchanged_components = (None, {}, [])
        if baseline:
            unchanged, measured_fits, unchanged_components = unchanged_pair_proof(
                case, baseline['case'], baseline['result'])
        reused_pairs, native_pairs = [], 0
        radius = case['layout']['tubeID'] / 2
        assembly_bounds = scope['shape'].BoundBox
        bore = Part.makeCylinder(radius, assembly_bounds.ZLength + 20,
                                 App.Vector(0, 0, assembly_bounds.ZMin - 10))
        for shape, record in zip(shapes, records):
            if not shape.isValid() or not shape.isClosed() or shape.Volume <= 0:
                result['errors'].append({'component': record['id'], 'error': 'Invalid, open or empty CAD.'})
            if record.get('requireSingleSolid') and len(shape.Solids) != 1:
                result['errors'].append({'component': record['id'], 'error': 'Fabricated detail is not one connected solid.'})
            if record['libraryId'] == 'e-ring' and len(shape.Solids) != 1:
                result['errors'].append({'component': record['id'], 'error': 'Installed E-clip is not one connected solid.'})
            outside = shape.cut(bore)
            volume = 0 if outside.isNull() else outside.Volume
            if volume > .01 and not record['id'].endswith('-shaft'):
                result['outsideBore'].append({'component': record['id'], 'volume': round(volume, 6)})
        for i, (a, ra) in enumerate(zip(shapes, records)):
            for j in range(i + 1, len(shapes)):
                b, rb = shapes[j], records[j]
                ba, bb = a.BoundBox, b.BoundBox
                overlaps = [
                    min(ba.XMax, bb.XMax) - max(ba.XMin, bb.XMin),
                    min(ba.YMax, bb.YMax) - max(ba.YMin, bb.YMin),
                    min(ba.ZMax, bb.ZMax) - max(ba.ZMin, bb.ZMin),
                ]
                if min(overlaps) <= 1e-7:
                    continue
                pair_key = tuple(sorted((ra['id'], rb['id'])))
                if unchanged and unchanged(*pair_key):
                    reused_pairs.append(pair_key)
                    if pair_key in measured_fits:
                        key, fit = measured_fits[pair_key]
                        result[key].append(dict(fit, inheritedByExactRigidPairProof=True))
                    continue
                native_pairs += 1
                intersection = common_shape(a, b)
                volume = 0 if intersection.isNull() or not intersection.Solids else intersection.Volume
                if volume <= .05:
                    continue
                pair = {'a': ra['id'], 'b': rb['id'], 'volume': round(volume, 6)}
                fit = bearing_press_fit(case, ra, rb, a, b, volume)
                pilot = follower_pilot_press_fit(ra, rb, a, b, volume)
                if fit and fit['passed']:
                    result['bearingPressFits'].append(fit)
                elif pilot and pilot['passed']:
                    result['pressFits'].append(pilot)
                else:
                    if fit:
                        pair['failedSeatAnnulusProof'] = fit
                    bounds = intersection.BoundBox
                    pair['bbox'] = [bounds.XMin, bounds.YMin, bounds.ZMin,
                                    bounds.XMax, bounds.YMax, bounds.ZMax]
                    result['interferences'].append(pair)
        by_id = {r['id']: s for r, s in zip(records, shapes)}
        result['rockerNutClearances'] = [
            {'channel': i, 'distance': by_id[f'channel-{i}-rocker'].distToShape(by_id[f'channel-{i}-nut'])[0]}
            for i in range(1, 5)
        ]
        for clearance in result['rockerNutClearances']:
            if clearance['distance'] < .2 - 1e-6:
                result['errors'].append({'channel': clearance['channel'], 'error': 'Rocker-to-nut clearance is below 0.2 mm.'})
        result.update(
            components=len(shapes),
            printedComponents=sum(bool(r.get('printed')) for r in records),
            solidCount=sum(len(s.Solids) for s in shapes),
            componentsByLibrary=dict(collections.Counter(r['libraryId'] for r in records)),
            componentsBySupply=dict(collections.Counter(r['supply'] for r in records)),
        )
        if baseline:
            result['incrementalProof'] = {
                'baselineCasesSha256': baseline['sourceCasesSha256'],
                'baselinePose': baseline['case']['id'],
                'unchangedGeneratorComponents': unchanged_components,
                'inheritedIntersectingBoundingBoxPairs': reused_pairs,
                'freshNativeBooleanPairs': native_pairs,
                'matrixTolerance': 1e-9,
                'basis': 'Byte-identical native component generator source and equal rigid displacement of both members from a passed baseline pose. All component validity and tube-fit checks are fresh.',
            }
    except Exception as error:
        result['errors'].append({'error': str(error)})
    result['seconds'] = round(time.time() - started, 2)
    result['passed'] = not (result['errors'] or result['interferences'] or result['outsideBore'])
    return result


def check_sweep(case, scope):
    """Rotate the channel-one rocker and translate its nut through the full range."""
    by_id = {r['id']: s for r, s in zip(case['components'], scope['components'])}
    rocker, nut = by_id['channel-1-rocker'], by_id['channel-1-nut']
    z, arm = case['layout']['outputZ'], case['layout']['arm']
    samples = []
    for angle in range(-18, 19):
        r = rocker.copy()
        r.rotate(App.Vector(0, 0, z), App.Vector(1, 0, 0), angle)
        n = nut.copy()
        n.translate(App.Vector(0, 0, -arm * math.sin(math.radians(angle))))
        distance = r.distToShape(n)[0]
        samples.append({'angle': angle, 'minimumRockerNutDistance': distance})
    minimum = min(item['minimumRockerNutDistance'] for item in samples)
    return {'samples': samples, 'minimumClearance': minimum, 'passed': minimum >= .2 - 1e-6}


def check_screw_working_range(case, scope):
    """Measure the complete purchased nut envelope against both thread ends."""
    by_id = {record['id']: shape for record, shape in zip(case['components'], scope['components'])}
    thread_start, thread_end = [float(case['layout'][key]) for key in ['screwThreadStart', 'screwThreadEnd']]
    thread_center = (thread_start + thread_end) / 2
    half_stroke = float(case['layout']['arm']) * math.sin(math.radians(18))
    results = []
    for channel in range(1, 5):
        nut = by_id[f'channel-{channel}-nut'].BoundBox
        screw = by_id[f'channel-{channel}-screw'].BoundBox
        neutral_center = (nut.ZMin + nut.ZMax) / 2
        operating_start, operating_end = nut.ZMin - half_stroke, nut.ZMax + half_stroke
        reserves = [operating_start - thread_start, thread_end - operating_end]
        results.append({'channel': channel, 'screwRange': [screw.ZMin, screw.ZMax],
                        'workingThreadRange': [thread_start, thread_end],
                        'neutralNutRange': [nut.ZMin, nut.ZMax],
                        'sweptNutRange': [operating_start, operating_end],
                        'fullStroke': half_stroke * 2, 'threadEndReserves': reserves,
                        'nutToThreadCenterError': abs(neutral_center - thread_center),
                        'passed': min(reserves) >= .2 and abs(neutral_center - thread_center) < 1e-6})
    output_error = abs(float(case['layout']['outputZ']) - thread_center)
    return {'channels': results, 'outputToWorkingThreadCenterError': output_error,
            'note': 'Centering refers to the usable working thread. The complete turned screw includes unequal drive/fixed and rear support journals.',
            'passed': output_error < 1e-6 and all(result['passed'] for result in results)}


def check_eclip_grooves(case, scope):
    """Measure installed E-clip contact, groove clearance and both shaft shoulders.

    Thin geometric probes establish the actual manufactured groove at each clip;
    the check does not infer a working groove from component labels or positions.
    """
    by_id = {r['id']: (r, s) for r, s in zip(case['components'], scope['components'])}
    results = []
    for record, shape in by_id.values():
        if record['libraryId'] != 'e-ring':
            continue
        component_id = record['id']
        channel = component_id.split('-')[1]
        output = '-shaft-e-clip-' in component_id
        shaft_id = f"channel-{channel}-{'shaft' if output else 'screw'}"
        shaft = by_id[shaft_id][1]
        groove_radius = float(record['parameters']['installedGrooveDiameter']) / 2
        nominal_radius = 4 if output else 2
        thickness = float(record['parameters']['thickness'])
        x, y, z = record['placement']['rotation']
        rotation = App.Rotation(App.Vector(0, 0, 1), z).multiply(
            App.Rotation(App.Vector(0, 1, 0), y)).multiply(
            App.Rotation(App.Vector(1, 0, 0), x))
        center = App.Vector(*record['placement']['translation'])
        axis = rotation.multVec(App.Vector(0, 0, 1))

        def cylinder(radius, length, location):
            return Part.makeCylinder(radius, length, location - axis * (length / 2), axis)

        def annulus(length, location):
            return cylinder(nominal_radius - .01, length, location).cut(
                cylinder(groove_radius + .01, length + .02, location))

        root = cylinder(groove_radius - .01, .02, center)
        root_missing = root.cut(shaft).Volume
        groove = annulus(thickness - .02, center)
        groove_material = intersection_volume(groove, shaft)
        shoulders = []
        for sign in [-1, 1]:
            shoulder = annulus(.02, center + axis * (sign * (thickness / 2 + .12)))
            shoulders.append(shoulder.cut(shaft).Volume)
        overlap = intersection_volume(shape, shaft)
        contact_distance = shape.distToShape(shaft)[0]
        local = shape.copy()
        placement = App.Placement(center, rotation)
        local.transformShape(placement.inverse().toMatrix(), True)
        axial_thickness = local.BoundBox.ZLength
        valid = shape.isValid() and shape.isClosed() and len(shape.Solids) == 1
        results.append({
            'component': component_id, 'shaft': shaft_id,
            'installedGrooveDiameter': groove_radius * 2,
            'measuredAxialThickness': axial_thickness,
            'nominalClipThickness': thickness,
            'shaftOverlapVolume': overlap, 'contactDistance': contact_distance,
            'grooveRootProbeMissingVolume': root_missing,
            'grooveAnnulusUnexpectedMaterial': groove_material,
            'shoulderProbeMissingVolumes': shoulders,
            'passed': valid and groove_radius < nominal_radius and
                      abs(axial_thickness - thickness) < 1e-5 and overlap < 1e-5 and
                      contact_distance < 1e-4 and root_missing < 1e-5 and
                      groove_material < 1e-5 and max(shoulders) < 1e-5,
        })
    return {'clips': results, 'count': len(results),
            'note': 'Installed nominal contact and actual shaft-groove geometry are checked. DIN 6799 clips must be expanded for assembly; this is not an elastic insertion-force or fatigue prediction.',
            'passed': len(results) == 16 and all(r['passed'] for r in results)}


def physical_placement(record):
    x, y, z = record['placement']['rotation']
    rotation = App.Rotation(App.Vector(0, 0, 1), z).multiply(
        App.Rotation(App.Vector(0, 1, 0), y)).multiply(
        App.Rotation(App.Vector(1, 0, 0), x))
    return App.Placement(App.Vector(*record['placement']['translation']), rotation)


def check_fork_contract(case, scope):
    """Probe actual stepped-head capture and roller drive faces in each fork."""
    by_id = {r['id']: s for r, s in zip(case['components'], scope['components'])}
    specification = case['driveInterface']
    results = []
    for channel in range(1, 5):
        rotation = App.Rotation(App.Vector(0, 0, 1), -(channel - 1) * 90)

        def local(suffix):
            shape = by_id[f'channel-{channel}-{suffix}'].copy()
            shape.rotate(App.Vector(0, 0, 0), App.Vector(0, 0, 1), -(channel - 1) * 90)
            return shape

        carriage, keeper = local('carriage'), local('keeper')
        fork = Part.makeCompound([carriage, keeper])
        sleeve, roller = local('follower-spacer'), local('follower-bearing')
        bounds = sleeve.BoundBox
        y, z = (bounds.YMin + bounds.YMax) / 2, (bounds.ZMin + bounds.ZMax) / 2
        hx0, hx1 = specification['captureX']
        px0, px1 = specification['capturePocketX']
        head_radius = specification['captureDiameter'] / 2
        stem_radius = specification['sleeveDiameter'] / 2
        head = sleeve.common(Part.makeCylinder(head_radius + .01, hx1 - hx0,
                                              App.Vector(hx0, y, z), App.Vector(1, 0, 0)))
        rim = Part.makeCylinder(head_radius - .01, hx1 - hx0 - .02,
                               App.Vector(hx0 + .01, y, z), App.Vector(1, 0, 0)).cut(
            Part.makeCylinder(stem_radius + .01, hx1 - hx0 + .02,
                              App.Vector(hx0 - .01, y, z), App.Vector(1, 0, 0)))
        rim_missing = rim.cut(sleeve).Volume
        lip_probe_missing = []
        lip_z = (specification['captureMouthHeight'] / 2 + head_radius) / 2
        for x in [(keeper.BoundBox.XMin + px0) / 2, (px1 + keeper.BoundBox.XMax) / 2]:
            for sign in [-1, 1]:
                probe = Part.makeBox(.08, .08, .08, App.Vector(x - .04, y - .04, z + sign * lip_z - .04))
                lip_probe_missing.append(probe.cut(fork).Volume)
        x_stops = []
        for sign in [-1, 1]:
            shifted = head.copy()
            shifted.translate(App.Vector(sign * .25, 0, 0))
            x_stops.append(intersection_volume(shifted, fork))
        y_motion = []
        for angle in range(-18, 19):
            dy = case['layout']['arm'] * (1 - math.cos(math.radians(angle)))
            shifted_sleeve, shifted_roller = sleeve.copy(), roller.copy()
            for shape in [shifted_sleeve, shifted_roller]:
                shape.translate(App.Vector(0, dy, 0))
            y_motion.append({'angle': angle, 'ySlide': dy,
                             'sleeveOverlap': intersection_volume(shifted_sleeve, fork),
                             'rollerOverlap': intersection_volume(shifted_roller, fork)})
        z_drive = []
        for sign in [-1, 1]:
            shifted_roller, shifted_head = roller.copy(), head.copy()
            for shape in [shifted_roller, shifted_head]:
                shape.translate(App.Vector(0, 0, sign * .15))
            z_drive.append({'direction': sign,
                            'rollerDriveOverlap': intersection_volume(shifted_roller, fork),
                            'headOverlap': intersection_volume(shifted_head, fork)})
        rocker, cap, shaft = local('rocker'), local('rocker-cap'), local('shaft')
        rocker.translate(App.Vector(0, .25, 0))
        cap.translate(App.Vector(0, -.25, 0))
        clamp_closure = {'halfTravel': .25,
                         'rockerShaftContact': intersection_volume(rocker, shaft),
                         'capShaftContact': intersection_volume(cap, shaft),
                         'prematureFaceContact': intersection_volume(rocker, cap)}
        clamp_closure['passed'] = (min(clamp_closure['rockerShaftContact'],
                                       clamp_closure['capShaftContact']) > .001 and
                                   clamp_closure['prematureFaceContact'] < 1e-5)
        neutral_head = intersection_volume(head, fork)
        passed = (rim_missing < 1e-6 and max(lip_probe_missing) < 1e-7 and
                  neutral_head < 1e-5 and min(x_stops) > .001 and
                  all(r['sleeveOverlap'] < 1e-5 and r['rollerOverlap'] < 1e-5 for r in y_motion) and
                  all(r['rollerDriveOverlap'] > .001 and r['headOverlap'] < 1e-5 for r in z_drive) and
                  clamp_closure['passed'])
        results.append({'channel': channel, 'headRimProbeMissingVolume': rim_missing,
                        'lipProbeMissingVolumes': lip_probe_missing,
                        'neutralHeadOverlap': neutral_head,
                        'headStopOverlapsAtPlusMinus025X': x_stops,
                        'yMotion': y_motion, 'zDriveAtPlusMinus015': z_drive,
                        'clampClosure': clamp_closure,
                        'passed': passed})
    guides = [r['id'] for r in case['components'] if r['libraryId'] == 'hiwin-profile-guide']
    discs = [name for name in ['motor-plate', 'front-deck', 'upper-disc'] if name in by_id]
    posts = []
    for record in case['components']:
        if record['libraryId'] != 'pcb-standoff':
            continue
        bounds = by_id[record['id']].BoundBox
        x, y = (bounds.XMin + bounds.XMax) / 2, (bounds.YMin + bounds.YMax) / 2
        posts.append({'component': record['id'], 'centerRadius': math.hypot(x, y),
                      'axisXY': [x, y], 'zRange': [bounds.ZMin, bounds.ZMax]})
    architecture = {'discComponents': discs, 'linearGuideComponents': guides,
                    'peripheralPosts': posts,
                    'passed': len(discs) == 3 and not guides and len(posts) == 8 and
                              min(r['centerRadius'] for r in posts) > 35}
    return {'forks': results, 'architecture': architecture,
            'note': 'Actual steel head rim, both printed lips, opposed axial stops, free Y sliding and separate Z roller drive are probed. These are nominal geometric constraints, not printed stiffness or force ratings.',
            'passed': architecture['passed'] and all(r['passed'] for r in results)}


def synchronous_pair_orbits(records, shapes, transforms, pairs):
    """Prove native C4 solid equality and motion equivariance before reduction."""
    by_id = {r['id']: i for i, r in enumerate(records)}
    families = collections.defaultdict(dict)
    for record in records:
        match = re.fullmatch(r'channel-([1-4])-(.+)', record['id'])
        if match:
            families[match.group(2)][int(match.group(1))] = record['id']
    quarter = App.Rotation(App.Vector(0, 0, 1), 90)
    basis = [App.Vector(0, 0, 0), App.Vector(1, 0, 0), App.Vector(0, 1, 0), App.Vector(0, 0, 1)]
    proven, failures = set(), []

    def difference(a, b):
        total = 0.0
        for first, second in [(a, b), (b, a)]:
            remainder = first.cut(second)
            total += 0 if remainder.isNull() else remainder.Volume
        return total

    for suffix, members in families.items():
        if set(members) != {1, 2, 3, 4}:
            continue
        try:
            # The SDK caches the deterministic native generator by source.
            # Identical library/state/parameter bytes plus placement equivariance
            # establish identical generated solids without coincident-face BOPs.
            definitions = [json.dumps([records[by_id[members[channel]]]['libraryId'],
                                       records[by_id[members[channel]]]['state'],
                                       records[by_id[members[channel]]]['parameters']],
                                      sort_keys=True, separators=(',', ':')) for channel in range(1, 5)]
            if len(set(definitions)) != 1:
                failures.append({'family': suffix, 'constructionParametersDiffer': True})
                continue
            placement_error = 0.0
            for channel in range(1, 5):
                current = physical_placement(records[by_id[members[channel]]]).toMatrix()
                following = physical_placement(records[by_id[members[channel % 4 + 1]]]).toMatrix()
                for point in basis:
                    placement_error = max(placement_error, (following.multVec(point) -
                        quarter.multVec(current.multVec(point))).Length)
            if placement_error > 1e-6:
                failures.append({'family': suffix, 'neutralPlacementEquivarianceError': placement_error})
                continue
            error = 0.0
            for channel in range(1, 5):
                i, j = by_id[members[channel]], by_id[members[channel % 4 + 1]]
                for sample in transforms:
                    for point in basis:
                        error = max(error, (sample[j].multVec(quarter.multVec(point)) -
                                            quarter.multVec(sample[i].multVec(point))).Length)
            if error <= 1e-6:
                proven.add(suffix)
            else:
                failures.append({'family': suffix, 'poseEquivarianceError': error})
        except Exception as error:
            failures.append({'family': suffix, 'unproven': str(error)})
    frames = set()
    for name in ['motor-plate', 'front-deck', 'upper-disc']:
        try:
            original = shapes[by_id[name]]
            rotated = original.copy()
            rotated.rotate(App.Vector(0, 0, 0), App.Vector(0, 0, 1), 90)
            delta = difference(original, rotated)
            print(json.dumps({'nativeFrameQuarterTurnProof': name, 'symmetricDifferenceVolume': delta}), flush=True)
            if delta <= 1e-5:
                frames.add(name)
        except Exception:
            pass

    def rotate_id(name, shift):
        if name in frames:
            return name
        match = re.fullmatch(r'channel-([1-4])-(.+)', name)
        if match and match.group(2) in proven:
            return f'channel-{(int(match.group(1)) - 1 + shift) % 4 + 1}-{match.group(2)}'
        return None

    selected, seen = [], set()
    for i, j in pairs:
        a, b = records[i]['id'], records[j]['id']
        if rotate_id(a, 0) is None or rotate_id(b, 0) is None:
            selected.append((i, j))
            continue
        orbit = min(tuple(sorted([rotate_id(a, shift), rotate_id(b, shift)])) for shift in range(4))
        if orbit not in seen:
            seen.add(orbit)
            selected.append((i, j))
    return selected, {'nativeSymmetricDifferenceToleranceMm3': 1e-5,
                       'poseEquivarianceToleranceMm': 1e-6,
                       'provenChannelFamilies': sorted(proven), 'provenFrameComponents': sorted(frames),
                       'unprovenFamiliesRetainedInFull': failures,
                       'candidatePairsBefore': len(pairs), 'representativePairsAfter': len(selected),
                       'constructionEquivalenceBasis': 'Byte-identical libraryId/state/parameters, deterministic cached native generators, and exact quarter-turn neutral placement and all-pose transform equivariance. Shared frame discs additionally pass native symmetric-difference booleans.',
                       'note': 'Only proven C4 pair orbits are reduced. Every unmatched fixed hardware pair remains explicit.'}


def check_neighbor_xy_separation(case, scope):
    """Prove separation for every combination of the 37 sampled channel angles.

    Intervals along XY axes bound the complete native solids at every sampled
    angle. A separating interval proves all 37x37 angle combinations for that
    cross-channel pair without coincident-face Boolean intersections. Pairs
    lacking a separating axis remain unresolved, never implicitly accepted.
    """
    scenario = next(s for s in case['motionScenarios'] if s['id'] == 'synchronous')
    records, shapes = case['components'], scope['components']
    reference = {record['id']: physical_placement(record).inverse() for record in records}
    matrices = [[] for _ in records]
    for sample in scenario['samples']:
        indexed = {record['id']: record for record in sample['components']}
        for index, record in enumerate(records):
            pose = indexed[record['id']]
            spin = App.Placement(App.Vector(), App.Rotation(App.Vector(0, 0, 1), pose.get('axialSpin', 0)))
            matrices[index].append(physical_placement(pose).multiply(spin).multiply(reference[record['id']]).toMatrix())
    moving, posed, channels = [], {}, {}
    for index, record in enumerate(records):
        match = re.fullmatch(r'channel-([1-4])-(.+)', record['id'])
        changing = len({tuple(round(v, 9) for v in matrix.A) for matrix in matrices[index]}) > 1
        if not match or not changing:
            continue
        moving.append(index)
        channels[index] = int(match.group(1))
        posed[index] = []
        for matrix in matrices[index]:
            shape = shapes[index].copy()
            shape.transformShape(matrix, True)
            posed[index].append(shape)
    intervals = {}

    def interval(index, angle):
        key = (index, angle)
        if key not in intervals:
            minimum, maximum = float('inf'), -float('inf')
            for original in posed[index]:
                shape = original
                if angle:
                    shape = original.copy()
                    shape.rotate(App.Vector(), App.Vector(0, 0, 1), -angle)
                bounds = shape.BoundBox
                minimum, maximum = min(minimum, bounds.XMin), max(maximum, bounds.XMax)
            intervals[key] = (minimum, maximum)
        return intervals[key]

    proven, unresolved = [], []
    for position, i in enumerate(moving):
        for j in moving[position + 1:]:
            if channels[i] == channels[j]:
                continue
            evidence = None
            for angle in [0, 90] + list(range(5, 90, 5)) + list(range(95, 180, 5)):
                a, b = interval(i, angle), interval(j, angle)
                gap = max(b[0] - a[1], a[0] - b[1])
                if gap > 1e-6:
                    evidence = {'a': records[i]['id'], 'b': records[j]['id'],
                                'separatingAxisDegrees': angle, 'gap': gap}
                    break
            if evidence:
                proven.append(evidence)
            else:
                unresolved.append({'a': records[i]['id'], 'b': records[j]['id']})
    return {'sampleAngles': [sample['angle'] for sample in scenario['samples']],
            'movingComponents': len(moving), 'crossChannelPairs': len(proven) + len(unresolved),
            'separatedPairs': proven, 'unresolvedPairs': unresolved,
            'basis': 'Conservative native solid bounds over every sampled channel angle, with a separating XY projection axis for each cross-channel pair. Covers every independent combination of those sampled channel angles; does not claim an analytic continuous-motion proof.',
            'passed': not unresolved}


def check_motion_scenario(case, scope, scenario, progress_path=None, reused_samples=None, use_symmetry=False,
                          sample_angles=None):
    """Check changing contacts using exact configured poses and neutral BREP solids.

    Components with the same rigid motion keep the relative geometry already
    checked in neutral or the uniform limit cases. Every changing pair is
    checked at one-degree intervals in the supplied independent-angle scenario.
    """
    samples = scenario['samples']
    if len(samples) != 37:
        raise ValueError('Regenerate cases with all 37 configured motion samples.')
    records, shapes = case['components'], scope['components']
    reference = {r['id']: physical_placement(r).inverse() for r in records}
    transforms = []
    for sample in samples:
        indexed = {r['id']: r for r in sample['components']}
        if set(indexed) != set(reference):
            raise ValueError('Motion sample component identities differ from neutral.')
        matrices = []
        for record in records:
            pose = indexed[record['id']]
            placement = physical_placement(pose)
            spin = App.Placement(App.Vector(0, 0, 0), App.Rotation(
                App.Vector(0, 0, 1), pose.get('axialSpin', 0)))
            matrices.append(placement.multiply(spin).multiply(reference[record['id']]).toMatrix())
        transforms.append(matrices)
    signatures = [tuple(round(value, 8) for sample in transforms for value in sample[i].A)
                  for i in range(len(records))]
    varying = [len({tuple(round(v, 8) for v in sample[i].A) for sample in transforms}) > 1
               for i in range(len(records))]
    envelope = []
    for index, shape in enumerate(shapes):
        bounds = shape.BoundBox
        corners = [App.Vector(x, y, z) for x in [bounds.XMin, bounds.XMax]
                   for y in [bounds.YMin, bounds.YMax] for z in [bounds.ZMin, bounds.ZMax]]
        swept = App.BoundBox()
        for sample in transforms:
            for point in corners:
                swept.add(sample[index].multVec(point))
        envelope.append(swept)

    def overlaps(a, b):
        return min(min(a.XMax, b.XMax) - max(a.XMin, b.XMin),
                   min(a.YMax, b.YMax) - max(a.YMin, b.YMin),
                   min(a.ZMax, b.ZMax) - max(a.ZMin, b.ZMin)) > 1e-7

    pairs = [(i, j) for i in range(len(records)) for j in range(i + 1, len(records))
             if (varying[i] or varying[j]) and signatures[i] != signatures[j] and
                overlaps(envelope[i], envelope[j])]
    symmetry = None
    if scenario['id'] == 'synchronous' and use_symmetry:
        pairs, symmetry = synchronous_pair_orbits(records, shapes, transforms, pairs)
        print(json.dumps({'synchronousSymmetryProof': symmetry}), flush=True)
    results = list(reused_samples or [])
    completed = {sample['angle'] for sample in results}
    for sample, matrices in zip(samples, transforms):
        if sample['angle'] in completed:
            continue
        if sample_angles is not None and sample['angle'] not in sample_angles:
            continue
        posed = []
        for shape, matrix in zip(shapes, matrices):
            copy = shape.copy()
            copy.transformShape(matrix, True)
            posed.append(copy)
        collisions = []
        for i, j in pairs:
            a, b = posed[i], posed[j]
            if not overlaps(a.BoundBox, b.BoundBox):
                continue
            volume = intersection_volume(a, b)
            if volume <= .05:
                continue
            pilot = follower_pilot_press_fit(records[i], records[j], a, b, volume)
            if pilot and pilot['passed']:
                continue
            bounds = common_shape(a, b).BoundBox
            collisions.append({'a': records[i]['id'], 'b': records[j]['id'], 'volume': volume,
                               'bbox': [bounds.XMin, bounds.YMin, bounds.ZMin,
                                        bounds.XMax, bounds.YMax, bounds.ZMax]})
        results.append({'angle': sample['angle'], 'interferences': collisions,
                        'passed': not collisions})
        if progress_path:
            Path(progress_path).write_text(json.dumps({'id': scenario['id'], 'samples': results,
                                                      'complete': False}, indent=2))
        if sample['angle'] % 6 == 0:
            print(json.dumps({'motionScenario': scenario['id'], 'motionSweepAngle': sample['angle'],
                              'interferences': len(collisions)}), flush=True)
    results.sort(key=lambda sample: sample['angle'])
    return {'id': scenario['id'], 'mode': '37 configured poses at 1 degree intervals',
            'changingPairs': len(pairs), 'rigidMotionGroups': len(set(signatures)),
            'nativeSymmetryProof': symmetry, 'reusedFullPairStates': len(reused_samples or []),
            'samples': results, 'passed': all(r['passed'] for r in results)}


def check_motion_sweep(case, scope, jobs=1, cases_path=None, progress_dir=None):
    scenarios = case.get('motionScenarios', [])
    if len(scenarios) != 3:
        raise ValueError('Regenerate synchronous and independent-neighbor motion scenarios.')
    if jobs > 1 and cases_path:
        root = Path(progress_dir)
        root.mkdir(parents=True, exist_ok=True)
        def worker(scenario):
            output = root / ('motion-' + scenario['id'] + '.json')
            process = subprocess.run([sys.executable, str(Path(__file__).resolve()), str(cases_path),
                                      '--motion-scenario', scenario['id'], '--output', str(output)],
                                     capture_output=True, text=True)
            if process.returncode or not output.is_file():
                raise ValueError('Motion worker failed: ' + scenario['id'] + ' ' + process.stderr[-2000:])
            data = json.loads(output.read_text())
            if data['sourceCasesSha256'] != digest(cases_path):
                raise ValueError('Motion worker used different prepared cases.')
            print(json.dumps({'motionScenarioComplete': scenario['id'],
                              'passed': data['scenario']['passed']}), flush=True)
            return data['scenario']
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(jobs, 3)) as pool:
            results = list(pool.map(worker, scenarios))
    else:
        results = [check_motion_scenario(case, scope, scenario) for scenario in scenarios]
    return {'scenarios': results,
            'note': 'Synchronous channels plus channel one sweeping against neighbors held at each limit. Rigid/static relative contacts were already checked in neutral and uniform limit cases; changing contacts are checked here.',
            'passed': all(r['passed'] for r in results)}


def mesh_for_print(shape, record):
    import MeshPart
    local = shape.copy()
    x, y, z = record['placement']['rotation']
    rotation = App.Rotation(App.Vector(0, 0, 1), z).multiply(
        App.Rotation(App.Vector(0, 1, 0), y)
    ).multiply(App.Rotation(App.Vector(1, 0, 0), x))
    placement = App.Placement(App.Vector(*record['placement']['translation']), rotation)
    local.transformShape(placement.inverse().toMatrix(), True)
    bounds = local.BoundBox
    local.translate(App.Vector(-bounds.XMin, -bounds.YMin, -bounds.ZMin))
    mesh = MeshPart.meshFromShape(Shape=local, LinearDeflection=.02, AngularDeflection=.1, Relative=False)
    mesh.removeDuplicatedPoints()
    mesh.removeDuplicatedFacets()
    mesh.harmonizeNormals()
    if not mesh.isSolid() or mesh.Volume <= 0:
        raise ValueError('Non-manifold or inverted print mesh: ' + record['id'])
    return local, mesh


def export_render_mesh(case, scope, destination):
    """Write a disposable native tessellation for an isolated headless renderer."""
    records = []
    for record, shape in zip(case['components'], scope['components']):
        vertices, triangles = shape.tessellate(.12)
        records.append({'id': record['id'], 'label': record['label'],
                        'libraryId': record['libraryId'], 'color': record.get('color', 0xb8c1cc),
                        'vertices': [[v.x, v.y, v.z] for v in vertices], 'triangles': triangles})
    target = Path(destination)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({'layout': case['layout'], 'components': records}))
    print(json.dumps({'renderMesh': str(target), 'components': len(records)}), flush=True)


def export_revision(case, scope, report, args):
    import Import
    import Mesh
    target = Path(args.export_dir)
    target.mkdir(parents=True, exist_ok=True)
    motion = report.get('motionSweep', {}).get('scenarios', [])
    motion_states = sum(len(scenario['samples']) for scenario in motion)
    report['validationScope'] = {
        'staticPosesChecked': len(report['results']),
        'motionScenarioIds': [scenario['id'] for scenario in motion],
        'sampledMotionStates': motion_states,
        'independentNeighborXYSeparationProven': report.get('neighborXYSeparation', {}).get('passed', False),
        'motionAngleIncrementDegrees': 1,
        'bearingSeatDiametralInterference': case['parameters']['bearingPressFit'],
        'bearingContactAcceptance': 'Only exact specified body/bearing pairs, wholly inside the measured outer-race seat annulus.',
        'followerPinAcceptance': 'Nominal Ø3 pin in Ø2.9 printed pilot; only its bounded rocker contact is intentional.',
        'boreFitException': 'Only the four output shaft tips project through the reference tube windows.',
    }
    report['prototypeLimitations'] = [
        f'Nominal CAD and sampled kinematics; the {motion_states} checked states and any independent-neighbor XY interval proof do not establish analytic continuous motion between sampled angles.',
        'Simple-mode fastener/thread envelopes are used for interference checks.',
        'Printed tolerances, stiffness, creep, wear, clip installation force and clamp torque require physical qualification.',
        'No bearing preload, thrust capacity, fatigue life or powered operating rating is assigned; verify slow hand travel before bench demonstration.',
    ]
    prints = target / 'prints'
    prints.mkdir(exist_ok=True)
    full_path = Path(args.cases).with_suffix('.full-carriage.py')
    full_scope = {'App': App, 'Part': Part, 'math': math}
    exec(full_path.read_text(), full_scope)
    full = full_scope['shape']
    if not full.isValid() or not full.isClosed() or len(full.Solids) != 1:
        raise ValueError('The Full-mode carriage is invalid or disconnected.')
    (target / 'mpr-10-neutral.FCMacro').write_text(case['macro'])
    doc = App.newDocument('MPR10Demonstrator')
    try:
        exec(case['macro'], {})
        roots = [o for o in doc.Objects if getattr(o, 'PartId', None) == 'mpr-10-demonstrator']
        features = [o for o in doc.Objects if hasattr(o, 'ComponentIndex')]
        if len(roots) != 1 or len(features) != len(case['components']):
            raise ValueError('The full macro lost physical assembly components.')
        doc.recompute()
        doc.saveAs(str(target / 'mpr-10-neutral.FCStd'))
        Import.export(roots, str(target / 'mpr-10-neutral.step'))
    finally:
        App.closeDocument(doc.Name)
    expected = scope['shape']
    doc = App.newDocument('MPR10ExportReimport')
    try:
        Import.insert(str(target / 'mpr-10-neutral.step'), doc.Name)
        shapes = [o.Shape for o in doc.Objects if hasattr(o, 'Shape') and not o.Shape.isNull() and o.Shape.Solids]
        assembly = max(shapes, key=lambda s: len(s.Solids))
        if not assembly.isValid() or not assembly.isClosed() or len(assembly.Solids) != len(expected.Solids):
            raise ValueError('The exported STEP lost valid closed solids.')
        bb, eb = assembly.BoundBox, expected.BoundBox
        dims, expected_dims = [bb.XLength, bb.YLength, bb.ZLength], [eb.XLength, eb.YLength, eb.ZLength]
        if any(abs(a - b) > .05 for a, b in zip(dims, expected_dims)):
            raise ValueError('The reimported STEP envelope differs from the generated assembly.')
        step_check = {'valid': True, 'closed': True, 'solids': len(assembly.Solids), 'dimensions': dims}
    finally:
        App.closeDocument(doc.Name)
    groups = {}
    for shape, record in zip(scope['components'], case['components']):
        if not record['printed']:
            continue
        stamp = hashlib.sha256(json.dumps([record['libraryId'], record['parameters'], record['state']], sort_keys=True).encode()).hexdigest()
        if stamp in groups:
            groups[stamp]['quantity'] += 1
            groups[stamp]['occurrences'].append(record['id'])
            continue
        local, mesh = mesh_for_print(shape, record)
        slug = re.sub(r'^channel-\d-', '', record['id'])
        filename = slug + '.stl'
        if any(g['file'] == filename for g in groups.values()):
            filename = slug + '-' + stamp[:8] + '.stl'
        mesh.write(str(prints / filename))
        reopened = Mesh.Mesh(str(prints / filename))
        if not reopened.isSolid() or reopened.Volume <= 0:
            raise ValueError('Written STL is not a closed positive-volume mesh: ' + filename)
        groups[stamp] = {
            'file': filename, 'name': re.sub(r'^CH\d · ', '', record['label']),
            'quantity': 1, 'occurrences': [record['id']],
            'material': record.get('manufacturing', {}).get('material', ''),
            'dimensions': [local.BoundBox.XLength, local.BoundBox.YLength, local.BoundBox.ZLength],
            'closed': True, 'facets': reopened.CountFacets, 'volume': reopened.Volume,
        }
    with (target / 'printed-parts.csv').open('w', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['STL file', 'Component', 'Quantity', 'Material', 'Local dimensions mm'])
        for group in groups.values():
            writer.writerow([group['file'], group['name'], group['quantity'], group['material'], ' x '.join(f'{v:.3f}' for v in group['dimensions'])])
    bom = {}
    for record in case['components']:
        key = json.dumps([record['libraryId'], record['parameters'], record['state']], sort_keys=True)
        if key not in bom:
            bom[key] = {'name': re.sub(r'^CH\d · ', '', record['label']), 'library': record['libraryId'], 'supply': record['supply'], 'quantity': 0, 'material': record.get('manufacturing', {}).get('material', '')}
        bom[key]['quantity'] += 1
    with (target / 'assembly-bom.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=['name', 'library', 'supply', 'quantity', 'material'])
        writer.writeheader()
        writer.writerows(bom.values())
    report.update(fullCarriageValid=True, stepReimport=step_check,
                  printMeshCount=len(groups), printedOccurrenceCount=sum(g['quantity'] for g in groups.values()),
                  prints=list(groups.values()),
                  note='STLs use component-local axes translated to positive coordinates; choose print orientation using GUIDE.md. Parts are a demonstration prototype.')
    repo = Path(__file__).resolve().parents[1]
    shutil.copyfile(repo / 'src/parts/mpr-10-demonstrator/GUIDE.md', target / 'GUIDE.md')
    (target / 'README.txt').write_text(
        'MPR.10 printed mechanism demonstrator\n\n'
        'Open mpr-10-neutral.FCStd to inspect the named assembly, or import mpr-10-neutral.step into CAD. '
        'The prints folder contains one STL per unique printed geometry. Quantities are listed in printed-parts.csv; units are millimetres. '
        'STLs use component-local axes translated to positive coordinates; select the print orientation in the slicer using GUIDE.md. '
        'assembly-bom.csv lists the remaining physical components. verification.json records the current native CAD checks. '
        'The steel shafts, screw end journals and retaining grooves require the custom operations described in GUIDE.md.\n'
    )
    include = ['mpr-10-neutral.FCStd', 'mpr-10-neutral.step', 'mpr-10-neutral.FCMacro',
               'printed-parts.csv', 'assembly-bom.csv', 'verification.json', 'GUIDE.md', 'README.txt']
    if args.preview:
        preview = Path(args.preview)
        if not preview.is_file():
            raise ValueError('The requested preview image does not exist.')
        destination = target / 'tube-preview.png'
        if preview.resolve() != destination.resolve():
            shutil.copyfile(preview, destination)
        include.append('tube-preview.png')
    if args.assembly_preview:
        preview = Path(args.assembly_preview)
        if not preview.is_file():
            raise ValueError('The requested assembly preview image does not exist.')
        destination = target / 'assembly-preview.png'
        if preview.resolve() != destination.resolve():
            shutil.copyfile(preview, destination)
        include.append('assembly-preview.png')
    for filename in args.extra_preview:
        preview = Path(filename)
        if not preview.is_file() or preview.suffix.lower() != '.png':
            raise ValueError('Extra previews must be explicit existing PNG files.')
        destination = target / preview.name
        if preview.name in include:
            raise ValueError('The extra preview filename duplicates an archive entry.')
        if preview.resolve() != destination.resolve():
            shutil.copyfile(preview, destination)
        include.append(preview.name)
    include += ['prints/' + g['file'] for g in groups.values()]
    (target / 'verification.json').write_text(json.dumps(report, indent=2))
    manifest = {'sourceCasesSha256': report['sourceCasesSha256'],
                'files': {name: digest(target / name) for name in include}}
    (target / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    include.append('manifest.json')
    archive = target / 'mpr-10-demonstrator.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        for name in include:
            output.write(target / name, name)
    with zipfile.ZipFile(archive) as check:
        if check.testzip() is not None or set(check.namelist()) != set(include):
            raise ValueError('The final archive failed its integrity or manifest check.')
    return {'exportDirectory': str(target), 'archive': str(archive), 'bytes': archive.stat().st_size,
            'uniquePrints': len(groups), 'printedOccurrences': report['printedOccurrenceCount'],
            'physicalComponents': len(case['components']), 'fullCarriageValid': True,
            'stepReimport': step_check, 'zipEntries': len(include)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cases', nargs='?', default='/tmp/mpr10-native-cases.json')
    parser.add_argument('--output', default='/tmp/mpr10-native-results.json')
    parser.add_argument('--only', default='', help='One diagnostic pose; export requires every prepared pose.')
    parser.add_argument('--jobs', type=int, default=1, help='Independent native processes, from 1 to 4.')
    parser.add_argument('--export-dir', help='Export the verified neutral assembly and component-local prints.')
    parser.add_argument('--preview', help='Explicit current-revision preview PNG to include in the archive.')
    parser.add_argument('--assembly-preview', help='Explicit current-revision assembly PNG to include in the archive.')
    parser.add_argument('--extra-preview', action='append', default=[], help='Additional explicit current-revision PNG; may be repeated.')
    parser.add_argument('--motion-sweep', action='store_true', help='Check every changing contact in the 37 configured synchronous poses.')
    parser.add_argument('--diagnostic', action='store_true', help='Collect fabricated-detail failures and collisions together; disables export.')
    parser.add_argument('--render-mesh', help='Write native neutral tessellations for an isolated renderer after successful validation.')
    parser.add_argument('--motion-scenario', help='Run one isolated motion scenario without repeating static checks.')
    parser.add_argument('--baseline-cases', help='Previously verified cases for exact rigid-pair reuse in static checks.')
    parser.add_argument('--baseline-report', help='Passed native report bound to the baseline cases SHA256.')
    args = parser.parse_args()
    if not 1 <= args.jobs <= 4:
        parser.error('--jobs must be between 1 and 4.')
    source_sha = digest(args.cases)
    cases = json.loads(Path(args.cases).read_text())
    baselines = {}
    if bool(args.baseline_cases) != bool(args.baseline_report):
        parser.error('Incremental checking requires both baseline cases and their passed report.')
    if args.baseline_cases:
        baseline_sha = digest(args.baseline_cases)
        baseline_report = json.loads(Path(args.baseline_report).read_text())
        if not baseline_report['passed'] or baseline_report['sourceCasesSha256'] != baseline_sha:
            parser.error('The baseline report must pass and match its exact cases SHA256.')
        baseline_cases = {c['id']: c for c in json.loads(Path(args.baseline_cases).read_text())}
        baseline_results = {r['id']: r for r in baseline_report['results']}
        for case in cases:
            name = case['id']
            if name not in baseline_cases or name not in baseline_results or not baseline_results[name]['passed']:
                parser.error('The corresponding baseline pose has not passed: ' + name)
            baselines[name] = {'case': baseline_cases[name], 'result': baseline_results[name],
                               'sourceCasesSha256': baseline_sha}
    if args.motion_scenario:
        if args.export_dir:
            parser.error('A motion worker cannot export an assembly.')
        neutral = next(c for c in cases if c['id'] == 'neutral')
        scenario = next(s for s in neutral['motionScenarios'] if s['id'] == args.motion_scenario)
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        result = check_motion_scenario(neutral, execute(neutral), scenario, output)
        if digest(args.cases) != source_sha:
            raise ValueError('Cases changed during the isolated motion check.')
        output.write_text(json.dumps({'sourceCasesSha256': source_sha, 'scenario': result,
                                      'complete': True}, indent=2))
        return 0
    selected = [c for c in cases if not args.only or c['id'] == args.only]
    if not selected:
        parser.error('The requested diagnostic pose was not found.')
    if args.export_dir and len(selected) != len(cases):
        parser.error('Export requires all prepared poses; omit --only.')
    if args.export_dir and args.diagnostic:
        parser.error('Diagnostic mode cannot export.')
    report = {'freecadVersion': App.Version(), 'sourceCasesSha256': source_sha,
              'preparedCaseIds': [c['id'] for c in cases], 'results': []}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    if args.jobs > 1 and len(selected) > 1:
        def worker(task):
            index, case = task
            with tempfile.TemporaryDirectory(prefix='mpr10-native-') as temp:
                result_file = Path(temp) / 'result.json'
                process = subprocess.run([sys.executable, str(Path(__file__).resolve()), args.cases,
                                          '--only', case['id'], '--output', str(result_file)] +
                                         (['--diagnostic'] if args.diagnostic else []) +
                                         (['--baseline-cases', args.baseline_cases, '--baseline-report', args.baseline_report]
                                          if args.baseline_cases else []),
                                         capture_output=True, text=True)
                if not result_file.is_file():
                    return index, {'id': case['id'], 'errors': [{'error': process.stderr[-2000:]}], 'passed': False}
                data = json.loads(result_file.read_text())
                result = data['results'][0]
                if process.returncode and result['passed']:
                    result['errors'].append({'error': 'Native worker failed after component checks.', 'details': process.stderr[-2000:]})
                    result['passed'] = False
                return index, result
        ordered = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
            futures = [pool.submit(worker, task) for task in enumerate(selected)]
            for future in concurrent.futures.as_completed(futures):
                index, result = future.result()
                ordered[index] = result
                print(json.dumps(result_summary(result)), flush=True)
                report['results'] = [ordered[i] for i in sorted(ordered)]
                output.write_text(json.dumps(report, indent=2))
    else:
        for case in selected:
            result = check_case(case, args.diagnostic, baselines.get(case['id']))
            report['results'].append(result)
            print(json.dumps(result_summary(result)), flush=True)
            output.write_text(json.dumps(report, indent=2))
    report['allPreparedCasesChecked'] = len(report['results']) == len(cases)
    passed = all(r['passed'] for r in report['results'])
    if digest(args.cases) != source_sha:
        raise ValueError('Prepared cases changed during verification; regenerate and rerun.')
    neutral = next((c for c in selected if c['id'] == 'neutral'), None)
    neutral_scope = None
    if passed and neutral is not None and not args.only:
        neutral_scope = execute(neutral)
        report['saddleSweep'] = check_sweep(neutral, neutral_scope)
        report['screwWorkingRange'] = check_screw_working_range(neutral, neutral_scope)
        report['eClipGrooves'] = check_eclip_grooves(neutral, neutral_scope)
        report['forkContract'] = check_fork_contract(neutral, neutral_scope)
        passed = (passed and report['saddleSweep']['passed'] and report['screwWorkingRange']['passed'] and
                  report['eClipGrooves']['passed'] and report['forkContract']['passed'])
        output.write_text(json.dumps(report, indent=2))
        if passed and args.motion_sweep:
            report['motionSweep'] = check_motion_sweep(neutral, neutral_scope, args.jobs,
                                                       args.cases, output.parent)
            passed = passed and report['motionSweep']['passed']
    report['passed'] = passed
    output.write_text(json.dumps(report, indent=2))
    if passed and args.export_dir:
        if neutral is None:
            raise ValueError('The neutral pose is required for export.')
        result = export_revision(neutral, neutral_scope, report, args)
        print(json.dumps(result), flush=True)
        output.write_text(json.dumps(report, indent=2))
    if passed and args.render_mesh:
        if neutral is None:
            raise ValueError('The neutral pose is required for a reference render.')
        export_render_mesh(neutral, neutral_scope or execute(neutral), args.render_mesh)
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
