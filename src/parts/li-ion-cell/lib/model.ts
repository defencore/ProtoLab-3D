import type { Parameters } from '../../../core/types';
import models from './models.json';
import { cylinder, ring } from './shapes';
import type { Piece } from './assembly';
interface Cell {
  id: string;
  format: string;
  width: number;
  length: number;
  height: number;
  buttonDiameter?: number;
  buttonHeight?: number;
}
const metal = 0xb9c1c5,
  dark = 0x242931;
export function pieces(p: Parameters): Piece[] {
  const m: Cell | undefined = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown battery model');
  const h = m.height,
    r = m.width / 2;
  const flat = m.format === '18650' || m.format === '21700';
  const button = m.buttonHeight ?? 0.2,
    capZ = h - button;
  const capR = flat ? r * 0.62 : (m.buttonDiameter ?? r) / 2;
  const color = flat ? 0x6693a9 : m.format === 'CR123A' ? 0xbed0d6 : 0x566271;
  return [
    {
      label: 'Sealed can / jacket',
      color,
      shape: {
        kind: 'revolve',
        profile: [
          [0, 0.25],
          [r - 0.25, 0.25],
          [r, 0.5],
          [r, capZ - 0.5],
          [r - 0.25, capZ - 0.25],
          [0, capZ - 0.25],
        ],
      },
    },
    {
      label: 'Negative terminal / bottom rim',
      color: metal,
      shape: cylinder(r - 0.25, 0.25, [0, 0, 0]),
    },
    {
      label: 'Positive end rolled rim',
      color: metal,
      shape: ring(r - 0.25, r - 0.6, capZ - 0.25, 0.25),
    },
    {
      label: 'Positive terminal insulator',
      color: dark,
      shape: ring(r - 0.6, capR, capZ - 0.25, 0.25),
    },
    {
      label: flat ? 'Flat positive terminal' : 'Positive button terminal',
      color: metal,
      shape: {
        kind: 'revolve',
        profile: [
          [0, capZ - 0.25],
          [capR, capZ - 0.25],
          [capR, h - 0.12],
          [capR - 0.12, h],
          [0, h],
        ],
      },
    },
  ];
}
