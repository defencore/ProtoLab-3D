import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
const ids = ['aircraft-airframe', 'model-rocket-airframe', 'boat-hull', 'multicopter-frame'];
const selections = parts.filter((p) => ids.includes(p.id));
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

test('four vehicle families include sourced references and editable design presets', () => {
  assert.equal(selections.length, 4);
  for (const part of selections) {
    assert.ok(part.presets.filter((p) => p.catalog).length >= 2);
    assert.ok(part.presets.filter((p) => !p.catalog).length >= 2);
    assert.equal(part.catalogSelectionOnly, undefined);
    for (const preset of part.presets) {
      assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), [], preset.id);
      if (preset.catalog) {
        assert.equal(preset.catalog.geometryEvidence?.kind, 'envelope');
        assert.ok(preset.catalog.verifiedParameters.length);
      }
    }
  }
});
for (const part of selections)
  for (const preset of [
    ...part.presets,
    ...part.presets
      .filter((p) => part.id === 'multicopter-frame' && p.id.startsWith('layout-'))
      .map((p) => ({
        ...p,
        id: p.id + '-tube',
        parameters: { ...p.parameters, armStyle: 'tube' },
      })),
  ])
    for (const state of part.states!) {
      test(`${part.id}/${preset.id}/${state.id}: lightweight closed geometry and dimensions`, () => {
        const model = part.buildGeometry(preset.parameters, state.id);
        try {
          assert.ok(model.children.length > 0 && model.children.length < 30);
          model.traverse((o) => {
            if (o instanceof Mesh) checkMesh(o, `${preset.id}/${o.name}`);
          });
          const bounds = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
          const expected = part.dimensions(preset.parameters, state.id);
          for (let i = 0; i < 3; i++) assert.ok(Math.abs(bounds[i] - expected[i]) < 0.02);
          assert.match(part.python(preset.parameters, state.id), /component_labels/);
        } finally {
          disposeModel(model);
        }
      });
    }
test('impossible shells and mounting geometry are rejected', () => {
  for (const part of selections) {
    assert.ok(validateParameters(part, part.defaults, 'unknown').length);
    const bad =
      part.id === 'multicopter-frame'
        ? { ...part.defaults, stackPitch: 300 }
        : { ...part.defaults, wall: 100 };
    assert.ok(validateParameters(part, bad, 'assembled').length);
  }
});
