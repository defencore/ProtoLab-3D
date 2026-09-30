import { box, cylinder, prism, subtract, type Shape, type Vec } from './shapes';
import type { Piece } from './assembly';
const pose = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
const orient = (shape: Shape, at: Vec, axis: 'x' | 'y' | 'z') =>
  pose(shape, at, axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0]);
const annulus = (ro: number, ri: number, z: number, h: number) =>
  subtract(cylinder(ro, h, [0, 0, z]), cylinder(ri, h + 2, [0, 0, z - 1]));
export function bearingPieces(
  name: string,
  at: Vec,
  axis: 'x' | 'y' | 'z',
  bore: number,
  diameter: number,
  width: number,
): Piece[] {
  const ro = diameter / 2,
    ri = bore / 2,
    mid = (ro + ri) / 2,
    ball = Math.min(width * 0.31, (ro - ri) * 0.36);
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0xb9c4ce) =>
    out.push({ label: `${name} · ${label}`, shape: orient(shape, at, axis), color });
  const groove: Shape = {
    kind: 'revolve',
    profile: Array.from({ length: 32 }, (_, i) => {
      const a = (i * Math.PI) / 16;
      return [mid + (ball + 0.1) * Math.cos(a), width / 2 + (ball + 0.1) * Math.sin(a)];
    }),
  };
  add('outer race', subtract(annulus(ro, mid + ball * 0.55, 0, width), groove));
  add('inner race', subtract(annulus(mid - ball * 0.55, ri, 0, width), groove));
  const sphere: Shape = {
    kind: 'revolve',
    profile: Array.from({ length: 17 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 16;
      return [Math.max(0, ball * Math.cos(a)), ball * Math.sin(a)];
    }),
  };
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    add(`ball ${i + 1}`, pose(sphere, [mid * Math.cos(a), mid * Math.sin(a), width / 2]), 0xd9e0e5);
  }
  add(
    'cage',
    subtract(
      annulus(mid + ball * 0.8, mid - ball * 0.8, width / 2 - 0.4, 0.8),
      ...Array.from({ length: 10 }, (_, i) => {
        const a = (i * Math.PI) / 5;
        return cylinder(ball + 0.1, 3, [mid * Math.cos(a), mid * Math.sin(a), width / 2 - 1.5]);
      }),
    ),
    0xb29a58,
  );
  return out;
}
export function maCylinderPieces(
  name: string,
  at: Vec,
  axis: 'x' | 'y' | 'z',
  length: number,
): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0xc4cdd4) =>
    out.push({ label: `${name} · ${label}`, shape: orient(shape, at, axis), color });
  add('stainless barrel', annulus(16, 14, 17, length - 34));
  for (const z of [0, length - 17]) {
    add(
      `end cap ${z}`,
      subtract(
        cylinder(18.25, 17, [0, 0, z]),
        cylinder(5.1, 19, [0, 0, z - 1]),
        cylinder(4.3, 10, [9, -0.01, z + 8.5], 'x', { pitch: 0.907, internal: true }),
      ),
      0x738494,
    );
    add(
      `G1/8 port boss ${z}`,
      subtract(
        cylinder(6, 4, [14, 0, z + 8.5], 'x'),
        cylinder(4.3, 6, [13, 0, z + 8.5], 'x', { pitch: 0.907, internal: true }),
      ),
      0xa2aeb8,
    );
    add(`cap seam ${z}`, annulus(18.3, 17.8, z + 1, 0.7), 0x303a42);
  }
  add('front rod wiper', annulus(7.5, 5.05, 0, 2), 0x303a42);
  add('magnetic switch', box([8, 7, 17], [-4, 16, 22]), 0x287ea1);
  return out;
}
export function socketScrew(
  name: string,
  at: Vec,
  axis: 'x' | 'y' | 'z',
  diameter = 6,
  length = 16,
): Piece {
  const r = diameter * 0.42;
  const socket = prism(
    Array.from({ length: 6 }, (_, i) => [
      r * Math.cos((i * Math.PI) / 3),
      r * Math.sin((i * Math.PI) / 3),
    ]),
    diameter * 0.65,
    diameter * 0.4,
  );
  return {
    label: name,
    shape: orient(
      {
        kind: 'union',
        children: [
          cylinder(diameter / 2, length, [0, 0, -length], 'z', {
            pitch: diameter === 6 ? 1 : diameter === 8 ? 1.25 : 1.5,
          }),
          subtract(cylinder(diameter * 0.8, diameter, [0, 0, 0]), socket),
        ],
      },
      at,
      axis,
    ),
    color: 0x53606b,
  };
}
