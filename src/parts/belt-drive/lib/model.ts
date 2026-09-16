import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, T, poly, move, union, cut, finish } from './helpers';
import type { Shape, Vec } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const friction = p.form === 'v' || p.form === 'poly',
    detailed = p.detail === 'detailed';
  const pitch = n(p, 'pitch'),
    count = n(p, 'teeth'),
    r = friction ? n(p, 'pulleyDiameter') / 2 : (pitch * count) / (2 * Math.PI),
    c = n(p, 'centres'),
    w = n(p, 'width'),
    t = n(p, 'thickness'),
    b = n(p, 'bore');
  const stadium = (radius: number, height: number, z: number) =>
    union(
      C(2 * radius, height, z),
      C(2 * radius, height, z, c),
      B(c, 2 * radius, height, c / 2, 0, z),
    );
  if (friction) {
    const ribs = p.form === 'poly' ? n(p, 'ribs') : 1;
    // A poly-V belt needs a continuous backing above the ribs. Without it,
    // adjacent ribs meet at zero-thickness edges and produce invalid CAD.
    const ribDepth = p.form === 'poly' ? t * 0.65 : t;
    const profile: [number, number][] = [
      [b / 2, -1],
      [r + t + 0.5, -1],
    ];
    const stations: [number, number][] = [[-1, r + t + 0.4]];
    for (let i = 0; i < ribs; i++) {
      const a = (i * w) / ribs,
        span = w / ribs;
      profile.push(
        [r + ribDepth - 0.2, a],
        [r - 0.2, a + span * 0.35],
        [r - 0.2, a + span * 0.65],
        [r + ribDepth - 0.2, a + span],
      );
      stations.push(
        [a, r + ribDepth],
        [a + span * 0.35, r + 0.1],
        [a + span * 0.65, r + 0.1],
        [a + span, r + ribDepth],
      );
    }
    profile.push([r + t + 0.5, w + 1], [b / 2, w + 1]);
    stations.push([w + 1, r + t + 0.4]);
    const loop = (rad: number, z: number): Vec[] => {
      const points: Vec[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 24;
        points.push([c + rad * Math.cos(a), rad * Math.sin(a), z]);
      }
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 24;
        points.push([rad * Math.cos(a), rad * Math.sin(a), z]);
      }
      return points;
    };
    const inner: Shape = {
      kind: 'loft',
      rings: stations
        .filter((v, i) => !i || v[0] !== stations[i - 1][0])
        .map(([z, r0]) => loop(r0, z)),
    };
    add(
      p.form === 'v' ? 'V-section belt' : 'Multi-rib belt',
      cut(stadium(r + t, w, 0), inner),
      0x343840,
    );
    for (const x of [0, c])
      add(
        x === 0 ? 'Driver sheave' : 'Driven sheave',
        move(
          T(
            profile.filter(
              (v, i) => !i || v[0] !== profile[i - 1][0] || v[1] !== profile[i - 1][1],
            ),
          ),
          x,
        ),
      );
  } else {
    const depth = Math.min(pitch * 0.3, r * 0.15),
      root = r - depth;
    const outline = (clearance: number): [number, number][] =>
      Array.from({ length: count * 12 }, (_, i) => {
        const phase = (i % 12) / 12,
          a = (i * 2 * Math.PI) / (count * 12);
        const round = String(p.form).startsWith('htd') || p.form === 'gt2';
        const height = round
          ? (1 - Math.cos(2 * Math.PI * phase)) / 2
          : Math.min(1, Math.max(0, (phase - 0.12) / 0.2), Math.max(0, (0.88 - phase) / 0.2));
        const rad = root + (depth - 0.1) * height + clearance;
        return [rad * Math.cos(a), rad * Math.sin(a)];
      });
    let belt = cut(stadium(r + t, w, 0), stadium(detailed ? root + 0.15 : r + 0.3, w + 2, -1));
    if (detailed) {
      belt = cut(belt, poly(outline(0.2), w + 2, -1), move(poly(outline(0.2), w + 2, -1), c));
      const grooves: Shape[] = [];
      for (let x = pitch / 2; x < c; x += pitch)
        for (const sign of [-1, 1])
          grooves.push(B(pitch * 0.5, depth + 0.3, w + 2, x, sign * (r - depth * 0.3), -1));
      belt = cut(belt, ...grooves);
    }
    add('Timing belt with tooth spaces', belt, 0x343840);
    for (const x of [0, c]) {
      const body = detailed ? poly(outline(0), w) : C(2 * (r - 0.1), w);
      const pulley = cut(
        union(
          body,
          C(2 * (r + t + 0.5), 1, -1.2),
          C(2 * (r + t + 0.5), 1, w + 0.2),
          C(2 * (root - 0.05), w + 2.4, -1.2),
        ),
        C(b, w + 5, -2),
      );
      add(x === 0 ? 'Driver timing pulley' : 'Driven timing pulley', move(pulley, x));
    }
  }
  return finish(out, state);
}
