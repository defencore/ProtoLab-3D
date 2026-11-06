"""Measure actual closed-fork actuator BRep clearances over the full angle range.

CLI: FreeCAD Python scripts/verify-sfk-clearance.py cases.json [report.json]
     [--native neutral.FCStd]

Reuses one neutral assembly. Nut/cover translate by 13*tan(angle); the shaft and
forks rotate about (19.5,0,15). A conservative rigid-motion bound certifies the
nut/cover-to-shaft gaps between the 41 samples. Capsule-slot centerline geometry
provides the independent continuous pin-path bound; actual BReps check all poses
and deliberate radial escape attempts test both closed end walls.
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

PIVOT = App.Vector(19.5, 0, 15)
RADIUS = 13.0
SLOT_CENTRES = (12.6, 14.2)
SLOT_WIDTH = 4.1
PIN_RADIUS = 2.0
PIN_Y = (10.0, 13.2)


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


def distance(first, second):
    value, points, _ = first.distToShape(second)
    assert math.isfinite(value) and value >= 0
    return value, [[list(a), list(b)] for a, b in points[:1]]


def translated(shape, travel):
    result = shape.copy()
    result.translate(App.Vector(travel, 0, 0))
    return result


def rotated(shape, angle, pivot=PIVOT):
    result = shape.copy()
    result.rotate(pivot, App.Vector(0, 1, 0), angle)
    return result


def run(cases_path, report_path=None, native_path=None, drive_offset_z=0, output_pivot_x=None):
    pivot = App.Vector(PIVOT.x if output_pivot_x is None else output_pivot_x, 0, PIVOT.z + drive_offset_z)
    started = time.perf_counter()
    cases_path = Path(cases_path).resolve()
    report_path = Path(report_path).resolve() if report_path else cases_path.with_name('clearance-report.json')
    cases = json.loads(cases_path.read_text())
    mode = 'full' if native_path and 'full' in Path(native_path).name else 'simple'
    candidates = [case for case in cases if case['mode'] == mode and case['parameters']['outputAngle'] == 0]
    assert candidates, 'Supply a neutral assembly case.'
    case = candidates[0]
    groups, labels = {}, {}
    doc = None
    native_sha = None
    try:
        if native_path:
            native_path = Path(native_path).resolve()
            native_sha = digest(native_path)
            doc = App.openDocument(str(native_path))
            root = next(item for item in doc.RootObjects if getattr(item, 'PartId', None) == case['id'])
            assert json.loads(root.Configuration) == case['parameters']
            if hasattr(root, 'MotionControl'):
                assert abs(root.MotionControl.OutputAngle.Value) < 1e-9, 'Use the neutral pose.'
            for item in physical_features(root):
                groups.setdefault(item.AssemblyOccurrenceId, []).append(world_shape(item))
                labels.setdefault(item.AssemblyOccurrenceId, []).append(item.Label)
        else:
            scope = {'App': App, 'Part': Part, 'math': math}
            exec(case['source'], scope)
            for shape, metadata, label in zip(scope['components'], scope['component_metadata'], scope['component_labels']):
                identity = metadata['AssemblyOccurrenceId']
                groups.setdefault(identity, []).append(shape)
                labels.setdefault(identity, []).append(label)
        nut_parts = [shape for shape, label in zip(groups['ball-screw'], labels['ball-screw'])
                     if '/ Screw shaft' not in label]
        assert nut_parts and len(nut_parts) < len(groups['ball-screw'])
        nut = Part.makeCompound(nut_parts)
        assert len(groups['nut-yoke']) == len(groups['output-shaft']) == 1
        cover, shaft = groups['nut-yoke'][0], groups['output-shaft'][0]
        forks = {side: groups[f'output-{side}-crank'][0] for side in ['front', 'rear']}
        for shape in [nut, cover, shaft, *forks.values()]:
            assert shape.isValid() and shape.isClosed() and shape.Volume > 0
        # Clip existing material only. Discard any zero-volume boundary faces
        # where the mask touches the cover flats; keep the actual pin solids.
        box = cover.BoundBox
        pins = {}
        for side, low in [('front', -PIN_Y[1]), ('rear', PIN_Y[0])]:
            mask = Part.makeBox(box.XLength + 2, PIN_Y[1] - PIN_Y[0], box.ZLength + 2,
                                App.Vector(box.XMin - 1, low, box.ZMin - 1))
            solids = cover.common(mask).Solids
            assert len(solids) == 1, ('Expected one actual integral pin', side, len(solids))
            pin = solids[0]
            assert pin.isValid() and pin.isClosed() and pin.Volume > 0
            assert abs(pin.Volume - math.pi * PIN_RADIUS**2 * (PIN_Y[1] - PIN_Y[0])) < 1e-5
            pins[side] = pin
        print(json.dumps({'stage': 'neutral-breps-loaded', 'mode': mode, 'nutComponents': len(nut_parts)}), flush=True)
        rows = []
        for angle in range(-20, 21):
            travel = RADIUS * math.tan(math.radians(angle))
            posed_shaft = rotated(shaft, angle, pivot)
            nut_distance, nut_points = distance(translated(nut, travel), posed_shaft)
            cover_distance, cover_points = distance(translated(cover, travel), posed_shaft)
            pin_rows = []
            for side in ['front', 'rear']:
                pin_gap, _ = distance(translated(pins[side], travel), rotated(forks[side], angle, pivot))
                assert pin_gap > 1e-6, ('Integral pin touches the closed fork', angle, side, pin_gap)
                pin_rows.append({'side': side, 'clearanceMm': pin_gap})
            assert min(nut_distance, cover_distance) > 1e-6, ('Nut or cover touches the perpendicular shaft', angle, nut_distance, cover_distance)
            rows.append({'angleDegrees': angle, 'nutTravelMm': travel,
                         'nutToShaftMm': nut_distance, 'nutNearestPoints': nut_points,
                         'coverToShaftMm': cover_distance, 'coverNearestPoints': cover_points,
                         'pinToClosedFork': pin_rows})
        # Rigid translation has speed R*sec²(angle); a rotating point moves by
        # at most its radial distance times the rotation angle. The BRep's
        # enclosing XZ box supplies a conservative radial bound for every point.
        shaft_box = shaft.BoundBox
        radial_bound = math.hypot(max(abs(shaft_box.XMin-pivot.x), abs(shaft_box.XMax-pivot.x)),
                                  max(abs(shaft_box.ZMin-pivot.z), abs(shaft_box.ZMax-pivot.z)))
        translation_speed = RADIUS / math.cos(math.radians(20))**2
        lipschitz = translation_speed + radial_bound
        between_sample_loss = lipschitz * math.radians(0.5)
        nut_min = min(rows, key=lambda row: row['nutToShaftMm'])
        cover_min = min(rows, key=lambda row: row['coverToShaftMm'])
        continuous_nut = nut_min['nutToShaftMm'] - between_sample_loss
        continuous_cover = cover_min['coverToShaftMm'] - between_sample_loss
        assert min(continuous_nut, continuous_cover) > 0, 'Increase sampling density before claiming continuous shaft clearance.'
        radial_range = (RADIUS, RADIUS / math.cos(math.radians(20)))
        running_gap = SLOT_WIDTH / 2 - PIN_RADIUS
        lower_end_gap = radial_range[0] - SLOT_CENTRES[0] + running_gap
        upper_end_gap = SLOT_CENTRES[1] - radial_range[1] + running_gap
        assert SLOT_CENTRES[0] <= radial_range[0] <= radial_range[1] <= SLOT_CENTRES[1]
        assert min(running_gap, lower_end_gap, upper_end_gap) > 0
        pin_min = min(value['clearanceMm'] for row in rows for value in row['pinToClosedFork'])
        assert abs(pin_min - running_gap) < 1e-5, ('Actual BRep pin gap must match the closed-slot running clearance', pin_min, running_gap)
        controls = []
        for side in ['front', 'rear']:
            for direction, target_radius in [('inward', SLOT_CENTRES[0] - 0.25), ('outward', SLOT_CENTRES[1] + 0.25)]:
                escaped_pin = pins[side].copy()
                escaped_pin.translate(App.Vector(0, 0, target_radius - RADIUS))
                overlap = escaped_pin.common(forks[side]).Volume
                assert math.isfinite(overlap) and overlap > 1e-6, ('A closed slot end must prevent radial escape', side, direction, overlap)
                controls.append({'side': side, 'attempt': direction, 'attemptedPinRadiusMm': target_radius, 'interferenceMm3': overlap})
        if native_path:
            assert digest(native_path) == native_sha, 'The native geometry file changed during the check.'
        report = {
            'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]),
            'passed': True, 'geometryMode': mode, 'samples': len(rows), 'poses': rows,
            'minimumNutToShaft': {'millimetres': nut_min['nutToShaftMm'], 'angleDegrees': nut_min['angleDegrees']},
            'minimumCoverToShaft': {'millimetres': cover_min['coverToShaftMm'], 'angleDegrees': cover_min['angleDegrees']},
            'continuousShaftClearance': {
                'method': 'Distance is Lipschitz under rigid motions. Translation derivative is bounded by R*sec²20; rotation displacement by enclosing radial extent times angle. Every angle is within 0.5 degrees of a measured BRep pose.',
                'shaftRadialExtentBoundMm': radial_bound, 'translationDerivativeBoundMmPerRadian': translation_speed,
                'distanceDerivativeBoundMmPerRadian': lipschitz, 'maximumBetweenSampleLossMm': between_sample_loss,
                'nutClearanceLowerBoundMm': continuous_nut, 'coverClearanceLowerBoundMm': continuous_cover,
            },
            'closedPinPath': {
                'method': 'The tangent law makes each pin local X zero and local radius R/cos(angle). Circular Ø4 pins stay parallel to the through-slot axis. Their complete radial range lies within the actual capsule centerline segment; the capsule radius exceeds pin radius by the stated running gap.',
                'slotCentrelineMm': list(SLOT_CENTRES), 'slotWidthMm': SLOT_WIDTH,
                'pinDiameterMm': 2*PIN_RADIUS, 'pinRadiusRangeMm': list(radial_range),
                'analyticRunningClearanceMm': running_gap, 'measuredMinimumClearanceMm': pin_min,
                'lowerClosedEndClearanceMm': lower_end_gap, 'upperClosedEndClearanceMm': upper_end_gap,
                'radialEscapePositiveControls': controls,
            },
            'provenance': {'casesPath': str(cases_path), 'casesSha256': digest(cases_path),
                           'neutralRecipeSha256': hashlib.sha256(case['source'].encode()).hexdigest(),
                           'checkerSourceSha256': digest(__file__), 'nativeFile': str(native_path) if native_path else None,
                           'nativeFileSha256': native_sha},
            'elapsedSeconds': time.perf_counter() - started,
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2))
        print(json.dumps({'passed': True, 'report': str(report_path), 'minimumNutToShaftMm': nut_min['nutToShaftMm'],
                          'minimumCoverToShaftMm': cover_min['coverToShaftMm'], 'minimumPinGapMm': pin_min,
                          'continuousCoverLowerBoundMm': continuous_cover}), flush=True)
        return report
    finally:
        if doc:
            App.closeDocument(doc.Name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cases')
    parser.add_argument('report', nargs='?')
    parser.add_argument('--native')
    parser.add_argument('--drive-offset-z', type=float, default=0)
    parser.add_argument('--output-pivot-x', type=float)
    args = parser.parse_args()
    run(args.cases, args.report, args.native, args.drive_offset_z, args.output_pivot_x)
