import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, move, union, cut, ring, arcBand, finish } from './helpers';
import type { Shape } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const d = n(p, 'diameter'),
    b = n(p, 'bore'),
    t = n(p, 'thickness'),
    h = n(p, 'depth');
  const gap = Math.min(0.2, t * 0.05);
  if (p.form === 'disc') {
    const pad = (h - t) * 0.13,
      slot = t + 2 * pad + 4 * gap;
    const x = d * 0.39,
      pw = d * 0.14,
      pd = d * 0.24;
    add('Disc rotor', ring(d, b, t));
    const pistonD = Math.min(pw, pd) * 0.7;
    const pistonZ = t + pad + 2 * gap;
    const pistonH = (h + t) / 2 - pistonZ;
    add(
      'Caliper bridge',
      cut(
        B(d * 0.34, d * 0.32, h, d * 0.46, 0, (t - h) / 2),
        B(d * 0.55, d * 0.4, slot, d * 0.25, 0, (t - slot) / 2),
        C(pistonD + 2 * gap, pistonH + 1, pistonZ, x),
      ),
      0x535e69,
    );
    add('Inboard friction pad', B(pw, pd, pad, x, 0, -pad - gap), 0x393c40);
    add('Outboard friction pad', B(pw, pd, pad, x, 0, t + gap), 0x393c40);
    add('Caliper piston', C(pistonD, pistonH, pistonZ, x), 0xc1c6cc);
  } else {
    const wall = Math.min(t, d * 0.08),
      inner = d / 2 - wall;
    const shoe = Math.min(wall * 1.3, inner * 0.25),
      z = wall + gap,
      depth = h - wall - 2 * gap;
    // Rotating drum has a closed rear web and a genuinely open friction cavity.
    add('Rotating drum and hub', cut(C(d, h), C(2 * inner, h, wall), C(b, h + 2, -1)));
    add('Stationary backing plate', ring(d * 0.93, b + 2 * gap, wall, h + gap), 0x535e69);
    for (const [i, start] of [15, 195].entries()) {
      const a = ((start + 12) * Math.PI) / 180,
        radius = inner - shoe / 2 - gap;
      const x = radius * Math.cos(a),
        y = radius * Math.sin(a),
        pin = shoe * 0.35;
      add(
        `Brake shoe ${i + 1}`,
        cut(
          arcBand(inner - shoe - gap, shoe, depth, start, start + 150, z),
          C(pin + gap, depth + 2, z - 1, x, y),
        ),
        0x494b4e,
      );
      add(`Shoe anchor ${i + 1}`, C(pin, depth + gap, z, x, y), 0xc1c6cc);
    }
  }
  return finish(out, state);
}
