import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Box3, Mesh, Vector3, type Group } from 'three';
import part, {
  fixed,
  thread,
  layout,
  pieces,
  libraries,
  gearOutline,
  shaftShape,
  forkShape,
  nutShape,
  screwShape,
  outputHoleCenters,
} from '../src/parts/tr8-geared-rocker-actuator/part';
import module from '../src/parts/tr8-geared-rocker-actuator/index';
import { withGeometryMode } from '../src/core/geometry-mode';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { parseDetailRecipe } from '../src/core/component-recipes';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { pythonShape, type Shape } from '../src/core/assembly/boundary/shapes';
import sampling from './fixtures/tr8-geared-rocker-preview-sampling.json';
import { gearGeometry, gearValues } from '../src/core/hardware/gears';
import { eskdIdentity } from '../src/core/eskd';
import {
  gearParameters,
  gearBore,
  gearShape,
} from '../src/parts/tr8-geared-rocker-actuator/lib/shapes';

const near = (a: number, b: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const parameters = (outputAngle = 0, motor = String(part.defaults.motor)) => ({
  ...part.defaults,
  motor,
  outputAngle,
});
function walk(shape: Shape): Shape[] {
  if (shape.kind === 'transform') return [shape, ...walk(shape.child)];
  if (shape.kind === 'union' || shape.kind === 'subtract' || shape.kind === 'intersect')
    return [shape, ...shape.children.flatMap(walk)];
  return [shape];
}

test('the fixed TR8x4 execution validates every pose and rejects unsupported hardware', () => {
  for (const preset of part.presets)
    for (const state of part.states!)
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
  for (const angle of [-20, 0, 20])
    assert.deepEqual(part.validate(parameters(angle), 'assembled'), []);
  for (const angle of [-21, 21, Number.NaN])
    assert.ok(part.validate(parameters(angle), 'assembled').length);
  assert.ok(part.validate(parameters(0, 'unsupported-motor'), 'assembled').length);
  assert.ok(part.validate({ ...parameters(), motorModel: 'another-motor' }, 'assembled').length);
  assert.ok(part.validate(parameters(), 'missing-state').length);
  assert.equal(module.part.mechanismExecution?.screws[0].designation, 'TR8×4(P2)');
  assert.equal(module.part.mechanismExecution?.outputs, 1);
  assert.deepEqual(thread, {
    diameter: 8,
    rootDiameter: 5.5,
    pitch: 2,
    lead: 4,
    starts: 2,
    includedAngle: 30,
  });
});

test('all eight motor executions retain their source identity and the common front gear interface', () => {
  const models = [
    'surpass-2845-3100kv',
    ...[3200, 3500, 3700, 4400, 4700, 5100, 5700].map((kv) => `surpass-2838-${kv}kv`),
  ];
  assert.deepEqual(
    part.presets.map((preset) => preset.parameters.motor),
    models,
  );
  assert.equal(part.defaults.motor, models[0]);
  const identities = part.presets.map((preset) => {
    const rows = pieces(preset.parameters);
    assert.equal(rows.length, 26);
    const motor = rows.find((piece) =>
      ['surpass-2845', 'surpass-2838'].includes(piece.component.libraryId),
    )!;
    const smaller = String(preset.parameters.motor).startsWith('surpass-2838-');
    assert.equal(motor.component.libraryId, smaller ? 'surpass-2838' : 'surpass-2845');
    assert.equal(motor.component.parameters.model, preset.parameters.motor);
    assert.equal(motor.component.state, 'cross-drilled');
    assert.equal(motor.component.supply, 'manufactured');
    assert.deepEqual(motor.component.manufacturing!.processes, ['drilling']);
    const model = componentGeometry(libraries, [motor]);
    try {
      const bounds = new Box3().setFromObject(model, true);
      near(bounds.min.x, -15, 0.0001);
      near(bounds.max.x, smaller ? 40 : 47, 0.0001);
    } finally {
      disposeModel(model);
    }
    const physical = eskdIdentity(part, preset.parameters, 'assembled', preset.id);
    assert.equal(
      eskdIdentity(part, { ...preset.parameters, outputAngle: 20 }, 'assembled', preset.id)
        .designation,
      physical.designation,
    );
    return physical.configurationKey;
  });
  assert.equal(new Set(identities).size, 8, 'motor windings are separate physical executions');
});

test('two-start screw, 1:1 counter-rotating gears and both radial slots follow the same motion law', () => {
  for (let angle = -20; angle <= 20; angle += 5) {
    const v = layout(parameters(angle));
    const radius = fixed.lever / Math.cos((angle * Math.PI) / 180);
    near(v.displacement, -fixed.lever * Math.tan((angle * Math.PI) / 180));
    near(v.screwTurns * 4, -v.displacement);
    near(v.motorTurns, -v.screwTurns);
    near(v.motorAngle, -v.screwAngle);
    near(v.pinRadius, radius);
    // Inverse rigid transform from the stationary screw line into the rotating fork.
    const dx = v.nutX - fixed.outputX,
      dy = -fixed.outputY;
    near(dx * Math.cos(v.radians) + dy * Math.sin(v.radians), 0);
    near(-dx * Math.sin(v.radians) + dy * Math.cos(v.radians), radius);
    assert.ok(radius > fixed.slotStart && radius < fixed.slotEnd);
  }
  near(layout(parameters(20)).nutX + layout(parameters(-20)).nutX, 2 * fixed.outputX);
  const requiredThread = 2 * Math.abs(layout(parameters(20)).displacement) + fixed.nutLength;
  assert.ok(fixed.threadEnd - fixed.threadStart >= requiredThread);
  assert.ok(
    fixed.threadEnd - fixed.threadStart < requiredThread + 4,
    'Retained thread follows the specified ±20° stroke.',
  );
  assert.equal(fixed.gearModule * fixed.gearTeeth, fixed.motorY);
});

test('the 31 mm working thread and 16 mm nut reach both carrier walls exactly at the travel limits', () => {
  near(fixed.threadStart, 0);
  near(fixed.threadEnd, 31);
  near(fixed.nutLength, 16);
  near(fixed.outputX, 15.5);
  near(fixed.lever, 7.5 / Math.tan(Math.PI / 9));
  near(layout(parameters(20)).nutX, 8);
  near(layout(parameters(-20)).nutX, 23);
  near(layout(parameters(20)).nutX - fixed.nutLength / 2, fixed.frontPlateEnd);
  near(layout(parameters(-20)).nutX + fixed.nutLength / 2, 31);
  near(2 * Math.abs(layout(parameters(20)).displacement), 15);
  near(fixed.nutEndReliefDiameter, 10.4);
  near(fixed.nutEndReliefDepth, 0.4);
  const pockets = walk(nutShape()).filter(
    (shape) => shape.kind === 'cylinder' && shape.axis === 'x' && shape.radius === 5.2,
  );
  assert.equal(pockets.length, 2);
  for (const pocket of pockets) {
    if (pocket.kind !== 'cylinder') throw new Error('Expected a nut end pocket.');
    const overlap = Math.min(pocket.origin[0] + pocket.height, 8) - Math.max(pocket.origin[0], -8);
    near(overlap, 0.4);
  }
  withGeometryMode('full', () => {
    for (const id of ['screw', 'nut']) {
      const piece = pieces(parameters()).find((piece) => piece.component.id === id)!;
      const helix = walk(parseDetailRecipe(String(piece.component.parameters.recipe))).find(
        (shape) => shape.kind === 'helical-worm',
      );
      assert.ok(helix?.kind === 'helical-worm');
      if (helix?.kind !== 'helical-worm') throw new Error('Expected a working thread.');
      near(helix.phase, (2 * Math.PI * 15.5) / 4);
    }
    const source = part.python(parameters(), 'assembled');
    const callouts = [
      ...source.matchAll(/^    component_metadata\[-1\]\["ThreadFeaturesJSON"\] = (.+)$/gm),
    ].flatMap(
      (match) =>
        JSON.parse(JSON.parse(match[1])) as {
          internal: boolean;
          length: number;
          origin: number[];
        }[],
    );
    const male = callouts.find((callout) => !callout.internal)!,
      female = callouts.find((callout) => callout.internal)!;
    assert.ok(male && female);
    near(male.length, 31);
    near(female.length, 15.2);
    near(female.origin[0], 7.9);
  });
});

test('all four bearings are the requested SMB MF106 2Z and threaded fasteners stay at approved interfaces', () => {
  const rows = pieces(parameters());
  assert.equal(rows.length, 26);
  assert.equal(new Set(rows.map((p) => p.component.id)).size, rows.length);
  const bearings = rows.filter((p) => p.component.libraryId === 'flanged-ball-bearing');
  assert.equal(bearings.length, 4);
  for (const { component } of bearings) {
    assert.equal(component.presetId, 'smb-mf106-2z');
    assert.equal(component.procurement?.manufacturer, 'SMB Bearings');
    assert.deepEqual(component.parameters, {
      bore: 6,
      outer: 10,
      width: 3,
      flangeOuter: 11.2,
      flangeWidth: 0.6,
      seals: 'metal',
      balls: 10,
    });
  }
  const motors = rows.filter((p) => p.component.libraryId === 'surpass-2845');
  assert.equal(motors.length, 1);
  assert.deepEqual(motors[0].component.parameters, {
    model: 'surpass-2845-3100kv',
    shaftAngle: -7.5,
  });
  assert.equal(motors[0].component.state, 'cross-drilled');
  assert.equal(motors[0].component.supply, 'manufactured');
  const bolts = rows.filter((p) => p.component.libraryId === 'bolt-screw');
  assert.equal(bolts.length, 6);
  assert.equal(bolts.filter((p) => p.component.id.startsWith('motor-bolt-')).length, 2);
  assert.equal(bolts.filter((p) => p.component.id.startsWith('output-head-bolt-')).length, 4);
  const clips = rows.filter((p) =>
    ['gear-clip', 'screw-rear-clip', 'output-clip'].includes(p.component.id),
  );
  assert.equal(clips.length, 3);
  assert.ok(
    clips.every(
      (p) =>
        p.component.supply === 'standard' &&
        p.component.libraryId === 'e-ring' &&
        p.component.presetId === 'gvyntok-e-ring-3.2' &&
        p.component.parameters.installedGrooveDiameter === 3.2 &&
        p.component.procurement?.standard === 'DIN 6799',
    ),
  );
  const pins = rows.filter((p) => p.component.libraryId === 'spring-pin');
  assert.equal(pins.length, 4);
  for (const { component } of pins) {
    assert.equal(component.state, 'installed');
    assert.equal(component.parameters.diameter, component.id === 'motor-gear-pin' ? 1 : 2);
    assert.equal(component.parameters.length, 10);
    assert.match(component.procurement!.designation, /DIN 1481/);
  }
  assert.ok(rows.every((p) => libraries.some((l) => l.id === p.component.libraryId)));
  assert.ok(
    rows
      .filter((p) => p.component.libraryId === 'manufactured-detail')
      .every((p) => p.requireSingleSolid),
  );
});

test('motion changes placements while preserving every manufactured and purchased definition', () => {
  const neutral = pieces(parameters());
  for (const angle of [-20, 20]) {
    const moved = pieces(parameters(angle));
    assert.equal(moved.length, neutral.length);
    for (const piece of moved) {
      const original = neutral.find((p) => p.component.id === piece.component.id)!;
      const definition = libraries.find((p) => p.id === piece.component.libraryId)!;
      const physical = (p: typeof piece.component.parameters) =>
        definition.identityParameters?.(p) ?? p;
      assert.deepEqual(
        physical(piece.component.parameters),
        physical(original.component.parameters),
        piece.component.id,
      );
      assert.equal(piece.component.libraryId, original.component.libraryId);
    }
    for (const id of [
      'frame',
      'screw-front-bearing',
      'screw-rear-bearing',
      'output-upper-bearing',
      'output-lower-bearing',
    ]) {
      assert.deepEqual(
        moved.find((p) => p.component.id === id),
        neutral.find((p) => p.component.id === id),
        id,
      );
    }
    const motor = moved.find((p) => p.component.id === 'motor')!.component;
    near(
      Number(motor.parameters.shaftAngle),
      -(fixed.motorGearPhase + layout(parameters(angle)).motorAngle),
    );
    assert.deepEqual(
      motor.placement,
      neutral.find((p) => p.component.id === 'motor')!.component.placement,
    );
    assert.deepEqual(part.composition!(parameters(angle)), part.composition!(parameters()));
    assert.deepEqual(
      part.identityParameters!(parameters(angle)),
      part.identityParameters!(parameters()),
    );
  }
});

test('full geometry contains two-start helical male and female threads rather than decorative rings', () => {
  withGeometryMode('full', () => {
    const rows = pieces(parameters());
    for (const id of ['screw', 'nut']) {
      const component = rows.find((p) => p.component.id === id)!.component;
      const nodes = walk(parseDetailRecipe(String(component.parameters.recipe)));
      const helices = nodes.filter((p) => p.kind === 'helical-worm');
      assert.equal(helices.length, 1, id);
      const helix = helices[0];
      assert.equal(helix.kind, 'helical-worm');
      if (helix.kind !== 'helical-worm') throw new Error('Missing helix');
      assert.equal(helix.lead, 4);
      assert.equal(helix.starts, 2);
      assert.ok(helix.rings.length > 90);
      assert.ok(helix.rings.every((ring) => ring.length === helix.rings[0].length));
    }
  });
  withGeometryMode('simple', () => {
    for (const row of pieces(parameters()).filter((p) => ['screw', 'nut'].includes(p.component.id)))
      assert.ok(
        !walk(parseDetailRecipe(String(row.component.parameters.recipe))).some(
          (p) => p.kind === 'helical-worm',
        ),
      );
  });
});

test('two identical 3 mm laser fork plates use edge cross-pins on a continuous round Ø6 shaft', () => {
  const rows = pieces(parameters());
  const plates = rows.filter((p) =>
    ['fork-upper-plate', 'fork-lower-plate'].includes(p.component.id),
  );
  assert.equal(plates.length, 2);
  assert.deepEqual(plates[0].component.parameters, plates[1].component.parameters);
  for (const piece of plates) {
    assert.equal(piece.component.manufacturing!.material, '3 mm steel sheet');
    assert.deepEqual(piece.component.manufacturing!.processes, ['cutting', 'drilling']);
    assert.match(piece.component.manufacturing!.requirements.join(' '), /secondary operation/);
    const model = componentGeometry(libraries, [piece]);
    try {
      const box = new Box3().setFromObject(model, true);
      near(box.max.z - box.min.z, 3, 0.0001);
      near(box.min.z, piece.component.id === 'fork-upper-plate' ? 7.1 : -10.1, 0.0001);
    } finally {
      disposeModel(model);
    }
  }
  const plateNodes = walk(forkShape());
  assert.ok(plateNodes.some((s) => s.kind === 'prism' && s.depth === 3));
  assert.ok(plateNodes.some((s) => s.kind === 'cylinder' && s.axis === 'z' && s.radius === 3.025));
  assert.ok(
    plateNodes.some(
      (s) => s.kind === 'cylinder' && s.axis === 'x' && s.radius === 1 && s.origin[2] === 1.5,
    ),
  );
  const shaftNodes = walk(shaftShape());
  assert.ok(
    !shaftNodes.some((s) => s.kind === 'prism' || s.kind === 'shaft-bore'),
    'The output shaft has no square milled section.',
  );
  assert.ok(
    shaftNodes.some(
      (s) =>
        s.kind === 'cylinder' &&
        s.axis === 'z' &&
        s.radius === 3 &&
        Math.abs(s.origin[2] + 13.3) < 1e-7 &&
        s.height >= 26.6 &&
        s.height < 26.7,
    ),
  );
  const crossHoles = shaftNodes.filter(
    (s) => s.kind === 'cylinder' && s.axis === 'x' && s.radius === 1,
  );
  assert.equal(crossHoles.length, 2);
  assert.deepEqual(
    crossHoles.map((s) => (s.kind === 'cylinder' ? s.origin[2] : 0)).sort((a, b) => a - b),
    [-8.6, 8.6],
  );
  for (const id of ['output-clip', 'gear-clip', 'screw-rear-clip'])
    assert.ok(
      rows.some((p) => p.component.id === id),
      id,
    );
  for (const id of [
    'fork',
    'output-journal-sleeve',
    'output-upper-spacer',
    'output-head-spacer',
    'screw-front-spacer',
  ])
    assert.ok(!rows.some((p) => p.component.id === id), id + ' must be removed');
  const screw = rows.find((p) => p.component.id === 'screw')!.component;
  assert.match(screw.manufacturing!.blank, /unthreaded|Unthreaded/);
  const bolts = rows.filter((p) => p.component.libraryId === 'bolt-screw');
  assert.ok(!bolts.some((p) => /fork|gear|frame/.test(p.component.id)));
});

test('head M3 holes use the ST3215 PCD14 locations and M3×5 motor screws mount directly to the flat plate', () => {
  assert.deepEqual(outputHoleCenters(), [
    [7, 0],
    [-7, 0],
    [0, 7],
    [0, -7],
  ]);
  const threaded = walk(shaftShape()).filter((s) => s.kind === 'cylinder' && s.thread?.internal);
  assert.equal(threaded.length, 4);
  for (const shape of threaded) {
    if (shape.kind !== 'cylinder') throw new Error('Expected a threaded cylinder');
    near(shape.radius, 1.5);
    near(shape.thread!.pitch, 0.5);
    near(Math.hypot(shape.origin[0], shape.origin[1]), 7);
  }
  for (const angle of [-20, 0, 20]) {
    const rows = pieces(parameters(angle));
    const headBolts = rows.filter((p) => p.component.id.startsWith('output-head-bolt-'));
    for (const { component } of headBolts)
      near(
        Math.hypot(
          component.placement.translation[0] - fixed.outputX,
          component.placement.translation[1] - fixed.outputY,
        ),
        7,
      );
    for (const piece of rows.filter((p) => p.component.id.startsWith('motor-bolt-'))) {
      assert.equal(piece.component.parameters.head, 'socket-cap');
      assert.equal(piece.component.parameters.length, 5);
      const model = componentGeometry(libraries, [piece]);
      try {
        const bounds = new Box3().setFromObject(model, true);
        near(bounds.min.x, fixed.frontPlateStart - 1.65, 0.00001);
        near(bounds.max.x, 2, 0.00001);
      } finally {
        disposeModel(model);
      }
    }
  }
});

test('three standard E-clips retain the Ø5 shaft necks directly beside the bearing edges', () => {
  const rows = pieces(parameters());
  assert.ok(!rows.some((p) => /shim|spacer|sleeve/.test(p.component.id)));
  for (const [cid, bid, axis, side] of [
    ['gear-clip', 'screw-front-bearing', 'x', 'max'],
    ['screw-rear-clip', 'screw-rear-bearing', 'x', 'min'],
    ['output-clip', 'output-lower-bearing', 'z', 'max'],
  ] as const) {
    const piece = rows.find((p) => p.component.id === cid)!,
      bearing = rows.find((p) => p.component.id === bid)!;
    assert.equal(piece.component.libraryId, 'e-ring');
    assert.equal(piece.component.presetId, 'gvyntok-e-ring-3.2');
    assert.equal(piece.component.parameters.installedGrooveDiameter, 3.2);
    const first = componentGeometry(libraries, [piece]),
      second = componentGeometry(libraries, [bearing]);
    try {
      const a = new Box3().setFromObject(first, true),
        b = new Box3().setFromObject(second, true);
      near(a[side][axis], b[side === 'max' ? 'min' : 'max'][axis], 0.0001);
    } finally {
      disposeModel(first);
      disposeModel(second);
    }
  }
  const screwNodes = walk(screwShape());
  assert.ok(!screwNodes.some((s) => s.kind === 'prism' || s.kind === 'shaft-bore'));
  assert.ok(!screwNodes.some((s) => s.kind === 'torus'));
  assert.equal(fixed.clipNeckDiameter, 5);
  for (const start of [fixed.frontNeckStart - 0.05, fixed.rearBearingX + 1.5 - 0.05])
    assert.ok(
      screwNodes.some(
        (s) => s.kind === 'cylinder' && s.axis === 'x' && s.radius === 2.5 && s.origin[0] === start,
      ),
    );
  for (const groove of [fixed.frontGroove, fixed.rearGroove, fixed.outputGroove]) {
    near(groove.width, 0.64);
    near(groove.rootDiameter, 3.2);
  }
  assert.ok(
    walk(shaftShape()).some(
      (s) =>
        s.kind === 'cylinder' &&
        s.axis === 'z' &&
        s.radius === 2.5 &&
        s.origin[2] === fixed.outputShaftEnd,
    ),
  );
  assert.ok(
    screwNodes.some(
      (s) =>
        s.kind === 'cylinder' &&
        s.radius === 3 &&
        s.axis === 'x' &&
        s.origin[0] === fixed.screwStart,
    ),
  );
});

test('both gear pins pass through their outboard hubs without cutting the tooth faces', () => {
  const rows = pieces(parameters());
  near(fixed.gearHubStart, -15);
  near(fixed.gearHubEnd, -11);
  near(fixed.gearHubDiameter, 12);
  near(fixed.gearPinX, -13);
  assert.ok(fixed.gearPinX + fixed.screwGearPinDiameter / 2 < fixed.gearStart);
  assert.ok(fixed.gearPinX - fixed.screwGearPinDiameter / 2 > fixed.gearHubStart);
  for (const pinion of [false, true]) {
    assert.equal(gearBore(pinion).shape, 'round');
    near(gearBore(pinion).radius * 2, pinion ? 3.175 : 6.02);
    const cut = walk(gearShape(pinion)).filter(
      (s) => s.kind === 'cylinder' && s.axis === 'z' && s.origin[0] === -13,
    );
    assert.equal(cut.length, 1);
    if (cut[0].kind !== 'cylinder') throw new Error('Missing gear drill');
    near(cut[0].radius, pinion ? 0.5 : 1);
    near(cut[0].height, 12.2);
    assert.ok(cut[0].origin[0] + cut[0].radius < fixed.gearStart);
  }
  assert.ok(
    walk(screwShape()).some(
      (s) => s.kind === 'cylinder' && s.axis === 'z' && s.origin[0] === -13 && s.radius === 1,
    ),
  );
  for (const angle of [-20, 0, 20]) {
    const now = pieces(parameters(angle)),
      v = layout(parameters(angle));
    for (const [id, expected] of [
      ['screw-gear-pin', v.screwAngle],
      ['motor-gear-pin', fixed.motorGearPhase + v.motorAngle],
    ] as const) {
      const c = now.find((p) => p.component.id === id)!.component;
      near(c.placement.rotation[0], expected);
      near(c.placement.translation[0], -13);
      assert.equal(c.state, 'installed');
    }
  }
  assert.match(
    rows.find((p) => p.component.id === 'motor')!.component.manufacturing!.requirements.join(' '),
    /secondary machining|secondary drilling/i,
  );
});

test('preview has finite geometry and reported dimensions match the placed components at both travel limits', () => {
  withGeometryMode('simple', () => {
    for (const angle of [-20, 0, 20]) {
      const p = parameters(angle);
      const model = part.buildGeometry(p, 'assembled');
      try {
        const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
        const declared = part.dimensions(p, 'assembled');
        size.forEach((value, i) => near(value, declared[i], 0.001));
        assert.ok(size[0] < 70 && size[1] < 75 && size[2] < 40, size.join(' × '));
        let meshes = 0;
        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          meshes++;
          const positions = object.geometry.getAttribute('position');
          assert.ok(positions.count > 0);
          assert.ok(Array.from(positions.array).every(Number.isFinite));
        });
        assert.ok(meshes >= pieces(p).length);
      } finally {
        disposeModel(model);
      }
    }
    const inspection = componentGeometry(libraries, pieces(parameters(), 'output'));
    disposeModel(inspection);
  });
});

test('placed hub gears retain their involute radius, closed oriented surface and drilled volume throughout travel', () => {
  function surface(model: Group, axis: 'x' | 'z', centerY = 0) {
    model.updateMatrixWorld(true);
    let volume = 0,
      maxRadius = 0,
      triangles = 0,
      degenerate = 0,
      minimumAxial = Infinity,
      maximumAxial = -Infinity;
    const edges = new Map<string, { uses: number; balance: number }>();
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position'),
        indices = object.geometry.index;
      for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
        const vertices = [0, 1, 2].map((j) =>
          new Vector3()
            .fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j)
            .applyMatrix4(object.matrixWorld),
        );
        triangles++;
        volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
        if (
          vertices[1]
            .clone()
            .sub(vertices[0])
            .cross(vertices[2].clone().sub(vertices[0]))
            .lengthSq() < 1e-20
        )
          degenerate++;
        for (const vertex of vertices) {
          minimumAxial = Math.min(minimumAxial, vertex[axis]);
          maximumAxial = Math.max(maximumAxial, vertex[axis]);
          maxRadius = Math.max(
            maxRadius,
            axis === 'x'
              ? Math.hypot(vertex.y - centerY, vertex.z)
              : Math.hypot(vertex.x, vertex.y),
          );
        }
        const keys = vertices.map((vertex) =>
          vertex
            .toArray()
            .map((value) => Math.round(value * 1e5))
            .join(','),
        );
        for (let j = 0; j < 3; j++) {
          const a = keys[j],
            b = keys[(j + 1) % 3],
            key = a < b ? `${a}/${b}` : `${b}/${a}`,
            edge = edges.get(key) ?? { uses: 0, balance: 0 };
          edge.uses++;
          edge.balance += a < b ? 1 : -1;
          edges.set(key, edge);
        }
      }
    });
    return {
      volume,
      maxRadius,
      triangles,
      degenerate,
      minimumAxial,
      maximumAxial,
      badEdges: [...edges.values()].filter(({ uses, balance }) => uses !== 2 || balance !== 0)
        .length,
    };
  }

  withGeometryMode('simple', () => {
    for (const angle of [-20, 0, 20])
      for (const pinion of [false, true]) {
        const id = pinion ? 'motor-pinion' : 'driven-gear',
          piece = pieces(parameters(angle)).find((item) => item.component.id === id)!;
        const values = gearValues({
          ...gearParameters,
          bore: pinion ? 3.175 : fixed.screwGearBore,
          boreShape: 'round',
        });
        const hubCentre = (fixed.gearHubStart + fixed.gearEnd) / 2;
        const actual = componentGeometry(libraries, [piece]),
          reference = gearGeometry(
            {
              ...values,
              hubRadius: fixed.gearHubDiameter / 2,
              length: fixed.gearEnd - fixed.gearHubStart,
            },
            [
              { z: fixed.gearStart - hubCentre, angle: 0, scale: 1 },
              { z: fixed.gearEnd - hubCentre, angle: 0, scale: 1 },
            ],
          );
        try {
          const mesh = surface(actual, 'x', pinion ? fixed.motorY : 0),
            expected = surface(reference, 'z');
          assert.ok(mesh.triangles > 0, `${id} at ${angle}°`);
          near(mesh.maxRadius, 13, 0.00001);
          assert.ok(mesh.volume > 0, `${id} at ${angle}° must enclose positive volume`);
          assert.equal(mesh.degenerate, 0, `${id} at ${angle}° has no collapsed triangles`);
          assert.equal(mesh.badEdges, 0, `${id} at ${angle}° must be watertight and oriented`);
          near(mesh.minimumAxial, fixed.gearHubStart, 0.0001);
          near(mesh.maximumAxial, fixed.gearEnd, 0.0001);
          // The shared curve sampler changed; its documented preview revision retains native CAD.
          const baseline = sampling.gears.find((gear) => gear.id === id)!;
          assert.equal(
            createHash('sha256')
              .update(pythonShape(gearShape(pinion)))
              .digest('hex'),
            baseline.nativeSourceSha256,
          );
          near(mesh.volume, baseline.previewVolumeMm3, 0.01);
          const removed = expected.volume - mesh.volume;
          assert.ok(
            removed > (pinion ? 6 : 18) && removed < (pinion ? 9 : 21) + expected.volume * 0.005,
            'The drilled hub removes material from the SDK one-sided hub reference.',
          );
        } finally {
          disposeModel(actual);
          disposeModel(reference);
        }
      }
  });
});

test('gears have 24 involute teeth and fabrication files include actual component and motion data', () => {
  const points = gearOutline();
  const radii = points.map(([x, y]) => Math.hypot(x, y));
  const max = Math.max(...radii);
  near(max, 13);
  const crests = radii.map((r) => r > max - 0.000001);
  const count = crests.filter(
    (crest, i) => crest && !crests[(i + crests.length - 1) % crests.length],
  ).length;
  assert.equal(count, 24);
  const files = part.fabricationFiles!(parameters());
  assert.equal(files.length, 11);
  assert.equal(new Set(files.map((f) => f.name)).size, files.length);
  const all = files.map((f) => f.content).join('\n');
  assert.match(all, /MF106/);
  assert.match(all, /3100KV/);
  assert.match(all, /TR8.?4|Tr8.?4/);
  assert.ok(files.some((f) => f.type.startsWith('text/csv')));
  assert.ok(files.some((f) => f.name.endsWith('.svg') || f.name.endsWith('.dxf')));
  const manifest = JSON.parse(files.find((f) => f.id === 'laser-manifest')!.content);
  assert.equal(manifest.units, 'mm');
  assert.equal(manifest.blanks.length, 1);
  assert.equal(manifest.blanks[0].quantity, 2);
  assert.equal(manifest.blanks[0].thickness, 3);
  assert.equal(manifest.blanks[0].nominalRoundBore, 6.05);
  assert.deepEqual(manifest.blanks[0].occurrences, ['fork-upper-plate', 'fork-lower-plate']);
  const dxf = files.find((f) => f.id === 'fork-plate-dxf')!.content.split('\n');
  const dxfLoops: [number, number][][] = [];
  let loop: [number, number][] | undefined;
  for (let i = 0; i + 1 < dxf.length; i += 2) {
    const code = Number(dxf[i]),
      value = dxf[i + 1];
    if (code === 0) {
      if (loop) dxfLoops.push(loop);
      loop = value === 'LWPOLYLINE' ? [] : undefined;
    }
    if (loop && code === 70) assert.equal(Number(value), 1, 'Laser contours must be closed.');
    if (loop && code === 10) {
      assert.equal(Number(dxf[i + 2]), 20);
      loop.push([Number(value), Number(dxf[i + 3])]);
    }
  }
  assert.equal(dxfLoops.length, 2);
  const svg = files.find((f) => f.id === 'fork-plate-svg')!.content;
  assert.match(svg, /width="16mm" height="36mm" viewBox="-8 -28 16 36"/);
  const svgLoops = [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => {
    const numbers = match[1].match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)!.map(Number);
    return Array.from({ length: numbers.length / 2 }, (_, i) => [
      numbers[2 * i],
      numbers[2 * i + 1] === 0 ? 0 : -numbers[2 * i + 1],
    ]);
  });
  assert.deepEqual(
    svgLoops,
    dxfLoops,
    'Delivered SVG and DXF must describe the same 1:1 contours.',
  );
  for (const [x, y] of dxfLoops[1]) near(Math.hypot(x, y), 3.025, 0.000001);
});
