import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import {
  B,
  C,
  T,
  torus,
  poly,
  move,
  rotate,
  union,
  cut,
  ring,
  boltCircle,
  teeth,
  link,
  arcBand,
  finish,
} from './helpers';
import type { Shape, Vec } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const detailed = p.detail === 'detailed';
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const l = n(p, 'length'),
    w = n(p, 'width'),
    h = n(p, 'height'),
    b = n(p, 'port');
  let body = B(l, w, h);
  const ports = p.form === '3-2' ? 3 : ['5-2', '5-3'].includes(String(p.form)) ? 5 : 2;
  for (let i = 0; i < ports; i++)
    body = cut(
      body,
      move(rotate(C(b, w + 2), 90), -l * 0.35 + (l * 0.7 * i) / (ports - 1), w / 2 + 1, h / 2),
    );
  body = cut(
    body,
    C(n(p, 'mount'), h + 2, -1, -l * 0.45, -w * 0.3),
    C(n(p, 'mount'), h + 2, -1, l * 0.45, -w * 0.3),
  );
  add('Valve block', body);
  if (['3-2', '5-2', '5-3'].includes(String(p.form)))
    add('Solenoid housing', B(w, w, h * 0.8, l / 2 + w / 2 + 0.2, 0));
  if (p.form === 'frl')
    for (let i = -1; i <= 1; i++)
      add('FRL bowl ' + (i + 2), C(w * 0.65, h * 1.8, -h * 1.8 - 0.2, i * l * 0.3), 0x778f94);
  if (p.form === 'ball') add('Operating lever', B(l * 0.7, w * 0.25, 4, 0, 0, h + 0.2), 0xc95d43);
  if (p.form === 'throttle') add('Metering knob', C(w * 0.55, h * 0.35, h + 0.2), 0x353b43);
  if (p.form === 'relief') add('Adjustment cap', C(w * 0.6, h * 0.8, h + 0.2));
  if (p.form === '5-3') add('Second solenoid', B(w, w, h * 0.8, -l / 2 - w / 2 - 0.2, 0));
  if (p.form === 'ejector') add('Silencer', C(b * 1.4, w, -w - 0.2), 0xb89b57);

  return finish(out, state);
}
