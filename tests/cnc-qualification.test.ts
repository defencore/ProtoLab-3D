import test from 'node:test';
import assert from 'node:assert/strict';
import machine from '../src/parts/cnc-milling-machine/part';
import { spindleSpecs } from '../src/parts/cnc-spindle/part';
import {
  centralRibDeflection,
  plateToolDeflection,
  nutCarrierDeflection,
  millingStructuralScreen,
  uSectionSecondMoment,
} from '../src/parts/cnc-milling-machine/lib/qualification';

test('beam screening respects classical reference cases, units and cubic thickness scaling', () => {
  // 1000 N, 1 m steel beam, 100 mm square: EI=1.666667e12 N mm².
  assert.ok(Math.abs(centralRibDeflection(1000, 1000, 100, 100, 200000) - 0.0125) < 1e-12);
  assert.ok(Math.abs(nutCarrierDeflection(1000, 1000, 100, 100, 200000) - 0.2) < 1e-12);
  const original = plateToolDeflection(300, 300, 198.8, 240, 20, 70000);
  const doubled = plateToolDeflection(300, 300, 198.8, 240, 40, 70000);
  assert.ok(Math.abs(original / doubled - 8) < 1e-12);
  assert.equal(plateToolDeflection(300, 300, 300, 240, 20, 70000), 0);
  assert.equal(centralRibDeflection(0, 1100, 50, 40, 210000), 0);
  assert.throws(() => centralRibDeflection(300, 1100, 50, 0, 210000));
  assert.throws(() => plateToolDeflection(300, 300, 301, 240, 20, 70000));
});

test('reinforced default uses integral sections and actual guide-row positions without declaring accuracy', () => {
  const report = millingStructuralScreen(machine.defaults);
  const medium = report.cases.find((one) => one.forceN === 300)!;
  assert.ok(Math.abs(uSectionSecondMoment(240, 20, 12, 80) - 4612571.428571428) < 1e-6);
  assert.ok(Math.abs(medium.movingPlateToolYmm - 0.003259673243) < 1e-10);
  assert.ok(Math.abs(medium.fixedTowerClampedYmm - 0.002120501394) < 1e-10);
  assert.ok(Math.abs(medium.tableSingleRibZmm - 0.010823250065) < 1e-10);
  assert.ok(Math.abs(medium.nutCarrierZmm - 0.000105093834) < 1e-10);
  assert.equal(report.status, 'not-qualified');
  assert.ok(report.assumptions.some((line) => line.includes('must not be summed')));
});

test('every supported spindle and table height retains an explicit mechanical qualification gate', () => {
  for (const model of spindleSpecs) {
    for (const tableHeight of [700, 800, 950]) {
      const p = { ...machine.defaults, spindle: model.id, tableHeight };
      const report = millingStructuralScreen(p);
      assert.equal(report.status, 'not-qualified');
      assert.ok(report.cases.every((one) => Object.values(one).every(Number.isFinite)));
      assert.ok(machine.assessment!(p)[0].includes('not qualified'));
      assert.ok(machine.composition!(p).issues.some((issue) => issue.includes('power-loss Z')));
    }
  }
});
