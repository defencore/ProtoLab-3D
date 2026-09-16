import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import manifest from '../data/library-expansion.json';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
const filter = process.env.PART_FILTER?.split(',');
const selections = parts.filter(
  (p) => manifest.parts.some((m) => m.id === p.id) && (!filter || filter.includes(p.id)),
);
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
    const keys =
      mesh.geometry.userData.nativeTopology && indices
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

for (const part of selections) {
  test(`${part.id}: presets validate and carry evidence appropriate to their fidelity`, () => {
    for (const preset of part.presets) {
      if (part.id === 'electrical-connector') {
        assert.equal(preset.catalog?.geometryEvidence?.kind, 'source-dimensions');
        assert.ok(preset.catalog?.sourceUrl?.startsWith('https://www.china-amass'));
      } else assert.equal(preset.catalog, undefined);
      assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), [], preset.id);
    }
    assert.ok(validateParameters(part, part.defaults, 'unknown').length);
    for (const field of part.parameters.filter((f) => f.type === 'number')) {
      assert.ok(
        validateParameters(part, { ...part.defaults, [field.key]: NaN }, 'assembled').length,
      );
    }
  });
  for (const preset of part.presets)
    for (const detail of part.parameters.some((p) => p.key === 'detail')
      ? ['envelope', 'detailed']
      : ['envelope']) {
      test(`${part.id}/${preset.id}/${detail}: closed preview solids match displayed dimensions`, () => {
        const p = {
          ...preset.parameters,
          ...(part.parameters.some((p) => p.key === 'detail') ? { detail } : {}),
        };
        const model = part.buildGeometry(p, 'assembled');
        try {
          assert.ok(model.children.length > 0 && model.children.length <= 24);
          model.traverse((o) => {
            if (o instanceof Mesh) checkMesh(o, `${part.id}/${preset.id}/${o.name}`);
          });
          const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
          part
            .dimensions(p, 'assembled')
            .forEach((v, i) => assert.ok(Math.abs(v - actual[i]) < 0.02));
        } finally {
          disposeModel(model);
        }
      });
    }
}

for (const part of selections.filter((part) =>
  part.states?.some((state) => state.id === 'internals'),
))
  for (const preset of part.presets)
    test(`${part.id}/${preset.id}: internal inspection retains closed physical components`, () => {
      const model = part.buildGeometry(preset.parameters, 'internals');
      try {
        assert.deepEqual(validateParameters(part, preset.parameters, 'internals'), []);
        model.traverse((object) => {
          if (object instanceof Mesh) checkMesh(object, `${part.id}/${preset.id}/${object.name}`);
        });
      } finally {
        disposeModel(model);
      }
    });
