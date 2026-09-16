import { n } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import { hullShell, type Shape, type Vec } from './shapes';
import type { Piece } from './assembly';

type Station = { u: number; width: number; depth: number; top: number };
/** Piecewise ruled sections are shared by preview and FreeCAD; no hidden smooth surface. */
export function stations(p: Parameters): Station[] {
  const m = n(p, 'midship') / 100,
    rocker = n(p, 'rocker') / 100,
    sheer = n(p, 'sheer') / 100;
  const widths =
    p.family === 'displacement'
      ? [0.055, 0.48, 0.86, 1, 0.88, 0.58]
      : p.family === 'semi-displacement'
        ? [0.055, 0.5, 0.88, 1, 0.96, 0.8]
        : [0.055, 0.55, 0.9, 1, 0.98, 0.94];
  const us = [0, 0.12, m * 0.56, m, (m + 1) / 2, 0.91, 1];
  return us.map((u, i) => ({
    u,
    width: i === 6 ? n(p, 'sternWidth') / 100 : widths[i],
    depth: (i === 0 ? 0.45 : 1) * (1 - rocker * Math.pow(Math.abs(u - m) / Math.max(m, 1 - m), 2)),
    top: sheer * (Math.pow(1 - u, 3) + 0.2 * Math.pow(u, 3)),
  }));
}
export function sectionProfile(p: Parameters, w: number, h: number): [number, number][] {
  const c = n(p, 'chineWidth') / 100,
    rise = ((w * c) / 2) * Math.tan((n(p, 'deadrise') * Math.PI) / 180);
  if (p.bottom === 'round')
    return Array.from({ length: 17 }, (_, i) => [
      (w / 2) * Math.cos((i * Math.PI) / 16),
      -h * Math.sin((i * Math.PI) / 16),
    ]);
  if (p.bottom === 'arch')
    return [
      [w / 2, 0],
      ...Array.from({ length: 13 }, (_, i): [number, number] => [
        w * 0.48 * Math.cos((i * Math.PI) / 12),
        -h * (0.42 + 0.58 * Math.sin((i * Math.PI) / 12)),
      ]),
      [-w / 2, 0],
    ];
  if (p.bottom === 'flat')
    return [
      [w / 2, 0],
      [(w * c) / 2, -h],
      [(-w * c) / 2, -h],
      [-w / 2, 0],
    ];
  if (p.bottom === 'soft-chine')
    return [
      [w / 2, 0],
      [w * 0.49, -h * 0.4],
      [w * 0.42, -h * 0.72],
      [w * 0.25, -h * 0.92],
      [0, -h],
      [-w * 0.25, -h * 0.92],
      [-w * 0.42, -h * 0.72],
      [-w * 0.49, -h * 0.4],
      [-w / 2, 0],
    ];
  const half: [number, number][] = [[w / 2, 0]];
  if (p.bottom === 'double-chine')
    half.push([(w * (c + (1 - c) * 0.55)) / 2, -h + rise + (h - rise) * 0.38]);
  half.push([(w * c) / 2, -h + rise]);
  return [...half, [0, -h], ...[...half].reverse().map(([y, z]): [number, number] => [-y, z])];
}
interface Hull {
  label: string;
  length: number;
  beam: number;
  depth: number;
  centre: number;
  side: number;
}
export function hulls(p: Parameters): Hull[] {
  const L = n(p, 'length'),
    B = n(p, 'beam'),
    H = n(p, 'depth'),
    b = n(p, 'hullBeam');
  if (p.layout === 'monohull')
    return [{ label: 'Hull', length: L, beam: B, depth: H, centre: 0, side: 0 }];
  const out = [-1, 1].map((side) => ({
    label: side < 0 ? 'Port hull' : 'Starboard hull',
    length: p.layout === 'trimaran' ? (L * n(p, 'floatLength')) / 100 : L,
    beam: b,
    depth: p.layout === 'trimaran' ? (H * n(p, 'floatDepth')) / 100 : H,
    centre: (side * (B - b)) / 2,
    side,
  }));
  if (p.layout !== 'catamaran')
    out.unshift({
      label: p.layout === 'trimaran' ? 'Main hull' : 'Central pod',
      length: p.layout === 'trimaran' ? L : L * 0.55,
      beam: n(p, 'centreBeam'),
      depth: p.layout === 'trimaran' ? H : H * 0.65,
      centre: 0,
      side: 0,
    });
  return out;
}
export function pieces(p: Parameters, state: string): Piece[] {
  const t = n(p, 'wall'),
    H = n(p, 'depth'),
    lines = stations(p),
    specs = hulls(p);
  const result: Piece[] = [];
  const ring = (h: Hull, s: Station, inset = 0): Vec[] => {
    const w = Math.max(s.width * h.beam - 2 * inset, t),
      depth = s.depth * h.depth - inset;
    return sectionProfile(p, w, depth).map(([y, z]) => {
      const q = y / (w / 2),
        shift = (-h.side * n(p, 'asymmetry')) / 100;
      const asymmetric = shift + (q >= 0 ? (1 - shift) * q : (1 + shift) * q);
      const f = -z / depth;
      const bow =
        p.bow === 'plumb'
          ? 0
          : (n(p, 'bowRake') / 100) *
            h.length *
            Math.pow(Math.max(0, 1 - s.u / 0.3), 2) *
            Math.pow(f, p.bow === 'spoon' ? 0.6 : 1);
      const stern =
        (n(p, 'sternRake') / 100) * h.length * Math.pow(Math.max(0, (s.u - 0.8) / 0.2), 2) * f;
      return [
        (s.u - 0.5) * (h.length - 2 * inset) + bow - stern,
        h.centre + (w / 2) * asymmetric,
        s.top * h.depth + z,
      ];
    });
  };
  for (const h of specs) {
    const outer: Shape = { kind: 'loft', rings: lines.map((s) => ring(h, s)) };
    const inner = lines.map((s) => ring(h, s, t));
    const shell = hullShell(outer.rings, inner);
    result.push({
      label: `${h.label} shell`,
      shape: shell,
      color: 0x91b7ca,
    });
    if (state !== 'body' && p.cover) {
      // Interpolate original sheer stations so cover undersides follow the same ruled roof.
      const us = [0.36, ...lines.map((s) => s.u).filter((u) => u > 0.36 && u < 0.64), 0.64];
      const rings = us.map((u) => {
        const i = lines.findIndex((s) => s.u >= u),
          a = lines[i - 1],
          b = lines[i],
          f = (u - a.u) / (b.u - a.u);
        const w = (a.width + (b.width - a.width) * f) * h.beam,
          z = (a.top + (b.top - a.top) * f) * h.depth + 0.2;
        const x = (u - 0.5) * h.length;
        return [
          [x, h.centre - w / 2, z],
          [x, h.centre + w / 2, z],
          [x, h.centre + w / 2, z + t],
          [x, h.centre - w / 2, z + t],
        ] as Vec[];
      });
      result.push({
        label: `${h.label} · removable midship cover`,
        shape: { kind: 'loft', rings },
        color: 0xe1e7e8,
        z: state === 'exploded' ? H * 0.8 : 0,
      });
    }
  }
  if (p.layout !== 'monohull' && p.bridge !== 'none' && state !== 'body') {
    const size = n(p, 'crossbeam'),
      end = (n(p, 'beam') - n(p, 'hullBeam')) / 2;
    for (const x of [-n(p, 'length') * 0.24, n(p, 'length') * 0.24]) {
      const localTop = Math.max(
        ...specs.flatMap((h) =>
          [-size / 2 - t, size / 2 + t].map((dx) => {
            const u = Math.min(1, Math.max(0.001, (x + dx) / h.length + 0.5));
            const i = lines.findIndex((s) => s.u >= u),
              a = lines[i - 1],
              b = lines[i];
            return (a.top + ((b.top - a.top) * (u - a.u)) / (b.u - a.u)) * h.depth;
          }),
        ),
      );
      const direction = p.bridge === 'raised' ? 1 : p.bridge === 'lowered' ? -1 : 0;
      const rings = Array.from({ length: 13 }, (_, i): Vec[] => {
        const q = i / 6 - 1,
          y = q * end;
        const z =
          localTop +
          0.2 +
          (direction < 0 ? n(p, 'bridgeCurve') : 0) +
          direction * n(p, 'bridgeCurve') * (1 - q * q);
        return [
          [x - size / 2, y, z],
          [x + size / 2, y, z],
          [x + size / 2, y, z + size],
          [x - size / 2, y, z + size],
        ];
      });
      result.push({
        label: x < 0 ? 'Forward crossbeam' : 'Aft crossbeam',
        shape: { kind: 'loft', rings },
        color: 0x545f67,
        z: state === 'exploded' ? H * 1.5 : 0,
      });
    }
  }
  return result;
}
