"""Audit native rigid contacts and simple service translations of the rocket payload.

Run with FreeCAD's Python after verify-rocket-camera-nose.ts prepared cases.json.
The probe measures geometry; it does not establish damping, strength, or elastic release.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import os
import sys
import time

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

parser = argparse.ArgumentParser()
parser.add_argument('folder', nargs='?', default='test-results/rocket-camera-nose-near-camera')
parser.add_argument('--require-isolation', action='store_true')
parser.add_argument('--require-camera-isolation', action='store_true')
parser.add_argument('--require-auxiliary-isolation', action='store_true')
parser.add_argument('--require-seating', action='store_true')
parser.add_argument('--require-service', action='store_true')
parser.add_argument('--require-retention', action='store_true')
parser.add_argument('--require-tools', action='store_true')
parser.add_argument('--minimum-gap', type=float, default=0.4)
parser.add_argument('--skip-service', action='store_true')
args = parser.parse_args()
folder = Path(args.folder).resolve()
manifest = json.loads((folder / 'cases.json').read_text())
case = next(case for case in manifest['cases'] if case['name'].endswith('structural-90-86--assembled'))
macro_path = folder / case['macroFile']
macro = macro_path.read_text()
assert hashlib.sha256(macro.encode()).hexdigest() == case['macroSHA256'], 'Prepared macro changed.'
started = time.perf_counter()
# Validate tool provenance before the expensive contact/service work, then keep the
# loaded specification attached to this exact macro run.
tools_file = folder / 'camera-service-tools.json'
tool_specification = None
if tools_file.exists():
    tool_specification = json.loads(tools_file.read_text())
    assert tool_specification['parameters'] == case['parameters'], 'Service tool configuration is stale.'
    assert tool_specification['sourceMacroSHA256'] == case['macroSHA256'], 'Service tool macro is stale.'
    module = Path(__file__).resolve().parents[1] / 'src/parts/rocket-camera-nose/lib/camera-mount.ts'
    assert tool_specification['cameraMountModuleSHA256'] == hashlib.sha256(module.read_bytes()).hexdigest(), 'Service tool source is stale.'
    equipment_module = module.with_name('equipment-mounts.ts')
    if 'equipmentMountModuleSHA256' in tool_specification:
        assert tool_specification['equipmentMountModuleSHA256'] == hashlib.sha256(equipment_module.read_bytes()).hexdigest(), 'Equipment tool source is stale.'
report = {'case': case['name'], 'sourceMacroSHA256': case['macroSHA256'], 'minimumRequiredGap': args.minimum_gap,
          'units': 'mm', 'statement': 'Native geometric contact and collision measurements only; no damping or load rating is implied.'}
doc = App.newDocument('RocketIsolationProbe')
try:
    try:
        exec(compile(macro, str(macro_path), 'exec'), {})
    except Exception as error:
        raise RuntimeError('Native macro build failed: ' + type(error).__name__ + ': ' + str(error)) from None
    features = sorted([obj for obj in doc.Objects if obj.TypeId == 'Part::Feature' and hasattr(obj, 'Shape')],
                      key=lambda obj: getattr(obj, 'ComponentIndex', 1))
    assert len(features) == len(case['components'])
    shapes = {expected['id']: feature.Shape for expected, feature in zip(case['components'], features)}
    components = {component['id']: component for component in case['components']}
    rigid = [component_id for component_id, component in components.items()
             if component.get('manufacturing', {}).get('material', '').startswith('PETG')]
    compliant = [component_id for component_id, component in components.items()
                 if component.get('manufacturing', {}).get('material', '').startswith('TPU')]
    payload_libraries = {'raspberry-pi', 'waveshare-ups-3s', 'waveshare-pcie-m2-d',
                         'm2-ssd', 'li-ion-cell', 'board-camera-19',
                         'gps-tracker', 'jhe42b-finder'}
    payload = [component_id for component_id, component in components.items()
               if component['libraryId'] in payload_libraries or
               (component['libraryId'] in {'bolt-screw', 'hex-nut', 'nyloc-nut', 'spacer', 'washer'} and
                component_id.startswith(('ssd-', 'pi-', 'ups-', 'camera-')))]

    def pair(first, second):
        distance, closest, _ = shapes[first].distToShape(shapes[second])
        assert math.isfinite(distance)
        common = shapes[first].common(shapes[second]) if distance <= 1e-5 else None
        return {'first': first, 'second': second, 'distance': distance,
                'commonVolume': 0 if common is None or common.isNull() else common.Volume,
                'commonArea': 0 if common is None or common.isNull() else common.Area,
                'closestPoints': [[[p.x, p.y, p.z] for p in points] for points in closest[:3]]}

    report['rigidComponents'] = rigid
    report['compliantComponents'] = compliant
    report['payloadToRigid'] = [pair(target, frame) for target in payload for frame in rigid]
    auxiliary_ids = [component_id for component_id, component in components.items()
                     if component['libraryId'] in {'gps-tracker', 'jhe42b-finder'}]
    board_ids = [component_id for component_id in ['pi5', 'ups3s', 'csi-camera'] if component_id in shapes] + auxiliary_ids
    report['boardToCompliant'] = [pair(board, cradle) for board in board_ids for cradle in compliant]
    report['compliantToRigid'] = [pair(cradle, frame) for cradle in compliant for frame in rigid]
    report['boardIsolationPassed'] = all(item['distance'] >= args.minimum_gap - 1e-6
                                         for item in report['payloadToRigid'] if item['first'] in ['pi5', 'ups3s'])
    report['cameraIsolationPassed'] = all(item['distance'] >= args.minimum_gap - 1e-6
                                         for item in report['payloadToRigid'] if item['first'] == 'csi-camera')
    report['auxiliaryIsolationPassed'] = {components[key]['libraryId'] for key in auxiliary_ids} == {'gps-tracker', 'jhe42b-finder'} and all(
        item['distance'] >= args.minimum_gap - 1e-6
        for item in report['payloadToRigid'] if item['first'] in auxiliary_ids)
    report['auxiliaryComponentIds'] = auxiliary_ids
    report['payloadIsolationPassed'] = all(item['distance'] >= args.minimum_gap - 1e-6
                                          for item in report['payloadToRigid'])
    report['boardCompliantContacts'] = [
        {'componentId': board, 'contactingCompliantIds': [item['second'] for item in report['boardToCompliant']
         if item['first'] == board and item['distance'] <= 1e-5]}
        for board in board_ids]
    cradle_ids = [component_id for component_id in compliant if component_id in
                  {'pi-cradle', 'ups-cradle', 'camera-pocket', 'camera-gate',
                   'aux-gps-liner', 'aux-buzzer-liner'} or 'grommet' in component_id]
    report['cradleRigidSeating'] = [
        {'componentId': cradle, 'seatedRigidIds': [item['second'] for item in report['compliantToRigid']
         if item['first'] == cradle and item['distance'] <= 1e-5]}
        for cradle in cradle_ids]
    report['seatingPassed'] = all(item['contactingCompliantIds'] for item in report['boardCompliantContacts']) and all(
        item['seatedRigidIds'] for item in report['cradleRigidSeating'])

    if not args.skip_service:
        # Purchased UPS/cells only: flexible latch release is deliberately not simulated.
        group_ids = [component_id for component_id in ['ups3s', 'ups-cell-0', 'ups-cell-1', 'ups-cell-2'] if component_id in shapes]
        group = Part.makeCompound([shapes[component_id] for component_id in group_ids])
        frame = shapes['load-frame']
        paths = []
        for label, sign in [('rearward', -1), ('forward', 1)]:
            first = None
            checks = []
            for displacement in [0, 0.5, 1, 2, 3, 5, 10, 15, 20, 30, 40, 60, 90, 110, 130]:
                moved = group.copy()
                moved.translate(App.Vector(0, 0, sign * displacement))
                common = moved.common(frame)
                volume = 0 if common.isNull() else common.Volume
                checks.append({'translationZ': sign * displacement, 'commonVolume': volume})
                if volume > 1e-4:
                    first = checks[-1]
                    break
            paths.append({'direction': label, 'components': group_ids, 'firstCollision': first, 'checks': checks,
                          'interpretation': 'Purchased UPS/cells translated against the load frame after removing any separate rear cap. TPU release is not simulated.'})
        report['upsTranslationProbes'] = paths
        # Complete trays, including the fitted TPU, must follow the opened T-slots.
        # The second operation assumes the UPS tray has already been removed.
        tray_groups = [
            ('UPS tray', [component_id for component_id in shapes if component_id.startswith('ups')]),
            ('Pi and storage tray', [component_id for component_id in shapes if component_id in
             {'pi5', 'nvme-adapter', 'nvme-ssd'} or component_id.startswith(('pi-', 'ssd-'))]),
        ]
        tray_groups.append(('Combined electronics stack', tray_groups[0][1] + tray_groups[1][1]))
        removed = {'nose-shell', 'optical-window', 'window-retainer', 'rear-cap', 'cassette-lock-screw'}
        removed.update(case.get('trayServiceRemovedIds', []))
        removed.update(component_id for component_id in shapes if component_id.startswith('body-anchor-screw-') or
                       (component_id.startswith('rear-cap-') and component_id.endswith('-screw')))
        tray_probes = []
        installed_retention = []
        for label, target_ids in tray_groups:
            target = Part.makeCompound([shapes[component_id] for component_id in target_ids])
            retention_obstacles = [component_id for component_id, component in components.items()
                                   if component_id not in target_ids and
                                   (component['supply'] == 'manufactured' or
                                    component['libraryId'] in {'bolt-screw', 'hex-nut', 'nyloc-nut'})]
            stops = []
            for sign in [-1, 1]:
                first_stop = None
                for distance in [0.05, 0.1, 0.25, 0.5]:
                    moved = target.copy()
                    moved.translate(App.Vector(0, 0, sign * distance))
                    blockers = []
                    for obstacle_id in retention_obstacles:
                        obstacle = shapes[obstacle_id]
                        if any(min(getattr(moved.BoundBox, axis + 'Max'), getattr(obstacle.BoundBox, axis + 'Max')) <=
                               max(getattr(moved.BoundBox, axis + 'Min'), getattr(obstacle.BoundBox, axis + 'Min')) for axis in 'XYZ'):
                            continue
                        shared = moved.common(obstacle)
                        volume = 0 if shared.isNull() else shared.Volume
                        if volume > 1e-4:
                            blockers.append({'componentId': obstacle_id, 'commonVolume': volume})
                    if blockers:
                        first_stop = {'translationZ': sign * distance, 'blockers': blockers}
                        break
                stops.append({'direction': 'rearward' if sign < 0 else 'forward', 'firstStop': first_stop})
            installed_retention.append({'name': label, 'stops': stops,
                                        'bothDirectionsRestrainedWithinHalfMillimetre': all(stop['firstStop'] for stop in stops),
                                        'statement': 'Installed-state nominal motion probe against printed parts and fasteners; does not prove preload, dynamic stiffness or vibration resistance.'})
            if label == 'Combined electronics stack':
                continue
            service_target_ids = [component_id for component_id in target_ids if component_id not in removed]
            target = Part.makeCompound([shapes[component_id] for component_id in service_target_ids])
            obstacles = Part.makeCompound([shape for component_id, shape in shapes.items()
                                          if component_id not in removed and component_id not in target_ids])
            travel = math.ceil(target.BoundBox.ZMax - frame.BoundBox.ZMin + 2)
            first_collision = None
            checked = 0
            for displacement in range(travel + 1):
                moved = target.copy()
                moved.translate(App.Vector(0, 0, -displacement))
                shared = moved.common(obstacles)
                volume = 0 if shared.isNull() else shared.Volume
                checked += 1
                if volume > 1e-4:
                    first_collision = {'translationZ': -displacement, 'commonVolume': volume}
                    break
            tray_probes.append({'name': label, 'components': target_ids, 'direction': 'rearward',
                                'step': 1, 'requiredTravel': travel, 'checkedPoses': checked,
                                'firstCollision': first_collision,
                                'fullyClearsFrame': first_collision is None and target.BoundBox.ZMax - travel < frame.BoundBox.ZMin - 1,
                                'assumption': 'Rear cap, cap screws, tube anchors, housing lock and declared UPS cross pins/tubes removed; cable connections released. No TPU deformation is simulated.'})
            removed.update(target_ids)
        report['trayInstalledRetention'] = installed_retention
        report['retentionPassed'] = all(item['bothDirectionsRestrainedWithinHalfMillimetre'] for item in installed_retention)
        report['trayExtractionProbes'] = tray_probes
        report['rearServicePassed'] = all(probe['fullyClearsFrame'] for probe in tray_probes)
    report['elapsedSeconds'] = time.perf_counter() - started
    (folder / 'isolation-probe-progress.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'phase': 'contacts-and-service-complete', 'boardIsolationPassed': report['boardIsolationPassed'],
                      'cameraIsolationPassed': report['cameraIsolationPassed'], 'seatingPassed': report['seatingPassed'],
                      'rearServicePassed': report.get('rearServicePassed'), 'retentionPassed': report.get('retentionPassed')}, separators=(',', ':')), flush=True)
    if tool_specification is not None:

        def transform(shape, translation, rotation):
            for axis, angle in zip([App.Vector(1, 0, 0), App.Vector(0, 1, 0), App.Vector(0, 0, 1)], rotation):
                if angle:
                    shape.rotate(App.Vector(0, 0, 0), axis, angle)
            shape.translate(App.Vector(*translation))
            return shape

        tool_results = []
        for tool in tool_specification['tools']:
            tool_shape = eval(tool['shapeCode'], {'App': App, 'Part': Part, 'math': math, '_pl_transform': transform})
            assert tool_shape.isValid() and tool_shape.isClosed() and tool_shape.Volume > 0, tool['id'] + ': invalid tool envelope'
            excluded = set(tool['removedComponentIds'] + tool['intendedContactTargetIds'])
            checks = []
            for component_id, shape in shapes.items():
                if component_id in excluded:
                    continue
                gap, _, _ = tool_shape.distToShape(shape)
                common = tool_shape.common(shape) if gap <= 1e-5 else None
                volume = 0 if common is None or common.isNull() else common.Volume
                checks.append({'componentId': component_id, 'distance': gap, 'commonVolume': volume})
            tool_results.append({'id': tool['id'], 'stage': tool['stage'],
                                 'removedComponentIds': tool['removedComponentIds'],
                                 'intendedContactTargetIds': tool['intendedContactTargetIds'],
                                 'checks': checks,
                                 'collisions': [item for item in checks if item['commonVolume'] > 1e-4]})
        report['cameraServiceTools'] = tool_results
        report['toolAccessPassed'] = bool(tool_results) and all(not item['collisions'] for item in tool_results)
    else:
        report['toolAccessPassed'] = False
    report['elapsedSeconds'] = time.perf_counter() - started
    destination = folder / ('isolation-contact-probe.json' if args.skip_service else 'isolation-probe.json')
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(destination), 'boardIsolationPassed': report['boardIsolationPassed'],
                      'cameraIsolationPassed': report['cameraIsolationPassed'], 'seatingPassed': report['seatingPassed'],
                      'rearServicePassed': report.get('rearServicePassed'), 'retentionPassed': report.get('retentionPassed'),
                      'toolAccessPassed': report['toolAccessPassed'],
                      'toolCollisions': [{'id': item['id'], 'collisions': item['collisions']} for item in report.get('cameraServiceTools', [])],
                      'boardToRigid': [{key: item[key] for key in ['first', 'second', 'distance', 'commonVolume']}
                                       for item in report['payloadToRigid'] if item['first'] in ['pi5', 'ups3s', 'csi-camera']],
                      'upsTranslationProbes': [{'direction': item['direction'], 'firstCollision': item['firstCollision'],
                                                'lastTranslationZ': item['checks'][-1]['translationZ']}
                                               for item in report.get('upsTranslationProbes', [])],
                      'trayExtractionProbes': report.get('trayExtractionProbes', []),
                      'trayInstalledRetention': report.get('trayInstalledRetention', [])}, indent=2), flush=True)
finally:
    report['elapsedSeconds'] = time.perf_counter() - started
    (folder / 'isolation-probe-progress.json').write_text(json.dumps(report, indent=2) + '\n')
    App.closeDocument(doc.Name)
failures = []
if args.require_isolation and not report['boardIsolationPassed']:
    failures.append('Pi/UPS rigid isolation gap')
if args.require_camera_isolation and not report['cameraIsolationPassed']:
    failures.append('Camera rigid isolation gap')
if args.require_auxiliary_isolation and not report['auxiliaryIsolationPassed']:
    failures.append('Auxiliary GPS/finder rigid isolation gap')
if args.require_seating and not report['seatingPassed']:
    failures.append('Compliant contact and rigid seating')
if args.require_service and not report.get('rearServicePassed', False):
    failures.append('Rear UPS service translation')
if args.require_retention and not report.get('retentionPassed', False):
    failures.append('Installed tray axial retention')
if args.require_tools and not report.get('toolAccessPassed', False):
    failures.append('Camera service tool access')
if failures:
    print('FAILED: ' + ', '.join(failures), file=sys.stderr)
    raise SystemExit(1)
