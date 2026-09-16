import { n } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import { cylinder, subtract, prism, type Shape } from './shapes';
import type { Piece } from './assembly';
export function pieces(p: Parameters, state: string): Piece[] {
  const d = n(p, 'diameter'),
    r = d / 2,
    L = n(p, 'length'),
    nose = n(p, 'noseLength'),
    body = L - nose,
    t = n(p, 'wall');
  const tube = subtract(cylinder(r, body, [0, 0, 0]), cylinder(r - t, body + 2, [0, 0, -1]));
  const result: Piece[] = [{ label: 'Airframe tube', shape: tube, color: 0xd8e0e5 }];
  if (state === 'body') return result;
  const outer: [number, number][] = [
    [0, body],
    [r, body],
  ];
  for (let i = 1; i <= 20; i++) {
    const u = i / 20;
    outer.push([p.nose === 'conical' ? r * (1 - u) : r * Math.sqrt(1 - u * u), body + nose * u]);
  }
  const cap: Shape = { kind: 'revolve', profile: outer };
  const inner: [number, number][] = [
    [0, body - 1],
    [r - t, body - 1],
    [r - t, body],
  ];
  for (let i = 1; i <= 20; i++) {
    const u = i / 20;
    inner.push([
      p.nose === 'conical' ? (r - t) * (1 - u) : (r - t) * Math.sqrt(1 - u * u),
      body + (nose - t) * u,
    ]);
  }
  result.push({
    label: 'Nose shell',
    shape: subtract(cap, { kind: 'revolve', profile: inner }),
    color: 0xe8a161,
    z: state === 'exploded' ? d : 0,
  });
  const root = n(p, 'finRoot'),
    tip = n(p, 'finTip'),
    span = n(p, 'finSpan'),
    sweep = n(p, 'finSweep'),
    thick = n(p, 'finThickness');
  for (let i = 0; i < n(p, 'finCount'); i++)
    result.push({
      label: `Fin ${i + 1}`,
      shape: prism(
        [
          [r, 0],
          [r + span, sweep],
          [r + span, sweep + tip],
          [r, root],
        ],
        thick,
        -thick / 2,
        'y',
      ),
      color: i % 2 ? 0x515963 : 0xe8a161,
      angle: (i * 360) / n(p, 'finCount'),
      z: state === 'exploded' ? -d : 0,
    });
  return result;
}
