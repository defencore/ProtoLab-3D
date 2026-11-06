import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { box, union, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { annularSectorPoints } from '../../../core/analytic-geometry';
import { pi5Interface } from '../../raspberry-pi/part';
import { adapterInterface } from '../../waveshare-pcie-m2-d/part';
import camera from '../../board-camera-19/part';
import { ov9281Interface } from '../../waveshare-ov9281-110/part';
import { guidedOptics } from './guided-optics';
import { guidedDatums, guidedLayout, worldPoint, type GuidedPose } from './guided-layout';

export interface GuidedRibbonStation {
  point: Vec;
  tangent: Vec;
  width: Vec;
  normal: Vec;
}

type Line = { kind: 'line'; start: Vec; end: Vec };
type Arc = { kind: 'arc'; center: Vec; radius: number; start: number; end: number };
type PathSegment = Line | Arc;
type Cubic = [Vec, Vec, Vec, Vec];

function worldDirection(local: readonly number[], pose: GuidedPose): Vec {
  return worldPoint(local, { translation: [0, 0, 0], rotation: pose.rotation }).map((value) =>
    Math.abs(value) < 1e-12 ? 0 : value,
  ) as Vec;
}
function worldBounds(bounds: { min: readonly number[]; max: readonly number[] }, pose: GuidedPose) {
  const corners = [bounds.min[0], bounds.max[0]].flatMap((x) =>
    [bounds.min[1], bounds.max[1]].flatMap((y) =>
      [bounds.min[2], bounds.max[2]].map((z) => worldPoint([x, y, z], pose)),
    ),
  );
  return {
    min: [0, 1, 2].map((axis) => Math.min(...corners.map((v) => v[axis]))) as Vec,
    max: [0, 1, 2].map((axis) => Math.max(...corners.map((v) => v[axis]))) as Vec,
  };
}
const backWrapOffset = 0.8;
/** Source connector datums transformed by the same authoritative poses as the installed boards. */
export const guidedRoutingCoordinates = {
  pcie: {
    adapterMouth: worldPoint(adapterInterface.ribbonConnector.mouth, guidedDatums.adapter),
    adapterExit: worldDirection(adapterInterface.ribbonConnector.exit, guidedDatums.adapter),
    boardEdge: worldPoint(
      [adapterInterface.bounds.max[0], adapterInterface.ribbonConnector.mouth[1], -backWrapOffset],
      guidedDatums.adapter,
    ),
    piMouth: worldPoint(pi5Interface.connectors.pcie.mouth, guidedDatums.pi),
    piOutward: worldDirection(pi5Interface.connectors.pcie.exit, guidedDatums.pi),
    piApproach: worldDirection(
      pi5Interface.connectors.pcie.exit.map((v) => -v),
      guidedDatums.pi,
    ),
    width: worldDirection(pi5Interface.connectors.pcie.widthAxis, guidedDatums.pi),
    slotBounds: worldBounds(adapterInterface.ribbonPassage, guidedDatums.adapter),
    backWrapOffset,
  },
  camera: {
    sourceMouth: worldPoint(pi5Interface.connectors.cam1.mouth, guidedDatums.pi),
    sourceNormal: worldDirection(pi5Interface.connectors.cam1.exit, guidedDatums.pi),
    sourceWidth: worldDirection(pi5Interface.connectors.cam1.widthAxis, guidedDatums.pi),
    cameraApproach: [0, 0, 1] as Vec,
    cameraWidth: [1, 0, 0] as Vec,
  },
};

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (v: Vec, k: number): Vec => [v[0] * k, v[1] * k, v[2] * k];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const magnitude = (v: Vec) => Math.hypot(...v);
const unit = (v: Vec): Vec => {
  const length = magnitude(v);
  if (!(length > 1e-12)) throw new Error('A guided cable tangent must have positive length.');
  return scale(v, 1 / length);
};

function ring(station: GuidedRibbonStation, width: number, thickness: number): Vec[] {
  return [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].map(([w, h]) =>
    add(
      add(station.point, scale(station.width, (w * width) / 2)),
      scale(station.normal, (h * thickness) / 2),
    ),
  );
}
function linear(start: Vec, end: Vec): Line {
  return { kind: 'line', start, end };
}
function sampleSegment(segment: PathSegment, t: number): GuidedRibbonStation {
  let point: Vec, tangent: Vec;
  if (segment.kind === 'line') {
    tangent = unit(sub(segment.end, segment.start));
    point = add(segment.start, scale(sub(segment.end, segment.start), t));
  } else {
    const angle = segment.start + (segment.end - segment.start) * t;
    const direction = Math.sign(segment.end - segment.start);
    point = add(segment.center, [
      segment.radius * Math.cos(angle),
      0,
      segment.radius * Math.sin(angle),
    ]);
    tangent = [-Math.sin(angle) * direction, 0, Math.cos(angle) * direction];
  }
  // The measured 0.005 mm final lateral drift is retained, rather than rounded out.
  // Constant Y width keeps the two purchased socket width datums explicit.
  const width: Vec = [0, 1, 0];
  return { point, tangent, width, normal: unit(cross(tangent, width)) };
}
const segmentLength = (s: PathSegment) =>
  s.kind === 'line' ? magnitude(sub(s.end, s.start)) : s.radius * Math.abs(s.end - s.start);
function segmentStations(segments: PathSegment[], steps = 64) {
  return segments.flatMap((s, index) =>
    Array.from({ length: steps + 1 }, (_, i) => sampleSegment(s, i / steps)).slice(index ? 1 : 0),
  );
}
function pcieSegments() {
  const a = guidedRoutingCoordinates.pcie;
  const radius = (a.boardEdge[0] - a.adapterMouth[0]) / 2;
  const startZ = a.slotBounds.min[2];
  const first = [a.adapterMouth[0], a.adapterMouth[1], startZ] as Vec;
  const arcX = first[0] + radius,
    secondZ = startZ + 2 * radius;
  const freeRadius = a.piMouth[2] - a.boardEdge[2];
  if (!(radius > 0.5 && freeRadius > 0.5 && a.piMouth[0] > a.boardEdge[0] + freeRadius))
    throw new Error('The guided PCIe routing needs positive slot and free-span bend clearances.');
  const onboard: PathSegment[] = [
    linear(a.adapterMouth, first),
    { kind: 'arc', center: [arcX, first[1], startZ], radius, start: Math.PI, end: Math.PI / 2 },
    { kind: 'arc', center: [arcX, first[1], secondZ], radius, start: -Math.PI / 2, end: 0 },
    linear([a.boardEdge[0], first[1], secondZ], a.boardEdge),
  ];
  const free: PathSegment[] = [
    {
      kind: 'arc',
      center: [a.boardEdge[0] + freeRadius, a.boardEdge[1], a.boardEdge[2]],
      radius: freeRadius,
      start: Math.PI,
      end: Math.PI / 2,
    },
    linear([a.boardEdge[0] + freeRadius, a.boardEdge[1], a.piMouth[2]], a.piMouth),
  ];
  return { onboard, free };
}

/** The 27 mm adapter-side budget is measured, not an invented adapter insertion depth. */
export function guidedPciePlan(_p: Parameters) {
  const { onboard, free } = pcieSegments();
  const segments = [...onboard, ...free];
  const modelledOnboardLength = onboard.reduce((sum, s) => sum + segmentLength(s), 0);
  const measuredOnboardBudget = 27;
  const measuredFreeLength = 13;
  const piInsertionAllowance = 2.5;
  const freePathLength = free.reduce((sum, s) => sum + segmentLength(s), 0);
  const freeLengthWithInsertion = freePathLength + piInsertionAllowance;
  const measuredOnboardAllowance = measuredOnboardBudget - modelledOnboardLength;
  const stations = segmentStations(segments);
  const reserveWidth = 9.5,
    reserveThickness = 1,
    ribbonWidth = 8.5;
  const reserveSegments: PathSegment[] = segments.map((s) =>
    s.kind === 'line'
      ? { ...s, start: [...s.start], end: [...s.end] }
      : { ...s, center: [...s.center] },
  );
  const first = reserveSegments[0] as Line,
    last = reserveSegments.at(-1) as Line;
  first.start = add(first.start, scale(unit(sub(first.end, first.start)), 0.2));
  last.end = sub(last.end, scale(unit(sub(last.end, last.start)), 0.2));
  const reserveStations = segmentStations(reserveSegments);
  const modelledPathLength = modelledOnboardLength + freePathLength;
  const totalLength = measuredOnboardBudget + freeLengthWithInsertion;
  return {
    id: 'pcie',
    port: 'PCIe',
    sourceMouth: [...guidedRoutingCoordinates.pcie.adapterMouth] as Vec,
    sourceNormal: [...guidedRoutingCoordinates.pcie.adapterExit] as Vec,
    adapterMouth: [...guidedRoutingCoordinates.pcie.adapterMouth] as Vec,
    piMouth: [...guidedRoutingCoordinates.pcie.piMouth] as Vec,
    boardEdge: [...guidedRoutingCoordinates.pcie.boardEdge] as Vec,
    piApproach: [...guidedRoutingCoordinates.pcie.piApproach] as Vec,
    availableLength: 40,
    measuredOnboardBudget,
    measuredFreeLength,
    modelledOnboardLength,
    measuredOnboardAllowance,
    adapterInsertionDepth: null,
    piInsertionAllowance,
    insertionAllowance: piInsertionAllowance,
    freePathLength,
    freeLengthWithInsertion,
    modelledPathLength,
    edgePathLengths: [modelledPathLength, modelledPathLength] as [number, number],
    freeEdgePathLengths: [freePathLength, freePathLength] as [number, number],
    longestEdgeLength: modelledPathLength,
    centerlineWithEnds: totalLength,
    totalLength,
    slack: 40 - totalLength,
    freeSlack: measuredFreeLength - freeLengthWithInsertion,
    minBendRadius: Math.min(
      ...segments.filter((s): s is Arc => s.kind === 'arc').map((s) => s.radius),
    ),
    minFreeBendRadius: (free[0] as Arc).radius,
    lateralDrift: Math.abs(
      guidedRoutingCoordinates.pcie.piMouth[1] - guidedRoutingCoordinates.pcie.boardEdge[1],
    ),
    finalApproachYawDegrees:
      (Math.atan2(
        Math.abs(
          guidedRoutingCoordinates.pcie.piMouth[1] - guidedRoutingCoordinates.pcie.boardEdge[1],
        ),
        (free[1] as Line).end[0] - (free[1] as Line).start[0],
      ) *
        180) /
      Math.PI,
    ribbonWidth,
    reserveWidth,
    reserveThickness,
    segments,
    onboardSegments: onboard,
    freeSegments: free,
    reserveSegments,
    points: stations.map((s) => s.point),
    stations,
    reservePoints: reserveStations.map((s) => s.point),
    reserveStations,
    rings: reserveStations.map((s) => ring(s, reserveWidth, reserveThickness)),
    assumptions: [
      '40 mm total lead and 13 mm protrusion beyond the connected adapter board are user measurements.',
      'The residual measured adapter-side allowance is not an identified connector insertion depth.',
      'Pi insertion allowance is 2.5 mm; the actual contact insertion and permitted bend radii need verification.',
      'The two socket Y datums differ by 0.005 mm; this drift remains in the final lead geometry.',
    ],
  };
}

/** A circular strip in X/Z, extruded along Y; native CAD retains the exact circular surfaces. */
function arcReserve(segment: Arc, width: number, thickness: number): Shape {
  const profile = {
    kind: 'annular-sector' as const,
    inner: segment.radius - thickness / 2,
    outer: segment.radius + thickness / 2,
    start: (Math.min(segment.start, segment.end) * 180) / Math.PI,
    end: (Math.max(segment.start, segment.end) * 180) / Math.PI,
    z: 0,
    depth: width,
  };
  const child: Shape = {
    kind: 'prism',
    points: annularSectorPoints(profile),
    depth: width,
    origin: 0,
    axis: 'z',
    native: profile,
  };
  return {
    kind: 'transform',
    child,
    translation: [segment.center[0], width / 2, segment.center[2]],
    rotation: [90, 0, 0],
  };
}
function lineReserve(segment: Line, width: number, thickness: number): Shape {
  return {
    kind: 'loft',
    rings: [
      ring(sampleSegment(segment, 0), width, thickness),
      ring(sampleSegment(segment, 1), width, thickness),
    ],
  };
}
/** Reserve excludes the two connector interiors but includes the adapter PCB-slot passage. */
export function guidedPcieReserve(p: Parameters): Shape {
  const plan = guidedPciePlan(p);
  const shapes = plan.reserveSegments.map((segment) =>
    segment.kind === 'arc'
      ? arcReserve(segment, plan.reserveWidth, plan.reserveThickness)
      : lineReserve(segment, plan.reserveWidth, plan.reserveThickness),
  );
  // Small tangent overlaps avoid face-only joins after Float32 preview conversion.
  for (let i = 0; i < plan.reserveSegments.length - 1; i++) {
    const a = sampleSegment(plan.reserveSegments[i], 1);
    const b: Line = {
      kind: 'line',
      start: sub(a.point, scale(a.tangent, 0.01)),
      end: add(a.point, scale(a.tangent, 0.01)),
    };
    shapes.push(lineReserve(b, plan.reserveWidth, plan.reserveThickness));
  }
  return union(...shapes);
}

function cubic(curve: Cubic, t: number) {
  const [a, b, c, d] = curve,
    u = 1 - t;
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
function cameraFrame(point: Vec, tangent: Vec, front: number): GuidedRibbonStation {
  const u = Math.max(0, Math.min(1, (point[2] - 91) / (front - 5 - 91)));
  const angle = (u * u * (3 - 2 * u) * Math.PI) / 2;
  const basis: Vec = [Math.sin(angle), Math.cos(angle), 0];
  const width = unit(sub(basis, scale(tangent, dot(basis, tangent))));
  return { point, tangent, width, normal: unit(cross(tangent, width)) };
}

/** 100 mm source-to-camera routing allowance; geometric edge lengths are not a flex-fatigue proof. */
function guidedCamera19CsiPlan(p: Parameters) {
  const sourceMouth = guidedRoutingCoordinates.camera.sourceMouth;
  const cameraPose = guidedLayout(p).camera;
  const cameraBodyRearZ = cameraPose.translation[2];
  const cameraPreset = camera.presets.find((preset) => preset.id === 'imx577-19x19-rear-mipi-m25');
  if (!cameraPreset) throw new Error('The rear-MIPI 19 mm camera execution is missing.');
  const cp = cameraPreset.parameters;
  const cameraMouth = worldPoint(
    [
      n(cp, 'bodyWidth') / 2 - n(cp, 'rearConnectorRightInset') - n(cp, 'rearConnectorWidth') / 2,
      n(cp, 'bodyHeight') / 2 - n(cp, 'rearConnectorTopInset') - n(cp, 'rearConnectorHeight') / 2,
      -n(cp, 'rearConnectorProjection'),
    ],
    cameraPose,
  );
  const rear = cameraMouth[2],
    bend: Vec = [-14, -5, 78],
    upper: Vec = [-14, 1, 92];
  const approach: Vec = [cameraMouth[0], cameraMouth[1], rear - 5];
  const curves: Cubic[] = [
    [sourceMouth, add(sourceMouth, [-16, 0, 0]), sub(bend, [0, 0, 10]), bend],
    [bend, add(bend, [0, 0, 5.5]), sub(upper, [0, 0, 5.5]), upper],
    [upper, add(upper, [0, 0, 10]), sub(approach, [0, 0, 11]), approach],
  ];
  const ribbonWidth = 11.5,
    reserveWidth = 12.5,
    reserveThickness = 1;
  const lengths = [5, 5, 5];
  let minBendRadius = Infinity;
  let minimumLongitudinalEdgeFactor = Infinity,
    minimumReserveLongitudinalFactor = Infinity;
  for (const curve of curves) {
    let previous: Vec[] = [];
    let previousFrame: GuidedRibbonStation | undefined;
    for (let i = 0; i <= 2048; i++) {
      const sample = cubic(curve, i / 2048),
        f = cameraFrame(sample.point, sample.tangent, rear);
      const points = [
        f.point,
        add(f.point, scale(f.width, ribbonWidth / 2)),
        sub(f.point, scale(f.width, ribbonWidth / 2)),
      ];
      if (i) {
        for (let k = 0; k < 3; k++) lengths[k] += magnitude(sub(points[k], previous[k]));
        const ds = magnitude(sub(f.point, previousFrame!.point));
        const turning =
          Math.abs(
            dot(sub(f.width, previousFrame!.width), unit(add(f.tangent, previousFrame!.tangent))),
          ) / ds;
        minimumLongitudinalEdgeFactor = Math.min(
          minimumLongitudinalEdgeFactor,
          1 - (turning * ribbonWidth) / 2,
        );
        minimumReserveLongitudinalFactor = Math.min(
          minimumReserveLongitudinalFactor,
          1 - (turning * reserveWidth) / 2,
        );
      }
      previous = points;
      previousFrame = f;
      minBendRadius = Math.min(minBendRadius, sample.bendRadius);
    }
  }
  const stations = curves.flatMap((curve, k) =>
    Array.from({ length: 65 }, (_, i) => {
      const sample = cubic(curve, i / 64);
      return cameraFrame(sample.point, sample.tangent, rear);
    }).slice(k ? 1 : 0),
  );
  for (let i = 1; i <= 10; i++)
    stations.push(cameraFrame(add(approach, [0, 0, i / 2]), [0, 0, 1], rear));
  // Keep the reserve 0.2 mm outside both purchased connector mouths.
  let low = 0,
    high = 0.1;
  for (let i = 0; i < 48; i++) {
    const middle = (low + high) / 2;
    if (cubic(curves[0], middle).point[0] > sourceMouth[0] - 0.2) low = middle;
    else high = middle;
  }
  const reserveStations = curves.flatMap((curve, k) =>
    Array.from({ length: 65 }, (_, i) => {
      const t = k ? i / 64 : high + ((1 - high) * i) / 64;
      const sample = cubic(curve, t);
      return cameraFrame(sample.point, sample.tangent, rear);
    }).slice(k ? 1 : 0),
  );
  for (let i = 1; i <= 10; i++)
    reserveStations.push(cameraFrame(add(approach, [0, 0, (4.8 * i) / 10]), [0, 0, 1], rear));
  const freePathLength = lengths[0],
    edgePathLengths = lengths.slice(1) as [number, number];
  const longestEdgeLength = Math.max(...edgePathLengths),
    insertionAllowance = 10;
  const totalLength = Math.max(freePathLength, longestEdgeLength) + insertionAllowance;
  return {
    id: 'camera19',
    port: 'CAM1',
    sourceMouth: [...sourceMouth] as Vec,
    sourceNormal: [...guidedRoutingCoordinates.camera.sourceNormal] as Vec,
    cameraBodyRearZ,
    cameraRearZ: rear,
    cameraMouth,
    curves,
    availableLength: 100,
    insertionAllowance,
    freePathLength,
    edgePathLengths,
    longestEdgeLength,
    centerlineWithEnds: freePathLength + insertionAllowance,
    totalLength,
    slack: 100 - totalLength,
    minBendRadius,
    minimumLongitudinalEdgeFactor,
    minimumReserveLongitudinalFactor,
    ribbonWidth,
    reserveWidth,
    reserveThickness,
    points: stations.map((s) => s.point),
    stations,
    reservePoints: reserveStations.map((s) => s.point),
    reserveStations,
    rings: reserveStations.map((s) => ring(s, reserveWidth, reserveThickness)),
    assumptions: [
      'Camera rear latch and side-mount geometry follow the existing user-described 19 mm reference.',
      'The 11.5 mm ribbon width and 10 mm combined connector allowance are routing assumptions.',
      'Positive longitudinal edge factors screen out a locally reversing inner edge; they do not establish ribbon developability.',
      'The 90 degree width change reserves geometric clearance; actual developability, bends and cable fatigue need qualification.',
    ],
  };
}
/** Source-specific lead selection: original camera 100 mm, OV9281 150 mm. */
export function guidedCsiPlan(p: Parameters) {
  return p.cameraSetup === 'ov9281' ? guidedOv9281CsiPlan(p) : guidedCamera19CsiPlan(p);
}
export function guidedCsiReserve(p: Parameters): Shape {
  const plan = guidedCsiPlan(p);
  if (p.cameraSetup === 'ov9281') {
    // Local lofts retain bounded native surfaces through the distinct twist regimes.
    // A single global OCC interpolation can overshoot far beyond the source sections.
    const chunks: Shape[] = [];
    for (let i = 0; i < plan.rings.length - 1; i += 16)
      chunks.push({
        kind: 'smooth-loft',
        sections: plan.rings.slice(i, i + 17).map((ring) => ({
          segments: ring.map((point, j) => ({
            kind: 'line' as const,
            points: [point, ring[(j + 1) % ring.length]],
          })),
        })),
      });
    return { kind: 'union', children: [...chunks, guidedCsiParkingReserve(p)], nativeBatch: true };
  }
  return { kind: 'loft', rings: plan.rings };
}
/** Both removable camera cartridges fit the same manufactured cage and cable corridor. */
export function guidedCsiMountingReserves(p: Parameters): Shape[] {
  return [
    guidedCsiReserve({ ...p, cameraSetup: 'camera-19' }),
    guidedCsiReserve({ ...p, cameraSetup: 'ov9281' }),
    guidedCsiParkingClearance(p),
  ];
}
export function guidedCsiMountingReserve(p: Parameters): Shape {
  return union(...guidedCsiMountingReserves(p));
}

/** Gross parking volume for the longer OV lead; no purchased cable geometry is invented. */
export function guidedCsiParkingReserve(p: Parameters): Shape {
  const front = guidedOptics({ ...p, cameraSetup: 'camera-19' }).rearStopBack - 0.2;
  return box([12, 17, 14], [-20.1, -9.25, front - 14]);
}
/** The wider open manufacturing relief removes the rear-shoe feather beside the parked coil. */
export function guidedCsiParkingClearance(p: Parameters): Shape {
  const front = guidedOptics({ ...p, cameraSetup: 'camera-19' }).rearStopBack - 0.2;
  return box([12, 18.5, 14], [-20.1, -10, front - 14]);
}

/** Source-port-cleared route with a controlled camera-end bend and explicit surplus parking. */
function guidedOv9281CsiPlan(p: Parameters) {
  const optics = guidedOptics({ ...p, cameraSetup: 'ov9281' });
  const pose: GuidedPose = { translation: optics.translation, rotation: optics.rotation };
  const sourceMouth = guidedRoutingCoordinates.camera.sourceMouth;
  const cameraMouth = worldPoint(ov9281Interface.connector.mouth, pose);
  const cameraOutward = worldDirection(ov9281Interface.connector.exit, pose);
  const cameraApproach = scale(cameraOutward, -1);
  const bend: Vec = [-14, -5, 78],
    upper: Vec = [-14, 1, 92];
  const endRadius = 2;
  const approach = add(cameraMouth, [0, endRadius, -endRadius]);
  const k = endRadius * 0.5522847498307936;
  const curves: Cubic[] = [
    [sourceMouth, add(sourceMouth, [-16, 0, 0]), sub(bend, [0, 0, 10]), bend],
    [bend, add(bend, [0, 0, 5.5]), sub(upper, [0, 0, 5.5]), upper],
    [upper, add(upper, [0, 0, 10]), sub(approach, [0, 0, 10]), approach],
    [approach, add(approach, [0, 0, k]), add(cameraMouth, [0, k, 0]), cameraMouth],
  ];
  const ribbonWidths = [11.5, 16] as const,
    reserveThickness = 1;
  const widthAt = (point: Vec) =>
    ribbonWidths[0] +
    (ribbonWidths[1] - ribbonWidths[0]) *
      Math.max(0, Math.min(1, (point[2] - upper[2]) / (cameraMouth[2] - upper[2])));
  const frameAt = (curve: Cubic, t: number) => {
    const sample = cubic(curve, t);
    return cameraFrame(sample.point, sample.tangent, Math.min(cameraMouth[2] + 1, upper[2] + 23));
  };
  const edgePathLengths: [number, number] = [0, 0];
  let freePathLength = 0,
    minBendRadius = Infinity;
  let minimumLongitudinalEdgeFactor = Infinity,
    minimumReserveLongitudinalFactor = Infinity;
  for (const curve of curves) {
    let previous: GuidedRibbonStation | undefined;
    for (let i = 0; i <= 2048; i++) {
      const t = i / 2048,
        sample = cubic(curve, t),
        current = frameAt(curve, t);
      minBendRadius = Math.min(minBendRadius, sample.bendRadius);
      if (previous) {
        const ds = magnitude(sub(current.point, previous.point));
        freePathLength += ds;
        const width = widthAt(current.point),
          previousWidth = widthAt(previous.point);
        for (const [index, sign] of [
          [0, 1],
          [1, -1],
        ] as const)
          edgePathLengths[index] += magnitude(
            sub(
              add(current.point, scale(current.width, (sign * width) / 2)),
              add(previous.point, scale(previous.width, (sign * previousWidth) / 2)),
            ),
          );
        const turning =
          Math.abs(
            dot(sub(current.width, previous.width), unit(add(current.tangent, previous.tangent))),
          ) / ds;
        minimumLongitudinalEdgeFactor = Math.min(
          minimumLongitudinalEdgeFactor,
          1 - (turning * width) / 2,
        );
        minimumReserveLongitudinalFactor = Math.min(
          minimumReserveLongitudinalFactor,
          1 - (turning * (width + 1)) / 2,
        );
      }
      previous = current;
    }
  }
  let low = 0,
    high = 0.1;
  for (let i = 0; i < 48; i++) {
    const t = (low + high) / 2;
    if (cubic(curves[0], t).point[0] > sourceMouth[0] - 0.2) low = t;
    else high = t;
  }
  const reserveStart = high;
  low = 0.9;
  high = 1;
  for (let i = 0; i < 48; i++) {
    const t = (low + high) / 2;
    if (dot(sub(cubic(curves.at(-1)!, t).point, cameraMouth), cameraOutward) > 0.2) low = t;
    else high = t;
  }
  const reserveEnd = low;
  const stations = curves.flatMap((curve, index) =>
    Array.from({ length: 65 }, (_, i) => frameAt(curve, i / 64)).slice(index ? 1 : 0),
  );
  const reserveStations = curves.flatMap((curve, index) => {
    const start = index === 0 ? reserveStart : 0,
      end = index === curves.length - 1 ? reserveEnd : 1;
    return Array.from({ length: 65 }, (_, i) =>
      frameAt(curve, start + ((end - start) * i) / 64),
    ).slice(index ? 1 : 0);
  });
  const longestEdgeLength = Math.max(...edgePathLengths),
    insertionAllowance = 10;
  const totalLength = Math.max(freePathLength, longestEdgeLength) + insertionAllowance;
  const availableLength = 150;
  const parkingFront = guidedOptics({ ...p, cameraSetup: 'camera-19' }).rearStopBack - 0.2;
  return {
    id: 'ov9281',
    port: 'CAM1',
    sourceMouth: [...sourceMouth] as Vec,
    sourceNormal: [...guidedRoutingCoordinates.camera.sourceNormal] as Vec,
    cameraBodyRearZ: optics.rear,
    cameraRearZ: cameraMouth[2],
    cameraMouth,
    cameraApproach,
    cameraWidth: [1, 0, 0] as Vec,
    curves,
    availableLength,
    requestedLength: 100,
    requiresLongerLead: totalLength > 100,
    insertionAllowance,
    freePathLength,
    edgePathLengths,
    longestEdgeLength,
    centerlineWithEnds: freePathLength + insertionAllowance,
    totalLength,
    minimumRequiredLength: totalLength,
    slack: availableLength - totalLength,
    requestedLengthShortfall: Math.max(0, totalLength - 100),
    minBendRadius,
    minimumLongitudinalEdgeFactor,
    minimumReserveLongitudinalFactor,
    ribbonWidth: 16,
    ribbonWidths,
    reserveWidth: 17,
    reserveThickness,
    points: stations.map((s) => s.point),
    stations,
    reservePoints: reserveStations.map((s) => s.point),
    reserveStations,
    rings: reserveStations.map((s) => ring(s, widthAt(s.point) + 1, reserveThickness)),
    parking: {
      envelope: {
        min: [-20.1, -9.25, parkingFront - 14] as Vec,
        max: [-8.1, 7.75, parkingFront] as Vec,
      },
      center: [-14.1, -0.75, parkingFront - 7] as Vec,
      widthAxis: [0, 1, 0] as Vec,
      coilPlane: 'XZ',
      manufacturingRelief: {
        min: [-20.1, -10, parkingFront - 14] as Vec,
        max: [-8.1, 8.5, parkingFront] as Vec,
      },
      innerRadius: 3,
      outerRadius: 5.5,
      nominalRibbonWidth: 16,
      reservedMaterialLength: 60,
      maximumGrossThickness: 1,
      minimumMaterialLength: availableLength - insertionAllowance - longestEdgeLength,
      centerlineMaterialLength: availableLength - insertionAllowance - freePathLength,
      maximumMaterialLengthWithoutInsertion: availableLength - freePathLength,
      scope:
        'Gross parking envelope for the delivered service coil, not a prequalified manufactured spiral or bend rating.',
    },
    assumptions: [
      'OV9281 and Pi CAM1 connector references follow their source interfaces; actual insertion depths remain unknown.',
      'The source-port prefix retains 11.5 mm ribbon width; the upper leg widens to 16 mm at the camera. Delivered cable shoulder geometry must be checked.',
      'The 10 mm combined insertion allowance, 1 mm clearance increment and 1 mm reserve thickness are authored installation allowances.',
      'The source-port detour and early width transition require more than 100 mm including ends; select a 150 mm lead rather than cross the Pi ports or thin the cage root.',
      'The surplus is assigned to the explicit 12 by 17 by 14 mm service-coil parking envelope; the wider 18.5 mm manufacturing relief is separate; its 60 mm gross capacity covers the modeled residual and insertion uncertainty.',
      'A 3 to 5.5 mm radial coil with up to 1 mm gross thickness fits the parking allowance geometrically; actual cable folding, retention and bend fatigue require delivered-harness fitting.',
      'Positive longitudinal edge factors reject local reversal; they do not establish ribbon developability or supplier-approved bend radius.',
    ],
  };
}
