import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { Euler, Vector3 } from 'three';
import {
  box,
  cylinder,
  prism,
  roundedRect,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { screw, hexNut } from './hardware';
import type { DetailSpec } from './types';
import { caseElectronicsLayout, type ElectronicsPose } from './case-electronics-layout';
import { caseBrassLayout } from './case-brass-supports';
import { caseLowerFloorFootprint } from './case-lower-split';
import { caseModularElectronics, caseElectronicsGridNodes, caseElectronicsGridCuts } from './case-electronics-grid';
export { caseElectronicsLayout } from './case-electronics-layout';

type Point = readonly [number, number];
type Bounds = { min: Vec; max: Vec };
type Tie = {
  id: string;
  keeperId: string;
  hostIds: string[];
  frame: ElectronicsPose;
  segments: Bounds[];
  axis: 'x' | 'y';
  centre: number;
  halfSpan: number;
  bottom: number;
  top: number;
  floorLoop: boolean;
  carrierId?: string;
};
type Seat = {
  id: string;
  hostId: string;
  componentId: string;
  contactBox: Bounds;
  normal: Vec;
  plinthBox: Bounds;
  basis: string;
  supportRootZ: number;
  smallContactException?: string;
};
const canonical = ([x, y, z]: readonly number[]): Vec => [-y, x, z];
const operator = (child: Shape): Shape => ({
  kind: 'transform',
  child,
  translation: [0, 0, 0],
  rotation: [0, 0, 90],
});
const placed = (pose: ElectronicsPose, child: Shape): Shape => ({
  kind: 'transform',
  child,
  translation: pose.at,
  rotation: pose.rotation,
});
const rawBox = ({ min, max }: Bounds): Shape => box(max.map((n, i) => n - min[i]) as Vec, min);
const bounds = (min: Vec, max: Vec): Bounds => ({ min, max });
const hex = (af: number, h: number, [x, y, z]: Vec): Shape => ({
  kind: 'transform',
  child: prism(
    Array.from({ length: 6 }, (_, i): [number, number] => {
      const a = ((i + 0.5) * Math.PI) / 3,
        r = af / Math.sqrt(3);
      return [r * Math.cos(a), r * Math.sin(a)];
    }),
    h,
    z,
  ),
  translation: [x, y, 0],
  rotation: [0, 0, 0],
});
const print = (id: string, label: string, shape: Shape, requirements: string[]): DetailSpec => ({
  id,
  label,
  shape: operator(shape),
  color: 0x718493,
  material: 'PETG; qualify delivered board lands and temperature',
  blank: 'Low registered insulating board retainer',
  processes: ['printing'],
  requirements,
  explode: [0, 0, -85],
});
const point = (pose: ElectronicsPose, v: Vec): Vec =>
  new Vector3(...v)
    .applyEuler(new Euler(...(pose.rotation.map((a) => (a * Math.PI) / 180) as Vec), 'ZYX'))
    .add(new Vector3(...pose.at))
    .toArray() as Vec;
const worldBox = (pose: ElectronicsPose, b: Bounds): Bounds => {
  const corners = [b.min[0], b.max[0]].flatMap((x) =>
    [b.min[1], b.max[1]].flatMap((y) => [b.min[2], b.max[2]].map((z) => point(pose, [x, y, z]))),
  );
  return {
    min: [0, 1, 2].map((i) => Math.min(...corners.map((v) => v[i]))) as Vec,
    max: [0, 1, 2].map((i) => Math.max(...corners.map((v) => v[i]))) as Vec,
  };
};
const direction = (pose: ElectronicsPose, v: Vec): Vec =>
  new Vector3(...v)
    .applyEuler(new Euler(...(pose.rotation.map((a) => (a * Math.PI) / 180) as Vec), 'ZYX'))
    .toArray() as Vec;
const adapterPlane = (p: Parameters) => caseModularElectronics(p).grid.nodeTopZ;
const adapterFor = (p: Parameters, hostId: string) => {
  const a = caseModularElectronics(p).adapters.find((a) => a.boardId === hostId);
  if (!a) throw new Error(`No independent adapter for ${hostId}`);
  return a;
};
const hatAxes = (p: Parameters): Point[] => {
  const pose = caseElectronicsLayout(p).hat;
  return [-24.5, 24.5].flatMap((x) =>
    [-29, 29].map((y) => point(pose, [x, y, 0]).slice(0, 2) as [number, number]),
  );
};
export function caseElectronicsPanelCuts(_p: Parameters): Shape[] {
  return [];
}
export function caseElectronicsGasketCuts(_p: Parameters): Shape[] {
  return [];
}

/** Every loop includes both vertical legs; dimensions describe a maximum 2.5 × 1 mm tie. */
function loop(
  id: string,
  keeperId: string,
  hostIds: string[],
  frame: ElectronicsPose,
  axis: 'x' | 'y',
  centre: number,
  halfSpan: number,
  bottom: number,
  top: number,
  floorLoop = true,
): Tie {
  const w = 2.5,
    t = 1;
  const b = (u0: number, u1: number, z0: number, z1: number): Bounds =>
    axis === 'x'
      ? bounds([u0, centre - w / 2, z0], [u1, centre + w / 2, z1])
      : bounds([centre - w / 2, u0, z0], [centre + w / 2, u1, z1]);
  return {
    id,
    keeperId,
    hostIds,
    frame,
    axis,
    centre,
    halfSpan,
    bottom,
    top,
    floorLoop,
    segments: [
      b(-halfSpan - t / 2, halfSpan + t / 2, bottom, bottom + t),
      b(-halfSpan - t / 2, halfSpan + t / 2, top, top + t),
      ...[-1, 1].map((s) => b(s * halfSpan - t / 2, s * halfSpan + t / 2, bottom + t, top)),
    ],
  };
}
function ties(p: Parameters): Tie[] {
  const m = caseElectronicsLayout(p),
    a = m.adc,
    f = m.filters[1];
  const horizontal = (
    id: string,
    keeper: string,
    host: string,
    pose: ElectronicsPose,
    axis: 'x' | 'y',
    c: number,
    h: number,
    top: number,
  ) => loop(id, keeper, [host], pose, axis, c, h, adapterPlane(p) - pose.at[2] + 0.1, top);
  return [
    horizontal(
      'heltec',
      'case-electronics-heltec-keeper',
      'case-heltec-v4',
      m.heltec,
      'x',
      12.75,
      13.2,
      8.4,
    ),
    ...m.bucks.flatMap((pose, i) =>
      (i === 0 ? [-16.3, -10.9] : [-15, 15]).map((x, j) =>
        loop(
          `buck-${i + 1}-${j + 1}`,
          `case-electronics-buck-${i + 1}-keeper`,
          [`case-buck-${i + 1}`],
          pose,
          'y',
          x,
          11.8,
          -4.5,
          i === 0 ? 8.4 : 7.6,
          false,
        ),
      ),
    ),
    ...[-3, 3].map((y, i) =>
      horizontal(
        `adc-${i + 1}`,
        'case-electronics-adc-keeper',
        'case-adc-cjmcu1220',
        a,
        'x',
        y,
        16.8,
        6,
      ),
    ),
    horizontal(
      'filter-1',
      'case-electronics-filter-1-keeper',
      'case-lc-filter-1',
      m.filters[0],
      'y',
      0,
      7.8,
      6,
    ),
    horizontal('filter-2', 'case-electronics-filter-2-keeper', 'case-lc-filter-2', f, 'y', 0.3, 7.8, 6),
    ...[m.quietPodMin[1] - 2, m.quietPodMax[1] + 2].map((y, i) =>
      loop(
        `hood-${i + 1}`,
        'case-electronics-analogue-hood',
        [],
        { at: [174, y, 0], rotation: [0, 0, 0] },
        'x',
        0,
        5.5,
        m.floorBottom + 0.1,
        m.floorTop + 2,
      ),
    ),
  ].map((t) => ({ ...t, ...(t.hostIds[0] ? { carrierId: adapterFor(p, t.hostIds[0]).id } : {}) }));
}

/** Alternate BEC routes add ports to the existing saddles, without new floor perforations. */
function optionalTieLanes(p: Parameters) {
  const m = caseElectronicsLayout(p);
  return m.bucks.flatMap((pose, index) =>
    m.alternateBuckTieCentres[index].map((x, lane) => {
      const id = `buck-${index + 1}-alternate-${lane + 1}`,
        route = loop(
          id,
          '',
          [`case-buck-${index + 1}`],
          pose,
          'y',
          x,
          11.8,
          -4.5,
          index === 0 ? 8.4 : 7.6,
          false,
        ),
        slotBox = bounds([x - 1.6, 11.1, -5], [x + 1.6, 12.5, 10]),
        existing = index === 0 ? [-16.3, -10.9] : [-15, 15],
        neighbours = [...existing, ...m.alternateBuckTieCentres[index]].filter((v) => v !== x);
      return {
        id,
        componentId: adapterFor(p, `case-buck-${index + 1}`).id,
        hostId: `case-buck-${index + 1}`,
        frame: pose,
        slotBox,
        slotProbe: worldBox(pose, bounds([x - 1.5, 11.2, -3.4], [x + 1.5, 12.4, 1.7])),
        segments: route.segments,
        minimumAdjacentSlotLandMm: Math.min(...neighbours.map((v) => Math.abs(v - x) - 3.2)),
        minimumFloorRootLandMm: 1.5,
        edgeLandProbes: [
          bounds([x - 3.6, 11.3, -2], [x - 2.1, 12.3, -0.6]),
          bounds([x + 2.1, 11.3, -2], [x + 3.6, 12.3, -0.6]),
          bounds([x - 1.4, 12.7, -2], [x + 1.4, 13.2, -0.6]),
        ].map((b) => worldBox(pose, b)),
        basis:
          'Optional complete 2.5 × 1 mm maximum tie route around the existing vertical power-module envelope. Release the fitted tie before choosing an alternate lane. Future PCB/component/terminal dimensions and a suitable pressure-spreading keeper require a delivered-module fit check; these lanes do not assert universal PCB compatibility.',
      };
    }),
  );
}
function seats(p: Parameters): Seat[] {
  const m = caseElectronicsLayout(p),
    out: Seat[] = [];
  const add = (
    id: string,
    hostId: string,
    pose: ElectronicsPose,
    c: Bounds,
    plinth: Bounds,
    n: Vec,
    basis: string,
    exception?: string,
  ) =>
    out.push({
      id,
      hostId,
      componentId: adapterFor(p, hostId).id,
      supportRootZ: adapterPlane(p),
      contactBox: worldBox(pose, c),
      normal: direction(pose, n),
      plinthBox: { ...worldBox(pose, plinth), min: [worldBox(pose, plinth).min[0], worldBox(pose, plinth).min[1], adapterPlane(p)] as Vec },
      basis,
      ...(exception ? { smallContactException: exception } : {}),
    });
  for (const [i, [x, y]] of hatAxes(p).entries())
    out.push({
      id: `hat-${i + 1}`,
      hostId: 'case-servo-driver-hat',
      componentId: adapterFor(p, 'case-servo-driver-hat').id,
      supportRootZ: adapterPlane(p),
      contactBox: bounds([x - 3, y - 3, m.hat.at[2] - 1.61], [x + 3, y + 3, m.hat.at[2] - 1.59]),
      normal: [0, 0, 1],
      plinthBox: bounds([x - 4.8, y - 4.8, adapterPlane(p)], [x + 4.8, y + 4.8, m.hat.at[2] - 1.6]),
      basis:
        'Original Ø3 PCB corner hole and source-cleared Ø6 bearing annulus; Ø9.6 base tapers to Ø6 before the lowest neighbouring header.',
    });
  for (const s of [-1, 1])
    add(
      `heltec-front-${s}`,
      'case-heltec-v4',
      m.heltec,
      bounds([s * 9.9 - 0.5, 13, 3.59], [s * 9.9 + 0.5, 17, 3.61]),
      bounds([s * 9.9 - 2.5, 11, adapterPlane(p) - m.heltec.at[2]], [s * 9.9 + 2.5, 19, 3.6]),
      [0, 0, 1],
      'Native source-clear bare PCB lands; broad plinth ends0.3mm belowPCB, with only a short contact cap.',
      'Only the final0.3mm contact cap is1×4mm; it is fully backed by a5×8mm plinth, not a tall narrow foot.',
    );
  for (const x of [-3, 3])
    add(
      `heltec-rear-${x}`,
      'case-heltec-v4',
      m.heltec,
      bounds([x - 1.2, -21.7, 3.59], [x + 1.2, -19.3, 3.61]),
      bounds([x - 2.5, -23, adapterPlane(p) - m.heltec.at[2]], [x + 2.5, -18, 3.6]),
      [0, 0, 1],
      'Source-cleared PCB underside between rear bores, GNSS connector and auxiliary pads.',
      'Ø2.4 cap is only0.3mm tall, on a5×5mm plinth.',
    );
  for (const s of [-1, 1])
    add(
      `adc-edge-${s}`,
      'case-adc-cjmcu1220',
      m.adc,
      bounds([s * 9.5 - 1.2, -6, -0.01], [s * 9.5 + 1.2, 6, 0.01]),
      bounds([s * 9.5 - 2.2, -7, adapterPlane(p) - m.adc.at[2]], [s * 9.5 + 2.2, 7, 0]),
      [0, 0, 1],
      'Provisional22×21 PCB side-edge seat; assumed two header rows leave the±Y lead approaches open. Confirm delivered copper and underside joints.',
    );
  m.filters.forEach((pose, i) => {
    for (const s of [-1, 1])
      add(
        `filter-${i + 1}-edge-${s}`,
        `case-lc-filter-${i + 1}`,
        pose,
        bounds([-6, s * 2.5 - 0.4, -0.01], [6, s * 2.5 + 0.4, 0.01]),
        bounds([-7, s * 2.5 - 1.5, adapterPlane(p) - pose.at[2]], [7, s * 2.5 + 1.5, 0]),
        [0, 0, 1],
        'Provisional16×6 PCB long-edge seat; entire±X solder ends remain open. Confirm delivered revision and pads.',
      );
  });
  m.bucks.forEach((pose, i) => {
    add(
      `buck-${i + 1}-bottom`,
      `case-buck-${i + 1}`,
      pose,
      bounds([-19, 9.99, 0], [19, 10.01, 1.6]),
      bounds([-19, 10, -2.4], [19, 17.1, 1.6]),
      [0, -1, 0],
      'Broad38mm lower-edge saddle bears the provisional PCB edge and joins its removable adapter base directly; no mounting hole is assumed.',
    );
    for (const x of [-15, 15])
      add(
        `buck-${i + 1}-back-${x}`,
        `case-buck-${i + 1}`,
        pose,
        bounds([x - 2, -9.8, -0.01], [x + 2, 9.8, 0.01]),
        bounds([x - 3.5, -12, -3.3], [x + 3.5, 17.1, 0]),
        [0, 0, 1],
        'Short0.3mm underside caps are backed by a continuous38mm-wide,3mm-thick wall joined directly to the removable adapter base and lower saddle. The0.3mm backing clearance and actual back-side solder joints require a delivered-board check.',
      );
  });
  return out;
}

/** Stable native-fixture contract; tie segments are frame-local, contact boxes are operator XYZ. */
export function caseElectronicsRetention(p: Parameters) {
  const m = caseElectronicsLayout(p);
  return {
    coordinateSystem: 'operator XYZ millimetres; tie segments are local to their frame',
    maximumTie: { width: 2.5, thickness: 1 },
    ties: ties(p),
    optionalTieLanes: optionalTieLanes(p),
    supportSeats: seats(p),
    keepers: [
      {
        id: 'case-electronics-heltec-keeper',
        direction: [0, 0, 1],
        travelMm: 60,
        pathId: 'heltec-vertical-release',
        hosts: ['case-heltec-v4'],
      },
      ...[1, 2].map((i) => ({
        id: `case-electronics-buck-${i}-keeper`,
        direction: [0, 1, 0],
        travelMm: i === 1 ? 25 : 5,
        ...(i === 2 ? { pathId: 'bec-2-bench-release' } : {}),
        hosts: [`case-buck-${i}`],
      })),
      { id: 'case-electronics-filter-1-keeper', direction: [0, 0, 1], hosts: ['case-lc-filter-1'] },
      {
        id: 'case-electronics-adc-keeper',
        direction: [0, 0, 1],
        hosts: ['case-adc-cjmcu1220'],
      },
      {
        id: 'case-electronics-filter-2-keeper',
        direction: [0, 0, 1],
        hosts: ['case-lc-filter-2'],
      },
      { id: 'case-electronics-analogue-hood', direction: [0, 0, 1], hosts: [] },
    ],
    serviceSweeps: [
      {
        id: 'bec-1-normal-release',
        componentId: 'case-electronics-buck-1-keeper',
        translation: [0, 25, 0],
        boxes: frontBuckKeeperBoxes().map((b) => {
          const box = worldBox(m.bucks[0], b);
          return { min: box.min, max: [box.max[0], box.max[1] + 25, box.max[2]] as Vec };
        }),
        basis:
          'Exact continuous +Y sweep of the axis-aligned boxes composing the front Γ keeper; the swept union covers every intermediate translation, not only sampled poses.',
      },
    ],
    keeperPaths: [
      {
        id: 'heltec-vertical-release',
        componentId: 'case-electronics-heltec-keeper',
        sourceBoxes: heltecKeeperBoxes().map((b) => worldBox(m.heltec, b)),
        segments: [{ startTranslation: [0, 0, 0] as Vec, translation: [0, 0, 60] as Vec }],
        prerequisites:
          'Detached lower body on the bench; release the Heltec keeper tie and disconnect applicable leads before lifting. No neighbouring board is removed.',
      },
      {
        id: 'bec-2-bench-release',
        componentId: 'case-electronics-buck-2-keeper',
        sourceBoxes: rearBuckKeeperBoxes().map((b) => worldBox(m.bucks[1], b)),
        segments: [
          { startTranslation: [0, 0, 0] as Vec, translation: [0, 5, 0] as Vec },
          { startTranslation: [0, 5, 0] as Vec, translation: [-40, 0, 0] as Vec },
          { startTranslation: [-40, 5, 0] as Vec, translation: [0, 0, 60] as Vec },
        ],
        prerequisites:
          'Detached lower body on the bench; release both rear BEC keeper ties and disconnect its applicable leads before moving. No neighbouring board is removed.',
      },
    ],
    service:
      'Release hood ties and bond, lift hood through its open-bottom lead notches, release the applicable board ties, then move low retainers along the listed direction. The front BEC Γ keeper uses25mm +Y. On the detached body the rear BEC keeper first moves5mm +Y, then40mm left along-X, then60mm +Z to clear the closed battery bank. Disconnect applicable leads before handling; actual harnesses require a measured service check.',
  };
}

/** Closed pack bays share the lower floor; short guides retain the original extraction corridors. */
export function caseBatteryPocketStructure(p: Parameters) {
  const m = caseElectronicsLayout(p),
    t = m.batteryWallThickness,
    left = m.batteryPocketCentres[0][0] - 44.5,
    right = m.batteryPocketCentres[0][0] + 44.5,
    front = m.batteryPocketCentres[0][1] - 12.5,
    rear = m.batteryPocketCentres[1][1] + 12.5,
    middle = (m.batteryPocketCentres[0][1] + m.batteryPocketCentres[1][1]) / 2,
    bottom = m.batterySeatTop - 0.1,
    top = m.batteryWallTop;
  const wall = (id: string, min: Vec, max: Vec) => ({ id, min, max });
  const walls = [
    wall('battery-left-wall', [left - t, front - t, bottom], [left, rear + t, top]),
    wall('battery-right-wall', [right, front - t, bottom], [right + t, rear + t, top]),
    wall('battery-front-wall', [left, front - t, bottom], [right, front, top]),
    wall('battery-rear-wall', [left, rear, bottom], [right, rear + t, top]),
    wall('battery-divider', [left, middle - t / 2, bottom], [right, middle + t / 2, top]),
  ];
  const guideRows = [m.batteryPocketCentres[0][1] + 12.5, m.batteryPocketCentres[1][1] - 12.5 - t];
  const guides = guideRows.flatMap((y, i) => [
    wall(`battery-guide-${i + 1}-left`, [left - 0.6, y, bottom], [left + 4, y + t, top]),
    wall(`battery-guide-${i + 1}-right`, [right - 4, y, bottom], [right + 0.6, y + t, top]),
  ]);
  return {
    coordinateSystem: 'operator XYZ millimetres',
    componentId: 'case-lower-body',
    wallThicknessMm: t,
    wallTopZ: top,
    seatTopZ: m.batterySeatTop,
    floorBottomZ: m.floorBottom,
    seatThicknessMm: m.batterySeatTop - m.floorBottom,
    bounds: {
      min: [left - t, front - t, m.floorBottom] as Vec,
      max: [right + t, rear + t, top] as Vec,
    },
    pocketCentres: m.batteryPocketCentres,
    guideCorridorSize: m.batteryPocketSize,
    effectiveCorridors: m.batteryPocketCentres.map(([x, y]) => ({
      min: [x - 44.5, y - 12.5, m.batterySeatTop] as Vec,
      max: [x + 44.5, y + 12.5, top] as Vec,
      packHeightMm: 74,
      extractionTranslation: [0, 0, 75] as Vec,
      openAboveZ: top,
    })),
    walls,
    guides,
    continuityProbes: [...walls, ...guides].map(({ id, min, max }) => ({
      id: `${id}-continuous`,
      min: [min[0] + 0.2, min[1] + 0.2, m.floorTop + 0.2] as Vec,
      max: [max[0] - 0.2, max[1] - 0.2, top - 0.2] as Vec,
    })),
    rootProbes: [...walls, ...guides].map(({ id, min, max }) => ({
      id: `${id}-floor-root`,
      min: [min[0] + 0.2, min[1] + 0.2, m.batterySeatTop - 0.05] as Vec,
      max: [max[0] - 0.2, max[1] - 0.2, m.floorTop + 0.2] as Vec,
    })),
    seatProbes: m.batteryPocketCentres.map(([x, y], i) => ({
      id: `battery-${i + 1}-closed-seat`,
      min: [x - 43.5, y - 11.5, m.floorBottom + 0.1] as Vec,
      max: [x + 43.5, y + 11.5, m.batterySeatTop - 0.1] as Vec,
    })),
    connectorReaction: {
      basis:
        'Three narrow posts retain full floor roots. Only their flange-side top strips step down to Z0.5 for the rear-installed XT60E-M flange. The separate wide between-connector pier remains unchanged at Z1.5.',
      flangeRearZ: 0.5,
      panelRearZ: 1.5,
      pocketOuterX: 18.65,
      panelBearingStripX: [18.65, 20.35] as const,
      seats: [
        {
          id: 'xt-reaction-front-flange',
          hostId: 'case-power-connector-1',
          min: [17.6, 88.2, 0.3],
          max: [18.2, 93.8, 0.5],
          minimumBearingAreaMm2: 3,
        },
        {
          id: 'xt-reaction-middle-flange',
          hostId: 'case-power-connector-1',
          min: [17.52, 105, 0.3],
          max: [17.62, 106.5, 0.5],
          minimumBearingAreaMm2: 0.1,
        },
        {
          id: 'xt-reaction-rear-flange',
          hostId: 'case-power-connector-2',
          min: [17.6, 121.7, 0.3],
          max: [18.2, 127.3, 0.5],
          minimumBearingAreaMm2: 3,
        },
      ],
      panelSeats: [
        { id: 'xt-reaction-front-panel', min: [18.8, 88.2, 1.3], max: [20.2, 93.8, 1.5] },
        { id: 'xt-reaction-middle-panel', min: [18.8, 108, 1.3], max: [20.2, 110.5, 1.5] },
        { id: 'xt-reaction-rear-panel', min: [18.8, 121.7, 1.3], max: [20.2, 127.3, 1.5] },
      ],
      roots: m.batteryPierCentresY.map((y, i) => ({
        id: `xt-reaction-post-${i + 1}-continuous-root`,
        min: [18.8, y - 2.8, m.floorTop + 0.1] as Vec,
        max: [20.2, y + 2.8, 1.3] as Vec,
      })),
    },
    minimumPanelBearingAreaMm2: 250,
    registration:
      'The four existing shared lower-body keys register the whole bank to the faceplate; continuous wall tops bear at panelRearZ1.5 around the unchanged pack apertures.',
    debrisBarrier:
      'Continuous outer walls, shared divider and closed recessed floors; no low lead or drain holes. Pack leads exit above the faceplate. The short internal corner guides preserve each89×25mm extraction corridor without a second full middle wall.',
  };
}

/** Integral protective pockets, closed seats and retained direct XT60 reaction supports. */
export function caseBatteryPockets(p: Parameters): Shape {
  const m = caseElectronicsLayout(p),
    bank = caseBatteryPocketStructure(p),
    left = m.batteryPocketCentres[0][0] - 47.5,
    right = m.batteryPocketCentres[0][0] + 44.5,
    z = m.floorBottom;
  return union(
    ...bank.walls.map(rawBox),
    ...bank.guides.map(rawBox),
    ...m.batteryPocketCentres.map(([x, y]) => box([89.4, 25.4, 2.4], [x - 44.7, y - 12.7, z])),
    ...[left, right].map((x) => box([3, 64.5, 2.4], [x, 75.5, z])),
    ...m.batterySeatStripRows.map((y) => box([95, 4, 2.4], [left, y, z])),
    ...m.batteryEndLipRows.map((y) => box([95, 1.5, 3.6], [left, y, z])),
    ...m.batteryPierCentresY.map((y) =>
      subtract(
        box([3, 6, 57], [left, y - 3, z]),
        ...[94, 124.5].map((centreY) => box([1.15, 27.7, 1.2], [left, centreY - 13.85, 0.5])),
      ),
    ),
    box([m.xt60MiddleReactionPier.max[0]-m.xt60MiddleReactionPier.min[0], m.xt60MiddleReactionPier.max[1]-m.xt60MiddleReactionPier.min[1], 57], [...m.xt60MiddleReactionPier.min, z]),
  );
}

function capSeat(base: Bounds, cap: Bounds): Shape {
  return union(rawBox(base), rawBox(cap));
}
function horizontalCradle(p: Parameters, kind: 'adc' | 'filter', pose: ElectronicsPose): Shape {
  const m = caseElectronicsLayout(p),
    z = adapterPlane(p) - pose.at[2],
    out: Shape[] = [];
  if (kind === 'adc') {
    for (const s of [-1, 1]) {
      out.push(
        capSeat(
          bounds([s * 9.5 - 2.2, -7, z], [s * 9.5 + 2.2, 7, -0.3]),
          bounds([s * 9.5 - 1.2, -6, -0.3], [s * 9.5 + 1.2, 6, 0]),
        ),
      );
      out.push(box([1.8, 10, 2.1 - z], [s < 0 ? -13 : 11.2, -5, z]));
      for (const e of [-1, 1])
        out.push(box([3.2, 1.8, 2.1 - z], [s < 0 ? -12.2 : 9, e < 0 ? -12.5 : 10.7, z]));
    }
  } else {
    for (const s of [-1, 1]) {
      out.push(
        capSeat(
          bounds([-7, s * 2.5 - 1.5, z], [7, s * 2.5 + 1.5, -0.3]),
          bounds([-6, s * 2.5 - 0.4, -0.3], [6, s * 2.5 + 0.4, 0]),
        ),
      );
      out.push(box([8, 1.8, 1.5 - z], [-4, s < 0 ? -5 : 3.2, z]));
      for (const e of [-1, 1])
        out.push(box([1.8, 2.2, 1.5 - z], [e < 0 ? -10 : 8.2, s < 0 ? -4.2 : 2, z]));
    }
  }
  return placed(pose, union(...out));
}
function buckCradle(pose: ElectronicsPose): Shape {
  const solids: Shape[] = [
    box([38, 7.1, 4], [-19, 10, -2.4]),
    box([38, 29.1, 3], [-19, -12, -3.3]),
  ];
  for (const x of [-15, 15])
    solids.push(box([4, 19.6, 0.3], [x - 2, -9.8, -0.3]), box([4, 1.8, 2.4], [x - 2, -12, -0.3]));
  return placed(pose, union(...solids));
}
function heltecCradle(p: Parameters): Shape {
  const m = caseElectronicsLayout(p),
    z = adapterPlane(p) - m.heltec.at[2],
    s: Shape[] = [];
  for (const side of [-1, 1])
    s.push(
      capSeat(
        bounds([side * 9.9 - 2.5, 11, z], [side * 9.9 + 2.5, 19, 3.3]),
        bounds([side * 9.9 - 0.5, 13, 3.3], [side * 9.9 + 0.5, 17, 3.6]),
      ),
    );
  for (const x of [-3, 3])
    s.push(box([5, 5, 3.3 - z], [x - 2.5, -23, z]), cylinder(1.2, 0.3, [x, -20.5, 3.3]));
  for (const side of [-1, 1]) {
    s.push(box([1.8, 3.6, 4.6 - z], [side < 0 ? -14.7 : 12.9, 14.4, z]));
    s.push(box([1.8, 5, 4.9 - z], [side < 0 ? -14.7 : 12.9, -22, z]));
  }
  return placed(m.heltec, union(...s));
}

function floorTieCuts(p: Parameters, selection: 'hood' | 'boards' = 'boards', boardId?: string): Shape[] {
  const m = caseElectronicsLayout(p),
    out: Shape[] = [];
  for (const t of ties(p)) {
    if ((selection === 'hood') !== t.id.startsWith('hood-')) continue;
    if (boardId && !t.hostIds.includes(boardId)) continue;
    if (!t.floorLoop) {
      out.push(placed(t.frame, box([3.2, 1.4, 15], [t.centre - 1.6, 11.1, -5])));
      continue;
    }
    const c = t.centre,
      h = t.halfSpan,
      z = (selection === 'hood' ? m.floorBottom : adapterPlane(p)) - t.frame.at[2];
    const b =
      t.axis === 'x'
        ? box([2 * h + 2, 3.2, 1.3], [-h - 1, c - 1.6, z - 0.1])
        : box([3.2, 2 * h + 2, 1.3], [c - 1.6, -h - 1, z - 0.1]);
    out.push(placed(t.frame, b));
    for (const sign of [-1, 1])
      out.push(
        placed(
          t.frame,
          t.axis === 'x'
            ? box([1.4, 3.2, 5], [sign * h - 0.7, c - 1.6, z - 0.5])
            : box([3.2, 1.4, 5], [c - 1.6, sign * h - 0.7, z - 0.5]),
        ),
      );
  }
  if (selection === 'boards') for (const lane of optionalTieLanes(p)) if (!boardId || lane.hostId===boardId) out.push(placed(lane.frame, rawBox(lane.slotBox)));
  return out;
}

type Cell = { centre: Point; flat: number; radius: number; points: Point[] };
type HoneycombPattern = {
  cells: Cell[];
  centres: Point[];
  radius: number;
  flat: number;
  minimumWeb: number;
  measuredMinimumWeb: number;
  perimeterWidth: number;
  mountingIslandRadius: number;
  mountingIslands: { centre: Point; radius: number }[];
  tieLandWidth: number;
  quietPodFloor: 'no honeycomb; universal M3 and structural hood retention ports retained';
};
const honeycombCache = new Map<string, HoneycombPattern>();
const cross2 = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const insidePolygon = (p: Point, polygon: Point[]) =>
  polygon.every((a, i) => cross2(a, polygon[(i + 1) % polygon.length], p) >= -1e-8);
function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const x = b[0] - a[0],
    y = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / (x * x + y * y)));
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y);
}
function polygonDistance(a: Point[], b: Point[]): number {
  if (a.some((p) => insidePolygon(p, b)) || b.some((p) => insidePolygon(p, a))) return 0;
  let distance = Infinity;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const aa = a[i],
        ab = a[(i + 1) % a.length],
        ba = b[j],
        bb = b[(j + 1) % b.length];
      if (
        cross2(aa, ab, ba) * cross2(aa, ab, bb) < 0 &&
        cross2(ba, bb, aa) * cross2(ba, bb, ab) < 0
      )
        return 0;
      distance = Math.min(
        distance,
        pointSegmentDistance(aa, ba, bb),
        pointSegmentDistance(ba, aa, ab),
      );
    }
  return distance;
}

/** Large hexes fill unsupported bays; exact polygon distances preserve every load land. */
export function caseElectronicsHoneycomb(p: Parameters): HoneycombPattern {
  const m = caseElectronicsLayout(p), g = caseModularElectronics(p).grid;
  const rectangles: [number, number, number, number][] = [
    [17.5, 75.5, 112.5, 140],
    [m.quietPodMin[0] - 1, m.quietPodMin[1] - 4, m.quietPodMax[0] + 1, m.quietPodMax[1] + 4],
    [m.shieldBond[0] - 6, m.shieldBond[1] - 5, m.shieldBond[0] + 6, m.shieldBond[1] + 5],
    [167, m.quietPodMin[1] - 4, 182, m.quietPodMax[1] + 4],
  ];
  const islands = [
    ...caseBrassLayout().map((s) => ({ centre: s.at, radius: 8 })),
    ...g.nodes.map((n) => ({ centre: n.centre, radius: 5.2 })),
  ];
  const key = JSON.stringify([g, rectangles, islands]);
  const cached = honeycombCache.get(key); if (cached) return cached;
  const polygons: Point[][] = rectangles.map(([x0, y0, x1, y1]) => [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
  const cells: Cell[] = [], flat = 14.5, r = flat / Math.sqrt(3);
  const min = m.floorMin.map((v) => v + m.floorPerimeterWidth), max = m.floorMax.map((v) => v - m.floorPerimeterWidth);
  for (let x = 20; x <= 200; x += 20) for (let y = 20; y <= 140; y += 20) {
    const points = Array.from({length:6}, (_,i):Point => [x+r*Math.cos(i*Math.PI/3),y+r*Math.sin(i*Math.PI/3)]);
    if (points.some(([px,py]) => px<min[0] || px>max[0] || py<min[1] || py>max[1])) continue;
    if (polygons.some((polygon) => polygonDistance(points, polygon) < 0.01)) continue;
    if (islands.some(({centre,radius}) => insidePolygon(centre,points) || Math.min(...points.map((a,i)=>pointSegmentDistance(centre,a,points[(i+1)%6])))<radius)) continue;
    cells.push({centre:[x,y],flat,radius:r,points});
  }
  const pattern: HoneycombPattern = {
    cells, centres:cells.map((c)=>c.centre),radius:r,flat,
    minimumWeb:2.6,
    measuredMinimumWeb:Math.min(...cells.flatMap((c,i)=>cells.slice(i+1).map((d)=>polygonDistance(c.points,d.points)))),
    perimeterWidth:m.floorPerimeterWidth,mountingIslandRadius:8,mountingIslands:islands,tieLandWidth:m.tieLandWidth,
    quietPodFloor:'no honeycomb; universal M3 and structural hood retention ports retained',
  };
  honeycombCache.set(key,pattern);return pattern;
}

export function caseElectronicsFloor(p: Parameters): Shape {
  const m = caseElectronicsLayout(p),
    f = m.floorTop,
    b = m.floorBottom,
    profile = roundedRect(
      caseLowerFloorFootprint.size[0],
      caseLowerFloorFootprint.size[1],
      caseLowerFloorFootprint.cornerRadius,
      b,
      f - b,
    ),
    honey = caseElectronicsHoneycomb(p);
  if (profile.kind !== 'prism') throw Error('Expected an extruded floor');
  const floor = subtract(
    {
      ...profile,
      points: profile.points.map(([x, y]): [number, number] => [x + 107, y + 75]),
      // Retain the same authored world frame for the native circular corners.
      ...(profile.native ? { native: { ...profile.native, translation: [
        (profile.native.translation?.[0] ?? 0) + 107,
        (profile.native.translation?.[1] ?? 0) + 75,
        profile.native.translation?.[2] ?? 0,
      ] as [number, number, number] } } : {}),
    },
    ...honey.cells.map((cell): Shape => ({
      kind: 'prism',
      points: cell.points.map(([x, y]) => [x, y]),
      depth: f - b + 2,
      origin: b - 1,
      axis: 'z',
    })),
  );
  const s: Shape[] = [floor, caseElectronicsGridNodes(p)];
  for (const x of [m.quietPodMin[0] + 1.8, m.quietPodMax[0] - 3])
    s.push(box([1.2, m.quietPodMax[1] - m.quietPodMin[1] - 6, 1.4], [x, m.quietPodMin[1] + 3, f]));
  const cuts: Shape[] = [
    ...m.batteryPocketCentres.map(([x, y]) =>
      box(
        [m.batteryPocketSize[0], m.batteryPocketSize[1], f - m.batterySeatTop + 1],
        [x - m.batteryPocketSize[0] / 2, y - m.batteryPocketSize[1] / 2, m.batterySeatTop],
      ),
    ),
    cylinder(1.9, 5, [...m.shieldBond, b - 1]),
    ...floorTieCuts(p, 'hood'),
    ...caseElectronicsGridCuts(p),
  ];
  return subtract(union(...s), ...cuts);
}

function adcKeeper(): Shape {
  return union(
    box([3.5,9,2],[12.5,-4.5,4]),
    ...[-3, 3].flatMap((y) => [
      box([32, 3, 2], [-16, y - 1.5, 4]),
      ...[-1, 1].map((s) => box([2.4, 3, 2.4], [s * 9.5 - 1.2, y - 1.5, 1.6])),
    ]),
  );
}
function filterKeeper(): Shape {
  return union(
    box([6, 14, 2], [-3, -7, 4]),
    ...[-1, 1].map((s) => box([6, 0.8, 3], [-3, s * 2.55 - 0.4, 1])),
  );
}
function frontBuckKeeperBoxes(): Bounds[] {
  return [
    bounds([-17.55, -11, 6], [-9.65, 11, 8.4]),
    bounds([-17, -11, 6], [17, -7, 8.4]),
    ...[-8.5, 8.5].map((y) => bounds([-16.5, y - 1.5, 1.6], [-13.5, y + 1.5, 6])),
    bounds([13.5, -10, 1.6], [16.5, -7, 6]),
  ];
}
function rearBuckKeeperBoxes(): Bounds[] {
  return [
    ...[-15, 15].flatMap((x) => [
      bounds([x - 2, -11, 6], [x + 2, 11, 7.6]),
      ...[-8.5, 8.5].map((y) => bounds([x - 1.5, y - 1.5, 1.6], [x + 1.5, y + 1.5, 6])),
    ]),
    bounds([-17, 9, 6], [17, 11, 7.6]),
  ];
}
function buckKeeper(front: boolean): Shape {
  if (front) return union(...frontBuckKeeperBoxes().map(rawBox));
  return union(...rearBuckKeeperBoxes().map(rawBox));
}
function heltecKeeperBoxes(): Bounds[] {
  return [
    bounds([-12, 11.5, 6.4], [12.4, 17, 8.4]),
    ...[-1, 1].flatMap((s) => [
      bounds([Math.max(-12, s * 9.9 - 2.5), 13, 5.6], [s * 9.9 + 2.5, 17, 6.4]),
      bounds([s * 9.9 - 0.5, 13, 5.2], [s * 9.9 + 0.5, 17, 5.6]),
    ]),
  ];
}
function heltecKeeper(): Shape {
  return union(...heltecKeeperBoxes().map(rawBox));
}
/** Shared authoritative adapter geometry for this assembly and the independent adapter catalogue. */
export function caseElectronicsAdapterDetails(p: Parameters): DetailSpec[] {
  const m = caseElectronicsLayout(p), system = caseModularElectronics(p), f = system.grid.nodeTopZ;
  const slab = (x: number, y: number, width: number, height: number, thickness = 3): Shape => box([width, height, thickness], [x, y, f]);
  const clipped = (shape: Shape): Shape => ({ kind: 'intersect', children: [shape, box([230, 160, 80], [-5, -5, f])] });
  const hatSupport = (): Shape => union(...hatAxes(p).map(([x,y]) => {
    const contact = m.hat.at[2] - 1.6;
    const ring = (r: number,z: number):Vec[] => Array.from({length:32},(_,i):Vec=>[x+r*Math.cos(i*Math.PI/16),y+r*Math.sin(i*Math.PI/16),z]);
    const post = union(
      cylinder(4.2, 4.6, [x,y,f]),
      {kind:'loft',rings:[ring(4.2,f+4.6),ring(3,contact-1)]},
      cylinder(3,1,[x,y,contact-1]),
    );
    // The imported right-side header reaches between the two mounting corners.
    // A5.9mm fore/aft register preserves the original bare PCB lands and clears it.
    return x > m.hat.at[0] ? ({kind:'intersect',children:[post,box([10,5.9,20],[x-5,y-2.95,f])]} as Shape) : post;
  }));
  const shapeFor = (id: string): Shape => {
    if (id === 'case-electronics-hat-adapter') {
      return union(
        subtract(slab(122,5,58.7,67,2), box([22,24,4],[119,18,f-1]), ...[[141,27],[163,27],[141,49],[163,49]].map(([x,y])=>box([10,12,4],[x-5,y-6,f-1]))),
        slab(177,67.5,13,5,2), hatSupport(),
      );
    }
    if (id === 'case-electronics-heltec-adapter') {
      return union(
        subtract(slab(24,17.5,56,30,1.8),box([16,16,4],[46,24,f-1]),cylinder(5,20,[61,15,f-1])),
        slab(36.75,17.6,7,30.8,3), heltecCradle(p),
      );
    }
    if (id === 'case-electronics-adc-adapter') {
      const [x,y] = m.adc.at;
      return union(slab(x-14,y-14,28,27),slab(168,88,24,4),slab(184,y-14,8,5), ...[-3,3].map((dy)=>slab(x-19,y+dy-3.5,38,7)), horizontalCradle(p,'adc',m.adc));
    }
    const filterIndex = id === 'case-electronics-filter-1-adapter' ? 0 : id === 'case-electronics-filter-2-adapter' ? 1 : -1;
    if (filterIndex >= 0) {
      const pose=m.filters[filterIndex], [x,y]=pose.at, row=filterIndex===0?90:130;
      return union(slab(x-11,y-6,22,12),slab(x-3.5,y-10.5,7,21),slab(filterIndex===0?130:170,row-2,20,4),horizontalCradle(p,'filter',pose));
    }
    const index = id === 'case-electronics-buck-1-adapter' ? 0 : 1;
    const pose=m.bucks[index], y=pose.at[1], row=index===0?10:50;
    return union(
      slab(8.5,index===0?8.5:48.5,3,23.5,2),
      slab(10,index===0?row-1.5:row-1.2,45.5,3,2),
      clipped(buckCradle(pose)),
      // Two straight rear T flanges carry the wall to its floor beam without angled posts.
      box([3,4.7,22],[14,y-5,f]),box([3,index===0?4.7:3.7,22],[52.5,y-(index===0?5:4),f]),
    );
  };
  return system.adapters.map((a) => {
    const anchors = a.anchors.map(({axisPoint:[x,y]}) => {
      const cup = cylinder(4.8,4.6,[x,y,f]);
      const pose = a.boardId === 'case-adc-cjmcu1220' ? m.adc : a.boardId === 'case-lc-filter-1' ? m.filters[0] : a.boardId === 'case-lc-filter-2' ? m.filters[1] : undefined;
      if (!pose) return cup;
      const half = a.boardId === 'case-adc-cjmcu1220' ? [11,10.5] : [8,3];
      // The full2mm clamping foot and lower1.2mm hex key stay intact. Only non-load-bearing
      // upper cup plastic is relieved beside the actual PCB; the ordinary nut is already clear.
      return subtract(cup,box([2*half[0]+.6,2*half[1]+.6,10],[pose.at[0]-half[0]-.3,pose.at[1]-half[1]-.3,pose.at[2]-.3]));
    });
    const cuts: Shape[] = [
      ...a.anchors.flatMap(({axisPoint:[x,y]})=>[
        cylinder(1.7,4.8,[x,y,f-0.1]),hex(5.8,80,[x,y,f+2]),
      ]),
      ...floorTieCuts(p,'boards',a.boardId),
      ...ties(p).filter((t)=>!t.floorLoop && t.hostIds.includes(a.boardId)).flatMap((t)=>t.segments.map(({min,max})=>placed(t.frame,box(max.map((v,i)=>v-min[i]+.6) as Vec,min.map((v)=>v-.3) as Vec)))),
      ...optionalTieLanes(p).filter((t)=>t.hostId===a.boardId).flatMap((t)=>t.segments.map(({min,max})=>placed(t.frame,box(max.map((v,i)=>v-min[i]+.6) as Vec,min.map((v)=>v-.3) as Vec)))),
    ];
    if (a.boardId === 'case-servo-driver-hat') for (const [x,y] of hatAxes(p)) {
      cuts.push(cylinder(1.4,12,[x,y,f-0.1]),hex(5.2,2.2,[x,y,-47.5]),box([5.2,6,2.2],[x-2.6,y,-47.5]));
    }
    const raw = subtract(union(shapeFor(a.id),...anchors),...cuts);
    return print(a.id, `${a.label} · replaceable ${a.orientation} M3 adapter`, raw, [
      'Print the adapter underside flat. Only its board-specific cradle, tie ports and retainer change when substituting a PCB; preserve the standard20mm M3 foot axes and2mm screw-bearing feet.',
      'Stock M3×8 screws enter the universal raised tray nodes from below. Load ordinary AF5.5×2.4 nuts into the top-open AF5.8 pockets before installing the board; temporary removable tape can hold loose nuts during assembly. The pockets resist rotation but do not capture an unfastened nut axially.',
      'The recessed screw heads remain inside the lower tray envelope. The joint spans2.9mm of tray bearing web and2mm of adapter foot before the nut, giving full2.4mm nut engagement and0.7mm exposed tip. Check actual hardware and printed fit before tightening.',
      'All board ties return through this small adapter, not the large tray. Lift the full insert out of the case for underside access, disconnect the applicable leads, then remove only this adapter\'s screws. A replacement or relocated board needs a fresh installed wiring, thermal, EMI and service-envelope check.',
    ]);
  });
}

export function caseElectronicsDetails(p: Parameters): DetailSpec[] {
  const m = caseElectronicsLayout(p),
    out: DetailSpec[] = [...caseElectronicsAdapterDetails(p)];
  const notes = [
    'Print the broad keeper top on the bed; short bearing feet grow upward. It is removed independently after releasing its full2.5×1mm maximum tie loops. Keep buckles and trimmed ends above the floor.',
    'These generic board edge lands are provisional, not verified component-free copper. Fit delivered PCB edges, solder joints and temperature before tightening. Power/signal solder ends remain open; no screw hole is invented.',
  ];
  m.bucks.forEach((pose, i) =>
    out.push(
      print(
        `case-electronics-buck-${i + 1}-keeper`,
        'Low BEC edge keeper',
        placed(pose, buckKeeper(i === 0)),
        i === 0
          ? [
              ...notes,
              'The front converter uses one broad Γ keeper: three adopted PCB corner lands, two full ties on its left spine, and an upper crossbar above the Heltec envelope. Release the ties and translate it25mm along operator+Y on the detached body before handling the PCB. Its low spine ends atX25.35, leaving1.05mm to the source Heltec USB end; no neighbouring PCB is removed.',
            ]
          : [
              ...notes,
              'On the detached lower body release both rear BEC keeper ties and disconnect applicable leads, move5mm along+Y, then40mm left along-X, then lift60mm along+Z. This ordered path clears the closed battery pocket wall; do not force the former straight+Y25mm release. No neighbouring board is removed.',
            ],
      ),
    ),
  );
  out.push(
    print(
      'case-electronics-filter-1-keeper',
      'Low sensor-supply LC keeper',
      placed(m.filters[0], filterKeeper()),
      notes,
    ),
  );
  out.push(
    print('case-electronics-adc-keeper','Independent low ADC keeper',placed(m.adc,adcKeeper()),notes),
    print('case-electronics-filter-2-keeper','Independent low quiet-supply LC keeper',placed(m.filters[1],filterKeeper()),notes),
  );
  out.push(
    print(
      'case-electronics-heltec-keeper',
      'Low source-land Heltec keeper',
      placed(m.heltec, heltecKeeper()),
      [
        'Only nativeX±9.4..10.4,Y13..17,Z5.2 source-cleared PCB lands touch the final0.4mm contact caps. Broad5×4mm backing rises above the unpopulated GPIO annuli; the flat bridge clears their metal, OLED/FPC frame, USB and buttons.',
        'Print the broad bridge top down. The noncontact native-X end stops at-12mm to clear the fitted ARM1 cradle during the complete60mm vertical release; the original contact caps remain unchanged. One complete tie loop retains the keeper; release it and lift vertically on the detached body. The board position is validated against the universal grid, adapter and mounting hardware. Real headers, antenna leads and the supplied revision require a fit check. These are source-model-clear lands, not supplier-approved fastening lands.',
      ],
    ),
  );
  const [x0, y0] = m.quietPodMin,
    [x1, y1] = m.quietPodMax,
    wall = m.quietPodWall,
    roof = m.quietPodRoof,
    f = m.floorTop,
    [bx, by] = m.shieldBond;
  const hood = subtract(
    union(
      box([x1 - x0, y1 - y0, roof - f + 1.5], [x0, y0, f]),
      box([13, 4, 2], [167.5, y0 - 4, f]),
      box([13, 4, 2], [167.5, y1, f]),
      box([x0 - bx + 6, 8, 5], [bx - 5, by - 4, f]),
    ),
    box([x1 - x0 - 2 * wall, y1 - y0 - 2 * wall, roof - f + 0.1], [x0 + wall, y0 + wall, f - 0.1]),
    box([5, 5, 7.1], [x0 - 1, m.spiEntryY[0], f - 0.1]),
    box([5, 5, 7.1], [x0 - 1, m.filteredSupplyEntryY[0], f - 0.1]),
    box(
      [m.analogueRearEntry.width, 5, 7.1],
      [m.analogueRearEntry.centre[0] - m.analogueRearEntry.width / 2, y1 - 2.5, f - 0.1],
    ),
    cylinder(1.7, 9, [bx, by, f - 1]),
    hex(5.8, 2.6, [bx, by, f - 0.1]),
    ...[y0 - 2, y1 + 2].flatMap((y) =>
      [168.5, 179.5].map((x) => box([1.4, 3.2, 4], [x - 0.7, y - 1.6, f - 1])),
    ),
  );
  out.push(
    print('case-electronics-analogue-hood', 'Low removable insulated analogue foil hood', hood, [
      'Print the continuous roof on the bed. Its inner roof is13mm above the adopted ADC underside and1mm above the12mm wiring reserve. Low board seats shorten the hood while keeping full reserve height. Small supports are needed only under the exterior bond tab and tie tabs.',
      'Use foil on the exterior only, maximum0.15mm per layer and two layers at seams, with10mm overlap lands. Keep at least1mm setback from all three open-bottom lead notches and the open bottom. Plastic remains1.5mm thick between foil and pads; tape adhesive conductivity and seam continuity require verification.',
      'Separate left SPI, left filtered-supply and8mm rear analogue notches stay open to the bottom. Release both hood ties and the bond before lifting it along+Z on the detached lower body; soldered leads escape without threading through a closed window. Remove the hood and independent ADC/LC2 keepers before working on SP20 nuts. Actual insulated leads and bends remain unmeasured.',
      'The exterior M3 bond provision does not choose the electrical reference or prove shielding effectiveness. An optional8×8×1mm lug requires lifting its washer/screw by its measured thickness, at most1mm, while retaining full nut engagement.',
    ]),
  );
  return out;
}

export function caseElectronicsHardware(p: Parameters): ConfiguredPiece[] {
  const m = caseElectronicsLayout(p),
    out: ConfiguredPiece[] = [];
  for (const [i, [x, y]] of hatAxes(p).entries()) {
    const bolt = screw(
      `case-electronics-hat-screw-${i + 1}`,
      2.5,
      8,
      canonical([x, y, m.hat.at[2] + 0.5]),
    );
    Object.assign(bolt.component.parameters, {
      headSize: 4.5,
      headHeight: 2.5,
      pitch: 0.45,
      driveWidth: 2,
    });
    const nut = hexNut(
      `case-electronics-hat-nut-${i + 1}`,
      2.5,
      5,
      2,
      canonical([x, y, -47.3]),
      [0, 0, 90],
    );
    nut.component.parameters.pitch = 0.45;
    out.push(bolt, nut, {
      label: 'Flat washer M2.5 · Ø2.7/5.5×0.5',
      color: 0xa6afb8,
      component: {
        id: `case-electronics-hat-washer-${i + 1}`,
        name: 'Flat washer M2.5',
        libraryId: 'washer',
        parameters: { bore: 2.7, outerDiameter: 5.5, thickness: 0.5 },
        state: 'default',
        quantity: 1,
        supply: 'standard',
        placement: { translation: canonical([x, y, m.hat.at[2] + 0.25]), rotation: [0, 0, 0] },
      },
    });
  }
  for (const a of caseModularElectronics(p).adapters) for (const anchor of a.anchors) {
    const [x,y]=anchor.axisPoint;
    out.push(
      screw(anchor.screwId,3,8,canonical([x,y,anchor.underHeadZ]),[180,0,0]),
      hexNut(anchor.nutId,3,5.5,2.4,canonical([x,y,anchor.nutBottomZ]),[0,0,90]),
    );
  }
  const [x, y] = m.shieldBond;
  out.push(
    screw('case-electronics-shield-bond-screw', 3, 8, canonical([x, y, m.floorTop + 5.5])),
    hexNut(
      'case-electronics-shield-bond-nut',
      3,
      5.5,
      2.4,
      canonical([x, y, m.floorTop + 0.1]),
      [0, 0, 90],
    ),
    {
      label: 'Shield bond washer M3 · Ø3.2/7×0.5',
      color: 0xa6afb8,
      component: {
        id: 'case-electronics-shield-bond-washer',
        name: 'Flat washer M3',
        libraryId: 'washer',
        parameters: { bore: 3.2, outerDiameter: 7, thickness: 0.5 },
        state: 'default',
        quantity: 1,
        supply: 'standard',
        placement: { translation: canonical([x, y, m.floorTop + 5.25]), rotation: [0, 0, 0] },
      },
    },
  );
  return out;
}
