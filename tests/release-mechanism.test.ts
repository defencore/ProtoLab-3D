import test from 'node:test';
import assert from 'node:assert/strict';
import part from '../src/parts/rocket-release/part';
import { motion, layout, at } from '../src/parts/rocket-release/lib/motion';
import { pieces, studAngles } from '../src/parts/rocket-release/lib/model';
import { servoMounts } from '../src/parts/rocket-release/lib/servo';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

test('Release presets validate throughout lock rotation and axial separation', () => {
  assert.equal(part.defaults.tubeOD, 80);
  assert.equal(part.defaults.tubeID, 76);
  for (const preset of part.presets)
    for (const state of part.states!)
      for (const release of [0, 30, 59, 60, 61, 70, 100])
        assert.deepEqual(
          validateParameters(part, { ...preset.parameters, release }, state.id),
          [],
          `${preset.id}/${state.id}/${release}`,
        );
  assert.ok(validateParameters(part, { ...part.defaults, tubeID: 81 }, 'assembled').length);
  assert.ok(validateParameters(part, { ...part.defaults, motor: 'unknown' }, 'assembled').length);
  assert.ok(
    validateParameters(part, { ...part.defaults, separation: 16, springTravel: 13 }, 'assembled')
      .length,
  );
});
test('Eight fixed studs align with the ring openings before any axial motion', () => {
  for (const unlockAngle of [12, 14, 20])
    for (let release = 0; release <= 100; release++) {
      const p = { ...part.defaults, unlockAngle, release },
        m = layout(p);
      assert.equal(m.pinionAngle, m.angle * 4);
      assert.ok(m.lift === 0 || m.angle === unlockAngle);
      assert.ok(m.springExpansion <= +part.defaults.springTravel);
      if (release >= 60)
        for (const a of studAngles) {
          const hole = at(m.lockRadius, a - unlockAngle + m.angle),
            stud = at(m.lockRadius, a);
          assert.ok(Math.hypot(hole[0] - stud[0], hole[1] - stud[1]) < 1e-10);
        }
    }
  assert.equal(motion({ ...part.defaults, release: 100 }).lift, part.defaults.separation);
});
test('Actual component recipes retain the lower drive and move the complete upper section', () => {
  const fixed = pieces(part.defaults, 'assembled'),
    separated = pieces({ ...part.defaults, release: 100 }, 'assembled');
  const find = (items: typeof fixed, label: string) => items.find((x) => x.label === label)!.shape;
  for (const label of [
    'Fixed windowed carrier',
    'Lower tube section',
    ...studAngles.map((_, i) => `Retaining shoulder stud ${i + 1} · fixed`),
  ])
    assert.deepEqual(find(fixed, label), find(separated, label), label);
  for (const label of [
    'Rotating release disk',
    'Upper tube sleeve',
    'Released upper tube section',
    ...Array.from({ length: 4 }, (_, i) => `Upper tube screw ${i + 1}`),
  ]) {
    const shape = find(separated, label);
    assert.equal(shape.kind, 'transform');
    if (shape.kind === 'transform') {
      assert.equal(shape.offset[2], part.defaults.separation);
      assert.equal(shape.angle, part.defaults.unlockAngle);
    }
  }
  assert.equal(fixed.filter((p) => p.label.startsWith('Drive pinion')).length, 4);
  assert.equal(fixed.filter((p) => p.label.startsWith('Retaining shoulder stud')).length, 8);
  assert.equal(fixed.filter((p) => p.label.startsWith('Compression spring')).length, 4);
  for (let i = 1; i <= 4; i++) {
    assert.notDeepEqual(
      find(fixed, `Drive pinion ${i} · 20 teeth`),
      find(separated, `Drive pinion ${i} · 20 teeth`),
    );
    const a = find(fixed, `Compression spring ${i}`),
      b = find(separated, `Compression spring ${i}`);
    assert.ok(a.kind === 'spring' && b.kind === 'spring');
    assert.ok(Math.abs(b.height - a.height - +part.defaults.springTravel) < 1e-10);
  }
});
test('Every release control changes geometry and inspection views remove only their intended components', () => {
  const reference = { ...part.defaults, release: 75 },
    macro = part.python(reference, 'assembled');
  for (const patch of [
    { tubeOD: 82 },
    { tubeID: 77 },
    { fitClearance: 0.6 },
    { release: 40 },
    { unlockAngle: 16 },
    { separation: 32 },
    { springTravel: 6 },
    { motor: '16' },
    { drive: 'central-servo' },
  ] as Parameters[]) {
    const p = { ...reference, ...patch };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    assert.notEqual(part.python(p, 'assembled'), macro, JSON.stringify(patch));
  }
  const mechanism = pieces(reference, 'mechanism');
  assert.ok(
    !mechanism.some(
      (p) => p.label === 'Fixed windowed carrier' || p.label.includes('tube section'),
    ),
  );
  assert.ok(pieces(reference, 'open').some((p) => p.label === 'Fixed windowed carrier'));
});

test('Single servo closes all four gear meshes and unlocks eight studs before lifting', () => {
  for (const preset of part.presets.filter((p) => p.parameters.drive === 'central-servo')) {
    for (const release of [0, 30, 59, 60, 61, 100]) {
      const m = layout({ ...preset.parameters, release });
      const sunRadius = (20 * m.module) / 2;
      assert.equal(m.ringTeeth, 20 + 2 * m.pinionTeeth);
      assert.equal(
        (m.ringTeeth + 20) % 4,
        0,
        'Four equally spaced idlers share a valid tooth phase',
      );
      assert.ok(Math.abs(m.driveRadius - sunRadius - m.pinionRadius) < 1e-10);
      assert.ok(Math.abs(m.driveRadius + m.pinionRadius - m.pitchRadius) < 1e-10);
      assert.ok(2 * (m.pinionRadius + m.module) < Math.SQRT2 * m.driveRadius);
      assert.equal(m.servoAngle, -5 * m.angle);
      assert.equal(m.pinionAngle, 2.5 * m.angle);
      assert.ok(m.lift === 0 || m.angle === +preset.parameters.unlockAngle);
      if (release >= 60)
        for (const a of studAngles) {
          const hole = at(m.lockRadius, a - +preset.parameters.unlockAngle + m.angle);
          const stud = at(m.lockRadius, a);
          assert.ok(Math.hypot(hole[0] - stud[0], hole[1] - stud[1]) < 1e-10);
        }
    }
  }
  assert.equal(motion({ ...part.defaults, drive: 'central-servo', release: 60 }).servoAngle, -70);
});
test('Single-servo assembly contains one input, four fixed-axis idlers and no independent motors', () => {
  const p = { ...part.defaults, drive: 'central-servo' };
  const closed = pieces(p, 'assembled');
  const released = pieces({ ...p, release: 100 }, 'assembled');
  assert.equal(closed.filter((x) => x.label.startsWith('Central micro servo')).length, 1);
  assert.equal(closed.filter((x) => /^Servo input pinion ·/.test(x.label)).length, 1);
  assert.equal(closed.filter((x) => /^Idler pinion \d ·/.test(x.label)).length, 4);
  assert.equal(closed.filter((x) => x.label.startsWith('Gearmotor')).length, 0);
  assert.equal(closed.filter((x) => x.label.startsWith('Retaining shoulder stud')).length, 8);
  for (const item of closed) {
    const after = released.find((x) => x.label === item.label)!;
    if (
      item.label.startsWith('Central micro servo') ||
      item.label.startsWith('Servo mounting') ||
      item.label.startsWith('Output shaft bushing')
    )
      assert.deepEqual(item.shape, after.shape, item.label);
    if (/^Idler pinion \d ·/.test(item.label)) {
      assert.ok(item.shape.kind === 'transform' && after.shape.kind === 'transform');
      assert.deepEqual(item.shape.offset, after.shape.offset);
      assert.equal(after.shape.angle - item.shape.angle, 35);
    }
  }
  const motorControl = part.parameters.find((x) => x.key === 'motor')!;
  assert.equal(motorControl.visibleWhen?.(p), false);
  assert.equal(motorControl.visibleWhen?.(part.defaults), true);
  assert.deepEqual(pieces({ ...p, motor: '16' }, 'assembled'), closed);
  assert.ok(validateParameters(part, { ...p, drive: 'invalid' }, 'assembled').length);
});

test('Servo mounting hardware clears idler supports throughout the custom tube range', () => {
  for (let tubeID = 76; tubeID <= 156; tubeID += 0.5) {
    const m = layout({ ...part.defaults, drive: 'central-servo', tubeID });
    for (const [x, y] of servoMounts)
      for (const a of [0, 90, 180, 270]) {
        const [sx, sy] = at(m.driveRadius, a);
        assert.ok(Math.hypot(x - sx, y - sy) > 2 + 3.6, `Mount/idler clearance at ID${tubeID}`);
      }
  }
});
