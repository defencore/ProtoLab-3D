import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/aluminium-profile/part';
import { profileDefaults } from '../src/parts/aluminium-profile/configurator';
import { aluminiumProfileReferences } from '../src/parts/aluminium-profile/lib/catalog';
import { profileSection } from '../src/parts/aluminium-profile/lib/geometry';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

function solidVolume(mesh: Mesh): number {
  const p = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index;
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const vertices = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j),
    );
    const keys = vertices.map((v) =>
      v
        .toArray()
        .map((c) => Math.round(c * 1e5))
        .join(','),
    );
    assert.equal(new Set(keys).size, 3, 'No collapsed triangles');
    volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3],
        key = [a, b].sort().join('|');
      const edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, 'Closed, consistently wound exterior');
  assert.ok(volume > 0);
  return volume;
}
test('eight supplied sections preserve source dimensions and distinguish offered lengths', () => {
  assert.equal(aluminiumProfileReferences.length, 8);
  assert.equal(part.presets.length, 48);
  for (const row of aluminiumProfileReferences) {
    const presets = part.presets.filter((preset) => preset.parameters.profile === row.id);
    assert.deepEqual(
      presets.map((preset) => preset.parameters.length),
      row.stockLengths ?? [100],
    );
    for (const preset of presets) {
      assert.deepEqual(validateParameters(part, preset.parameters, 'default'), [], preset.id);
      assert.equal(preset.parameters.width, row.width);
      assert.equal(preset.parameters.height, row.height);
      assert.equal(preset.catalog!.verifiedParameters.includes('length'), !!row.stockLengths);
      for (const key of [
        'slotFloorWidth',
        'boreSpacing',
        'boreHeight',
        'centerVoidWidth',
        'centerVoidHeight',
      ])
        assert.ok(
          !preset.catalog!.verifiedParameters.includes(key),
          preset.id + ': unlisted internal dimension',
        );
    }
  }
  assert.deepEqual(
    part.presets.find((preset) => preset.parameters.profile === 'gb1020h')!.catalog!
      .parameterRanges,
    { width: { min: 19.8, max: 20.2 }, sideOpening: { min: 4.3, max: 4.7 } },
  );
});

test('every section is one closed extrusion with genuinely open longitudinal bores and cavities', () => {
  for (const row of aluminiumProfileReferences) {
    const p = profileDefaults(row.id, 50),
      model = part.buildGeometry(p, 'default');
    const longer = part.buildGeometry({ ...p, length: 125 }, 'default');
    try {
      model.updateMatrixWorld(true);
      longer.updateMatrixWorld(true);
      assert.equal(model.children.length, 1);
      const volume = solidVolume(model.children[0] as Mesh),
        longVolume = solidVolume(longer.children[0] as Mesh);
      assert.ok(Math.abs(longVolume / volume - 2.5) < 1e-6, row.id + ': true linear extrusion');
      const bounds = new Box3().setFromObject(model).getSize(new Vector3());
      for (const [actual, expected] of [
        [bounds.x, row.width],
        [bounds.y, row.height],
        [bounds.z, 50],
      ])
        assert.ok(Math.abs(actual - expected) < 1e-5, row.id + ': envelope');
      const section = profileSection(p),
        holes = [
          ...section.bores.map((bore) => bore.center),
          ...section.holes.map((points) =>
            points.reduce(
              (sum, point) => [
                sum[0] + point[0] / points.length,
                sum[1] + point[1] / points.length,
              ],
              [0, 0],
            ),
          ),
        ];
      for (const [x, y] of holes) {
        const ray = new Raycaster(new Vector3(x, y, 100), new Vector3(0, 0, -1));
        assert.equal(
          ray.intersectObject(model, true).length,
          0,
          row.id + ': bore/cavity runs through full length',
        );
      }
      const expectedHoles: Record<string, number> = {
        eu1020: 2,
        eu1030: 0,
        eu1040: 3,
        eu1050: 1,
        '2020': 1,
        '2040': 3,
        gb1020h: 1,
        eu1540: 2,
      };
      assert.equal(holes.length, expectedHoles[row.id]);
    } finally {
      disposeModel(model);
      disposeModel(longer);
    }
  }
});

test('slot openings remain open while the undercut lips retain material', () => {
  for (const row of aluminiumProfileReferences) {
    const p = profileDefaults(row.id, 50),
      model = part.buildGeometry(p, 'default');
    model.updateMatrixWorld(true);
    const ray = (x: number, y: number) =>
      new Raycaster(new Vector3(x, y, 100), new Vector3(0, 0, -1)).intersectObject(model, true);
    try {
      if (row.id !== 'gb1020h') {
        const centers = ['eu1040', 'eu1050', '2040'].includes(row.id)
          ? [-Number(p.slotPitch) / 2, Number(p.slotPitch) / 2]
          : [0];
        for (const x of centers) {
          assert.equal(ray(x, row.height / 2 - 0.2).length, 0, row.id + ': open top slot');
          assert.ok(
            ray(
              x + Number(p.slotCavityWidth) / 2 - 0.1,
              row.height / 2 - Number(p.lipThickness) / 2,
            ).length,
            row.id + ': solid lip',
          );
          assert.equal(
            ray(
              x + Number(p.slotCavityWidth) / 2 - 0.1,
              row.height / 2 - Number(p.lipThickness) - 0.1,
            ).length,
            0,
            row.id + ': undercut behind lip',
          );
        }
      }
      if (['eu1030', 'eu1050', 'gb1020h', '2020', '2040', 'eu1540'].includes(row.id))
        for (const side of [-1, 1])
          assert.equal(
            ray(side * (row.width / 2 - 0.2), 0.123).length,
            0,
            row.id + ': open side slot',
          );
    } finally {
      disposeModel(model);
    }
  }
});

test('section changes retain cut length and invalid intersecting cavities are rejected', () => {
  const selected = part.updateParameters!(
    { ...part.defaults, profile: 'eu1030', length: 375 },
    'profile',
  );
  assert.equal(selected.length, 375);
  assert.equal(selected.width, 29.8);
  assert.equal(selected.height, 9.9);
  assert.equal(selected.boreDiameter, 0);
  assert.deepEqual(validateParameters(part, selected, 'default'), []);
  const invalid: Parameters[] = [
    { boreDiameter: 15 },
    { slotDepth: 9.9 },
    { slotCavityWidth: 19 },
    { cornerRadius: 6 },
  ];
  for (const patch of invalid)
    assert.ok(
      validateParameters(part, { ...part.defaults, ...patch }, 'default').length,
      JSON.stringify(patch),
    );
  const wide = profileDefaults('2040');
  assert.ok(validateParameters(part, { ...wide, centerVoidWidth: 35 }, 'default').length);
  const web =
    Math.SQRT2 *
    (Number(wide.height) / 2 - Number(wide.slotDepth) - Number(wide.slotFloorWidth) / 2);
  assert.ok(Math.abs(web - 1.5) < 1e-10, '2040 diagonal web matches drawing');
});
