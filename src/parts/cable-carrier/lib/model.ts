import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, move, rotate, union, cut, finish } from './helpers';
import type { Shape } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const w = n(p, 'width'),
    h = n(p, 'height'),
    l = n(p, 'length'),
    t = n(p, 'wall');
  if (p.form === 'duct')
    out.push({
      label: 'Open cable duct',
      shape: cut(B(w, h, l), B(w - 2 * t, h, l + 2, 0, t, -1)),
      color: 0x41464e,
    });
  else {
    const count = n(p, 'links'),
      pitch = l / count,
      r = Math.min(h * 0.22, pitch * 0.2),
      gap = Math.min(0.12, t * 0.05),
      pin = r * 0.65;
    const across = (d: number, depth: number, x: number, z: number) =>
      move(rotate(C(d, depth), 0, 90), x, 0, z);
    for (let i = 0; i < count; i++) {
      const z = i * pitch;
      let body = cut(
        B(w, h, pitch - 2 * r, 0, 0, z + r),
        B(w - 2 * t, h - 2 * t, pitch + 2, 0, 0, z - 1),
      );
      for (const side of [-1, 1]) {
        const femaleX = side > 0 ? w / 2 - t / 2 + gap : -w / 2,
          maleX = side > 0 ? w / 2 - t : -w / 2 + t / 2 + gap;
        const depth = t / 2 - gap;
        body = union(
          body,
          B(depth, 2 * r, r + 0.02, femaleX + depth / 2, 0, z),
          across(2 * r, depth, femaleX, z),
          B(depth, 2 * r, r + 0.02, maleX + depth / 2, 0, z + pitch - r - 0.02),
          across(2 * r, depth, maleX, z + pitch),
        );
        if (p.detail === 'detailed')
          body = union(body, across(pin, t, side > 0 ? w / 2 - t : -w / 2, z + pitch));
      }
      body = cut(body, across(pin + 2 * gap, w + 2, -w / 2 - 1, z));
      out.push({ label: `Drag-chain link ${i + 1}`, shape: body, color: 0x41464e });
    }
  }
  return finish(out, state);
}
