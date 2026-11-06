import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/handheld-lora-controller/part';
import { manifoldBoundaryComponent } from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import {
  floorCapCenter,
  gripRings,
  roundedFloorEnvelope,
} from '../src/parts/handheld-lora-controller/lib/grip';
import { details } from '../src/parts/handheld-lora-controller/lib/details';
import { guardSurface } from '../src/parts/handheld-lora-controller/lib/button-guard';

before(async () => part.initializeGeometry?.(part.defaults, 'assembled'));

test('Both floor and exterior cap fans retain positive triangles on every body model', () => {
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    const p = { ...part.defaults, bodyModel },
      rings = gripRings(p);
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        const [cx, cy] = floorCapCenter,
          a = ring[i],
          b = ring[(i + 1) % ring.length],
          cross = (a[0] - cx) * (b[1] - cy) - (a[1] - cy) * (b[0] - cx);
        assert.ok(cross > 0, `${bodyModel} ring Z=${a[2]} edge ${i} sees the shared cap datum`);
      }
    const envelope = roundedFloorEnvelope(p);
    assert.equal(envelope.kind, 'union');
    if (envelope.kind !== 'union') throw new Error('Expected the production floor envelope');
    for (const shape of [envelope.children[0], guardSurface(p)]) {
      assert.equal(shape.kind, 'boundary');
      if (shape.kind !== 'boundary') throw new Error('Expected an authored cap boundary');
      const bottom = Math.min(...shape.points.map((point) => point[2])),
        top = Math.max(...shape.points.map((point) => point[2]));
      for (const [z, orientation] of [
        [bottom, -1],
        [top, 1],
      ]) {
        const caps: number[][] = shape.faces.filter((face) =>
          face.every((id) => shape.points[id][2] === z),
        );
        assert.ok(caps.length > 0, `${bodyModel} has an authored cap at Z=${z}`);
        for (const face of caps) {
          assert.equal(face.length, 3);
          const [a, b, c] = face.map((id) => shape.points[id].map(Math.fround)),
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
          assert.ok(
            cross * orientation > 0,
            `${bodyModel} cap Z=${z} retains a positive oriented Float32 triangle`,
          );
        }
      }
    }
  }
});

test('Every lower perimeter follows a tangent circular round rather than a stepped bevel', () => {
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    const rings = gripRings({ ...part.defaults, bodyModel }),
      bottom = bodyModel === 'original' ? 0 : -2.2,
      radius = bodyModel === 'original' ? 4 : 5;
    assert.equal(rings[0][0][2], bottom);
    const rounded = rings.filter((ring) => ring[0][2] <= bottom + radius + 1e-10);
    assert.equal(rounded.length, 25);
    for (let i = 0; i < rounded.length; i++) {
      const ring = rounded[i],
        right = Math.max(...ring.map(([x]) => x)),
        height = ring[0][2] - bottom;
      assert.ok(
        Math.abs((right - (21 - radius)) ** 2 + (height - radius) ** 2 - radius ** 2) < 1e-8,
      );
      if (i > 0) assert.ok(height > rounded[i - 1][0][2] - bottom);
    }
    const first = rounded[0][33],
      second = rounded[1][33],
      last = rounded.at(-1)![33],
      beforeLast = rounded.at(-2)![33];
    assert.ok(
      Math.abs((second[2] - first[2]) / (second[0] - first[0])) < 0.04,
      'The lower arc meets the print bed tangentially',
    );
    assert.ok(
      Math.abs((last[0] - beforeLast[0]) / (last[2] - beforeLast[2])) < 0.04,
      'The upper arc meets the side wall tangentially',
    );
  }
});

test('The stock clipping envelope is a closed positive Float32 boundary on all body models', () => {
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    // The production backend rejects zero-area triangles, duplicate faces and
    // unpaired oriented edges after the actual Float32 conversion.
    const model = manifoldBoundaryComponent(
      roundedFloorEnvelope({ ...part.defaults, bodyModel }),
      'Rounded stock envelope',
      0xffffff,
    );
    try {
      let count = 0;
      model.traverse((object) => {
        if (object instanceof Mesh) count++;
      });
      assert.equal(count, 1);
    } finally {
      disposeModel(model);
    }
  }
});

test('Finished bases keep the lower arc free of protruding post and tray stock', () => {
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    const p = { ...part.defaults, bodyModel, antennaType: 'internal' },
      shape = details(p).find((detail) => detail.id === 'base')!.shape,
      model = manifoldBoundaryComponent(shape, 'Finished base lower contour', 0xffffff),
      rings = gripRings(p),
      bottom = bodyModel === 'original' ? 0 : -2.2,
      radius = bodyModel === 'original' ? 4 : 5;
    try {
      model.updateMatrixWorld(true);
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.side = DoubleSide;
        });
      });
      for (const y of [-35, -10, 10, 29, 35])
        for (let i = 1; i < 24; i++) {
          const ring = rings[i],
            z = ring[0][2];
          if (z >= 3.7) continue; // The integral finger guard starts above this band.
          const expected = Math.max(...ring.map(([x]) => x)),
            hit = new Raycaster(
              new Vector3(60, y, z),
              new Vector3(-1, 0, 0),
              0,
              100,
            ).intersectObject(model, true)[0];
          assert.ok(hit, `${bodyModel} has a continuous lower wall at ${y},${z}`);
          assert.ok(
            Math.abs(hit.point.x - expected) < 2e-4,
            `${bodyModel} lower arc protrudes at ${y},${z}: ${hit.point.x} vs ${expected}`,
          );
          assert.ok(z >= bottom && z <= bottom + radius);
        }
    } finally {
      disposeModel(model);
    }
  }
});
