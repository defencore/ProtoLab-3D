import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Mesh, Vector3 } from 'three';
import part from '../src/parts/mpr-10-demonstrator/part';
import {
  configured,
  kinematics,
  layout,
  libraries,
  framePosts,
  driveInterface,
} from '../src/parts/mpr-10-demonstrator/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';
import type { AssemblyComponent } from '../src/core/product-types';

const parameters = (extra: Parameters = {}): Parameters => ({ ...part.defaults, ...extra });
const near = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);
const components = (p: Parameters = part.defaults, state = 'assembled') =>
  configured(p, state).map((piece) => piece.component);
const occurrence = (items: AssemblyComponent[], channel: number, suffix: string) => {
  const item = items.find((candidate) => candidate.id === `channel-${channel}-${suffix}`);
  assert.ok(item, `Channel ${channel}: ${suffix}`);
  return item;
};
const bearingSize = (item: AssemblyComponent, bore: number, outer: number, width: number) =>
  item.libraryId === 'ball-bearing' &&
  item.parameters.bore === bore &&
  item.parameters.outer === outer &&
  item.parameters.width === width;
const rotation = (item: AssemblyComponent) =>
  new Euler(
    ...(item.placement.rotation.map((angle) => (angle * Math.PI) / 180) as [
      number,
      number,
      number,
    ]),
    'ZYX',
  );

test('MPR.10 defaults and complete presets validate with concrete library configurations', () => {
  assert.equal(part.product.kind, 'assembly');
  assert.equal(part.product.supply, 'manufactured');
  const libraryMap = new Map(libraries.map((library) => [library.id, library]));
  for (const p of [part.defaults, ...part.presets.map((preset) => parameters(preset.parameters))]) {
    for (const state of part.states!) assert.deepEqual(validateParameters(part, p, state.id), []);
    const items = components(p);
    assert.equal(new Set(items.map((item) => item.id)).size, items.length);
    for (const item of items) {
      const library = libraryMap.get(item.libraryId);
      assert.ok(library, item.id);
      assert.deepEqual(validateParameters(library, item.parameters, item.state), [], item.id);
      assert.ok(item.placement.translation.every(Number.isFinite), item.id);
      assert.ok(item.placement.rotation.every(Number.isFinite), item.id);
    }
  }
});

test('MPR.10 rejects nonfinite, unknown, incomplete and out-of-range settings', () => {
  for (const p of [
    parameters({ angle1: Number.NaN }),
    parameters({ printClearance: Number.POSITIVE_INFINITY }),
    parameters({ bearingPressFit: Number.NaN }),
    parameters({ angle2: 19 }),
    parameters({ angle4: -19 }),
    parameters({ fitClearance: 0.3 }),
    parameters({ printClearance: 0.31 }),
    parameters({ bearingPressFit: -0.01 }),
    parameters({ bearingPressFit: 0.16 }),
    parameters({ inventedSetting: 1 }),
  ])
    assert.ok(validateParameters(part, p, 'assembled').length > 0);
  assert.ok(validateParameters(part, part.defaults, 'invented-state').length > 0);
  const incomplete = parameters();
  delete incomplete.angle3;
  assert.ok(validateParameters(part, incomplete, 'assembled').length > 0);
});

test('downloadable procurement and print lists retain all physical quantities across poses', () => {
  const files = part.fabricationFiles!(part.defaults);
  assert.equal(new Set(files.map((file) => file.name)).size, files.length);
  assert.deepEqual(files, part.fabricationFiles!(parameters({ angle1: 18, angle2: -18 })));
  for (const file of files) {
    assert.equal(file.type, 'text/csv');
    const quantity = file.content
      .trim()
      .split('\r\n')
      .slice(1)
      .reduce((sum, row) => sum + Number(row.split(',')[1].replaceAll('"', '')), 0);
    const expected =
      file.id === 'print-list'
        ? part.composition!(part.defaults).components.filter((item) =>
            item.manufacturing?.processes.includes('printing'),
          )
        : part.composition!(part.defaults).components;
    assert.equal(
      quantity,
      expected.reduce((sum, item) => sum + item.quantity, 0),
    );
  }
});

test('each output has two 688 bearings and each screw has three 684 bearings plus one follower', () => {
  const items = components();
  assert.equal(items.filter((item) => bearingSize(item, 8, 16, 5)).length, 8);
  assert.equal(items.filter((item) => bearingSize(item, 4, 9, 4)).length, 12);
  assert.equal(items.filter((item) => bearingSize(item, 3, 7, 3)).length, 4);
  for (let channel = 1; channel <= 4; channel++) {
    const local = items.filter((item) => item.id.startsWith(`channel-${channel}-`));
    const output = local.filter((item) => bearingSize(item, 8, 16, 5));
    assert.equal(output.length, 2);
    assert.equal(local.filter((item) => bearingSize(item, 4, 9, 4)).length, 3);
    assert.equal(local.filter((item) => bearingSize(item, 3, 7, 3)).length, 1);
    const first = new Vector3(...output[0].placement.translation);
    const second = new Vector3(...output[1].placement.translation);
    near(first.distanceTo(second), 18);
    near(first.z, layout.outputZ);
    near(second.z, layout.outputZ);
  }
});

test('three discs use peripheral M5 posts and metal E-clips without a separate linear guide', () => {
  const items = components();
  assert.deepEqual(
    items
      .filter((item) => ['motor-plate', 'front-deck', 'upper-disc'].includes(item.id))
      .map((item) => item.id),
    ['motor-plate', 'front-deck', 'upper-disc'],
  );
  assert.ok(
    !items.some((item) =>
      /spine|^tie-|output-carrier|screw-collar|screw-spacer|screw-front-clip|screw-rear-clip|output-inner-clip|output-outer-clip/.test(
        item.id,
      ),
    ),
  );
  const spacers = items.filter((item) => item.libraryId === 'pcb-standoff');
  assert.equal(spacers.length, 8);
  assert.equal(spacers.filter((item) => item.parameters.bodyLength === 20).length, 4);
  assert.equal(spacers.filter((item) => item.parameters.bodyLength === 30).length, 4);
  for (const item of spacers) {
    assert.equal(item.parameters.threadDiameterA, 5);
    const [x, y, z] = item.placement.translation;
    near(Math.hypot(x, y), 38);
    assert.ok(framePosts.some((post) => Math.hypot(x - post.x, y - post.y) < 1e-8));
    near(z, item.parameters.bodyLength === 20 ? 3 : 26);
  }
  assert.ok(!libraries.some((library) => library.id === 'hiwin-profile-guide'));
  assert.ok(!items.some((item) => item.libraryId === 'hiwin-profile-guide'));
  assert.ok(!items.some((item) => /guide-(?:rail|block)/.test(item.id)));
  assert.equal(items.filter((item) => item.libraryId === 'e-ring').length, 16);
  for (let channel = 1; channel <= 4; channel++) {
    const local = items.filter((item) => item.id.startsWith(`channel-${channel}-`));
    const clips = local.filter((item) => item.libraryId === 'e-ring');
    assert.equal(clips.filter((item) => item.parameters.installedGrooveDiameter === 6).length, 2);
    assert.equal(clips.filter((item) => item.parameters.installedGrooveDiameter === 3.2).length, 2);
    assert.equal(local.filter((item) => item.id.includes('nut-lid-bolt-')).length, 2);
    assert.ok(!local.some((item) => item.id.includes('nut-bolt-')));
  }
});

test('the follower and nut close the rocker geometry throughout the demonstration sweep', () => {
  for (const angle of [-18, -12, -6, 0, 6, 12, 18]) {
    const p = parameters({ angle1: angle, angle2: -angle, angle3: angle / 2, angle4: -angle / 2 });
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    for (let channel = 0; channel < 4; channel++) {
      const k = kinematics(p, channel);
      const follower = new Vector3(0, -layout.arm, 0).applyAxisAngle(
        new Vector3(1, 0, 0),
        (Number(p[`angle${channel + 1}`]) * Math.PI) / 180,
      );
      near(k.followerY, follower.y);
      near(k.followerZ, layout.outputZ + follower.z);
      near(Math.hypot(k.followerY, k.followerZ - layout.outputZ), layout.arm);
      near(k.nutZ - k.followerZ, layout.nutOffset);
      near(k.travel, follower.z);
      near(k.screwTurns, k.travel); // Selected SFK0601 lead is 1 mm/revolution.
    }
  }
});

test('the compact screw centres its working thread on the output and reserves both nut ends', () => {
  near(layout.screwLength, 52);
  near(layout.screwThreadEnd - layout.screwThreadStart, 26);
  near(layout.outputZ, (layout.screwThreadStart + layout.screwThreadEnd) / 2);
  near(layout.nutOffset, 0);
  near(layout.arm, 8.5);
  const limits: { lower: number; upper: number }[] = [];
  for (const angle of [-18, 0, 18]) {
    const p = parameters({ angle1: angle });
    const items = components(p);
    const nut = occurrence(items, 1, 'nut');
    const halfLength = Number(nut.parameters.nutLength) / 2;
    const lower = nut.placement.translation[2] - halfLength - layout.screwThreadStart;
    const upper = layout.screwThreadEnd - nut.placement.translation[2] - halfLength;
    assert.ok(lower >= 2, 'The complete purchased nut must stay beyond the lower end reserve.');
    assert.ok(upper >= 2, 'The complete purchased nut must stay beyond the upper end reserve.');
    limits.push({ lower, upper });
  }
  near(limits[0].lower, limits[2].upper);
  near(limits[0].upper, limits[2].lower);
  near(limits[1].lower, limits[1].upper);
});

test('the captured pin permits transverse travel while constraining nut yaw throughout the sweep', () => {
  const d = driveInterface;
  assert.ok(d.rollerX[0] > d.rollerPocketX[0]);
  assert.ok(d.rollerX[1] < d.rollerPocketX[1]);
  assert.ok(d.rollerDiameter < d.slotHeight);
  assert.ok(d.captureX[0] > d.capturePocketX[0]);
  assert.ok(d.captureX[1] < d.capturePocketX[1]);
  assert.ok(d.sleeveDiameter < d.captureMouthHeight);
  assert.ok(d.captureMouthHeight < d.captureDiameter);
  assert.ok(d.captureDiameter < d.capturePocketHeight);
  assert.ok(d.capturePocketHeight - d.captureDiameter > d.slotHeight - d.rollerDiameter);
  assert.ok(d.captureMouthHeight - d.sleeveDiameter > d.slotHeight - d.rollerDiameter);
  const captureCentre = (d.captureX[0] + d.captureX[1]) / 2;
  const halfAxialPlay =
    (d.capturePocketX[1] - d.capturePocketX[0] - (d.captureX[1] - d.captureX[0])) / 2;

  for (const angle of [-18, -12, -6, 0, 6, 12, 18]) {
    const p = parameters({ angle1: angle, angle2: angle, angle3: angle, angle4: angle });
    const items = components(p);
    for (let channel = 1; channel <= 4; channel++) {
      const toLocal = (point: number[]) =>
        new Vector3(...(point as [number, number, number])).applyAxisAngle(
          new Vector3(0, 0, 1),
          (-(channel - 1) * Math.PI) / 2,
        );
      const follower = occurrence(items, channel, 'follower-bearing');
      const position = toLocal(follower.placement.translation);
      const screw = toLocal(occurrence(items, channel, 'screw').placement.translation);
      const k = kinematics(p, channel - 1);
      near(position.x, (d.rollerX[0] + d.rollerX[1]) / 2);
      near(position.z - k.travel, layout.outputZ);
      assert.ok(position.y - d.rollerDiameter / 2 > d.slotY[0]);
      assert.ok(position.y + d.rollerDiameter / 2 < d.slotY[1]);
      assert.ok(position.y - d.captureDiameter / 2 > d.capturePocketY[0]);
      assert.ok(position.y + d.captureDiameter / 2 < d.capturePocketY[1]);
      const pinAxis = new Vector3(0, 0, 1).applyEuler(rotation(follower));
      near(toLocal(pinAxis.toArray()).distanceTo(new Vector3(1, 0, 0)), 0);
      const keeper = occurrence(items, channel, 'keeper');
      assert.ok(keeper.manufacturing?.processes.includes('printing'));

      // The pin is fixed in X by the rocker. Its captured flange has positive
      // Y offset from the screw, so yaw creates an X error even at neutral.
      const dx = captureCentre - screw.x;
      const dy = position.y - screw.y;
      assert.ok(dy > 0, 'The antiyaw lever must not vanish or reverse in the commanded range.');
      for (const sign of [-1, 1]) {
        const yaw = (sign * Math.PI) / 180;
        const residual = dx * Math.cos(yaw) + dy * Math.sin(yaw) - dx;
        assert.equal(Math.sign(residual), sign);
        assert.ok(
          Math.abs(residual) > halfAxialPlay,
          'A free one-degree nut yaw exceeds X capture.',
        );
      }
    }
  }
});

test('inspection poses preserve the bill of materials and every local fabrication recipe', () => {
  const p = parameters({ angle1: 18, angle2: -18, angle3: 9, angle4: -9 });
  assert.deepEqual(part.composition!(p), part.composition!(part.defaults));
  const neutral = new Map(components().map((item) => [item.id, item]));
  for (const state of ['assembled', 'exploded']) {
    const posed = components(p, state);
    assert.deepEqual(posed.map((item) => item.id).sort(), [...neutral.keys()].sort());
    for (const item of posed.filter((candidate) => candidate.supply === 'manufactured')) {
      const original = neutral.get(item.id)!;
      assert.deepEqual(item.parameters, original.parameters, item.id);
      assert.deepEqual(item.manufacturing, original.manufacturing, item.id);
    }
  }
  const prints = components(p, 'prints');
  const expected = components(p).filter((item) =>
    item.manufacturing?.processes.includes('printing'),
  );
  assert.ok(prints.length > 0);
  assert.deepEqual(prints.map((item) => item.id).sort(), expected.map((item) => item.id).sort());
  for (const item of prints) {
    assert.equal(item.supply, 'manufactured');
    assert.ok(item.manufacturing!.processes.includes('printing'));
    assert.ok(item.manufacturing!.material.length > 0);
  }
});

test('custom screw journals and captured nut retain the selected source interfaces', () => {
  const items = components();
  for (let channel = 1; channel <= 4; channel++) {
    const screw = occurrence(items, channel, 'screw');
    const nut = occurrence(items, channel, 'nut');
    assert.equal(screw.libraryId, 'ball-screw');
    assert.equal(screw.state, 'screw');
    assert.equal(screw.parameters.endMachining, 'custom');
    assert.equal(screw.parameters.length, layout.screwLength);
    assert.equal(screw.parameters.shaftDiameter, 6);
    assert.equal(screw.parameters.lead, 1);
    for (const end of ['drive', 'fixed', 'support'])
      assert.equal(screw.parameters[`${end}JournalDiameter`], 4);
    const origin = screw.placement.translation[2],
      length = Number(screw.parameters.length);
    const threadStart =
      origin -
      length / 2 +
      Number(screw.parameters.driveJournalLength) +
      Number(screw.parameters.fixedJournalLength);
    const threadEnd = origin + length / 2 - Number(screw.parameters.supportJournalLength);
    near(threadStart, layout.screwThreadStart);
    near(threadEnd, layout.screwThreadEnd);
    near(origin - length / 2, layout.screwBottom);
    const fixedStart = origin - length / 2 + Number(screw.parameters.driveJournalLength);
    const localBearings = items.filter(
      (item) => item.id.startsWith(`channel-${channel}-`) && bearingSize(item, 4, 9, 4),
    );
    const forward = localBearings
      .filter((support) => support.placement.translation[2] < threadStart)
      .sort((a, b) => a.placement.translation[2] - b.placement.translation[2]);
    assert.equal(forward.length, 2);
    near(forward[0].placement.translation[2] + 2, forward[1].placement.translation[2] - 2);
    near(forward[1].placement.translation[2] + 2, threadStart);
    for (const support of localBearings) {
      const start = support.placement.translation[2] - 2;
      const end = support.placement.translation[2] + 2;
      assert.ok(
        (start >= fixedStart && end <= threadStart) ||
          (start >= threadEnd && end <= origin + length / 2),
        `${support.id}: both bearing faces must lie on a machined journal`,
      );
    }
    for (const [end, journalStart] of [
      ['fixed', fixedStart],
      ['support', threadEnd],
    ] as const) {
      const grooveStart = journalStart + Number(screw.parameters[`${end}GrooveOffset`]);
      const grooveEnd = grooveStart + Number(screw.parameters[`${end}GrooveWidth`]);
      const clip = occurrence(items, channel, `screw-${end === 'fixed' ? 'front' : 'rear'}-e-clip`);
      const halfThickness = Number(clip.parameters.thickness) / 2;
      near(Number(screw.parameters[`${end}GrooveDiameter`]), 3.2);
      near(Number(clip.parameters.installedGrooveDiameter), 3.2);
      assert.ok(clip.placement.translation[2] - halfThickness >= grooveStart - 1e-8);
      assert.ok(clip.placement.translation[2] + halfThickness <= grooveEnd + 1e-8);
    }
    assert.equal(nut.libraryId, 'ball-nut');
    assert.equal(nut.state, 'assembled');
    assert.equal(nut.parameters.nutDiameter, 12);
    assert.equal(nut.parameters.nutLength, 15);
    assert.equal(nut.parameters.flangeDiameter, 24);
    assert.equal(nut.parameters.flangeWidth, 16);
    assert.equal(nut.parameters.flangeThickness, 3.5);
    assert.equal(nut.parameters.mountCircle, 18);
    assert.equal(nut.parameters.mountHoleDiameter, 3.4);
    near(nut.placement.translation[2], layout.outputZ + layout.nutOffset);
    near(nut.placement.rotation[2] - (channel - 1) * 90, 90);
    assert.equal(
      occurrence(items, channel, 'nut-lid').manufacturing?.processes.includes('printing'),
      true,
    );
    assert.equal(
      occurrence(items, channel, 'carriage').manufacturing?.processes.includes('printing'),
      true,
    );
  }
});

test('the keyed shaft follows its rocker and the screw rotation moves the captured nut', () => {
  const neutral = components();
  const angles = [18, -18, 9, -9];
  const p = parameters(Object.fromEntries(angles.map((angle, i) => [`angle${i + 1}`, angle])));
  const moved = components(p);
  for (let channel = 1; channel <= 4; channel++) {
    const k = kinematics(p, channel - 1);
    const shaft = occurrence(moved, channel, 'shaft');
    const rocker = occurrence(moved, channel, 'rocker');
    const cap = occurrence(moved, channel, 'rocker-cap');
    const shaftNormal = new Vector3(0, 1, 0).applyEuler(rotation(shaft));
    const rockerNormal = new Vector3(0, 1, 0).applyEuler(rotation(rocker));
    near(shaftNormal.distanceTo(rockerNormal), 0);
    near(new Vector3(0, 1, 0).applyEuler(rotation(cap)).distanceTo(rockerNormal), 0);
    near(shaft.placement.rotation[0], angles[channel - 1]);
    assert.deepEqual(
      shaft.placement.translation,
      occurrence(neutral, channel, 'shaft').placement.translation,
    );
    for (const suffix of ['nut', 'carriage', 'nut-lid', 'keeper']) {
      const from = occurrence(neutral, channel, suffix),
        to = occurrence(moved, channel, suffix);
      near(to.placement.translation[2] - from.placement.translation[2], k.travel);
      near(to.placement.translation[0], from.placement.translation[0]);
      near(to.placement.translation[1], from.placement.translation[1]);
    }
    const screw = occurrence(moved, channel, 'screw');
    near(k.screwTurns * Number(screw.parameters.lead), k.travel);
    const visiblePhase = (Number(screw.parameters.rotation) * Math.PI) / 180;
    const travelledPhase = k.screwTurns * 2 * Math.PI;
    near(Math.sin(visiblePhase), Math.sin(travelledPhase));
    near(Math.cos(visiblePhase), Math.cos(travelledPhase));
    const follower = occurrence(moved, channel, 'follower-bearing');
    const world = new Vector3(...follower.placement.translation).applyAxisAngle(
      new Vector3(0, 0, 1),
      (-(channel - 1) * Math.PI) / 2,
    );
    near(world.y, k.followerY);
    near(world.z, k.followerZ);
  }
});

test('neutral and end poses build finite previews and keep every printed component inside the tube bore', () => {
  for (const p of [
    part.defaults,
    parameters({ angle1: 18, angle2: -18, angle3: 18, angle4: -18 }),
  ]) {
    const printed = new Set(configured(p, 'prints').map((piece) => piece.label));
    const model = part.buildGeometry(p, 'assembled');
    try {
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model, true);
      assert.ok(!bounds.isEmpty());
      assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
      for (const instance of model.children.filter((child) => printed.has(child.name))) {
        instance.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          const vertices = child.geometry.getAttribute('position');
          const point = new Vector3();
          for (let i = 0; i < vertices.count; i++) {
            point.fromBufferAttribute(vertices, i).applyMatrix4(child.matrixWorld);
            assert.ok(Math.hypot(point.x, point.y) <= layout.tubeID / 2 + 0.01, instance.name);
          }
        });
      }
    } finally {
      disposeModel(model);
    }
  }
});
