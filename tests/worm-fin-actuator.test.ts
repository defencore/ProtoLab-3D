import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { Box3, Euler, Mesh, Quaternion, Ray, Vector3, type Object3D } from 'three';
import part from '../src/parts/worm-fin-actuator/part';
import { layout, tr8 } from '../src/parts/worm-fin-actuator/lib/layout';
import { gearProfiles } from '../src/parts/worm-fin-actuator/lib/gear';
import { housingLayout } from '../src/parts/worm-fin-actuator/lib/housing';
import { pieces, libraries } from '../src/parts/worm-fin-actuator/lib/model';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import { parseDetailRecipe } from '../src/core/component-recipes';
import { boundaryThreadCallouts } from '../src/core/assembly/boundary/shapes';
import { withGeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

const parameters = (extra: Parameters = {}): Parameters => ({ ...part.defaults, ...extra });
const near = (a: number, b: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);

/** Ray parity probes inspect actual placed solids, independently of their recipes. */
function containsPoint(model: Object3D, point: Vector3): boolean {
  const ray = new Ray(point, new Vector3(1, 0.371, 0.267).normalize());
  const hits: number[] = [];
  const vertices = [new Vector3(), new Vector3(), new Vector3()];
  const hit = new Vector3();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    const index = object.geometry.index;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      vertices.forEach((vertex, j) =>
        vertex
          .fromBufferAttribute(positions, index ? index.getX(i + j) : i + j)
          .applyMatrix4(object.matrixWorld),
      );
      if (ray.intersectTriangle(vertices[0], vertices[1], vertices[2], false, hit))
        hits.push(point.distanceTo(hit));
    }
  });
  hits.sort((a, b) => a - b);
  return hits.filter((distance, i) => !i || distance - hits[i - 1] > 1e-7).length % 2 === 1;
}

function inspectPiece(p: Parameters, id: string, inspect: (model: Object3D) => void) {
  const piece = pieces(p, 'assembled').find((item) => item.component.id === id);
  assert.ok(piece, id);
  const model = componentGeometry(libraries, [piece]);
  try {
    model.updateMatrixWorld(true);
    inspect(model);
  } finally {
    disposeModel(model);
  }
}

function inspectHousing(
  p: Parameters,
  inspect: (base: Object3D, lid: Object3D, solid: (point: Vector3) => boolean) => void,
) {
  inspectPiece(p, 'housing-base', (base) =>
    inspectPiece(p, 'housing-lid', (lid) =>
      inspect(base, lid, (point) => containsPoint(base, point) || containsPoint(lid, point)),
    ),
  );
}

/** Vertical intersections identify inaccessible voids between two material intervals. */
function verticalIntersections(model: Object3D) {
  const triangles: [Vector3, Vector3, Vector3][] = [];
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position'),
      index = object.geometry.index;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3)
      triangles.push(
        [0, 1, 2].map((j) =>
          new Vector3()
            .fromBufferAttribute(positions, index ? index.getX(i + j) : i + j)
            .applyMatrix4(object.matrixWorld),
        ) as [Vector3, Vector3, Vector3],
      );
  });
  const bottom = new Box3().setFromObject(model, true).min.z - 1;
  return (x: number, y: number): number[] => {
    const ray = new Ray(new Vector3(x, y, bottom), new Vector3(0, 0, 1)),
      hit = new Vector3(),
      hits: number[] = [];
    for (const triangle of triangles)
      if (ray.intersectTriangle(...triangle, false, hit)) hits.push(hit.z);
    hits.sort((a, b) => a - b);
    return hits.filter((z, i) => !i || z - hits[i - 1] > 1e-6);
  };
}

test('low-profile output shaft has separate large and small flanged bearing supports', () => {
  const v = layout(parameters());
  assert.deepEqual(
    [
      v.front.id,
      v.front.bore,
      v.front.outer,
      v.front.width,
      v.front.flangeOuter,
      v.front.flangeWidth,
    ],
    ['F6802ZZ', 15, 24, 5, 26, 1.1],
  );
  assert.deepEqual(
    [
      v.inner.id,
      v.inner.bore,
      v.inner.outer,
      v.inner.width,
      v.inner.flangeOuter,
      v.inner.flangeWidth,
    ],
    ['F688ZZ', 8, 16, 5, 18, 1.1],
  );
  assert.deepEqual(
    [
      v.wormBearing.id,
      v.wormBearing.bore,
      v.wormBearing.outer,
      v.wormBearing.width,
      v.wormBearing.flangeOuter,
      v.wormBearing.flangeWidth,
    ],
    ['F685ZZ', 5, 11, 5, 12.5, 1],
  );
  assert.ok(v.front.bore > v.inner.bore && v.front.outer > v.inner.outer);
  assert.ok(
    v.innerTop < v.gearBottom && v.frontBottom > v.gearTop,
    'The two output bearings straddle the geared square seat.',
  );
  assert.ok(
    v.squareAF * Math.SQRT2 < v.front.bore,
    'The square drive can pass through the front bearing during assembly.',
  );
  assert.ok(v.bodyDepth < 25, 'The default output stack stays below 25 mm.');
  near(v.frontTop - v.frontBottom, v.front.width);
  near(v.innerTop - v.innerBottom, v.inner.width);
  const large = layout(parameters({ frontBearing: 'F6804ZZ' }));
  assert.deepEqual(
    [
      large.front.bore,
      large.front.outer,
      large.front.width,
      large.front.flangeOuter,
      large.front.flangeWidth,
    ],
    [20, 32, 7, 35, 1.5],
  );
  assert.ok(large.pitchRadius > v.pitchRadius);
  assert.deepEqual(
    large.inner,
    v.inner,
    'Changing the front bearing retains the second output support.',
  );
});

test('TR8x8 retains four starts and 2 mm pitch while travel determines integer teeth', () => {
  assert.deepEqual(tr8, {
    diameter: 8,
    pitchDiameter: 7,
    pitch: 2,
    lead: 8,
    starts: 4,
    includedAngle: 30,
  });
  const base = layout(parameters());
  const narrow = layout(parameters({ travel: 20 }));
  assert.ok(Number.isInteger(base.teeth) && base.teeth % 4 === 0);
  near(base.module, 2 / Math.PI);
  near(base.ratio, base.teeth / 4);
  near((base.pitchRadius * 2 * Math.PI) / base.teeth, 2);
  near(base.centerDistance, base.pitchRadius + 3.5 + base.meshClearance);
  assert.ok(base.actualTurns >= base.targetTurns);
  assert.ok(narrow.teeth > base.teeth);
  near(narrow.module, base.module);
  const lower = layout(parameters(), 'negative-limit');
  const upper = layout(parameters(), 'positive-limit');
  near(lower.angle, -20);
  near(upper.angle, 20);
  near((upper.wormAngle - lower.wormAngle) / 360, base.actualTurns);
  assert.ok(base.halfSector > base.travel / 2);
  for (const frontBearing of ['F6802ZZ', 'F6804ZZ']) {
    const v = layout(parameters({ frontBearing }));
    assert.ok(
      Math.hypot(v.wormBearingStart, v.centerDistance - v.wormBearing.outer / 2) > v.gearTipRadius,
      'The support bearing envelopes clear the rotating gear.',
    );
  }
});

test('3 mm laser stock contains finished tooth sections and has a square drive opening', () => {
  const p = parameters();
  const v = layout(p);
  const profile = gearProfiles(p);
  near(v.plateThickness, 3);
  assert.ok(profile.layers.length >= 3);
  near(profile.layers[0].z, -1.5);
  near(profile.layers.at(-1)!.z, 1.5);
  for (const layer of profile.layers) {
    assert.equal(layer.points.length, profile.blank.length);
    assert.ok(layer.points.flat().every(Number.isFinite));
    for (let i = 0; i < layer.points.length; i++)
      assert.ok(
        Math.hypot(...profile.blank[i]) + 1e-6 >= Math.hypot(...layer.points[i]),
        'The laser stock contains every finished tooth section.',
      );
  }
  assert.ok(
    profile.layers.some((layer) =>
      layer.points.some(
        (point, i) =>
          Math.hypot(
            point[0] - profile.layers[0].points[i][0],
            point[1] - profile.layers[0].points[i][1],
          ) > 1e-4,
      ),
    ),
    'The TR8 finishing reference includes depth-dependent flanks.',
  );
  assert.equal(profile.square.length, 4);
  const xs = profile.square.map(([x]) => x),
    ys = profile.square.map(([, y]) => y);
  near(Math.max(...xs) - Math.min(...xs), v.squareAF + 0.08);
  near(Math.max(...ys) - Math.min(...ys), v.squareAF + 0.08);
  const dxf = part.fabricationFiles!(p).find((file) => file.name.toLowerCase().endsWith('.dxf'));
  assert.ok(dxf && dxf.content.length > 100, 'The laser blank has a downloadable drawing.');
  assert.match(dxf.content, /SECTION/);
  assert.match(dxf.content, /(?:POLYLINE|LINE)/);
});

test('finished tooth surfaces clear a nominal four-start TR8 screw across the complete default travel', () => {
  const p = parameters();
  const v = layout(p),
    profile = gearProfiles(p);
  let clearance = Infinity;
  const tau = 2 * Math.PI;
  // Independent nominal Tr30 axial section: no cutter inflation or flank allowance.
  const screwRadius = (x: number, y: number, z: number, rotation: number) => {
    const theta = Math.atan2(y - v.centerDistance, -z);
    const axialPhase = ((theta - rotation - (tau * x) / 8) * 8) / tau;
    const axial = Math.abs(((((axialPhase + 1) % 2) + 2) % 2) - 1);
    return Math.max(v.rootDiameter / 2, Math.min(4, 3.5 + (0.5 - axial) / Math.tan(Math.PI / 12)));
  };
  for (let degree = -v.travel / 2; degree <= v.travel / 2; degree++) {
    const angle = (degree * Math.PI) / 180;
    for (let k = 0; k < profile.layers.length - 1; k++) {
      const a = profile.layers[k],
        b = profile.layers[k + 1];
      for (const fraction of [0, 0.5, 1]) {
        const z = a.z * (1 - fraction) + b.z * fraction;
        for (let i = 0; i < a.points.length; i++) {
          const j = (i + 1) % a.points.length;
          for (const edge of [0, 0.5]) {
            const x =
              ((1 - edge) * a.points[i][0] + edge * a.points[j][0]) * (1 - fraction) +
              ((1 - edge) * b.points[i][0] + edge * b.points[j][0]) * fraction;
            const y =
              ((1 - edge) * a.points[i][1] + edge * a.points[j][1]) * (1 - fraction) +
              ((1 - edge) * b.points[i][1] + edge * b.points[j][1]) * fraction;
            const worldX = x * Math.cos(angle) - y * Math.sin(angle);
            const worldY = x * Math.sin(angle) + y * Math.cos(angle);
            if (Math.abs(worldX) > v.threadHalf) continue;
            const radius = Math.hypot(worldY - v.centerDistance, z);
            if (radius > 4.2) continue;
            clearance = Math.min(
              clearance,
              radius - screwRadius(worldX, worldY, z, angle * v.ratio),
            );
          }
        }
      }
    }
  }
  assert.ok(
    Number.isFinite(clearance) && clearance > 0.01,
    `A finished section or interpolated flank penetrates the nominal screw: ${clearance} mm.`,
  );
});

test('clean turned journals and output circlip grooves are cut into the real solids', () => {
  const p = parameters();
  const v = layout(p);
  assert.deepEqual([v.gearClip.ring, v.gearClip.diameter, v.gearClip.width], [10, 9.6, 1.1]);
  assert.deepEqual([v.rearClip.ring, v.rearClip.diameter, v.rearClip.width], [8, 7.6, 0.9]);
  assert.ok(v.gearClip.center < v.gearBottom && v.gearClip.center > v.innerTop);
  assert.ok(v.rearClip.center < v.innerBottom);
  assert.equal(v.wormGrooves.length, 4);
  for (const groove of v.wormGrooves)
    assert.deepEqual([groove.ring, groove.diameter, groove.width], [5, 4.8, 0.7]);
  const journals = v.screwStations.filter((station) => /bearing journal/.test(station.label));
  assert.equal(journals.length, 2);
  assert.ok(
    journals.every((station) => station.diameter === 5 && station.diameter < v.rootDiameter),
    'The bearing journals remove the complete thread root.',
  );
  inspectPiece(p, 'output-sleeve', (model) => {
    for (const groove of [v.gearClip, v.rearClip]) {
      assert.equal(
        containsPoint(model, new Vector3(0, groove.diameter / 2 + 0.05, groove.center)),
        false,
        'The circlip recess is genuinely removed from the sleeve.',
      );
      assert.ok(
        containsPoint(model, new Vector3(0, groove.diameter / 2 - 0.05, groove.center)),
        'A positive journal core remains beneath each groove.',
      );
    }
  });
  inspectPiece(p, 'worm', (model) => {
    for (const groove of v.wormGrooves) {
      assert.equal(
        containsPoint(model, new Vector3(groove.center, v.centerDistance + 2.45, 0)),
        false,
        'The worm end has a cut Ø4.8 ring groove.',
      );
      assert.ok(
        containsPoint(model, new Vector3(groove.center, v.centerDistance + 2.35, 0)),
        'The worm journal retains its root under the ring.',
      );
    }
  });
});

test('the removed fin platform leaves only the two blind sleeve attachment receivers', () => {
  const p = parameters(),
    v = layout(p),
    physical = pieces(p, 'assembled');
  assert.ok(
    !physical.some((piece) =>
      /^(fin-platform|pin-\d+|platform-screw-\d+)$/.test(piece.component.id),
    ),
    'The removed platform, pins and platform fasteners are absent from the physical assembly.',
  );
  assert.ok(
    !physical.some((piece) => /Removable fin platform|blade|fin body|hydrofoil/i.test(piece.label)),
  );
  for (const key of ['pinDiameter', 'pinLength', 'pinSpacing', 'finHoleSpacing']) {
    assert.ok(!Object.hasOwn(part.defaults, key), key);
    assert.ok(!part.parameters.some((field) => field.key === key), key);
  }
  assert.ok(!part.states?.some((state) => state.id === 'mount'));
  inspectPiece(p, 'output-sleeve', (model) => {
    for (const side of [-1, 1]) {
      const x = (side * v.mountHoleSpacing) / 2;
      assert.equal(containsPoint(model, new Vector3(x, 0, v.sleeveHeadTop - 2)), false);
      assert.ok(containsPoint(model, new Vector3(x, 2, v.sleeveHeadTop - 2)));
      assert.ok(
        containsPoint(model, new Vector3(x, 0, v.sleeveHeadTop - 6)),
        'The retained sleeve receivers are blind tapped holes with material beneath their floors.',
      );
    }
  });
});

test('the two retained M3 sleeve receivers preserve machining callouts', () => {
  const physical = pieces(parameters(), 'assembled');
  for (const [id, count, diameter, pitch] of [['output-sleeve', 2, 3, 0.5]] as const) {
    const piece = physical.find((item) => item.component.id === id);
    assert.ok(piece, id);
    const recipe = parseDetailRecipe(String(piece.component.parameters.recipe));
    for (const mode of ['simple', 'full'] as const) {
      const callouts = withGeometryMode(mode, () => boundaryThreadCallouts(recipe));
      assert.equal(callouts.length, count, `${id}: each threaded receiver has its own feature.`);
      for (const feature of callouts) {
        assert.equal(feature.internal, true, `${id}: a clearance bore is not a tapped receiver.`);
        near(feature.nominalDiameter, diameter);
        near(feature.pitch, pitch);
        assert.ok(feature.length >= 3 && feature.origin?.every(Number.isFinite));
        assert.equal(
          feature.representation,
          mode === 'full' ? 'machined-helix' : 'nominal-cylinder',
        );
      }
    }
  }
  const native = part.python(parameters(), 'assembled');
  assert.match(native, /ThreadFeaturesJSON/);
  assert.ok(native.includes('M3×0.5 RH'), 'The export retains the M3 machining designation.');
});

test('opposed bearing flanges seat directly in the split case without bearing cover screws', () => {
  const p = parameters(),
    v = layout(p);
  const physical = pieces(p, 'assembled');
  assert.equal(physical.length, 30);
  assert.ok(
    !physical.some((piece) => /bearing.*cover|cover.*bearing/i.test(piece.component.id)),
    'The flanged closed stack does not retain obsolete clamp covers.',
  );
  assert.deepEqual(
    physical
      .filter((piece) => piece.component.libraryId === 'bolt-screw')
      .map((piece) => piece.component.id)
      .sort(),
    ['case-screw-1', 'case-screw-2', 'case-screw-3', 'case-screw-4'],
  );
  assert.equal(
    physical.filter((piece) => piece.component.libraryId === 'retaining-ring').length,
    6,
  );
  for (const id of ['housing-base', 'housing-lid']) {
    const housingPiece = physical.find((piece) => piece.component.id === id);
    assert.ok(housingPiece);
    assert.deepEqual(
      boundaryThreadCallouts(parseDetailRecipe(String(housingPiece.component.parameters.recipe))),
      [],
      'Case fasteners pass through clearance holes and engage separate captive nuts.',
    );
  }
  const frontProbe = (v.front.outer + v.front.flangeOuter) / 4;
  const innerProbe = (v.inner.outer + v.inner.flangeOuter) / 4;
  inspectPiece(p, 'front-bearing', (model) => {
    assert.ok(
      containsPoint(model, new Vector3(0, -frontProbe, v.frontTop - v.front.flangeWidth / 2)),
    );
    assert.equal(
      containsPoint(model, new Vector3(0, -frontProbe, v.frontBottom + 0.2)),
      false,
      'The larger output bearing flange points toward the front.',
    );
  });
  inspectPiece(p, 'inner-bearing', (model) => {
    assert.ok(
      containsPoint(model, new Vector3(0, -innerProbe, v.innerBottom + v.inner.flangeWidth / 2)),
    );
    assert.equal(
      containsPoint(model, new Vector3(0, -innerProbe, v.innerTop - 0.2)),
      false,
      'The smaller output bearing flange points toward the rear.',
    );
  });
  inspectHousing(p, (_base, _lid, solid) => {
    const frontSeat = v.frontTop - v.front.flangeWidth;
    assert.ok(solid(new Vector3(0, -frontProbe, frontSeat - 0.05)));
    assert.equal(solid(new Vector3(0, -frontProbe, frontSeat + 0.05)), false);
    const rearSeat = v.innerBottom + v.inner.flangeWidth;
    assert.ok(solid(new Vector3(0, -innerProbe, rearSeat + 0.05)));
    assert.equal(solid(new Vector3(0, -innerProbe, rearSeat - 0.05)), false);
    const wormProbe = (v.wormBearing.outer + v.wormBearing.flangeOuter) / 4;
    for (const side of [-1, 1]) {
      const seat = side * (v.wormBearingEnd - v.wormBearing.flangeWidth);
      assert.ok(
        solid(new Vector3(seat - side * 0.05, v.centerDistance + wormProbe, 0.2)),
        'Each outward worm-bearing flange meets a solid case shoulder.',
      );
      assert.equal(
        solid(new Vector3(seat + side * 0.05, v.centerDistance + wormProbe, 0.2)),
        false,
      );
    }
  });
  for (const side of [-1, 1]) {
    inspectPiece(p, side < 0 ? 'worm-bearing-left' : 'worm-bearing-right', (model) => {
      const probe = (v.wormBearing.outer + v.wormBearing.flangeOuter) / 4;
      const x = side * (v.wormBearingEnd - v.wormBearing.flangeWidth / 2);
      assert.ok(
        containsPoint(model, new Vector3(x, v.centerDistance + probe, 0)),
        'The worm flange faces outward on each end of the fixed shaft.',
      );
    });
  }
});

test('the larger output bearing housing clears both worm flanges while preserving their seat shoulders', () => {
  const p = parameters({ frontBearing: 'F6804ZZ', driveStubLength: 12 }),
    v = layout(p);
  const radial = v.wormBearing.outer / 2 + 0.2;
  const depths = [0.1, v.frontBottom + 0.2];
  inspectHousing(p, (_base, _lid, solid) => {
    for (const side of [-1, 1]) {
      const flange = side * (v.wormBearingEnd - v.wormBearing.flangeWidth / 2);
      const shoulder = side * (v.wormBearingEnd - v.wormBearing.flangeWidth - 0.05);
      for (const sign of [-1, 1])
        for (const z of depths) {
          const y = v.centerDistance + sign * radial;
          assert.equal(
            solid(new Vector3(flange, y, z)),
            false,
            'The main bearing carrier must not occupy the worm bearing flange envelope.',
          );
          assert.ok(
            solid(new Vector3(shoulder, y, z)),
            'Flange relief must leave the bearing-block shoulder intact.',
          );
        }
    }
  });
  // The inward flange quadrant at front-ring depth is an actual bearing surface,
  // rather than a trivially empty point outside the entire case envelope.
  for (const side of [-1, 1])
    inspectPiece(p, side < 0 ? 'worm-bearing-left' : 'worm-bearing-right', (model) => {
      const x = side * (v.wormBearingEnd - v.wormBearing.flangeWidth / 2);
      assert.ok(containsPoint(model, new Vector3(x, v.centerDistance - radial, depths[1])));
    });
});

test('both compact housing halves have face-accessible pockets without hidden vertical undercuts', () => {
  for (const p of [parameters(), parameters({ frontBearing: 'F6804ZZ', driveStubLength: 12 })]) {
    const h = housingLayout(p);
    near(h.splitZ, 0);
    assert.ok(h.depth <= 24.25 && h.width < 55 && h.height < 55);
    assert.ok(
      layout(p).driveEnd >= h.xHalf + 3,
      'The drive stub exposes at least 3 mm beyond the case.',
    );
    inspectHousing(p, (base, lid, solid) => {
      const baseBounds = new Box3().setFromObject(base, true),
        lidBounds = new Box3().setFromObject(lid, true);
      near(baseBounds.min.z, h.baseBottom, 0.0001);
      near(baseBounds.max.z, h.locatorHeight, 0.0001);
      near(lidBounds.min.z, h.splitZ, 0.0001);
      near(lidBounds.max.z, h.lidTop, 0.0001);
      for (const [id, model] of [
        ['base', base],
        ['lid', lid],
      ] as const) {
        const intersections = verticalIntersections(model);
        // Offset the grid from exact mesh edges and the split's locator boundaries.
        for (let i = 0; i < 27; i++)
          for (let j = 0; j < 29; j++) {
            const x = -h.xHalf + ((i + 0.37) * h.width) / 27,
              y = h.yMin + ((j + 0.53) * h.height) / 29,
              hits = intersections(x, y);
            assert.ok(
              hits.length === 0 || hits.length === 2,
              `${id}: a vertical cutter meets a hidden cavity at ${x}, ${y}: ${hits}`,
            );
          }
      }
      for (const [x, y] of h.locatorPositions) {
        assert.ok(containsPoint(base, new Vector3(x, y, h.locatorHeight / 2)));
        assert.equal(containsPoint(lid, new Vector3(x, y, h.locatorHeight / 2)), false);
        assert.ok(containsPoint(lid, new Vector3(x, y, h.locatorDepth + 0.2)));
      }
      assert.equal(solid(new Vector3(h.gearPocketRadius - 0.2, 0, -0.5)), false);
      assert.equal(solid(new Vector3(h.gearPocketRadius - 0.2, 0, 0.5)), false);
      assert.ok(solid(new Vector3(0, h.yMin + 0.4, -0.5)));
      assert.ok(solid(new Vector3(0, h.yMin + 0.4, 0.5)));
    });
  }
});

test('four flush case screws engage fixed captive nuts inside open machining pockets', () => {
  const p = parameters(),
    h = housingLayout(p),
    physical = pieces(p, 'assembled');
  near(h.depth, 20.25);
  assert.equal(h.screwLength, 20);
  assert.equal(h.boltPositions.length, 4);
  assert.equal(physical.filter((piece) => piece.component.libraryId === 'hex-nut').length, 4);
  assert.ok(h.nutPocketAF > 5.5 && h.nutCornerRadius >= 1.5);
  inspectHousing(p, (_base, lid, solid) => {
    for (let i = 1; i <= 4; i++) {
      const id = `case-screw-${i}`;
      const screw = physical.find((piece) => piece.component.id === id)!;
      assert.equal(screw.component.procurement?.designation, 'DIN 7991 M3×20');
      near(Number(screw.component.parameters.headSize), 6);
      near(Number(screw.component.parameters.headHeight), 1.7);
      inspectPiece(p, id, (model) => {
        const bounds = new Box3().setFromObject(model, true);
        near(bounds.max.z, h.lidTop, 0.0001);
        assert.ok(bounds.min.z >= h.baseBottom + 0.1, `${id}: screw tip stays inside the case.`);
      });
      const nut = physical.find((piece) => piece.component.id === `case-nut-${i}`)!;
      assert.deepEqual(nut.component.placement.rotation, [0, 0, 0]);
      inspectPiece(p, nut.component.id, (model) => {
        const bounds = new Box3().setFromObject(model, true);
        near(bounds.min.z, h.nutBottom, 0.0001);
        near(bounds.max.z, h.nutBottom + h.nutHeight, 0.0001);
      });
      const [x, y] = h.boltPositions[i - 1];
      for (let corner = 0; corner < 6; corner++) {
        const a = Math.PI / 6 + (corner * Math.PI) / 3,
          r = 5.5 / Math.sqrt(3);
        assert.equal(
          solid(new Vector3(x + r * Math.cos(a), y + r * Math.sin(a), h.nutBottom + 1.2)),
          false,
          'The rounded captive pocket admits every corner of the fixed M3 nut.',
        );
      }
      for (const z of [0.2, h.lidTop - 1, h.lidTop + 0.2])
        assert.equal(containsPoint(lid, new Vector3(x, y, z)), false);
      assert.equal(
        containsPoint(lid, new Vector3(x + 3.04, y, h.lidTop - 0.05)),
        false,
        'The head pocket clears the specified Ø6 DIN 7991 screw head.',
      );
      assert.ok(
        containsPoint(lid, new Vector3(x + 3.15, y, h.lidTop - 0.05)),
        'The Ø6.2 head recess retains material outside its finished diameter.',
      );
      assert.ok(solid(new Vector3(x + 3.6, y, h.nutBottom + 1.2)));
    }
  });
});

test('the actual case clears the complete rotational sweeps of the gear and retaining rings', () => {
  const p = parameters(),
    v = layout(p);
  inspectHousing(p, (_base, _lid, solid) => {
    for (const id of ['sector-wheel', 'gear-clip', 'rear-clip'])
      inspectPiece(p, id, (model) => {
        const bounds = new Box3().setFromObject(model, true);
        let radius = 0;
        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const positions = object.geometry.getAttribute('position'),
            vertex = new Vector3();
          for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            radius = Math.max(radius, Math.hypot(vertex.x, vertex.y));
          }
        });
        for (let a = 0; a < 32; a++)
          for (const z of [
            bounds.min.z + 0.05,
            (bounds.min.z + bounds.max.z) / 2,
            bounds.max.z - 0.05,
          ]) {
            const angle = (a * 2 * Math.PI) / 32;
            assert.equal(
              solid(new Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z)),
              false,
              `${id}: the entire circular sweep fits the real case cavity.`,
            );
          }
      });
    for (const groove of v.wormGrooves)
      for (let a = 0; a < 24; a++) {
        const angle = (a * 2 * Math.PI) / 24;
        assert.equal(
          solid(
            new Vector3(
              groove.center,
              v.centerDistance + 3.8 * Math.cos(angle),
              3.8 * Math.sin(angle),
            ),
          ),
          false,
          'The worm retaining ring and thrust spacer sweep clears the split trough and end reliefs.',
        );
      }
  });
});

test('housing inspection states preserve physical component identities and fabrication recipes', () => {
  const p = parameters(),
    assembled = pieces(p, 'assembled');
  for (const id of ['housing-base', 'housing-lid']) {
    const isolated = pieces(p, id);
    assert.equal(isolated.length, 1);
    assert.deepEqual(
      isolated[0].component,
      assembled.find((piece) => piece.component.id === id)!.component,
    );
  }
  const open = pieces(p, 'housing-open');
  assert.deepEqual(
    open.map((piece) => piece.component),
    assembled.map((piece) => piece.component),
  );
  assert.deepEqual(
    open
      .filter((piece) => piece.position?.[2] === 22)
      .map((piece) => piece.component.id)
      .sort(),
    ['case-screw-1', 'case-screw-2', 'case-screw-3', 'case-screw-4', 'housing-lid'],
  );
  assert.ok(pieces(p, 'internals').every((piece) => !/^(housing-|case-)/.test(piece.component.id)));
});

test('selected thrust shims close the bearing and circlip stack with bounded groove float', () => {
  const p = parameters(),
    v = layout(p),
    physical = pieces(p, 'assembled');
  const bounds = (id: string): Box3 => {
    const piece = physical.find((item) => item.component.id === id);
    assert.ok(piece, id);
    const model = componentGeometry(libraries, [piece]);
    try {
      model.updateMatrixWorld(true);
      return new Box3().setFromObject(model, true);
    } finally {
      disposeModel(model);
    }
  };
  const frontShim = bounds('front-thrust-shim');
  near(frontShim.min.z, bounds('front-bearing').max.z, 0.0001);
  near(frontShim.max.z, v.sleeveHeadBottom, 0.0001);
  assert.ok(v.thrustShims.front > 0);
  const gearWasher = bounds('gear-thrust-washer'),
    gearClip = bounds('gear-clip');
  near(gearWasher.min.z, gearClip.max.z, 0.0001);
  near(gearWasher.max.z, bounds('sector-wheel').min.z, 0.0001);
  const rearWasher = bounds('rear-thrust-washer'),
    rearClip = bounds('rear-clip');
  near(rearWasher.min.z, rearClip.max.z, 0.0001);
  near(rearWasher.max.z, bounds('inner-bearing').min.z, 0.0001);
  for (const [groove, clipBounds] of [
    [v.gearClip, gearClip],
    [v.rearClip, rearClip],
  ] as const) {
    const float = groove.width - (clipBounds.max.z - clipBounds.min.z);
    assert.ok(
      float >= -0.0001 && float <= 0.1001,
      'The nominal output stack leaves only the declared ring-to-groove float.',
    );
  }
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'left' : 'right';
    const interval = (id: string) => {
      const b = bounds(id);
      return side > 0 ? [b.min.x, b.max.x] : [-b.max.x, -b.min.x];
    };
    const innerClip = interval(`worm-inner-clip-${name}`);
    const innerShim = interval(`worm-inner-washer-${name}`);
    const bearing = interval(`worm-bearing-${name}`);
    const outerShim = interval(`worm-outer-washer-${name}`);
    const outerClip = interval(`worm-outer-clip-${name}`);
    near(innerClip[1], innerShim[0], 0.0001);
    near(innerShim[1], bearing[0], 0.0001);
    near(bearing[1], outerShim[0], 0.0001);
    near(outerShim[1], outerClip[0], 0.0001);
    assert.ok(0.7 - (innerClip[1] - innerClip[0]) <= 0.1001);
    assert.ok(0.7 - (outerClip[1] - outerClip[0]) <= 0.1001);
  }
});

test('bearings, clips and rotating components preserve their library identities', () => {
  const p = parameters();
  const assembly = part.composition!(p);
  assert.deepEqual(part.composition!(parameters({ outputAngle: 7 })), assembly);
  assert.deepEqual(
    part.identityParameters!(parameters({ outputAngle: 7 })),
    part.identityParameters!(p),
  );
  assert.equal(
    new Set(assembly.components.map((item) => item.id)).size,
    assembly.components.length,
  );
  for (const id of ['front-bearing', 'inner-bearing', 'worm-bearing-left', 'worm-bearing-right']) {
    const component = assembly.components.find((item) => item.id === id);
    assert.ok(component, id);
    assert.equal(component.libraryId, 'flanged-ball-bearing');
  }
  for (const id of [
    'gear-clip',
    'rear-clip',
    'worm-inner-clip-left',
    'worm-inner-clip-right',
    'worm-outer-clip-left',
    'worm-outer-clip-right',
  ]) {
    const component = assembly.components.find((item) => item.id === id);
    assert.ok(component, id);
    assert.equal(component.libraryId, 'retaining-ring');
  }
  for (const component of assembly.components) {
    const definition = libraries.find((item) => item.id === component.libraryId);
    assert.ok(definition, component.id);
    assert.deepEqual(
      validateParameters(definition, component.parameters, component.state),
      [],
      component.id,
    );
  }
  const neutral = pieces(p, 'assembled');
  const rotated = pieces(parameters({ outputAngle: 7 }), 'assembled');
  for (const id of ['output-sleeve', 'sector-wheel', 'gear-clip', 'rear-clip']) {
    const a = neutral.find((item) => item.component.id === id);
    const b = rotated.find((item) => item.component.id === id);
    assert.ok(a && b, id);
    assert.deepEqual(
      a.component.parameters,
      b.component.parameters,
      `${id}: rotation retains local fabrication geometry.`,
    );
    near((b.angle ?? 0) - (a.angle ?? 0), 7);
  }
  const original = neutral.find((item) => item.component.id === 'worm');
  const spun = rotated.find((item) => item.component.id === 'worm');
  assert.ok(original && spun);
  const orientation = (rotation: [number, number, number]) =>
    new Quaternion().setFromEuler(
      new Euler(
        ...(rotation.map((angle) => (angle * Math.PI) / 180) as [number, number, number]),
        'ZYX',
      ),
    );
  const expected = new Quaternion()
    .setFromAxisAngle(
      new Vector3(1, 0, 0),
      (layout(parameters({ outputAngle: 7 })).wormAngle * Math.PI) / 180,
    )
    .multiply(orientation(original.component.placement.rotation));
  near(Math.abs(expected.dot(orientation(spun.component.placement.rotation))), 1);
});

test('TR8 configuration validation rejects impossible interfaces and obsolete defaults', () => {
  const largerBearing = part.updateParameters!(
    parameters({ frontBearing: 'F6804ZZ' }),
    'frontBearing',
  );
  assert.equal(largerBearing.driveStubLength, 12);
  assert.deepEqual(validateParameters(part, largerBearing, 'assembled'), []);
  assert.ok(layout(largerBearing).driveEnd >= housingLayout(largerBearing).xHalf + 3);
  const longerStub = part.updateParameters!(
    parameters({ frontBearing: 'F6804ZZ', driveStubLength: 20 }),
    'frontBearing',
  );
  assert.equal(
    longerStub.driveStubLength,
    20,
    'Selecting a larger housing retains a longer drive stub.',
  );
  const smallerBearing = part.updateParameters!(
    { ...longerStub, frontBearing: 'F6802ZZ' },
    'frontBearing',
  );
  assert.equal(
    smallerBearing.driveStubLength,
    20,
    'Selecting a smaller housing does not shorten the shaft.',
  );
  const explicitlyShortened = part.updateParameters!(
    { ...largerBearing, driveStubLength: 5 },
    'driveStubLength',
  );
  assert.equal(
    explicitlyShortened.driveStubLength,
    5,
    'An explicit shaft length edit is preserved.',
  );
  assert.ok(validateParameters(part, explicitlyShortened, 'assembled').length > 0);
  for (const patch of [
    { travel: 0 },
    { travel: 101 },
    { travel: Number.NaN },
    { inputTurns: 0 },
    { outputAngle: 21 },
    { frontBearing: 'missing' },
    { wormBearing: 'missing' },
    { frontBearing: 'custom', frontBore: 14 },
    { frontBearing: 'custom', frontBore: 25, frontOuter: 20 },
    { screwRootDiameter: 5 },
    { plateThickness: 0 },
    { housingWall: 1.9 },
    { housingWall: 4.1 },
    { housingJoinClearance: 0.09 },
    { housingJoinClearance: 0.51 },
    { driveStubLength: 5 },
  ] as Parameters[])
    assert.ok(
      validateParameters(part, parameters(patch), 'assembled').length > 0,
      JSON.stringify(patch),
    );
  assert.ok(validateParameters(part, parameters(), 'unknown').length > 0);
  assert.ok(
    !Object.hasOwn(part.defaults, 'bearing') && !Object.hasOwn(part.defaults, 'wormDiameter'),
  );
  for (const preset of part.presets)
    for (const state of part.states ?? [])
      assert.deepEqual(
        validateParameters(part, preset.parameters, state.id),
        [],
        `${preset.id}/${state.id}`,
      );
});

test('preview and FreeCAD export retain finite geometry and matching dimensions', () => {
  const p = parameters();
  const model = part.buildGeometry(p, 'assembled');
  try {
    model.updateMatrixWorld(true);
    const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
    part.dimensions(p, 'assembled').forEach((value, axis) => {
      assert.ok(Number.isFinite(value) && value > 0);
      near(value, actual[axis], 0.02);
    });
    assert.equal(model.children.length, pieces(p, 'assembled').length);
    let meshes = 0;
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshes++;
      const positions = object.geometry.getAttribute('position');
      assert.ok(positions.count > 0 && Array.from(positions.array).every(Number.isFinite));
    });
    assert.ok(meshes > 0);
  } finally {
    disposeModel(model);
  }
  const code = part.python(p, 'assembled');
  assert.match(code, /Part\.makeCompound\(components\)/);
  assert.match(code, /LibraryId/);
  assert.match(code, /Part\.make(?:Long)?Helix/);
  execFileSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], { input: code });
});
