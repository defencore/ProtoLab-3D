import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { eskdIdentity } from '../src/core/eskd';
import type { Parameters } from '../src/core/types';

test('SFK and TR8 canonical assembly poses do not allocate new physical executions', () => {
  const mechanisms = parts.filter((part) => part.browseFamily?.id === 'screw-rotary-actuators');
  assert.ok(mechanisms.length > 0, 'The declared mechanism family must be covered.');
  assert.deepEqual(
    mechanisms.map((part) => part.id).sort(),
    parts
      .filter((part) => /^(?:sfk-|tr8-).*actuator$/.test(part.id))
      .map((part) => part.id)
      .sort(),
    'Every SFK/TR8 actuator must belong to the tested mechanism family.',
  );
  for (const part of mechanisms) {
    const pose: Parameters = { ...part.defaults };
    for (const key of ['outputAngle', 'angleA', 'angleB', 'angleC', 'angleD'])
      if (key in pose) pose[key] = 12;
    const first = eskdIdentity(part, part.defaults, 'assembled');
    const moved = eskdIdentity(part, pose, 'positive-limit');
    assert.equal(moved.designation, first.designation, part.id);
    const motor = { ...pose, motorModel: pose.motorModel === '361-12' ? '107-12' : '361-12' };
    if (Object.hasOwn(part.defaults, 'motorModel'))
      assert.notEqual(
        eskdIdentity(part, motor, 'assembled').designation,
        first.designation,
        part.id,
      );
  }
});

test('clamp motion stays one execution while its physical segment count changes identity', () => {
  const part = parts.find((item) => item.id === 'clamp-band-release')!;
  const first = eskdIdentity(part, part.defaults, 'assembled');
  assert.equal(
    eskdIdentity(part, { ...part.defaults, release: 100, separation: 70 }, 'released').designation,
    first.designation,
  );
  assert.notEqual(
    eskdIdentity(part, { ...part.defaults, segments: 20 }, 'assembled').designation,
    first.designation,
  );
});
