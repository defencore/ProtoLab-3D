import type { Parameters } from '../../../core/types';
import models from './models.json';
import { box, cylinder, subtract } from './shapes';
import type { Piece } from './assembly';
export function controlSpec(p: Parameters) {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown control component');
  return m;
}
export function controlPieces(p: Parameters): Piece[] {
  const m = controlSpec(p),
    { w, h, d } = m;
  if (m.kind === 'cnc') {
    const parts: Piece[] = [
      {
        label: 'DDCS v4.1 rear enclosure · connector clearance not included',
        color: 0x363c42,
        shape: box([216, 43, 132], [-108, 0, 10.85]),
      },
      {
        label: 'DDCS v4.1 fascia · 237 x 153.7 x 5.2',
        color: 0x343a40,
        shape: box([w, 5.2, h], [-w / 2, 43, 0]),
      },
      {
        label: '7-inch display · illustrative screen area',
        color: 0x204b61,
        shape: box([155, 0.2, 87], [-104, 48, 43]),
      },
    ];
    for (let i = 0; i < 17; i++) {
      const left = i < 7;
      parts.push({
        label: `DDCS operation key ${i + 1}`,
        color: i === 16 ? 0xcaa64b : 0x92a4b1,
        shape: box(
          [left ? 18 : 20, 0.2, 12],
          [
            left ? -104 + i * 23 : 63 + (i % 2) * 25,
            48,
            left ? 19 : 31 + Math.floor((i - 7) / 2) * 23,
          ],
        ),
      });
    }
    return parts;
  }
  if (m.kind === 'estop')
    return [
      {
        label: 'XB5AS8444 rear contact blocks · two NC · simplified',
        color: 0x282d30,
        shape: box([30, 47, 34], [-15, 0, 3]),
      },
      {
        label: 'XB5 mounting barrel D22',
        color: 0x363c40,
        shape: cylinder(11, 21, [0, 44, 20], 'y'),
      },
      {
        label: 'XB5 latching emergency mushroom D40',
        color: 0xc92e29,
        shape: cylinder(20, 17, [0, 65, 20], 'y'),
      },
    ];
  const out: Piece[] = [
    { label: `BUY ${m.name} · case`, color: m.color, shape: box([w, d - 4, h], [-w / 2, 0, 0]) },
  ];
  if (m.kind === 'psu') {
    out[0].shape = subtract(
      out[0].shape,
      ...Array.from({ length: 8 }, (_, i) => box([3, d, 50], [-w / 2 + 15 + i * 17, -1, 35])),
    );
    out.push({
      label: 'Terminal strip · illustrative screw positions',
      color: 0x343434,
      shape: box([w - 10, 4, 18], [-w / 2 + 5, d - 4, 5]),
    });
  } else {
    out.push({
      label: 'Front fascia · indicator and connector geometry simplified',
      color: m.kind === 'safety' ? 0xe5ce26 : 0x45505a,
      shape: box([w - 4, 4, h * 0.6], [-w / 2 + 2, d - 4, h * 0.2]),
    });
    out.push({
      label: 'Status indicator',
      color: 0x52bb88,
      shape: box([Math.min(w - 8, 25), 1, 5], [-w / 2 + 4, d - 1, h * 0.7]),
    });
    for (const z of [2, h - 14])
      out.push({
        label: 'Terminal bank · reserve wiring access',
        color: 0x527d66,
        shape: box([w - 4, 4, 12], [-w / 2 + 2, d - 4, z]),
      });
  }
  return out;
}
