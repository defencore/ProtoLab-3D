import test from 'node:test';
import assert from 'node:assert/strict';
import { finishedDimensionAcceptance, millingAccuracyAllocation, millingDesignRequirement, workpieceThermalErrorMm, roundToolDeflectionMm } from '../src/parts/cnc-milling-machine/lib/requirements';

test('finished-part acceptance treats0.05 mm as a complete tolerance field and guard-bands uncertainty', () => {
  assert.equal(millingDesignRequirement.maximumAbsoluteFinishedDimensionErrorMm * 2, 0.05);
  // A dimension barely inside the drawing tolerance is rejected when uncertainty crosses the boundary.
  assert.equal(finishedDimensionAcceptance(100, 100.024, 0.002).accepted, false);
  assert.equal(finishedDimensionAcceptance(100, 99.976, 0.002).accepted, false);
  assert.equal(finishedDimensionAcceptance(100, 100.023, 0.002).accepted, true);
  assert.equal(finishedDimensionAcceptance(100, 99.977, 0.002).accepted, true);
  assert.equal(finishedDimensionAcceptance(100, 100.05, 0).accepted, false);
  assert.throws(() => finishedDimensionAcceptance(100, Number.NaN, 0.002));
  assert.throws(() => finishedDimensionAcceptance(100, 100, -0.002));
});

test('tool projection has cubic influence and a long thin tool can consume the complete tolerance', () => {
  // Assumed carbide modulus600 GPa and uniform shank; actual fluted tool is not qualified by this equation.
  const longTool = roundToolDeflectionMm(100, 50, 8, 600000);
  const shortTool = roundToolDeflectionMm(100, 25, 10, 600000);
  assert.ok(Math.abs(longTool - 0.0345388331) < 1e-9);
  assert.ok(longTool > millingDesignRequirement.maximumAbsoluteFinishedDimensionErrorMm);
  assert.ok(shortTool < 0.002);
  assert.ok(Math.abs(longTool / roundToolDeflectionMm(100, 25, 8, 600000) - 8) < 1e-12);
  assert.throws(() => roundToolDeflectionMm(-1, 25, 10, 600000));
});

test('allocation includes inspection uncertainty and exposes long aluminium workpiece thermal sensitivity', () => {
  const allocated = millingAccuracyAllocation.reduce((sum, row) => sum + row.allowanceMm, 0);
  assert.ok(Math.abs(allocated - 0.025) < 1e-12);
  // Assumed23µm/(m K), not a D16T material certificate:1.5 m changes34.5µm per kelvin.
  assert.ok(Math.abs(workpieceThermalErrorMm(1500, 1, 23e-6) - 0.0345) < 1e-12);
  assert.equal(workpieceThermalErrorMm(100, -1, 23e-6), workpieceThermalErrorMm(100, 1, 23e-6));
  assert.throws(() => workpieceThermalErrorMm(0, 1, 23e-6));
  assert.throws(() => workpieceThermalErrorMm(100, Infinity, 23e-6));
});
