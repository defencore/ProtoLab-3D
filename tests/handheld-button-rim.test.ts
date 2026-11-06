import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three';
import part from '../src/parts/handheld-lora-controller/part';
import { guardedOuter, guardSurface } from '../src/parts/handheld-lora-controller/lib/button-guard';
import { bezelSeat } from '../src/parts/handheld-lora-controller/lib/bezel-pockets';
import { layout } from '../src/parts/handheld-lora-controller/lib/layout';

test('Lower DS-225 seats retain a closed rounded lip and the original switch clearance', () => {
  assert.equal(bezelSeat.shoulderFront, 23.2, 'The nominal collar is 0.5 mm lower than X23.7');
  assert.equal(bezelSeat.lipRadius, 0.5);
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    const p = { ...part.defaults, bodyModel, guardProjection: 5.5 },
      shape = guardedOuter(p);
    assert.equal(shape.kind, 'boundary');
    if (shape.kind !== 'boundary') throw new Error('Expected the authored button seat surface');
    const vertices: number[] = [],
      edges = new Map<string, number>();
    let volume = 0;
    const keys = shape.points.map((point) =>
      point.map((v) => Math.round(Math.fround(v) * 1e5)).join(','),
    );
    for (const face of shape.faces) {
      assert.equal(face.length, 3);
      const [a, b, c] = face.map((id) => new Vector3(...shape.points[id].map(Math.fround)));
      volume += a.dot(b.clone().cross(c)) / 6;
      for (const id of face) vertices.push(...shape.points[id]);
      if (new Set(face.map((id) => keys[id])).size < 3) continue;
      for (let i = 0; i < 3; i++) {
        const key = [keys[face[i]], keys[face[(i + 1) % 3]]].sort().join('/');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0, bodyModel + ': outward solid');
    assert.ok(
      [...edges.values()].every((count) => count === 2),
      bodyModel + ': closed pocket lips',
    );
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    const material = new MeshBasicMaterial({ side: DoubleSide }),
      mesh = new Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    const frontAt = (y: number, z: number) =>
      new Raycaster(new Vector3(35, y, z), new Vector3(-1, 0, 0), 0, 17).intersectObject(mesh)[0]
        ?.point.x ?? -Infinity;
    try {
      for (const button of layout(p).buttons.filter((button) => button.x > 0)) {
        const front = (offset: number) =>
            frontAt(button.y + bezelSeat.width / 2 + offset, button.z),
          start = front(0.001),
          shoulder = front(bezelSeat.lipRadius);
        assert.ok(shoulder < 23.4 && shoulder > 23.1, bodyModel + ': reduced actual shoulder');
        assert.ok(shoulder - start > 0.45 && shoulder - start < 0.55, bodyModel + ': R0.5 return');
        assert.ok(
          front(0.02) - start > 0.07,
          bodyModel + ': lip approaches the pocket wall tangentially',
        );
        assert.ok(
          Math.abs(front(0.5) - front(0.48)) < 0.01,
          bodyModel + ': lip meets the shoulder smoothly',
        );
        assert.ok(
          Math.abs(frontAt(button.y + 7.625, button.z) - 21) < 1e-5,
          bodyModel + ': original 0.25 mm bezel side clearance reaches its X21 mounting panel',
        );
      }
    } finally {
      geometry.dispose();
      material.dispose();
    }
  }
});

test('Lower mounting rims preserve the supporting crest on every body and guard setting', () => {
  for (const bodyModel of ['original', 'contoured', 'web-grip'])
    for (const guardProjection of [5.5, 6]) {
      const p = { ...part.defaults, bodyModel, guardProjection },
        shape = guardSurface(p);
      assert.equal(shape.kind, 'boundary');
      if (shape.kind !== 'boundary') throw new Error('Expected the sewn guard surface');
      const crest = shape.points.reduce((maximum, [x]) => Math.max(maximum, x), -Infinity);
      assert.ok(Math.abs(crest - layout(p).guardPlane) < 1e-8);
      assert.ok(crest - layout(p).releasedCapPlane >= 0.5 - 1e-8);
    }
});
