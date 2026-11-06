import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import {
  lanyardAnchor,
  reinforcement,
  reinforcementCutouts,
} from '../src/parts/handheld-lora-controller/lib/reinforcement';
import { shellLoft, subtract } from '../src/parts/handheld-lora-controller/lib/shapes';
import type { Shape } from '../src/core/assembly/boundary/shapes';

before(initializeManifoldGeometry);

function localAnchor() {
  const stock: Shape = {
    kind: 'intersect',
    children: [
      lanyardAnchor(),
      shellLoft([
        [0, 2.4],
        [5, 0.2],
        [28, 0.2],
      ]),
    ],
  };
  const model = manifoldBoundaryComponent(
    subtract(stock, reinforcementCutouts()),
    'Corner eyelet',
    0xffffff,
  );
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (object instanceof Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        material.side = DoubleSide;
      });
    }
  });
  return model;
}

function inside(model: ReturnType<typeof localAnchor>, point: Vector3) {
  const hits = new Raycaster(point, new Vector3(0.217, 0.537, 0.815).normalize()).intersectObject(
    model,
    true,
  );
  const distances = hits
    .map(({ distance }) => distance)
    .filter((distance, i, all) => i === 0 || Math.abs(distance - all[i - 1]) > 1e-6);
  return distances.length % 2 === 1;
}

test('wrist cord eyelet stays in a compact corner instead of extending along the grip wall', () => {
  const model = localAnchor();
  try {
    const bounds = new Box3().setFromObject(model),
      size = bounds.getSize(new Vector3()),
      cord = reinforcement.lanyard;
    assert.ok(size.x < 12 && size.y < 14, `Compact corner footprint: ${size.toArray()}`);
    assert.ok(bounds.min.y > 39 && bounds.max.y <= 53);
    assert.ok(bounds.max.x <= -9.09 && bounds.min.x >= -21);
    assert.ok(
      cord.portSpacing > 6.9 && cord.portSpacing < 7.1,
      'The two exterior mouths are adjacent',
    );
    assert.ok(cord.enclosedLength < 15, 'Short smooth route replaces the 25.5 mm diagonal tunnel');
    assert.ok(cord.topLigament >= 2.3 && cord.bottomLigament >= 2.3);
    assert.ok(cord.bendRadius >= cord.boreDiameter / 2 + 1.5);
  } finally {
    disposeModel(model);
  }
});

test('actual swept eyelet admits a 3.6 mm cord around both flared mouths and the complete bend', () => {
  const model = localAnchor(),
    cord = reinforcement.lanyard;
  try {
    for (let segment = 0; segment + 1 < cord.cordPath.length; segment++) {
      const first = new Vector3(...cord.cordPath[segment]),
        last = new Vector3(...cord.cordPath[segment + 1]);
      for (const radius of [0, 1.8])
        for (let sample = 0; sample < (radius ? 48 : 1); sample++) {
          const angle = (sample * Math.PI) / 24;
          const offset = (index: number) => {
            const direction = cord.cordDirections[index];
            return new Vector3(
              direction[1] * radius * Math.cos(angle),
              -direction[0] * radius * Math.cos(angle),
              radius * Math.sin(angle),
            );
          };
          const start = first.clone().add(offset(segment)),
            end = last.clone().add(offset(segment + 1)),
            delta = end.clone().sub(start);
          assert.equal(
            new Raycaster(start, delta.clone().normalize(), 0, delta.length()).intersectObject(
              model,
              true,
            ).length,
            0,
            `Uninterrupted nominal cord surface, segment ${segment}, angle ${sample * 7.5}`,
          );
        }
    }
  } finally {
    disposeModel(model);
  }
});

test('compact eyelet retains its floor root, roof and continuous loaded bridge', () => {
  const model = localAnchor(),
    cord = reinforcement.lanyard;
  try {
    for (const key of ['loadedBridgeWitness', 'floorRootWitness', 'roofWitness'] as const) {
      const center = new Vector3(...cord[key]);
      for (const x of [-0.4, 0, 0.4])
        for (const y of [-0.4, 0, 0.4])
          for (const z of [-0.4, 0, 0.4])
            assert.ok(
              inside(model, center.clone().add(new Vector3(x, y, z))),
              `${key}: its full 0.8 mm witness cube stays in material`,
            );
    }
    const first = new Vector3(...cord.loadedBridgeSegment[0]),
      last = new Vector3(...cord.loadedBridgeSegment[1]);
    assert.ok(first.distanceTo(last) >= 2.3);
    for (let sample = 0; sample <= 100; sample++)
      assert.ok(
        inside(model, first.clone().lerp(last, sample / 100)),
        'The bridge has a continuous load path between the two short ports',
      );
  } finally {
    disposeModel(model);
  }
});
