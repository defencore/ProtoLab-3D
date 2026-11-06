import assert from 'node:assert/strict';
import test from 'node:test';
import servo from '../src/parts/servo-motor/part';
import battery from '../src/parts/lipo-battery/part';
import cylinder from '../src/parts/round-pneumatic-cylinder/part';
import measurement from '../src/parts/machine-measurement/part';
import valve from '../src/parts/pneumatic-valve/part';
import bandSaw from '../src/parts/automatic-band-saw/part';
import { bom as bandSawProcurement } from '../src/parts/automatic-band-saw/lib/procurement';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { configureProduct } from '../src/core/design-project';
import { validateParameters } from '../src/core/validation';
import { machineComposition } from '../src/core/machine-composition';
import { measurementPieces } from '../src/parts/machine-measurement/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { Box3, Vector3 } from 'three';

test('assembly supplier identities are individually searchable and retain exact source designations', () => {
  const selections = [
    [servo, 'towerpro-mg996r', 'MG996R'],
    [servo, 'towerpro-mg90s', 'MG90S'],
    [battery, 'tattu-3s-650-75c', 'TA-75C-650-3S1P-XT30'],
    [cylinder, 'ma32x50-sca', 'MA32x50-SCA'],
    [cylinder, 'ma32x100-sca', 'MA32x100-SCA'],
    [measurement, 'e3z-t81-l', 'E3Z-T81-L 2M'],
    [measurement, 'e3z-t81-d', 'E3Z-T81-D 2M'],
    [measurement, 'e2b-m12', 'E2B-M12KS04-WP-B1 2M'],
  ] as const;
  const index = buildPresetIndex([servo, battery, cylinder, measurement]);
  for (const [part, presetId, designation] of selections) {
    const id = `${part.id}:${presetId}`;
    const result = filterPresets(index, { ...emptyPresetFilters(), query: id });
    assert.deepEqual(
      result.items.map((entry) => entry.id),
      [id],
    );
    const preset = result.items[0].preset;
    const state = part.states?.[0]?.id ?? 'default';
    assert.deepEqual(validateParameters(part, preset.parameters, state), []);
    const configuration = configureProduct({
      part,
      parameters: preset.parameters,
      state,
      presetId,
    });
    assert.equal(configuration.presetId, presetId);
    assert.equal(configuration.procurement?.designation, designation);
    assert.equal(configuration.supply, 'purchased');
  }
});

test('exact saw sensor occurrences retain one supplier product and its qualified model', () => {
  for (const model of ['mwe21', 'e3z-t81-l', 'e3z-t81-d', 'e2b-m12']) {
    const authored = measurementPieces({ model });
    const physical = machineComposition(
      authored.map((piece) => ({ ...piece, procurement: 'BUY' })),
      [],
    );
    assert.equal(physical.components.length, 1, model);
    const component = physical.components[0];
    assert.equal(component.libraryId, 'purchased-component');
    assert.match(
      component.notes!,
      new RegExp(
        'SourceLibraryEntry: machine-measurement:' + (model === 'mwe21' ? 'mwe21-200' : model),
      ),
    );
    assert.equal(component.presetId, undefined);
    assert.equal(component.quantity, 1);
    assert.ok(component.procurement?.source.startsWith('https://'));
  }
});

test('MA executions keep fixed source identity and reconcile extension to their own stroke', () => {
  for (const preset of cylinder.presets) {
    const stroke = Number(preset.catalog!.attributes!.stroke);
    for (const extension of [0, stroke / 2, stroke]) {
      const p = { ...preset.parameters, extension };
      assert.deepEqual(validateParameters(cylinder, p, 'default'), []);
      const model = cylinder.buildGeometry(p, 'default');
      try {
        const dimensions = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
        cylinder
          .dimensions(p, 'default')
          .forEach((value, axis) => assert.ok(Math.abs(value - dimensions[axis]) < 0.001));
        const configured = configureProduct({
          part: cylinder,
          parameters: p,
          state: 'default',
          presetId: preset.id,
        });
        assert.equal(configured.presetId, preset.id);
      } finally {
        disposeModel(model);
      }
    }
    assert.ok(cylinder.validate({ ...preset.parameters, extension: stroke + 1 }, 'default').length);
    assert.ok(cylinder.validate({ ...preset.parameters, bore: 40 }, 'default').length);
  }
  assert.equal(
    cylinder.updateParameters!({ model: 'ma32x50-sca', extension: 100 }, 'model').extension,
    50,
  );
});

test('remaining band-saw procurement devices are independently found without implying verified geometry', () => {
  for (const [part, id] of [
    [measurement, 'e3z-ll81'],
    [valve, '2vd0102-g1-4'],
  ] as const) {
    const preset = part.presets.find((preset) => preset.id === id)!;
    assert.ok(preset);
    const entry = `${part.id}:${id}`;
    assert.deepEqual(
      filterPresets(buildPresetIndex([part]), { ...emptyPresetFilters(), query: entry }).items.map(
        (item) => item.id,
      ),
      [entry],
    );
    const state = part.states?.[0]?.id ?? 'default';
    const configured = configureProduct({
      part,
      parameters: preset.parameters,
      state,
      presetId: id,
    });
    assert.equal(configured.supply, 'reference');
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'envelope');
    assert.ok(
      bandSawProcurement.some((item) => 'libraryEntryId' in item && item.libraryEntryId === entry),
    );
  }
  const sensor = bandSaw.composition!(bandSaw.defaults).components.filter((component) =>
    component.procurement?.designation.startsWith('E3Z-LL81'),
  );
  assert.equal(sensor.length, 1);
  assert.equal(sensor[0].libraryId, 'purchased-component');
  assert.equal(sensor[0].supply, 'purchased');
  assert.match(sensor[0].notes!, /SourceLibraryEntry: machine-measurement:e3z-ll81/);
  assert.ok(
    !bandSaw.composition!(bandSaw.defaults).components.some((component) =>
      component.procurement?.designation.includes('2VD0102'),
    ),
    'flow-control installation was not modeled or invented',
  );
});
