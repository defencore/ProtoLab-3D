import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, DoubleSide, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import nyloc from '../src/parts/nyloc-nut/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

function closedConnected(mesh: Mesh) {
  const position = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index,
    count = index?.count ?? position.count,
    parents = Array.from({ length: count / 3 }, (_, i) => i),
    edges = new Map<string, { uses: number; balance: number; face: number }>();
  const root = (face: number): number => {
    while (parents[face] !== face) {
      parents[face] = parents[parents[face]];
      face = parents[face];
    }
    return face;
  };
  let volume = 0;
  for (let i = 0; i < count; i += 3) {
    const points = [0, 1, 2].map((j) =>
        new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
      ),
      [a, b, c] = points,
      keys = points.map((point) =>
        point
          .toArray()
          .map((value) => Math.round(value * 1e5))
          .join(','),
      );
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18);
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3],
        key = [a, b].sort().join('/'),
        previous = edges.get(key),
        edge = previous ?? { uses: 0, balance: 0, face: i / 3 };
      if (previous) parents[root(i / 3)] = root(previous.face);
      edge.uses++;
      edge.balance += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, 'Each material encloses positive volume');
  assert.ok(
    [...edges.values()].every(({ uses, balance }) => uses === 2 && balance === 0),
    'Each material is a closed consistently oriented boundary',
  );
  assert.equal(new Set(parents.map((_, i) => root(i))).size, 1, 'Each material is connected');
}

test('nyloc collar and hex body form one closed metal mesh beside the separate nylon insert', () => {
  const variants = [nyloc.defaults, nyloc.presets[0].parameters, nyloc.presets.at(-1)!.parameters];
  for (const mode of ['simple', 'full'] as const)
    for (const configured of variants) {
      const p: Parameters = { ...nyloc.defaults, ...configured, threadAllowance: 0.05 },
        model = withGeometryMode(mode, () => nyloc.buildGeometry(p, 'default')),
        meshes: Mesh[] = [];
      try {
        model.updateMatrixWorld(true);
        model.traverse((item) => {
          if (item instanceof Mesh) meshes.push(item);
        });
        assert.equal(meshes.length, 2, `${mode}: one metal body and one nylon insert`);
        meshes.forEach(closedConnected);
        const metal = meshes.find((mesh) => mesh.name.startsWith('Internal M'))!;
        assert.ok(metal);
        const material = metal.material as MeshStandardMaterial;
        if (mode === 'full') {
          assert.equal(material.userData.visualThreads.length, 1);
          assert.equal(material.userData.visualThreads[0].length, Number(p.bodyHeight));
        }
        const source = withGeometryMode(mode, () => nyloc.python(p, 'default')),
          metadata = source.split('\n').find((line) => line.startsWith('component_metadata = '))!;
        assert.ok(metadata);
        const record = JSON.parse(metadata.slice('component_metadata = '.length))[0];
        assert.equal(JSON.parse(record.ThreadFeaturesJSON)[0].length, Number(p.bodyHeight));
        const bounds = new Box3().setFromObject(model),
          size = bounds.getSize(new Vector3());
        assert.ok(Math.abs(bounds.min.z) < 1e-5);
        assert.ok(Math.abs(bounds.max.z - Number(p.height)) < 1e-5);
        assert.ok(Math.abs(size.x - Number(p.acrossFlats)) < 1e-5);
        assert.ok(Math.abs(size.y - Number(p.acrossFlats) / Math.cos(Math.PI / 6)) < 1e-5);
        material.side = DoubleSide;
        const radius =
            ((Number(p.bore) + Number(p.acrossFlats)) / 4 + Number(p.acrossFlats) * 0.47) / 2,
          hits = new Raycaster(
            new Vector3(radius, 0, Number(p.height) + 1),
            new Vector3(0, 0, -1),
          ).intersectObject(metal);
        assert.ok(hits.length >= 2, 'The metal collar and base both span the joint radius');
        assert.ok(Math.abs(hits[0].point.z - Number(p.height)) < 1e-5);
        assert.ok(hits.some(({ point }) => Math.abs(point.z) < 1e-5));
        assert.ok(
          hits.every(({ point }) => Math.abs(point.z - Number(p.bodyHeight)) > 1e-5),
          'No internal contact caps split the collar from the hex body',
        );
      } finally {
        disposeModel(model);
      }
    }
});
