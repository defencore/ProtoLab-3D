import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Vector3 } from 'three';
import linear from "../src/parts/linear-bearing/part";
import flanged from "../src/parts/flanged-linear-bearing/part";
import { lmkReference } from '../src/catalog/lmk-reference';
import { validateParameters } from '../src/core/validation';
for (const part of [linear, flanged])
  test(`${part.id}: ball circuits and stock boundary shells are closed in assembly and cutaway`, () => {
    for (const bore of [6, 8, 16, 60])
      for (const state of ['assembled', 'cutaway']) {
        const parameters = {
          ...part.defaults,
          ...(part.id === flanged.id ? lmkReference[bore] : {}),
          bore,
          outer: Number(lmkReference[bore].outer),
          width: bore === 60 ? 110 : bore === 16 ? 37 : 24,
          circuits: bore < 16 ? 4 : bore < 25 ? 5 : 6,
        };
        assert.deepEqual(validateParameters(part, parameters, state), []);
        const group = part.buildGeometry(parameters, state);
        const size = new Box3().setFromObject(group).getSize(new Vector3()).toArray();
        size.forEach((value, i) =>
          assert.ok(
            Math.abs(value - part.dimensions(parameters, state)[i]) < 0.002,
            `${part.id}/${bore}/${state}: axis${i} ${value}`,
          ),
        );
        assert.ok(
          group.children.filter((c) => c.name.startsWith('Recirculating ball')).length > 30,
        );
        group.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          const p = child.geometry.getAttribute('position'),
            idx = child.geometry.index?.array ?? Array.from({ length: p.count }, (_, i) => i),
            edges = new Map<string, number>();
          let volume = 0;
          for (let i = 0; i < idx.length; i += 3) {
            const [a, b, c] = [0, 1, 2].map((j) =>
              new Vector3().fromBufferAttribute(p, idx[i + j]),
            );
            assert.ok(
              b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18,
              `${part.id}/${bore}/${state}/${child.name}: degenerate face`,
            );
            volume += a.dot(b.clone().cross(c)) / 6;
            const points = [a, b, c].map((v) =>
              v
                .toArray()
                .map((x) => Math.round(x * 1e5))
                .join(','),
            );
            for (let j = 0; j < 3; j++) {
              const edge = [points[j], points[(j + 1) % 3]].sort().join('|');
              edges.set(edge, (edges.get(edge) ?? 0) + 1);
            }
          }
          assert.ok(volume > 0, `${child.name}: orientation`);
          for (const [edge, count] of edges)
            assert.equal(count, 2, `${part.id}/${bore}/${state}/${child.name}: ${edge}`);
          child.geometry.dispose();
          (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) =>
            m.dispose(),
          );
        });
      }
  });
