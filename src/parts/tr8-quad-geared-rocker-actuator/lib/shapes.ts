import {
  box,
  cylinder,
  roundedRect,
  prism,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { nutShape as sourceNutShape } from '../../tr8-geared-rocker-actuator/part';
import { fixed as f, enclosureDiameter, endDiscWireCenters } from './layout';
import type { Parameters } from '../../../core/types';
import { sheetPanelShape } from './sheet-panel';
import { endDiscLighteningCircles } from './lightening';
export const move = (
  child: Shape,
  translation: Vec = [0, 0, 0],
  rotation: Vec = [0, 0, 0],
): Shape => ({ kind: 'transform', child, translation, rotation });
const axial = (r: number, lo: number, hi: number) => cylinder(r, hi - lo, [lo, 0, 0], 'x');
const groove = (g: { center: number; width: number; rootDiameter: number }): Shape =>
  move(
    subtract(
      cylinder(3.1, g.width, [0, 0, g.center - g.width / 2]),
      cylinder(g.rootDiameter / 2, g.width + 0.2, [0, 0, g.center - g.width / 2 - 0.1]),
    ),
    [0, 0, 0],
    [0, 90, 0],
  );
/** Retain the public source's exact thread and relieved end faces, with a slimmer radial body. */
export function nutShape(): Shape {
  return union(
    { kind: 'intersect', children: [sourceNutShape(), box([16.2, 12.2, 12], [-8.1, -6.1, -6])] },
    cylinder(2, 3.25, [0, 0, 5.95]),
    cylinder(2, 3.25, [0, 0, -9.2]),
  );
}
export function cheekOutline(): [number, number][] {
  const half = f.forkArmHalfWidth,
    slot = f.slotWidth / 2,
    mouth = f.slotMouth,
    rear = f.forkCrossWebStart,
    rearRadius = 1,
    rearTangent = rear + rearRadius;
  const arc = (
    x: number,
    y: number,
    r: number,
    a: number,
    b: number,
    n: number,
  ): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => [
      x + r * Math.cos(a + ((b - a) * i) / n),
      y + r * Math.sin(a + ((b - a) * i) / n),
    ]);
  const angle = Math.acos(slot / half),
    top = mouth + Math.sqrt(half * half - slot * slot);
  return [
    [half, rearTangent],
    [half, mouth],
    ...arc(0, mouth, half, 0, angle, 12).slice(1),
    [slot, f.slotRoot],
    ...arc(0, f.slotRoot, slot, 0, -Math.PI, 24).slice(1),
    [-slot, top],
    ...arc(0, mouth, half, Math.PI - angle, Math.PI, 12).slice(1),
    [-half, rearTangent],
    ...arc(-half + rearRadius, rearTangent, rearRadius, Math.PI, Math.PI * 1.5, 6).slice(1),
    [half - rearRadius, rear],
    ...arc(half - rearRadius, rearTangent, rearRadius, -Math.PI / 2, 0, 6).slice(1, -1),
  ];
}
/** Full-thickness eye and straight tapered arm within the gap between the cheeks. */
export function forkShape(): Shape {
  const hub = f.forkHubR - f.channelRadius;
  const inner = -6.1 - f.forkThickness,
    outer = 6.1;
  const webLength = f.forkWebEnd - f.forkCrossWebStart;
  const eyeRadius = f.forkHubDiameter / 2;
  const tangentAngle =
    Math.atan2(f.forkCrossWebStart, f.forkWebHalfWidth) -
    Math.acos(eyeRadius / Math.hypot(f.forkCrossWebStart, f.forkWebHalfWidth));
  const tangentX = eyeRadius * Math.cos(tangentAngle),
    tangentY = eyeRadius * Math.sin(tangentAngle);
  const arm: [number, number][] = [
    [-tangentX, tangentY],
    [-f.forkWebHalfWidth, f.forkCrossWebStart],
    [-f.forkWebHalfWidth, f.forkWebEnd],
    [f.forkWebHalfWidth, f.forkWebEnd],
    [f.forkWebHalfWidth, f.forkCrossWebStart],
    [tangentX, tangentY],
  ];
  return move(
    subtract(
      union(
        cylinder(eyeRadius, f.forkHubLength, [0, 0, hub - f.forkHubLength / 2]),
        prism(arm, f.forkArmThickness, hub - f.forkArmThickness / 2),
        // Keep every successive union connected: the central arm meets the web,
        // and only that web joins the two cheeks.
        move(roundedRect(2 * f.forkWebHalfWidth, webLength, 1, inner, 12.2 + 2 * f.forkThickness), [
          0,
          (f.forkCrossWebStart + f.forkWebEnd) / 2,
          0,
        ]),
        prism(cheekOutline(), f.forkThickness, inner),
        prism(cheekOutline(), f.forkThickness, outer),
      ),
      cylinder(f.forkBore / 2, 16.4, [0, 0, -8.2]),
      cylinder(1, f.forkWebEnd + 6.2, [0, -6.1, hub], 'y'),
    ),
    [f.channelRadius, 0, 0],
    [-90, 0, -90],
  );
}
export const headHoleCenters = (): [number, number][] => [
  [7, 0],
  [-7, 0],
  [0, 7],
  [0, -7],
];
export function shaftShape(): Shape {
  return subtract(
    union(
      axial(1, f.shaftTip, f.shaftStep + 0.05),
      axial(3, f.shaftStep, f.outerBearingEnd + 0.05),
      axial(3.4, f.outerBearingEnd, f.neckEnd + 0.05),
      axial(f.headBackDiameter / 2, f.neckEnd, f.headReliefEnd + 0.05),
      axial(f.headDiameter / 2, f.headReliefEnd, f.headEnd),
    ),
    groove(f.innerGroove),
    cylinder(1, 6.2, [f.forkHubR, 0, -3.1], 'z'),
    ...headHoleCenters().map(([y, z]): Shape => ({
      kind: 'cylinder',
      radius: 1.5,
      height: 3.6,
      origin: [f.headThreadStart, y, z],
      axis: 'x',
      thread: { pitch: 0.5, internal: true, radialClearance: 0.04 },
    })),
  );
}
/** One independent central bearing connector captured by the four turned shaft tips. */
export function centralCrossShape(): Shape {
  const blank: Shape = {
    kind: 'intersect',
    children: [cylinder(8, 8, [0, 0, -4]), box([13, 13, 8], [-6.5, -6.5, -4])],
  };
  const radialCuts = [0, 1, 2, 3].flatMap((k) =>
    [axial(1.7, 0, 3.5), axial(2.5, 3.5, 6), axial(3.05, 6, 6.6)].map((c) =>
      move(c, [0, 0, 0], [0, 0, k * 90]),
    ),
  );
  return subtract(blank, cylinder(3.95, 8.2, [0, 0, -4.1]), ...radialCuts);
}
/** One repeated laser-cut sheet panel with two real-radius bends. */
export function casePanelShape(fold: 1 | -1 = 1, motorSide: 1 | -1 = fold): Shape {
  return sheetPanelShape(fold, motorSide);
}

/** Capsule in the XY plane, with its long direction parallel to Y. */
export function capsule(x: number, span: number, width: number, height: number, z: number): Shape {
  const radius = width / 2,
    station = (span - width) / 2;
  return union(
    box([width, span - width, height], [x - radius, -station, z]),
    cylinder(radius, height, [x, -station, z]),
    cylinder(radius, height, [x, station, z]),
  );
}
/** One repeated end disc; the lower occurrence is flipped and indexed by90 degrees. */
export function endDiscShape(p: Parameters = {}): Shape {
  const wirePorts = endDiscWireCenters().flatMap(([x, y]) => {
    const bevel: Shape = {
      kind: 'revolve',
      profile: [
        [0, -0.1],
        [f.endWireHoleDiameter / 2 + 0.6, -0.1],
        [f.endWireHoleDiameter / 2, 0.5],
        [0, 0.5],
      ],
    };
    return [
      cylinder(f.endWireHoleDiameter / 2, f.endDiscThickness + 0.2, [x, y, -0.1]),
      move(bevel, [x, y, 0]),
      move(bevel, [x, y, f.endDiscThickness], [180, 0, 0]),
    ];
  });
  return subtract(
    cylinder(enclosureDiameter(p) / 2, f.endDiscThickness, [0, 0, 0]),
    ...[-17, 17].map((n) =>
      capsule(n, f.endSlotSpan, f.endSlotWidth, f.endDiscThickness + 0.2, -0.1),
    ),
    ...wirePorts,
    ...endDiscLighteningCircles(p).map(({ center: [x, y], radius }) =>
      cylinder(radius, f.endDiscThickness + 0.2, [x, y, -0.1]),
    ),
  );
}
