import assert from 'node:assert/strict';
import test from 'node:test';
import { integrateArm, engineering } from '../src/parts/multicopter-frame/lib/engineering';
import frame from '../src/parts/multicopter-frame/part';
test('variable-section integration reproduces the closed-form constant beam', () => {
  const L = 100,
    F = 10,
    E = 40000,
    I = 200,
    t = 6;
  const sections = Array.from({ length: 1001 }, (_, i) => ({ x: (i * L) / 1000, inertia: I }));
  const result = integrateArm(sections, L, F, E, t, 1);
  assert.ok(Math.abs(result.deflection - (F * L ** 3) / (3 * E * I)) < 1e-6);
  assert.equal(result.maxStress, (F * L * t) / (2 * I));
});
test('load and modulus changes affect physical estimates without creating flight approval', () => {
  const a = engineering(frame.defaults),
    b = engineering({ ...frame.defaults, motorThrust: Number(frame.defaults.motorThrust) * 2 }),
    c = engineering({
      ...frame.defaults,
      flexuralModulus: Number(frame.defaults.flexuralModulus) * 2,
    });
  assert.ok(a.deflectionMm !== null && b.deflectionMm !== null && c.deflectionMm !== null);
  assert.ok(a.localStressMPa !== null && b.localStressMPa !== null);
  assert.ok(a.rootCoupleN !== null);
  assert.ok(Math.abs(b.deflectionMm / a.deflectionMm - 2) < 1e-10);
  assert.ok(Math.abs(b.localStressMPa / a.localStressMPa - 2) < 1e-10);
  assert.ok(Math.abs(c.deflectionMm / a.deflectionMm - 0.5) < 1e-10);
  assert.equal(c.localStressMPa, a.localStressMPa);
  assert.equal(a.status, 'unqualified');
  assert.equal(a.assumedStressMargin, null);
  assert.ok(a.rootCoupleN > 100);
  assert.ok(a.unresolved.length >= 4);
  assert.ok(a.estimatedFrameMassG > 80 && a.estimatedFrameMassG < 200);
});
test('other source topologies do not inherit SOURCE ONE stiffness or root capacity', () => {
  for (const preset of frame.presets.slice(1)) {
    const result = engineering(preset.parameters);
    assert.equal(result.deflectionMm, null);
    assert.equal(result.localStressMPa, null);
    assert.equal(result.rootCoupleN, null);
    assert.equal(result.status, 'unqualified');
    assert.ok(result.hardware.length);
  }
});
test('six and eight rotor loads use their actual motor count and paired arm demand', () => {
  for (const [model, count] of [
    ['comet-y6', 6],
    ['source-one-x8', 8],
  ] as const) {
    const p = {
      ...frame.defaults,
      model,
      mass: 1.2,
      motorThrust: 1,
      loadFactor: 3,
      dynamicFactor: 1.5,
    };
    const r = engineering(p);
    assert.ok(Math.abs(r.loadN - ((1.2 * 9.80665 * 3) / count) * 1.5) < 1e-10);
    assert.equal(r.stationLoadN, r.loadN * 2);
    assert.equal(r.motorCount, count);
    assert.equal(r.armCount, count / 2);
    assert.equal(r.coaxialClearance.length, count / 2);
    assert.ok(Math.abs(r.thrustToWeight - count / (1.2 * 9.80665)) < 1e-10);
    assert.equal(r.deflectionMm, null);
    assert.equal(r.status, 'unqualified');
    assert.ok(r.unresolved.some((s) => s.includes('coaxial')));
  }
});
