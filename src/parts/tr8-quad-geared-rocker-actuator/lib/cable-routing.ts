import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import { box, cylinder, union, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import {
  fixed as f,
  enclosureDiameter,
  channelTransform,
  sourceTransform,
  endDiscWireStations,
} from './layout';

export interface CableRoute {
  id: string;
  kind: 'motor' | 'reserve';
  upper: boolean;
  portId: string;
  endpointRole: string;
  centerline: Vec[];
  segmentLengths: number[];
  grooveRadius: number;
  clearanceProbeRadius: number;
  centerlineBlendRadius: number;
}
const vector = (p: Vec) => new Vector3(...p);
const xyz = (p: Vector3) => p.toArray() as Vec;
const rotate = (p: Vec, q: number): Vec =>
  xyz(vector(p).applyAxisAngle(new Vector3(0, 0, 1), (q * Math.PI) / 2));
function placed(shape: Shape, frame: Matrix4): Shape {
  const e = new Euler().setFromRotationMatrix(frame, 'ZYX');
  return {
    kind: 'transform',
    child: shape,
    translation: xyz(new Vector3().setFromMatrixPosition(frame)),
    rotation: [e.x, e.y, e.z].map((a) => {
      const degrees = (a * 180) / Math.PI;
      const cardinal = Math.round(degrees / 90) * 90;
      // Quaternion roundoff near 90° creates unstable sphere/cylinder seam cuts.
      return Math.abs(degrees - cardinal) < 1e-5 ? cardinal || 0 : degrees;
    }) as Vec,
  };
}
function pipe(a: Vec, b: Vec, radius: number): Shape {
  const direction = vector(b).sub(vector(a)),
    length = direction.length();
  const frame = new Matrix4()
    .makeRotationFromQuaternion(
      new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction.normalize()),
    )
    .setPosition(vector(a));
  return placed(cylinder(radius, length, [0, 0, 0]), frame);
}
function route(
  id: string,
  kind: CableRoute['kind'],
  upper: boolean,
  portId: string,
  endpointRole: string,
  centerline: Vec[],
  grooveRadius: number,
): CableRoute {
  return {
    id,
    kind,
    upper,
    portId,
    endpointRole,
    centerline,
    segmentLengths: centerline.slice(1).map((p, i) => vector(p).distanceTo(vector(centerline[i]))),
    grooveRadius,
    clearanceProbeRadius: kind === 'motor' ? 3.5 : 2,
    centerlineBlendRadius: kind === 'motor' ? 2 : 1,
  };
}
/** Route sizing is fixed by motor family and the real end-disc interface, never by pose. */
export function cableRouting(p: Parameters = {}) {
  const large = String(p.motor ?? 'surpass-2838-3700kv').startsWith('surpass-2845-');
  const motorLength = large ? 47 : 40,
    outerRadius = enclosureDiameter(p) / 2;
  const endZ = f.panelHigh - f.endTongueLength - 0.2;
  const ports = endDiscWireStations();
  const reserveRadius = 2.2,
    reserveT = 5,
    outsideLand = 1.2;
  const reserveMajorFrom = Math.max(f.channelRadius + 14 + 0.3, motorLength - 15.5 + 0.3);
  const reserveCenterFrom = reserveMajorFrom + reserveRadius;
  const reserveCenterTo = Math.sqrt(
    (outerRadius - outsideLand - reserveRadius) ** 2 - reserveT ** 2,
  );
  const reserveMajorTo = reserveCenterTo + reserveRadius;
  const reserveMajor = (reserveCenterFrom + reserveCenterTo) / 2;
  const transitionMajor = Math.min(
    reserveMajor,
    Math.sqrt((outerRadius - outsideLand - reserveRadius) ** 2 - 13 ** 2),
  );
  const routes: CableRoute[] = [];
  const collectors: {
    id: string;
    channelIndex: number;
    frame: number[];
    sourceCenter: Vec;
    radius: number;
    axialFrom: number;
    axialTo: number;
  }[] = [];
  for (let i = 0; i < 4; i++) {
    const frame = channelTransform(i).multiply(sourceTransform(i % 2 === 0));
    const inboardZ = i % 2 === 0 ? 8.6 : -8.6;
    const start = xyz(new Vector3(motorLength + 5, f.motorSpacing, inboardZ).applyMatrix4(frame));
    const upper = start[2] > 0,
      sign = upper ? 1 : -1;
    const port = ports
      .filter((s) => s.upper === upper)
      .sort(
        (a, b) =>
          Math.hypot(a.innerPoint[0] - start[0], a.innerPoint[1] - start[1]) -
          Math.hypot(b.innerPoint[0] - start[0], b.innerPoint[1] - start[1]),
      )[0];
    const normalCoordinate = Math.abs(start[0]) > Math.abs(start[1]) ? 0 : 1;
    const transverse = normalCoordinate === 0 ? 1 : 0;
    const crossed = [...start] as Vec;
    crossed[transverse] = 0.4 * port.innerPoint[transverse];
    crossed[2] = sign * 47.5;
    const clearedHub = [...start] as Vec;
    clearedHub[transverse] = port.innerPoint[transverse];
    clearedHub[2] = sign * 54;
    const approach = [port.innerPoint[0], port.innerPoint[1], sign * 57] as Vec;
    routes.push(
      route(
        `motor-${'abcd'[i]}`,
        'motor',
        upper,
        port.id,
        'Inboard rear lead collector to end port',
        [
          start,
          [start[0], start[1], sign * 47.5],
          crossed,
          clearedHub,
          approach,
          [port.innerPoint[0], port.innerPoint[1], sign * endZ],
        ],
        4,
      ),
    );
    collectors.push({
      id: `motor-${'abcd'[i]}-collector`,
      channelIndex: i,
      frame: frame.toArray(),
      sourceCenter: [motorLength, f.motorSpacing, inboardZ],
      radius: 7.5,
      axialFrom: motorLength + 0.1,
      axialTo: motorLength + 6.5,
    });
  }
  for (const port of ports) {
    const sign = port.upper ? 1 : -1;
    const q =
      ((Math.round(Math.atan2(port.innerPoint[1], port.innerPoint[0]) / (Math.PI / 2)) % 4) + 4) %
      4;
    const localPort = rotate(port.innerPoint, -q);
    const points: Vec[] = [
      [21, 13, sign * 5],
      [transitionMajor, 13, sign * 5],
      [transitionMajor, 11, sign * 11],
      [reserveMajor, reserveT, sign * 13.5],
      [reserveMajor, reserveT, sign * 53],
      [reserveMajor, localPort[1], sign * 56],
      [localPort[0], localPort[1], sign * (endZ - 0.4)],
      [localPort[0], localPort[1], sign * endZ],
    ];
    routes.push(
      route(
        `reserve-${port.id}`,
        'reserve',
        port.upper,
        port.id,
        'Removable-cover inner service pocket; no passage across the Z0 stand-shank barrier',
        points.map((point) => rotate(point, q)),
        reserveRadius,
      ),
    );
  }
  return {
    motorLength,
    outerDiameter: 2 * outerRadius,
    endZ,
    motorExitSource:
      'Supplier installation model omits free leads, rear boot and exit clock. Clock the purchased motor so its leads enter the inboard rear collector; confirm the actual boot before printing.',
    motorCollectorRadius: 7.5,
    motorGrooveRadius: 4,
    reserve: {
      count: 8,
      minorWidth: 2 * reserveRadius,
      routeProbeRadius: 2,
      entryNeckDiameter: 2 * reserveRadius,
      majorWidth: reserveMajorTo - reserveMajorFrom,
      majorFrom: reserveMajorFrom,
      majorTo: reserveMajorTo,
      centerFrom: reserveCenterFrom,
      centerTo: reserveCenterTo,
      transverseCenter: reserveT,
      transitionMajor,
      minimumExteriorLand: outsideLand,
      servicePocketT: 13,
      servicePocketZ: 5,
      wideSlotFromZ: 13.5,
      endMergeFromZ: 55.5,
      endMergeTangentialClearance: 0.3,
      splitAtWaist: true,
    },
    portBoreDiameter: f.endWireHoleDiameter,
    portCollector: {
      mouthRadius: f.endWireHoleDiameter / 2 + 0.3,
      neckRadius: reserveRadius,
      depth: 6,
    },
    capacity:
      'Geometric routing reservations only. No wire count, cable gauge or connector passage is certified; the real lead boot, bend specification and shared end-port packing must be checked.',
    collectors,
    ports,
    routes,
  };
}
/** Elementary route cutters avoid coincident seam failures in a pre-fused tool. */
export function cableRoutePrimitives(record: CableRoute, radius = record.grooveRadius): Shape[] {
  const chain: Shape[] = [];
  for (let i = 0; i < record.centerline.length; i++) {
    chain.push({ kind: 'sphere', radius, origin: record.centerline[i] });
    if (i + 1 < record.centerline.length)
      chain.push(pipe(record.centerline[i], record.centerline[i + 1], radius));
  }
  return chain;
}
/** Virtual union envelope; actual PETG machining subtracts each primitive separately. */
export function cableRouteTool(record: CableRoute, radius = record.grooveRadius): Shape {
  return union(...cableRoutePrimitives(record, radius));
}
export function cableRoutingCuts(p: Parameters = {}): Shape[] {
  const data = cableRouting(p),
    cuts: Shape[] = data.routes.flatMap((r) => cableRoutePrimitives(r));
  for (const c of data.collectors)
    cuts.push(
      placed(
        cylinder(
          c.radius,
          c.axialTo - c.axialFrom,
          [c.axialFrom, c.sourceCenter[1], c.sourceCenter[2]],
          'x',
        ),
        new Matrix4().fromArray(c.frame),
      ),
    );
  for (const port of data.ports) {
    const sign = port.upper ? 1 : -1;
    const shape: Shape = {
      kind: 'revolve',
      profile: [
        [0, 0],
        [data.portCollector.neckRadius, 0],
        [data.portCollector.mouthRadius, data.portCollector.depth],
        [0, data.portCollector.depth],
      ],
    };
    cuts.push({
      kind: 'transform',
      child: shape,
      translation: [
        port.innerPoint[0],
        port.innerPoint[1],
        sign * (data.endZ - data.portCollector.depth),
      ],
      rotation: [port.upper ? 0 : 180, 0, 0],
    });
    const q =
      ((Math.round(Math.atan2(port.innerPoint[1], port.innerPoint[0]) / (Math.PI / 2)) % 4) + 4) %
      4;
    const height = data.endZ - data.reserve.wideSlotFromZ;
    const z = port.upper ? data.reserve.wideSlotFromZ : -data.endZ;
    const slot = union(
      cylinder(2.2, height, [data.reserve.centerFrom, data.reserve.transverseCenter, z]),
      cylinder(2.2, height, [data.reserve.centerTo, data.reserve.transverseCenter, z]),
      box(
        [data.reserve.centerTo - data.reserve.centerFrom, 4.4, height],
        [data.reserve.centerFrom, data.reserve.transverseCenter - 2.2, z],
      ),
    );
    cuts.push({ kind: 'transform', child: slot, translation: [0, 0, 0], rotation: [0, 0, q * 90] });
    cuts.push({
      kind: 'transform',
      child: box([4.5, 4.4, 4.4], [18.7, 10.8, sign * 5 - 2.2]),
      translation: [0, 0, 0],
      rotation: [0, 0, q * 90],
    });
    // Merge the terminal branch into its trunk; do not leave an isolated print chip.
    const localPort = rotate(port.innerPoint, -q);
    const mergeBottom = port.upper ? data.reserve.endMergeFromZ : -data.endZ - 0.5;
    const mergeHeight = data.endZ + 0.5 - data.reserve.endMergeFromZ;
    const merge: Shape = {
      kind: 'intersect',
      children: [
        box(
          [
            data.reserve.majorTo - data.reserve.majorFrom,
            localPort[1] + 2.2 + data.reserve.endMergeTangentialClearance - 2.8,
            mergeHeight,
          ],
          [data.reserve.majorFrom, 2.8, mergeBottom],
        ),
        cylinder(data.outerDiameter / 2 - data.reserve.minimumExteriorLand, mergeHeight, [
          0,
          0,
          mergeBottom,
        ]),
      ],
    };
    cuts.push({
      kind: 'transform',
      child: merge,
      translation: [0, 0, 0],
      rotation: [0, 0, q * 90],
    });
  }
  return cuts;
}
