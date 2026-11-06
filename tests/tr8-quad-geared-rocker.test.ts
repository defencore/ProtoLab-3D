import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Matrix4, Vector3 } from 'three';
import type { ConfiguredPiece } from '../src/core/assembly/detail-instances';
import type { Shape, Vec } from '../src/core/assembly/boundary/shapes';
import { eskdIdentity } from '../src/core/eskd';
import { withGeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';
import module from '../src/parts/tr8-quad-geared-rocker-actuator/index';
import part, {
  pieces,
  libraries,
  fixed,
  layout,
  roleIds,
  channelTransform,
  driveParameters,
  caseManifest,
  machiningSchedule,
} from '../src/parts/tr8-quad-geared-rocker-actuator/part';
import {
  sourceTransform,
  panelTransform,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/model';
import {
  sheetPanel,
  sheetPanelFlatPattern,
  sheetPanelClampPositions,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/sheet-panel';
import {
  standMountPattern,
  standMountStations,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/layout';
import {
  coverValues,
  coverMountStations,
  coverStandAccessCuts,
} from '../src/parts/tr8-quad-geared-rocker-actuator/lib/plastic-cover';

const letters = ['a', 'b', 'c', 'd'] as const;
const near = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const parameters = (angles: readonly number[] = [0, 0, 0, 0]) => ({
  ...part.defaults,
  ...Object.fromEntries(
    letters.map((letter, index) => ['angle' + letter.toUpperCase(), angles[index]]),
  ),
});
const occurrence = (piece: ConfiguredPiece) =>
  new Matrix4()
    .makeRotationZ(((piece.angle ?? 0) * Math.PI) / 180)
    .setPosition(...(piece.position ?? [0, 0, piece.z ?? 0]))
    .multiply(
      new Matrix4()
        .makeRotationFromEuler(
          new Euler(
            ...(piece.component.placement.rotation.map((value) => (value * Math.PI) / 180) as Vec),
            'ZYX',
          ),
        )
        .setPosition(...piece.component.placement.translation),
    );
const byRole = (rows: ConfiguredPiece[], channel: number, role: keyof typeof roleIds) => {
  const id = letters[channel] + '-' + roleIds[role];
  const piece = rows.find((row) => row.component.id === id);
  assert.ok(piece, id);
  return piece;
};
type Cylinder = {
  radius: number;
  height: number;
  from: Vector3;
  to: Vector3;
  axis: Vector3;
  negative: boolean;
};
function cylinders(piece: ConfiguredPiece): Cylinder[] {
  const result: Cylinder[] = [];
  function visit(shape: Shape, frame: Matrix4, negative = false) {
    if (shape.kind === 'transform') {
      visit(
        shape.child,
        frame
          .clone()
          .multiply(
            new Matrix4()
              .makeRotationFromEuler(
                new Euler(
                  ...(shape.rotation.map((value) => (value * Math.PI) / 180) as Vec),
                  'ZYX',
                ),
              )
              .setPosition(...shape.translation),
          ),
        negative,
      );
      return;
    }
    if (shape.kind === 'cylinder') {
      const axis = new Vector3(
        ...({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[shape.axis] as Vec),
      ).transformDirection(frame);
      const from = new Vector3(...shape.origin).applyMatrix4(frame);
      result.push({
        radius: shape.radius,
        height: shape.height,
        from,
        to: from.clone().addScaledVector(axis, shape.height),
        axis,
        negative,
      });
    }
    if ('children' in shape)
      shape.children.forEach((child, index) =>
        visit(child, frame, shape.kind === 'subtract' && index > 0 ? !negative : negative),
      );
  }
  visit(JSON.parse(String(piece.component.parameters.recipe)) as Shape, occurrence(piece));
  return result;
}

type Cheek = { points: [number, number][]; depth: number; origin: number; frame: Matrix4 };
function cheeks(piece: ConfiguredPiece, minimumLength = 20): Cheek[] {
  const result: Cheek[] = [];
  function visit(shape: Shape, frame: Matrix4, negative = false) {
    if (shape.kind === 'transform') {
      visit(
        shape.child,
        frame
          .clone()
          .multiply(
            new Matrix4()
              .makeRotationFromEuler(
                new Euler(
                  ...(shape.rotation.map((value) => (value * Math.PI) / 180) as Vec),
                  'ZYX',
                ),
              )
              .setPosition(...shape.translation),
          ),
        negative,
      );
      return;
    }
    if (
      shape.kind === 'prism' &&
      shape.axis === 'z' &&
      !negative &&
      Math.max(...shape.points.map((point) => point[1])) > minimumLength
    )
      result.push({ points: shape.points, depth: shape.depth, origin: shape.origin, frame });
    if ('children' in shape)
      shape.children.forEach((child, index) =>
        visit(child, frame, shape.kind === 'subtract' && index > 0 ? !negative : negative),
      );
  }
  visit(JSON.parse(String(piece.component.parameters.recipe)) as Shape, occurrence(piece));
  return result;
}
function insidePolygon(points: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}
function sectionYs(points: [number, number][], x: number): number[] {
  return points.flatMap((a, index) => {
    const b = points[(index + 1) % points.length];
    if (
      Math.abs(a[0] - b[0]) < 1e-10 ||
      x < Math.min(a[0], b[0]) - 1e-10 ||
      x > Math.max(a[0], b[0]) + 1e-10
    )
      return [];
    return [a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
  });
}

test('the compact quad is a separate four-output execution with eight uniform motor choices', () => {
  assert.equal(part.id, 'tr8-quad-geared-rocker-actuator');
  assert.equal(module.part.mechanismExecution?.outputs, 4);
  assert.equal(module.part.buildGeometry, part.buildGeometry);
  assert.equal(part.defaults.motor, 'surpass-2838-3700kv');
  assert.equal(part.presets.length, 8);
  for (const preset of part.presets) {
    for (const state of part.states!)
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
    const rows = pieces(preset.parameters, 'uncovered');
    const motors = rows.filter((row) =>
      ['surpass-2838', 'surpass-2845'].includes(row.component.libraryId),
    );
    assert.equal(motors.length, 4);
    assert.ok(
      motors.every(
        (row) =>
          row.component.parameters.model === preset.parameters.motor &&
          row.component.state === 'cross-drilled',
      ),
    );
    assert.equal(new Set(rows.map((row) => row.component.id)).size, rows.length);
    assert.ok(
      rows.every((row) => libraries.some((library) => library.id === row.component.libraryId)),
    );
  }
  for (const key of ['angleA', 'angleB', 'angleC', 'angleD']) {
    for (const value of [-20.01, 20.01, Infinity, NaN])
      assert.ok(part.validate({ ...part.defaults, [key]: value }, 'uncovered').length);
  }
  assert.ok(part.validate({ ...part.defaults, motor: 'unsupported' }, 'uncovered').length);
});

test('four dense removable sections use the final cylindrical envelope and recessed M3 covers screws', () => {
  for (const motor of ['surpass-2838-3700kv', 'surpass-2845-3100kv']) {
    const p = { ...part.defaults, motor },
      values = coverValues(p);
    const whole = pieces(p, 'assembled'),
      bare = pieces(p, 'uncovered'),
      printable = pieces(p, 'covers');
    assert.equal(whole.length, 115);
    assert.equal(bare.length, 107);
    assert.equal(printable.length, 8);
    assert.equal(new Set(whole.map((piece) => piece.component.id)).size, whole.length);
    assert.deepEqual(
      new Set(whole.map((piece) => piece.component.id)),
      new Set([...bare, ...printable].map((piece) => piece.component.id)),
    );
    const sections = printable.filter(
      (piece) => piece.component.libraryId === 'manufactured-detail',
    );
    const bolts = printable.filter((piece) => piece.component.libraryId === 'bolt-screw');
    assert.equal(sections.length, 4);
    assert.equal(bolts.length, 4);
    assert.ok(
      sections.every(
        (piece) =>
          piece.requireSingleSolid &&
          piece.component.manufacturing?.material.includes('PETG') &&
          piece.component.manufacturing.processes.includes('printing'),
      ),
    );
    assert.ok(
      bolts.every(
        (piece) =>
          piece.component.parameters.head === 'countersunk' &&
          piece.component.parameters.diameter === 3 &&
          piece.component.parameters.length === 6,
      ),
    );
    near(values.outerDiameter, motor.startsWith('surpass-2845') ? 86 : 76);
    near(values.accessRadius, 10.5);
    for (const station of coverMountStations(p)) {
      near(Math.abs(station.localT), 27.5);
      near(station.localZ, 54.8);
      near(station.length, 6);
      near(
        station.headFace.reduce((sum, value, axis) => sum + value * station.axis[axis], 0),
        21.6,
      );
    }
    for (const commands of [
      [20, -20, 7, -11],
      [-20, 20, -7, 11],
    ]) {
      const moved = pieces({ ...parameters(commands), motor }, 'covers');
      assert.deepEqual(
        moved.map((piece) => piece.component.parameters),
        printable.map((piece) => piece.component.parameters),
        'Pocketed sections are a fixed mechanical sweep, not a live-angle cavity.',
      );
      assert.deepEqual(
        moved.map((piece) => piece.component.placement),
        printable.map((piece) => piece.component.placement),
      );
    }
    const files = part.fabricationFiles!(p);
    assert.equal(files.length, 11);
    assert.equal(files.filter((file) => file.name.endsWith('.dxf')).length, 3);
  }
});

test('twenty stand taps follow three upper centerline points and two lateral points with shank-only passages', () => {
  assert.deepEqual(standMountPattern, [
    [-12.7, 0],
    [12.7, 0],
    [0, 12.5],
    [0, 30],
    [0, 55],
  ]);
  const stations = standMountStations();
  assert.equal(stations.length, 20);
  assert.equal(new Set(stations.map((station) => station.id)).size, 20);
  for (let panel = 0; panel < 4; panel++) {
    const group = stations.filter((station) => station.panelIndex === panel);
    assert.equal(group.length, 5);
    const lateral = group.filter((station) => station.localZ === 0);
    assert.equal(lateral.length, 2);
    near(
      lateral.reduce((sum, station) => sum + station.localT, 0),
      0,
    );
    assert.deepEqual(
      group.filter((station) => station.localT === 0).map((station) => station.localZ),
      [12.5, 30, 55],
    );
    assert.ok(
      group.every((station) =>
        group.some((other) => other.localT === -station.localT && other.localZ === station.localZ),
      ),
    );
    const center = lateral
      .reduce((sum, station) => sum.add(new Vector3(...station.plateFace)), new Vector3())
      .multiplyScalar(0.5);
    const expected = new Vector3(18.5, 0, 0).applyMatrix4(channelTransform(panel));
    near(center.distanceTo(expected), 0);
  }
  const rows = pieces(part.defaults, 'uncovered');
  for (let panel = 0; panel < 4; panel++) {
    const piece = byRole(rows, panel, 'case');
    const taps = cylinders(piece).filter(
      (cylinder) =>
        cylinder.negative &&
        Math.abs(cylinder.radius - 1.5) < 1e-8 &&
        Math.abs(cylinder.height - 3.2) < 1e-8,
    );
    assert.equal(
      taps.length,
      6,
      'Five stand threads supplement the separate existing cover thread.',
    );
    const threads: { pitch: number; internal?: boolean }[] = [];
    const visitThreads = (shape: Shape) => {
      if (shape.kind === 'cylinder' && shape.thread) threads.push(shape.thread);
      if (shape.kind === 'transform') visitThreads(shape.child);
      if ('children' in shape) shape.children.forEach(visitThreads);
    };
    visitThreads(JSON.parse(String(piece.component.parameters.recipe)) as Shape);
    assert.equal(threads.length, 6);
    assert.ok(threads.every((thread) => thread.internal && thread.pitch === 0.5));
    for (const station of stations.filter((station) => station.panelIndex === panel)) {
      const point = new Vector3(...station.plateFace),
        axis = new Vector3(...station.axis);
      near(axis.length(), 1);
      const aligned = taps.filter(
        (hole) =>
          Math.abs(hole.axis.dot(axis)) > 0.999999 &&
          hole.from.clone().sub(point).cross(axis).length() < 1e-8,
      );
      assert.equal(aligned.length, 1);
      const limits = [aligned[0].from, aligned[0].to].map((pointOnAxis) =>
        pointOnAxis.clone().sub(point).dot(axis),
      );
      near(Math.min(...limits), -3.1);
      near(Math.max(...limits), 0.1);
      near(station.threadLength, 3);
      near(station.pilotDiameter, 2.5);
      near(station.passageDiameter, 3.4);
      assert.equal(station.thread, 'M3×0.5');
    }
  }
  const standManifest = caseManifest(part.defaults).standMounting;
  assert.equal(standManifest.count, 20);
  assert.equal(standManifest.totalMetalPanelM3Threads, 24);
  assert.equal(standManifest.includesStandHardware, false);
  for (const motor of ['surpass-2838-3700kv', 'surpass-2845-3100kv']) {
    const cuts = coverStandAccessCuts({ ...part.defaults, motor });
    assert.equal(cuts.length, 20);
    cuts.forEach((cut, index) => {
      assert.equal(cut.kind, 'cylinder');
      if (cut.kind !== 'cylinder') return;
      near(cut.radius, 1.7);
      const direction = new Vector3(
        ...({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[cut.axis] as Vec),
      );
      const point = new Vector3(...stations[index].plateFace),
        outward = new Vector3(...stations[index].axis);
      const from = new Vector3(...cut.origin),
        to = from.clone().addScaledVector(direction, cut.height);
      near(from.clone().sub(point).cross(outward).length(), 0);
      const limits = [from, to].map((end) => end.clone().sub(point).dot(outward));
      near(Math.min(...limits), -3.6);
      assert.ok(
        Math.max(...limits) > 15,
        'The full straight passage reaches beyond the cylindrical exterior.',
      );
    });
  }
});

test('two opposite-bend panel pairs use proper placements around one bearing connector', () => {
  const rows = pieces(part.defaults, 'uncovered');
  const identities: string[] = [];
  for (const [index] of letters.entries()) {
    const referenceIndex = index % 2;
    const first = byRole(rows, referenceIndex, 'case');
    const piece = byRole(rows, index, 'case');
    assert.deepEqual(piece.component.parameters, first.component.parameters);
    assert.deepEqual(piece.component.manufacturing, first.component.manufacturing);
    assert.equal(piece.requireSingleSolid, true);
    const expected = panelTransform(index)
      .clone()
      .multiply(panelTransform(referenceIndex).clone().invert())
      .multiply(occurrence(first));
    const actual = occurrence(piece);
    actual.elements.forEach((value, entry) => near(value, expected.elements[entry]));
    near(actual.determinant(), 1);
    const item = piece.component;
    identities.push(
      eskdIdentity(
        libraries.find((library) => library.id === item.libraryId)!,
        item.parameters,
        item.state,
        item.presetId,
        { ...item, designation: '', revision: 'A' },
      ).configurationKey,
    );
  }
  assert.equal(new Set(identities).size, 2);
  assert.equal(identities[0], identities[2]);
  assert.equal(identities[1], identities[3]);
  assert.equal(caseManifest(part.defaults).quantity, 4);
  const connector = rows.filter((piece) => piece.component.id === roleIds.cross);
  assert.equal(connector.length, 1);
  assert.equal(connector[0].component.libraryId, 'manufactured-detail');
  assert.equal(connector[0].requireSingleSolid, true);
  const bolts = rows.filter((piece) => piece.component.id.startsWith(roleIds.caseBolt + '-'));
  const nuts = rows.filter((piece) => piece.component.id.startsWith(roleIds.caseNut + '-'));
  assert.equal(bolts.length, 4);
  assert.equal(nuts.length, 4);
  assert.ok(
    bolts.every(
      (piece) =>
        piece.component.parameters.diameter === 3 &&
        piece.component.parameters.length === fixed.clampLength,
    ),
  );
  assert.ok(
    nuts.every(
      (piece) => piece.component.parameters.bore === 3 && piece.component.parameters.height === 2.4,
    ),
  );
  const frames = [0, 1, 2, 3].map(channelTransform);
  const same = (first: Matrix4, second: Matrix4) =>
    first.elements.every((value, entry) => Math.abs(value - second.elements[entry]) < 1e-8);
  for (const [index, transform] of frames.entries()) {
    near(transform.determinant(), 1);
    assert.ok(
      same(transform.clone().multiply(transform), new Matrix4()),
      'Each nonidentity D2 frame is a half-turn.',
    );
    const up = new Vector3(0, 0, 1).transformDirection(transform);
    near(up.z, index % 2 === 0 ? 1 : -1);
    for (const other of frames)
      assert.ok(
        frames.some((candidate) => same(transform.clone().multiply(other), candidate)),
        'The four proper frames form one closed symmetry group.',
      );
  }
});

test('one laser-cut 3 mm blank produces the two opposite bend schedules and a 6 mm clamp stack', () => {
  const up = sheetPanelFlatPattern(1),
    down = sheetPanelFlatPattern(-1);
  assert.deepEqual(up.loops, down.loops);
  assert.deepEqual(
    up.circles.filter((hole) => hole.radius !== 1.25),
    down.circles.filter((hole) => hole.radius !== 1.25),
  );
  assert.equal(up.circles.filter((hole) => hole.radius === 1.25).length, 6);
  assert.equal(down.circles.filter((hole) => hole.radius === 1.25).length, 6);
  assert.equal(up.thickness, 3);
  assert.equal(up.loops.length, 4);
  assert.equal(up.circles.length, 19);
  assert.equal(up.bends.length, 2);
  assert.ok(
    up.bends.every(
      (bend) => bend.direction === 'up' && bend.angle === 90 && bend.innerRadius === 1.5,
    ),
  );
  assert.ok(
    down.bends.every(
      (bend) => bend.direction === 'down' && bend.angle === 90 && bend.innerRadius === 1.5,
    ),
  );
  const outline = up.loops[0].flatMap((edge): [number, number][] => {
    if (edge.kind === 'line') return [edge.from];
    const count = Math.ceil(Math.abs(edge.end - edge.start) / (Math.PI / 90));
    return Array.from({ length: count }, (_, index) => {
      const angle = edge.start + ((edge.end - edge.start) * index) / count;
      return [
        edge.center[0] + edge.radius * Math.cos(angle),
        edge.center[1] + edge.radius * Math.sin(angle),
      ] as [number, number];
    });
  });
  for (const [index, edge] of up.loops[0].entries()) {
    const next = up.loops[0][(index + 1) % up.loops[0].length].from;
    near(Math.hypot(edge.to[0] - next[0], edge.to[1] - next[1]), 0);
  }
  const orientation = (a: [number, number], b: [number, number], c: [number, number]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSegment = (a: [number, number], b: [number, number], p: [number, number]) =>
    Math.abs(orientation(a, b, p)) < 1e-9 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-9 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-9 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-9;
  for (let i = 0; i < outline.length; i++)
    for (let j = i + 2; j < outline.length; j++) {
      if (i === 0 && j === outline.length - 1) continue;
      const a = outline[i],
        b = outline[(i + 1) % outline.length],
        c = outline[j],
        d = outline[(j + 1) % outline.length];
      const crossing =
        orientation(a, b, c) * orientation(a, b, d) < -1e-12 &&
        orientation(c, d, a) * orientation(c, d, b) < -1e-12;
      assert.ok(
        !crossing &&
          !onSegment(a, b, c) &&
          !onSegment(a, b, d) &&
          !onSegment(c, d, a) &&
          !onSegment(c, d, b),
        'The sampled exact-arc flat contour must have no crossings or self contacts.',
      );
    }
  for (const hole of up.circles) {
    assert.ok(insidePolygon(outline, ...hole.center));
    for (const [index, a] of outline.entries()) {
      const b = outline[(index + 1) % outline.length],
        dx = b[0] - a[0],
        dy = b[1] - a[1];
      const fraction = Math.max(
        0,
        Math.min(
          1,
          ((hole.center[0] - a[0]) * dx + (hole.center[1] - a[1]) * dy) / (dx * dx + dy * dy),
        ),
      );
      assert.ok(
        Math.hypot(hole.center[0] - a[0] - fraction * dx, hole.center[1] - a[1] - fraction * dy) >
          hole.radius,
        'Every laser hole retains a complete surrounding ligament.',
      );
    }
  }
  near(sheetPanel.outerRadius - sheetPanel.innerRadius, 3);
  near(fixed.tabThickness * 2, 6);
  near(fixed.clampLength, 10);
  near(fixed.clampLength - 2 * fixed.tabThickness - fixed.clampNutHeight, 1.6);
  const manifest = caseManifest(part.defaults);
  assert.equal(manifest.configurations.length, 2);
  assert.ok(manifest.configurations.every((item) => item.quantity === 2));
  assert.deepEqual(manifest.externalClamps.axisPositions, sheetPanelClampPositions());
});

test('the reference layout uses tangent drive axes and alternating upper and lower motors', () => {
  const source = sourceTransform();
  for (const [axis, expected] of [
    [
      [1, 0, 0],
      [0, -1, 0],
    ],
    [
      [0, 1, 0],
      [0, 0, -1],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
    ],
  ] as [Vec, Vec][])
    near(new Vector3(...axis).transformDirection(source).distanceTo(new Vector3(...expected)), 0);
  near(source.determinant(), 1);
  const inverted = sourceTransform(true);
  near(new Vector3(1, 0, 0).transformDirection(inverted).distanceTo(new Vector3(0, 1, 0)), 0);
  near(new Vector3(0, 0, 1).transformDirection(inverted).distanceTo(new Vector3(-1, 0, 0)), 0);
  near(inverted.determinant(), 1);
  const rows = pieces(part.defaults, 'uncovered');
  for (const [index, letter] of letters.entries()) {
    const motor = rows.find(
      (piece) =>
        piece.component.id.startsWith(letter + '-') &&
        ['surpass-2838', 'surpass-2845'].includes(piece.component.libraryId),
    )!;
    const actual = new Vector3(0, 0, 1).transformDirection(occurrence(motor));
    const expected = new Vector3(0, -1, 0).transformDirection(channelTransform(index));
    near(Math.abs(actual.dot(expected)), 1);
    near(actual.z, 0);
    const canonical = new Vector3(...motor.component.placement.translation).applyMatrix4(
      channelTransform(index).clone().invert(),
    );
    near(canonical.z, -fixed.lever - fixed.motorSpacing);
    near(canonical.x, fixed.channelRadius);
    near(canonical.y, index % 2 === 0 ? -15.5 : 15.5);
    assert.equal(Math.sign(motor.component.placement.translation[2]), index % 2 === 0 ? -1 : 1);
  }
});

test('the closer motor pairs retain clearance and the discs define each uncovered envelope', () => {
  near(2 * fixed.channelRadius - 28, 0.2);
  for (const [motor, commands] of [
    ['surpass-2838-3700kv', [0, 0, 0, 0]],
    ['surpass-2838-3700kv', [20, -20, 20, -20]],
    ['surpass-2845-3100kv', [0, 0, 0, 0]],
  ] as [string, number[]][]) {
    const dimensions = part.dimensions({ ...parameters(commands), motor }, 'uncovered');
    near(dimensions[0], motor.startsWith('surpass-2845') ? 86 : 76, 0.001);
    near(dimensions[1], motor.startsWith('surpass-2845') ? 86 : 76, 0.001);
    near(dimensions[2], 2 * fixed.panelHigh, 0.001);
  }
  const rows = pieces(part.defaults, 'uncovered');
  for (const [index] of letters.entries()) {
    const radial = new Vector3(1, 0, 0).transformDirection(channelTransform(index));
    const bearing = byRole(rows, index, 'outerBearing').component;
    near(new Vector3(...bearing.placement.translation).dot(radial), 17.6);
    const pin = byRole(rows, index, 'forkPin');
    near(new Vector3(...pin.component.placement.translation).dot(radial), fixed.forkHubR);
    near(Math.abs(new Vector3(0, 0, 1).transformDirection(occurrence(pin)).z), 1);
  }
});

test('the inward 22-tooth gears keep their shaft axes and update the pinion drill phase', () => {
  near(fixed.motorSpacing, 22);
  near(fixed.gearTeeth, 22);
  near(fixed.gearFaceShift, 1.6);
  const rows = pieces(part.defaults, 'uncovered');
  for (const [index, letter] of letters.entries()) {
    const drive = channelTransform(index)
      .clone()
      .multiply(sourceTransform(index % 2 === 0));
    const inverse = drive.invert();
    for (const [suffix, radius, expectedY] of [
      ['driven-gear', 3.01, 0],
      ['motor-pinion', 3.175 / 2, 22],
    ] as [string, number, number][]) {
      const gear = rows.find((piece) => piece.component.id === letter + '-' + suffix)!;
      const bore = cylinders(gear).find(
        (shape) => shape.negative && Math.abs(shape.radius - radius) < 1e-8,
      )!;
      assert.ok(bore);
      const point = bore.from.clone().applyMatrix4(inverse);
      near(point.y, expectedY);
      near(point.z, 0);
    }
    const motor = rows.find((piece) => piece.component.id === letter + '-motor')!.component;
    near(Number(motor.parameters.shaftAngle), -180 / 22);
  }
  const bolts = rows.filter((piece) => /-motor-bolt-[12]$/.test(piece.component.id));
  assert.equal(bolts.length, 8);
  assert.ok(
    bolts.every(
      (piece) =>
        piece.component.parameters.head === 'countersunk' &&
        piece.component.parameters.length === 5,
    ),
  );
});

test('the relieved output head keeps its 20 mm rim close to the bearing and fork', () => {
  const rows = pieces(parameters([0, 20, -20, 7]), 'uncovered');
  for (const [channel] of letters.entries()) {
    const radial = new Vector3(1, 0, 0).transformDirection(channelTransform(channel));
    const stock = cylinders(byRole(rows, channel, 'shaft')).filter((item) => !item.negative);
    const back = stock.find((item) => Math.abs(item.radius - 9.5) < 1e-8)!;
    const rim = stock.find((item) => Math.abs(item.radius - 10) < 1e-8)!;
    assert.ok(back && rim);
    near(back.from.dot(radial), 19.35);
    near(rim.from.dot(radial), 23.65);
    near(rim.to.dot(radial), 24.35);
    near(back.from.dot(radial) - fixed.outerBearingEnd, 0.25);
    near(rim.from.dot(radial) - (fixed.forkOuterStart + fixed.forkThickness), 0.85);
    assert.ok(
      back.to.dot(radial) >= rim.from.dot(radial),
      'Both turned head sections overlap to form one continuous body.',
    );
  }
});

test('plain-sheet source journals remain coaxial after geometry normalization in Simple and Full', () => {
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const rows = pieces(parameters([20, -20, 7, -11]), 'uncovered');
      for (const [channel, letter] of letters.entries()) {
        const drive = channelTransform(channel).multiply(sourceTransform(channel % 2 === 0));
        const origin = new Vector3().applyMatrix4(drive),
          axis = new Vector3(1, 0, 0).transformDirection(drive);
        const journals = cylinders(byRole(rows, channel, 'screw')).filter(
          (item) =>
            !item.negative && [2.5, 3, 4].some((radius) => Math.abs(item.radius - radius) < 1e-8),
        );
        assert.ok(journals.length >= 5);
        for (const journal of journals) {
          near(Math.abs(journal.axis.dot(axis)), 1);
          near(journal.from.clone().sub(origin).cross(axis).length(), 0);
          near(journal.to.clone().sub(origin).cross(axis).length(), 0);
        }
        for (const [suffix, x] of [
          ['screw-front-bearing', -2.1],
          ['screw-rear-bearing', 33.1],
          ['gear-clip', -3.9],
          ['screw-rear-clip', 34.9],
        ] as [string, number][]) {
          const item = rows.find((piece) => piece.component.id === letter + '-' + suffix)!;
          const point = new Vector3()
            .setFromMatrixPosition(occurrence(item))
            .applyMatrix4(drive.clone().invert());
          near(point.x, x);
          near(point.y, 0);
          near(point.z, 0);
        }
      }
    });
});

test('two matching through-slot end discs have weld tongues and four chamfered wire ports each', () => {
  const rows = pieces(part.defaults, 'uncovered');
  assert.equal(rows.length, 107);
  const discs = rows.filter((piece) => piece.component.id.endsWith('-' + roleIds.endDisc));
  assert.equal(discs.length, 2);
  assert.deepEqual(discs[0].component.parameters, discs[1].component.parameters);
  assert.ok(discs.every((piece) => piece.requireSingleSolid));
  near(occurrence(discs[0]).determinant(), 1);
  near(occurrence(discs[1]).determinant(), 1);
  near(
    new Vector3(0, 0, 1)
      .transformDirection(occurrence(discs[0]))
      .dot(new Vector3(0, 0, 1).transformDirection(occurrence(discs[1]))),
    1,
  );
  assert.ok(!rows.some((piece) => /end-cap-bolt/.test(piece.component.id)));
  const discStock = cylinders(discs[0])
    .filter((item) => !item.negative)
    .sort((a, b) => b.radius - a.radius)[0];
  near(discStock.radius * 2, 76);
  near(fixed.endDiscThickness, 3);
  near(fixed.endTongueLength - fixed.endDiscThickness, 0.5);
  near(fixed.endSlotWidth - fixed.panelThickness, 0.15);
  near((fixed.endSlotSpan - fixed.endSlotWidth - fixed.endTongueSpan) / 2, 0.125);
  near(fixed.endWireHoleDiameter, 10);
  near(fixed.endWireHoleRadius, 28.5);
});

test('the real shaft journals define four concurrent radial lines and finite outward stubs', () => {
  const rows = pieces(parameters([20, -7, -20, 3]), 'uncovered');
  const directions: Vector3[] = [];
  for (const [index] of letters.entries()) {
    const stocks = cylinders(byRole(rows, index, 'shaft')).filter((cylinder) => !cylinder.negative);
    const journal = stocks
      .filter((cylinder) => Math.abs(cylinder.radius - 3) < 1e-8)
      .sort((a, b) => b.height - a.height)[0];
    assert.ok(journal);
    const radial = new Vector3(1, 0, 0).transformDirection(channelTransform(index));
    near(journal.axis.dot(radial), 1);
    near(journal.from.clone().cross(radial).length(), 0);
    near(journal.to.clone().cross(radial).length(), 0);
    assert.ok(journal.from.dot(radial) >= fixed.shaftStep - 1e-8);
    const tip = stocks.find((cylinder) => Math.abs(cylinder.radius - 1) < 1e-8)!;
    assert.ok(tip);
    near(Math.min(tip.from.dot(radial), tip.to.dot(radial)), 2.5);
    directions.push(radial);
    const bearing = byRole(rows, index, 'innerBearing').component;
    assert.equal(bearing.presetId, 'promteh-7439');
    near(new Vector3(...bearing.placement.translation).dot(radial), 4.75);
  }
  directions.forEach((direction, index) => near(direction.dot(directions[(index + 1) % 4]), 0));
  near(directions[0].dot(directions[2]), -1);
  near(directions[1].dot(directions[3]), -1);
});

test('four independent commands preserve every other channel and all housing definitions', () => {
  const neutral = pieces(part.defaults, 'uncovered');
  for (const [index, letter] of letters.entries()) {
    const changed = pieces(
      parameters(letters.map((_, channel) => (channel === index ? 13 : 0))),
      'uncovered',
    );
    assert.deepEqual(
      changed.filter((piece) => !piece.component.id.startsWith(letter + '-')),
      neutral.filter((piece) => !piece.component.id.startsWith(letter + '-')),
    );
    assert.deepEqual(byRole(changed, index, 'case'), byRole(neutral, index, 'case'));
    assert.notDeepEqual(
      byRole(changed, index, 'shaft').component.placement,
      byRole(neutral, index, 'shaft').component.placement,
    );
    assert.notDeepEqual(
      byRole(changed, index, 'nut').component.placement,
      byRole(neutral, index, 'nut').component.placement,
    );
  }
  assert.deepEqual(
    part.composition!(parameters([20, -20, 5, -7])),
    part.composition!(part.defaults),
  );
  assert.equal(
    eskdIdentity(part, parameters([20, -20, 5, -7]), 'uncovered').designation,
    eskdIdentity(part, part.defaults, 'uncovered').designation,
  );
});

test('all sixteen limit corners reach the end walls along each actual thread axis', () => {
  near(fixed.lever, 7.5 / Math.tan(Math.PI / 9));
  for (let mask = 0; mask < 16; mask++) {
    const commands = letters.map((_, index) => (mask & (1 << index) ? 20 : -20));
    const p = parameters(commands),
      rows = pieces(p, 'uncovered'),
      state = layout(p);
    for (const [index] of letters.entries()) {
      const tool = cylinders(byRole(rows, index, 'nut')).find(
        (cylinder) =>
          cylinder.negative && Math.abs(cylinder.radius - 4.05) < 1e-8 && cylinder.height > 10,
      )!;
      assert.ok(tool);
      const stock = cylinders(byRole(rows, index, 'screw')).find(
        (cylinder) =>
          !cylinder.negative &&
          Math.abs(cylinder.radius - 4) < 1e-8 &&
          Math.abs(cylinder.height - 31) < 1e-8,
      )!;
      assert.ok(stock);
      const center = tool.from.clone().add(tool.to).multiplyScalar(0.5);
      const stockCenter = stock.from.clone().add(stock.to).multiplyScalar(0.5);
      const relative = center.sub(stockCenter);
      const displacement = relative.dot(stock.axis);
      const sourceAngle = Number(driveParameters(p, index).outputAngle);
      near(relative.clone().cross(stock.axis).length(), 0);
      near(sourceAngle, commands[index] * (index % 2 === 0 ? -1 : 1));
      near(displacement, -fixed.lever * Math.tan((sourceAngle * Math.PI) / 180));
      near(state.channels[index].sourceAngle, sourceAngle);
      near(Math.abs(displacement), 7.5);
      near(Math.abs(displacement) + fixed.nutLength / 2, stock.height / 2);
      near(state.channels[index].screwTurns * 4, -displacement);
    }
  }
});

test('each fork is one CNC detail with one shaft fixation station and an identical neutral recipe', () => {
  const rows = pieces(part.defaults, 'uncovered');
  const reference = byRole(rows, 0, 'fork').component;
  for (const [index, letter] of letters.entries()) {
    const fork = byRole(rows, index, 'fork');
    assert.equal(fork.requireSingleSolid, true);
    assert.deepEqual(fork.component.parameters, reference.parameters);
    const pin = byRole(rows, index, 'forkPin').component;
    assert.equal(pin.libraryId, 'spring-pin');
    assert.equal(pin.parameters.diameter, 2);
    assert.equal(pin.parameters.length, 10);
    assert.equal(pin.state, 'installed');
    assert.equal(
      rows.filter(
        (piece) =>
          piece.component.id.startsWith(letter + '-') && /fork.*pin/.test(piece.component.id),
      ).length,
      1,
    );
    assert.ok(
      !rows.some(
        (piece) =>
          piece.component.id.startsWith(letter + '-') &&
          /fork-(?:upper|lower)-plate/.test(piece.component.id),
      ),
    );
  }
  const schedule = machiningSchedule(part.defaults);
  assert.equal(schedule.fork.quantity, 4);
  assert.equal(schedule.nut.length, 16);
  assert.equal(schedule.sourceDrive.workingThread.length, 31);
});

test('the straight eye arm shares the full hub thickness and its pin aligns with the shaft drill', () => {
  const rows = pieces(parameters([20, -20, 7, -11]), 'uncovered');
  for (const [channel] of letters.entries()) {
    const fork = byRole(rows, channel, 'fork');
    const eye = cylinders(fork).find(
      (item) =>
        !item.negative && Math.abs(item.radius - 5.5) < 1e-8 && Math.abs(item.height - 6) < 1e-8,
    )!;
    assert.ok(eye);
    const arms = cheeks(fork, 0).filter((item) => Math.abs(item.depth - eye.height) < 1e-8);
    assert.equal(arms.length, 1, 'One full-depth arm replaces the offset thin bridge.');
    const arm = arms[0];
    near(new Vector3(0, 0, arm.origin).applyMatrix4(arm.frame).distanceTo(eye.from), 0);
    near(new Vector3(0, 0, arm.origin + arm.depth).applyMatrix4(arm.frame).distanceTo(eye.to), 0);
    for (const station of [6, 8, 10, 12])
      assert.ok(
        insidePolygon(arm.points, 0, station),
        'The arm forms a continuous straight connection from the eye to the U web.',
      );
    const pin = byRole(rows, channel, 'forkPin');
    const center = new Vector3().setFromMatrixPosition(occurrence(pin));
    near(center.distanceTo(eye.from.clone().add(eye.to).multiplyScalar(0.5)), 0);
    const axis = new Vector3(0, 0, 1).transformDirection(occurrence(pin));
    for (const host of [fork, byRole(rows, channel, 'shaft')]) {
      const holes = cylinders(host).filter(
        (item) => item.negative && Math.abs(item.radius - 1) < 1e-8,
      );
      assert.equal(holes.length, 1);
      near(Math.abs(holes[0].axis.dot(axis)), 1);
      near(holes[0].from.clone().sub(center).cross(axis).length(), 0);
      if (host === fork) near(holes[0].height, 19.4);
    }
  }
});

test('the rear cheek silhouette is flush with the rounded U web', () => {
  const rows = pieces(parameters([0, 20, -20, 7]), 'uncovered');
  for (const [channel] of letters.entries()) {
    const fork = byRole(rows, channel, 'fork');
    const web = cheeks(fork, 0).find((item) => item.depth > 16)!;
    assert.ok(web);
    for (const cheek of cheeks(fork)) {
      const inverse = cheek.frame.clone().invert();
      const profile = web.points.map(([x, y]) => {
        const point = new Vector3(x, y, web.origin).applyMatrix4(web.frame).applyMatrix4(inverse);
        return [point.x, point.y] as [number, number];
      });
      const rear = Math.min(...profile.map((point) => point[1]));
      near(Math.min(...cheek.points.map((point) => point[1])), rear);
      for (const offset of [0.05, 0.2, 0.5, 0.8, 1]) {
        const section = (points: [number, number][]) =>
          sectionYs(
            points.map(([x, y]) => [y, x]),
            rear + offset,
          );
        const a = section(profile),
          b = section(cheek.points);
        // The web has exact native R1 arcs; the cheek retains its six-segment corner.
        near(Math.min(...a), Math.min(...b), 0.01);
        near(Math.max(...a), Math.max(...b), 0.01);
      }
    }
  }
});

test('actual follower pins remain near the closed slot end at neutral and fully retained throughout motion', () => {
  for (let angle = -20; angle <= 20; angle += 2) {
    const rows = pieces(parameters([angle, -angle, angle, -angle]), 'uncovered');
    for (const [channel] of letters.entries()) {
      const profiles = cheeks(byRole(rows, channel, 'fork'));
      const pins = cylinders(byRole(rows, channel, 'nut')).filter(
        (item) =>
          !item.negative && Math.abs(item.radius - 2) < 1e-9 && Math.abs(item.height - 3.25) < 1e-9,
      );
      assert.equal(profiles.length, 2);
      assert.equal(pins.length, 2);
      for (const cheek of profiles) {
        assert.ok(cheek.depth >= 2.6, 'The follower cheeks retain at least 2.6 mm of stock.');
        const inverse = cheek.frame.clone().invert();
        const candidates = pins.map((pin) => ({
          pin,
          from: pin.from.clone().applyMatrix4(inverse),
          to: pin.to.clone().applyMatrix4(inverse),
        }));
        const engaged = candidates.filter(
          ({ from, to }) =>
            Math.min(from.z, to.z) <= cheek.origin + 1e-8 &&
            Math.max(from.z, to.z) >= cheek.origin + cheek.depth - 1e-8,
        );
        assert.equal(
          engaged.length,
          1,
          'One physical follower pin must span the entire cheek thickness.',
        );
        const { pin, from, to } = engaged[0];
        const projection =
          cheek.origin < 0
            ? cheek.origin - Math.min(from.z, to.z)
            : Math.max(from.z, to.z) - cheek.origin - cheek.depth;
        assert.ok(
          projection >= 0.49,
          'Each follower pin projects at least 0.5 mm beyond its cheek.',
        );
        near(from.x, to.x);
        near(from.y, to.y);
        near(from.x, 0);
        const tip = Math.max(...cheek.points.map((point) => point[1]));
        assert.ok(
          tip - from.y - pin.radius >= 2,
          'The full pin circumference needs at least one pin radius of reserve before the open mouth.',
        );
        const floor = Math.max(...sectionYs(cheek.points, from.x));
        const closedClearance = from.y - pin.radius - floor;
        assert.ok(closedClearance > 0.04, 'The pin must clear the closed slot floor.');
        if (angle === 0)
          assert.ok(closedClearance <= 0.3, 'At neutral the pin must sit close to the closed end.');
        for (const side of [-1, 1])
          for (const dy of [-2, -1, 0, 1, 2]) {
            assert.ok(
              insidePolygon(cheek.points, from.x + side * (pin.radius + 0.1), from.y + dy),
              'Both cheeks need material alongside the full follower diameter.',
            );
          }
      }
    }
  }
});

test('native TR8 callouts retain the actual global axes, thread lead and relieved engagement', () => {
  const p = parameters([20, -20, 7, -11]);
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const source = part.python(p, 'uncovered');
      assert.ok(source.includes('QuadChannel'));
      assert.ok(source.includes('ThreadFeaturesJSON'));
      assert.ok(source.includes('15.2'));
      assert.ok(source.includes(mode === 'full' ? 'machined-helix' : 'nominal-cylinder'));
      for (const letter of letters) assert.ok(source.includes(letter + '-' + roleIds.screw));
    });
});
