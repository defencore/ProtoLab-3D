import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Box3, Euler, Mesh, Vector3 } from 'three';
import machine, {
  millingComponents,
  millingPieces,
  millingLayout,
} from '../src/parts/cnc-milling-machine/part';
import frame from '../src/parts/cnc-frame-part/part';
import measurement from '../src/parts/cnc-limit-sensor/part';
import { limitStations, limitRequirements } from '../src/parts/cnc-milling-machine/lib/limits';
import { frameHoles } from '../src/parts/cnc-frame-part/lib/model';
import { validateParameters } from '../src/core/validation';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import type { Vec } from '../src/core/assembly/boundary/shapes';

function location(piece: ReturnType<typeof millingPieces>[number]) {
  return new Vector3(...piece.component.placement.translation).add(
    new Vector3(...(piece.position ?? [0, 0, piece.z ?? 0])),
  );
}
function sensingFace(piece: ReturnType<typeof millingPieces>[number]) {
  const rotation = new Euler(
    ...(piece.component.placement.rotation.map((d) => (d * Math.PI) / 180) as Vec),
    'ZYX',
  );
  return location(piece).add(new Vector3(0, 0, 47.5).applyEuler(rotation));
}

test('six limits retain one purchased sensor identity each and individually fastened fabricated brackets/steel flags', () => {
  const pieces = millingComponents(machine.defaults);
  const limits = pieces.filter((piece) => /^[xyz]-limit-/.test(piece.component.id));
  assert.equal(limits.length, 42);
  assert.equal(new Set(limits.map((piece) => piece.component.id)).size, 42);
  const sensors = limits.filter((piece) => piece.component.libraryId === measurement.id);
  assert.equal(sensors.length, 6);
  assert.ok(
    sensors.every(
      (piece) => piece.component.supply === 'purchased' && piece.component.presetId === 'e2b-m12',
    ),
  );
  assert.ok(sensors.every((piece) => piece.component.parameters.model === 'e2b-m12'));
  const details = limits.filter((piece) => piece.component.libraryId === frame.id);
  assert.equal(details.length, 12);
  assert.ok(
    details.every((piece) => piece.component.supply === 'manufactured' && piece.requireSingleSolid),
  );
  assert.ok(
    details
      .filter((piece) => piece.component.id.endsWith('-target'))
      .every((piece) => piece.component.parameters.material === 'steel'),
  );
  const bolts = limits.filter((piece) => piece.component.libraryId === 'bolt-screw');
  assert.equal(bolts.length, 24);
  assert.ok(
    bolts.every(
      (piece) =>
        piece.component.parameters.diameter === 4 && piece.component.parameters.length === 10,
    ),
  );
  assert.match(limitRequirements.join(' '), /not a safety function/);
  assert.match(limitRequirements.join(' '), /nominal body and nut/);
});

test('all five spindle executions reach both limits on every axis at an actual two-millimetre passing gap', () => {
  for (const spindle of machine.parameters.find((parameter) => parameter.key === 'spindle')!
    .options!) {
    for (const tableHeight of [700, 950]) {
      const parameters = { ...machine.defaults, spindle: spindle.value, tableHeight };
      const stations = limitStations(parameters, millingLayout(parameters));
      for (const station of stations) {
        const pose = millingPieces(parameters, station.axis + '-' + station.end);
        const sensor = pose.find((piece) => piece.component.id === station.id + '-sensor')!;
        const target = pose.find((piece) => piece.component.id === station.id + '-target')!;
        const face = sensingFace(sensor),
          center = location(target),
          axis = new Vector3(...station.sensorAxis);
        const delta = center.clone().sub(face);
        const direction = station.sensorAxis.findIndex((v) => v !== 0);
        const gap = delta.dot(axis) - station.targetSize[direction] / 2;
        assert.ok(Math.abs(gap - 2) < 1e-8, spindle.value + '/' + station.id);
        for (let i = 0; i < 3; i++)
          if (i !== direction)
            assert.ok(
              Math.abs(delta.getComponent(i)) + 5.4 < station.targetSize[i] / 2,
              'The whole sensing face must lie over the steel flag.',
            );
        const middle = millingPieces(parameters, 'assembled');
        const midSensor = middle.find((piece) => piece.component.id === station.id + '-sensor')!;
        const midTarget = middle.find((piece) => piece.component.id === station.id + '-target')!;
        const midDelta = location(midTarget).sub(sensingFace(midSensor));
        assert.ok(
          midDelta.length() > 90,
          'The same flag must not activate its limit at middle travel.',
        );
      }
    }
  }
});

test('Y flags mount inside the real foot stock and fixed stations clear the complete lower-link sweep', () => {
  const v = millingLayout(machine.defaults);
  for (const station of limitStations(machine.defaults, v).filter((row) => row.axis === 'y')) {
    assert.equal(station.targetHost, 'gantry-foot-1');
    assert.equal(
      station.targetCenter[0] - station.targetSize[0] / 2,
      v.footPlateCenterX + v.footPlateWidth / 2,
    );
    assert.ok(station.targetCenter[2] - station.targetSize[2] / 2 > v.gantryFootBottom);
    assert.ok(station.targetCenter[2] + station.targetSize[2] / 2 < v.gantryFootTop);
    for (const seat of station.targetBoltSeats) {
      assert.ok(Math.abs(seat[1]) + 4 / 2 < v.footPlateDepth / 2);
      assert.equal(seat[2], (v.gantryFootBottom + v.gantryFootTop) / 2);
    }
    // The entire fixed bridge is outside the new link's swept longitudinal stock.
    assert.ok(
      Math.abs(station.bracketCenter[1]) - station.bracketSize[0] / 2 >
        750 + v.driveLinkTopDepth / 2,
    );
    assert.equal(
      station.sensorOrigin[1] - station.targetCenter[1],
      station.end === 'min' ? -750 : 750,
    );
    assert.ok(
      station.bracketCenter[0] + station.bracketSize[1] / 2 - 5 >
        v.footPlateCenterX + v.footPlateWidth / 2,
    );
  }
});

test('sensor plates lie between the supplied nuts, every real host has matching M4 tapping and fixed Z fixtures clear 200 mm stock', () => {
  const parameters = machine.defaults,
    v = millingLayout(parameters);
  const pieces = millingComponents(parameters);
  for (const station of limitStations(parameters, v)) {
    const bracket = pieces.find((piece) => piece.component.id === station.id + '-bracket')!;
    const hole = frameHoles(bracket.component.parameters).find((hole) => hole.diameter === 12.5)!;
    const rotation = new Euler(
      ...(bracket.component.placement.rotation.map((d) => (d * Math.PI) / 180) as Vec),
      'ZYX',
    );
    const axis = new Vector3(
      ...(['x', 'y', 'z'].map((name) => Number(name === hole.axis)) as Vec),
    ).applyEuler(rotation);
    const start = new Vector3(...hole.at)
      .applyEuler(rotation)
      .add(new Vector3(...bracket.component.placement.translation));
    const sensorStart = new Vector3(...station.sensorOrigin),
      sensorAxis = new Vector3(...station.sensorAxis);
    const axial = [
      start.clone().sub(sensorStart).dot(sensorAxis),
      start.clone().addScaledVector(axis, hole.depth).sub(sensorStart).dot(sensorAxis),
    ].sort((a, b) => a - b);
    assert.ok(
      Math.abs(axial[0] - 21.9) < 1e-8 && Math.abs(axial[1] - 27.1) < 1e-8,
      station.id + ' bore clips only the five-mm plate.',
    );
    for (const hostId of [station.host, station.targetHost]) {
      const host = pieces.find((piece) => piece.component.id === hostId)!;
      assert.deepEqual(validateParameters(frame, host.component.parameters, 'default'), [], hostId);
      assert.ok(
        frameHoles(host.component.parameters).filter((hole) => hole.threadDesignation === 'M4')
          .length >= 2,
      );
      assert.ok(host.component.manufacturing);
    }
    if (station.axis === 'z')
      assert.ok(station.bracketCenter[2] - station.bracketSize[2] / 2 > v.tableTop + 200);
  }
});

test('new sensor brackets and steel targets have finite connected preview boundaries and retain host threads in both modes', () => {
  const pieces = millingComponents(machine.defaults).filter(
    (piece) => /^[xyz]-limit-/.test(piece.component.id) && piece.component.libraryId === frame.id,
  );
  for (const mode of ['simple', 'full'] as const)
    for (const piece of pieces) {
      const parameters = piece.component.parameters;
      assert.deepEqual(validateParameters(frame, parameters, 'default'), [], piece.component.id);
      const model = withGeometryMode(mode, () => frame.buildGeometry(parameters, 'default'));
      try {
        const box = new Box3().setFromObject(model, true);
        const size = box.getSize(new Vector3());
        assert.ok([size.x, size.y, size.z].every((n) => Number.isFinite(n) && n > 0));
        const meshes: Mesh[] = [];
        model.traverse((object) => {
          if (object instanceof Mesh) meshes.push(object);
        });
        assert.equal(meshes.length, 1, 'Each bracket or flag is one manufactured blank.');
        assert.ok(meshes[0].geometry.getAttribute('position').count > 0);
      } finally {
        disposeModel(model);
      }
    }
  const host = millingComponents(machine.defaults).find(
    (piece) => piece.component.id === 'moving-z-saddle',
  )!;
  for (const mode of ['simple', 'full'] as const) {
    const python = withGeometryMode(mode, () => frame.python(host.component.parameters, 'default'));
    assert.match(python, /M4/);
    assert.equal(python.includes('def _protolab_thread('), mode === 'full');
  }
  assert.ok(
    frame.validate(
      { ...frame.defaults, role: 'limit-bridge', wall: 5, rearWebHeight: 3 },
      'default',
    ).length,
  );
  assert.ok(frame.validate({ ...frame.defaults, role: 'limit-angle', wall: 1 }, 'default').length);
});

test(
  'native CNC limit units and every fabricated fixture are closed positive solids with a clear five-mm nut clamping plate',
  { skip: !process.env.FREECAD_PYTHON, timeout: 90_000 },
  () => {
    const parts = millingComponents(machine.defaults).filter(
      (piece) => /^[xyz]-limit-/.test(piece.component.id) && piece.component.libraryId === frame.id,
    );
    const cases = (['simple', 'full'] as const).map((mode) => ({
      mode,
      sensor: withGeometryMode(mode, () => measurement.python(measurement.defaults, 'default')),
      fixtures: parts.map((piece) => ({
        id: piece.component.id,
        source: withGeometryMode(mode, () => frame.python(piece.component.parameters, 'default')),
        translation: piece.component.placement.translation,
        rotation: piece.component.placement.rotation,
      })),
      stations: limitStations(machine.defaults, millingLayout(machine.defaults)),
    }));
    const source = `import FreeCAD as App, Part, math, json
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
proof=[]
def placed(shape, rotation, translation):
    shape=shape.copy()
    for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):
        if angle: shape.rotate(App.Vector(),axis,angle)
    shape.translate(App.Vector(*translation))
    return shape
for case in cases:
    scope={'App':App,'Part':Part,'math':math}
    exec(case['sensor'],scope)
    sensor=scope['shape']
    assert len(scope['components'])==5,'source instrument subdivisions remain one purchased unit'
    assert all(s.isValid() and s.isClosed() and len(s.Solids)==1 and s.Volume>0 for s in scope['components'])
    fixtures={}
    for fixture in case['fixtures']:
        local={'App':App,'Part':Part,'math':math}
        exec(fixture['source'],local)
        s=local['shape']
        assert s.isValid() and s.isClosed() and len(s.Solids)==1 and s.Volume>0,(case['mode'],fixture['id'])
        fixtures[fixture['id']]=placed(s,fixture['rotation'],fixture['translation'])
    for station in case['stations']:
        unit=placed(sensor,station['sensorRotation'],station['sensorOrigin'])
        bracket=fixtures[station['id']+'-bracket']
        volume=unit.common(bracket).Volume
        assert abs(volume)<1e-6,(case['mode'],station['id'],'sensor/wafer interference',volume)
    proof.append({'mode':case['mode'],'supplierComponents':5,'singleSolidFixtures':len(fixtures),'clearSensorBrackets':6})
open('/tmp/protolab-cnc-limits-native-proof.json','w').write(json.dumps(proof,indent=2))
print(json.dumps(proof))
`;
    writeFileSync('/tmp/protolab-cnc-limits-native.py', source);
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['/tmp/protolab-cnc-limits-native.py'], {
      env: process.env,
      encoding: 'utf8',
      timeout: 80_000,
      maxBuffer: 2_000_000,
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
  },
);
