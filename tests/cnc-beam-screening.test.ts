import test from 'node:test';
import assert from 'node:assert/strict';
import { beamLoadComplianceMm } from '../src/parts/cnc-milling-machine/lib/beam-screening';

test('strip solver agrees with independent cantilever and simply-supported closed forms', () => {
  const force = 1000, length = 1000, rigidity = 200000 * 100 * 100 ** 3 / 12;
  const cantilever = beamLoadComplianceMm(force, rigidity, [{ positionMm: 0, restrainRotation: true }], [{ positionMm: length, forceFactor: 1 }]);
  const simple = beamLoadComplianceMm(force, rigidity, [{ positionMm: 0, restrainRotation: false }, { positionMm: length, restrainRotation: false }], [{ positionMm: length / 2, forceFactor: 1 }]);
  assert.ok(Math.abs(cantilever - force * length ** 3 / (3 * rigidity)) < 1e-10);
  assert.ok(Math.abs(simple - force * length ** 3 / (48 * rigidity)) < 1e-10);
  assert.throws(() => beamLoadComplianceMm(force, rigidity, [{ positionMm: 0, restrainRotation: false }], [{ positionMm: length, forceFactor: 1 }]));
});

test('actual force-pair strip solve reproduces the previous independently derived high-Z reference', () => {
  const force = 300, rigidity = 70000 * 510 * 20 ** 3 / 12;
  const loads = [{ positionMm: 500, forceFactor: 22 / 7 }, { positionMm: 640, forceFactor: -15 / 7 }];
  const clamped = beamLoadComplianceMm(force, rigidity, [{ positionMm: 330, restrainRotation: true }, { positionMm: 470, restrainRotation: true }], loads);
  const pinned = beamLoadComplianceMm(force, rigidity, [{ positionMm: 330, restrainRotation: false }, { positionMm: 470, restrainRotation: false }], loads);
  assert.ok(Math.abs(clamped - 0.08368487394957985) < 1e-10);
  assert.ok(Math.abs(pinned - 0.1265672268907563) < 1e-10);
});
