import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part from "../src/parts/round-flange-linear-bearing/part";
import { lmkReference } from '../src/catalog/lmk-reference';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

test('LMF circular flanges retain four clear holes and manifold ball circuits at short and long limits', () => {
  for (const [bore, width] of [
    [6, 19],
    [8, 45],
    [16, 37],
    [25, 112],
    [60, 211],
  ]) {
    const parameters = Object.fromEntries(
      Object.entries({ ...lmkReference[bore], width }).filter(([key]) => key !== 'flangeWidth'),
    );
    for (const state of ['assembled', 'cutaway']) {
      assert.deepEqual(validateParameters(part, parameters, state), []);
      const model = part.buildGeometry(parameters, state);
      try {
        const size = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
        part
          .dimensions(parameters, state)
          .forEach((value, axis) => assert.ok(Math.abs(size[axis] - value) < 0.005));
        assert.ok(
          model.children.filter((child) => child.name.startsWith('Recirculating ball')).length > 30,
        );
        model.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          const geometry = child.geometry,
            positions = geometry.getAttribute('position'),
            index = geometry.index;
          let volume = 0;
          const edges = new Map<string, number>();
          for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
            const vertices = [i, i + 1, i + 2].map((j) =>
              new Vector3().fromBufferAttribute(positions, index ? index.getX(j) : j),
            );
            assert.ok(vertices.every((v) => v.toArray().every(Number.isFinite)));
            assert.ok(
              vertices[1]
                .clone()
                .sub(vertices[0])
                .cross(vertices[2].clone().sub(vertices[0]))
                .lengthSq() > 1e-18,
            );
            volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
            const keys = vertices.map((v) =>
              v
                .toArray()
                .map((n) => Math.round(n * 1e5))
                .join(','),
            );
            for (let j = 0; j < 3; j++) {
              const edge = [keys[j], keys[(j + 1) % 3]].sort().join('|');
              edges.set(edge, (edges.get(edge) ?? 0) + 1);
            }
          }
          assert.ok(volume > 0, child.name + ' outward winding');
          for (const count of edges.values())
            assert.equal(count, 2, child.name + ' manifold edges');
        });
        if (state === 'assembled') {
          const steel = model.children[0],
            ray = new Raycaster();
          for (const angle of [
            Math.PI / 4,
            (Math.PI * 3) / 4,
            (Math.PI * 5) / 4,
            (Math.PI * 7) / 4,
          ]) {
            const radius = Number(parameters.boltCircle) / 2;
            ray.set(
              new Vector3(radius * Math.cos(angle), radius * Math.sin(angle), -width),
              new Vector3(0, 0, 1),
            );
            assert.equal(
              ray.intersectObject(steel, true).length,
              0,
              'Each mounting bore must pass through the flange.',
            );
          }
          ray.set(new Vector3(Number(parameters.boltCircle) / 2, 0, -width), new Vector3(0, 0, 1));
          assert.ok(
            ray.intersectObject(steel, true).length > 0,
            'Steel must remain between the mounting holes.',
          );
        }
      } finally {
        disposeModel(model);
      }
    }
  }
});

test('LMF exposes circular mounting dimensions and rejects intersecting counterbores', () => {
  assert.ok(!part.parameters.some((field) => field.key === 'flangeWidth'));
  assert.ok(!Object.hasOwn(part.defaults, 'flangeWidth'));
  assert.ok(validateParameters(part, { ...part.defaults, boltCircle: 32 }, 'assembled').length);
  assert.ok(validateParameters(part, { ...part.defaults, flangeDiameter: 40 }, 'assembled').length);
  assert.ok(validateParameters(part, { ...part.defaults, counterDepth: 6 }, 'assembled').length);
  assert.ok(validateParameters(part, { ...part.defaults, circuits: 4.5 }, 'assembled').length);
});
