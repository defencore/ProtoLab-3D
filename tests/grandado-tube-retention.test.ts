import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, DoubleSide, Group, Mesh, Raycaster, Vector3 } from 'three';
import { component } from '../src/core/assembly/boundary/shapes';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import { defaults } from '../src/parts/grandado-tube-mount/configurator';
import { cassetteContactSpec, cassettePieces } from '../src/parts/grandado-tube-mount/lib/cassette';
import { endRetainerPieces } from '../src/parts/grandado-tube-mount/lib/end-retainer';
import { hardware, libraries } from '../src/parts/grandado-tube-mount/lib/model';
import { layout, type PrintedPiece } from '../src/parts/grandado-tube-mount/lib/spec';

type Point = [number, number, number];
const tolerance = 0.001;
const close = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} versus ${expected}`);

function solid(piece: PrintedPiece, printing = false): Group {
  const group = component(printing ? piece.printShape : piece.shape, piece.label, piece.color);
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.side = DoubleSide;
  });
  group.updateMatrixWorld(true);
  return group;
}

function intersections(group: Group, origin: Point, direction: Point): Vector3[] {
  const ray = new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize());
  const hits = ray.intersectObject(group, true);
  return hits
    .filter((hit, index) => !index || hit.distance - hits[index - 1].distance > 0.0001)
    .map((hit) => hit.point);
}

function inside(group: Group, point: Point): boolean {
  // An oblique ray avoids coincident face diagonals and vertex-only contacts.
  return intersections(group, point, [1, 0.173, 0.119]).length % 2 === 1;
}

const zFaces = (group: Group, x: number, y: number) =>
  intersections(group, [x, y, -100], [0, 0, 1]).map((point) => point.z);
const xFaces = (group: Group, y: number, z: number) =>
  intersections(group, [-100, y, z], [1, 0, 0]).map((point) => point.x);

function piece(id: string): PrintedPiece {
  const result = cassettePieces(defaults).find((entry) => entry.id === id);
  assert.ok(result, id);
  return result;
}

test('symmetric curved webs and four-millimetre T keys carry both cage sides without thin cable remnants', () => {
  const c = cassetteContactSpec(defaults),
    upper = solid(piece(c.upperHalfId)),
    lower = solid(piece(c.lowerHalfIds[1]));
  try {
    for (const sign of [-1, 1])
      assert.ok(inside(upper, [12, sign * 36, c.joinZ + 1.5]), 'missing symmetric radial web outside the loading opening');
    assert.ok(inside(upper, [12, 30, 30]));
    assert.ok(inside(lower, [12, 0, -42.5]));
    assert.ok(!inside(lower, [12, 0, -37]));
    for (const y of c.tracks.centersY) {
      const wingY = y + (y > 0 ? 2.5 : -2.5);
      const upperFaces = zFaces(upper, 12, wingY),
        lowerFaces = zFaces(lower, 12, wingY);
      const bottom = upperFaces.find((v) => Math.abs(v - c.tracks.flangeBottom) < 0.01)!;
      const top = upperFaces.find((v) => Math.abs(v - c.tracks.flangeTop) < 0.01)!;
      const channelFloor = lowerFaces.find(
        (v) => Math.abs(v - (c.tracks.flangeBottom - 0.2)) < 0.01,
      )!;
      const channelRoof = lowerFaces.find((v) => Math.abs(v - (c.tracks.flangeTop + 0.2)) < 0.01)!;
      close(top - bottom, 4, 'actual massive key thickness');
      close(bottom - channelFloor, 0.2, 'sliding key floor allowance');
      close(channelRoof - top, 0.2, 'sliding key roof allowance');
      close(c.joinZ - channelRoof, 3, 'outboard capture roof must retain three millimetres');
      assert.ok(
        !inside(lower, [12, y - Math.sign(y) * 2, c.tracks.flangeTop + 1.5]),
        'a disconnected inboard track lip must not remain beside the entry clearance',
      );
    }
    assert.ok(
      !inside(upper, [0, -c.tracks.centersY[1], (c.tracks.flangeBottom + c.tracks.flangeTop) / 2]),
      'the body-loading opening removes the complete local key instead of a thin stem',
    );
    assert.ok(
      inside(upper, [-15, -35, c.joinZ + 1.5]),
      'the longitudinal guide retains its broad web beside the body-loading opening',
    );
    assert.equal(c.serviceOvertravel, 0);
  } finally {
    disposeModel(upper);
    disposeModel(lower);
  }
});

test('the supplied Grandado ears are captured between passive massive faces without case screws', () => {
  const d = layout(defaults),
    c = cassetteContactSpec(defaults),
    upper = solid(piece(c.upperHalfId));
  const lower = c.lowerHalfIds.map((id) => solid(piece(id)));
  try {
    for (const [index, x] of d.mountXs.entries()) {
      const ceiling = zFaces(upper, x + 2, 0)[0];
      const support = zFaces(lower[index], x + 2, 0).at(-1)!;
      close(ceiling, d.earPocketTop, 'upper ear ceiling');
      close(support, d.boxBottom, 'positive ear support');
      close(ceiling - support, d.earThickness + d.earClearance, 'measured ear plus print fitting allowance');
      assert.ok(c.earCapture.ceilingThickness >= 3, 'three-millimetre ear ceiling retained');
    }
    assert.ok(
      !inside(upper, [0, 0, d.boxBottom - 1]),
      'bare body needs an open underside for bench insertion',
    );
    assert.ok(inside(lower[1], [12, 27, d.boxBottom - 1]), 'body-floor support rail missing');
    close(
      new Box3().setFromObject(upper, true).max.z,
      d.cassetteRadius,
      'core has no obsolete true-ID spacer bosses',
    );
    assert.equal(hardware(defaults).length, 16);
    assert.ok(
      hardware(defaults).every((v) => v.component.id.startsWith('disc-')),
      'only radial end-disc fasteners belong in this kit',
    );
  } finally {
    disposeModel(upper);
    for (const model of lower) disposeModel(model);
  }
});

test('one passive keeper positively retains the cell roofs, can rims and holder body', () => {
  const d = layout(defaults),
    c = cassetteContactSpec(defaults),
    keeperPiece = piece(c.keeperId);
  const keeper = solid(keeperPiece),
    printing = solid(keeperPiece, true);
  try {
    close(new Box3().setFromObject(printing, true).min.z, 0, 'keeper flat roof print base');
    for (const side of [-1, 1])
      for (const [, y, z] of c.cellCenters) {
        close(
          zFaces(keeper, side * 28.5, y)[0] - (z + c.cellRadius),
          0,
          'nominal rigid can contact',
        );
        assert.ok(
          inside(keeper, [side * 32.9, y, c.keeperMinZ + 0.2]),
          'missing upper-can axial wall',
        );
        assert.ok(
          !inside(keeper, [side * 32.7, y, c.keeperMinZ + 0.2]),
          'can-end allowance obstructed',
        );
        assert.ok(
          !inside(keeper, [side * 33, y, c.keeperMinZ - 0.1]),
          'keeper must clear spring-contact height',
        );
        const rimFaces = xFaces(keeper, y, c.keeperMinZ + 0.2),
          inner = rimFaces.find((v) => Math.abs(v - side * 32.8) < 0.01)!,
          outer = rimFaces.find((v) => Math.abs(v - side * 35.8) < 0.01)!;
        close(Math.abs(outer - inner), 3, 'actual rigid can-rim end-stop wall');
      }
    close(
      zFaces(keeper, 0, 0)[0] - d.holderTop,
      0.15,
      'holder body has an independent positive roof stop',
    );
    for (const side of [-1, 1]) {
      const end = side * (d.holderLength / 2 + d.fit);
      assert.ok(
        inside(keeper, [end + side * 0.2, 10, d.holderBottom + 10]),
        'holder axial end wall is missing',
      );
      assert.ok(
        !inside(keeper, [end - side * 0.2, 10, d.holderBottom + 10]),
        'holder fitting space is obstructed',
      );
    }
    const wire = d.powerCableDiameter / 2 + d.connectorClearance;
    const sideY = -(c.keeperRails.beamInnerY + 1.5);
    assert.ok(
      inside(keeper, [0, sideY, c.keeperRails.beamBottom + 1.5]),
      'wire slot severed the deep keeper beam',
    );
    assert.ok(d.holderTop - wire - c.keeperRails.beamBottom >= 6.49);
  } finally {
    disposeModel(keeper);
    disposeModel(printing);
  }
});

test('three-millimetre keeper guides and full floor webs bridge the two lower sections', () => {
  const c = cassetteContactSpec(defaults),
    lower = c.lowerHalfIds.map((id) => solid(piece(id)));
  try {
    close(new Box3().setFromObject(lower[0], true).max.x, 0, 'negative butt face');
    close(new Box3().setFromObject(lower[1], true).min.x, 0, 'positive butt face');
    const floorZ = c.holderPocket.floorBottom + 1.5;
    for (const side of [-1, 1])
      for (const dy of [-0.3, 0.3, 2.5])
        assert.ok(
          inside(lower[1], [12, side * (c.holderPocket.width / 2 + dy), floorZ]),
          'floor must have a real full-height web into the curved skin',
        );
    const wingY = c.keeperRails.hookOuterY - 1;
    const faces = zFaces(lower[1], 12, wingY);
    const channelBottom = faces.find((v) => Math.abs(v - c.keeperRails.channelBottom) < 0.01)!;
    const floorBottom = faces.find((v) => Math.abs(v - (c.keeperRails.channelBottom - 3)) < 0.01)!;
    close(channelBottom - floorBottom, 3, 'keeper guide floor thickness');
    const innerFaces = zFaces(lower[1], 12, c.keeperRails.beamInnerY + 2.5);
    const innerTop = innerFaces.find((v) => Math.abs(v - c.keeperRails.channelInnerTop) < 0.01)!;
    const mainFloor = innerFaces.find((v) => Math.abs(v - (c.tracks.flangeBottom - 0.2)) < 0.01)!;
    assert.ok(mainFloor - innerTop >= 3 - tolerance, 'backing between keeper and main cage tracks retains at least three millimetres');
  } finally {
    for (const model of lower) disposeModel(model);
  }
});

test('the loaded lower section clears the upper body walls throughout axial guide entry', () => {
  const d = layout(defaults),
    c = cassetteContactSpec(defaults),
    upper = solid(piece(c.upperHalfId)),
    lower = solid(piece(c.lowerHalfIds[0]));
  const wallHalfLength = d.boxLength / 2 + d.fit + 3;
  try {
    for (const offset of [0.5, 2, 20, 80]) {
      // Follow the leading end land as it passes through the fixed body wall.
      // A clearance cut limited to the body's length leaves material at these
      // witnesses even though the final, fully seated assembly has no clash.
      const lo = Math.max(-wallHalfLength, -c.coreHalfLength + offset),
        hi = Math.min(wallHalfLength, -wallHalfLength - 0.2 + offset);
      assert.ok(hi > lo, 'sample must cross the actual upper body wall');
      const x = (lo + hi) / 2,
        z = (d.boxBottom + c.joinZ) / 2;
      for (const sign of [-1, 1]) {
        const y = sign * (d.boxWidth / 2 + d.fit + 1.5);
        if (!inside(upper, [x, y, z])) {
          assert.equal(sign, -1, 'only the cable-access side may omit this wall witness');
          continue;
        }
        assert.ok(
          !inside(lower, [x - offset, y, z]),
          `moving lower end land obstructs the upper wall at offset ${offset}`,
        );
      }
    }
  } finally {
    disposeModel(upper);
    disposeModel(lower);
  }
});

test('both solid disc shoulders close the keeper tails and all eight tube anchors remain countersunk', () => {
  const d = layout(defaults),
    c = cassetteContactSpec(defaults),
    keeper = solid(piece(c.keeperId));
  const discs = endRetainerPieces(defaults).map((v) => solid(v));
  try {
    for (const face of c.keeperClosureFaces) {
      const y = (face.minY + face.maxY) / 2,
        z = (face.minZ + face.maxZ) / 2;
      assert.ok(
        Math.hypot(Math.abs(y) + 1.5, Math.max(Math.abs(face.minZ), Math.abs(face.maxZ))) <
          c.coreClosureRadius,
        'full tail face must fit the solid disc shoulder',
      );
      const keeperFaces = xFaces(keeper, y, z),
        discFaces = xFaces(discs[face.side < 0 ? 0 : 1], y, z);
      close(
        face.side < 0 ? keeperFaces[0] : keeperFaces.at(-1)!,
        face.x,
        'full keeper closure face',
      );
      close(
        face.side < 0 ? discFaces.at(-1)! : discFaces[0],
        face.x,
        'nominal disc-to-keeper contact',
      );
    }
    const metal = hardware(defaults);
    assert.equal(metal.filter((v) => v.component.libraryId === 'bolt-screw').length, 8);
    assert.equal(metal.filter((v) => v.component.libraryId === 'hex-nut').length, 8);
    for (const screw of metal.filter((v) => v.component.libraryId === 'bolt-screw')) {
      const model = componentGeometry(libraries, [screw]);
      try {
        let radius = 0;
        model.updateMatrixWorld(true);
        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const attr = object.geometry.getAttribute('position');
          for (let i = 0; i < attr.count; i++) {
            const point = new Vector3()
              .fromBufferAttribute(attr, i)
              .applyMatrix4(object.matrixWorld);
            radius = Math.max(radius, Math.hypot(point.y, point.z));
          }
        });
        assert.ok(radius < d.radius, `${screw.component.id} protrudes outside the tube`);
      } finally {
        disposeModel(model);
      }
    }
  } finally {
    disposeModel(keeper);
    for (const disc of discs) disposeModel(disc);
  }
});
