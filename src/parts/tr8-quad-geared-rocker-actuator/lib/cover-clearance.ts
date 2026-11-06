import { cylinder, union, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';

/** Exact spherical dilation of a closed cylinder, including its rounded end rims. */
export function roundedCylinderPocket(
  radius: number,
  length: number,
  origin: Vec,
  axis: 'x' | 'y' | 'z',
  clearance: number,
): Shape {
  if (radius <= 0 || length <= 0 || clearance <= 0) throw new Error('Cylinder pocket dimensions must be positive.');
  const index = { x: 0, y: 1, z: 2 }[axis];
  const start = [...origin] as Vec;
  start[index] -= clearance;
  const end = [...origin] as Vec;
  end[index] += length;
  const rotation: Vec = axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0];
  const rim = (position: Vec): Shape => ({
    kind: 'transform',
    child: { kind: 'torus', major: radius, minor: clearance, origin: [0, 0, 0], outerSegments: 48, innerSegments: 8 },
    translation: position,
    rotation,
  });
  return union(
    cylinder(radius + clearance, length, origin, axis),
    cylinder(radius, length + 2 * clearance, start, axis),
    rim(origin),
    rim(end),
  );
}
