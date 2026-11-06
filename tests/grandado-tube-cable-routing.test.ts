import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Group, Mesh, Raycaster, Vector3 } from 'three';
import { component } from '../src/core/assembly/boundary/shapes';
import { disposeModel } from '../src/core/mechanical';
import { defaults } from '../src/parts/grandado-tube-mount/configurator';
import {
  cableRouteEnvelope,
  cableRoutingSpec,
  cableWireReference,
  cableAssemblySpec,
  cableClosingReliefs,
  bodyLoadingCableRelief,
} from '../src/parts/grandado-tube-mount/lib/cable-routing';
import { cassetteContactSpec, cassettePieces } from '../src/parts/grandado-tube-mount/lib/cassette';
import { endRetainerPieces } from '../src/parts/grandado-tube-mount/lib/end-retainer';
import { layout } from '../src/parts/grandado-tube-mount/lib/spec';

type Point = [number, number, number];

function inspect(shape: Parameters<typeof component>[0]): Group {
  const result = component(shape, 'Routing probe', 0xcccccc);
  result.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.side = DoubleSide;
  });
  result.updateMatrixWorld(true);
  return result;
}

function distances(model: Group, point: Point, direction: Point): number[] {
  const hits = new Raycaster(
    new Vector3(...point),
    new Vector3(...direction).normalize(),
  ).intersectObject(model, true);
  return hits
    .filter((hit, i) => !i || hit.distance - hits[i - 1].distance > 0.0001)
    .map((hit) => hit.distance);
}

const inside = (model: Group, point: Point) =>
  distances(model, point, [1, 0.173, 0.119]).length % 2 === 1;

test('one attached lead reaches its selected exit inside the two-axis service corridor', () => {
  const s = cableRoutingSpec(defaults),
    assembly = cableAssemblySpec(defaults),
    wire = inspect(cableWireReference(defaults)),
    clearance = inspect(cableRouteEnvelope(defaults));
  try {
    for (const path of s.centerlines)
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          b = path.points[i];
        for (const fraction of [0, 0.5, 1]) {
          const point = a.map((v, axis) => v + fraction * (b[axis] - v)) as Point;
          assert.ok(inside(clearance, point), `${path.id}: disconnected cable clearance`);
        }
      }
    for (let i = 1; i < assembly.finalCenterline.length; i++) {
      const a = assembly.finalCenterline[i - 1],
        b = assembly.finalCenterline[i];
      for (const fraction of [0, 0.5, 1]) {
        const point = a.map((v, axis) => v + fraction * (b[axis] - v)) as Point;
        assert.ok(inside(wire, point), 'the single actual lead has no disconnected segment');
      }
    }
    const entry = assembly.fixedEntry;
    for (let i = 1; i < assembly.finalCenterline.length - 1; i++) {
      const tangent = new Vector3(...assembly.finalCenterline[i + 1])
        .sub(new Vector3(...assembly.finalCenterline[i - 1]))
        .normalize();
      const across = tangent
        .clone()
        .cross(Math.abs(tangent.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0))
        .normalize();
      const normal = tangent.clone().cross(across).normalize();
      for (const fraction of [0, 0.5])
        for (let j = 0; j < 16; j++) {
          const angle = (j * Math.PI) / 8;
          const surface = new Vector3(...assembly.finalCenterline[i])
            .lerp(new Vector3(...assembly.finalCenterline[i + 1]), fraction)
            .addScaledVector(across, s.wireRadius * Math.cos(angle))
            .addScaledVector(normal, s.wireRadius * Math.sin(angle));
          assert.ok(
            inside(clearance, surface.toArray() as Point),
            'the full actual wire cross-section must fit the service corridor',
          );
        }
    }
    assert.equal(entry[2], layout(defaults).powerCenterZ);
    assert.deepEqual(assembly.finalWaypoints.at(-1), [s.axialExtent, s.exitAxes[0].y, s.plenumZ]);
    assert.ok(
      !inside(wire, [20, s.exitAxes[1].y, s.plenumZ]),
      'the reference does not invent a branched harness',
    );
    assert.equal(s.clearanceDiameter, 6);
  } finally {
    disposeModel(wire);
    disposeModel(clearance);
  }
});

test('the complete printed core clears the transfer and preserves the full high-run web', () => {
  const s = cableRoutingSpec(defaults),
    c = cassetteContactSpec(defaults);
  const models = cassettePieces(defaults).map((piece) => ({
    id: piece.id,
    model: inspect(piece.shape),
  }));
  try {
    for (const point of s.transferCenterline)
      for (const { id, model } of models)
        assert.ok(!inside(model, point), `${id} blocks the transfer centerline at ${point}`);
    const upper = models.find((v) => v.id === c.upperHalfId)!.model;
    const keeper = models.find((v) => v.id === c.keeperId)!.model;
    for (const x of [-46, 46]) {
      const neck = distances(keeper, [x, -32, -30], [0, 0, 1]).map((distance) => distance - 30);
      assert.ok(neck.length >= 2, 'the keeper tail needs continuous upright stock');
      assert.ok(
        Math.abs(neck[0] - c.keeperRails.beamBottom) < 0.025,
        'the keeper tail must reach its full lower datum',
      );
      assert.ok(
        Math.abs(neck[1] - c.keeperRoofTop) < 0.025,
        'the side portal must not trim the keeper tail',
      );
      assert.ok(
        neck[1] - neck[0] >= 12.69,
        'the keeper tail must retain its full height rather than a2.3 mm neck',
      );
    }
    for (const z of [c.joinZ + 0.1, c.joinZ + 1.6, c.joinZ + 3.1])
      assert.ok(inside(upper, [-15, -35, z]), 'high-run flute weakened the full3.2 mm radial web');
    for (const y of [-42, -38, -34, -30])
      assert.ok(
        !inside(upper, [-15, y, s.highRun.z]),
        'the outside flute must be open rather than retaining a thin roof',
      );
    for (const [y, z] of [
      [-24, s.highRun.z],
      [-20, s.highRun.z - 1],
      [-26, s.highRun.z],
      [-20, s.highRun.z + 2],
    ])
      assert.ok(
        !inside(upper, [-42.75, y, z]),
        'the rounded end turn must not leave a half-millimetre front membrane',
      );
    assert.ok(
      inside(upper, [-43, -15.5, s.highRun.z]),
      'the broad ear-side portal wall was removed',
    );
  } finally {
    for (const { model } of models) disposeModel(model);
  }
});

test('the underfloor passage retains at least three millimetres to the holder floor and torque pockets', () => {
  const s = cableRoutingSpec(defaults),
    c = cassetteContactSpec(defaults);
  const lower = inspect(
    cassettePieces(defaults).find((piece) => piece.id === c.lowerHalfIds[1])!.shape,
  );
  try {
    const floor = distances(lower, [10, s.exitAxes[0].y, s.plenumZ], [0, 0, 1])[0];
    assert.ok(
      floor - s.clearanceRadius >= 3.45,
      'underfloor route thinned the integrated holder floor',
    );
    const pocket = c.endKeyPockets.find((v) => v.min[0] > 0 && v.min[1] > 0)!;
    const point: Point = [50, s.exitAxes[1].y, s.plenumZ];
    const direction: Point = [0, pocket.min[1] - point[1], pocket.min[2] - point[2]];
    const faces = distances(lower, point, direction);
    assert.ok(faces.length >= 2, 'missing actual solid wall between route and torque pocket');
    assert.ok(faces[1] - faces[0] >= 3.3, 'round passage thinned the torque-pocket corner');
  } finally {
    disposeModel(lower);
  }
});

test('both end discs expose downward-open grooves on both connected cable axes', () => {
  const s = cableRoutingSpec(defaults);
  const discs = endRetainerPieces(defaults).map((piece) => inspect(piece.shape));
  try {
    for (const [index, sign] of [-1, 1].entries())
      for (const axis of s.exitAxes) {
        for (const z of [axis.z, axis.z - 3, axis.z - 6])
          assert.ok(!inside(discs[index], [sign * 70, axis.y, z]), 'disc cable groove is blocked');
        assert.ok(
          inside(discs[index], [sign * 70, axis.y + Math.sign(axis.y) * 6, axis.z]),
          'groove removed the adjacent massive disc stock',
        );
      }
  } finally {
    for (const disc of discs) disposeModel(disc);
  }
});

test('the lower mouths remain open while the upper preserves only the required high flute', () => {
  const s = cableRoutingSpec(defaults),
    c = cassetteContactSpec(defaults);
  const models = cassettePieces(defaults)
    .filter((piece) => piece.id === c.upperHalfId || c.lowerHalfIds.includes(piece.id))
    .map((piece) => ({ id: piece.id, model: inspect(piece.shape) }));
  try {
    for (const { id, model } of models) {
      if (c.lowerHalfIds.includes(id)) {
        for (const x of [-50, -20, 20, 50])
          for (const axis of s.exitAxes)
            for (const z of [-44, -40, -36, s.plenumZ - 0.1])
              assert.ok(
                !inside(model, [x, axis.y, z]),
                'a bottom trough must permit radial lay-in',
              );
        for (const x of [-1, 1])
          for (const y of [-17.5, 0, 17.5])
            for (const z of [-44, -38, s.plenumZ - 0.1])
              assert.ok(!inside(model, [x, y, z]), 'the cross-junction remains open downward');
        for (const z of [-40, -25, -10, s.transferWaypoints[5][2]])
          assert.ok(
            !inside(model, [s.transferX, -14.5, z]),
            'the transfer slot remains open from below',
          );
        for (const z of [s.transferWaypoints[4][2], 5, s.highRun.z])
          for (const y of [-42, -34, -26, -20])
            assert.ok(
              !inside(model, [s.transferX, y, z]),
              'the end turn remains accessible from outside',
            );
      }
      for (const z of [
        s.highRun.z - s.clearanceRadius + 0.05,
        s.highRun.z,
        s.highRun.z + s.clearanceRadius - 0.05,
      ])
        for (const y of [-32, -34, -40])
          assert.ok(
            !inside(model, [-15, y, z]),
            'the complete high-run service diameter must open to the side without a thin closing membrane',
          );
    }
  } finally {
    for (const { model } of models) disposeModel(model);
  }
});

test('both split bottom strips are positively tied into the unbroken holder floor', () => {
  const c = cassetteContactSpec(defaults),
    d = layout(defaults);
  const lower = cassettePieces(defaults)
    .filter((piece) => c.lowerHalfIds.includes(piece.id))
    .map((piece) => inspect(piece.shape));
  try {
    assert.equal(c.cableSkinTies.length, 2);
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? -20 : 20;
      for (const z of [-40, -35, -30, d.holderBottom - 3 + 0.1])
        assert.ok(
          inside(lower[i], [x, 0, z]),
          'a lower centre strip is detached from its holder floor',
        );
      const faces = distances(lower[i], [x, -10, -30], [0, 1, 0]);
      assert.ok(faces.length >= 2);
      assert.ok(
        Math.abs(faces[0] - 7) < 0.025 && Math.abs(faces[1] - 13) < 0.025,
        'the integral floor tie keeps full six-millimetre stock',
      );
    }
  } finally {
    for (const model of lower) disposeModel(model);
  }
});

test('the body-entry notch removes a complete local key while adjacent guides retain full stock', () => {
  const c = cassetteContactSpec(defaults),
    d = layout(defaults);
  const upper = inspect(
    cassettePieces(defaults).find((piece) => piece.id === c.upperHalfId)!.shape,
  );
  try {
    for (const x of [-53, -50, -47, -44, -30, -15, 10])
      for (const z of [c.joinZ + 0.1, c.joinZ + 1.6, c.joinZ + 3.1])
        assert.ok(
          inside(upper, [x, -35, z]),
          'the full3.2 mm guide web must connect continuously into the negative end',
        );
    assert.ok(
      !inside(upper, [0, c.tracks.centersY[0], c.tracks.flangeBottom + 1]),
      'the local main key must be removed entirely instead of leaving a thin stem',
    );
    for (const x of [-7, 7])
      assert.ok(
        inside(upper, [x, c.tracks.centersY[0], c.tracks.flangeBottom + 1]),
        'key stock must remain beyond the loading notch',
      );
    assert.ok(
      d.powerCenterZ - d.powerCableDiameter / 2 - c.joinZ >= 3.75,
      'the actual final lead stays clear above the moving lower edge',
    );
    assert.ok(Math.abs(c.earCapture.upperZ - (d.earTop + d.earClearance)) < 1e-9);
    assert.ok(c.earCapture.ceilingThickness >= 3);
    for (const x of d.mountXs) {
      const start = d.boxBottom - 0.5;
      const ceiling = distances(upper, [x, 0, start], [0, 0, 1])[0] + start;
      assert.ok(
        Math.abs(ceiling - d.boxBottom - 6.2) < 0.025,
        'the actual upper solid must provide the full six-millimetre ear plus0.2 mm clearance',
      );
    }
  } finally {
    disposeModel(upper);
  }
});

test('the attached straight lead clears the upper cage while the body rises from below', () => {
  const a = cableAssemblySpec(defaults),
    s = cableRoutingSpec(defaults),
    c = cassetteContactSpec(defaults);
  assert.deepEqual(a.bodyEntryLeadStart, [0, -29, layout(defaults).powerCenterZ]);
  assert.deepEqual(a.bodyEntryLeadEnd, [0, -47, layout(defaults).powerCenterZ]);
  const upper = inspect(
    cassettePieces(defaults).find((piece) => piece.id === c.upperHalfId)!.shape,
  );
  const notch = inspect(bodyLoadingCableRelief(defaults));
  try {
    for (const dz of [0, -0.5, -1, -3, -5, -8, -15, -25, -45, -80])
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const center = a.bodyEntryLeadStart.map(
          (v, axis) => v + fraction * (a.bodyEntryLeadEnd[axis] - v) + (axis === 2 ? dz : 0),
        ) as Point;
        for (const direction of [
          [0, 0, 0],
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1],
        ] as Point[]) {
          const point = center.map(
            (v, axis) => v + direction[axis] * (a.wireRadius + 0.25),
          ) as Point;
          assert.ok(
            !inside(upper, point),
            `the upper loading edge crosses the attached lead at Z offset ${dz}`,
          );
        }
      }
    assert.ok(
      inside(notch, [0, -35, c.tracks.flangeBottom + 1]),
      'the same relief spans the whole local key',
    );
    assert.equal(s.bodyLoading.min[0], -6);
    assert.equal(s.bodyLoading.max[0], 6);
    assert.ok(s.bodyLoading.min[2] < -layout(defaults).cassetteRadius);
  } finally {
    disposeModel(upper);
    disposeModel(notch);
  }
});

test('the final attached lead clears translated lower halves at the formerly pinching offsets', () => {
  const a = cableAssemblySpec(defaults),
    c = cassetteContactSpec(defaults);
  assert.deepEqual(a.finalWaypoints[0], a.fixedEntry);
  assert.deepEqual(a.finalCenterline[0], a.fixedEntry);
  assert.ok(
    a.finalCenterline.length > a.finalWaypoints.length,
    'the audited lead retains the requested rounded geometry',
  );
  assert.deepEqual(a.closureDirection, [-1, 0, 0]);
  assert.ok(
    !('parkedWaypoints' in a) && !('sideFedWaypoints' in a),
    'no unsafe lateral-feed path is offered',
  );
  const lower = cassettePieces(defaults)
    .filter((piece) => c.lowerHalfIds.includes(piece.id))
    .map((piece) => inspect(piece.shape));
  const clearance = inspect(cableClosingReliefs(defaults));
  try {
    for (const offset of [0, 0.5, 1, 2, 3, 5, 8, 10, 15, 20, 40, 80, 120, 180]) {
      for (let i = 1; i < a.finalCenterline.length; i++) {
        const first = a.finalCenterline[i - 1],
          last = a.finalCenterline[i];
        for (const fraction of [0, 0.5, 1]) {
          const center = first.map((v, axis) => v + fraction * (last[axis] - v)) as Point;
          for (const direction of [
            [0, 0, 0],
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
          ] as Point[]) {
            const point = center.map(
              (v, axis) => v + direction[axis] * (a.wireRadius + 0.25) - (axis === 0 ? offset : 0),
            ) as Point;
            for (const model of lower)
              assert.ok(
                !inside(model, point),
                `a moving lower half crosses the attached wire at X offset ${offset}: ${point}`,
              );
          }
        }
      }
    }
    for (const offset of [0, 3, 5, 8, 10]) {
      assert.ok(
        inside(clearance, [-46 - offset, -20, 5]),
        'the formerly pinching end-land path must be explicitly relieved',
      );
    }
  } finally {
    disposeModel(clearance);
    for (const model of lower) disposeModel(model);
  }
});

test('negative axial entries preserve the protected torque-pocket walls', () => {
  const c = cassetteContactSpec(defaults),
    s = cableRoutingSpec(defaults);
  const lower = inspect(
    cassettePieces(defaults).find((piece) => piece.id === c.lowerHalfIds[0])!.shape,
  );
  try {
    const pocket = c.endKeyPockets.find((v) => v.min[0] < 0 && v.min[1] < 0)!;
    const point: Point = [-50, -17.5, s.plenumZ];
    const direction: Point = [0, pocket.max[1] - point[1], pocket.min[2] - point[2]];
    const faces = distances(lower, point, direction);
    assert.ok(faces.length >= 2);
    assert.ok(
      faces[1] - faces[0] >= 3.3,
      'the open axial cable entry must preserve the torque-pocket corner',
    );
    for (const segment of s.closing.sections) {
      assert.ok(segment.startX < -c.coreHalfLength - s.clearanceRadius);
      assert.ok(segment.endX >= Math.max(segment.from[0], segment.to[0]) + s.clearanceRadius);
      for (const fraction of [0, 0.5, 1]) {
        const yz = segment.from.map((v, axis) => v + fraction * (segment.to[axis] - v)) as Point;
        assert.ok(
          !inside(lower, [-55, yz[1], yz[2]]),
          'an axial entry must remain open to the negative core end',
        );
      }
    }
  } finally {
    disposeModel(lower);
  }
});
