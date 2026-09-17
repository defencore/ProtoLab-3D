import type { Parameters } from '../../../core/types';
import { union, subtract, ring } from './shapes';
import { C, hex, move } from './helpers';
import type { Piece } from './assembly';
export function pieces(p: Parameters, state: string): Piece[] {
  const D = +p.outer,
    Cw = +p.width,
    lip = +p.lip,
    B = Cw + 2 * lip,
    e = +p.eccentricity;
  const journal = Math.max(+p.stud, D * 0.48),
    bore = D * 0.72;
  const rollerRadius = (bore - journal) / 4 - 0.04,
    pitch = (bore + journal) / 4;
  const along = (s: Piece): Piece => ({ ...s, angle: +p.angle });
  const stud = subtract(
    union(
      C(D * 0.71, lip),
      C(journal, Cw, lip),
      C(D * 0.71, lip, lip + Cw),
      C(+p.stud, +p.studLength, B),
    ),
    hex(+p.hex, Math.min(2, Cw / 4) + 1, -1),
  );
  const result: Piece[] = [
    { label: 'Stud · hex socket · nominal thread envelope', color: 0xa8afb8, shape: move(stud, e) },
    {
      label: 'Cylindrical outer roller',
      color: 0xc2c8cf,
      shape: ring(D / 2, bore / 2, lip, Cw, e),
      z: state === 'exploded' ? -B * 2 : 0,
    },
    {
      label: 'Eccentric mounting collar',
      color: 0x8e98a5,
      shape: subtract(
        C(+p.collar, +p.collarLength, B),
        C(+p.stud + 0.04, +p.collarLength + 2, B - 1, e),
      ),
      z: state === 'exploded' ? B * 2 : 0,
    },
  ];
  for (let i = 0; i < 12; i++) {
    const a = (2 * Math.PI * i) / 12;
    result.push({
      label: `Needle roller ${i + 1}`,
      color: 0xb9c1cb,
      shape: C(
        2 * rollerRadius,
        Cw - 0.7,
        lip + 0.35,
        e + pitch * Math.cos(a),
        pitch * Math.sin(a),
      ),
    });
  }
  if (state !== 'open') {
    const sealed = p.closure === 'sealed',
      t = sealed ? 0.25 : 0.16;
    for (const side of [0, 1])
      result.push({
        label: (side ? 'Rear ' : 'Front ') + (sealed ? 'rubber seal' : 'metal shield'),
        color: sealed ? 0x242a30 : 0x8c949e,
        shape: ring(bore / 2 - 0.02, journal / 2 + 0.02, lip + (side ? Cw - t : 0), t, e),
        z: state === 'exploded' ? (side ? B * 3 : -B * 3) : 0,
      });
  }
  return result.map(along);
}
