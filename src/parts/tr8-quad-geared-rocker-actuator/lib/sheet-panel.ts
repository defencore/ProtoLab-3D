import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { fixed as f, standMountPattern } from './layout';
import {
  panelLighteningCuts,
  panelLighteningCircles,
  panelLighteningLoops,
  panelLighteningValues,
} from './lightening';

type P = [number, number];
export type SheetPanelFold = 1 | -1;
export type SheetPanelEdge =
  | { kind: 'line'; from: P; to: P }
  | { kind: 'arc'; from: P; to: P; center: P; radius: number; start: number; end: number };
export const sheetPanel = {
  thickness: 3,
  material: 'Aluminium 5052-O',
  innerRadius: 1.5,
  outerRadius: 4.5,
  kFactor: 0.4,
  bendCenter: [20, 4.5] as P,
  flangeRootT: [18.5, 29.3] as P,
  clampOuter: 23,
  clampInner: 23,
  clampCanonicalInner: 11,
  clampClearanceRadius: 1.6,
  flangePadRadius: 3.25,
  clampLength: 10,
  clampStack: 6,
  tongueHalfWidth: -f.panelLow,
  bearingFootRadius: -f.panelLow,
  bearingHoleRadius: 5.01,
  bearingFreeEdgeLand: -f.panelLow - 5.01,
  standEars: {
    outerT: 15.2,
    bottom: -3.5,
    top: 4.5,
    outerRadius: 1,
  },
  endTongueSpan: 46.6,
} as const;
const move = (child: Shape, translation: Vec = [0, 0, 0], rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
const clean = (p: P[]): P[] =>
  p.filter((a, i) => !i || Math.hypot(a[0] - p[i - 1][0], a[1] - p[i - 1][1]) > 1e-8);
function hull(points: P[]): P[] {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: P, b: P, c: P) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (items: P[]) => {
    const out: P[] = [];
    for (const p of items) {
      while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], p) <= 1e-10)
        out.pop();
      out.push(p);
    }
    return out;
  };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}
const circle = (n: number, t: number, r: number): P[] =>
  Array.from({ length: 72 }, (_, i) => [
    n + r * Math.cos((i * Math.PI) / 36),
    t + r * Math.sin((i * Math.PI) / 36),
  ]);
/** One positive-T flange; both formed hands use this same developed outline. */
export function sheetPanelFlangeOutline(): P[] {
  return hull([
    [20, 18.5],
    [20, 29.3],
    ...circle(sheetPanel.clampOuter, sheetPanel.clampInner, sheetPanel.flangePadRadius),
  ]);
}
export const sheetPanelClampHoles = (fold: SheetPanelFold = 1): P[] =>
  [-1, 1].map(
    (s) =>
      [
        fold === 1 ? sheetPanel.clampOuter : sheetPanel.clampCanonicalInner,
        s * sheetPanel.clampInner,
      ] as P,
  );
export const sheetPanelClampPositions = (): Vec[] =>
  [-1, 1].flatMap((x) =>
    [-1, 1].map((y) => [x * sheetPanel.clampOuter, y * sheetPanel.clampInner, 0] as Vec),
  );
function bend(t0: number, t1: number): Shape {
  const ring = subtract(
    cylinder(4.5, t1 - t0, [20, t0, 4.5], 'y'),
    cylinder(1.5, t1 - t0 + 0.2, [20, t0 - 0.1, 4.5], 'y'),
  );
  return { kind: 'intersect', children: [ring, box([4.5, t1 - t0, 4.5], [15.5, t0, 0])] };
}
/** Real 3 mm sheet: one wall, two quarter-annular bends and two horizontal flanges. */
export const sheetPanelMotorSide = (index: number): SheetPanelFold => (index % 2 ? -1 : 1);

/** A shallow same-sheet extension supports the two stand threads beside the shaft. */
function standSideStock(): Shape {
  const e = sheetPanel.standEars,
    outerCenter = e.outerT - e.outerRadius;
  const corner = (side: 1 | -1): Shape =>
    subtract(
      box([3, e.outerRadius, e.outerRadius], [15.5, side > 0 ? outerCenter : -e.outerT, e.bottom]),
      cylinder(e.outerRadius, 3.2, [15.4, side * outerCenter, e.bottom + e.outerRadius], 'x'),
    );
  return subtract(
    box([3, 2 * e.outerT, e.top - e.bottom], [15.5, -e.outerT, e.bottom]),
    corner(1),
    corner(-1),
  );
}

export function sheetPanelShape(fold: SheetPanelFold = 1, motorSide: SheetPanelFold = fold): Shape {
  const shoulder = f.panelHigh - f.endTongueLength;
  const wall = union(
    box([3, 2 * f.panelHalfWidth, shoulder - 4.5], [15.5, -f.panelHalfWidth, 4.5]),
    cylinder(sheetPanel.bearingFootRadius, 3, [15.5, 0, 0], 'x'),
    box(
      [3, sheetPanel.endTongueSpan, f.endTongueLength],
      [15.5, -sheetPanel.endTongueSpan / 2, shoulder],
    ),
    standSideStock(),
  );
  const positive = sheetPanelFlangeOutline();
  const negative = positive.map(([n, t]): P => [n, -t]).reverse();
  const positiveBlank = union(
    wall,
    bend(18.5, 29.3),
    prism(positive, 3, 0),
    bend(-29.3, -18.5),
    prism(negative, 3, 0),
  );
  // Rotation of the symmetric stock mirrors its normal without mirroring the
  // asymmetric motor holes: all finishing is applied in the same wall datums.
  const blank = fold === 1 ? positiveBlank : move(positiveBlank, [34, 0, 0], [0, 0, 180]);
  const cuts: Shape[] = [];
  for (const t of [-f.channelRadius, f.channelRadius, 0]) {
    const z = t === 0 ? 0 : f.lever;
    cuts.push(cylinder(5.01, 3.2, [15.4, t, z], 'x'));
  }
  cuts.push(
    cylinder(1.8, 3.2, [15.4, f.channelRadius, f.lever + f.motorSpacing], 'x'),
    cylinder(14.3, 3.2, [15.4, -f.channelRadius, f.lever + f.motorSpacing], 'x'),
  );
  for (const d of [-8, 8]) {
    const t = f.channelRadius + d,
      z = f.lever + f.motorSpacing;
    cuts.push(cylinder(1.6, 3.2, [15.4, t, z], 'x'));
    const seat: Shape = {
      kind: 'revolve',
      profile: [
        [0, -0.1],
        [3.05, -0.1],
        [3.05, 0.2],
        [1.55, 1.7],
        [0, 1.7],
      ],
    };
    cuts.push(
      motorSide === 1
        ? move(seat, [18.5, t, z], [0, -90, 0])
        : move(seat, [15.5, t, z], [0, 90, 0]),
    );
  }
  for (const [n, t] of sheetPanelClampHoles(fold)) cuts.push(cylinder(1.6, 3.2, [n, t, -0.1]));
  cuts.push({
    kind: 'cylinder',
    radius: 1.5,
    height: 3.2,
    origin: [15.4, motorSide * f.coverMountT, f.coverMountZ],
    axis: 'x',
    thread: { pitch: 0.5, internal: true, radialClearance: 0.04 },
  });
  for (const [t, z] of standMountPattern)
    cuts.push({
      kind: 'cylinder',
      radius: f.standThreadDiameter / 2,
      height: 3.2,
      origin: [15.4, t, z],
      axis: 'x',
      thread: { pitch: f.standThreadPitch, internal: true, radialClearance: 0.04 },
    });
  cuts.push(...panelLighteningCuts());
  return subtract(blank, ...cuts);
}
const edgeLoop = (points: P[]): SheetPanelEdge[] =>
  points.map((from, i) => ({ kind: 'line', from, to: points[(i + 1) % points.length] }));
/** Developed coordinates: u=T, v=wall Z. Bend allowance uses the declared K factor. */
export function sheetPanelFlatPattern(fold: SheetPanelFold = 1, motorSide: SheetPanelFold = fold) {
  const allowance =
    (Math.PI / 2) * (sheetPanel.innerRadius + sheetPanel.kFactor * sheetPanel.thickness);
  const root = 4.5,
    tangent = root - allowance,
    shoulder = f.panelHigh - f.endTongueLength;
  const flange = sheetPanelFlangeOutline();
  const developed = flange.map(([n, t]): P => [t, tangent - (n - 20)]);
  // Walk the positive flange from the outer tangent station towards the central tongue.
  const positive = [...developed].reverse();
  const ear = sheetPanel.standEars,
    outerCenter = ear.outerT - ear.outerRadius,
    footJoinT = Math.sqrt(sheetPanel.bearingFootRadius ** 2 - ear.bottom ** 2);
  const outer: P[] = [
    [-f.panelHalfWidth, root],
    [-f.panelHalfWidth, shoulder],
    [-23.3, shoulder],
    [-23.3, f.panelHigh],
    [23.3, f.panelHigh],
    [23.3, shoulder],
    [f.panelHalfWidth, shoulder],
    [f.panelHalfWidth, root],
    [29.3, root],
    ...positive,
    [18.5, root],
    [ear.outerT, root],
    [ear.outerT, ear.bottom + ear.outerRadius],
    [outerCenter, ear.bottom],
    [footJoinT, ear.bottom],
    [-footJoinT, ear.bottom],
    [-outerCenter, ear.bottom],
    [-ear.outerT, ear.bottom + ear.outerRadius],
    [-ear.outerT, root],
    [-18.5, root],
    ...positive.map(([u, v]): P => [-u, v]).reverse(),
    [-29.3, root],
  ];
  const circles: { center: P; radius: number }[] = [];
  for (const t of [-f.channelRadius, f.channelRadius, 0])
    circles.push({ center: [t, t === 0 ? 0 : f.lever], radius: 5.01 });
  circles.push(
    { center: [f.channelRadius, f.lever + f.motorSpacing], radius: 1.8 },
    { center: [-f.channelRadius, f.lever + f.motorSpacing], radius: 14.3 },
  );
  for (const d of [-8, 8])
    circles.push({ center: [f.channelRadius + d, f.lever + f.motorSpacing], radius: 1.6 });
  for (const [n, t] of sheetPanelClampHoles())
    circles.push({ center: [t, tangent - (n - 20)], radius: 1.6 });
  circles.push({ center: [motorSide * f.coverMountT, f.coverMountZ], radius: 1.25 });
  for (const [t, z] of standMountPattern)
    circles.push({ center: [t, z], radius: f.standPilotDiameter / 2 });
  circles.push(...panelLighteningCircles.map(({ center, radius }) => ({ center, radius })));
  return {
    thickness: 3,
    fold,
    motorCountersinkSide: motorSide,
    motorCountersinkFaceN: motorSide === 1 ? 18.5 : 15.5,
    bearingHoleDiameter: 10.02,
    bearingSeatRecesses: false,
    commonBlankId: 'tr8-quad-sheet-panel-blank',
    material: sheetPanel.material,
    kFactor: sheetPanel.kFactor,
    bendAllowance: allowance,
    coordinateSystem: 'u=tangent T; v=developed wall Z',
    loops: [
      edgeLoop(clean(outer)).map((edge): SheetPanelEdge => {
        if (edge.from[0] === footJoinT && edge.to[0] === -footJoinT) {
          const start = Math.atan2(ear.bottom, footJoinT);
          return {
            kind: 'arc',
            from: edge.from,
            to: edge.to,
            center: [0, 0],
            radius: sheetPanel.bearingFootRadius,
            start,
            end: -Math.PI - start,
          };
        }
        const arcs = [
          {
            from: [ear.outerT, ear.bottom + ear.outerRadius],
            to: [outerCenter, ear.bottom],
            center: [outerCenter, ear.bottom + ear.outerRadius],
            radius: ear.outerRadius,
            start: 0,
            end: -Math.PI / 2,
          },
          {
            from: [-outerCenter, ear.bottom],
            to: [-ear.outerT, ear.bottom + ear.outerRadius],
            center: [-outerCenter, ear.bottom + ear.outerRadius],
            radius: ear.outerRadius,
            start: -Math.PI / 2,
            end: -Math.PI,
          },
        ];
        const arc = arcs.find(
          (a) =>
            a.from.every((n, i) => n === edge.from[i]) && a.to.every((n, i) => n === edge.to[i]),
        );
        if (arc)
          return { kind: 'arc', ...arc, from: edge.from, to: edge.to, center: arc.center as P };
        return edge;
      }),
      ...panelLighteningLoops(),
    ],
    circles,
    bends: [-1, 1].map((s) => ({
      from: [s * 18.5, root - allowance / 2] as P,
      to: [s * 29.3, root - allowance / 2] as P,
      direction: (fold === 1 ? 'up' : 'down') as 'up' | 'down',
      angle: 90,
      innerRadius: 1.5,
    })),
    secondaryFinishing: [
      'Tap the cover mounting pilot Ø2.5 through M3×0.5',
      `Tap ${standMountPattern.length} additional Ø2.5 stand pilots through M3×0.5; no countersinks`,
      'Plain Ø10.02 through bearing holes; no bearing recesses',
      `DIN7991 motor countersinks only from N=${motorSide === 1 ? 18.5 : 15.5}`,
      'Bearing and motor holes finish-sized after welding',
      'Keep the rounded relief contours and the specified material lands around functional interfaces',
    ],
    clampPositions: sheetPanelClampPositions(),
    standEars: sheetPanel.standEars,
    lightening: panelLighteningValues(),
    endTongueSpan: sheetPanel.endTongueSpan,
  };
}
