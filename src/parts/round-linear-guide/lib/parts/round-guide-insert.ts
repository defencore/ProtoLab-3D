import { Vector2 } from 'three';
import { n } from '../../../../core/geometry';
import type { Parameters } from '../../../../core/types';
import { roundCircuit } from './guide-circuits';

export function insertSection(p: Parameters, cutaway: boolean) {
  const v = roundCircuit(p),
    bore = v.shaft + n(p, 'clearance');
  const inner = (a: number) => {
    let radius = bore;
    for (const row of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const delta = Math.atan2(Math.sin(a - row), Math.cos(a - row));
      if (Math.cos(delta) > 0)
        radius = Math.max(
          radius,
          Math.min(
            (v.returned + v.radius * 1.1) / Math.cos(delta),
            (v.radius * 1.1) / Math.max(1e-12, Math.abs(Math.sin(delta))),
          ),
        );
    }
    return radius;
  };
  const arc = (r: (a: number) => number, reverse = false) =>
    Array.from({ length: cutaway ? 129 : 256 }, (_, i) => {
      const a = cutaway
        ? Math.PI / 2 + (Math.PI * (reverse ? 128 - i : i)) / 128
        : (Math.PI * 2 * (reverse ? 255 - i : i)) / 256;
      return new Vector2(r(a) * Math.cos(a), r(a) * Math.sin(a));
    });
  const clean = (points: Vector2[]) =>
    points.filter((point, i) => {
      if (cutaway && (i === 0 || i === points.length - 1)) return true;
      const a = point.clone().sub(points[(i + points.length - 1) % points.length]),
        b = points[(i + 1) % points.length].clone().sub(point);
      return Math.abs(a.x * b.y - a.y * b.x) > 1e-10;
    });
  return { outerPoints: arc(() => v.outer), inner: clean(arc(inner, true)), ...v };
}
