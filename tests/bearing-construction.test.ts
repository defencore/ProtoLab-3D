import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, Vector3 } from 'three';
import selfAligning from "../src/parts/self-aligning-bearing/part";
import spherical from "../src/parts/spherical-roller-bearing/part";
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

test('K and K30 bearings preserve the small-end bore and increase diameter by B/taper', () => {
  for (const part of [selfAligning, spherical])
    for (const boreType of part.parameters.find((field) => field.key === 'boreType')!.options!) {
      const p: Parameters = { ...part.defaults, boreType: boreType.value };
      assert.deepEqual(validateParameters(part, p, 'assembled'), []);
      const model = part.buildGeometry(p, 'assembled');
      try {
        const mesh = model.children[0] as Mesh;
        const positions = mesh.geometry.getAttribute('position');
        const ends = [-1, 1].map((side) => {
          const radii: number[] = [];
          for (let i = 0; i < positions.count; i++) {
            const point = new Vector3().fromBufferAttribute(positions, i);
            if (Math.abs(point.z - (side * Number(p.width)) / 2) < 1e-5)
              radii.push(Math.hypot(point.x, point.y));
          }
          return Math.min(...radii) * 2;
        });
        const taper = boreType.value === 'taper12' ? 12 : boreType.value === 'taper30' ? 30 : 0;
        assert.ok(Math.abs(ends[0] - Number(p.bore)) < 1e-4);
        assert.ok(
          Math.abs(ends[1] - Number(p.bore) - (taper ? Number(p.width) / taper : 0)) < 1e-4,
        );
      } finally {
        disposeModel(model);
      }
    }
  assert.ok(
    validateParameters(
      spherical,
      { ...spherical.defaults, bore: 40, outer: 42, width: 100, boreType: 'taper12' },
      'assembled',
    ).length,
  );
});

test('self-aligning 2RS closures add two separate seal envelopes in both states', () => {
  for (const state of ['assembled', 'exploded']) {
    const open = selfAligning.buildGeometry(selfAligning.defaults, state);
    const sealed = selfAligning.buildGeometry({ ...selfAligning.defaults, seals: 'rubber' }, state);
    try {
      assert.equal(sealed.children.length, open.children.length + 2);
      const seals = sealed.children.filter((mesh) => mesh.name === 'Contact seal envelope');
      assert.equal(seals.length, 2);
      assert.ok(seals[0].position.z < 0 && seals[1].position.z > 0);
    } finally {
      disposeModel(open);
      disposeModel(sealed);
    }
  }
});
