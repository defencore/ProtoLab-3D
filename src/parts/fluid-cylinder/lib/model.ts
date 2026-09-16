import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, move, rotate, union, cut, ring, finish } from './helpers';
import type { Shape } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const b = n(p, 'bore'),
    r = n(p, 'rod'),
    stroke = n(p, 'stroke'),
    e = n(p, 'extension'),
    t = n(p, 'wall'),
    port = n(p, 'port');
  const cap = 6,
    l = stroke + 30,
    d = b + 2 * t,
    gap = Math.min(0.15, t * 0.05),
    tie = p.form === 'tie',
    rodless = p.form === 'rodless';
  const square = p.form === 'compact' || rodless,
    capWidth = tie ? d + 2 * t : d;
  let barrel = cut(
    square ? B(d, d, l - 2 * cap, 0, 0, cap) : C(d, l - 2 * cap, cap),
    C(b, l + 2, -1),
  );
  for (const z of [cap + port / 2 + 1, l - cap - port / 2 - 1])
    barrel = cut(barrel, move(rotate(C(port, d), 90), 0, d / 2, z));
  if (rodless) barrel = cut(barrel, B(r * 0.8, d, l - 2 * cap + 2, 0, d / 2, cap - 1));
  add('Cylinder barrel and ports', barrel);
  let rear = square || tie ? B(capWidth, capWidth, cap) : C(d, cap);
  let front = cut(
    square || tie ? B(capWidth, capWidth, cap, 0, 0, l - cap) : C(d, cap, l - cap),
    C(r + 2 * gap, cap + 2, l - cap - 1),
  );
  if (tie) {
    const bolt = t * 0.6;
    for (const x of [-d * 0.46, d * 0.46])
      for (const y of [-d * 0.46, d * 0.46]) {
        rear = cut(rear, C(bolt + 2 * gap, cap + 2, -1, x, y));
        front = cut(front, C(bolt + 2 * gap, cap + 2, l - cap - 1, x, y));
        add('Cylinder tie rod', C(bolt, l, 0, x, y), 0x515c68);
      }
  }
  add('Rear end cap', rear, 0x56626c);
  add('Front gland cap', front, 0x56626c);
  const pistonZ = cap + gap + e,
    pistonH = rodless ? 12 : 5;
  if (rodless) {
    const carriage = union(
      cut(B(d + 8, d + 8, 16, 0, 0, pistonZ), B(d + 2 * gap, d + 2 * gap, 18, 0, 0, pistonZ - 1)),
      B(r * 0.65, d / 2 + 3, 8, 0, (d / 2 + 3) / 2, pistonZ + 2),
      C(b - 2 * gap, 12, pistonZ),
    );
    add('Piston and guided rodless carriage', carriage);
  } else {
    let piston = ring(b - 2 * gap, r + gap, pistonH, pistonZ);
    if (p.detail === 'detailed') {
      piston = cut(piston, ring(b, b - 2 * t * 0.3, pistonH * 0.3, pistonZ + pistonH * 0.35));
      add(
        'Piston seal',
        ring(b - gap, b - 2 * t * 0.3 + gap, pistonH * 0.28, pistonZ + pistonH * 0.36),
        0x333a40,
      );
    }
    add('Piston', piston);
    add('Piston rod', C(r, l - cap + 10, pistonZ), 0xc1c8ce);
    if (p.form === 'hydraulic')
      add('Hydraulic gland retainer', ring(d * 0.9, r + 2 * gap, cap, l), 0x56626c);
  }
  return finish(out, state);
}
