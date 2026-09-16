import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, T, move, rotate, union, cut, ring, boltCircle, finish } from './helpers';
import type { Shape } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const d = n(p, 'diameter'),
    b = n(p, 'bore'),
    l = n(p, 'length'),
    g = n(p, 'gap'),
    hub = (l - g) / 2;
  const clearance = Math.min(0.15, g * 0.015);
  if (p.form === 'rigid') {
    let body = ring(d, b, l);
    if (p.detail === 'detailed')
      for (const z of [l * 0.25, l * 0.75])
        body = cut(body, move(rotate(C(3, d), 90), 0, d / 2, z));
    add('Rigid sleeve', body);
  } else if (p.form === 'beam') {
    let body = ring(d, b, l);
    const slots = p.detail === 'detailed' ? 8 : 4,
      kerf = Math.min(0.6, g / (slots * 3));
    for (let i = 0; i < slots; i++)
      body = cut(
        body,
        rotate(B(d, d * 0.8, kerf, 0, d * 0.2, hub + ((i + 0.5) * g) / slots), 0, 0, (i % 2) * 180),
      );
    add('One-piece slotted flexure', body);
  } else if (p.form === 'oldham') {
    const tongue = d * 0.13,
      depth = g * 0.22;
    const input = union(C(d, hub), B(d * 0.75, tongue - 2 * clearance, depth, 0, 0, hub - 0.01));
    const output = union(
      C(d, hub, hub + g),
      B(tongue - 2 * clearance, d * 0.75, depth + 0.01, 0, 0, hub + g - depth),
    );
    add('Input hub · transverse tongue', cut(input, C(b, l + 2, -1)));
    add('Output hub · perpendicular tongue', cut(output, C(b, l + 2, -1)));
    add(
      'Oldham disc · crossed sliding grooves',
      cut(
        C(d * 0.82, g - 2 * clearance, hub + clearance),
        C(b + 2 * clearance, g + 2, hub - 1),
        B(d, tongue, depth + clearance, 0, 0, hub - 0.01),
        B(tongue, d, depth + clearance, 0, 0, hub + g - depth - clearance),
      ),
      0x454950,
    );
  } else if (p.form === 'bellows') {
    add('Input clamp hub', ring(d, b, hub));
    add('Output clamp hub', ring(d, b, hub, hub + g));
    const folds = p.detail === 'detailed' ? 8 : 4,
      wall = Math.min(0.5, (d * 0.8 - b) / 8),
      profile: [number, number][] = [];
    for (let i = 0; i <= 2 * folds; i++)
      profile.push([d * (i % 2 ? 0.4 : 0.48), hub + (g * i) / (2 * folds)]);
    for (let i = 2 * folds; i >= 0; i--)
      profile.push([d * (i % 2 ? 0.4 : 0.48) - wall, hub + (g * i) / (2 * folds)]);
    add('Metal bellows', T(profile), 0xb2b9c0);
  } else {
    const z = l / 2,
      bolt = Math.min(3, d * 0.07),
      pitch = d * 0.72,
      half = g / 2;
    add(
      'Input flange hub',
      boltCircle(
        cut(union(C(d * 0.56, z - clearance), C(d, half, z - half - clearance)), C(b, l + 2, -1)),
        pitch,
        bolt + 2 * clearance,
        4,
        g + 2,
        z - half - 1,
      ),
    );
    add(
      'Output flange hub',
      boltCircle(
        cut(
          union(C(d * 0.56, z - clearance, z + clearance), C(d, half, z + clearance)),
          C(b, l + 2, -1),
        ),
        pitch,
        bolt + 2 * clearance,
        4,
        g + 2,
        z - half - 1,
      ),
    );
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        x = (pitch / 2) * Math.cos(a),
        y = (pitch / 2) * Math.sin(a);
      add(
        `Flange bolt ${i + 1}`,
        move(
          union(
            C(bolt, g + 2 * clearance, z - half - clearance),
            C(bolt * 1.7, bolt * 0.6, z - half - clearance - bolt * 0.6),
          ),
          x,
          y,
        ),
        0xb2b9c0,
      );
    }
  }
  return finish(out, state);
}
