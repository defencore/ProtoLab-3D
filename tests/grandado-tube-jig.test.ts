import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3, type Group, type Object3D } from 'three';
import { defaults } from '../src/parts/grandado-tube-mount/configurator';
import { jigLayout, jigPieces } from '../src/parts/grandado-tube-mount/lib/jig';
import { geometry } from '../src/core/assembly/boundary/assembly';
import type { Vec } from '../src/core/assembly/boundary/shapes';
import { disposeModel } from '../src/core/mechanical';

const d = jigLayout(defaults);
const pieces = jigPieces(defaults);
let model: Group;
let withoutAntenna: Group;

before(() => {
  model = geometry(pieces);
  withoutAntenna = geometry(
    jigPieces({ ...defaults, antenna: false }).filter(
      (piece) => piece.id === 'jig-rear-spine',
    ),
  );
  for (const group of [model, withoutAntenna]) {
    group.updateMatrixWorld(true);
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
  }
});

after(() => {
  if (model) disposeModel(model);
  if (withoutAntenna) disposeModel(withoutAntenna);
});

function object(id: string): Object3D {
  const index = pieces.findIndex((piece) => piece.id === id);
  assert.ok(index >= 0, id);
  return model.children[index];
}
function ray(target: Object3D, origin: Vec, direction: Vec) {
  return new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(
    target,
    true,
  );
}
function near(actual: number, expected: number, label: string, tolerance = 0.03) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);
}

test('the jig has two independent annular rings and eleven separate printable components', () => {
  assert.equal(pieces.length, 11);
  assert.equal(new Set(pieces.map((piece) => piece.id)).size, pieces.length);
  assert.equal(pieces.filter((piece) => piece.id.startsWith('jig-ring-')).length, 2);
  assert.equal(pieces.filter((piece) => piece.id.startsWith('jig-key-')).length, 4);
  assert.ok(pieces.every((piece) => piece.role === 'jig'));
  for (const sign of [-1, 1]) {
    const ring = object(`jig-ring-${sign < 0 ? 'left' : 'right'}`);
    const bounds = new Box3().setFromObject(ring, true);
    near(bounds.max.x - bounds.min.x, 16, 'ring and short radial-guide pods');
    near(sign > 0 ? bounds.max.x : bounds.min.x, sign * 80.5, 'ring outer axial face');
    near(sign > 0 ? bounds.min.x : bounds.max.x, sign * 64.5, 'guide-pod inner axial face');
    assert.ok(78 - 2.5 > Math.abs(d.antennaX) + d.antennaHole / 2);
    assert.equal(ray(ring, [0, 0, 0], [sign, 0, 0]).length, 0, 'the axial ring bore stays open');
    const hits = ray(ring, [sign * 78, 100, 0], [0, -1, 0]);
    assert.ok(hits.length >= 4);
    near(hits[0].point.y, d.ringOuterRadius, 'outer ring radius');
    near(hits.find((hit) => hit.point.y < d.ringOuterRadius - 1)!.point.y, 45.15, '90.3 mm bore');
  }
  assert.equal(jigLayout({ ...defaults, ringClearance: 0 }).ringBore, 90);
  assert.equal(jigLayout({ ...defaults, ringClearance: 0.6 }).ringBore, 90.6);
});

test('the marking frame locates the projected window rather than an arc-length measurement', () => {
  const front = ray(object('jig-marking-rail-front'), [0, 0, d.railBase + 2], [0, -1, 0])[0];
  const back = ray(object('jig-marking-rail-back'), [0, 0, d.railBase + 2], [0, 1, 0])[0];
  const left = ray(object('jig-marking-arch-left'), [0, 0, d.boreRadius + 2], [-1, 0, 0])[0];
  const right = ray(object('jig-marking-arch-right'), [0, 0, d.boreRadius + 2], [1, 0, 0])[0];
  assert.ok(front && back && left && right);
  near(back.point.y - front.point.y, 58.6, 'actual transverse marking edges');
  near(right.point.x - left.point.x, 83.6, 'actual axial marking edges');
  for (const piece of pieces.filter((piece) => /marking-(arch|rail)/.test(piece.id)))
    assert.equal(
      ray(object(piece.id), [0, 0, 100], [0, 0, -1]).length,
      0,
      'window remains accessible',
    );
  const nominal = jigLayout({ ...defaults, windowClearance: 0 });
  assert.deepEqual([nominal.windowLength, nominal.windowWidth], [83, 58]);
  assert.ok(
    2 * d.boreRadius * Math.asin(d.windowWidth / (2 * d.boreRadius)) > d.windowWidth + 4,
    'the cylindrical arc distance differs from the 58.6 mm projected chord',
  );
});

test('the jig marks all eight radial end-disc axes and omits the obsolete enclosure-ear marks', () => {
  for (const sign of [-1, 1]) {
    const end = sign < 0 ? 'left' : 'right';
    const arch = object(`jig-marking-arch-${sign < 0 ? 'left' : 'right'}`);
    assert.ok(
      ray(arch, [(sign * d.mountPitch) / 2, 0, 100], [0, 0, -1]).length > 0,
      'the former enclosure-ear marking hole is restored to solid stock',
    );
    for (const angle of d.guideAngles) {
      const target = angle === 0 ? arch : object(`jig-ring-${end}`);
      const ny = Math.round(Math.sin((angle * Math.PI) / 180));
      const nz = Math.round(Math.cos((angle * Math.PI) / 180));
      assert.equal(
        ray(target, [sign * d.endMountX, 100 * ny, 100 * nz], [0, -ny, -nz]).length,
        0,
        `open radial drill axis ${sign * d.endMountX}/${angle}`,
      );
      const stock = ray(target, [sign * (d.endMountX + 3), 100 * ny, 100 * nz], [0, -ny, -nz]);
      const faces: number[] = [];
      for (const hit of stock)
        if (!faces.some((value) => Math.abs(value - hit.distance) < 0.01)) faces.push(hit.distance);
      assert.ok(faces.length >= 2, 'radial guide has material outside its hole');
      assert.ok(faces[1] - faces[0] > 5, 'radial guide has at least 5 mm bearing depth');
    }
  }
});

test('the optional antenna mark follows its configured position', () => {
  const spine = object('jig-rear-spine');
  assert.equal(ray(spine, [d.antennaX, d.antennaY, -100], [0, 0, 1]).length, 0);
  assert.ok(
    ray(spine, [d.antennaX, d.antennaY - d.antennaHole / 2 - 0.4, -100], [0, 0, 1]).length > 0,
  );
  assert.equal(ray(withoutAntenna, [d.antennaX, d.antennaY - d.antennaHole / 2 - 0.4, -100], [0, 0, 1]).length, 0,
    'antenna off removes the side-entry guide extension');
});

test('bottom radial pods clear the spine and key joints keep three millimeter roofs and floors', () => {
  const spine = object('jig-rear-spine');
  for (const sign of [-1, 1]) {
    const ring = object(`jig-ring-${sign < 0 ? 'left' : 'right'}`);
    const spineTop = ray(spine, [sign * 73, 0, 100], [0, 0, -1])[0];
    const podBottom = ray(ring, [sign * 73, 0, -100], [0, 0, 1])[0];
    assert.ok(spineTop && podBottom);
    near(podBottom.point.z - spineTop.point.z, 0.3, 'bottom pod clearance above receiver');
    const roof = ray(spine, [sign * d.ringX, 10.8, d.bottomKeyZ], [0, 0, 1]);
    const floor = ray(ring, [sign * d.ringX, 0, d.bottomKeyZ], [0, 0, -1]);
    for (const [intersections, label] of [
      [roof, 'receiver key roof'],
      [floor, 'ring-lug key floor'],
    ] as const) {
      const z: number[] = [];
      for (const hit of intersections)
        if (!z.some((value) => Math.abs(value - hit.point.z) < 0.01)) z.push(hit.point.z);
      assert.ok(z.length >= 2, label);
      near(Math.abs(z[1] - z[0]), 3.1, label);
    }
  }
});

test('ring joints have transverse key passages and rear seats that clear the curved ring stock', () => {
  const spine = object('jig-rear-spine');
  assert.ok(d.spineSeatTop < -d.ringOuterRadius);
  for (const sign of [-1, 1]) {
    const end = sign < 0 ? 'left' : 'right';
    const ring = object(`jig-ring-${end}`);
    assert.equal(ray(ring, [sign * d.ringX, -100, d.bottomKeyZ], [0, 1, 0]).length, 0);
    assert.equal(ray(spine, [sign * d.ringX, -100, d.bottomKeyZ], [0, 1, 0]).length, 0);
    const shoulder = ray(spine, [sign * d.ringX + d.ringThickness / 2 + 1, 0, 100], [0, 0, -1])[0];
    assert.ok(
      shoulder && shoulder.point.z > d.lugBottom + 7,
      'a shoulder locates the ring axially',
    );
    near(shoulder.point.z, d.spineSeatTop, 'seat shoulders remain below curved ring stock');
    assert.equal(ray(ring, [sign * (d.ringX - 1), -100, d.topKeyZ], [0, 1, 0]).length, 0);
    for (const position of ['lower', 'upper']) {
      const key = object(`jig-key-${position}-${end}`);
      near(
        new Box3().setFromObject(key, true).getSize(new Vector3()).x,
        7,
        'headed key insertion stop',
      );
      const keyX = sign * (d.ringX - (position === 'upper' ? 1 : 0));
      const keyZ = position === 'upper' ? d.topKeyZ : d.bottomKeyZ;
      const span = position === 'upper' ? d.topBarWidth : d.spineWidth;
      const stop = ray(key, [keyX + 2, -100, keyZ], [0, 1, 0]);
      assert.ok(stop.length > 0, 'wide key head provides a real stop face');
      near(
        Math.max(...stop.map((hit) => hit.point.y)),
        -span / 2,
        'key head seats outside receiver',
        0.002,
      );
    }
  }
});

test('print poses retain each whole component on a flat axial or bottom face', () => {
  for (const piece of pieces) {
    if (/jig-(ring|marking-arch)-/.test(piece.id)) {
      assert.equal(piece.printShape.kind, 'transform');
      if (piece.printShape.kind !== 'transform')
        throw new Error('Expected rigid print orientation.');
      assert.strictEqual(
        piece.printShape.child,
        piece.shape,
        'printing preserves the curved geometry',
      );
      assert.deepEqual(
        piece.printShape.rotation.filter((value) => value !== 0).map(Math.abs),
        [90],
      );
    } else
      assert.strictEqual(piece.printShape, piece.shape, 'spine, rails and keys have flat bases');
  }
});
