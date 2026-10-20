import { markSupplierUnit } from '../../../core/supplier-components';
import type { Parameters } from '../../../core/types';
import models from './models.json';
import { box, cylinder, subtract } from '../../../core/assembly/mechanical/shapes';
import { controlMounting } from './mounting';
import type { Piece } from '../../../core/assembly/mechanical/assembly';
export function controlSpec(p: Parameters) {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown control component');
  return m;
}
function buildControlPieces(p: Parameters): Piece[] {
  const m = controlSpec(p),
    { w, h, d } = m;
  if (m.kind === 'cnc') {
    const isV4 = m.id === 'ddcs-v4-1';
    const rearW = isV4 ? 216 : 175;
    const rearH = isV4 ? 132 : 110;
    const fascia = isV4 ? 5.2 : 5;
    const rearD = d - fascia;
    const parts: Piece[] = [
      {
        label: `${m.name} rear enclosure · connector clearance not included`,
        color: 0x363c42,
        shape: box([rearW, rearD, rearH], [-rearW / 2, 0, (h - rearH) / 2]),
      },
      {
        label: `${m.name} fascia`,
        color: 0x343a40,
        shape: box([w, fascia, h], [-w / 2, rearD, 0]),
      },
      {
        label: 'Display · illustrative screen area',
        color: 0x204b61,
        shape: box([w * 0.65, 0.2, h * 0.52], [-w * 0.44, d - 0.2, h * 0.28]),
      },
    ];
    for (let i = 0; i < 17; i++) {
      const left = i < 7;
      parts.push({
        label: `DDCS operation key ${i + 1}`,
        color: i === 16 ? 0xcaa64b : 0x92a4b1,
        shape: box(
          [left ? w * 0.075 : w * 0.083, 0.2, h * 0.078],
          [
            left ? -w * 0.44 + i * w * 0.096 : w * 0.266 + (i % 2) * w * 0.105,
            d - 0.2,
            left ? h * 0.123 : h * 0.202 + Math.floor((i - 7) / 2) * h * 0.148,
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
        label: 'Supplied XB5 plastic fixing collar and clamp; detailed contour illustrative',
        color: 0x363c40,
        shape: subtract(
          box([30, 18 - Number(p.panelThickness), 43], [-15, 47, -1.5]),
          cylinder(11, 20, [0, 46, 20], 'y'),
        ),
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
  const mounting = controlMounting(p);
  if (mounting.kind === 'rear-tabs') {
    out[0].shape = subtract(
      out[0].shape,
      ...mounting.holes.flatMap(([x, , z]) => [
        cylinder(2.5, 3.2, [x, -0.1, z], 'y'),
        cylinder(5, d, [x, 3, z], 'y'),
      ]),
    );
  }
  if (mounting.kind === 'din-rail') {
    out[0].shape = subtract(
      out[0].shape,
      box([w + 2, 7.5, 35.2], [-w / 2 - 1, 2, mounting.centerZ - 17.6]),
    );
  }
  if (m.kind === 'psu') {
    out[0].shape = subtract(
      out[0].shape,
      ...Array.from({ length: 8 }, (_, i) => box([3, d, 50], [-w / 2 + 15 + i * 17, -1, 35])),
    );
    if (mounting.kind === 'rear-taps')
      out[0].shape = subtract(
        out[0].shape,
        ...mounting.holes.map(([x, , z]) => ({
          ...cylinder(1.5, 3, [x, 0, z], 'y'),
          thread: { pitch: 0.5, internal: true, radialClearance: 0.05, designation: 'M3' },
        })),
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

export function controlPieces(p: Parameters): Piece[] {
  const items = buildControlPieces(p);
  markSupplierUnit(
    items.map((item) => item.shape),
    {
      name: 'Machine control device',
      libraryId: 'machine-control',
      parameters: { ...p },
      state: 'default',
    },
  );
  return items;
}
