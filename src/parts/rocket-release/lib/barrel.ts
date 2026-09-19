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
  for (let j = 0; j <= 96; j++)
    loops.push(threadLoop(seat - 2 + (2 * j) / 96, seat, 7, 0.5, false));
  loops.push({ z: seat, r: () => 1.1 }, { z: seat - 2.8, r: () => 1.1 });
  return loopMesh(loops);
}
type Loop = { z: number; r: (i: number) => number };
function threadLoop(z: number, origin: number, d: number, p: number, internal: boolean): Loop {
  return {
    z,
    r: (i) => {
      const phase = (z - origin) / p - i / 96,
        delta = Math.abs(phase - Math.round(phase)) * p;
      const depth = p * Math.sqrt(3) * (internal ? 5 / 16 : 17 / 48);
      return (
        d / 2 +
        (internal ? 0.04 : 0) -
        Math.max(0, Math.min(depth, (delta - p / 16) * Math.sqrt(3)))
      );
    },
  };
}
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
/** One closed ring strip: no CSG splits or floating-point cracks at the two helices. */
export function barrelMesh(travel: number): Group {
  const seat = 34.5 - travel,
    loops: { z: number; r: (i: number) => number }[] = [];
  const circle = (z: number, r: number) => loops.push({ z, r: () => r });
  const thread = (z: number, origin: number, d: number, p: number, internal: boolean) =>
    loops.push(threadLoop(z, origin, d, p, internal));
  circle(seat - 2, 4);
  circle(42.8, 4);
  circle(42.8, 5);
  circle(44, 5);
  for (let j = 0; j <= 112; j++) thread(44 + (3.5 * j) / 112, 44, 8, 0.75, false);
  circle(47.5, 3.2);
  circle(46.5, 3.2);
  circle(46.5, 2);
  circle(44.5, 2);
  circle(44.5, 3);
  circle(seat, 3);
  for (let j = 0; j <= 96; j++) thread(seat - (2 * j) / 96, seat, 7, 0.5, true);
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
