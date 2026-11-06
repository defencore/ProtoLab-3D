import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3, type Group } from 'three';
import { defaults } from '../src/parts/grandado-tube-mount/configurator';
import {
  replacementLidGasketReference,
  replacementLidGroove,
  replacementLidPieces,
  replacementLidSpec,
} from '../src/parts/grandado-tube-mount/lib/replacement-lid';
import {
  grandadoPieces,
  grandadoRaisedRim,
  grandadoSpec,
} from '../src/parts/catalog-enclosure/lib/grandado';
import { grandadoRimPath } from '../src/parts/catalog-enclosure/lib/grandado-rim';
import { geometry } from '../src/core/assembly/boundary/assembly';
import { pythonShape, type Vec } from '../src/core/assembly/boundary/shapes';
import { disposeModel } from '../src/core/mechanical';

const s = replacementLidSpec(defaults),
  g = s.gasketGroove;
let groove: Group, channel: Group, body: Group, lid: Group, raisedRim: Group;
before(() => {
  groove = geometry([
    { shape: replacementLidGroove(defaults), label: 'Gland cutter', color: 0xffffff },
  ]);
  channel = geometry([
    {
      shape: replacementLidGasketReference(defaults),
      label: 'Measured channel occupied volume',
      color: 0xffffff,
    },
  ]);
  body = geometry([grandadoPieces('assembled')[0]]);
  body.position.z = s.bodyTranslation;
  raisedRim = geometry([
    { shape: grandadoRaisedRim(), label: 'Measured raised body rim', color: 0xffffff },
  ]);
  raisedRim.position.z = s.bodyTranslation;
  lid = geometry(replacementLidPieces(defaults));
  for (const model of [groove, channel, body, lid, raisedRim]) {
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
  }
});
after(() => {
  for (const model of [groove, channel, body, lid, raisedRim]) if (model) disposeModel(model);
});
function hits(model: Group, origin: Vec, direction: Vec) {
  return new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(
    model,
    true,
  );
}
function near(actual: number, expected: number, label: string, tolerance = 0.025) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);
}
function pathSamples() {
  return g.path.flatMap((segment) => {
    if (segment.kind === 'line') {
      const [a, b] = segment.points;
      return Array.from({ length: 9 }, (_, i) => [
        a[0] + ((b[0] - a[0]) * i) / 8,
        a[1] + ((b[1] - a[1]) * i) / 8,
      ]);
    }
    const [cx, cy] = segment.center,
      a = segment.points[0];
    const start = Math.atan2(a[1] - cy, a[0] - cx);
    return Array.from({ length: 13 }, (_, i) => [
      cx + segment.radius * Math.cos(start + ((Math.PI / 2) * i) / 12),
      cy + segment.radius * Math.sin(start + ((Math.PI / 2) * i) / 12),
    ]);
  });
}

test('one closed native gasket groove replaces the inward locating lip', () => {
  assert.equal(replacementLidPieces(defaults).length, 1);
  assert.equal(g.closed, true);
  assert.equal(g.path.filter((segment) => segment.kind === 'arc').length, 4);
  for (let i = 0; i < g.path.length; i++) {
    const end = g.path[i].points.at(-1)!,
      next = g.path[(i + 1) % g.path.length].points[0];
    near(Math.hypot(end[0] - next[0], end[1] - next[1]), 0, 'closed connected gland path', 1e-9);
  }
  const source = pythonShape(replacementLidGroove(defaults));
  assert.match(source, /Part\.makeCylinder/);
  assert.doesNotMatch(source, /makePolygon|makeShell|makeLoft/);
  assert.match(s.closureScope, /screw passages outside/);
  assert.match(s.closureScope, /No locating lip/);
  for (const [x, y] of [
    [0, 26.2],
    [0, -26.2],
    [38.7, 0],
    [-38.7, 0],
  ]) {
    const bottom = hits(lid, [x, y, s.bodySeamZ - 2], [0, 0, 1])[0];
    assert.ok(bottom);
    assert.ok(bottom.point.z >= s.bodySeamZ - 0.002, 'no inward dry step below the rim');
  }
});

test('the side groove retains its measured width while only the inner end flanks receive print-fit relief', () => {
  near(g.outerWall, 1.775, 'derived outside side wall', 1e-9);
  near(g.endWall, 1.725, 'derived outside end wall', 1e-9);
  near(g.width, 1.8, 'measured groove width', 1e-9);
  near(g.innerWall, 1, 'measured inside wall', 1e-9);
  near(s.skirtWall, 4.575, 'complete side section', 1e-9);
  near(s.skirtEndWall, 4.775, 'complete end section including fitting relief', 1e-9);
  near(g.totalRimWidth, 4.575, 'side section metadata', 1e-9);
  near(g.totalRimLength, 4.775, 'end section metadata', 1e-9);
  near(s.skirtInnerLength, 73.45, 'one-millimeter inner end wall', 1e-9);
  near(s.skirtInnerWidth, 48.85, 'one-millimeter inner side wall', 1e-9);
  near(s.skirtInnerCornerRadius, 0.225, 'inner opening follows the full end stock', 1e-9);
  near(g.axialFitAllowance, 0.5, 'total axial fitting correction', 1e-9);
  near(g.endWidth, 2.05, 'locally relieved end channel', 1e-9);
  near(g.railX, 38.875, 'approximate rim axial midline', 1e-9);
  near(g.railY, 26.325, 'approximate rim transverse midline', 1e-9);
  near(g.postCenterlineRadius, 3.9, 'post arc is not inferred from rim bounds', 1e-9);
  const bounds = new Box3().setFromObject(channel, true);
  near(bounds.min.z, s.bodySeamZ, 'channel mouth');
  near(bounds.max.z, s.bodySeamZ + 2, 'nominal maximum channel depth');
  assert.ok(!('section' in g) && !('nominalSqueeze' in g) && !('nominalFill' in g));
  assert.match(g.referenceEnvelope, /only the actual channel occupied volume/);
  assert.match(g.referenceEnvelope, /not an actual rubber solid/);
});

test('reported spans and measured rim height remain distinct from the approximate uniform-wall model', () => {
  const rim = g.measuredBodyRim;
  near(rim.outerLength, 78.7, 'corrected measured rim outside X', 1e-9);
  near(rim.outerWidth, 53.7, 'measured rim outside Y', 1e-9);
  near(rim.innerLength, 76.8, 'measured rim inside X', 1e-9);
  near(rim.innerWidth, 51.6, 'measured rim inside Y', 1e-9);
  assert.equal(rim.uniformWall, true);
  near(rim.inferredWallX, 0.95, 'corrected raw axial span difference only', 1e-9);
  near(rim.inferredWallY, 1.05, 'raw transverse span difference only', 1e-9);
  assert.ok(
    !('wallX' in rim) && !('wallY' in rim),
    'unequal raw differences are not actual wall geometry',
  );
  assert.match(rim.source, /uniform 1 mm.*measurement uncertainty/);
  near(rim.centerlineX, 38.875, 'rim end centerline', 1e-9);
  near(rim.centerlineY, 26.325, 'rim side centerline', 1e-9);
  near(rim.clearanceX, 0.425, 'balanced end fit', 1e-9);
  near(rim.clearanceY, 0.375, 'balanced side fit', 1e-9);
  near(rim.height, 1.8, 'measured raised-rim height', 1e-9);
  near(grandadoSpec.bodyHardHeight, 22, 'measured hard-body height', 1e-9);
  assert.match(rim.source, /corner profile and centring tolerances remain unmeasured/);
  near(g.raisedBodyRim.wall, 1, 'modeled uniform rim wall', 1e-9);
  near(g.raisedBodyRim.height, 1.8, 'measured raised-rim metadata height', 1e-9);
  near(g.raisedBodyRim.railX, 38.85, 'source uniform-rim X centreline', 1e-9);
  near(g.raisedBodyRim.railY, 26.35, 'source uniform-rim Y centreline', 1e-9);
  near(g.raisedBodyRim.topZ, 33, 'installed rim top', 1e-9);
  near(g.raisedBodyRim.endClearance, 0.425, 'minimum uniform-rim end clearance', 1e-9);
  near(g.raisedBodyRim.sideClearance, 0.375, 'minimum uniform-rim side clearance', 1e-9);
  near(g.raisedBodyRim.cornerClearance, 0.4, 'concentric post-turn clearance', 1e-9);
  near(g.raisedBodyRim.floorClearance, 0.2, 'rigid-rim floor clearance', 1e-9);
  for (const segment of g.path)
    if (segment.kind === 'arc') {
      assert.ok(
        s.screwSeats.some(
          ({ x, y }) =>
            Math.abs(x - segment.center[0]) < 1e-9 && Math.abs(y - segment.center[1]) < 1e-9,
        ),
      );
      near(segment.radius, 3.9, 'existing post relief retained', 1e-9);
    }
});

test('the actual straight channel relieves only the inner end flank and preserves both inner walls', () => {
  for (const direction of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ] as Vec[]) {
    const distances: number[] = [];
    for (const hit of hits(lid, [0, 0, s.bodySeamZ + 0.5], direction))
      if (!distances.some((v) => Math.abs(v - hit.distance) < 0.01)) distances.push(hit.distance);
    assert.ok(distances.length >= 4, 'inner wall, channel and outer wall exist in the actual lid');
    const axisX = Math.abs(direction[0]) === 1,
      rim = g.measuredBodyRim;
    const inner = (axisX ? rim.innerLength : rim.innerWidth) / 2;
    const outer = (axisX ? rim.outerLength : rim.outerWidth) / 2;
    const outerClearance = axisX ? 0.425 : 0.375;
    const innerClearance = axisX ? 0.675 : 0.375;
    near(distances[1] - distances[0], 1, 'complete inner wall');
    near(distances[2] - distances[1], axisX ? 2.05 : 1.8, 'actual groove width');
    near(inner - distances[1], innerClearance, 'inside approximate rim-bound clearance');
    near(distances[2] - outer, outerClearance, 'outside approximate rim-bound clearance');
    near(distances[3] - distances[2], axisX ? 1.725 : 1.775, 'derived outside wall');
    assert.ok(
      outerClearance > (axisX ? 0.3 : 0.2),
      'minimum fit improves over the prior off-center channel',
    );
  }
  near(g.grooveMinimumDepth, 2, 'OD90 no longer clips the nominal two-millimeter floor', 1e-9);
});

test('the trial correction shortens the real inner end span by 0.5 mm without changing transverse fit or outer end flanks', () => {
  const previous = geometry(replacementLidPieces({ ...defaults, lidAxialFitAllowance: 0 }));
  previous.updateMatrixWorld(true);
  previous.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.side = DoubleSide;
  });
  const section = (model: Group, direction: Vec) => {
    const values: number[] = [];
    const half = direction[0] ? s.bodyLength / 2 : s.bodyWidth / 2;
    for (const hit of hits(model, [0, 0, s.bodySeamZ + 0.5], direction))
      if (hit.distance <= half + 0.01 && !values.some((value) => Math.abs(value - hit.distance) < 0.01))
        values.push(hit.distance);
    return values;
  };
  try {
    for (const direction of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]] as Vec[]) {
      const before = section(previous, direction), after = section(lid, direction);
      assert.equal(before.length, 4);
      assert.equal(after.length, 4);
      for (let i = 0; i < 4; i++)
        near(before[i] - after[i], direction[0] && i < 2 ? 0.25 : 0,
          'only the inner end wall moves inward; both exterior walls and Y fit stay fixed');
    }
    const oldSpec = replacementLidSpec({ ...defaults, lidAxialFitAllowance: 0 });
    assert.deepEqual(s.screwSeats, oldSpec.screwSeats);
    assert.deepEqual(g.path, oldSpec.gasketGroove.path);
  } finally {
    disposeModel(previous);
  }
});

test('the complete raised body rim enters the channel with positive side clearance and a 0.2 mm floor gap', () => {
  near(g.sourceSideContactWidth, 1, 'modeled raised-rim side width', 1e-9);
  near(g.sourceEndContactWidth, 1, 'modeled raised-rim end width', 1e-9);
  near(g.sourceStraightContactWidth, 1, 'nominal rim overlap inside the channel', 1e-9);
  assert.equal(g.fullFootprintSupported, false);
  const midZ = s.bodySeamZ + 0.9;
  for (const direction of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ] as Vec[]) {
    const distances = (model: Group) => {
      const result: number[] = [];
      for (const hit of hits(model, [0, 0, midZ], direction))
        if (!result.some((value) => Math.abs(value - hit.distance) < 0.01))
          result.push(hit.distance);
      return result;
    };
    const rimFaces = distances(body),
      grooveFaces = distances(channel);
    assert.equal(
      rimFaces.length,
      2,
      'only the raised rim occupies this height above the hard body',
    );
    assert.equal(grooveFaces.length, 2, 'the actual channel surrounds the raised-rim section');
    near(rimFaces[1] - rimFaces[0], 1, 'full modeled uniform rim wall');
    assert.ok(rimFaces[0] - grooveFaces[0] >= 0.375 - 0.025, 'inside flank clearance');
    assert.ok(grooveFaces[1] - rimFaces[1] >= 0.375 - 0.025, 'outside flank clearance');
  }
  const rimBounds = new Box3().setFromObject(raisedRim, true);
  near(rimBounds.min.z, s.bodySeamZ, 'actual rim starts at the hard seating plane');
  near(rimBounds.max.z - rimBounds.min.z, 1.8, 'actual raised-rim height');
  let samples = 0;
  // Probe the material interior, not independently triangulated CSG boundary slivers.
  // Every station covers the centre and both sides of the one-millimetre rim.
  for (const segment of grandadoRimPath()) {
    for (let i = 0; i <= 12; i++) {
      const a = segment.points[0],
        b = segment.points.at(-1)!;
      let x: number, y: number, nx: number, ny: number;
      if (segment.kind === 'line') {
        x = a[0] + ((b[0] - a[0]) * i) / 12;
        y = a[1] + ((b[1] - a[1]) * i) / 12;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        nx = -(b[1] - a[1]) / length;
        ny = (b[0] - a[0]) / length;
      } else {
        const [cx, cy] = segment.center;
        const angle = Math.atan2(a[1] - cy, a[0] - cx) + ((Math.PI / 2) * i) / 12;
        nx = Math.cos(angle);
        ny = Math.sin(angle);
        x = cx + segment.radius * nx;
        y = cy + segment.radius * ny;
      }
      for (const offset of [-0.35, 0, 0.35]) {
        const px = x + nx * offset,
          py = y + ny * offset;
        const actualRimTop = hits(raisedRim, [px, py, 60], [0, 0, -1])[0];
        const actualBodyTop = hits(body, [px, py, 60], [0, 0, -1])[0];
        const actualLidFloor = hits(lid, [px, py, s.bodySeamZ - 0.1], [0, 0, 1])[0];
        const channelMouth = hits(channel, [px, py, s.bodySeamZ - 0.1], [0, 0, 1])[0];
        assert.ok(
          actualRimTop && actualBodyTop && actualLidFloor && channelMouth,
          'rim centre and both flanks lie inside the actual channel',
        );
        near(actualRimTop.point.z, 33, 'actual isolated raised-rim top');
        near(actualBodyTop.point.z, actualRimTop.point.z, 'the source body retains the raised rim');
        near(channelMouth.point.z, s.bodySeamZ, 'rim starts at the channel mouth');
        near(actualLidFloor.point.z - actualBodyTop.point.z, 0.2, 'positive rim-to-floor headroom');
        samples++;
      }
    }
  }
  assert.equal(samples, 624, 'every rail, dogleg and curved turn is sampled across the rim');
});

test('the actual lid contains the complete groove at its configured depth', () => {
  for (const [x, y] of pathSamples()) {
    const cutFloor = hits(lid, [x, y, s.bodySeamZ - 0.2], [0, 0, 1])[0];
    assert.ok(cutFloor, `groove floor at ${x},${y}`);
    near(
      cutFloor.point.z,
      Math.min(g.nominalFloorZ, Math.sqrt(s.innerRadius ** 2 - y ** 2)),
      'roof-clipped actual cut depth',
    );
  }
  for (const [x, y] of [
    [0, g.railY - 1],
    [0, g.railY + 1],
    [g.endInnerFlankX - 0.1, 0],
    [g.endOuterFlankX + 0.1, 0],
  ]) {
    const seat = hits(lid, [x, y, s.bodySeamZ - 0.2], [0, 0, 1])[0];
    assert.ok(seat);
    near(seat.point.z, s.bodySeamZ, 'adjacent hard seating face retained');
  }
});

test('all screw bores remain outside the seal and the three-millimeter bearing webs remain intact', () => {
  near(
    g.screwHeadFootprintClearance,
    0.1,
    'channel avoids the source head bearing footprint',
    1e-9,
  );
  assert.ok(g.sourcePostBoreClearance > 0.8);
  for (const seat of s.screwSeats) {
    for (const a of [20, 45, 70]) {
      const angle = (a * Math.PI) / 180,
        direction: Vec = [
          -Math.sign(seat.x) * Math.cos(angle),
          -Math.sign(seat.y) * Math.sin(angle),
          0,
        ];
      const distances: number[] = [];
      for (const hit of hits(groove, [seat.x, seat.y, s.bodySeamZ + g.depth / 2], direction))
        if (!distances.some((v) => Math.abs(v - hit.distance) < 0.01)) distances.push(hit.distance);
      assert.ok(distances.length >= 2);
      near(distances[0], 3, 'inboard post channel inner radius');
      near(distances[1], 4.8, 'inboard post channel outer radius');
    }
    const a = Math.SQRT1_2,
      x = seat.x - Math.sign(seat.x) * 2.5 * a,
      y = seat.y - Math.sign(seat.y) * 2.5 * a;
    const bottom = hits(lid, [x, y, s.bodySeamZ - 0.1], [0, 0, 1])[0];
    const top = hits(lid, [x, y, 60], [0, 0, -1])[0];
    assert.ok(bottom && top);
    near(top.point.z - bottom.point.z, 3, 'uncut original head load footprint');
  }
});

test('gland dimensions come only from current controls and preserve the factory interface', () => {
  const adjusted = replacementLidSpec({
    ...defaults,
    gasketOuterWall: 1.7,
    gasketEndWall: 1.9,
    gasketInnerWall: 1.1,
    gasketGrooveWidth: 1.6,
    gasketGrooveDepth: 1.9,
  });
  assert.equal(adjusted.gasketGroove.outerWall, 1.7);
  assert.equal(adjusted.gasketGroove.endWall, 1.9);
  assert.equal(adjusted.gasketGroove.innerWall, 1.1);
  assert.equal(adjusted.gasketGroove.width, 1.6);
  assert.equal(adjusted.gasketGroove.depth, 1.9);
  near(adjusted.skirtWall, 4.4, 'complete adjusted section', 1e-9);
  near(adjusted.skirtEndWall, 4.85, 'complete adjusted end section', 1e-9);
  assert.deepEqual(adjusted.screwSeats, s.screwSeats);
  assert.equal(adjusted.apexZ, s.apexZ);
  assert.equal(adjusted.bodyTranslation, s.bodyTranslation);
  near(
    replacementLidSpec({ ...defaults, gasketOuterWall: 1 }).gasketGroove.sourceSideContactWidth,
    0.65,
    'a misplaced channel overlaps only part of the actual raised rim',
    1e-9,
  );
});

test('the channel floor preserves the three-millimeter radial roof across pipe sizes', () => {
  for (const tubeOD of [89, 90, 92]) {
    const parameters = { ...defaults, tubeOD },
      spec = replacementLidSpec(parameters),
      grooveSpec = spec.gasketGroove;
    const model = geometry(replacementLidPieces(parameters));
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
    try {
      const y = grooveSpec.railY + grooveSpec.width / 2 - 0.005;
      const bottom = hits(model, [0, y, spec.bodySeamZ - 0.1], [0, 0, 1])[0];
      const top = hits(model, [0, y, 60], [0, 0, -1])[0];
      assert.ok(bottom && top);
      const expected = Math.min(
        spec.bodySeamZ + grooveSpec.depth,
        Math.sqrt(spec.innerRadius ** 2 - y ** 2),
      );
      near(bottom.point.z, expected, 'native-cylinder floor');
      assert.ok(Math.hypot(y, top.point.z) - Math.hypot(y, bottom.point.z) >= 3 - 0.025);
      if (tubeOD === 89)
        near(grooveSpec.grooveMinimumDepth, 1.935094223856627, 'OD89 retained roof clip', 1e-9);
      else near(grooveSpec.grooveMinimumDepth, 2, 'full nominal depth at OD90 and OD92', 1e-9);
      near(grooveSpec.grooveMaximumDepth, 2, 'nominal maximum depth');
      assert.ok(grooveSpec.grooveMinimumDepth <= grooveSpec.grooveMaximumDepth);
    } finally {
      disposeModel(model);
    }
  }
});
