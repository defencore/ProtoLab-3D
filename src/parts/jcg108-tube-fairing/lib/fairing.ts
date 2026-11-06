import type { Parameters } from '../../../core/types';
import {
  cylinder,
  roundedRect,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import stationData from './profile-data.json';

const baselineStations = stationData as Vec[][];
const baselineRows = new Map(
  baselineStations.map((points) => [
    points[0][0],
    {
      centerZ: points.find((v) => Math.abs(v[1]) < 1e-8)![2],
      negativeWidth: -points[0][1],
      positiveWidth: points.at(-1)![1],
    },
  ]),
);
const smooth = (u: number) => {
  const v = Math.max(0, Math.min(1, u));
  return v ** 3 * (10 + v * (-15 + 6 * v));
};
export const move = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});

/** Retained freeform design trace, not a manufacturer's antenna or aerodynamic surface. */
function authoredPoint(point: Vec, p: Parameters): Vec {
  const [x, y, z] = point;
  const baseline = baselineRows.get(x)!;
  const centerZ = baseline.centerZ;
  const sideWidth = y < 0 ? baseline.negativeWidth : baseline.positiveWidth;
  const axialWeight = Math.min(1, Math.max(0, (-centerZ - 45) / 11.9));
  const sideWeight = Math.abs(y) <= 9 ? 1 : 1 - smooth((Math.abs(y) - 9) / (sideWidth - 9));
  const fitDelta = Number(p.antennaDepth) - 8.6 + Number(p.antennaBondline) - 0.3;
  let outZ = z - fitDelta * axialWeight * sideWeight;
  // A printable tube-backed termination replaces the former zero-gauge tangent.
  const h = Math.hypot(y, outZ) - 45;
  const hNew = h <= 1 ? 1 : h >= 2 ? h : 1 + (h - 1) * smooth(h - 1);
  outZ = -Math.sqrt((45 + hNew) ** 2 - y ** 2);
  return [p.airflowDirection === 'negative-x' ? -x : x, y, outZ];
}

export function fairingStations(p: Parameters): Vec[][] {
  const stations = baselineStations.map((section) =>
    section.map((point) => authoredPoint(point, p)),
  );
  return p.airflowDirection === 'negative-x' ? stations.reverse() : stations;
}

function sampledHeight(sections: Vec[][], x: number, y: number): number {
  const atSection = (section: Vec[]) => {
    let i = 1;
    while (i < section.length - 1 && section[i][1] < y) i++;
    const a = section[i - 1],
      b = section[i];
    return a[2] + ((b[2] - a[2]) * (y - a[1])) / (b[1] - a[1]);
  };
  let i = 1;
  while (i < sections.length - 1 && sections[i][0][0] < x) i++;
  const a = sections[i - 1],
    b = sections[i];
  return atSection(a) + ((atSection(b) - atSection(a)) * (x - a[0][0])) / (b[0][0] - a[0][0]);
}

export function fairingSpec(p: Parameters) {
  const measuredDepth = Number(p.antennaDepth),
    bondline = Number(p.antennaBondline);
  const backPlaneRadius = 45 + bondline,
    contactPlaneRadius = backPlaneRadius + measuredDepth;
  const flowSign = p.airflowDirection === 'negative-x' ? -1 : 1;
  const minX = flowSign > 0 ? -122.4 : -192.4,
    maxX = flowSign > 0 ? 192.4 : 122.4;
  const sections = fairingStations(p);
  const anchors = [-70, 70].map((x) => {
    const headTopRadius =
      Math.min(
        ...Array.from({ length: 96 }, (_, i) => {
          const a = (i * 2 * Math.PI) / 96;
          return -sampledHeight(sections, x + 3 * Math.cos(a), 3 * Math.sin(a));
        }),
      ) - 0.05;
    const screwLength = [20, 25, 30].find((length) => headTopRadius - length <= 33.5)!;
    return {
      x,
      y: 0,
      headTopRadius,
      screwLength,
      tipRadius: headTopRadius - screwLength,
      underHeadRadius: headTopRadius - 1.7,
    };
  });
  const y = Number(p.antennaY),
    x = Number(p.antennaX);
  return {
    capId: 'jcg108-fairing',
    tubeRadius: 45,
    tubeInnerRadius: 43,
    measuredDepth,
    bondline,
    backPlaneRadius,
    contactPlaneRadius,
    nominalSourceDepth: 8.6,
    wall: 3,
    crownRise: 0.6,
    apexAbovePipe: bondline + measuredDepth + 3 + 0.6,
    cavityLength: 128.8,
    cavityWidth: 18,
    cavityCornerRadius: 0.8,
    coreHalfLength: 67.4,
    noseLength: 55,
    tailLength: 125,
    totalLength: 314.8,
    flowDirection: p.airflowDirection,
    flowSign,
    minX,
    maxX,
    minimumTubeBounds: { minX: minX - 20, maxX: maxX + 20 },
    negativeHalfWidth: 36,
    positiveHalfWidth: 32,
    tipHalfWidth: 10,
    minimumAuthoredSupportedEdge: 1,
    antennaPlacement: {
      translation: [0, 0, -backPlaneRadius] as Vec,
      rotation: [0, 180, 0] as Vec,
    },
    measurementEnvelopeBounds: {
      min: [-64, -8.6, -contactPlaneRadius] as Vec,
      max: [64, 8.6, -backPlaneRadius] as Vec,
    },
    capApproachDirection: [0, 0, 1] as Vec,
    feed: { x, y, diameter: Number(p.antennaHole) },
    coaxServiceDiameter: 4.2,
    coaxWaypoints: [
      [x, -10.9, -backPlaneRadius - measuredDepth / 2],
      [x, y, -Math.sqrt(43 ** 2 - y ** 2) - 2.6],
      [x, y, -28.44],
    ] as Vec[],
    anchors,
    anchorHeadDiameter: 6,
    anchorHeadHeight: 1.7,
    anchorShaftDiameter: 3.4,
    anchorNutInnerRadius: 34,
    anchorNutOuterRadius: 36.4,
    targetSpeed: 300,
    printOrientation: {
      rotation: [180, 0, 45] as Vec,
      translation: [0, 0, (-45 / 46) * Math.sqrt(46 ** 2 - 36 ** 2)] as Vec,
    },
  };
}

/** One native B-spline roof and two closing patches, before the analytic tube cut. */
export function fairingOuterEnvelope(p: Parameters): Shape {
  return {
    kind: 'smooth-loft',
    sections: fairingStations(p).map((points) => ({
      segments: [
        { kind: 'spline' as const, points },
        { kind: 'line' as const, points: [points.at(-1)!, [points[0][0], 0, 0] as Vec] },
        { kind: 'line' as const, points: [[points[0][0], 0, 0] as Vec, points[0]] },
      ],
    })),
    previewSamples: 53,
  };
}

export function fairingCableServiceSpace(p: Parameters): Shape {
  const s = fairingSpec(p),
    radius = s.coaxServiceDiameter / 2;
  const points = s.coaxWaypoints;
  const children: Shape[] = points.map((origin) => ({ kind: 'sphere', radius, origin }));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      delta = b.map((v, k) => v - a[k]);
    const height = Math.hypot(...delta),
      angle = (Math.acos(delta[2] / height) * 180) / Math.PI;
    const yaw = (Math.atan2(delta[1], delta[0]) * 180) / Math.PI;
    children.push(move(cylinder(radius, height, [0, 0, 0]), a, [0, angle, yaw]));
  }
  return { kind: 'union', nativeBatch: true, children };
}

export function fairingShape(p: Parameters): Shape {
  const s = fairingSpec(p);
  const holes = s.anchors.flatMap((a): Shape[] => [
    cylinder(1.7, a.headTopRadius - 40 + 3, [a.x, 0, -a.headTopRadius - 1]),
    move(
      {
        kind: 'revolve',
        profile: [
          [0, a.underHeadRadius],
          [1.5, a.underHeadRadius],
          [6, a.underHeadRadius + 4.5],
          [0, a.underHeadRadius + 4.5],
        ],
      },
      [a.x, 0, 0],
      [180, 0, 0],
    ),
  ]);
  return subtract(
    fairingOuterEnvelope(p),
    { ...cylinder(45, s.totalLength + 4, [s.minX - 2, 0, 0], 'x'), previewSegments: 512 } as Shape,
    roundedRect(
      s.cavityLength,
      s.cavityWidth,
      s.cavityCornerRadius,
      -s.contactPlaneRadius,
      s.contactPlaneRadius + 1,
    ),
    fairingCableServiceSpace(p),
    ...holes,
  );
}

export function fairingPrintShape(p: Parameters): Shape {
  const s = fairingSpec(p);
  return move(fairingShape(p), s.printOrientation.translation, s.printOrientation.rotation);
}

export function referenceTubeShape(p: Parameters): Shape {
  const s = fairingSpec(p),
    { minX, maxX } = s.minimumTubeBounds;
  return subtract(
    { ...cylinder(45, maxX - minX, [minX, 0, 0], 'x'), previewSegments: 192 } as Shape,
    { ...cylinder(43, maxX - minX + 2, [minX - 1, 0, 0], 'x'), previewSegments: 192 } as Shape,
    cylinder(s.feed.diameter / 2, 65, [s.feed.x, s.feed.y, -60]),
    ...s.anchors.map((a) => cylinder(1.7, 25, [a.x, 0, -60])),
  );
}
