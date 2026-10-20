import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { cylinder, union, subtract, transform, rotate, plate, circle, type Shape } from './shapes';

export function barrelPlug(travel: number): Shape {
  return { kind: 'springPlug', travel };
}
export function plugShape(travel: number): Shape {
  const seat = 34.5 - travel;
  return subtract(
    union(
      transform(
        rotate(
          { kind: 'thread', diameter: 7, pitch: 0.5, length: 2, clearance: 0, internal: false },
          180,
          'x',
        ),
        0,
        [0, 0, seat],
      ),
      plate(circle(7 / Math.sqrt(3), 0, 0, 6), [], seat - 2.8, 0.8),
    ),
    cylinder(1.1, 3.2, [0, 0, seat - 3]),
  );
}
export function plugMesh(travel: number): Group {
  const seat = 34.5 - travel,
    loops: Loop[] = [];
  const hex = (i: number) =>
    3.5 / Math.cos((((i / 96) * 2 * Math.PI) % (Math.PI / 3)) - Math.PI / 6);
  loops.push({ z: seat - 2.8, r: hex }, { z: seat - 2, r: hex });
  loops.push({ z: seat - 2, r: () => 3.5 }, { z: seat, r: () => 3.5 });
  loops.push({ z: seat, r: () => 1.1 }, { z: seat - 2.8, r: () => 1.1 });
  return loopMesh(loops);
}
type Loop = { z: number; r: (i: number) => number };
export function barrelShape(travel: number): Shape {
  const seat = 34.5 - travel;
  return subtract(
    union(
      cylinder(4, 44 - (seat - 2), [0, 0, seat - 2]),
      cylinder(5, 1.2, [0, 0, 42.8]),
      transform(
        { kind: 'thread', diameter: 8, pitch: 0.75, length: 3.5, clearance: 0, internal: false },
        0,
        [0, 0, 44],
      ),
    ),
    cylinder(3, 44.5 - (seat - 2) + 0.01, [0, 0, seat - 2 - 0.01]),
    cylinder(2, 3.2, [0, 0, 44.5]),
    cylinder(3.2, 1.1, [0, 0, 46.5]),
    transform(
      rotate(
        { kind: 'thread', diameter: 7, pitch: 0.5, length: 2, clearance: 0.04, internal: true },
        180,
        'x',
      ),
      0,
      [0, 0, seat],
    ),
  );
}
/** Closed turned section with smooth nominal diameters for both metal threads. */
export function barrelMesh(travel: number): Group {
  const seat = 34.5 - travel,
    loops: { z: number; r: (i: number) => number }[] = [];
  const circle = (z: number, r: number) => loops.push({ z, r: () => r });
  circle(seat - 2, 4);
  circle(42.8, 4);
  circle(42.8, 5);
  circle(44, 5);
  circle(44, 4);
  circle(47.5, 4);
  circle(47.5, 3.2);
  circle(46.5, 3.2);
  circle(46.5, 2);
  circle(44.5, 2);
  circle(44.5, 3);
  circle(seat, 3);
  circle(seat, 3.5);
  circle(seat - 2, 3.5);
  return loopMesh(loops);
}
function loopMesh(loops: Loop[]): Group {
  const n = 96;
  const positions: number[] = [],
    indices: number[] = [];
  for (const loop of loops)
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        r = loop.r(i);
      positions.push(r * Math.cos(a), r * Math.sin(a), loop.z);
    }
  for (let j = 0; j < loops.length; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        b = j * n + ((i + 1) % n),
        c = ((j + 1) % loops.length) * n + i,
        d = ((j + 1) % loops.length) * n + ((i + 1) % n);
      indices.push(a, b, c, b, d, c);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return new Group().add(new Mesh(g, new MeshStandardMaterial()));
}
