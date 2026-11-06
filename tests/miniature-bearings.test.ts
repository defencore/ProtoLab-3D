import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import ballModule from '../src/parts/ball-bearing';
import flangedModule from '../src/parts/flanged-ball-bearing';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { registerPartModules } from '../src/core/part-modules';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
} from '../src/core/preset-search';

const ball = ballModule.part,
  flanged = flangedModule.part;
const radial = ball.presets.filter((preset) => preset.id.startsWith('aliexpress-miniature-'));
const requested =
  '1x3x1 2x5x2.5 2x6x2.5 2x7x3 3x6x2.5 3x7x3 3x8x3 3x8x4 3x9x4 3x9x5 3x10x4 3x13x5 4x7x2.5 4x8x2 4x8x3 4x9x4 4x10x4 4x11x4 4x12x4 5x8x2.5 5x9x3 5x10x4 5x11x4 5x13x4 5x14x5 5x16x5 5x19x6 6x10x3 6x12x4 6x13x5 6x15x5 6x17x6 6x19x6 6x22x7 7x11x3 7x13x4 7x14x5 7x17x5 7x19x6'.split(
    ' ',
  );

test('every requested miniature size is selectable without conflating distinct widths', () => {
  registerPartModules([ballModule, flangedModule]);
  assert.equal(radial.length, requested.length);
  assert.deepEqual(
    radial.map(({ parameters: p }) => `${p.bore}x${p.outer}x${p.width}`),
    requested,
  );
  const index = buildPresetIndex([{ ...ball, presets: radial }]);
  for (const preset of radial) {
    const filters = Object.fromEntries(
      ['bore', 'outer', 'width'].map((key) => {
        const field = ball.parameters.find((p) => p.key === key)!;
        return [
          fieldId(field),
          { min: String(preset.parameters[key]), max: String(preset.parameters[key]) },
        ];
      }),
    );
    const result = filterPresets(index, { ...emptyPresetFilters(ball), parameters: filters });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(
      result.items.map((item) => item.preset.id),
      [preset.id],
    );
    assert.deepEqual(preset.catalog?.verifiedParameters, ['bore', 'outer', 'width']);
  }
});

test('all eight requested flanged models retain their dimensions and two rubber seals', () => {
  assert.deepEqual(
    flanged.presets.filter(p=>p.id.endsWith('-2rs')).map((p) => p.name.split(' · ')[0]),
    [
      'F623-2RS',
      'F686-2RS',
      'F688-2RS',
      'F689-2RS',
      'F695-2RS',
      'F696-2RS',
      'F698-2RS',
      'F608-2RS',
    ],
  );
  assert.deepEqual(
    flanged.presets.filter(p=>p.id.endsWith('-2rs')).map(({ parameters: p }) => [p.bore, p.outer, p.width]),
    [
      [3, 10, 4],
      [6, 13, 5],
      [8, 16, 5],
      [9, 17, 5],
      [5, 13, 4],
      [6, 15, 5],
      [8, 19, 6],
      [8, 22, 7],
    ],
  );
  for (const preset of flanged.presets.filter(p=>p.id.endsWith('-2rs'))) {
    assert.equal(preset.parameters.seals, 'rubber');
    assert.ok(!preset.catalog?.verifiedParameters.includes('flangeOuter'));
    assert.ok(!preset.catalog?.verifiedParameters.includes('flangeWidth'));
    const field = flanged.parameters.find((p) => p.key === 'flangeOuter')!;
    const result = filterPresets(buildPresetIndex([flanged]), {
      ...emptyPresetFilters(flanged),
      parameters: {
        [fieldId(field)]: {
          min: String(preset.parameters.flangeOuter),
          max: String(preset.parameters.flangeOuter),
        },
      },
    });
    assert.equal(
      result.items.length,
      0,
      'Independent manufacturer dimensions cannot qualify seller-source filters.',
    );
  }
});

test('all 47 miniature options validate and reproduce their installation envelope in both poses', () => {
  for (const [part, presets] of [
    [ball, radial],
    [flanged, flanged.presets],
  ] as const)
    for (const preset of presets)
      for (const state of ['assembled', 'exploded']) {
        assert.deepEqual(
          validateParameters(part, preset.parameters, state),
          [],
          `${preset.id}/${state}`,
        );
        const model = part.buildGeometry(preset.parameters, state);
        try {
          const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
          part
            .dimensions(preset.parameters, state)
            .forEach((value, axis) =>
              assert.ok(
                Math.abs(value - actual[axis]) < 1e-4,
                `${preset.id}/${state}: ${actual} vs ${part.dimensions(preset.parameters, state)}`,
              ),
            );
          model.traverse((child) => {
            if (child instanceof Mesh)
              for (const value of child.geometry.getAttribute('position').array)
                assert.ok(Number.isFinite(value));
          });
        } finally {
          disposeModel(model);
        }
      }
});

test('locating flange occupies only the terminal shoulder within overall width', () => {
  for (const preset of flanged.presets.filter(p=>p.id.endsWith('-2rs'))) {
    const p = preset.parameters,
      model = flanged.buildGeometry(p, 'assembled');
    try {
      const outer = model.getObjectByName('Flanged outer ring') as Mesh;
      const positions = outer.geometry.getAttribute('position');
      let shoulder = false,
        body = false;
      for (let i = 0; i < positions.count; i++) {
        const radius = Math.hypot(positions.getX(i), positions.getY(i));
        const z = positions.getZ(i);
        if (radius > Number(p.outer) / 2 + 1e-5) {
          assert.ok(z >= Number(p.width) / 2 - Number(p.flangeWidth) - 1e-5);
          shoulder = true;
        }
        if (Math.abs(radius - Number(p.outer) / 2) < 1e-5 && z < 0) body = true;
      }
      assert.ok(shoulder && body);
      const script = flanged.python(p, 'assembled');
      assert.match(script, /Flanged outer ring/);
      assert.match(script, /Front seal/);
      assert.match(script, /Rear seal/);
    } finally {
      disposeModel(model);
    }
  }
  assert.ok(
    validateParameters(
      flanged,
      { ...flanged.defaults, flangeOuter: flanged.defaults.outer },
      'assembled',
    ).length,
  );
  assert.ok(
    validateParameters(
      flanged,
      { ...flanged.defaults, flangeWidth: flanged.defaults.width },
      'assembled',
    ).length,
  );
});

test('every flanged bearing catalog name includes its complete installation size',()=>{
  for(const preset of flanged.presets) {
    const p=preset.parameters;
    assert.ok(preset.name.endsWith(`${p.bore}×${p.outer}×${p.width} mm`),preset.name);
  }
});
