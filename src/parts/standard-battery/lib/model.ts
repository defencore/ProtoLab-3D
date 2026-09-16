import type { Parameters } from '../../../core/types';
import models from './models.json';
import { cylinder, ring, roundedRect, prism, subtract } from './shapes';
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
  if (m.format === '9V PP3') {
    const hex: [number, number][] = Array.from({ length: 6 }, (_, i) => [
      -6.35 + 4.1 * Math.cos((i * Math.PI) / 3),
      4.1 * Math.sin((i * Math.PI) / 3),
    ]);
    return [
      {
        label: 'Sealed rectangular jacket',
        color: 0x929da6,
        shape: roundedRect(m.width, m.length, 1.4, 0, 42.4),
      },
      {
        label: 'Upper jacket band',
        color: dark,
        shape: roundedRect(m.width, m.length, 1.4, 42.4, 3.5),
      },
      {
        label: 'Insulating terminal deck',
        color: 0x535044,
        shape: roundedRect(m.width - 0.7, m.length - 0.7, 1, 45.9, 0.5),
      },
      {
        label: 'Positive male snap (approximate contact profile)',
        color: metal,
        shape: cylinder(2.6, 2.1, [6.35, 0, 46.4]),
      },
      {
        label: 'Negative female snap (approximate contact profile)',
        color: metal,
        shape: subtract(prism(hex, 2.1, 46.4), cylinder(2.8, 2.2, [-6.35, 0, 46.8])),
      },
    ];
  }
  if (m.format === 'CR2032')
    return [
      {
        label: 'Positive sealed coin can',
        color: metal,
        shape: {
          kind: 'revolve',
          profile: [
            [0, 0],
            [9.6, 0],
            [10, 0.3],
            [10, 2.7],
            [9.7, 3.05],
            [9.1, 3.05],
            [9.1, 2.55],
            [0, 2.55],
          ],
        },
      },
      { label: 'Annular insulating gasket', color: dark, shape: ring(9.1, 8.85, 2.55, 0.55) },
      {
        label: 'Negative coin terminal',
        color: 0xa5adaf,
        shape: cylinder(8.85, 0.65, [0, 0, 2.55]),
      },
    ];
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
