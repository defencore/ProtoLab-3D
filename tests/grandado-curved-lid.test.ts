import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3, type Group } from 'three';
import { defaults } from '../src/parts/grandado-tube-mount/configurator';
import {
  replacementLidPieces,
  replacementLidFactoryScrews,
  replacementLidSpec,
} from '../src/parts/grandado-tube-mount/lib/replacement-lid';
import { grandadoPieces } from '../src/parts/catalog-enclosure/lib/grandado';
import { geometry } from '../src/core/assembly/boundary/assembly';
import type { Vec } from '../src/core/assembly/boundary/shapes';
import { disposeModel } from '../src/core/mechanical';

const spec = replacementLidSpec(defaults);
const pieces = replacementLidPieces(defaults);
let lid: Group;
let body: Group;
let factoryScrews: Group;

before(() => {
  lid = geometry(pieces);
  body = geometry([grandadoPieces('assembled')[0]]);
  body.position.z = spec.bodyTranslation;
  factoryScrews = geometry(replacementLidFactoryScrews(defaults));
  for (const model of [lid, body, factoryScrews]) {
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
  }
});

after(() => {
  if (lid) disposeModel(lid);
  if (body) disposeModel(body);
  if (factoryScrews) disposeModel(factoryScrews);
});

function hits(model: Group, origin: Vec, direction: Vec) {
  return new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(
    model,
    true,
  );
}
function near(actual: number, expected: number, label: string, tolerance = 0.02) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);
}
function radiiAt(x: number, y: number) {
  const radii: number[] = [];
  for (const hit of hits(lid, [x, y, 100], [0, 0, -1])) {
    const radius = Math.hypot(hit.point.y, hit.point.z);
    if (!radii.some((value) => Math.abs(value - radius) < 0.01)) radii.push(radius);
  }
  return radii;
}

test('the curved cover preserves a one-millimeter apex and fits its published footprint', () => {
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].id, 'grandado-curved-replacement-lid');
  const bounds = new Box3().setFromObject(lid, true);
  near(bounds.max.x - bounds.min.x, 102, 'cover axial footprint');
  near(bounds.max.y - bounds.min.y, 76, 'cover transverse footprint');
  near(bounds.max.z, 46, 'curved roof apex');
  near(bounds.max.z - spec.tubeRadius, 1, 'apex above the original tube');
  lid.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const vertices = object.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const point = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld);
      assert.ok(Math.hypot(point.y, point.z) <= spec.outerRadius + 0.002, 'no boss outside the smooth cylinder');
    }
  });
});

test('structural roof remains three millimeters radially, including the opening edges', () => {
  for (const y of [0, -29.2, 29.2]) {
    const radii = radiiAt(0, y);
    assert.equal(radii.length, 2);
    near(radii[0], 46, 'outside roof radius');
    near(radii[1], 43, 'inside roof radius');
    near(radii[0] - radii[1], 3, 'radial roof thickness');
  }
  assert.ok(spec.skirtWall >= 3);
});

test('only the peripheral wrap outside the window uses the one-millimeter radial section', () => {
  for (const [x, y] of [
    [47, 0],
    [-47, 0],
    [0, 35],
    [0, -35],
  ]) {
    const radii = radiiAt(x, y);
    assert.equal(radii.length, 2);
    near(radii[0], 46, 'lip outside radius');
    near(radii[1], 45, 'lip tube-contact radius');
    near(radii[0] - radii[1], 1, 'intentional radial lip thickness');
  }
});

test('the skirt and four massive boss feet seat on the actual library body', () => {
  const contacts = [[0, 28.6], [0, -28.6], ...spec.screwSeats.map(({ x, y }) => [x + 2.5, y])];
  for (const [x, y] of contacts) {
    const actualBody = hits(body, [x, y, 60], [0, 0, -1])[0];
    const actualCover = hits(lid, [x, y, spec.bodySeamZ - 2], [0, 0, 1])[0];
    assert.ok(actualBody && actualCover, `seating stock at ${x},${y}`);
    near(actualBody.point.z, spec.bodySeamZ, 'factory body seating height');
    near(actualCover.point.z, actualBody.point.z, 'replacement seating face');
  }
});

test('four source screws have recessed heads, three-millimeter bearing webs and clear blind-hole tips', () => {
  for (const seat of spec.screwSeats) {
    assert.equal(hits(lid, [seat.x, seat.y, 100], [0, 0, -1]).length, 0, '4 mm screw passage');
    const bearing = hits(lid, [seat.x + 2.5, seat.y, 100], [0, 0, -1])[0];
    assert.ok(bearing);
    const factoryBearing = hits(
      factoryScrews,
      [seat.x + 2.5, seat.y, spec.bodySeamZ],
      [0, 0, 1],
    )[0];
    assert.ok(factoryBearing, 'the original factory screw supplies its actual bearing face');
    near(
      bearing.point.z,
      factoryBearing.point.z,
      'replacement preserves the factory screw bearing',
    );
    const underside = hits(lid, [seat.x + 2.5, seat.y, spec.bodySeamZ - 0.1], [0, 0, 1])[0];
    assert.ok(underside);
    near(bearing.point.z - underside.point.z, 3, 'solid load web below the head');
    assert.ok(seat.headRecess > 1, 'complete head stays below the curved roof');
    near(seat.factoryScrewTipZ - seat.blindBottomZ, 1.7, 'blind-hole tip clearance');
    near(spec.modifiedScrewUnderHeadLength, 12.3, 'source screw shortened only at its tip');
    near(seat.screwHeadTopZ, new Box3().setFromObject(factoryScrews, true).max.z, 'lowered source head top');
  }
});

test('smooth lid seats and source screw clearance remain valid across the supported pipe sizes', () => {
  for (const tubeOD of [89, 90, 92]) {
    for (const windowClearance of [0, 1.5]) {
      const parameters = { ...defaults, tubeOD, windowClearance };
      const s = replacementLidSpec(parameters);
      const model = geometry(replacementLidPieces(parameters));
      model.updateMatrixWorld(true);
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.side = DoubleSide;
      });
      try {
        for (const seat of s.screwSeats) {
          assert.ok(seat.headRecess > 1);
          near(seat.factoryScrewTipZ - seat.blindBottomZ, 1.7, 'tip clearance independent of tube size');
          const bearing = hits(model, [seat.x + 2.5, seat.y, 100], [0, 0, -1])[0];
          const bottom = hits(model, [seat.x + 2.5, seat.y, s.bodySeamZ - .1], [0, 0, 1])[0];
          assert.ok(bearing && bottom);
          near(bearing.point.z - bottom.point.z, 3, 'actual internal bearing web');
          assert.ok(seat.factoryScrewTipZ < s.insertBottomZ && seat.bearingZ > s.insertTopZ, 'retained screw traverses the complete insert');
        }
      } finally { disposeModel(model); }
    }
  }
});

test('the real curved print preserves the full part and declares removable underside supports', () => {
  assert.strictEqual(pieces[0].printShape, pieces[0].shape);
  assert.equal(spec.supportsRequired, true);
  assert.match(spec.printOrientation, /Support the open underside/);
  assert.match(spec.thicknessScope, /1 mm radial lip/);
  assert.equal(pieces[0].nativeRefine, true, 'native refinement closes the verified gland STL seams');
  assert.equal(pieces[0].preserveAuthoredFrame, true, 'refinement does not change the authored seating frame');
});
