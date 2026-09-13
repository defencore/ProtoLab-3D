import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Vector3 } from 'three';
import part, { zarnReferenceDimensions } from "../src/parts/zarn-bearing/part";
import { withSupplierPresets } from '../src/catalog/supplier-presets';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

const sizes = [
  [20, 52, 46],
  [30, 62, 50],
  [35, 70, 54],
  [40, 75, 54],
  [50, 90, 60],
];
const cases: { id: string; parameters: Parameters }[] = sizes.map(([bore, outer, width]) => ({
  id: `ZARN${bore}${outer}`,
  parameters: { ...part.defaults, ...zarnReferenceDimensions(bore)!, bore, outer, width },
}));

test('ZARN source boundaries and imported dimensions validate in each state', () => {
  for (const configuration of [...cases, ...withSupplierPresets(part).presets])
    for (const state of part.states!)
      assert.deepEqual(
        validateParameters(part, configuration.parameters, state.id),
        [],
        `${configuration.id}/${state.id}`,
      );
  const invalid: Parameters[] = [
    { washerDiameter: 18 },
    { outerWidth: 40 },
    { shoulderSpan: 10 },
    { axialRollers: 50 },
    { needles: 80 },
  ];
  for (const patch of invalid)
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length > 0);
  assert.deepEqual(zarnReferenceDimensions(40), {
    shoulderSpan: 37,
    outerWidth: 20,
    washerDiameter: 65,
    washerThickness: 11,
  });
});

test('ZARN has radial needles, two thrust rows, an open bore and closed component shells', () => {
  for (const configuration of cases)
    for (const state of part.states!) {
      const p = configuration.parameters,
        label = `${configuration.id}/${state.id}`,
        model = part.buildGeometry(p, state.id);
      assert.equal(
        model.children.filter((child) => child.name === 'Radial needle').length,
        p.needles,
      );
      assert.equal(
        model.children.filter((child) => child.name === 'Axial cylindrical roller').length,
        Number(p.axialRollers) * 2,
      );
      assert.equal(model.children.filter((child) => child.name === 'Axial roller cage').length, 2);
      if (state.id === 'assembled') {
        const bounds = part.dimensions(p, state.id);
        [p.outer, p.outer, p.width].forEach((size, axis) =>
          assert.ok(Math.abs(bounds[axis] - Number(size)) < 1e-5, label),
        );
      }
      model.updateMatrixWorld(true);
      for (const child of model.children) {
        const mesh = child as Mesh,
          position = mesh.geometry.getAttribute('position'),
          index = mesh.geometry.getIndex(),
          edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < (index?.count ?? position.count); i += 3) {
          const [a, b, c] = [0, 1, 2].map((j) =>
            new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
          );
          assert.ok(
            b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18,
            `${label}/${child.name}: nondegenerate`,
          );
          volume += a.dot(b.clone().cross(c)) / 6;
          for (const point of [a, b, c]) {
            const world = point.clone().applyMatrix4(mesh.matrixWorld);
            assert.ok(
              Math.hypot(world.x, world.y) > Number(p.bore) / 2 - 1e-5,
              `${label}: unobstructed bore`,
            );
          }
          const ids = [a, b, c].map((point) =>
            point
              .toArray()
              .map((value) => Math.round(value * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const key = [ids[j], ids[(j + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, `${label}/${child.name}: outward shell`);
        for (const count of edges.values())
          assert.equal(count, 2, `${label}/${child.name}: closed shell`);
      }
      disposeModel(model);
    }
});
