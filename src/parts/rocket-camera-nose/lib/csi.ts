import { isGuided } from './guided-layout';
import { guidedCsiPlan, guidedCsiReserve } from './guided-routing';
import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { hasOV9281, opticalLayout } from './optical-layout';
import { union } from '../../../core/assembly/boundary/shapes';
import { structuralCoordinates } from './structural';

type Cubic = [Vec, Vec, Vec, Vec];
interface Station {
  point: Vec;
  tangent: Vec;
  width: Vec;
  normal: Vec;
}
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (v: Vec, k: number): Vec => [v[0] * k, v[1] * k, v[2] * k];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const magnitude = (v: Vec): number => Math.hypot(...v);
const unit = (v: Vec): Vec => scale(v, 1 / magnitude(v));

function cubic(curve: Cubic, t: number) {
  const [a, b, c, d] = curve;
  const u = 1 - t;
  const point = add(
    add(scale(a, u ** 3), scale(b, 3 * u * u * t)),
    add(scale(c, 3 * u * t * t), scale(d, t ** 3)),
  );
  const velocity = add(
    add(scale(sub(b, a), 3 * u * u), scale(sub(c, b), 6 * u * t)),
    scale(sub(d, c), 3 * t * t),
  );
  const acceleration = add(
    scale(add(sub(c, scale(b, 2)), a), 6 * u),
    scale(add(sub(d, scale(c, 2)), b), 6 * t),
  );
  const bending = magnitude(cross(velocity, acceleration));
  return {
    point,
    tangent: unit(velocity),
    bendRadius: bending > 1e-12 ? magnitude(velocity) ** 3 / bending : Infinity,
  };
}

function station(point: Vec, tangent: Vec, cameraRearZ: number): Station {
  // The Pi slot is wide along Y. The rear camera window has its wider side along X.
  const u = Math.max(0, Math.min(1, (point[2] - 76) / (cameraRearZ - 5 - 76)));
  const angle = (Math.PI / 2) * (u * u * (3 - 2 * u));
  const basis: Vec = [Math.sin(angle), Math.cos(angle), 0];
  const width = unit(sub(basis, scale(tangent, dot(basis, tangent))));
  return { point, tangent, width, normal: unit(cross(tangent, width)) };
}

/** Authored routing allowance, not a purchased cable or a validated electrical interface. */
export function csiCablePlan(p: Parameters) {
  if (isGuided(p)) return guidedCsiPlan(p);
  if (hasOV9281(p))
    throw new Error('Use cameraCablePlans for the OV9281 and dual-camera installations.');
  const a = structuralCoordinates;
  const cameraBodyRearZ = n(p, 'noseLength') - 25;
  // Rear latch: 17 x 2 mm, right aligned, 3 mm below the 19 mm body's top.
  const cameraMouth: Vec = [1, 5.5, cameraBodyRearZ - 0.5];
  const cameraRearZ = cameraMouth[2];
  // Source Pi CAM/DISP 1: local X=12.33, Y=-19.505, outer Z=5.286.
  // Pi rotation [0,-90,180] maps the mouth normal to +X and its width to -Y.
  const sourceMouth: Vec = [a.piX + 5.286, 19.505, a.piZ + 12.33];
  const sourceNormal: Vec = [1, 0, 0];
  const bend: Vec = [a.piX + 20, 0.5, a.piZ + 41.5];
  const curves: [Cubic, Cubic] = [
    [sourceMouth, add(sourceMouth, [11.6, 0, 0]), sub(bend, [0, 0, 10.1]), bend],
    [
      bend,
      add(bend, [0, 0, 16.2]),
      [cameraMouth[0], cameraMouth[1], cameraRearZ - 14.5],
      [cameraMouth[0], cameraMouth[1], cameraRearZ - 5],
    ],
  ];
  const ribbonWidth = 11.5;
  let freePathLength = 5;
  const edgePathLengths: [number, number] = [5, 5];
  let minBendRadius = Infinity;
  for (const curve of curves) {
    let previous = curve[0];
    let previousEdges: [Vec, Vec] | undefined;
    for (let i = 0; i <= 2048; i++) {
      const sample = cubic(curve, i / 2048);
      const frame = station(sample.point, sample.tangent, cameraRearZ);
      const edges: [Vec, Vec] = [
        add(sample.point, scale(frame.width, ribbonWidth / 2)),
        sub(sample.point, scale(frame.width, ribbonWidth / 2)),
      ];
      if (i > 0) {
        freePathLength += magnitude(sub(sample.point, previous));
        for (const edge of [0, 1] as const)
          edgePathLengths[edge] += magnitude(sub(edges[edge], previousEdges![edge]));
      }
      minBendRadius = Math.min(minBendRadius, sample.bendRadius);
      previous = sample.point;
      previousEdges = edges;
    }
  }
  const stations: Station[] = [];
  for (const [index, curve] of curves.entries())
    for (let i = index ? 1 : 0; i <= 96; i++) {
      const sample = cubic(curve, i / 96);
      stations.push(station(sample.point, sample.tangent, cameraRearZ));
    }
  for (let i = 1; i <= 10; i++)
    stations.push(
      station([cameraMouth[0], cameraMouth[1], cameraRearZ - 5 + i / 2], [0, 0, 1], cameraRearZ),
    );

  // Trim the nonphysical cutter away from both purchased component surfaces. The length
  // budget above still includes the complete mouth-to-rear path and the final 5 mm lead.
  let lower = 0;
  let upper = 0.1;
  for (let i = 0; i < 48; i++) {
    const middle = (lower + upper) / 2;
    if (cubic(curves[0], middle).point[0] < sourceMouth[0] + 0.2) lower = middle;
    else upper = middle;
  }
  const reserveStations: Station[] = [];
  for (let i = 0; i <= 96; i++) {
    const sample = cubic(curves[0], upper + ((1 - upper) * i) / 96);
    reserveStations.push(station(sample.point, sample.tangent, cameraRearZ));
  }
  for (let i = 1; i <= 96; i++) {
    const sample = cubic(curves[1], i / 96);
    reserveStations.push(station(sample.point, sample.tangent, cameraRearZ));
  }
  for (let i = 1; i <= 10; i++)
    reserveStations.push(
      station(
        [cameraMouth[0], cameraMouth[1], cameraRearZ - 5 + (4.8 * i) / 10],
        [0, 0, 1],
        cameraRearZ,
      ),
    );
  const reserveWidth = 12.5;
  const reserveThickness = 1;
  const rings: Vec[][] = reserveStations.map(({ point, width, normal }) =>
    [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ].map(([w, h]) =>
      add(
        add(point, scale(width, (w * reserveWidth) / 2)),
        scale(normal, (h * reserveThickness) / 2),
      ),
    ),
  );
  const availableLength = 100;
  const insertionAllowance = 10;
  const longestEdgeLength = Math.max(...edgePathLengths);
  const centerlineWithEnds = freePathLength + insertionAllowance;
  // A curved and twisted ribbon has different edge lengths. The centreline alone
  // understates this allowance; even the longest edge is not a developability proof.
  const totalLength = Math.max(freePathLength, longestEdgeLength) + insertionAllowance;
  return {
    sourceMouth,
    sourceNormal,
    cameraRearZ,
    cameraBodyRearZ,
    cameraMouth,
    curves,
    availableLength,
    insertionAllowance,
    freePathLength,
    edgePathLengths,
    longestEdgeLength,
    centerlineWithEnds,
    totalLength,
    slack: availableLength - totalLength,
    minBendRadius,
    ribbonWidth,
    reserveWidth,
    reserveThickness,
    points: stations.map(({ point }) => point),
    reservePoints: reserveStations.map(({ point }) => point),
    stations,
    reserveStations,
    rings,
  };
}

/** Rectangular swept clearance including side and thickness allowances. */
export function csiRibbonReserve(p: Parameters): Shape {
  if (isGuided(p)) return guidedCsiReserve(p);
  return hasOV9281(p)
    ? union(...cameraCablePlans(p).map((plan) => ({ kind: 'loft', rings: plan.rings }) as Shape))
    : { kind: 'loft', rings: csiCablePlan(p).rings };
}

/** Separate physical leads with the two actual Pi 5 connector datums. */
export function cameraCablePlans(p: Parameters) {
  if (isGuided(p)) return [guidedCsiPlan(p)];
  if (!hasOV9281(p)) return [{ ...csiCablePlan(p), id: 'camera19', port: 'CAM1' }];
  const a = opticalLayout(p);
  return [
    routedCamera(p, 'ov9281', 1, [a.ov.center[0], 14.5, a.ov.center[2] + 2.8], true),
    ...(a.dual ? [routedCamera(p, 'camera19', 0, [-9.5, -6, a.old.center[2] - 0.5], false)] : []),
  ];
}
function routedCamera(p: Parameters, id: string, port: number, target: Vec, ov: boolean) {
  const sourceMouth: Vec = [-5.914, 19.505, port ? 51.33 : 45.13];
  const bend: Vec = ov ? [7.3, 20, 72] : [8.8, 1, 86];
  const end = add(target, ov ? [0, 3, 0] : [0, 0, -5]);
  const curves: Cubic[] = [
    [sourceMouth, add(sourceMouth, [ov ? 10 : 16, 0, 0]), sub(bend, [0, 0, 10]), bend],
    [bend, add(bend, [0, 0, 15]), add(end, ov ? [0, 10, 0] : [0, 0, -10]), end],
  ];
  const frame = (point: Vec, tangent: Vec) => {
    let u = ov ? Math.max(0, Math.min(1, (point[2] - 85) / (target[2] - 8 - 85))) : 0;
    const angle = (u * u * (3 - 2 * u) * Math.PI) / 2;
    const basis: Vec = [Math.sin(angle), Math.cos(angle), 0];
    const width = unit(sub(basis, scale(tangent, dot(basis, tangent))));
    const cableWidth = ov ? 11.5 + 4.5 * Math.max(0, Math.min(1, (point[2] - 110) / 10)) : 11.5;
    return { point, tangent, width, normal: unit(cross(tangent, width)), cableWidth };
  };
  const lengths = [0, 0, 0];
  let minBendRadius = Infinity;
  for (const curve of curves) {
    let previous: Vec[] = [];
    for (let i = 0; i <= 2048; i++) {
      const sample = cubic(curve, i / 2048),
        f = frame(sample.point, sample.tangent);
      const points = [
        f.point,
        add(f.point, scale(f.width, f.cableWidth / 2)),
        sub(f.point, scale(f.width, f.cableWidth / 2)),
      ];
      if (i) for (let k = 0; k < 3; k++) lengths[k] += magnitude(sub(points[k], previous[k]));
      previous = points;
      minBendRadius = Math.min(minBendRadius, sample.bendRadius);
    }
  }
  const stations = curves.flatMap((curve, k) =>
    Array.from({ length: 97 }, (_, i) => {
      const sample = cubic(curve, i / 96);
      return frame(sample.point, sample.tangent);
    }).slice(k ? 1 : 0),
  );
  for (let i = 1; i <= 10; i++)
    stations.push(frame(add(end, scale(sub(target, end), i / 10)), ov ? [0, -1, 0] : [0, 0, 1]));
  const rings = stations.slice(1, -1).map((f) =>
    [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ].map(([w, h]) =>
      add(add(f.point, scale(f.width, (w * (f.cableWidth + 1)) / 2)), scale(f.normal, h * 0.5)),
    ),
  );
  const lead = ov ? 3 : 5;
  const freePathLength = lengths[0] + lead,
    edgePathLengths = lengths.slice(1).map((v) => v + lead) as [number, number];
  const totalLength = Math.max(freePathLength, ...edgePathLengths) + 10;
  return {
    id,
    port: `CAM${port}`,
    sourceMouth,
    cameraMouth: target,
    curves,
    stations,
    rings,
    availableLength: 100,
    insertionAllowance: 10,
    freePathLength,
    edgePathLengths,
    longestEdgeLength: Math.max(...edgePathLengths),
    centerlineWithEnds: freePathLength + 10,
    totalLength,
    slack: 100 - totalLength,
    minBendRadius,
  };
}
