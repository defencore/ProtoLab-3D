import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Mesh, Ray, Vector3, type Object3D } from 'three';
import part from '../src/parts/servo-toggle-actuator/part';
import { configured, kinematics } from '../src/parts/servo-toggle-actuator/lib/model';
import { frame } from '../src/parts/servo-toggle-actuator/lib/frame';
import { servoMount } from '../src/parts/servo-toggle-actuator/lib/servo-mount';
import { layout } from '../src/parts/servo-toggle-actuator/lib/layout';
import { parallelMountDetails } from '../src/parts/servo-toggle-actuator/lib/parallel-mount';
import { parallelPanelInterface } from '../src/parts/servo-toggle-actuator/lib/parallel-installation';
import { parallelLegendLayout } from '../src/parts/servo-toggle-actuator/lib/parallel-legends';
import { hardwareLibraries } from '../src/parts/servo-toggle-actuator/lib/hardware';
import { validateParameters } from '../src/core/validation';
import { matchingPresetId } from '../src/core/part-selection';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';
import type { Shape } from '../src/core/assembly/boundary/shapes';

const p = (extra: Parameters = {}): Parameters => ({
  ...part.defaults,
  mechanism: 'guided',
  baseLength: 160,
  baseWidth: 96,
  deckHeight: 50,
  contactHeight: 10,
  padGap: 13,
  servoSweep: 50,
  ...extra,
});
const rocker = (extra: Parameters = {}): Parameters => ({
  ...part.defaults,
  mechanism: 'rocker',
  baseLength: 100,
  baseWidth: 90,
  deckHeight: 42,
  ...extra,
});
const parallel = (extra: Parameters = {}): Parameters => ({
  ...part.defaults,
  mechanism: 'parallel',
  baseLength: 80,
  baseWidth: 110,
  deckHeight: 42,
  ...extra,
});

const dual = (extra: Parameters = {}): Parameters => ({
  ...part.defaults,
  mechanism: 'parallel-dual',
  baseLength: 100,
  baseWidth: 150,
  deckHeight: 42,
  manualState: 'guarded-off',
  ...extra,
});

const dualWorldPoint = (x: number, y: number, z: number) => new Vector3(y, -x, z);
const dualWorldPlacement = (placement: {
  translation: readonly number[];
  rotation: readonly number[];
}) => ({
  translation: [placement.translation[1], -placement.translation[0], placement.translation[2]],
  rotation: [placement.rotation[0], placement.rotation[1], placement.rotation[2] - 90],
});

/** Independent closest-line solution, with the physical arm's finite length. */
function armDistance(yawDegrees: number, leverDegrees: number, side: -1 | 1) {
  const yaw = (yawDegrees * Math.PI) / 180,
    tilt = (leverDegrees * Math.PI) / 180,
    start = new Vector3(0, -28, 10),
    arm = new Vector3(side * Math.cos(yaw), side * Math.sin(yaw), 0),
    lever = new Vector3(Math.sin(tilt), 0, Math.cos(tilt)),
    b = arm.dot(lever),
    d = arm.dot(start),
    e = lever.dot(start),
    alongArm = Math.max(0, Math.min(28, (b * e - d) / (1 - b * b))),
    closest = start.clone().addScaledVector(arm, alongArm),
    alongLever = closest.dot(lever),
    leverPoint = lever.clone().multiplyScalar(alongLever),
    axisDistance = closest.distanceTo(leverPoint);
  return {
    clearance: axisDistance - 8.5,
    alongArm,
    alongLever,
    contactHeight: closest.z + ((leverPoint.z - closest.z) * 5) / axisDistance,
  };
}
const near = (a: number, b: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} versus ${b}`);
function cylinders(shape: Shape): Extract<Shape, { kind: 'cylinder' }>[] {
  if (shape.kind === 'cylinder') return [shape];
  if (shape.kind === 'transform') return cylinders(shape.child);
  if ('children' in shape) return shape.children.flatMap(cylinders);
  return [];
}

function containsPoint(model: Object3D, point: Vector3): boolean {
  const ray = new Ray(point, new Vector3(1, 0.371, 0.267).normalize()),
    distances: number[] = [],
    vertices = [new Vector3(), new Vector3(), new Vector3()],
    hit = new Vector3();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const position = object.geometry.getAttribute('position'),
      index = object.geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      vertices.forEach((vertex, j) =>
        vertex
          .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
          .applyMatrix4(object.matrixWorld),
      );
      if (ray.intersectTriangle(vertices[0], vertices[1], vertices[2], false, hit))
        distances.push(point.distanceTo(hit));
    }
  });
  distances.sort((a, b) => a - b);
  return (
    distances.filter((distance, index) => !index || distance - distances[index - 1] > 1e-7).length %
      2 ===
    1
  );
}

test('the mechanism is an authored assembly with stable source units and complete valid presets', () => {
  assert.equal(part.id, 'servo-toggle-actuator');
  assert.equal(part.name, 'Servo toggle actuator');
  assert.equal(part.product.kind, 'assembly');
  assert.equal(part.product.supply, 'manufactured');
  assert.ok(part.product.processes.includes('assembly'));
  assert.equal(part.catalogSelectionOnly, undefined);
  assert.equal(part.presets.length, 13);
  assert.equal(Object.hasOwn(part.defaults, 'manualState'), false);
  assert.deepEqual(
    part.presets.slice(0, 7).map((preset) => preset.id),
    [
      'printed-rocker-off',
      'printed-rocker-press-on',
      'printed-rocker-wide-on',
      'panel-mount',
      'wide-enclosure',
      'raised-platform',
      'press-on',
    ],
  );
  assert.deepEqual(
    part.states!.map((s) => s.id),
    ['assembled', 'exploded'],
  );
  for (const preset of part.presets) {
    assert.equal(preset.catalog, undefined, 'A custom assembly is not a manufacturer article.');
    assert.deepEqual(
      Object.keys(preset.parameters).sort(),
      [
        ...Object.keys(part.defaults),
        ...(preset.parameters.mechanism === 'parallel-dual' ? ['manualState'] : []),
      ].sort(),
    );
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), [], preset.id);
    assert.deepEqual(validateParameters(part, preset.parameters, 'exploded'), [], preset.id);
  }
  const component = part.composition!(p()).components;
  assert.equal(new Set(component.map((c) => c.id)).size, component.length);
  const servo = component.filter((c) => c.libraryId === 'bus-servo'),
    toggle = component.filter((c) => c.libraryId === 'panel-switch');
  assert.equal(servo.length, 1);
  assert.equal(toggle.length, 1);
  assert.equal(servo[0].parameters.model, 'st3215-12v');
  assert.equal(servo[0].supply, 'purchased');
  assert.equal(toggle[0].parameters.model, 'daier-asw-07d');
  assert.equal(toggle[0].parameters.panelThickness, 3);
  assert.equal(toggle[0].supply, 'purchased');
  for (const item of component.filter((c) => c.supply === 'manufactured')) {
    assert.equal(item.libraryId, 'manufactured-detail');
    assert.ok(item.manufacturing?.material);
  }
});

test('all actuator presets resolve valid fastener configurations in the shared hardware library', () => {
  const definitions = new Map(hardwareLibraries.map((definition) => [definition.id, definition]));
  for (const configuration of [{ id: 'defaults', parameters: part.defaults }, ...part.presets]) {
    const hardware = part.composition!(configuration.parameters).components.filter((component) =>
      definitions.has(component.libraryId),
    );
    assert.ok(hardware.length, configuration.id);
    for (const component of hardware) {
      const definition = definitions.get(component.libraryId)!;
      assert.deepEqual(
        validateParameters(definition, component.parameters, component.state),
        [],
        `${configuration.id}/${component.id}: ${component.name}`,
      );
    }
  }
});

test('OFF and ON rest with a centred servo and fork while the maintained toggle retains its selected position', () => {
  const off = kinematics(p({ phase: 'off' })),
    on = kinematics(p({ phase: 'on' }));
  near(off.servoAngle, 0);
  near(off.slide, 0);
  near(on.servoAngle, 0);
  near(on.slide, 0);
  assert.equal(off.switchPosition, 'first');
  assert.equal(on.switchPosition, 'last');
  const before = part.composition!(p({ phase: 'off' })),
    after = part.composition!(p({ phase: 'on' }));
  assert.equal(
    before.components.find((c) => c.libraryId === 'panel-switch')!.parameters.position,
    'first',
  );
  assert.equal(
    after.components.find((c) => c.libraryId === 'panel-switch')!.parameters.position,
    'last',
  );
  for (const assembly of [before, after])
    near(
      Number(assembly.components.find((c) => c.libraryId === 'bus-servo')!.parameters.outputAngle),
      0,
    );
  assert.deepEqual(
    before.components.filter((c) => c.supply === 'manufactured'),
    after.components.filter((c) => c.supply === 'manufactured'),
  );
});

test('push phases follow the R7 crank law and preserve the actual phase in source child configurations', () => {
  for (const phase of ['press-on', 'press-off']) {
    const input = p({ phase }),
      motion = kinematics(input),
      direction = phase === 'press-on' ? 1 : -1;
    near(motion.slide, direction * 7 * Math.sin((Number(input.servoSweep) * Math.PI) / 180));
    near(motion.servoAngle, -direction * Number(input.servoSweep));
    assert.ok(motion.maxPadCompression > 0 && motion.maxPadCompression <= 1);
    const children = part.composition!(input).components;
    near(
      Number(children.find((c) => c.libraryId === 'bus-servo')!.parameters.outputAngle),
      motion.servoAngle,
    );
    assert.equal(
      children.find((c) => c.libraryId === 'panel-switch')!.parameters.position,
      motion.switchPosition,
    );
  }
});

test('the centred pad opening clears both lever positions over its full 4 mm contact height', () => {
  for (let h = 8; h <= 12; h += 0.5) {
    let input: Parameters | undefined;
    for (const gap of [13, 13.5, 14, 14.5, 15])
      for (let sweep = 40; sweep <= 70; sweep++) {
        const candidate = p({ contactHeight: h, padGap: gap, servoSweep: sweep });
        if (!input && !validateParameters(part, candidate, 'assembled').length) input = candidate;
      }
    assert.ok(input, 'At least one valid setup at contact height ' + h);
    for (const angle of [-12, 12])
      for (const dz of [-2, 0, 2]) {
        const a = (angle * Math.PI) / 180,
          axisX = (h + dz) * Math.tan(a),
          radius = 3.5 / Math.cos(a);
        assert.ok(
          Number(input.padGap) / 2 - (Math.abs(axisX) + radius) >= 0.15 - 1e-9,
          'Both neutral pad faces clear the complete tilted cylindrical lever section.',
        );
      }
    assert.ok(kinematics(input).neutralClearance >= 0.15);
  }
  assert.ok(
    validateParameters(part, p({ contactHeight: 12, padGap: 13 }), 'assembled').some((e) =>
      /clear|opening/i.test(e),
    ),
  );
  assert.ok(validateParameters(part, p({ servoSweep: 40 }), 'assembled').length);
  assert.ok(validateParameters(part, p({ servoSweep: 70 }), 'assembled').length);
});

test('inspection separation preserves installed composition and source appearance', () => {
  for (const phase of ['off', 'press-on', 'on', 'press-off']) {
    const input = p({ phase }),
      assembled = configured(input, 'assembled'),
      separated = configured(input, 'exploded');
    assert.deepEqual(
      separated.map((c) => c.component),
      assembled.map((c) => c.component),
    );
    assert.deepEqual(
      part.composition!(input).components,
      assembled.map((c) => c.component),
    );
    assert.ok(
      separated.some(
        (c) =>
          JSON.stringify(c.position ?? [0, 0, c.z ?? 0]) !==
          JSON.stringify(
            assembled.find((a) => a.component.id === c.component.id)!.position ?? [
              0,
              0,
              assembled.find((a) => a.component.id === c.component.id)!.z ?? 0,
            ],
          ),
      ),
    );
    for (const item of assembled.filter((c) =>
      ['bus-servo', 'panel-switch'].includes(c.component.libraryId),
    ))
      assert.equal(item.preserveLibraryAppearance, true);
    assert.ok(
      assembled
        .filter((c) => c.component.supply === 'manufactured')
        .every((c) => c.requireSingleSolid === true),
    );
  }
});

test('frame guide axes and external servo cage leave OEM pilot holes unmodified', () => {
  const input = p(),
    mount = layout(input),
    details = frame(input);
  assert.equal(details.length, 10);
  for (const block of details.filter((d) => d.id.startsWith('rod-guide-'))) {
    const rod = cylinders(block.shape).find((c) => c.axis === 'x' && c.radius === 3.05)!;
    assert.ok(rod);
    near(rod.origin[2], mount.contactZ);
    near(Math.abs(rod.origin[1]), 22);
  }
  const servoCage = servoMount(input);
  assert.ok(servoCage.length >= 2);
  assert.ok(
    servoCage.some((d) => d.requirements?.some((text) => /do not tap|do not.*OEM/i.test(text))),
  );
  assert.ok(
    servoCage.every((d) => cylinders(d.shape).every((c) => c.thread === undefined)),
    'No invented OEM-hole threads are added by the external cage.',
  );
});

test('bottom cage ties and thin nuts stay below the moving fork at default and raised heights', () => {
  for (const [deckHeight, expectedLength] of [
    [50, 65],
    [65, 80],
  ]) {
    const input = p({ phase: 'press-off', deckHeight }),
      mount = layout(input),
      children = part.composition!(input).components,
      ties = children.filter((c) => c.libraryId === 'bolt-screw' && c.id.startsWith('servo-tie-')),
      nuts = children.filter((c) => c.id.startsWith('servo-nut-')),
      washers = children.filter((c) => c.id.startsWith('servo-washer-')),
      movingForkBottom = mount.contactZ - 2;
    assert.equal(ties.length, 4);
    assert.equal(nuts.length, 4);
    assert.equal(washers.length, 4);
    for (const tie of ties) {
      assert.equal(tie.libraryId, 'bolt-screw');
      assert.equal(tie.parameters.diameter, 4);
      assert.equal(tie.parameters.length, expectedLength);
      const length = Number(tie.parameters.length),
        headHeight = Number(tie.parameters.headHeight),
        placement = tie.placement!,
        rotation = new Euler(
          (placement.rotation[0] * Math.PI) / 180,
          (placement.rotation[1] * Math.PI) / 180,
          (placement.rotation[2] * Math.PI) / 180,
          'ZYX',
        ),
        installed = (localZ: number) =>
          new Vector3(0, 0, localZ).applyEuler(rotation).add(new Vector3(...placement.translation)),
        underHead = installed((length - headHeight) / 2),
        tip = installed(-(length + headHeight) / 2);
      near(underHead.z, 4.2);
      near(tip.z, 4.2 + length);
      assert.ok(tip.z < movingForkBottom, `${tie.id} must clear the press-OFF fork underside.`);
    }
    for (const nut of nuts) {
      assert.equal(nut.libraryId, 'hex-nut');
      assert.equal(nut.parameters.bore, 4);
      assert.equal(nut.parameters.acrossFlats, 7);
      assert.equal(nut.parameters.height, 2.2);
      near(nut.placement!.translation[2], mount.servoZ + 35 + 0.8);
      assert.ok(nut.placement!.translation[2] + Number(nut.parameters.height) < movingForkBottom);
    }
    for (const washer of washers) {
      assert.equal(washer.parameters.thickness, 0.8);
      near(washer.placement!.translation[2], mount.servoZ + 35 + 0.4);
    }
  }
});

test('source-disc fasteners retain M1.6 nuts that clear the unchanged supplier hub', () => {
  for (const input of [
    p({ phase: 'press-off' }),
    rocker({ phase: 'press-on' }),
    parallel({ phase: 'press-off' }),
  ]) {
    const nuts = part.composition!(input).components.filter((c) =>
      /^(?:rocker-|parallel-)?disc-nut-/.test(c.id),
    );
    assert.equal(nuts.length, 4);
    for (const nut of nuts) {
      assert.equal(nut.libraryId, 'hex-nut');
      assert.equal(nut.parameters.bore, 1.6);
      assert.equal(nut.parameters.acrossFlats, 3.2);
      assert.equal(nut.parameters.height, 1.3);
      assert.ok(
        7 - Number(nut.parameters.acrossFlats) / 2 > 5.3,
        'Radial nut flats on the PCD14 holes must clear the source radius 5.3 hub.',
      );
    }
  }
});

test('the default rocker uses three printed details and keeps the supplied source units intact', () => {
  assert.equal(part.defaults.mechanism, 'rocker');
  assert.deepEqual(validateParameters(part, rocker(), 'assembled'), []);
  const pieces = configured(rocker(), 'assembled'),
    children = part.composition!(rocker()).components,
    printed = children.filter((c) => c.supply === 'manufactured');
  assert.equal(printed.length, 3);
  for (const item of printed) {
    assert.equal(item.libraryId, 'manufactured-detail');
    assert.ok(item.manufacturing?.processes.includes('printing'), item.id);
    assert.doesNotMatch(item.id + ' ' + item.name, /guide|slider|shaft|rod|scotch/i);
  }
  assert.equal(children.filter((c) => c.libraryId === 'bus-servo').length, 1);
  assert.equal(children.filter((c) => c.libraryId === 'panel-switch').length, 1);
  const servo = children.find((c) => c.libraryId === 'bus-servo')!,
    toggle = children.find((c) => c.libraryId === 'panel-switch')!;
  assert.deepEqual(servo.placement!.rotation, [90, 0, 0]);
  assert.deepEqual(toggle.placement!.rotation, [0, 0, 0]);
  near(servo.placement!.translation![0], toggle.placement!.translation![0]);
  near(servo.placement!.translation![1], 51.7);
  near(servo.placement!.translation![2], Number(rocker().deckHeight) + 12.5);
  near(toggle.placement!.translation![2], Number(rocker().deckHeight));
  assert.equal(toggle.parameters.model, 'daier-asw-07d');
  assert.equal(toggle.parameters.panelThickness, 3);
  assert.equal(servo.parameters.showHorn, true);
  for (const item of pieces.filter((c) => c.component.supply === 'purchased'))
    assert.equal(item.preserveLibraryAppearance, true);
  assert.ok(
    pieces.filter((c) => c.component.supply === 'manufactured').every((c) => c.requireSingleSolid),
  );
});

test('changing mechanism initializes usable dimensions while preserving the selected operating stage', () => {
  const guided = part.updateParameters!(
    { ...rocker({ phase: 'press-off' }), mechanism: 'guided' },
    'mechanism',
  );
  assert.equal(guided.phase, 'press-off');
  assert.deepEqual(
    ['baseLength', 'baseWidth', 'deckHeight', 'contactHeight', 'padGap', 'servoSweep'].map(
      (key) => guided[key],
    ),
    [160, 96, 50, 10, 13, 50],
  );
  assert.deepEqual(validateParameters(part, guided, 'assembled'), []);
  const restored = part.updateParameters!({ ...guided, mechanism: 'rocker' }, 'mechanism');
  assert.equal(restored.phase, 'press-off');
  assert.deepEqual(
    ['baseLength', 'baseWidth', 'deckHeight'].map((key) => restored[key]),
    [160, 96, 50],
    'Switching back keeps the mounting platform selected by the user.',
  );
  assert.deepEqual(
    ['contactHeight', 'padGap', 'servoSweep'].map((key) => restored[key]),
    [12, 14.6, 50],
  );
  assert.deepEqual(validateParameters(part, restored, 'assembled'), []);
});

test('rocker pushes rotate in opposite directions and both maintained states return to the same clear neutral', () => {
  const halfSpacing = 10.3,
    tipHeight = 12,
    tipRadius = 3,
    leverRadius = 3.5,
    tilt = (12 * Math.PI) / 180,
    contactAngle =
      ((Math.atan2(halfSpacing, tipHeight) +
        tilt -
        Math.asin((tipRadius + leverRadius) / Math.hypot(halfSpacing, tipHeight))) *
        180) /
      Math.PI;
  const pressOn = kinematics(rocker({ phase: 'press-on' })),
    pressOff = kinematics(rocker({ phase: 'press-off' }));
  near(pressOn.servoAngle, -pressOff.servoAngle);
  near(Math.abs(pressOn.servoAngle), contactAngle);
  assert.notEqual(pressOn.servoAngle, 0);
  for (const phase of ['off', 'press-on', 'on', 'press-off']) {
    const input = rocker({ phase }),
      motion = kinematics(input),
      children = part.composition!(input).components;
    near(motion.slide, 0);
    near(
      Number(children.find((c) => c.libraryId === 'bus-servo')!.parameters.outputAngle),
      motion.servoAngle,
    );
    assert.equal(
      children.find((c) => c.libraryId === 'panel-switch')!.parameters.position,
      phase === 'on' || phase === 'press-on' ? 'last' : 'first',
    );
    if (phase === 'off' || phase === 'on') near(motion.servoAngle, 0);
  }
  for (const switchTilt of [-tilt, tilt])
    for (const tipX of [-halfSpacing, halfSpacing]) {
      const distance = Math.abs(tipX * Math.cos(switchTilt) - tipHeight * Math.sin(switchTilt));
      assert.ok(
        distance - tipRadius - leverRadius > 1,
        'Both cylindrical noses clear both rest positions.',
      );
    }
  assert.deepEqual(
    part.composition!(rocker({ phase: 'off' })).components.filter(
      (c) => c.supply === 'manufactured',
    ),
    part.composition!(rocker({ phase: 'on' })).components.filter(
      (c) => c.supply === 'manufactured',
    ),
  );
});

test('rocker inspection separates instances without altering physical roots or source placement', () => {
  for (const phase of ['off', 'press-on', 'on', 'press-off']) {
    const input = rocker({ phase }),
      assembly = part.composition!(input),
      installed = configured(input, 'assembled'),
      separated = configured(input, 'exploded');
    assert.deepEqual(
      assembly.components,
      installed.map((c) => c.component),
    );
    assert.deepEqual(
      separated.map((c) => c.component),
      installed.map((c) => c.component),
    );
    assert.equal(new Set(assembly.components.map((c) => c.id)).size, assembly.components.length);
    assert.ok(
      separated.some(
        (piece, index) =>
          JSON.stringify(piece.position) !== JSON.stringify(installed[index].position),
      ),
    );
  }
});

test('parallel shafts retain source body poses and clamp the full flange with upper-only switch hardware', () => {
  assert.equal(part.defaults.mechanism, 'rocker', 'The existing default remains selected.');
  const input = parallel(),
    children = part.composition!(input).components,
    printed = children.filter((c) => c.supply === 'manufactured'),
    servo = children.find((c) => c.libraryId === 'bus-servo')!,
    toggle = children.find((c) => c.libraryId === 'panel-switch')!;
  assert.deepEqual(
    printed.map((c) => c.id).sort(),
    [
      'parallel-base',
      'parallel-cradle',
      'parallel-clamp',
      'parallel-rocker',
      'parallel-switch-gasket',
      'parallel-panel-gasket',
    ].sort(),
  );
  for (const item of printed) {
    assert.ok(item.manufacturing?.processes.includes('printing'));
    assert.doesNotMatch(item.id + ' ' + item.name, /slider|guide rod|scotch/i);
  }
  assert.deepEqual(servo.placement, { translation: [0, -28, -15.2], rotation: [0, 0, -90] });
  assert.deepEqual(toggle.placement, { translation: [0, 0, 0], rotation: [0, 0, 180] });
  near(servo.placement!.translation[2] + 33.7, 18.5);
  assert.equal(servo.parameters.model, 'st3215-12v');
  assert.equal(servo.parameters.showHorn, true);
  assert.equal(toggle.parameters.model, 'daier-asw-07d');
  assert.equal(toggle.parameters.panelThickness, 3.8);
  assert.equal(toggle.parameters.mountingHardware, 'upper-only');
  assert.equal(children.length, 24);
  assert.equal(printed.filter((c) => /PETG/.test(c.manufacturing!.material)).length, 4);
  assert.equal(printed.filter((c) => /TPU/.test(c.manufacturing!.material)).length, 2);
  const clampScrews = children.filter((c) => c.id.startsWith('parallel-clamp-screw-')),
    clampNuts = children.filter((c) => c.id.startsWith('parallel-clamp-nut-'));
  assert.equal(clampScrews.length, 4);
  assert.equal(clampNuts.length, 4);
  for (const screw of clampScrews) {
    assert.equal(screw.parameters.diameter, 3);
    assert.equal(screw.parameters.length, 30);
    const head = Number(screw.parameters.headHeight),
      length = Number(screw.parameters.length),
      underHead = screw.placement!.translation[2] + (length - head) / 2,
      headTop = screw.placement!.translation[2] + (length + head) / 2;
    near(underHead, 14.3);
    const tip = underHead - length,
      matchingNut = clampNuts.find((nut) =>
        nut
          .placement!.translation.slice(0, 2)
          .every((value, axis) => Math.abs(value - screw.placement!.translation[axis]) < 1e-8),
      )!;
    assert.ok(matchingNut);
    near(tip, -15.7);
    const nutBottom = matchingNut.placement!.translation[2],
      nutTop = nutBottom + Number(matchingNut.parameters.height);
    assert.ok(
      tip < nutBottom && underHead > nutTop,
      'The through screw spans the complete nut thickness.',
    );
    near(nutBottom - tip, 1.7);
    assert.ok(nutBottom - tip >= 2 * Number(matchingNut.parameters.pitch));
    near(tip - -19.7, 4);
    assert.ok(
      tip < 0 && underHead > 6,
      'The same fastener retains lid, upper flange and lower cradle.',
    );
    assert.ok(
      headTop < servo.placement!.translation[2] + 32.7,
      'All four heads stay recessed below the housing roof.',
    );
    near(Math.abs(screw.placement!.translation[0]), 20);
    assert.ok([-18, -63].includes(screw.placement!.translation[1]));
  }
  for (const nut of clampNuts) {
    assert.equal(nut.parameters.bore, 3);
    assert.equal(nut.parameters.pitch, 0.5);
    assert.equal(nut.parameters.acrossFlats, 5.5);
    assert.equal(nut.parameters.height, 2.4);
    near(nut.placement!.translation[2], -14);
    assert.ok(
      nut.placement!.translation[2] + Number(nut.parameters.height) < 0,
      'Captured nuts belong to the separate lower cradle.',
    );
  }
  const housing = parallelMountDetails(input, {
    servoZ: -15.2,
    servoY: -28,
    switchZ: 0,
  }).find((detail) => detail.id === 'parallel-base')!.shape;
  const mountingHoles = cylinders(housing).filter((c) => c.axis === 'z' && c.radius === 2.25);
  assert.deepEqual(
    mountingHoles.map((hole) => hole.origin.slice(0, 2)),
    [
      [-32, -74],
      [-32, 20],
      [32, -74],
      [32, 20],
    ],
  );
  for (const hole of mountingHoles) {
    assert.ok(Number(input.baseLength) / 2 - Math.abs(hole.origin[0]) - 4.5 >= 3.5);
    assert.ok(
      Number(input.baseWidth) / 2 - Math.abs(hole.origin[1] + 27) - 4.5 >= 3.5,
      'An OD9 enclosure washer retains bearing material at each flange edge.',
    );
  }
  const selected = part.updateParameters!(
    { ...rocker({ phase: 'press-off' }), mechanism: 'parallel' },
    'mechanism',
  );
  assert.equal(selected.phase, 'press-off');
  assert.equal(selected.baseLength, 80);
  assert.equal(selected.baseWidth, 110);
  assert.deepEqual(validateParameters(part, selected, 'assembled'), []);
  assert.ok(validateParameters(part, parallel({ baseWidth: 100 }), 'assembled').length);
  assert.ok(validateParameters(part, parallel({ baseLength: 70 }), 'assembled').length);
});

test('the parallel mounting interface has a fixed top datum, a rounded host opening and a bounded cable approach', () => {
  for (const [baseLength, baseWidth] of [
    [80, 110],
    [90, 130],
    [100, 120],
  ]) {
    const input = parallel({ baseLength, baseWidth }),
      actual = parallelPanelInterface(input),
      children = part.composition!(input).components;
    assert.equal(actual.mountingPlane, 0);
    assert.equal(actual.flangeThickness, 6);
    assert.deepEqual(actual.cutout, {
      width: 56,
      height: 84,
      radius: 4,
      centre: [0, -28],
      terminalNotch: { width: 16, height: 12, radius: 2, centre: [34, 0] },
      additionalTerminalNotches: [],
    });
    assert.equal(actual.gasketThickness, 0.8);
    assert.equal(actual.flangeCornerRadius, 4);
    assert.deepEqual(actual.groundClip, {
      min: [14.5, -4.5, -5.1],
      size: [17, 9, 5],
      insertionStroke: 10,
      approachSide: 'positive-x',
    });
    assert.equal(actual.holeDiameter, 4.5);
    assert.deepEqual(
      actual.mountingHoles,
      [-1, 1].flatMap((side) =>
        [-1, 1].map((end) => [side * (baseLength / 2 - 8), -27 + end * (baseWidth / 2 - 8)]),
      ),
    );
    assert.deepEqual(actual.cableApproach, { nativeMin: [-10, -9, -35], nativeMax: [35, 9, -4.2] });
    const source = children.find((child) => child.libraryId === 'bus-servo')!;
    near(source.placement!.translation[2], -15.2);
    near(-4.1 - actual.cableApproach.nativeMax[2], 0.1);
    assert.equal(
      children.find((child) => child.libraryId === 'panel-switch')!.placement!.translation[2],
      0,
    );
    assert.deepEqual(validateParameters(part, input, 'assembled'), []);
  }
  assert.deepEqual(
    part.composition!(parallel()).components,
    part.composition!(parallel({ deckHeight: 65 })).components,
    'Hidden shared height is not an adjustable mounting height in the parallel mechanism.',
  );
});

test('neutral parallel arms clear the complete manual toggle sweep and both maintained states', () => {
  let minimum = Infinity;
  for (let lever = -12; lever <= 12; lever += 0.25)
    for (const side of [-1, 1] as const) {
      const result = armDistance(0, lever, side);
      minimum = Math.min(minimum, result.clearance);
      assert.ok(result.clearance >= 19.5 - 1e-9);
      assert.ok(result.alongLever > 0 && result.alongLever < 18.7);
    }
  near(minimum, 19.5);
  near(kinematics(parallel()).neutralClearance, 28 - 13 - 3.5);
  for (const phase of ['off', 'on']) {
    const motion = kinematics(parallel({ phase }));
    near(motion.servoAngle, 0);
    near(motion.slide, 0);
    assert.equal(motion.switchPosition, phase === 'on' ? 'last' : 'first');
  }
  assert.deepEqual(
    part.composition!(parallel({ phase: 'off' })).components.filter(
      (c) => c.supply === 'manufactured',
    ),
    part.composition!(parallel({ phase: 'on' })).components.filter(
      (c) => c.supply === 'manufactured',
    ),
  );
});

test('parallel pushes reach tangency on the finite arm and physical lever with opposite rotary pulses', () => {
  for (const phase of ['press-on', 'press-off']) {
    const input = parallel({ phase }),
      motion = kinematics(input),
      side = phase === 'press-on' ? 1 : -1,
      tilt = phase === 'press-on' ? -12 : 12,
      result = armDistance(motion.servoAngle, tilt, side);
    near(Math.abs(motion.servoAngle), 76.336799815, 1e-7);
    assert.equal(Math.sign(motion.servoAngle), side);
    near(result.clearance, 0);
    assert.ok(result.alongArm > 0 && result.alongArm < 28);
    assert.ok(result.alongLever > 0 && result.alongLever < 18.7);
    assert.ok(
      result.contactHeight > 6 && result.contactHeight < 14,
      'The tangent point stays on the retained round side after clipping the bar to 8 mm height.',
    );
    near(result.contactHeight, 8.9886, 1e-4);
    assert.ok(armDistance(motion.servoAngle * 0.99, tilt, side).clearance > 0);
    assert.ok(armDistance(motion.servoAngle * 1.01, tilt, side).clearance < 0);
    const children = part.composition!(input).components;
    near(
      Number(children.find((c) => c.libraryId === 'bus-servo')!.parameters.outputAngle),
      motion.servoAngle,
    );
    assert.equal(
      children.find((c) => c.libraryId === 'panel-switch')!.parameters.position,
      motion.switchPosition,
    );
  }
});

test('parallel inspection preserves physical roots, phase and source appearance', () => {
  for (const phase of ['off', 'press-on', 'on', 'press-off']) {
    const input = parallel({ phase }),
      installed = configured(input, 'assembled'),
      separated = configured(input, 'exploded');
    const lowerPosition = separated.find(
        (piece) => piece.component.id === 'parallel-cradle',
      )!.position,
      lidPosition = separated.find((piece) => piece.component.id === 'parallel-clamp')!.position;
    assert.notDeepEqual(lowerPosition, lidPosition);
    for (const nut of separated.filter((piece) =>
      piece.component.id.startsWith('parallel-clamp-nut-'),
    ))
      assert.deepEqual(
        nut.position,
        lowerPosition,
        'Captured nuts remain in the lower cradle during inspection.',
      );
    for (const screw of separated.filter((piece) =>
      piece.component.id.startsWith('parallel-clamp-screw-'),
    ))
      assert.deepEqual(
        screw.position,
        lidPosition,
        'Through screws withdraw with the upper lid during inspection.',
      );
    assert.deepEqual(
      installed.map((c) => c.component),
      part.composition!(input).components,
    );
    assert.deepEqual(
      separated.map((c) => c.component),
      installed.map((c) => c.component),
    );
    assert.ok(
      separated.some(
        (c, index) => JSON.stringify(c.position) !== JSON.stringify(installed[index].position),
      ),
    );
    assert.ok(
      installed
        .filter((c) => c.component.supply === 'manufactured')
        .every((c) => c.requireSingleSolid),
    );
    assert.ok(
      installed
        .filter((c) => c.component.supply === 'purchased')
        .every((c) => c.preserveLibraryAppearance),
    );
  }
});

test('the rear manual choice is optional only while hidden and remains validated when present', () => {
  const field = part.parameters.find((parameter) => parameter.key === 'manualState')!;
  assert.ok(field);
  assert.equal(field.optionalWhenHidden, true);
  assert.deepEqual(validateParameters(part, parallel(), 'assembled'), []);
  const missing = dual();
  delete missing.manualState;
  const activeErrors = validateParameters(part, missing, 'assembled');
  assert.ok(
    activeErrors.some((error) => error.toLowerCase().includes(field.label.toLowerCase())),
    'The active rear manual control remains required.',
  );
  const hiddenInvalid = validateParameters(part, parallel({ manualState: 'invalid' }), 'assembled');
  assert.ok(
    hiddenInvalid.some((error) => error.toLowerCase().includes(field.label.toLowerCase())),
    'An explicit invalid hidden choice is not silently ignored.',
  );
  const closedPreset = part.presets.find(
      (preset) =>
        preset.parameters.mechanism === 'parallel-dual' &&
        preset.parameters.manualState === 'guarded-off',
    )!,
    openedPreset = part.presets.find(
      (preset) =>
        preset.parameters.mechanism === 'parallel-dual' &&
        preset.parameters.manualState === 'open-off',
    )!;
  assert.notEqual(closedPreset.id, openedPreset.id);
  assert.equal(matchingPresetId(part, closedPreset.parameters), closedPreset.id);
  assert.equal(
    matchingPresetId(part, openedPreset.parameters),
    openedPreset.id,
    'Opening only the rear cover must select its own authored example.',
  );
  for (const manualState of ['guarded-off', 'open-off', 'open-on'])
    assert.deepEqual(validateParameters(part, dual({ manualState }), 'assembled'), []);
});

test('the second guarded switch stays mechanically independent of every front servo phase', () => {
  for (const phase of ['off', 'press-on', 'on', 'press-off']) {
    const original = part.composition!(parallel({ phase })).components,
      servo = original.find((component) => component.id === 'drive-servo')!,
      front = original.find((component) => component.id === 'toggle-switch')!;
    for (const manualState of ['guarded-off', 'open-off', 'open-on']) {
      const input = dual({ phase, manualState }),
        children = part.composition!(input).components,
        manual = children.find((component) => component.id === 'manual-toggle-switch')!,
        printed = children.filter((component) => component.supply === 'manufactured');
      assert.deepEqual(validateParameters(part, input, 'assembled'), []);
      assert.equal(children.length, 30);
      assert.equal(printed.length, 7);
      assert.equal(
        printed.filter((component) => /PETG/.test(component.manufacturing!.material)).length,
        4,
      );
      assert.equal(
        printed.filter((component) => /TPU/.test(component.manufacturing!.material)).length,
        3,
      );
      assert.deepEqual(
        children.find((component) => component.id === servo.id),
        { ...servo, placement: dualWorldPlacement(servo.placement!) },
      );
      assert.deepEqual(
        children.find((component) => component.id === front.id),
        {
          ...front,
          name: 'ARM 2 · DAIER ASW-07D servo-operated toggle',
          placement: dualWorldPlacement(front.placement!),
        },
      );
      assert.equal(children.filter((component) => component.libraryId === 'bus-servo').length, 1);
      assert.equal(
        children.filter((component) => component.libraryId === 'panel-switch').length,
        2,
      );
      assert.equal(manual.parameters.model, 'daier-asw-07d-sac-01');
      assert.equal(manual.parameters.guard, manualState === 'guarded-off' ? 'closed' : 'open');
      assert.equal(manual.parameters.position, manualState === 'open-on' ? 'last' : 'first');
      assert.deepEqual(
        manual.placement!.translation.map((v) => (v === 0 ? 0 : v)),
        [-90, 0, 0],
      );
      assert.deepEqual(manual.placement!.rotation, [0, 0, 90]);
      assert.match(manual.name, /^ARM 1/);
      assert.ok(
        configured(input, 'assembled').find((piece) => piece.component.id === manual.id)!
          .preserveLibraryAppearance,
      );
    }
  }
  const selected = part.updateParameters!(
    { ...parallel(), mechanism: 'parallel-dual' },
    'mechanism',
  );
  assert.equal(selected.manualState, 'guarded-off');
  assert.ok(Number(selected.baseLength) >= 100 && Number(selected.baseWidth) >= 150);
  const restored = part.updateParameters!({ ...selected, mechanism: 'parallel' }, 'mechanism');
  assert.equal(
    Object.hasOwn(restored, 'manualState'),
    false,
    'Old modes retain their original parameter keys.',
  );
});

test('the rear through ties retain the manual cradle without crossing its ground-terminal route', () => {
  const input = dual(),
    children = part.composition!(input).components,
    screws = children.filter((component) => component.id.startsWith('manual-clamp-screw-')),
    nuts = children.filter((component) => component.id.startsWith('manual-clamp-nut-')),
    positions = [
      [-101, 22],
      [-79, -22],
    ];
  assert.equal(screws.length, 2);
  assert.equal(nuts.length, 2);
  for (const screw of screws) {
    assert.equal(screw.parameters.diameter, 3);
    assert.equal(screw.parameters.length, 20);
    assert.equal(screw.parameters.pitch, 0.5);
    const p = screw.placement!.translation,
      underHead =
        p[2] + (Number(screw.parameters.length) - Number(screw.parameters.headHeight)) / 2,
      tip = underHead - Number(screw.parameters.length),
      nut = nuts.find((item) =>
        item.placement!.translation.slice(0, 2).every((value, axis) => value === p[axis]),
      )!;
    assert.ok(positions.some((position) => position[0] === p[0] && position[1] === p[1]));
    near(underHead, 3);
    near(tip, -17);
    assert.ok(nut);
    near(nut.placement!.translation[2], -14);
    assert.equal(nut.parameters.height, 2.4);
    assert.equal(nut.parameters.pitch, 0.5);
    near(nut.placement!.translation[2] - tip, 3);
    near(tip - -19.7, 2.7);
  }
  const separated = configured(input, 'exploded'),
    lowerPosition = separated.find((piece) => piece.component.id === 'parallel-cradle')!.position;
  for (const screw of separated.filter((piece) =>
    piece.component.id.startsWith('manual-clamp-screw-'),
  ))
    assert.deepEqual(
      screw.position?.map((v) => (v === 0 ? 0 : v)),
      [0, 0, 25],
    );
  for (const nut of separated.filter((piece) => piece.component.id.startsWith('manual-clamp-nut-')))
    assert.deepEqual(nut.position, lowerPosition);
  for (const [id, position] of [
    ['manual-toggle-switch', [-35, 0, 45]],
    ['parallel-manual-gasket', [0, -50, 35]],
    ['parallel-clamp', [-30, 0, 25]],
    ['parallel-rocker', [0, -45, 25]],
  ] as const)
    assert.deepEqual(
      separated.find((piece) => piece.component.id === id)!.position?.map((v) => (v === 0 ? 0 : v)),
      position,
      'Inspection offsets rotate with the physical assembly.',
    );
});

test('assembled and separated previews have positive component volumes and consistent overall bounds', () => {
  for (const [mechanism, state] of ['guided', 'rocker', 'parallel', 'parallel-dual'].flatMap(
    (mechanism) => ['assembled', 'exploded'].map((state) => [mechanism, state]),
  )) {
    const input =
        mechanism === 'guided'
          ? p()
          : mechanism === 'parallel'
            ? parallel()
            : mechanism === 'parallel-dual'
              ? dual()
              : rocker(),
      model = part.buildGeometry(input, state);
    try {
      model.updateMatrixWorld(true);
      assert.equal(model.children.length, configured(input, state).length);
      for (const child of model.children) {
        let volume = 0;
        child.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const attr = object.geometry.getAttribute('position'),
            index = object.geometry.index;
          for (let t = 0; t < (index?.count ?? attr.count); t += 3) {
            const [a, b, c] = [0, 1, 2].map((j) =>
              new Vector3()
                .fromBufferAttribute(attr, index ? index.getX(t + j) : t + j)
                .applyMatrix4(object.matrixWorld),
            );
            volume += a.dot(b.clone().cross(c)) / 6;
          }
        });
        assert.ok(volume > 0, child.name);
      }
      const expected = part.dimensions(input, state),
        actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      expected.forEach((v, i) => near(v, actual[i], 0.01));
      if (mechanism === 'parallel' && state === 'assembled') {
        const pieces = configured(input, state),
          base =
            model.children[pieces.findIndex((piece) => piece.component.id === 'parallel-base')],
          cradle =
            model.children[pieces.findIndex((piece) => piece.component.id === 'parallel-cradle')],
          switchGasket =
            model.children[
              pieces.findIndex((piece) => piece.component.id === 'parallel-switch-gasket')
            ],
          panelGasket =
            model.children[
              pieces.findIndex((piece) => piece.component.id === 'parallel-panel-gasket')
            ],
          rotor =
            model.children[pieces.findIndex((piece) => piece.component.id === 'parallel-rocker')],
          lid =
            model.children[pieces.findIndex((piece) => piece.component.id === 'parallel-clamp')],
          sourcePoint = (x: number, y: number, z: number) => new Vector3(y, -28 - x, -15.2 + z);
        for (const [x, y, z] of [
          [12.5, -15.3, 10],
          [12.5, 15.3, 10],
          [23, -14, -3],
          [23, 14, -3],
        ])
          assert.ok(
            containsPoint(cradle, sourcePoint(x, y, z)),
            'The lower cradle retains broad source walls and side-connected retention ledges.',
          );
        for (const [x, y, z] of [
          [-13, 0, 22],
          [38, 0, 22],
        ])
          assert.ok(
            containsPoint(base, sourcePoint(x, y, z)),
            'The separate upper housing retains the source case.',
          );
        assert.equal(
          containsPoint(cradle, sourcePoint(12.5, 0, 10)),
          false,
          'The supplier case occupies a real hollow cavity.',
        );
        assert.equal(
          containsPoint(cradle, sourcePoint(12.5, 0, -4.4)),
          false,
          'The housing underside is open for a straight cable approach, with no floor or posts.',
        );
        assert.ok(
          containsPoint(base, new Vector3(30, 0, 3)),
          'The integrated 6 mm flange starts above the external TPU sheet at Z0.8.',
        );
        assert.ok(
          containsPoint(base, new Vector3(5.6, 0, 4)),
          'The upper switch web retains its anti-rotation key.',
        );
        assert.ok(
          containsPoint(base, new Vector3(8, 0, 1)),
          'The keyed switch bore has a full-height flange web without a lower-nut counterbore.',
        );
        for (const [x, y] of [
          [-20, -18],
          [20, -18],
          [-20, -63],
          [20, -63],
        ]) {
          assert.ok(
            containsPoint(cradle, new Vector3(x + 3, y, 0.5)),
            'The lower cradle has a broad flat rim up to Z0.8.',
          );
          assert.equal(containsPoint(base, new Vector3(x + 3, y, 0.5)), false);
          for (const z of [0.9, 1.9, 3.9, 6.7])
            assert.ok(
              containsPoint(base, new Vector3(x + 3, y, z)),
              'Through M3 screws align flat shoulders without blind underside locating pockets.',
            );
          assert.equal(containsPoint(cradle, new Vector3(x + 3, y, 0.9)), false);
        }
        for (const point of [new Vector3(16, 0, -10), new Vector3(0, 11, -10)])
          assert.ok(containsPoint(cradle, point), 'Rigid flats enclose the actual ASW case.');
        assert.equal(
          containsPoint(cradle, new Vector3(0, 8.2, -10)),
          false,
          'The16.8mm cavity retains0.4mm nominal case clearance on each side.',
        );
        assert.equal(
          containsPoint(cradle, new Vector3(16, 0, -3)),
          false,
          'The side ground blade and clip have an open-top channel.',
        );
        for (const gasket of [switchGasket, panelGasket]) {
          const bounds = new Box3().setFromObject(gasket, true);
          near(bounds.min.z, 0, 0.001);
          near(bounds.max.z, 0.8, 0.001);
        }
        for (const [gasket, point] of [
          [switchGasket, new Vector3(13, 0, 0.4)],
          [panelGasket, new Vector3(36, -27, 0.4)],
        ] as const) {
          assert.ok(containsPoint(gasket, point));
          assert.equal(
            containsPoint(base, point),
            false,
            'The external TPU sheet lies entirely below the flat PETG flange.',
          );
          assert.ok(
            containsPoint(base, point.clone().setZ(0.9)),
            'The gasket seats against the common flat flange underside at Z0.8.',
          );
        }
        assert.equal(containsPoint(switchGasket, new Vector3(0, 0, 0.4)), false);
        assert.ok(
          containsPoint(panelGasket, new Vector3(36, 20, 0.4)),
          'The panel sheet retains material around its diameter 5 mm M4 holes.',
        );
        assert.equal(containsPoint(panelGasket, new Vector3(32, 20, 0.4)), false);
        assert.equal(containsPoint(base, new Vector3(36, 20, 0.4)), false);
        assert.ok(containsPoint(base, new Vector3(36, 20, 0.9)));
        assert.equal(
          containsPoint(base, new Vector3(39, 27, 3)),
          false,
          'The flange has real R4 corners.',
        );
        assert.ok(containsPoint(base, new Vector3(38, 26, 3)));
        assert.equal(
          containsPoint(cradle, new Vector3(18.5, 12.5, -10)),
          false,
          'The lower switch pocket has real R3 outside corners.',
        );
        assert.ok(containsPoint(cradle, new Vector3(17, 11, -10)));
        const rotorBounds = new Box3().setFromObject(rotor, true),
          lidBounds = new Box3().setFromObject(lid, true);
        near(rotorBounds.min.x, -33, 0.01);
        near(rotorBounds.max.x, 33, 0.01);
        near(rotorBounds.min.y, -41, 0.01);
        near(rotorBounds.max.y, -15, 0.01);
        near(rotorBounds.min.z, 18.5, 0.01);
        near(rotorBounds.max.z, 26.5, 0.01);
        assert.ok(
          rotorBounds.min.z - lidBounds.max.z >= 0.99,
          'The rearward arm clears the complete fitted lid throughout its yaw sweep.',
        );
        for (const x of [-25, 25])
          assert.ok(
            containsPoint(rotor, new Vector3(x, -28, 22.5)),
            'Both opposite arms have solid sections.',
          );
        assert.equal(
          containsPoint(rotor, new Vector3(10.3, 0, 22.5)),
          false,
          'Neutral has no forward U-fork prongs beside the switch.',
        );
      }
      if (mechanism === 'parallel-dual' && state === 'assembled') {
        const pieces = configured(input, state),
          child = (id: string) =>
            model.children[pieces.findIndex((piece) => piece.component.id === id)],
          base = child('parallel-base'),
          lower = child('parallel-cradle'),
          gasket = child('parallel-manual-gasket'),
          bounds = new Box3().setFromObject(gasket, true);
        near(bounds.min.z, 0, 0.001);
        near(bounds.max.z, 0.8, 0.001);
        const plateBounds = new Box3().setFromObject(base, true);
        near(plateBounds.min.x, -47 - Number(input.baseWidth) / 2, 0.001);
        near(plateBounds.max.x, -47 + Number(input.baseWidth) / 2, 0.001);
        near(plateBounds.min.y, -Number(input.baseLength) / 2, 0.001);
        near(plateBounds.max.y, Number(input.baseLength) / 2, 0.001);
        assert.ok(
          containsPoint(gasket, dualWorldPoint(8, -90, 0.4)),
          'The rear case gasket uses its smaller diameter12.6 bushing clearance.',
        );
        assert.equal(containsPoint(base, dualWorldPoint(8, -90, 0.4)), false);
        assert.ok(containsPoint(base, dualWorldPoint(8, -90, 0.9)));
        assert.ok(
          containsPoint(base, dualWorldPoint(8, -90, 6.4)),
          'The guarded-source lower nut seats on the common flat Z6.8 flange top.',
        );
        assert.deepEqual(
          parallelLegendLayout.map((legend) => legend.text),
          ['ARM 1', 'ARM 2'],
        );
        for (const [index, cx] of [-90, 0].entries()) {
          const probes: [number, number, boolean][] = [
            [cx - 11.325, -38.3, false],
            [cx - 9.575, -35.8, true],
            [cx - 5.325, -37.5, false],
            [cx - 3.875, -35, true],
            [cx + 0.825, -37.8, false],
            [cx + 6.275, -36, true],
            [cx + 9.575, -38.4, false],
            [cx + 8.375, -37.5, index === 0],
          ];
          for (const [x, y, retained] of probes) {
            assert.equal(
              containsPoint(base, new Vector3(x, y, 6.5)),
              retained,
              `${index === 0 ? 'ARM 1' : 'ARM 2'} stroke/counter/space content at ${x}, ${y}`,
            );
            assert.ok(
              containsPoint(base, new Vector3(x, y, 6.19)),
              'Engraving retains the carrier below Z6.2.',
            );
            if (!retained)
              assert.equal(
                containsPoint(base, new Vector3(x, y, 6.21)),
                false,
                'The absolute engraving floor is Z6.2.',
              );
          }
        }
        assert.ok(containsPoint(lower, dualWorldPoint(16, -90, -10)));
        assert.equal(containsPoint(lower, dualWorldPoint(0, -81.8, -10)), false);
        assert.equal(
          containsPoint(lower, dualWorldPoint(16, -90, -3)),
          false,
          'The rear ground-blade channel stays open.',
        );
      }
      if (mechanism === 'rocker' && state === 'exploded') {
        const switchIndex = configured(input, state).findIndex(
          (piece) => piece.component.libraryId === 'panel-switch',
        );
        const switchBounds = new Box3().setFromObject(model.children[switchIndex], true);
        assert.ok(
          switchBounds.min.z > Number(input.deckHeight) + 6,
          'Inspection must withdraw the complete switch, including its blade terminals, above the panel.',
        );
      }
    } finally {
      disposeModel(model);
    }
  }
  assert.ok(part.validate({ ...p(), servoModel: 'invented' }, 'assembled').length);
  assert.ok(part.validate(p({ phase: 'moving' }), 'assembled').length);
});
