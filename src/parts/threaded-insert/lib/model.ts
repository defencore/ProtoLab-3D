import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { C, union, cut, ring, teeth, finish } from './helpers';
export function pieces(p: Parameters, state: string): Piece[] {
  const d = n(p, 'diameter'),
    b = n(p, 'bore'),
    l = n(p, 'length'),
    f = n(p, 'flange');
  const flangeH = Math.min(l * 0.18, 2);
  let body = C(d, l);
  if (p.form === 'heat') {
    body = cut(body, ring(d + 1, d * 0.86, l * 0.16, l * 0.42));
    if (p.detail === 'detailed')
      body = union(
        body,
        teeth(d * 0.46, d * 0.55, 20, l * 0.3, l * 0.06),
        teeth(d * 0.46, d * 0.55, 20, l * 0.3, l * 0.64),
      );
  } else if (p.form === 'rivnut') {
    body = union(body, C(f, flangeH));
    // Open collapse sleeve precedes the shorter threaded nose.
    body = cut(body, C(d * 0.78, l * 0.65, -0.01));
    if (p.detail === 'detailed')
      body = union(body, teeth(d * 0.47, d * 0.52, 24, l * 0.4, flangeH));
  } else if (p.form === 'clinch') {
    body = union(C(d, flangeH * 1.8), C(f, l - flangeH * 1.8, flangeH * 1.8));
    body = cut(body, ring(d + 1, d * 0.86, flangeH * 0.4, flangeH * 0.6));
    if (p.detail === 'detailed')
      body = union(body, teeth(d * 0.46, d * 0.56, 16, flangeH * 0.5, flangeH * 1.2));
  } else {
    body = union(body, C(f, flangeH));
    if (p.detail === 'detailed')
      body = union(
        C(f, flangeH),
        teeth(d * 0.48, d * 0.53, 20, l - flangeH + 0.01, flangeH - 0.01),
      );
  }
  return finish(
    [
      {
        label: 'Insert body · nominal thread bore',
        shape: cut(body, C(b, l + 2, -1)),
        color: 0xb6a16c,
      },
    ],
    state,
  );
}
