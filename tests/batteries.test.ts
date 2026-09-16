import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import lipo from '../src/parts/lipo-battery/part';
import liion from '../src/parts/li-ion-cell/part';
import standard from '../src/parts/standard-battery/part';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
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

for (const part of [lipo, liion, standard])
  for (const preset of part.presets)
    test(`${part.id}/${preset.id}: source envelope, closed external components`, () => {
      assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), []);
      assert.ok(part.validate({ ...preset.parameters, height: 10 }, 'assembled').length);
      const model = part.buildGeometry(preset.parameters, 'assembled');
      try {
        model.traverse((o) => {
          if (o instanceof Mesh) checkMesh(o, o.name);
        });
        const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
        const a = preset.catalog!.attributes!;
        const expected = [a.width, a.length, a.height] as number[];
        actual.forEach((v, i) =>
          assert.ok(Math.abs(v - expected[i]) < 0.02, `${actual} versus ${expected}`),
        );
        part
          .dimensions(preset.parameters, 'assembled')
          .forEach((v, i) => assert.ok(Math.abs(v - actual[i]) < 0.02));
      } finally {
        disposeModel(model);
      }
    });
test('battery catalog separates C-rate derived current, capacity and missing ratings', () => {
  assert.equal(lipo.presets.length, 15);
  assert.equal(liion.presets.length, 6);
  assert.equal(standard.presets.length, 8);
  assert.deepEqual(
    [...new Set(lipo.presets.map((p) => p.catalog!.attributes!.cells))].sort(),
    [1, 2, 3, 4],
  );
  for (const p of lipo.presets) {
    const a = p.catalog!.attributes!;
    assert.ok(Math.abs(Number(a.current) - (Number(a.capacity) * Number(a.cRate)) / 1000) < 1e-8);
    assert.match(p.catalog!.attributeConditions!.current, /Derived/);
  }
  const coin = standard.presets.find((p) => p.id === 'energizer-cr2032')!.catalog!;
  assert.equal(coin.attributes!.capacity, 235);
  assert.equal(coin.attributes!.current, undefined);
  const aa = standard.presets.find((p) => p.id === 'energizer-e91')!.catalog!;
  assert.equal(aa.attributes!.capacity, undefined);
  assert.equal(aa.attributes!.current, undefined);
  assert.equal(
    standard.presets.find((p) => p.id === 'energizer-123')!.catalog!.attributes!.current,
    1.5,
  );
  for (const part of [lipo, liion, standard])
    for (const p of part.presets) {
      assert.equal(p.catalog!.geometryEvidence!.kind, 'source-dimensions');
      assert.ok(p.catalog!.geometryEvidence!.limitations.length > 50);
      for (const key of Object.keys(p.catalog!.attributes!))
        assert.ok(
          part.catalogFilterFields!.some((f) => f.key === key),
          key,
        );
    }
});
