import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/electronics/assembly';
import { box, cylinder, roundedRect, subtract } from '../../../core/assembly/electronics/shapes';
import data from './models.json';

export interface ComputeModule5Model {
  id: string;
  name: string;
  family: 'compute-module-5';
  ramGB: number;
  emmcGB: number;
  wireless: boolean;
}

export const cm5Models = data.filter(
  (model) => 'family' in model && model.family === 'compute-module-5',
) as unknown as ComputeModule5Model[];

/** Centered PCB XY datum; Z=0 is the nominal underside of the 1.24 mm PCB. */
export const cm5Mechanical = {
  width: 55,
  length: 40,
  board: 1.24,
  cornerRadius: 3,
  holeDiameter: 2.7,
  holes: [
    [-24, -16.5],
    [24, -16.5],
    [-24, 16.5],
    [24, 16.5],
  ],
  connectors: [
    { x: -2.5, y: -17, width: 21.52, length: 2.97, bottom: -1.11 },
    { x: -2.5, y: 17, width: 21.52, length: 2.97, bottom: -1.11 },
  ],
  // Carrier PCB top to module PCB underside, not the contact mating plane.
  stacking: [
    { carrierConnector: '10164227-1001A1RLF', pcbGap: 1.5, nominalTop: 4.94 },
    { carrierConnector: '10164227-1004A1RLF', pcbGap: 4, nominalTop: 7.44 },
  ],
  sourceUrl: 'https://datasheets.raspberrypi.com/cm5/cm5-datasheet.pdf',
  designUrl: 'https://pip.raspberrypi.com/categories/1096-design-files',
  sourceStepSha256: '6adc64e5f69b2799b65d56c94b3543bad136fa4191cadaba0aa0e49fa345598f',
} as const;

export function cm5Pieces(p: Parameters, state: string): Piece[] {
  const model = cm5Models.find((model) => model.id === p.model);
  if (!model) throw new Error('Unknown Compute Module 5 order code');
  const out: Piece[] = [];
  const add = (shape: Piece['shape'], label: string, color: number, layer: number) =>
    out.push({ shape, label, color, z: state === 'exploded' ? layer * 10 : 0 });
  const pcb = cm5Mechanical.board;
  const packageBody = (
    label: string,
    x: number,
    y: number,
    width: number,
    length: number,
    height: number,
    color = 0x25282c,
    bottom: number = pcb,
  ) =>
    add(
      box([width, length, height], [x - width / 2, y - length / 2, bottom]),
      label,
      color,
      bottom < 0 ? -1 : 1,
    );

  add(
    subtract(
      roundedRect(55, 40, 3, 0, pcb),
      ...cm5Mechanical.holes.map(([x, y]) => cylinder(1.35, pcb + 2, [x, y, -1])),
    ),
    'CM5 PCB — 55 × 40 mm; four M2.5 clearance holes',
    0x205647,
    0,
  );
  // The large XY package envelopes come from CM5R5 STEP. The SoC height and
  // PCB thickness use the datasheet nominal values rather than source layers.
  packageBody(
    'BCM2712 processor — nominal 2.2 mm above PCB',
    4.4875,
    -3.025,
    17,
    17,
    2.2,
    0x9da4ac,
  );
  packageBody('LPDDR4x memory — package envelope', 20.8875, 1.75, 12, 12, 1.2);
  packageBody('RP1 I/O controller — package envelope', 4.48974, 11.53056, 14.5, 10, 0.625);
  packageBody('Gigabit Ethernet PHY — package envelope', -17.4625, -10.575, 6, 6, 0.75);
  packageBody('Power management — package envelope', 23.1125, -9.4, 7, 7, 0.9);
  if (model.emmcGB > 0)
    packageBody(
      'eMMC storage — underside package envelope',
      -13.5625,
      6.725,
      13,
      11.5,
      0.83,
      0x25282c,
      -0.83,
    );
  if (model.wireless) {
    packageBody('Wireless module shield — envelope', -13.9125, 8.325, 11.3, 14, 1.8, 0xaab4bc);
    add(cylinder(1.55, 1.25, [-24.933, 11, pcb]), 'External antenna U.FL — envelope', 0xc6ab68, 1);
    packageBody('PCB antenna region — illustrative copper', -24.25, 4, 5.5, 9.5, 0.03, 0xc6ab68);
  }

  for (const [index, connector] of cm5Mechanical.connectors.entries()) {
    const { x, y, width, length, bottom } = connector;
    add(
      subtract(
        box([width, length, -bottom], [x - width / 2, y - length / 2, bottom]),
        box(
          [width - 1.2, length - 0.8, 0.75],
          [x - width / 2 + 0.6, y - length / 2 + 0.4, bottom - 0.01],
        ),
      ),
      `CM5 underside 100-pin B2B ${index + 1} — source-positioned envelope`,
      0x25282c,
      -1,
    );
    if (p.detail === 'full') {
      // Contact pitch is nominal; tiny contact profiles are illustrative.
      for (let column = 0; column < 50; column++)
        for (let row = 0; row < 2; row++)
          add(
            box(
              [0.15, 0.24, 0.28],
              [x + (column - 24.5) * 0.4 - 0.075, y + (row ? 0.56 : -0.8), bottom + 0.25],
            ),
            `B2B ${index + 1} illustrative contact ${column * 2 + row + 1}`,
            0xc6ab68,
            -1,
          );
    }
  }
  return out;
}
