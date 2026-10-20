import { Euler, Quaternion, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { screw, hexNut } from './hardware';
import { parallelMountDetails, parallelMountHardware } from './parallel-mount';
import { parallelGasketDetails } from './parallel-gaskets';
import type { DetailSpec } from './types';

const rad = Math.PI / 180;
const pose = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
export const parallelLayout = (_p: Parameters) => ({
  switchZ: 0,
  servoZ: -15.2,
  servoY: -28,
  contactZ: 22.5,
});

/** Finite opposed half-bar against the nominal lever axis, relative to its pivot. */
export function parallelContact(yawDegrees: number, leverDegrees: number, side: -1 | 1) {
  const yaw = yawDegrees * rad,
    a = leverDegrees * rad;
  const u = new Vector3(Math.sin(a), 0, Math.cos(a));
  const start = new Vector3(0, -28, 10);
  const delta = new Vector3(side * 28 * Math.cos(yaw), side * 28 * Math.sin(yaw), 0);
  const projectedStart = start.clone().addScaledVector(u, -start.dot(u));
  const projectedDelta = delta.clone().addScaledVector(u, -delta.dot(u));
  const fraction = Math.max(
    0,
    Math.min(1, -projectedStart.dot(projectedDelta) / projectedDelta.lengthSq()),
  );
  const closest = start.clone().addScaledVector(delta, fraction);
  const perpendicular = projectedStart.addScaledVector(projectedDelta, fraction);
  const distance = perpendicular.length();
  return {
    clearance: distance - 8.5,
    armFraction: fraction,
    leverCoordinate: closest.dot(u),
    // The contact must remain inside the capsule's retained height [6, 14].
    barSurfaceHeight: closest.z - (perpendicular.z * 5) / distance,
  };
}

function tangentAngle() {
  let low = 0,
    high = 90;
  for (let i = 0; i < 55; i++) {
    const mid = (low + high) / 2;
    if (parallelContact(mid, -12, 1).clearance > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
const contactAngle = tangentAngle();
export function parallelKinematics(p: Parameters) {
  const direction = p.phase === 'press-on' ? 1 : p.phase === 'press-off' ? -1 : 0;
  return {
    // The installed switch turns 180 degrees about Z, reversing its physical lever tilt.
    servoAngle: direction ? direction * contactAngle : 0,
    rockerAngle: direction ? direction * contactAngle : 0,
    contactAngle,
    direction,
    slide: 0,
    travel: 0,
    workingStroke: 0,
    maxPadCompression: 0,
    // The stationary hub, rather than the opposed bar, governs manual clearance.
    neutralClearance: 28 - 13 - 3.5,
    switchPosition: p.phase === 'on' || p.phase === 'press-on' ? 'last' : 'first',
  };
}

export function parallelDetails(p: Parameters): DetailSpec[] {
  const m = parallelLayout(p),
    k = parallelKinematics(p);
  const capsule = union(
    cylinder(5, 56, [-28, 0, 4], 'x'),
    { kind: 'sphere', radius: 5, origin: [-28, 0, 4] },
    { kind: 'sphere', radius: 5, origin: [28, 0, 4] },
  );
  const bar: Shape = {
    kind: 'intersect',
    children: [capsule, box([68, 30, 8], [-34, -15, 0])],
  };
  const rotor = pose(
    subtract(
      union(cylinder(13, 8, [0, 0, 0]), bar),
      cylinder(4, 10, [0, 0, -1]),
      ...[
        [7, 0],
        [0, 7],
        [-7, 0],
        [0, -7],
      ].map(([x, y]) => cylinder(0.95, 10, [x, y, -1])),
    ),
    [0, m.servoY, m.switchZ + 18.5],
    [0, 0, k.rockerAngle],
  );
  return [
    ...parallelMountDetails(p, m),
    {
      id: 'parallel-rocker',
      label: 'Printed opposed two-arm rocker',
      shape: rotor,
      color: 0xe7a34a,
      material: 'PETG; qualify the printed prototype',
      blank: 'Diameter 26 × 8 mm hub; opposed 28 mm arms, 10 mm maximum width, 66 mm overall span',
      processes: ['printing', 'drilling'],
      requirements: [
        'Print the disc mating face flat. The solid bar is clipped to 8 mm thickness with broad flat faces; support rounded lower edges only as required by the printer.',
        'Four M1.6 × 12 screws and AF3.2 × 1.3 mm nuts attach the unchanged supplier disc on PCD14. Align nut flats radially; retain the supplied shaft fastener through the central access opening.',
        'Two opposite arms share one continuous section through the hub. Neutral leaves the modeled manual toggle path clear; drive alternate arms toward the lever and return to neutral after each push.',
        'Nominal tangent positions are approximately ±76.34 degrees. Calibrate actual trip positions, speed and torque limit; no force or service-life rating is assigned.',
      ],
    },
    ...parallelGasketDetails(p),
  ];
}

export function parallelHardware(p: Parameters): ConfiguredPiece[] {
  const m = parallelLayout(p),
    k = parallelKinematics(p);
  const installed = (piece: ConfiguredPiece): ConfiguredPiece => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (-90 + k.servoAngle) * rad);
    const at = new Vector3(...piece.component.placement!.translation)
      .applyQuaternion(q)
      .add(new Vector3(0, m.servoY, m.servoZ));
    const r = piece.component.placement!.rotation;
    const e = new Euler().setFromQuaternion(
      q.multiply(
        new Quaternion().setFromEuler(new Euler(...(r.map((v) => v * rad) as Vec), 'ZYX')),
      ),
      'ZYX',
    );
    piece.component.placement = {
      translation: at.toArray() as Vec,
      rotation: [e.x / rad, e.y / rad, e.z / rad],
    };
    return piece;
  };
  const result = parallelMountHardware(p, m);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      x = 7 * Math.cos(a),
      y = 7 * Math.sin(a);
    result.push(installed(screw(`parallel-disc-screw-${i + 1}`, 1.6, 12, [x, y, 41.7])));
    result.push(
      installed(hexNut(`parallel-disc-nut-${i + 1}`, 1.6, 3.2, 1.3, [x, y, 29.9], [0, 0, i * 90])),
    );
  }
  return result;
}
