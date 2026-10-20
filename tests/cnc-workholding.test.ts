import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import table, { worktableParameters, worktableLayout } from '../src/parts/cnc-worktable/part';
import probe from '../src/parts/cnc-toolsetter-part/part';
import cooling, { coolingSpec } from '../src/parts/cnc-process-accessory/part';
import control from '../src/parts/machine-control/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

test('CNC workholding details have valid presets and intentional detail changes reset the blank', () => {
  for (const preset of table.presets)
    assert.deepEqual(validateParameters(table, preset.parameters, 'default'), [], preset.id);
  const changed = table.updateParameters!(
    { ...table.defaults, component: 'filter-basket' },
    'component',
  );
  assert.equal(changed.length, 180);
  assert.equal(changed.width, 120);
  assert.deepEqual(table.updateParameters!({ ...changed, width: 130 }, 'width'), {
    ...changed,
    width: 130,
  });
});
test('CNC aluminium slat has blind underside mounting below the T-slot cavity and compatible M8 T-slot opening', () => {
  const p = table.defaults,
    v = worktableLayout(p);
  assert.deepEqual(v.yRows, [-750, -450, -150, 150, 450, 750]);
  assert.equal(v.holes.length, 12);
  assert.ok(v.holes.every((h) => h.threaded && h.diameter === 6 && h.depth === 8));
  assert.ok(Number(p.thickness) - Number(p.slotDepth) - 8 >= 3);
  assert.ok(Number(p.slotOpening) > 8 && Number(p.slotWidth) > Number(p.slotOpening));
  assert.ok(
    table.validate({ ...p, thickness: 16 }, 'default').length,
    'Thin stock must not break the underside mounting into the slots',
  );
});
test('CNC recessed board uses independent metal track details that fit its recesses', () => {
  const board = worktableParameters('hybrid-board'),
    track = worktableParameters('t-track');
  assert.deepEqual(table.validate(board, 'default'), []);
  assert.deepEqual(table.validate(track, 'default'), []);
  const slots = worktableLayout(board).slots;
  assert.equal(slots.length, 12);
  assert.equal(slots[1] - slots[0], 80);
  assert.equal(track.width, 32);
  assert.equal(track.thickness, 12);
  assert.ok(Number(board.thickness) - Number(track.thickness) >= 12);
});
test('CNC worktable rejects impossible and non-finite manufacturing dimensions before building', () => {
  const invalid: Parameters[] = [
    { length: NaN },
    { width: Infinity },
    { mountPitch: 0 },
    { slotWidth: 7 },
    { mountBoltDiameter: 7 },
    { component: 'unimplemented' },
    { component: 'filter-basket', length: 1800, width: 600 },
  ];
  for (const patch of invalid)
    assert.ok(
      table.validate({ ...table.defaults, ...patch }, 'default').length,
      JSON.stringify(patch),
    );
});
test('CNC flat probe details generate finite solids in both viewing modes with retained thread callouts', () => {
  for (const mode of ['simple', 'full'] as const)
    for (const preset of probe.presets) {
      assert.deepEqual(validateParameters(probe, preset.parameters, 'default'), []);
      const g = withGeometryMode(mode, () => probe.buildGeometry(preset.parameters, 'default'));
      const bounds = new Box3().setFromObject(g).getSize(new Vector3());
      assert.ok([bounds.x, bounds.y, bounds.z].every((v) => Number.isFinite(v) && v > 0));
      const code = withGeometryMode(mode, () =>
        generateScript(probe, preset.parameters, 'default', preset.id, undefined, mode),
      );
      assert.match(code, /M3/);
      assert.match(code, /cnc-toolsetter-part/);
      g.traverse((o) => {
        if ('geometry' in o) (o.geometry as any).dispose?.();
      });
    }
});
test('CNC process equipment records verified and unverified dimensions separately', () => {
  for (const preset of cooling.presets)
    assert.deepEqual(validateParameters(cooling, preset.parameters, 'default'), []);
  const chiller = coolingSpec('teyu-cw3000-tgty');
  assert.deepEqual([chiller.width, chiller.length, chiller.height], [270, 490, 380]);
  assert.match(chiller.spec, /passive/);
  assert.match(coolingSpec('vertex-vwp81-150k').evidence, /not published or verified/);
});
test('CNC DDCS3.1 and 36V motor supply have matching geometry bounds and sourced model identities', () => {
  for (const model of ['ddcs-v3-1', 'lrs35036']) {
    const p = { ...control.defaults, model };
    assert.deepEqual(validateParameters(control, p, 'default'), []);
    const bounds = new Box3()
      .setFromObject(control.buildGeometry(p, 'default'))
      .getSize(new Vector3());
    const dims = control.dimensions(p, 'default');
    [bounds.x, bounds.y, bounds.z].forEach((v, i) =>
      assert.ok(Math.abs(v - dims[i]) < 0.01, model + ' axis' + i),
    );
    const preset = control.presets.find((p) => p.parameters.model === model)!;
    assert.deepEqual(preset.catalog?.verifiedParameters, ['model']);
  }
});
