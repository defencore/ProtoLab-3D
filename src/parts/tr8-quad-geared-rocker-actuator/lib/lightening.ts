import type { Parameters } from '../../../core/types';
import { box, cylinder, union, type Shape } from '../../../core/assembly/boundary/shapes';
import type { FlatEdge, FlatPanelPattern, FlatPoint } from './sheet-fabrication';
import { fixed as f, enclosureDiameter, endDiscWireCenters } from './layout';

export interface ReliefCircle {
  id: string;
  center: FlatPoint;
  radius: number;
}
export interface ReliefSlot {
  id: string;
  t: number;
  from: number;
  to: number;
  radius: number;
}
/** Clearance to functional bores, finished seats, taps, bend tangencies and cut edges. */
export const lighteningLigamentTarget = 3;
export const panelLighteningCircles: ReliefCircle[] = [
  { id: 'left-middle', center: [-24.5, 25], radius: 3 },
  { id: 'right-middle', center: [14.1, 31.65], radius: 3 },
  { id: 'right-upper', center: [14.1, 52], radius: 4 },
  { id: 'center-web', center: [0, 21.25], radius: 3 },
];
export const panelLighteningSlots: ReliefSlot[] = [
  { id: 'left-lower', t: -24, from: 11.5, to: 14.5, radius: 3.25 },
  { id: 'right-lower', t: 24, from: 11.5, to: 14.5, radius: 3.25 },
  { id: 'right-side', t: 24, from: 27.5, to: 32.5, radius: 3.5 },
];
export function panelLighteningCuts(): Shape[] {
  return [
    ...panelLighteningCircles.map(({ center: [t, z], radius }) =>
      cylinder(radius, f.panelThickness + 0.2, [15.4, t, z], 'x'),
    ),
    ...panelLighteningSlots.map(({ t, from, to, radius }) =>
      union(
        cylinder(radius, f.panelThickness + 0.2, [15.4, t, from], 'x'),
        cylinder(radius, f.panelThickness + 0.2, [15.4, t, to], 'x'),
        box([f.panelThickness + 0.2, 2 * radius, to - from], [15.4, t - radius, from]),
      ),
    ),
  ];
}
/** Exact capsule contour, used for panel reliefs and the end-disc welding slots. */
export function verticalCapsuleLoop(
  t: number,
  from: number,
  to: number,
  radius: number,
): FlatEdge[] {
  return [
    { kind: 'line', from: [t + radius, from], to: [t + radius, to] },
    {
      kind: 'arc',
      from: [t + radius, to],
      to: [t - radius, to],
      center: [t, to],
      radius,
      start: 0,
      end: Math.PI,
    },
    { kind: 'line', from: [t - radius, to], to: [t - radius, from] },
    {
      kind: 'arc',
      from: [t - radius, from],
      to: [t + radius, from],
      center: [t, from],
      radius,
      start: Math.PI,
      end: 2 * Math.PI,
    },
  ];
}
export function panelLighteningLoops(): FlatEdge[][] {
  return panelLighteningSlots.map(({ t, from, to, radius }) =>
    verticalCapsuleLoop(t, from, to, radius),
  );
}
const circleArea = ({ radius }: ReliefCircle) => Math.PI * radius ** 2;
const slotArea = ({ from, to, radius }: ReliefSlot) =>
  Math.PI * radius ** 2 + 2 * radius * (to - from);
export function panelLighteningValues() {
  const area =
    panelLighteningCircles.reduce((sum, c) => sum + circleArea(c), 0) +
    panelLighteningSlots.reduce((sum, s) => sum + slotArea(s), 0);
  return {
    circularHoles: panelLighteningCircles,
    slots: panelLighteningSlots,
    featuresPerPanel: panelLighteningCircles.length + panelLighteningSlots.length,
    minimumLigamentTarget: lighteningLigamentTarget,
    removedAreaPerPanel: area,
    nominalRemovedVolumePerPanel: area * f.panelThickness,
    quantity: 4,
  };
}
/** Peripheral windows retain the center, weld-slot ribs and an uncut outside rim. */
export function endDiscLighteningCircles(p: Parameters = {}): ReliefCircle[] {
  const growth = (enclosureDiameter(p) - 76) / 2;
  const x = 31 + 0.7 * growth,
    y = -4 - 0.1 * growth;
  const out: ReliefCircle[] = Array.from({ length: 4 }, (_, index) => {
    const a = (index * Math.PI) / 2;
    return {
      id: `peripheral-${index + 1}`,
      center: [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)],
      radius: 3.5 + 0.2 * growth,
    };
  });
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      out.push({
        id: `corner-${sx < 0 ? 'w' : 'e'}${sy < 0 ? 's' : 'n'}`,
        center: [sx * (25 + 0.6 * growth), sy * (19 + 0.8 * growth)],
        radius: 3 + 0.1 * growth,
      });
  return out;
}
export function endDiscLighteningValues(p: Parameters = {}) {
  const circles = endDiscLighteningCircles(p);
  const area = circles.reduce((sum, c) => sum + circleArea(c), 0);
  return {
    circularHoles: circles,
    featuresPerDisc: circles.length,
    minimumLigamentTarget: lighteningLigamentTarget,
    removedAreaPerDisc: area,
    nominalRemovedVolumePerDisc: area * f.endDiscThickness,
    quantity: 2,
  };
}
/** End-disc CUT geometry; the wire-port chamfer is a secondary finishing operation. */
export function endDiscFlatPattern(p: Parameters = {}): FlatPanelPattern {
  const halfCenters = (f.endSlotSpan - f.endSlotWidth) / 2;
  return {
    loops: [-17, 17].map((t) =>
      verticalCapsuleLoop(t, -halfCenters, halfCenters, f.endSlotWidth / 2),
    ),
    circles: [
      { center: [0, 0], radius: enclosureDiameter(p) / 2 },
      ...endDiscWireCenters().map((center) => ({ center, radius: f.endWireHoleDiameter / 2 })),
      ...endDiscLighteningCircles(p).map(({ center, radius }) => ({ center, radius })),
    ],
    bends: [],
  };
}
export function lighteningValues(p: Parameters = {}) {
  const panels = panelLighteningValues(),
    discs = endDiscLighteningValues(p);
  return {
    panels,
    discs,
    nominalReliefVolume:
      panels.quantity * panels.nominalRemovedVolumePerPanel +
      discs.quantity * discs.nominalRemovedVolumePerDisc,
    volumeScope:
      'Dedicated non-overlapping relief cutters through sheet stock; wire-port enlargement is separate.',
  };
}
