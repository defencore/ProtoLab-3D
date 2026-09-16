import type { Parameters } from '../../../core/types';
import models from './models.json';
import { roundedRect, subtract } from './shapes';
import type { Piece } from './assembly';
export function pieces(p: Parameters): Piece[] {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown battery model');
  const { width: w, length: l, height: h } = m;
  const r = Math.min(1.2, w / 10);
  const label = roundedRect(w * 0.76, l * 0.66, 0.6, h - 0.2, 0.2);
  return [
    {
      label: 'Sealed pack / shrink sleeve',
      color: 0x252b32,
      shape: roundedRect(w, l, r, 0.3, h - 0.6),
    },
    { label: 'Bottom wrapper fold', color: 0x484d53, shape: roundedRect(w, l, r, 0, 0.3) },
    {
      label: 'Top wrapper fold',
      color: 0x484d53,
      shape: subtract(
        roundedRect(w, l, r, h - 0.3, 0.3),
        roundedRect(w * 0.76, l * 0.66, 0.6, h - 0.2, 0.3),
      ),
    },
    {
      label: 'Illustrative label area',
      color: m.chemistry === 'LiHV' ? 0x91b453 : 0xe8b75a,
      shape: label,
    },
  ];
}
