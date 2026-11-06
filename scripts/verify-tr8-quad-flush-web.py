"""Prove a subtractive fork trim against the completed eye-arm checkpoint."""
import hashlib
import json
import re
import sys
import time
from pathlib import Path

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'test-results/tr8-quad-geared-rocker-flush-web')
prior = Path('test-results/tr8-quad-geared-rocker-eye-arm-through')
capture = json.loads((out / 'capture.json').read_text())
old_capture = json.loads((prior / 'capture.json').read_text())
old_report = json.loads((prior / 'early-native-report.json').read_text())
assert old_report['checkpointPassed'] and all(p.get('completed') and not p['collisions'] for p in old_report['poses'])
assert old_report['captureSha256'] == hashlib.sha256((prior / 'capture.json').read_bytes()).hexdigest()
verifier = Path('scripts/verify-tr8-quad-geared-rocker.py')
assert old_report['verifierSha256'] == hashlib.sha256(verifier.read_bytes()).hexdigest()
for key in ['dependencySources', 'preserved']:
    assert capture[key] == old_capture[key], ('A shared dependency changed', key)
native_key = 'src/parts/tr8-quad-geared-rocker-actuator/lib/native.ts'
assert capture['sources'][native_key] == old_capture['sources'][native_key]

# Reuse the exact, already exercised physical retention/material probes, without
# rebuilding purchased motors, helical screws or the unchanged shared housing.
sys.argv = [str(verifier), str(out)]
scope = {'__file__': str(verifier)}
exec(verifier.read_text().split('\ntry:\n', 1)[0], scope)
App, Part = scope['App'], scope['Part']
started = time.monotonic()
report = {'checkpointPassed': False, 'scope': 'Subtractive cheek-tail trim; exact material inclusion plus current retention and connection checks.',
          'priorReport': str(prior / 'early-native-report.json'),
          'priorReportSha256': hashlib.sha256((prior / 'early-native-report.json').read_bytes()).hexdigest(),
          'captureSha256': hashlib.sha256((out / 'capture.json').read_bytes()).hexdigest(),
          'driverSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'poses': []}
result_path = out / 'flush-web-native-report.json'


def write():
    report['elapsedSeconds'] = time.monotonic() - started
    result_path.write_text(json.dumps(report, indent=2) + '\n')


def selected_source(source, wanted):
    chunks = re.split(r'(?=^scope = _quad_rocker_source\()', source, flags=re.M)
    selected, found = [], set()
    for chunk in chunks[1:]:
        match = re.search(r'"AssemblyOccurrenceId":"([^"]+)"', chunk)
        if match and match.group(1) in wanted:
            selected.append(chunk)
            found.add(match.group(1))
    assert found == wanted, ('Missing physical source block', wanted - found)
    return chunks[0] + ''.join(selected) + '\nshape = Part.makeCompound(components)\n'


def physical(row, wanted):
    built = scope['execute'](selected_source(row['source'], wanted))
    result = {}
    for shape, metadata in zip(built['components'], built['component_metadata']):
        assert scope['valid'](shape)
        key = metadata['AssemblyOccurrenceId']
        assert key not in result and len(shape.Solids) == 1
        result[key] = shape
    assert set(result) == wanted
    return result


try:
    wanted = {letter + '-' + capture['roleIds'][role] for letter in 'abcd' for role in ['fork', 'nut', 'shaft', 'forkPin']}
    for row, old_row in zip(capture['poses'], old_capture['poses']):
        assert row['angles'] == old_row['angles'] and row['motor'] == old_row['motor']
        old_items = {item['id']: item for item in old_row['occurrences']}
        changed = [item['id'] for item in row['occurrences'] if item['geometryKey'] != old_items[item['id']]['geometryKey']]
        assert set(changed) == {letter + '-cnc-fork' for letter in 'abcd'}, ('More than the fork geometry changed', changed)
        records = physical(row, wanted)
        old_records = physical(old_row, {letter + '-cnc-fork' for letter in 'abcd'})
        detail = {'angles': row['angles'], 'unchangedPhysicalOccurrences': len(row['occurrences']) - len(changed),
                  'changedOccurrences': changed, 'forks': []}
        for channel, letter in enumerate('abcd'):
            key = letter + '-cnc-fork'
            current, old = records[key], old_records[key]
            added = abs(current.cut(old).Volume)
            removed = abs(old.cut(current).Volume)
            assert added < 1e-6, ('Fork trim added material, invalidating inherited collision proof', letter, added)
            assert removed > 100, ('Rear cheek tails were not removed', letter, removed)
            local = scope['canonical'](current, channel)
            local.rotate(App.Vector(), App.Vector(1, 0, 0), -row['angles'][channel])
            rear, connections = [], []
            f = capture['layout']
            for start in [f['forkInnerStart'], f['forkOuterStart']]:
                cheek = local.common(Part.makeBox(f['forkThickness'], 20, 40, App.Vector(start, -10, -35)))
                edge = -cheek.optimalBoundingBox(False, False).ZMax
                assert abs(edge - f['forkCrossWebStart']) < 1e-6, ('Cheek rear is not flush with web', letter, edge)
                rear.append(edge)
            for station in [f['forkInnerStart'] + f['forkThickness'], f['forkOuterStart']]:
                probe = Part.makeBox(.2, .2, .2, App.Vector(station - .1, 1.9, -11.6))
                ratio = scope['overlap'](probe, local) / probe.Volume
                assert ratio > .99, ('Cheek/web connection lost material', letter, station, ratio)
                connections.append(ratio)
            detail['forks'].append({'channel': letter, 'oneValidClosedSolid': True, 'addedMaterialMm3': added,
                                    'removedMaterialMm3': removed, 'rearCheekPlanesMm': rear,
                                    'positiveCheekWebConnectionRatios': connections})
        detail['pinEngagement'] = scope['prove_pin_engagement'](records, row)
        detail['followerRetention'] = scope['prove_follower_retention'](records, row)
        detail['completed'] = True
        report['poses'].append(detail)
        write()
        print('flush-web subset and retention passed ' + str(row['angles']), flush=True)
    assert len(report['poses']) == 3
    for file, expected in scope['sources'].items():
        assert hashlib.sha256(Path(file).read_bytes()).hexdigest() == expected, ('Source changed during proof', file)
    report['sourceHashesCurrent'] = True
    report['sourceHashes'] = scope['sources']
    report['inheritedCollisionProof'] = {'reason': 'Only four fork solids changed, each is a verified material subset at the same rigid placement; every other physical geometry key and all shared generators are unchanged.',
                                         'physicalPairsPerPose': 5671, 'poses': 3, 'collisionCount': 0}
    access = old_report['poses'][0]['forkAccess']
    report['inheritedFocusedAccessStations'] = sum(v for row in access.values() for key, v in row.items() if key.endswith('Stations'))
    report['accessInheritanceReason'] = 'Removing material from moving forks and stationary fork targets preserves every previously clear rigid insertion path; all placements and other bodies are unchanged.'
    report['checkpointPassed'] = True
    write()
    print('flush-web focused proof passed', flush=True)
except BaseException as error:
    report['error'] = str(error)
    write()
    raise
