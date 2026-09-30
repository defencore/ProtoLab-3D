import type { Parameters } from '../../../core/types';
import { cylinder, prism, subtract } from './shapes';
import type { Piece } from './assembly';
export function bladeSpec(p: Parameters) {
  return { diameter: 500, kerf: 4, body: 3.4, teeth: 120, bore: p.model === 'lu5h50002' ? 32 : 30 };
}
export function bladePieces(p: Parameters): Piece[] {
  const s = bladeSpec(p);
  const outline: [number, number][] = Array.from({ length: 480 }, (_, i) => {
    const a = ((i - 1) * Math.PI) / 240,
      r = i % 4 === 0 || i % 4 === 3 ? 243 : 250;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  return [
    {
      label: `BUY Freud ${p.model === 'lu5h50002' ? 'LU5H50002' : 'LU5H50001'} · D500 bore${s.bore} kerf4 body3.4 Z120`,
      color: 0xbac1c8,
      shape: subtract(
        prism(outline, 4, -2),
        cylinder(s.bore / 2, 6, [0, 0, -3]),
        ...[-1, 1].flatMap((sign) => [
          cylinder(5.5, 6, [sign * 31.5, 0, -3]),
          cylinder(5.5, 6, [0, sign * 35, -3]),
        ]),
        cylinder(242, 0.4, [0, 0, 1.7]),
        cylinder(242, 0.4, [0, 0, -2.1]),
      ),
    },
  ];
}
