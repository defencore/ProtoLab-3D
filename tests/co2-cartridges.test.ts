import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/co2-cartridge/part';
import models from '../src/parts/co2-cartridge/lib/models.json';
import { dimensions, threadRadius } from '../src/parts/co2-cartridge/lib/model';
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
  test(`${preset.id}: source envelope and closed mesh`, () => {
    const p = preset.parameters;
    assert.deepEqual(validateParameters(part, p, 'sealed'), []);
    const v = dimensions(p),
      g = part.buildGeometry(p, 'sealed');
    try {
      assert.equal(g.children.length, 1);
      g.traverse((o) => {
        if (o instanceof Mesh) checkMesh(o, o.name);
      });
      const bounds = new Box3().setFromObject(g, true);
      bounds
        .getSize(new Vector3())
        .toArray()
        .forEach((x, i) => assert.ok(Math.abs(x - part.dimensions(p, 'sealed')[i]) < 1e-4));
      assert.equal(bounds.min.z, 0);
      for (const key of ['length', 'diameter', 'neckDiameter', 'neckLength'] as const)
        assert.ok(Math.abs(v.m[key] - v.m.sourceInches[key] * 25.4) < 1e-8);
      assert.equal(preset.catalog!.attributes!.gasMass, v.m.gasMass);
      if (v.pitch) {
        assert.equal(v.pitch, 25.4 / v.m.tpi);
        assert.equal(threadRadius(p, v.start, 0), v.neck);
        assert.ok(threadRadius(p, v.start + v.pitch / 2, 0) < v.neck - 0.5 * v.pitch);
        assert.ok(
          Math.abs(
            threadRadius(p, v.start + 0.37 * v.pitch, 0.81) -
              threadRadius(p, v.start + 1.37 * v.pitch, 0.81),
          ) < 1e-12,
        );
      }
    } finally {
      disposeModel(g);
    }
  });
test('16 g variants differ in neck and manufacturer dimensions; common fills are present', () => {
  const pair = models.filter((m) => m.gasMass === 16);
  assert.equal(pair.length, 2);
  assert.deepEqual(
    pair.map((m) => m.tpi).sort((a, b) => a - b),
    [0, 24],
  );
  assert.notEqual(pair[0].neckLength, pair[1].neckLength);
  assert.deepEqual(
    [...new Set(models.map((m) => m.gasMass))].sort((a, b) => a - b),
    [8, 12, 16, 20, 25, 33, 38, 45],
  );
  assert.equal(models.filter((m) => m.gasMass === 38).length, 2);
  for (const preset of part.presets) {
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
    for (const key of Object.keys(preset.catalog!.attributes!))
      assert.ok(
        part.catalogFilterFields!.some((f) => f.key === key),
        key,
      );
  }
});
test('manufactured geometry rejects unknown models and size overrides', () => {
  assert.ok(validateParameters(part, { model: 'missing' }, 'sealed').length);
  assert.ok(part.validate({ ...part.defaults, length: 99 }, 'sealed').length);
  assert.ok(part.validate(part.defaults, 'open').length);
});
