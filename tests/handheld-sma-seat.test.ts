import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import type { Shape, Vec } from '../src/core/assembly/boundary/shapes';
import type { Parameters } from '../src/core/types';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { defaults } from '../src/parts/handheld-lora-controller/configurator';
import {
  antennaCradle,
  antennaLayout,
  antennaRetainerRelief,
  internalFpcEnvelope,
} from '../src/parts/handheld-lora-controller/lib/antenna-seat';
import { B, C, hex, move, subtract } from '../src/parts/handheld-lora-controller/lib/shapes';
import { article, pieces } from '../src/parts/rf-pigtail/lib/model';
import { roundedFloorEnvelope } from '../src/parts/handheld-lora-controller/lib/grip';
import { details } from '../src/parts/handheld-lora-controller/lib/details';
import { reinforcement } from '../src/parts/handheld-lora-controller/lib/reinforcement';
import { batteryBridge, batteryScrews } from '../src/parts/handheld-lora-controller/lib/layout';

before(initializeManifoldGeometry);

function volume(shape: Shape): number {
  const object = manifoldBoundaryComponent(shape, 'SMA installation control', 0xaaaaaa);
  let result = 0;
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const position = child.geometry.getAttribute('position'),
      index = child.geometry.index,
      n = index?.count ?? position.count;
    for (let i = 0; i < n; i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) =>
        new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
      );
      result += a.dot(b.cross(c)) / 6;
    }
  });
  disposeModel(object);
  return result;
}

// Subtract from a nonempty moving object so an empty Boolean intersection does
// not need to be represented as a printable Manifold component.
const overlap = (moving: Shape, stock: Shape): number =>
  volume(moving) - volume(subtract(moving, stock));

function isolatedAntennaHost(p: Parameters): Shape {
  const base = details(p).find((piece) => piece.id === 'base')!.shape;
  if (base.kind !== 'subtract')
    throw new Error('Expected the finished base with its production cuts');
  return subtract(
    { kind: 'intersect', children: [antennaCradle(p), roundedFloorEnvelope(p)] },
    ...base.children.slice(1),
  );
}

/** Reuse the actual closed Float32 stock instead of rebuilding its cuts for every pose. */
function evaluatedStock(shape: Shape): Shape {
  const object = manifoldBoundaryComponent(shape, 'Evaluated SMA stock', 0xffffff),
    points: Vec[] = [],
    faces: number[][] = [],
    ids = new Map<string, number>();
  try {
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const position = child.geometry.getAttribute('position'),
        index = child.geometry.index,
        count = index?.count ?? position.count;
      for (let i = 0; i < count; i += 3) {
        const face: number[] = [];
        for (let j = 0; j < 3; j++) {
          const id = index ? index.getX(i + j) : i + j,
            point: Vec = [position.getX(id), position.getY(id), position.getZ(id)],
            key = point.join(',');
          let shared = ids.get(key);
          if (shared === undefined) {
            shared = points.length;
            points.push(point);
            ids.set(key, shared);
          }
          face.push(shared);
        }
        faces.push(face);
      }
    });
  } finally {
    disposeModel(object);
  }
  return { kind: 'boundary', points, faces };
}

for (const bodyModel of ['original', 'contoured', 'web-grip'])
  for (const externalMount of ['bottom', 'top', 'compact-top']) {
    test(`${bodyModel}/${externalMount} SMA seats the canonical flange inside the case and stops its rotation`, () => {
      const p = { ...defaults, bodyModel, antennaType: 'external', externalMount },
        d = antennaLayout(p),
        host = evaluatedStock(isolatedAntennaHost(p)),
        canonical = pieces({ panelThickness: d.panelThickness }, 'assembled'),
        installed = (shape: Shape) => move(shape, d.position, d.rotation);
      assert.equal(d.panelThickness, 2.2);
      assert.equal(d.flangeAF, article.flangeAF);
      assert.equal(d.flangeThickness, article.flangeThickness);
      assert.ok(d.flangePocketAF - article.flangeAF >= 0.4 - 1e-8);
      assert.ok(d.minimumMatingThreadStandout > 5);
      assert.ok(Math.abs(d.flangeFrontY) < 52.3, 'The flange face is inboard of the end wall');
      assert.ok(volume(host) > 500, 'The recessed flange retains substantial floor-rooted stock');
      const jack = canonical[0].shape;
      for (const offset of [12, 8, 4, 2, 0]) {
        const moving = installed(move(jack, [0, 0, offset]));
        assert.ok(
          Math.abs(overlap(moving, host)) < 0.001,
          `The unchanged purchased jack enters from outside at ${offset} mm`,
        );
      }
      for (const piece of canonical) {
        assert.ok(
          Math.abs(overlap(installed(piece.shape), host)) < 0.001,
          `${piece.label} clears the installed host`,
        );
      }
      // Test the flange alone; a successful D-flat test must not conceal a round
      // cosmetic counterbore that would let the outer flange rotate freely.
      const flange = hex(article.flangeAF, 0.1, article.flangeThickness - 0.2, 0, 0);
      for (const angle of [-15, 15]) {
        const turned = installed(move(flange, [0, 0, 0], [0, 0, angle]));
        assert.ok(overlap(turned, host) > 0.1, `The flange key stops ${angle} degree rotation`);
      }
      const matingCollar = installed(C(d.matingToolDiameter, 10, 2.05));
      assert.ok(
        Math.abs(overlap(matingCollar, host)) < 0.001,
        'An 11 mm cylindrical antenna collar can reach the exposed SMA thread',
      );
      for (const piece of canonical.slice(-2))
        for (const offset of [20, 10, 5, 0]) {
          const moving = installed(move(piece.shape, d.top ? [0, 0, -offset] : [0, -offset, 0]));
          assert.ok(
            Math.abs(overlap(moving, host)) < 0.001,
            `The washer and nut can be loaded at ${offset} mm before the PCB`,
          );
        }
      if (d.top) {
        const t = d.axialTool,
          tool = move(
            subtract(
              C(t.outerDiameter, t.endY - t.startY, 0),
              C(t.innerDiameter, t.endY - t.startY + 0.2, -0.1),
            ),
            [t.centerX, t.startY, t.centerZ],
            [-90, 0, 0],
          );
        assert.ok(Math.abs(overlap(tool, host)) < 0.001, 'The inner nut driver reaches its nut');
      } else {
        const tool = B(
          d.toolWidth,
          d.toolFrontY - d.toolBackY,
          20,
          0,
          (d.toolBackY + d.toolFrontY) / 2,
          d.toolBottomZ,
        );
        assert.ok(Math.abs(overlap(tool, host)) < 0.001, 'The inner nut spanner enters from above');
      }
    });
  }

test('SMA installation changes do not move the internal FPC reference', () => {
  const p = { ...defaults, antennaType: 'internal' },
    d = antennaLayout(p);
  assert.equal(d.external, false);
  assert.equal(d.top, false);
  assert.deepEqual(d.internalFpc, antennaLayout({ ...p, externalMount: 'bottom' }).internalFpc);
  assert.deepEqual(internalFpcEnvelope(p), internalFpcEnvelope({ ...p, externalMount: 'top' }));
});

test('Bottom SMA cable notch retains both screw lands and the front tie of the battery retainer', () => {
  const p = { ...defaults, antennaType: 'external', externalMount: 'bottom' },
    retainer = details(p).find((piece) => piece.id === 'battery-retainer')!.shape,
    retainedVolume = volume(retainer),
    witnesses = [
      B(12, 0.4, 1.8, 0, 25.9, batteryBridge.z + 0.1),
      ...batteryScrews.map(([x, y]) =>
        subtract(C(4, 1.8, batteryBridge.z + 0.1, x, y), C(2.3, 2, batteryBridge.z, x, y)),
      ),
    ];
  for (const witness of witnesses) {
    const actualMaterial = retainedVolume - volume(subtract(retainer, witness));
    assert.ok(Math.abs(actualMaterial - volume(witness)) < 0.001);
  }
  assert.ok(antennaRetainerRelief(p));
  assert.equal(antennaRetainerRelief({ ...p, externalMount: 'top' }), null);
  assert.equal(antennaRetainerRelief({ ...p, antennaType: 'internal' }), null);
});

test('Bottom SMA retains 2.1 mm finite cheek load paths after the complete lanyard and mounting cuts', () => {
  const p = {
      ...defaults,
      bodyModel: 'original',
      antennaType: 'external',
      externalMount: 'bottom',
    },
    d = antennaLayout(p),
    host = evaluatedStock(isolatedAntennaHost(p)),
    hostVolume = volume(host);
  assert.ok(d.cradleLoadPaths);
  for (const path of d.cradleLoadPaths!) {
    const dimensions = path.max.map((value, i) => value - path.min[i]),
      witness = B(
        dimensions[0],
        dimensions[1],
        dimensions[2],
        (path.min[0] + path.max[0]) / 2,
        (path.min[1] + path.max[1]) / 2,
        path.min[2],
      ),
      material = hostVolume - volume(subtract(host, witness));
    assert.ok(dimensions[0] >= path.minimumWidth - 1e-8);
    assert.ok(Math.abs(material - volume(witness)) < 0.001, path.id);
  }
  const finished = manifoldBoundaryComponent(
    details(p).find((piece) => piece.id === 'base')!.shape,
    'Actual finished SMA base',
    0xffffff,
  );
  try {
    finished.updateMatrixWorld(true);
    finished.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      for (const material of Array.isArray(child.material) ? child.material : [child.material])
        material.side = DoubleSide;
    });
    for (const path of d.cradleLoadPaths!) {
      const ys = [
          ...Array.from(
            { length: 9 },
            (_, i) => path.min[1] + ((path.max[1] - path.min[1]) * (i + 0.5)) / 9,
          ),
          ...reinforcement.lanyard.cordPath
            .map((point) => point[1])
            .filter((y) => y > path.min[1] && y < path.max[1]),
        ],
        zs = [
          ...Array.from(
            { length: 9 },
            (_, i) => path.min[2] + ((path.max[2] - path.min[2]) * (i + 0.5)) / 9,
          ),
          ...[6.4, 8.3, 8.44, 8.46, 8.5, 9].filter((z) => z > path.min[2] && z < path.max[2]),
        ];
      for (const y of ys)
        for (const z of zs) {
          const xs = new Raycaster(new Vector3(60, y, z), new Vector3(-1, 0, 0), 0, 120)
              .intersectObject(finished, true)
              .map((hit) => hit.point.x),
            distinct = xs.filter((x, i) => i === 0 || Math.abs(x - xs[i - 1]) > 1e-5);
          let filled = false;
          for (let i = 0; i + 1 < distinct.length; i += 2)
            if (
              distinct[i] >= path.max[0] - 4e-5 &&
              distinct[i + 1] <= path.min[0] + 4e-5 &&
              distinct[i] - distinct[i + 1] >= path.minimumWidth - 4e-5
            )
              filled = true;
          assert.ok(filled, `${path.id} retains its full material interval at Y=${y}, Z=${z}`);
        }
    }
  } finally {
    disposeModel(finished);
  }
});
