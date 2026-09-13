import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Vector3 } from 'three';
import part, { cskKeyDimensions } from "../src/parts/csk-clutch/part";
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { withSupplierPresets } from '../src/catalog/supplier-presets';
import type { Parameters } from '../src/core/types';

export const cskTestConfigurations: { id: string; parameters: Parameters }[] = [
  ['CSK8', 8, 22, 9, 'none', 'open'],
  ['CSK12P', 12, 32, 10, 'P', 'open'],
  ['CSK17PP', 17, 40, 12, 'PP', 'open'],
  ['CSK20P2RS', 20, 47, 19, 'P', 'rubber'],
  ['CSK35PP', 35, 72, 17, 'PP', 'open'],
  ['CSK40PP', 40, 80, 22, 'PP', 'open'],
].map(([id, bore, outer, width, keyways, seals]) => ({
  id: String(id),
  parameters: {
    ...part.defaults,
    ...cskKeyDimensions(Number(bore)),
    bore: Number(bore),
    outer: Number(outer),
    width: Number(width),
    keyways,
    seals,
  },
}));

test('CSK mounting variants and internal rows validate at source size boundaries', () => {
  for (const configuration of [...cskTestConfigurations, ...withSupplierPresets(part).presets]) {
    for (const state of part.states!)
      assert.deepEqual(
        validateParameters(part, configuration.parameters, state.id),
        [],
        `${configuration.id}/${state.id}`,
      );
  }
  assert.deepEqual(cskKeyDimensions(35), {
    innerKeyWidth: 10,
    innerKeyDepth: 2.4,
    outerKeyWidth: 8,
    outerKeyDepth: 2.5,
  });
  assert.ok(
    validateParameters(part, { ...part.defaults, innerKeyDepth: 6 }, 'assembled').length > 0,
  );
  assert.ok(
    validateParameters(part, { ...part.defaults, outerKeyDepth: 6 }, 'assembled').length > 0,
  );
  assert.ok(validateParameters(part, { ...part.defaults, sprags: 60 }, 'assembled').length > 0);
});

test('CSK races, cages, balls and cams have separate closed outward shells', () => {
  for (const { id, parameters } of cskTestConfigurations)
    for (const state of part.states!) {
      const label = `${id}/${state.id}`,
        model = part.buildGeometry(parameters, state.id);
      const bounds = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
      part
        .dimensions(parameters, state.id)
        .forEach((size, axis) => assert.ok(Math.abs(bounds[axis] - size) < 1e-5, label));
      assert.equal(
        model.children.filter((child) => child.name === 'Bearing ball').length,
        parameters.balls,
      );
      assert.equal(
        model.children.filter((child) => child.name === 'Asymmetric sprag cam').length,
        parameters.sprags,
      );
      for (const child of model.children) {
        const mesh = child as Mesh,
          position = mesh.geometry.getAttribute('position'),
          index = mesh.geometry.getIndex();
        const edges = new Map<string, number>();
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
        assert.ok(volume > 0, `${label}/${child.name}: positive volume`);
        for (const count of edges.values())
          assert.equal(count, 2, `${label}/${child.name}: closed shell`);
      }
      disposeModel(model);
    }
});
