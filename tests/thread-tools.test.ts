import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/thread-tool/part';
import { values, radiusAt } from '../src/parts/thread-tool/lib/thread';
import { updateParameters } from '../src/parts/thread-tool/configurator';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';
function checkMesh(mesh: Mesh, label: string) {
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.index;
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
    const points = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
    );
    assert.ok(
      points.every((p) => p.toArray().every(Number.isFinite)),
      `${label}: finite vertices`,
    );
    assert.ok(
      points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq() > 1e-18,
      `${label}: nondegenerate triangles`,
    );
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    const keys = indices
      ? [0, 1, 2].map((j) => String(indices.getX(i + j)))
      : points.map((p) =>
          p
            .toArray()
            .map((v) => Math.round(v * 1e5))
            .join(','),
        );
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
  assert.ok(volume > 0, `${label}: positive outward volume`);
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, `${label}: closed oriented boundary`);
}

for (const preset of part.presets)
  for (const state of part.states!)
    test(`${preset.id}/${state.id}: valid closed Boolean tool`, () => {
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
      const model = part.buildGeometry(preset.parameters, state.id);
      try {
        assert.equal(model.children.length, 1);
        model.traverse((o) => {
          if (o instanceof Mesh) checkMesh(o, o.name);
        });
        const bounds = new Box3().setFromObject(model, true);
        const expected = part.dimensions(preset.parameters, state.id);
        bounds
          .getSize(new Vector3())
          .toArray()
          .forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 0.03));
        assert.equal(bounds.min.z, 0);
      } finally {
        disposeModel(model);
      }
    });
test('3/8-24 UNF preserves exact inch conversion in preview and macro', () => {
  const p = part.presets.find(
    (p) => p.parameters.family === 'unf' && p.parameters.diameter === 9.525,
  )!.parameters;
  assert.equal(p.tpi, 24);
  assert.equal(values(p, 'external').pitch, 25.4 / 24);
  assert.ok(generateScript(part, p, 'external').includes(`thread_pitch = ${25.4 / 24}`));
  assert.equal(part.presets.length, 79);
  assert.ok(part.presets.some((p) => p.parameters.diameter === 1 && p.parameters.pitch === 0.25));
  assert.ok(part.presets.some((p) => p.parameters.diameter === 2 && p.parameters.pitch === 0.4));
});
test('handedness, axial pitch and multi-start lead are consistent', () => {
  for (const state of ['external', 'internal'])
    for (const starts of [1, 2, 4]) {
      const p = { ...part.defaults, starts };
      const left = { ...p, handedness: 'left' };
      for (const angle of [0.37, 1.21, 2.68]) {
        const r = radiusAt(p, state, 0.43, angle);
        assert.ok(Math.abs(r - radiusAt(left, state, 0.43, -angle)) < 1e-12);
        assert.ok(Math.abs(r - radiusAt(p, state, 1.43, angle)) < 1e-12);
        assert.ok(Math.abs(r - radiusAt(p, state, 0.43, angle + (2 * Math.PI) / starts)) < 1e-12);
        assert.ok(
          Math.abs(r - radiusAt(p, state, 0.43 + starts * 0.2, angle + 2 * Math.PI * 0.2)) < 1e-12,
        );
      }
    }
});
test('internal cutter contains external thread; allowance is applied per radius', () => {
  for (let i = 0; i < 100; i++) {
    const angle = i * 0.1,
      z = i * 0.173;
    const external = radiusAt(part.defaults, 'external', z, angle);
    const internal = radiusAt(part.defaults, 'internal', z, angle);
    assert.ok(internal >= external - 1e-12);
    assert.ok(
      Math.abs(
        radiusAt({ ...part.defaults, clearance: 0.1 }, 'internal', z, angle) - internal - 0.1,
      ) < 1e-12,
    );
    assert.ok(
      Math.abs(
        radiusAt({ ...part.defaults, clearance: 0.1 }, 'external', z, angle) - external + 0.1,
      ) < 1e-12,
    );
  }
});
test('invalid cores, overlapping flanks and unsupported workloads cannot export', () => {
  for (const change of [
    { diameter: 0.5, pitch: 2 },
    { starts: 1.5 },
    { starts: 5 },
    { length: 0.1 },
    { length: 81 },
    { pitch: NaN },
    { family: 'custom', angle: 90, depth: 1 },
    { clearance: 3 },
  ] as Parameters[]) {
    const p = { ...part.defaults, ...change };
    assert.ok(validateParameters(part, p, 'external').length, JSON.stringify(change));
    assert.throws(() => generateScript(part, p, 'external'));
  }
});
test('switching pitch units preserves physical geometry', () => {
  const tpi = updateParameters({ ...part.defaults, pitch: 0.8, pitchUnit: 'tpi' }, 'pitchUnit');
  assert.equal(tpi.tpi, 31.749999999999996);
  const mm = updateParameters({ ...tpi, pitchUnit: 'mm' }, 'pitchUnit');
  assert.ok(Math.abs(Number(mm.pitch) - 0.8) < 1e-12);
  const custom = updateParameters({ ...tpi, tpi: 24 }, 'tpi');
  assert.equal(custom.pitch, 25.4 / 24);
});
