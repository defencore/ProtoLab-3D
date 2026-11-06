"""Verify cover-flat capture between the opposed closed radial forks.

Arguments: cases.json [antiroll-report.json]. Only the stock-nut cover is rolled
around the fixed screw axis. An independent body proof removes both integral
pins before testing: the actual pin-free cover must contact both fork plates.
This excludes pin or screw binding as an explanation of the neutral constraint.
"""
import json
import math
import os
from pathlib import Path
import sys

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

ARM_IDS = ['output-front-crank', 'output-rear-crank']
SCREW_ORIGIN = App.Vector(0, 0, 28)
SCREW_AXIS = App.Vector(1, 0, 0)
COVER_FLATS = (-10, 10)


def verify_cases(cases, drive_offset_z=0):
    screw_origin = SCREW_ORIGIN + App.Vector(0, 0, drive_offset_z)
    poses = {}
    for case in cases:
        if case['mode'] == 'simple':
            poses.setdefault(case['parameters']['outputAngle'], case)
    assert set([-20, -10, 0, 10, 20]).issubset(poses), 'Supply all five canonical output poses.'
    report = {
        'freecad': '.'.join(App.Version()[:3]),
        'description': ('The actual cover body between Y=-10 and +10 is captured by both closed-fork inner faces. '
                        'Integral pins and all screws are excluded from the independent face-capture proof.'),
        'screwAxis': {'point': list(screw_origin), 'direction': list(SCREW_AXIS)},
        'pinFreeCoverRegionY': list(COVER_FLATS),
        'poses': [],
    }
    for output_angle, case in sorted(poses.items()):
        scope = {'App': App, 'Part': Part, 'math': math}
        exec(case['source'], scope)
        parts = list(zip(scope['components'], scope['component_metadata']))
        arms = [(shape, meta) for shape, meta in parts if meta['AssemblyOccurrenceId'] in ARM_IDS]
        cover = [shape for shape, meta in parts if meta['AssemblyOccurrenceId'] == 'nut-yoke']
        assert len(arms) == 2 and len(cover) == 1, 'Expected one integral-pin cover and two closed fork plates.'
        cover = cover[0]
        box = cover.BoundBox
        mask = Part.makeBox(box.XLength + 2, COVER_FLATS[1] - COVER_FLATS[0], box.ZLength + 2,
                            App.Vector(box.XMin - 1, COVER_FLATS[0], box.ZMin - 1))
        body = cover.common(mask)
        assert body.isValid() and body.isClosed() and body.Volume > 0
        assert body.BoundBox.YMin >= COVER_FLATS[0] - 1e-6 and body.BoundBox.YMax <= COVER_FLATS[1] + 1e-6
        assert body.Volume < cover.Volume, 'The independent cover-body proof must remove actual pin material.'

        def probe(roll, shape=body):
            moved = shape.copy()
            moved.rotate(screw_origin, SCREW_AXIS, roll)
            assert moved.isValid() and moved.isClosed() and moved.Volume > 0
            collisions = []
            for arm, metadata in arms:
                if not moved.BoundBox.intersect(arm.BoundBox):
                    continue
                overlap = moved.common(arm).Volume
                assert math.isfinite(overlap), ('Invalid intersection volume', output_angle, roll)
                if overlap > 1e-6:
                    collisions.append({'cover': 'nut-yoke', 'arm': metadata['AssemblyOccurrenceId'], 'volume': overlap})
            return {'nutRollDegrees': roll, 'interference': collisions, 'blocked': bool(collisions)}

        checks = [probe(roll) for roll in [0, -0.5, 0.5, -1, 1, -1.5, 1.5]]
        complete_checks = [probe(roll, cover) for roll in [0, -1.5, 1.5]]
        assert not checks[0]['blocked'] and not complete_checks[0]['blocked'], (
            'The nominal cover and both pins must retain running clearance.', output_angle, checks[0], complete_checks[0])
        for check in checks:
            if abs(check['nutRollDegrees']) == 1.5:
                assert {contact['arm'] for contact in check['interference']} == set(ARM_IDS), (
                    'Both closed-fork faces must capture the cover independently of its pins.', output_angle, check)
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
        report['poses'].append({'outputAngleDegrees': output_angle,
                                'completeCoverVolumeMm3': cover.Volume, 'pinFreeBodyVolumeMm3': body.Volume,
                                'faceCaptureChecks': checks, 'completeCoverChecks': complete_checks,
                                'firstFaceContactDegrees': first_contact})
    report['passed'] = True
    return report


def run(input_path, output_path=None, drive_offset_z=0):
    input_path = Path(input_path)
    output_path = Path(output_path) if output_path else input_path.with_name('antiroll-report.json')
    report = verify_cases(json.loads(input_path.read_text()), float(drive_offset_z))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2))
    print('SFK_ANTI_ROTATION ' + json.dumps(report), flush=True)
    return report


if __name__ == '__main__':
    run(*sys.argv[1:4])
