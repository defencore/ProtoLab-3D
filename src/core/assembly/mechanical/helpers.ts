import { box, cylinder, prism, union, subtract, component, type Shape, type Vec } from './shapes';
import type { Piece } from './assembly';
import { Box3, Mesh, MeshStandardMaterial } from 'three';
export { union };
export const cut = subtract;
export const B = (w: number, d: number, h: number, x = 0, y = 0, z = 0): Shape =>
  box([w, d, h], [x - w / 2, y - d / 2, z]);
export const C = (d: number, h: number, z = 0, x = 0, y = 0): Shape =>
  cylinder(d / 2, h, [x, y, z]);
export const ring = (d: number, bore: number, h: number, z = 0): Shape =>
  cut(C(d, h, z), C(bore, h + 2, z - 1));
export const poly = (points: [number, number][], h: number, z = 0): Shape => prism(points, h, z);
export const move = (child: Shape, x = 0, y = 0, z = 0): Shape => ({
  kind: 'transform',
  child,
  translation: [x, y, z],
  rotation: [0, 0, 0],
});
export const rotate = (child: Shape, x = 0, y = 0, z = 0): Shape => ({
  kind: 'transform',
  child,
  translation: [0, 0, 0],
  rotation: [x, y, z],
});
export const T = (profile: [number, number][]): Shape => ({ kind: 'revolve', profile });
export function torus(major: number, minor: number, z = 0): Shape {
  return T(
    Array.from({ length: 24 }, (_, i) => [
      major + minor * Math.cos((i * Math.PI) / 12),
      z + minor * Math.sin((i * Math.PI) / 12),
    ]),
  );
}
export function boltCircle(
  shape: Shape,
  pitch: number,
  diameter: number,
  count: number,
  height: number,
  z = -1,
): Shape {
  return cut(
    shape,
    ...Array.from({ length: count }, (_, i) =>
      C(
        diameter,
        height,
        z,
        (pitch / 2) * Math.cos((2 * Math.PI * i) / count),
        (pitch / 2) * Math.sin((2 * Math.PI * i) / count),
      ),
    ),
  );
}
/** Trapezoidal visual teeth only; used for mechanisms whose production flanks are not specified. */
export function teeth(root: number, tip: number, count: number, h: number, z = 0): Shape {
  return poly(
    Array.from({ length: count * 4 }, (_, i) => {
      const a = (i * Math.PI * 2) / (count * 4),
        r = i % 4 === 1 || i % 4 === 2 ? tip : root;
      return [r * Math.cos(a), r * Math.sin(a)];
    }),
    h,
    z,
  );
}
export function link(
  a: [number, number],
  b: [number, number],
  width: number,
  h: number,
  z: number,
  hole = 0,
): Shape {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy),
    angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  let s = union(B(L, width, h, L / 2, 0, z), C(width, h, z), C(width, h, z, L));
  if (hole) s = cut(s, C(hole, h + 2, z - 1), C(hole, h + 2, z - 1, L));
  return move(rotate(s, 0, 0, angle), a[0], a[1]);
}
export function arcBand(r: number, t: number, h: number, start: number, end: number, z = 0): Shape {
  const points: [number, number][] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = ((start + ((end - start) * i) / steps) * Math.PI) / 180;
    points.push([(r + t) * Math.cos(a), (r + t) * Math.sin(a)]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = ((start + ((end - start) * i) / steps) * Math.PI) / 180;
    points.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return poly(points, h, z);
}
export function finish(pieces: Piece[], state: string): Piece[] {
  if (state !== 'exploded' || pieces.length < 2) return pieces;
  let z = 0;
  return pieces.map((p) => {
    const model = component(p.shape, p.label, p.color),
      b = new Box3().setFromObject(model, true);
    model.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        (o.material as MeshStandardMaterial).dispose();
      }
    });
    const result = { ...p, z: z - b.min.z };
    z += b.max.z - b.min.z + Math.max(5, (b.max.z - b.min.z) * 0.3);
    return result;
  });
}
