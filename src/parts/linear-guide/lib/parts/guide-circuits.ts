import { Mesh, SphereGeometry, Vector3 } from 'three';
import { material, n, num } from '../../../../core/geometry';
import type { Parameters } from '../../../../core/types';

/** Representative closed return loop: loaded straight, end turn, return straight, end turn. */
export function circuitPoints(
  length: number,
  loaded: number,
  returned: number,
  radius: number,
): Vector3[] {
  const turn = (returned - loaded) / 2,
    center = (returned + loaded) / 2;
  const straight = length - 2 * turn - 3 * radius,
    half = straight / 2;
  const perimeter = 2 * straight + 2 * Math.PI * turn;
  const count = Math.min(120, Math.max(8, Math.floor(perimeter / (2.6 * radius))));
  return Array.from({ length: count }, (_, i) => {
    let distance = (perimeter * i) / count;
    if (distance <= straight) return new Vector3(-half + distance, loaded, 0);
    distance -= straight;
    if (distance <= Math.PI * turn) {
      const a = -Math.PI / 2 + distance / turn;
      return new Vector3(half + turn * Math.cos(a), center + turn * Math.sin(a), 0);
    }
    distance -= Math.PI * turn;
    if (distance <= straight) return new Vector3(half - distance, returned, 0);
    distance -= straight;
    const a = Math.PI / 2 + distance / turn;
    return new Vector3(-half + turn * Math.cos(a), center + turn * Math.sin(a), 0);
  });
}
export function ballMeshes(points: Vector3[], radius: number): Mesh[] {
  return points.map((point, index) => {
    const ball = new Mesh(new SphereGeometry(radius, 20, 14), material(0xb7c0cb));
    ball.position.copy(point);
    ball.name = `Recirculating ball ${index + 1}`;
    return ball;
  });
}
export function ballPython(points: Vector3[], radius: number): string[] {
  return points.map(
    (point) =>
      `Part.makeSphere(${num(radius)}, App.Vector(${num(point.x)}, ${num(point.y)}, ${num(point.z)}))`,
  );
}
export function profileCircuit(p: Parameters) {
  const loaded = n(p, 'railWidth') / 2 + n(p, 'clearance'),
    z = n(p, 'railHeight') * 0.62;
  const radius = Math.min(
    n(p, 'railWidth') * 0.075,
    n(p, 'railWidth') * 0.1 - n(p, 'clearance') - 0.02,
    (z - n(p, 'baseClearance') - 0.2) / 1.1,
    (n(p, 'blockWidth') / 2 - loaded - 0.5) / 4.1,
  );
  const returned = loaded + 3 * radius;
  const x = (n(p, 'position') / 100 - 0.5) * (n(p, 'length') - n(p, 'blockLength'));
  const points = [-1, 1].flatMap((sign) =>
    circuitPoints(n(p, 'blockLength'), loaded, returned, radius).map(
      (point) => new Vector3(point.x + x, sign * point.y, z),
    ),
  );
  return {
    radius,
    loaded,
    returned,
    z,
    points,
    chamber: returned + radius * 1.1,
    low: z - radius * 1.1,
    high: z + radius * 1.1,
  };
}
export function roundCircuit(p: Parameters) {
  const shaft = n(p, 'shaftDiameter') / 2;
  const radius = Math.min(
    shaft * 0.14,
    (Math.min(n(p, 'blockWidth'), n(p, 'blockHeight')) / 2 - shaft - 0.8) / 5,
    ((n(p, 'pitchY') - n(p, 'holeDiameter')) / 2 - shaft - 0.4) / 5,
  );
  const loaded = shaft + radius,
    returned = shaft + radius * 3.5,
    outer = shaft + radius * 5;
  const x = (n(p, 'position') / 100 - 0.5) * (n(p, 'length') - n(p, 'blockLength')),
    z = n(p, 'blockHeight') / 2;
  const points = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].flatMap((a) =>
    circuitPoints(n(p, 'blockLength') - 2 * radius, loaded, returned, radius).map(
      (point) => new Vector3(point.x + x, point.y * Math.cos(a), z + point.y * Math.sin(a)),
    ),
  );
  return { radius, shaft, loaded, returned, outer, x, z, points };
}
