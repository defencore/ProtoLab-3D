import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import type { Piece } from './assembly';
import { B, C, poly, move, rotate, union, cut, ring, boltCircle, finish } from './helpers';
import { gear, profile, miter } from './gears';
import type { Shape } from './shapes';
export function pieces(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x87919c) => out.push({ label, shape, color });
  const d = n(p, 'diameter'),
    l = n(p, 'length'),
    s = n(p, 'shaft'),
    ext = n(p, 'shaftLength');
  const cap = Math.min(l * 0.06, d * 0.05),
    clear = Math.min(0.2, d * 0.002),
    input = s * 0.7;
  const planetary = p.form === 'planetary',
    parallel = p.form === 'parallel';
  const outputX = parallel ? -d * 0.18 : 0,
    inputX = parallel ? d * 0.18 : 0;
  let housing = planetary
    ? ring(d, d * 0.88, l - 2 * cap, cap)
    : cut(B(d, d, l - 2 * cap, 0, 0, cap), B(d * 0.9, d * 0.9, l + 2, 0, 0, -1));
  const end = (z: number) =>
    boltCircle(
      planetary ? C(d, cap, z) : B(d, d, cap, 0, 0, z),
      n(p, 'mountPitch'),
      n(p, 'mountHole'),
      4,
      cap + 2,
      z - 1,
    );
  let rear = cut(end(0), C(input + 2 * clear, cap + 2, -1, inputX));
  let front = cut(end(l - cap), C(s + 2 * clear, cap + 2, l - cap - 1, outputX));
  if (!planetary && !parallel) {
    rear = end(0);
    housing = cut(housing, move(rotate(C(input + 2 * clear, d), 0, 90), 0, 0, l / 2));
  }
  if (state !== 'internals') {
    add('Rear mounting cover', rear, 0x555f6b);
    add('Front output cover', front, 0x555f6b);
  }
  if (p.detail !== 'detailed' && state !== 'internals') {
    add('Housing envelope', housing);
    add('Output shaft', C(s, ext + cap, l - cap, outputX));
    add(
      'Input shaft',
      parallel || planetary
        ? C(input, ext + cap, -ext, inputX)
        : move(rotate(C(input, ext + d * 0.05), 0, 90), d * 0.45, 0, l / 2),
    );
    return finish(out, state);
  }
  if (parallel) {
    const m = (d * 0.36) / 30,
      width = Math.min((l - 2 * cap) * 0.5, d * 0.18),
      z = (l - width) / 2;
    add('Input pinion · 20 teeth', move(gear(m, 20, input, width, z), inputX), 0xb5a070);
    add(
      'Output wheel · 40 teeth',
      move(rotate(gear(m, 40, s, width, z), 0, 0, 4.5), outputX),
      0xb5a070,
    );
    add('Input shaft', C(input, l - cap + ext, -ext, inputX));
    add('Output shaft', C(s, l - cap + ext, cap, outputX));
    // Journals at both ends, fitted inside the separate end covers.
    for (const [x, diam] of [
      [inputX, input],
      [outputX, s],
    ]) {
      for (const z0 of [cap, l - cap - cap * 0.6])
        add(
          'Shaft journal bushing',
          move(ring(diam * 1.5, diam + 2 * clear, cap * 0.6, z0), x),
          0xc9b681,
        );
    }
  } else if (planetary) {
    const count = n(p, 'stages'),
      span = (l - 2 * cap) / count,
      m = (d * 0.78) / 54,
      orbit = 18 * m,
      width = span * 0.55;
    const cavities: Shape[] = [];
    let previous = cap;
    for (let stage = 0; stage < count; stage++) {
      const z = cap + stage * span + span * 0.08,
        plateZ = z + width + clear,
        plateH = span * 0.13;
      const inner = rotate(poly(profile(m, 54, true), width + 2, z - 1), 0, 0, 180 / 54);
      if (state === 'internals')
        add(
          `Stage ${stage + 1} · fixed ring (54 teeth)`,
          cut(
            {
              kind: 'cylinder',
              radius: d * 0.425,
              height: width,
              origin: [0, 0, z],
              axis: 'z',
              segments: 192,
            },
            inner,
          ),
        );
      cavities.push(
        C(d * 0.88, z - previous + 0.02, previous - 0.01),
        rotate(poly(profile(m, 54, true), width + 0.02, z - 0.01), 0, 0, 180 / 54),
      );
      previous = z + width;
      add(`Stage ${stage + 1} · sun (18 teeth)`, gear(m, 18, input, width, z), 0xb5a070);
      const pin = Math.min(m * 4, s * 0.5);
      let carrier = C(d * 0.74, plateH, plateZ);
      for (let k = 0; k < 3; k++) {
        const angle = (k * 2 * Math.PI) / 3,
          x = orbit * Math.cos(angle),
          y = orbit * Math.sin(angle);
        add(
          `Stage ${stage + 1} · planet ${k + 1} (18 teeth)`,
          move(rotate(gear(m, 18, pin + 2 * clear, width, z), 0, 0, 10), x, y),
          0xb5a070,
        );
        carrier = union(carrier, C(pin, width + clear + plateH, z, x, y));
      }
      const stemEnd =
        stage === count - 1 ? l + ext : cap + (stage + 1) * span + span * 0.08 + width;
      carrier = union(carrier, C(stage === count - 1 ? s : input, stemEnd - plateZ, plateZ));
      add(`Stage ${stage + 1} · carrier and output`, carrier, 0x657383);
      if (stage === 0) add('Input shaft', C(input, z + width + ext, -ext));
    }
    cavities.push(C(d * 0.88, l - cap - previous + 0.02, previous - 0.01));
    housing = cut(C(d, l - 2 * cap, cap), ...cavities);
  } else {
    const R = d * 0.24,
      width = R * 0.32;
    add(
      'Input miter gear · 20 teeth',
      move(rotate(miter(R, width, 20, input + 2 * clear), 0, -90), 0, 0, l / 2),
      0xb5a070,
    );
    add(
      'Output miter gear · 20 teeth',
      move(rotate(miter(R, width, 20, s + 2 * clear), 180, 0, 9), 0, 0, l / 2),
      0xb5a070,
    );
    add(
      'Input shaft',
      move(rotate(C(input, d / 2 + ext - (R - width)), 0, 90), R - width, 0, l / 2),
    );
    add('Output shaft', C(s, l / 2 + ext - (R - width), l / 2 + R - width));
  }
  if (state !== 'internals') add('Gearcase and fixed ring gears', housing);
  return finish(out, state);
}
