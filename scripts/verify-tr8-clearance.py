"""Certify compact TR8 actuator clearance and independent nut-cover anti-roll.

CLI: FreeCAD Python scripts/verify-tr8-clearance.py cases.json [report.json]
     [--native neutral-motion.FCStd] [--mode full|simple]

The supplied neutral BReps are reused without rebuilding each pose. Nut and
cover translate by 10*tan(angle); the shaft and closed forks rotate about Y
through the origin. Forty-one actual distance checks plus a rigid-motion
Lipschitz bound cover every angle in -20..20 degrees. Integral pin clearance
has a separate continuous capsule-path proof and deliberate escape controls.
Anti-roll uses the real cover clipped to Y=-11..11, excluding both pins.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

PART_ID = 'tr8-compact-actuator'
PIVOT = App.Vector(0, 0, 0)
SCREW_ORIGIN = App.Vector(0, 0, 10)
SCREW_AXIS = App.Vector(1, 0, 0)
RADIUS = 10.0
SLOT_CENTRES = (9.7, 10.95)
SLOT_WIDTH = 4.1
PIN_RADIUS = 2.0
PIN_Y = (11.0, 14.2)
ARM_IDS = ['output-front-crank', 'output-rear-crank']


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def physical_features(root):
    for item in root.Group:
        if item.TypeId == 'App::Part':
            yield from physical_features(item)
        elif hasattr(item, 'Shape') and hasattr(item, 'AssemblyOccurrenceId'):
            yield item


def world_shape(item):
    shape = item.Shape.copy()
    shape.Placement = item.getGlobalPlacement()
    return shape


def translated(shape, travel):
    result = shape.copy()
    result.translate(App.Vector(travel, 0, 0))
    return result


def rotated(shape, angle):
    result = shape.copy()
    result.rotate(PIVOT, App.Vector(0, 1, 0), angle)
    return result


def distance(first, second):
    value, points, _ = first.distToShape(second)
    assert math.isfinite(value) and value >= 0, 'Invalid native BRep distance.'
    return value, [[list(a), list(b)] for a, b in points[:1]]


def valid_solid(shape, label):
    assert not shape.isNull() and shape.isValid() and shape.isClosed(), ('Invalid/open solid', label)
    assert len(shape.Solids) == 1 and math.isfinite(shape.Volume) and shape.Volume > 0, ('Expected one solid', label)


def clipped_solid(shape, low_y, high_y, label):
    box = shape.BoundBox
    mask = Part.makeBox(box.XLength + 2, high_y - low_y, box.ZLength + 2,
                        App.Vector(box.XMin - 1, low_y, box.ZMin - 1))
    # A touching clipping plane may leave boundary faces; retain all positive
    # material and reject any unexpected second solid rather than hiding it.
    solids = [solid for solid in shape.common(mask).Solids if solid.Volume > 1e-9]
    assert len(solids) == 1, ('Unexpected clipped material components', label, len(solids))
    result = solids[0].copy()
    valid_solid(result, label)
    assert result.BoundBox.YMin >= low_y - 1e-6 and result.BoundBox.YMax <= high_y + 1e-6
    return result


def antiroll_proof(cover, forks):
    body = clipped_solid(cover, -PIN_Y[0], PIN_Y[0], 'Pin-free nut cover')
    assert body.Volume < cover.Volume, 'The independent body proof must remove both integral pins.'
    removed = cover.Volume - body.Volume
    expected_removed = 2 * math.pi * PIN_RADIUS**2 * (PIN_Y[1] - PIN_Y[0])
    assert abs(removed - expected_removed) < 1e-5, ('The clipping mask must remove exactly the two pins', removed, expected_removed)
    rows = []
    for output_angle in [-20, -10, 0, 10, 20]:
        travel = RADIUS * math.tan(math.radians(output_angle))
        posed_body = translated(body, travel)
        posed_cover = translated(cover, travel)
        posed_forks = {side: rotated(shape, output_angle) for side, shape in forks.items()}

        def probe(roll, source=posed_body):
            moved = source.copy()
            moved.rotate(SCREW_ORIGIN, SCREW_AXIS, roll)
            valid_solid(moved, 'Rolled pin-free cover')
            contacts = []
            for side, arm in posed_forks.items():
                if not moved.BoundBox.intersect(arm.BoundBox):
                    continue
                volume = moved.common(arm).Volume
                assert math.isfinite(volume), ('Invalid anti-roll intersection', output_angle, roll)
                if volume > 1e-6:
                    contacts.append({'arm': 'output-' + side + '-crank', 'volumeMm3': volume})
            return {'nutRollDegrees': roll, 'interference': contacts, 'blocked': bool(contacts)}

        checks = [probe(roll) for roll in [0, -0.5, 0.5, -1, 1, -1.5, 1.5]]
        complete_checks = [probe(roll, posed_cover) for roll in [0, -1.5, 1.5]]
        assert not checks[0]['blocked'] and not complete_checks[0]['blocked'], ('Nominal cover/pins must clear both forks', output_angle)
        for check in checks:
            if abs(check['nutRollDegrees']) == 1.5:
                assert {contact['arm'] for contact in check['interference']} == set(ARM_IDS), (
                    'Both fork faces must independently block cover roll without pins', output_angle, check)
        first_contact = {}
        for sign, name in [(-1, 'negative'), (1, 'positive')]:
            clear, blocked = 0.0, 1.5
            for _ in range(12):
                middle = (clear + blocked) / 2
                if probe(sign * middle)['blocked']:
                    blocked = middle
                else:
                    clear = middle
            first_contact[name] = sign * blocked
        rows.append({'outputAngleDegrees': output_angle, 'nutTravelMm': travel,
                     'pinFreeBodyVolumeMm3': body.Volume, 'completeCoverVolumeMm3': cover.Volume,
                     'faceCaptureChecks': checks, 'completeCoverChecks': complete_checks,
                     'firstFaceContactDegrees': first_contact})
    return {'passed': True, 'description': 'Actual Y=-11..11 cover body is blocked by both real closed-fork faces in both roll directions. Pins and all screws are excluded from the independent face-capture proof.',
            'screwAxis': {'point': list(SCREW_ORIGIN), 'direction': list(SCREW_AXIS)},
            'pinFreeCoverRegionY': [-PIN_Y[0], PIN_Y[0]], 'poses': rows}


def run(cases_path, report_path=None, native_path=None, mode='full'):
    started = time.perf_counter()
    cases_path = Path(cases_path).resolve()
    report_path = Path(report_path).resolve() if report_path else cases_path.with_name(('full-' if mode == 'full' else '') + 'clearance-report.json')
    cases = json.loads(cases_path.read_text())
    candidates = [case for case in cases if case['id'] == PART_ID and case['mode'] == mode
                  and case['parameters']['outputAngle'] == 0]
    assert candidates, 'Supply the requested neutral TR8 assembly case.'
    case = candidates[0]
    groups = {}
    doc = None
    native_sha = None
    try:
        if native_path:
            native_path = Path(native_path).resolve()
            native_sha = digest(native_path)
            doc = App.openDocument(str(native_path))
            root = next(item for item in doc.RootObjects if getattr(item, 'PartId', None) == PART_ID)
            assert json.loads(root.Configuration) == case['parameters'], 'Native configuration does not match the neutral case.'
            assert getattr(root, 'GeometryMode', None) == mode, 'Native geometry mode differs from the selected case.'
            if hasattr(root, 'MotionControl'):
                assert abs(root.MotionControl.OutputAngle.Value) < 1e-9, 'The saved motion document must be neutral.'
            for item in physical_features(root):
                groups.setdefault(item.AssemblyOccurrenceId, []).append(world_shape(item))
        else:
            scope = {'App': App, 'Part': Part, 'math': math}
            exec(case['source'], scope)
            for shape, metadata in zip(scope['components'], scope['component_metadata']):
                groups.setdefault(metadata['AssemblyOccurrenceId'], []).append(shape)
        ids = ['lead-nut', 'nut-yoke', 'output-shaft', *ARM_IDS]
        assert all(len(groups.get(identity, [])) == 1 for identity in ids), 'Expected one actual solid for each nut/cover/shaft/fork occurrence.'
        nut, cover, shaft = (groups[identity][0] for identity in ids[:3])
        forks = {side: groups['output-' + side + '-crank'][0] for side in ['front', 'rear']}
        for identity in ids:
            valid_solid(groups[identity][0], identity)
        pins = {}
        for side, lo, hi in [('front', -PIN_Y[1], -PIN_Y[0]), ('rear', PIN_Y[0], PIN_Y[1])]:
            pin = clipped_solid(cover, lo, hi, side + ' integral pin')
            expected = math.pi * PIN_RADIUS**2 * (hi - lo)
            assert abs(pin.Volume - expected) < 1e-5, ('Unexpected actual pin volume', side, pin.Volume, expected)
            assert abs(pin.BoundBox.XMin + PIN_RADIUS) < 1e-6 and abs(pin.BoundBox.XMax - PIN_RADIUS) < 1e-6
            assert abs(pin.BoundBox.ZMin - (RADIUS - PIN_RADIUS)) < 1e-6 and abs(pin.BoundBox.ZMax - (RADIUS + PIN_RADIUS)) < 1e-6
            pins[side] = pin
        print(json.dumps({'stage': 'neutral-breps-loaded', 'mode': mode}), flush=True)
        rows = []
        for angle in range(-20, 21):
            travel = RADIUS * math.tan(math.radians(angle))
            posed_shaft = rotated(shaft, angle)
            nut_gap, nut_points = distance(translated(nut, travel), posed_shaft)
            cover_gap, cover_points = distance(translated(cover, travel), posed_shaft)
            pin_rows = []
            for side in forks:
                gap, _ = distance(translated(pins[side], travel), rotated(forks[side], angle))
                assert gap > 1e-6, ('Actual pin touches the closed fork', angle, side, gap)
                pin_rows.append({'side': side, 'clearanceMm': gap})
            assert min(nut_gap, cover_gap) > 1e-6, ('Nut/cover touches the output shaft', angle, nut_gap, cover_gap)
            rows.append({'angleDegrees': angle, 'nutTravelMm': travel, 'nutToShaftMm': nut_gap,
                         'nutNearestPoints': nut_points, 'coverToShaftMm': cover_gap,
                         'coverNearestPoints': cover_points, 'pinToClosedFork': pin_rows})
        box = shaft.BoundBox
        radial_bound = math.hypot(max(abs(box.XMin), abs(box.XMax)), max(abs(box.ZMin), abs(box.ZMax)))
        translation_speed = RADIUS / math.cos(math.radians(20))**2
        lipschitz = translation_speed + radial_bound
        between_sample_loss = lipschitz * math.radians(0.5)
        nut_min = min(rows, key=lambda row: row['nutToShaftMm'])
        cover_min = min(rows, key=lambda row: row['coverToShaftMm'])
        continuous_nut = nut_min['nutToShaftMm'] - between_sample_loss
        continuous_cover = cover_min['coverToShaftMm'] - between_sample_loss
        assert min(continuous_nut, continuous_cover) > 0, 'Sampling is too sparse to certify continuous shaft clearance.'
        radial_range = (RADIUS, RADIUS / math.cos(math.radians(20)))
        running_gap = SLOT_WIDTH / 2 - PIN_RADIUS
        lower_end_gap = radial_range[0] - SLOT_CENTRES[0] + running_gap
        upper_end_gap = SLOT_CENTRES[1] - radial_range[1] + running_gap
        assert SLOT_CENTRES[0] <= radial_range[0] <= radial_range[1] <= SLOT_CENTRES[1]
        assert min(running_gap, lower_end_gap, upper_end_gap) > 0
        pin_min = min(value['clearanceMm'] for row in rows for value in row['pinToClosedFork'])
        assert abs(pin_min - running_gap) < 1e-5, ('Actual pin gap differs from capsule running clearance', pin_min, running_gap)
        escape_controls = []
        for side in forks:
            for direction, target_radius in [('inward', SLOT_CENTRES[0] - 0.25), ('outward', SLOT_CENTRES[1] + 0.25)]:
                escaped = pins[side].copy()
                escaped.translate(App.Vector(0, 0, target_radius - RADIUS))
                overlap = escaped.common(forks[side]).Volume
                assert math.isfinite(overlap) and overlap > 1e-6, ('A real closed end must block radial escape', side, direction, overlap)
                escape_controls.append({'side': side, 'attempt': direction, 'attemptedPinRadiusMm': target_radius, 'interferenceMm3': overlap})
        antiroll = antiroll_proof(cover, forks)
        if native_path:
            assert digest(native_path) == native_sha, 'The native file changed during verification.'
        provenance = {'casesPath': str(cases_path), 'casesSha256': digest(cases_path),
                      'neutralRecipeSha256': hashlib.sha256(case['source'].encode()).hexdigest(),
                      'checkerSourceSha256': digest(__file__), 'nativeFile': str(native_path) if native_path else None,
                      'nativeFileSha256': native_sha}
        report = {
            'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]),
            'partId': PART_ID, 'passed': True, 'geometryMode': mode, 'samples': len(rows), 'poses': rows,
            'minimumNutToShaft': {'millimetres': nut_min['nutToShaftMm'], 'angleDegrees': nut_min['angleDegrees']},
            'minimumCoverToShaft': {'millimetres': cover_min['coverToShaftMm'], 'angleDegrees': cover_min['angleDegrees']},
            'continuousShaftClearance': {
                'method': 'BRep distance is Lipschitz under rigid motion: translation derivative <=10*sec²20 mm/rad, shaft displacement <=enclosing XZ radial extent times angle. Every angle is within 0.5 degree of a measured pose.',
                'shaftRadialExtentBoundMm': radial_bound, 'translationDerivativeBoundMmPerRadian': translation_speed,
                'distanceDerivativeBoundMmPerRadian': lipschitz, 'maximumBetweenSampleLossMm': between_sample_loss,
                'nutClearanceLowerBoundMm': continuous_nut, 'coverClearanceLowerBoundMm': continuous_cover,
            },
            'closedPinPath': {
                'method': '10*tan(angle) places each pin on fork-local X=0 with radius10/cos(angle). Actual circular Ø4 pins remain parallel to the through-slot axes. This full radial range lies on the capsule centreline segment, whose radius exceeds the pin radius by the stated gap.',
                'slotCentrelineMm': list(SLOT_CENTRES), 'slotWidthMm': SLOT_WIDTH, 'pinDiameterMm': 2 * PIN_RADIUS,
                'pinRadiusRangeMm': list(radial_range), 'analyticRunningClearanceMm': running_gap,
                'measuredMinimumClearanceMm': pin_min, 'lowerClosedEndClearanceMm': lower_end_gap,
                'upperClosedEndClearanceMm': upper_end_gap, 'radialEscapePositiveControls': escape_controls,
            },
            'antiRoll': antiroll, 'provenance': provenance, 'elapsedSeconds': time.perf_counter() - started,
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2))
        print(json.dumps({'passed': True, 'report': str(report_path), 'minimumNutToShaftMm': nut_min['nutToShaftMm'],
                          'minimumCoverToShaftMm': cover_min['coverToShaftMm'], 'minimumPinGapMm': pin_min,
                          'continuousCoverLowerBoundMm': continuous_cover, 'antiRollPoses': len(antiroll['poses'])}), flush=True)
        return report
    finally:
        if doc:
            App.closeDocument(doc.Name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cases')
    parser.add_argument('report', nargs='?')
    parser.add_argument('--native')
    parser.add_argument('--mode', choices=['full', 'simple'], default='full')
    args = parser.parse_args()
    run(args.cases, args.report, args.native, args.mode)
