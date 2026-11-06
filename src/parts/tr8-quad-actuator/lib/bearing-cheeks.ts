import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { frameLayout, mechanismLayout } from './layout';

export type Point2 = [number, number];
export interface CheekFrame {
  radius: number;
  clock: number;
}
export const bearingCheekFrame: CheekFrame = frameLayout;
export const bearingCheekDimensions = {
  thickness: 4,
  bossDiameter: 17.5,
  finishedBore: 13.02,
  pilotBore: 12.8,
  railOffsets: [-6, 6],
  railHeight: 3,
  shoulderHeight: 5,
  shoulderLength: 3,
  ordinaryTabDepth: 2.7,
  slotWidth: 4.1,
  slotHeight: 3.1,
} as const;
export type ProfileEdge =
  | { kind: 'line'; from: Point2; to: Point2 }
  | {
      kind: 'arc';
      from: Point2;
      to: Point2;
      center: Point2;
      radius: number;
      start: number;
      end: number;
    };
interface Rect {
  x1: number;
  x2: number;
  z1: number;
  z2: number;
}
export interface BearingCheek {
  id: string;
  label: string;
  unit: number;
  positive: boolean;
  profileType: 'interleaved-inner-bar' | 'round-outer-cheek';
  shape: Shape;
  color: number;
  /** Local drawing plane is X/Z; the bore centre is the common output pivot. */
  contours: ProfileEdge[][];
  localShape: Shape;
  sheetLowY: number;
  thickness: 4;
  placement: { translation: Vec; rotation: Vec };
  anchorFacesX: [number, number];
  tabSpansX: [[number, number], [number, number]];
}
export interface BearingCheekSlot {
  id: string;
  plateId: 'fixed' | 'end';
  unit: number;
  positive: boolean;
  end: 'left' | 'right';
  railOffset: number;
  width: number;
  height: number;
  receiverSpanX: [number, number];
  tabSpanX: [number, number];
  shoulderFaceX: number;
  /** Millimetres in the common main plate's global Y/Z drawing plane. */
  points: Point2[];
  center: Point2;
}
const radians = Math.PI / 180;
const circleCenter: Point2 = [mechanismLayout.outputX, 0];
const circleRadius = 8.75;
const pointKey = (p: Point2) => p.map((v) => Math.round(v * 1e8)).join(',');
const interpolate = (a: Point2, b: Point2, t: number): Point2 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const insideRect = ([x, z]: Point2, r: Rect) =>
  x > r.x1 + 1e-8 && x < r.x2 - 1e-8 && z > r.z1 + 1e-8 && z < r.z2 - 1e-8;
const insideCircle = ([x, z]: Point2) =>
  (x - circleCenter[0]) ** 2 + z * z < circleRadius ** 2 - 1e-8;

/** Exact line/arc boundary of the union; no mesh or polygonal circle approximation. */
function unionContours(rectangles: Rect[], includeCircle = true): ProfileEdge[][] {
  const selected: ProfileEdge[] = [];
  const angles = [0, 2 * Math.PI];
  const rectEdges = rectangles.flatMap((r, owner) => {
    const p: Point2[] = [
      [r.x1, r.z1],
      [r.x2, r.z1],
      [r.x2, r.z2],
      [r.x1, r.z2],
    ];
    return p.map((from, i) => ({ from, to: p[(i + 1) % 4], owner }));
  });
  for (const edge of rectEdges) {
    const parameters = [0, 1];
    const dx = edge.to[0] - edge.from[0],
      dz = edge.to[1] - edge.from[1];
    for (const other of rectEdges) {
      if (Math.abs(dx) > 1e-9 && Math.abs(other.to[1] - other.from[1]) > 1e-9) {
        const t = (other.from[0] - edge.from[0]) / dx;
        const z = edge.from[1];
        if (
          t > 0 &&
          t < 1 &&
          z >= Math.min(other.from[1], other.to[1]) - 1e-8 &&
          z <= Math.max(other.from[1], other.to[1]) + 1e-8
        )
          parameters.push(t);
      } else if (Math.abs(dz) > 1e-9 && Math.abs(other.to[0] - other.from[0]) > 1e-9) {
        const t = (other.from[1] - edge.from[1]) / dz;
        const x = edge.from[0];
        if (
          t > 0 &&
          t < 1 &&
          x >= Math.min(other.from[0], other.to[0]) - 1e-8 &&
          x <= Math.max(other.from[0], other.to[0]) + 1e-8
        )
          parameters.push(t);
      } else if (Math.abs(dx) > 1e-9 && Math.abs(other.from[1] - edge.from[1]) < 1e-8) {
        for (const p of [other.from, other.to]) {
          const t = (p[0] - edge.from[0]) / dx;
          if (t > 0 && t < 1) parameters.push(t);
        }
      } else if (Math.abs(dz) > 1e-9 && Math.abs(other.from[0] - edge.from[0]) < 1e-8) {
        for (const p of [other.from, other.to]) {
          const t = (p[1] - edge.from[1]) / dz;
          if (t > 0 && t < 1) parameters.push(t);
        }
      }
    }
    const a = dx * dx + dz * dz;
    const b = 2 * ((edge.from[0] - circleCenter[0]) * dx + edge.from[1] * dz);
    const c = (edge.from[0] - circleCenter[0]) ** 2 + edge.from[1] ** 2 - circleRadius ** 2;
    const discriminant = b * b - 4 * a * c;
    if (includeCircle && discriminant >= -1e-8) {
      for (const t of [
        (-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a),
        (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * a),
      ]) {
        if (t < -1e-8 || t > 1 + 1e-8) continue;
        const p = interpolate(edge.from, edge.to, Math.max(0, Math.min(1, t)));
        parameters.push(Math.max(0, Math.min(1, t)));
        angles.push((Math.atan2(p[1], p[0] - circleCenter[0]) + 2 * Math.PI) % (2 * Math.PI));
      }
    }
    const split = [...new Set(parameters.map((v) => Math.round(v * 1e12) / 1e12))].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < split.length - 1; i++) {
      const middle = interpolate(edge.from, edge.to, (split[i] + split[i + 1]) / 2);
      if (
        (includeCircle && insideCircle(middle)) ||
        rectangles.some((r, owner) => owner !== edge.owner && insideRect(middle, r))
      )
        continue;
      selected.push({
        kind: 'line',
        from: interpolate(edge.from, edge.to, split[i]),
        to: interpolate(edge.from, edge.to, split[i + 1]),
      });
    }
  }
  const splitAngles = [
    ...new Set((includeCircle ? angles : []).map((v) => Math.round(v * 1e12) / 1e12)),
  ].sort((a, b) => a - b);
  const onCircle = (angle: number): Point2 => [
    circleCenter[0] + circleRadius * Math.cos(angle),
    circleRadius * Math.sin(angle),
  ];
  for (let i = 0; i < splitAngles.length - 1; i++) {
    const start = splitAngles[i],
      end = splitAngles[i + 1];
    if (end - start < 1e-9 || rectangles.some((r) => insideRect(onCircle((start + end) / 2), r)))
      continue;
    selected.push({
      kind: 'arc',
      from: onCircle(start),
      to: onCircle(end),
      center: circleCenter,
      radius: circleRadius,
      start,
      end,
    });
  }
  // Coincident outward boundaries are one edge; opposite shared interior edges cancel.
  const unique = new Map<string, ProfileEdge>();
  for (const edge of selected) {
    const key = pointKey(edge.from) + '>' + pointKey(edge.to);
    const opposite = pointKey(edge.to) + '>' + pointKey(edge.from);
    if (unique.has(opposite)) unique.delete(opposite);
    else if (!unique.has(key)) unique.set(key, edge);
  }
  const remaining = [...unique.values()];
  const loops: ProfileEdge[][] = [];
  while (remaining.length) {
    const loop = [remaining.shift()!];
    while (pointKey(loop[loop.length - 1].to) !== pointKey(loop[0].from)) {
      const index = remaining.findIndex(
        (edge) => pointKey(edge.from) === pointKey(loop[loop.length - 1].to),
      );
      if (index < 0) throw new Error('The laser cheek contour is not a closed directed wire.');
      loop.push(remaining.splice(index, 1)[0]);
    }
    // Shared rectangle corners can split one straight boundary into several
    // collinear segments. Emit each continuous laser edge only once.
    let merged = true;
    while (merged && loop.length > 2) {
      merged = false;
      for (let i = 0; i < loop.length; i++) {
        const j = (i + 1) % loop.length;
        const first = loop[i],
          second = loop[j];
        if (first.kind !== 'line' || second.kind !== 'line') continue;
        const a = [first.to[0] - first.from[0], first.to[1] - first.from[1]];
        const b = [second.to[0] - second.from[0], second.to[1] - second.from[1]];
        const cross = a[0] * b[1] - a[1] * b[0];
        if (
          Math.abs(cross) > 1e-9 * Math.max(1, Math.hypot(...a) * Math.hypot(...b)) ||
          a[0] * b[0] + a[1] * b[1] <= 0
        )
          continue;
        const edge: ProfileEdge = { kind: 'line', from: first.from, to: second.to };
        if (j === 0) {
          loop[0] = edge;
          loop.pop();
        } else loop.splice(i, 2, edge);
        merged = true;
        break;
      }
    }
    loops.push(loop);
  }
  return loops;
}

function profile(positive: boolean, frame: CheekFrame) {
  const [left, right] = frameLayout.cheekAnchors;
  const leftDepth = 2.7,
    rightDepth = 2.7;
  const leftTabHeight = 3,
    rightTabHeight = 3;
  const leftShoulderHeight = 5,
    rightShoulderHeight = 5;
  const rectangles: Rect[] = [];
  if (!positive) {
    const inner = frame.radius - mechanismLayout.bearingCentres[1] - 1.4;
    rectangles.push({
      x1: circleCenter[0] - circleRadius,
      x2: circleCenter[0] + circleRadius,
      z1: -(inner + 4) + frameLayout.innerBarSeam,
      z2: inner - frameLayout.innerBarSeam,
    });
  }
  for (const z of [-6, 6])
    rectangles.push(
      { x1: left, x2: right, z1: z - 1.5, z2: z + 1.5 },
      { x1: left, x2: left + 3, z1: z - leftShoulderHeight / 2, z2: z + leftShoulderHeight / 2 },
      {
        x1: right - 3,
        x2: right,
        z1: z - rightShoulderHeight / 2,
        z2: z + rightShoulderHeight / 2,
      },
      { x1: left - leftDepth, x2: left, z1: z - leftTabHeight / 2, z2: z + leftTabHeight / 2 },
      { x1: right, x2: right + rightDepth, z1: z - rightTabHeight / 2, z2: z + rightTabHeight / 2 },
    );
  return { left, right, leftDepth, rightDepth, leftTabHeight, rightTabHeight, rectangles };
}

export function bearingCheeks(frame: CheekFrame = bearingCheekFrame): BearingCheek[] {
  const result: BearingCheek[] = [];
  for (let unit = 0; unit < 4; unit++)
    for (const positive of [false, true]) {
      const p = profile(positive, frame),
        centre = mechanismLayout.bearingCentres[1],
        low = positive ? centre - 2.6 : -centre - 1.4;
      const theta = frame.clock + unit * 90,
        angle = theta * radians;
      const translation: Vec = [0, Math.cos(angle) * frame.radius, Math.sin(angle) * frame.radius];
      const localShape = subtract(
        union(
          ...(positive ? [cylinder(circleRadius, 4, [circleCenter[0], low, 0], 'y')] : []),
          ...p.rectangles.map((r) => box([r.x2 - r.x1, 4, r.z2 - r.z1], [r.x1, low, r.z1])),
        ),
        cylinder(6.51, 4.2, [circleCenter[0], low - 0.1, 0], 'y'),
      );
      result.push({
        id: `channel-${unit + 1}-output-${positive ? 'positive' : 'negative'}-cheek`,
        label: `Channel ${unit + 1} ${positive ? 'outer output bearing cheek' : 'clockwise interleaved inner bearing bar'} · 4 mm laser steel`,
        unit,
        positive,
        profileType: positive ? 'round-outer-cheek' : 'interleaved-inner-bar',
        color: 0x566f82,
        thickness: 4,
        localShape,
        shape: { kind: 'transform', child: localShape, translation, rotation: [theta, 0, 0] },
        contours: unionContours(p.rectangles, positive),
        sheetLowY: low,
        placement: { translation, rotation: [theta, 0, 0] },
        anchorFacesX: [p.left + translation[0], p.right + translation[0]],
        tabSpansX: [
          [p.left - p.leftDepth + translation[0], p.left + translation[0]],
          [p.right + translation[0], p.right + p.rightDepth + translation[0]],
        ],
      });
    }
  return result;
}

export function bearingCheekSlots(frame: CheekFrame = bearingCheekFrame): BearingCheekSlot[] {
  const slots: BearingCheekSlot[] = [];
  for (const cheek of bearingCheeks(frame)) {
    const p = profile(cheek.positive, frame),
      theta = cheek.placement.rotation[0] * radians;
    const world = (y: number, z: number): Point2 => [
      Math.cos(theta) * y - Math.sin(theta) * z + cheek.placement.translation[1],
      Math.sin(theta) * y + Math.cos(theta) * z + cheek.placement.translation[2],
    ];
    for (const [index, end] of ['left', 'right'].entries())
      for (const offset of [-6, 6]) {
        const low = cheek.sheetLowY;
        const height = (index ? p.rightTabHeight : p.leftTabHeight) + 0.1;
        const points = [
          [low - 0.05, offset - height / 2],
          [low + 4.05, offset - height / 2],
          [low + 4.05, offset + height / 2],
          [low - 0.05, offset + height / 2],
        ].map(([y, z]) => world(y, z));
        const plateId = index ? 'end' : 'fixed';
        const station = frameLayout.plateStations[index ? 2 : 1];
        const receiverSpanX: [number, number] = [station, station + frameLayout.discThickness];
        slots.push({
          id: `${cheek.id}-${end}-${offset < 0 ? 'lower' : 'upper'}-slot`,
          plateId,
          unit: cheek.unit,
          positive: cheek.positive,
          end: end as 'left' | 'right',
          railOffset: offset,
          width: 4.1,
          height,
          receiverSpanX,
          tabSpanX: cheek.tabSpansX[index],
          shoulderFaceX: cheek.anchorFacesX[index],
          points,
          center: world(low + 2, offset),
        });
      }
  }
  return slots;
}

/** Flat XY stock for the laser blank macro; cut pilots remain distinct from finished bores. */
export function bearingCheekBlankShape(
  cheek: BearingCheek,
  pilot = true,
  frame: CheekFrame = bearingCheekFrame,
): Shape {
  const p = profile(cheek.positive, frame);
  return subtract(
    union(
      ...(cheek.positive ? [cylinder(circleRadius, 4, [circleCenter[0], 0, 0])] : []),
      ...p.rectangles.map((r) => box([r.x2 - r.x1, r.z2 - r.z1, 4], [r.x1, r.z1, 0])),
    ),
    cylinder((pilot ? 12.8 : 13.02) / 2, 4.2, [circleCenter[0], 0, -0.1]),
  );
}

/** Exact 1:1 millimetre contours, with proper circular ARC entities. */
export function bearingCheekDxf(cheek: BearingCheek, pilot = true): string {
  const pairs: (number | string)[] = [
    0,
    'SECTION',
    2,
    'HEADER',
    9,
    '$INSUNITS',
    70,
    4,
    0,
    'ENDSEC',
    0,
    'SECTION',
    2,
    'ENTITIES',
  ];
  for (const loop of cheek.contours)
    for (const edge of loop) {
      if (edge.kind === 'line')
        pairs.push(
          0,
          'LINE',
          8,
          'CUT',
          10,
          edge.from[0],
          20,
          edge.from[1],
          11,
          edge.to[0],
          21,
          edge.to[1],
        );
      else
        pairs.push(
          0,
          'ARC',
          8,
          'CUT',
          10,
          edge.center[0],
          20,
          edge.center[1],
          40,
          edge.radius,
          50,
          (edge.start / radians) % 360,
          51,
          (edge.end / radians) % 360,
        );
    }
  pairs.push(
    0,
    'CIRCLE',
    8,
    pilot ? 'BEARING_PILOT' : 'BEARING_FINISHED',
    10,
    circleCenter[0],
    20,
    0,
    40,
    (pilot ? 12.8 : 13.02) / 2,
    0,
    'ENDSEC',
    0,
    'EOF',
  );
  return pairs.join('\n') + '\n';
}

export function bearingCheekSvg(cheek: BearingCheek, pilot = true): string {
  const allPoints = cheek.contours.flatMap((loop) => loop.flatMap((edge) => [edge.from, edge.to]));
  const xMin = Math.min(...allPoints.map(([x]) => x)) - 1;
  const xMax = Math.max(...allPoints.map(([x]) => x)) + 1;
  const zMin = Math.min(-circleRadius, ...allPoints.map(([, z]) => z)) - 1;
  const zMax = Math.max(circleRadius, ...allPoints.map(([, z]) => z)) + 1;
  const loops = cheek.contours
    .map(
      (loop) =>
        'M' +
        loop[0].from.join(',') +
        ' ' +
        loop
          .map((edge) =>
            edge.kind === 'line'
              ? 'L' + edge.to.join(',')
              : `A${edge.radius},${edge.radius} 0 ${edge.end - edge.start > Math.PI ? 1 : 0},1 ${edge.to.join(',')}`,
          )
          .join(' ') +
        ' Z',
    )
    .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${xMax - xMin}mm" height="${zMax - zMin}mm" viewBox="${xMin} ${-zMax} ${xMax - xMin} ${zMax - zMin}"><g transform="scale(1,-1)" fill="none" stroke="#111" stroke-width="0.08"><path d="${loops}"/><circle cx="${circleCenter[0]}" cy="0" r="${(pilot ? 12.8 : 13.02) / 2}"/></g></svg>\n`;
}
