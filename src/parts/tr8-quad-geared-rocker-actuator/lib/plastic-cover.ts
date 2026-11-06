import { Euler, Matrix4, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import {
  fixed as f,
  enclosureDiameter,
  channelTransform,
  sourceTransform,
  panelTransform,
  standMountStations,
} from './layout';
import { cableRoutingCuts } from './cable-routing';

export interface CoverMountStation {
  id: string;
  coverIndex: number;
  panelIndex: number;
  localT: number;
  localZ: number;
  plateFace: Vec;
  axis: Vec;
  headFace: Vec;
  worldPosition: Vec;
  rotation: Vec;
  length: number;
  pilotDiameter: number;
  thread: 'M3×0.5';
}
const move = (child: Shape, translation: Vec = [0, 0, 0], rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
function placed(child: Shape, frame: Matrix4): Shape {
  const e = new Euler().setFromRotationMatrix(frame, 'ZYX');
  return move(
    child,
    new Vector3().setFromMatrixPosition(frame).toArray() as Vec,
    [e.x, e.y, e.z].map((a) => (Math.abs(a) < 1e-12 ? 0 : (a * 180) / Math.PI)) as Vec,
  );
}
const axial = (radius: number, from: number, to: number, y = 0, z = 0): Shape =>
  cylinder(radius, to - from, [from, y, z], 'x');

/** Dimensions depend only on the installed motor, never on current output angles. */
export function coverValues(p: Parameters = {}) {
  const large = String(p.motor ?? 'surpass-2838-3700kv').startsWith('surpass-2845-');
  const outerDiameter = enclosureDiameter(p),
    outerRadius = outerDiameter / 2;
  const top = f.panelHigh - f.endTongueLength - 0.2;
  const motorLength = large ? 47 : 40;
  return {
    material: 'PETG',
    color: 0x34383c,
    count: 4,
    sectionCount: 4,
    solidPocketed: true,
    outerDiameter,
    outerRadius,
    bottom: -top,
    top,
    height: 2 * top,
    endGap: 0.2,
    sectionAngle: 90,
    startAngle: -45,
    endAngle: 45,
    centralServiceSize: 37.6,
    clearance: 0.3,
    minimumWallThickness: 1.2,
    minimumClosedLandTarget: 1.2,
    controlledWindows: true,
    motorWindowHalfHeight: 7.5,
    gearWindows: !large,
    windowEdgeStockExcludedFromTarget: true,
    motorLength,
    uncutMotorPocketLand:
      outerRadius - Math.hypot(f.channelRadius + 14.3, motorLength - 15.5 + 0.3),
    seamGap: 0.2,
    seamOverlap: 0.4,
    seamReceiverClearance: 0.2,
    seamTongueThickness: 1.2,
    seamSlideAllowance: 0.6,
    seamOuterSkin: 1.3,
    labyrinthWaistRelief: [-7.6, 5.3] as [number, number],
    accessDiameter: 21,
    accessRadius: 10.5,
    headPocketRadius: 11,
    outputCollarStart: f.headEnd + 0.3,
    plateFaceN: 18.5,
    mountT: f.coverMountT,
    mountZ: f.coverMountZ,
    contactPadRadius: 3.0,
    screwBoreRadius: 1.7,
    toolWellRadius: 3.1,
    countersinkRadius: 3.05,
    countersinkDepth: 1.7,
    headPlane: 21.6,
    screwLength: 6,
    pilotDiameter: 2.5,
    thread: 'M3×0.5' as const,
    forkPocket: {
      radial: [5.1, 23.1] as [number, number],
      halfT: 12.776843721,
      bottom: -28.241024094,
      top: -7.754216,
    },
  };
}
/** A/C mounting stations belong to +Y/−Y covers; B/D to +X/−X covers. */
export function coverMountStations(p: Parameters = {}): CoverMountStation[] {
  const v = coverValues(p),
    t = v.mountT,
    z = v.mountZ;
  const rows: {
    panelIndex: number;
    coverIndex: number;
    plateFace: Vec;
    axis: Vec;
    rotation: Vec;
    localT: number;
  }[] = [
    {
      panelIndex: 0,
      coverIndex: 1,
      plateFace: [18.5, t, z],
      axis: [1, 0, 0],
      rotation: [0, 90, 0],
      localT: t,
    },
    {
      panelIndex: 1,
      coverIndex: 0,
      plateFace: [t, 18.5, -z],
      axis: [0, 1, 0],
      rotation: [-90, 0, 0],
      localT: -t,
    },
    {
      panelIndex: 2,
      coverIndex: 3,
      plateFace: [-18.5, -t, z],
      axis: [-1, 0, 0],
      rotation: [0, -90, 0],
      localT: t,
    },
    {
      panelIndex: 3,
      coverIndex: 2,
      plateFace: [-t, -18.5, -z],
      axis: [0, -1, 0],
      rotation: [90, 0, 0],
      localT: -t,
    },
  ];
  return rows.map(({ panelIndex, coverIndex, plateFace, axis, rotation, localT }) => {
    const headFace = plateFace.map((n, i) => n + axis[i] * (v.headPlane - v.plateFaceN)) as Vec;
    return {
      id: `cover-mount-${'abcd'[panelIndex]}`,
      coverIndex,
      panelIndex,
      localT,
      localZ: z,
      plateFace,
      axis,
      headFace,
      worldPosition: headFace.map((n, i) => n - (axis[i] * v.screwLength) / 2) as Vec,
      rotation: (() => {
        const frame = new Matrix4()
          .makeRotationFromEuler(
            new Euler(...(rotation.map((a) => (a * Math.PI) / 180) as Vec), 'ZYX'),
          )
          .multiply(new Matrix4().makeRotationZ(([144, 270, 324, 90][panelIndex] * Math.PI) / 180));
        const angles = new Euler().setFromRotationMatrix(frame, 'ZYX');
        return [angles.x, angles.y, angles.z].map((a) =>
          Math.abs(a) < 1e-12 ? 0 : Number(((a * 180) / Math.PI).toFixed(12)),
        ) as Vec;
      })(),
      length: v.screwLength,
      pilotDiameter: v.pilotDiameter,
      thread: v.thread,
    };
  });
}
export function coverPanelPilotCut(panelIndex: number): Shape {
  return cylinder(
    1.25,
    3.2,
    [15.4, panelIndex % 2 ? -f.coverMountT : f.coverMountT, f.coverMountZ],
    'x',
  );
}
function sourcePlaced(child: Shape, index: number): Shape {
  return placed(child, channelTransform(index).multiply(sourceTransform(index % 2 === 0)));
}
/** Local envelopes include full motor/gear rotation and every nut/fork position. */
export function coverMechanicalPockets(p: Parameters = {}): Shape[] {
  const v = coverValues(p),
    c = v.clearance,
    out: Shape[] = [];
  // Continuous central service channel and the four actual wall locations.
  out.push(box([37.6, 37.6, v.height + 2], [-18.8, -18.8, v.bottom - 1]));
  for (let i = 0; i < 4; i++) {
    out.push(
      placed(
        box(
          [3.6, 2 * (f.panelHalfWidth + c), f.panelHigh + 9.6],
          [15.2, -f.panelHalfWidth - c, -9.3],
        ),
        panelTransform(i),
      ),
    );
    const source: Shape[] = [
      axial(14 + c, -c, v.motorLength + c, f.motorSpacing),
      axial(1.5875 + c, -15 - c, c, f.motorSpacing),
      axial(4 + c, -16 - c, 36 + f.bearingFlangeWidth + c),
      axial(5.6 + c, -3 - f.bearingFlangeWidth - c, -f.bearingFlangeWidth + c),
      axial(5.6 + c, 31 + f.bearingFlangeWidth - c, 34 + f.bearingFlangeWidth + c),
      axial(3.65 + c, -4.2 - f.bearingFlangeWidth - c, -3.6 + c),
      axial(3.65 + c, 34.6 - c, 35.2 + c),
      box([31 + 2 * c, 12 + 2 * c, 18.4 + 2 * c], [-c, -6 - c, -9.2 - c]),
    ];
    for (const y of [0, f.motorSpacing]) {
      source.push(
        axial((f.gearTeeth + 2) / 2 + c, -11 + f.gearFaceShift - c, -6 + f.gearFaceShift + c, y),
      );
      source.push(axial(6 + c, -15 - c, -11 + f.gearFaceShift + c, y));
    }
    for (const z of [-8, 8]) source.push(axial(3 + c, -3 - c, 2 + c, f.motorSpacing, z));
    out.push(...source.map((s) => sourcePlaced(s, i)));
    // Exact continuous angular extrema, not just the neutral/end snapshots.
    const q = v.forkPocket;
    out.push(
      placed(
        box(
          [q.radial[1] - q.radial[0], 2 * q.halfT, q.top - q.bottom],
          [q.radial[0], -q.halfT, q.bottom],
        ),
        channelTransform(i),
      ),
    );
    // Keep the output head recess behind the narrower integral acoustic collar.
    out.push(placed(axial(v.headPocketRadius, 18.5, v.outputCollarStart), channelTransform(i)));
    out.push(
      placed(
        axial(v.accessRadius, v.outputCollarStart - 0.01, v.outerRadius + 1),
        channelTransform(i),
      ),
    );
  }
  // Tight radial cap avoids cutting open the cylinder at the waist corners.
  const waistLimit = cylinder(36.1, 13, [0, 0, -7.6]);
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      out.push({
        kind: 'intersect',
        children: [
          box([11.4, 11.4, 13], [x < 0 ? -29.6 : 18.2, y < 0 ? -29.6 : 18.2, -7.6]),
          waistLimit,
        ],
      });
  return out;
}
/** Intentional through-windows remove motor/gear films without moving hardware. */
export function coverWindowShapes(p: Parameters = {}): Shape[] {
  const v = coverValues(p),
    out: Shape[] = [];
  for (let i = 0; i < 4; i++) {
    const outward = i % 2 === 0 ? -1 : 1;
    const cut = (from: number, to: number, y: number, halfHeight: number, zIn: number) =>
      sourcePlaced(
        box(
          [to - from, 2 * halfHeight, v.outerRadius + 10 - zIn],
          [from, y - halfHeight, outward > 0 ? zIn : -v.outerRadius - 10],
        ),
        i,
      );
    out.push(cut(v.motorLength - 8, v.motorLength + 2, f.motorSpacing, v.motorWindowHalfHeight, 8));
    if (v.gearWindows)
      for (const y of [0, f.motorSpacing]) {
        out.push(cut(-16.5, -11 + f.gearFaceShift + 1.5, y, 4.1, 3.5));
        out.push(cut(-11 + f.gearFaceShift - 1.5, -6 + f.gearFaceShift + 1.5, y, 3, 8));
      }
  }
  return out;
}
/** Open the radial withdrawal path behind the gear pair facing this section. */
export function coverRemovalPockets(p: Parameters = {}, index = 0): Shape[] {
  const c = coverValues(p).clearance,
    sourceIndex = (index + 1) % 4,
    out: Shape[] = [];
  // Source X = −3 maps to radial 18.5, overlapping the service opening by 0.3.
  // These extensions remove only the internal back lips, preserving the windows.
  for (const y of [0, f.motorSpacing]) {
    out.push(
      sourcePlaced(axial((f.gearTeeth + 2) / 2 + c, -11 + f.gearFaceShift - c, -3, y), sourceIndex),
      sourcePlaced(axial(6 + c, -15 - c, -3, y), sourceIndex),
    );
  }
  return out;
}
/** Do not leave short tongue fragments beside intentional windows or tool wells. */
export function coverLabyrinthBands(p: Parameters = {}): [number, number][] {
  const v = coverValues(p),
    h = f.lever + f.motorSpacing;
  const excluded: [number, number][] = [v.labyrinthWaistRelief];
  for (const sign of [-1, 1]) {
    excluded.push([sign * h - 7.8, sign * h + 7.8]);
    excluded.push([sign * v.mountZ - 3.4, sign * v.mountZ + 3.4]);
    if (v.gearWindows) excluded.push([sign * f.lever - 4.4, sign * f.lever + 4.4]);
  }
  excluded.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [lo, hi] of excluded) {
    const last = merged.at(-1);
    if (last && lo - last[1] < 1.2) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  const bands: [number, number][] = [];
  let lo = v.bottom;
  for (const cut of merged) {
    if (cut[0] - lo >= 1.2) bands.push([lo, Math.min(cut[0], v.top)]);
    lo = Math.max(lo, cut[1]);
  }
  if (v.top - lo >= 1.2) bands.push([lo, v.top]);
  return bands.filter(([a, b]) => b > a && a < v.top && b > v.bottom);
}
function sector(index: number, p: Parameters): Shape {
  const v = coverValues(p),
    size = 2 * v.outerRadius + 2;
  const half = (angle: number) =>
    move(
      box([size, size, v.height + 0.2], [v.seamGap / 2, -size / 2, v.bottom - 0.1]),
      [0, 0, 0],
      [0, 0, angle],
    );
  return { kind: 'intersect', children: [half(index * 90 - 45), half(index * 90 + 45)] };
}
function seamTongues(index: number, p: Parameters): Shape[] {
  const v = coverValues(p),
    r = v.outerRadius - 3.1,
    parts: Shape[] = [];
  // The central interruption avoids the waist clamps and any fragile sliver.
  const bands = coverLabyrinthBands(p);
  for (const [lo, hi] of bands)
    parts.push(
      move(
        box([1.2, v.seamGap + v.seamOverlap + 0.3, hi - lo], [r, -v.seamGap / 2 - 0.3, lo]),
        [0, 0, 0],
        [0, 0, index * 90 + 45],
      ),
    );
  return parts;
}
function seamReceiver(index: number, p: Parameters): Shape[] {
  const v = coverValues(p),
    parts: Shape[] = [];
  for (const [lo, hi] of coverLabyrinthBands(p))
    parts.push(
      move(
        box(
          [2.4, v.seamOverlap + v.seamReceiverClearance + 0.05, hi - lo + 0.2],
          [v.outerRadius - 3.7, v.seamGap / 2 - 0.05, lo - 0.1],
        ),
        [0, 0, 0],
        [0, 0, index * 90 - 45],
      ),
    );
  return parts;
}
function mountingCuts(p: Parameters, station: CoverMountStation): Shape[] {
  const v = coverValues(p);
  const tool = (r: number, a: number, b: number) =>
    move(cylinder(r, b - a, [0, 0, a - v.plateFaceN]), station.plateFace, station.rotation);
  const seat: Shape = {
    kind: 'revolve',
    profile: [
      [0, -1.8],
      [1.45, -1.8],
      [3.05, -0.2],
      [3.05, 0.1],
      [0, 0.1],
    ],
  };
  return [
    tool(v.screwBoreRadius, 18.4, v.outerRadius + 1),
    tool(v.toolWellRadius, v.headPlane, v.outerRadius + 1),
    move(seat, station.headFace, station.rotation),
  ];
}
/** M3 shank passages to the exterior; stand screw heads remain outside the PETG. */
export function coverStandAccessCuts(p: Parameters = {}): Shape[] {
  const v = coverValues(p);
  return standMountStations().map((station) => {
    const coordinate = station.axis.findIndex((n) => Math.abs(n) > 0.5);
    const axis = (['x', 'y', 'z'] as const)[coordinate];
    const setback = station.threadLength + 0.6;
    const length = v.outerRadius + 1 - Math.abs(station.plateFace[coordinate]) + setback;
    const origin = station.plateFace.map((n, i) => n - station.axis[i] * setback) as Vec;
    if (station.axis[coordinate] < 0)
      for (let i = 0; i < 3; i++) origin[i] += station.axis[i] * length;
    return cylinder(station.passageDiameter / 2, length, origin, axis);
  });
}
/** Four global quarter fillers; opposite pairs share a physical printed recipe. */
export function coverSectionShape(p: Parameters = {}, index = 0): Shape {
  if (!Number.isInteger(index) || index < 0 || index > 3)
    throw new Error('Cover section index must be 0…3.');
  if (index >= 2) return move(coverSectionShape(p, index - 2), [0, 0, 0], [0, 0, 180]);
  const v = coverValues(p),
    pockets = [
      ...coverMechanicalPockets(p),
      ...coverWindowShapes(p),
      ...coverRemovalPockets(p, index),
    ];
  const base = subtract(cylinder(v.outerRadius, v.height, [0, 0, v.bottom]), ...pockets);
  const section: Shape = { kind: 'intersect', children: [base, sector(index, p)] };
  const station = coverMountStations(p).find((s) => s.coverIndex === index)!;
  // Restore the intentional annular plate contact after its general clearance pocket.
  const contact = move(
    cylinder(v.contactPadRadius, 1, [0, 0, 0]),
    station.plateFace,
    station.rotation,
  );
  const tongues = seamTongues(index, p).map((t) => subtract(t, ...pockets));
  const formed: Shape = {
    kind: 'subtract',
    nativeRefine: true,
    children: [
      union(section, contact, ...tongues),
      ...seamReceiver(index, p),
      ...coverMountStations(p).flatMap((s) => mountingCuts(p, s)),
      ...coverStandAccessCuts(p),
    ],
  };
  return subtract(formed, ...cableRoutingCuts(p));
}
