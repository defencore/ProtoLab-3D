import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import module from '../src/parts/gmp16-gearmotor';
import { reductions, models, performance } from '../src/parts/gmp16-gearmotor/lib/catalog';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import {
  buildPresetIndex,
  emptyPresetFilters,
  filterPresets,
  fieldId,
} from '../src/core/preset-search';
import { registerPartModules } from '../src/core/part-modules';
import { generateScript } from '../src/core/freecad';

const part = module.part;

test('GMP16 provides all seventeen source reductions at both voltages and preserves the requested shaft codes', () => {
  const registered = registerPartModules([module])[0];
  assert.deepEqual(registered, {
    ...part,
    browseFamily: { id: 'gearmotors', label: 'Gearmotors', primary: true },
  });
  assert.equal(registered.presets, part.presets, 'registration preserves the source models');
  assert.equal(registered.buildGeometry, part.buildGeometry);
  assert.equal(part.browseFamily, undefined, 'registration does not mutate the source definition');
  assert.equal(reductions.length, 17);
  assert.equal(part.presets.length, 34);
  assert.deepEqual(
    reductions.map((row) => row.ratio),
    [4, 4.75, 16, 19, 22.6, 64, 76, 90, 107, 172, 224, 256, 304, 361, 428.7, 509, 1024],
  );
  for (const preset of part.presets) {
    for (const state of part.states!)
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), [], preset.id);
    assert.equal(preset.catalog!.sourceKind, 'attachment');
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
    assert.deepEqual(
      preset.catalog!.productCodes,
      [107, 361].includes(Number(preset.catalog!.attributes!.ratio))
        ? [`${preset.catalog!.attributes!.ratio}-11.6D7`]
        : [],
    );
    assert.ok(!preset.catalog!.designation.includes('TBC1636'));
    assert.ok(preset.catalog!.specifications!.some((spec) => spec.value.includes('conflicts')));
  }
  for (const code of ['107-11.6D7', '361-11.6D7']) {
    const filters = { ...emptyPresetFilters(part), query: code };
    assert.equal(filterPresets(buildPresetIndex([part]), filters).items.length, 2);
  }
  const invalid = { ...part.defaults, model: '999-12' };
  assert.ok(validateParameters(part, invalid, 'assembled').length);
  assert.throws(() => generateScript(part, invalid, 'assembled'));
  assert.ok(part.validate({ ...part.defaults, gearboxLength: 100 }, 'assembled').length);
});

test('GMP16 ratio and voltage filters preserve absent performance values and the 24 V speed distinction', () => {
  const index = buildPresetIndex([part]);
  const filters = emptyPresetFilters(part);
  filters.parameters[fieldId(part.catalogFilterFields!.find((f) => f.key === 'ratio')!)] = {
    min: '107',
    max: '107',
  };
  filters.parameters[fieldId(part.catalogFilterFields!.find((f) => f.key === 'voltage')!)] = {
    value: '24',
  };
  assert.deepEqual(
    filterPresets(index, filters).items.map((entry) => entry.preset.id),
    ['107-24'],
  );
  const withSpeed = emptyPresetFilters(part);
  withSpeed.parameters[fieldId(part.catalogFilterFields!.find((f) => f.key === 'noLoadSpeed')!)] = {
    min: '0',
    max: '3000',
  };
  assert.equal(filterPresets(index, withSpeed).items.length, Object.keys(performance).length * 2);
  assert.equal(part.presets.find((p) => p.id === '4-12')!.catalog!.attributes!.ratedSpeed, 2000);
  assert.equal(part.presets.find((p) => p.id === '4-24')!.catalog!.attributes!.ratedSpeed, 2200);
  assert.equal(
    part.presets.find((p) => p.id === '428.7-12')!.catalog!.attributes!.ratedSpeed,
    undefined,
  );
});

test('GMP16 installed and separated model bounds follow stage length, with finite positive-volume components', () => {
  for (const model of models)
    for (const state of ['assembled', 'exploded']) {
      const p = { ...part.defaults, model: model.id, showLeads: true };
      const group = part.buildGeometry(p, state);
      try {
        const bounds = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
        const expected = part.dimensions(p, state);
        bounds.forEach((value, axis) =>
          assert.ok(Math.abs(value - expected[axis]) < 0.001, `${model.id}/${state}/${axis}`),
        );
        group.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const attr = object.geometry.getAttribute('position');
          assert.ok(Array.from(attr.array).every(Number.isFinite));
          let volume = 0;
          for (let i = 0; i < attr.count; i += 3) {
            const [a, b, c] = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(attr, i + j));
            volume += a.dot(b.clone().cross(c)) / 6;
          }
          assert.ok(volume > 0, `${model.id}/${state}/${object.name}`);
        });
      } finally {
        disposeModel(group);
      }
    }
  const length = (model: string) => part.dimensions({ ...part.defaults, model }, 'assembled')[2];
  assert.equal(length('361-12') - length('107-12'), 3.5);
});

test('GMP16 preview contains the two blind mounting pilots and the correctly placed output D-flat', () => {
  const group = part.buildGeometry(part.defaults, 'assembled');
  group.updateMatrixWorld(true);
  try {
    const cover = group.children.find((child) => child.name.startsWith('Front cover'))!;
    const shaft = group.children.find((child) => child.name.startsWith('Output shaft'))!;
    const top = (object: typeof cover, x: number, y: number) =>
      new Raycaster(new Vector3(x, y, 20), new Vector3(0, 0, -1)).intersectObject(object, true)[0]
        ?.point.z;
    for (const x of [-5.25, 5.25]) assert.ok(Math.abs(top(cover, x, 0)! + 2.45) < 0.001);
    assert.ok(Math.abs(top(cover, 4, 0)!) < 0.001);
    assert.ok(Math.abs(top(shaft, 0, 1.2)! - 11.6) < 0.001);
    assert.ok(Math.abs(top(shaft, 0, 1.4)! - 4.6) < 0.001);
    const macro = part.python(part.defaults, 'assembled');
    assert.match(macro, /component_labels/);
    assert.match(macro, /11\.6D7/);
    assert.match(macro, /Part.makeBox\(4,2,7\.1/);
  } finally {
    disposeModel(group);
  }
});
