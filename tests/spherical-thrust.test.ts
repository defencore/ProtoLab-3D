import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from "../src/parts/spherical-thrust-bearing/part";
import { sphericalThrustValues } from "../src/parts/spherical-thrust-bearing/lib/parts/spherical-thrust-geometry";
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

test('spherical thrust washers, inclined rollers and cage are closed outward components in both states', () => {
  for (const preset of part.presets)
    for (const state of part.states!) {
      const p = preset.parameters,
        model = part.buildGeometry(p, state.id),
        v = sphericalThrustValues(p);
      assert.deepEqual(validateParameters(part, p, state.id), []);
      try {
        const bounds = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
        part
          .dimensions(p, state.id)
          .forEach((d, axis) => assert.ok(Math.abs(bounds[axis] - d) < 0.025));
        assert.equal(model.children.length, v.count + 3);
        model.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          const positions = child.geometry.getAttribute('position'),
            index = child.geometry.getIndex(),
            edges = new Map<string, number>();
          let volume = 0;
          for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
            const points = [i, i + 1, i + 2].map((j) =>
              new Vector3().fromBufferAttribute(positions, index ? index.getX(j) : j),
            );
            assert.ok(points.every((p) => p.toArray().every(Number.isFinite)));
            assert.ok(
              points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length() >
                1e-9,
            );
            volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
            const keys = points.map((p) =>
              p
                .toArray()
                .map((n) => Math.round(n * 1e5))
                .join(','),
            );
            for (let side = 0; side < 3; side++) {
              const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
              edges.set(key, (edges.get(key) ?? 0) + 1);
            }
          }
          assert.ok(volume > 0, child.name);
          for (const count of edges.values()) assert.equal(count, 2, child.name);
        });
        const roller = model.children[3],
          axis = new Vector3(0, 0, 1).applyQuaternion(roller.quaternion);
        assert.ok(Math.abs(axis.z - Math.sin(v.angle)) < 1e-9);
        assert.ok(v.seat(v.pitch + 1) > v.seat(v.pitch));
      } finally {
        disposeModel(model);
      }
    }
});

test('spherical thrust rejects crowded cages and a roller row outside the mounting faces', () => {
  assert.ok(
    validateParameters(part, { ...part.defaults, elements: 64 }, 'assembled').some((e) =>
      e.includes('Too many'),
    ),
  );
  assert.ok(validateParameters(part, { ...part.defaults, width: 4 }, 'assembled').length);
  assert.ok(validateParameters(part, { ...part.defaults, bore: 155 }, 'assembled').length);
});
