import type { Parameters } from '../../../core/types';
import models from './models.json';
import type { Piece } from './assembly';
import { box, cylinder, prism, roundedRect, subtract, type Shape, type Vec } from './shapes';

type Model = (typeof models)[number];
type Direction = 'north' | 'south' | 'east' | 'west' | 'top';
const pcb = 0x253d36,
  black = 0x25282d,
  gold = 0xcab477,
  silver = 0xa9b1b7,
  ivory = 0xd9d5c4;

/** Board axes follow the model drawing; all sizes are millimetres. */
export function mountingHoles(m: Model): [number, number][] {
  if (m.layout === 'whoop')
    return [
      [13, 0],
      [0, 13],
      [-13, 0],
      [0, -13],
    ];
  if (m.mountX && m.mountY)
    return [-1, 1].flatMap((x) =>
      [-1, 1].map((y) => [(x * m.mountX!) / 2, (y * m.mountY!) / 2] as [number, number]),
    );
  return [];
}

export function pieces(p: Parameters, state: string): Piece[] {
  const selected = models.find((m) => m.id === p.model);
  if (!selected) throw new Error('Unknown controller model');
  const m: Model = selected;
  const out: Piece[] = [],
    cuts: Shape[] = [];
  const exploded = state === 'exploded';
  const add = (shape: Shape, label: string, color: number, layer = 0) =>
    out.push({ shape, label, color, z: exploded ? layer * 10 : 0 });
  const W = m.width,
    L = m.length,
    H = m.height;

  // Local U follows a connector row, V points toward its opening. Transform boxes
  // directly so preview, exported solids and analytic bounds share one geometry.
  function block(size: Vec, origin: Vec, x: number, y: number, z: number, dir: Direction): Shape {
    const [u, v, t] = origin,
      [a, b, c] = size;
    if (dir === 'east') return box([b, a, c], [x + v, y - u - a, z + t]);
    if (dir === 'west') return box([b, a, c], [x - v - b, y + u, z + t]);
    if (dir === 'south') return box([a, b, c], [x - u - a, y - v - b, z + t]);
    return box(size, [x + u, y + v, z + t]);
  }
  function socket(
    name: string,
    count: number,
    pitch: number,
    x: number,
    y: number,
    z: number,
    dir: Direction,
    layer: number,
    width = (count - 1) * pitch + 3,
    depth = 4,
    height = 3.2,
    metal = false,
  ) {
    const b = (size: Vec, origin: Vec) => block(size, origin, x, y, z, dir);
    const body = b([width, depth, height], [-width / 2, -depth / 2, 0]);
    const hollow =
      dir === 'top'
        ? b([width - 0.8, depth - 0.8, height], [-width / 2 + 0.4, -depth / 2 + 0.4, 0.6])
        : b([width - 0.8, depth, height - 0.8], [-width / 2 + 0.4, -depth / 2 + 0.7, 0.4]);
    add(subtract(body, hollow), name + ' housing', metal ? silver : ivory, layer);
    cuts.push(
      b([width + 0.3, depth + 0.3, height + 0.3], [-width / 2 - 0.15, -depth / 2 - 0.15, -0.15]),
    );
    if (metal) {
      add(
        b(
          [width - 1.6, depth - 1.2, 0.45],
          [-width / 2 + 0.8, -depth / 2 + 0.7, height / 2 - 0.225],
        ),
        name + ' tongue',
        black,
        layer,
      );
    } else
      for (let i = 0; i < count; i++) {
        const u = (i - (count - 1) / 2) * pitch;
        add(
          dir === 'top'
            ? b([0.3, 0.3, height - 1], [u - 0.15, -0.15, 0.6])
            : b([0.3, depth - 1.3, 0.3], [u - 0.15, -depth / 2 + 0.7, height / 2 - 0.15]),
          name + ` contact ${i + 1}`,
          gold,
          layer,
        );
      }
  }
  function chip(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    l: number,
    h: number,
    layer: number,
    color = black,
  ) {
    add(box([w, l, h], [x - w / 2, y - l / 2, z]), name, color, layer);
  }
  function pads(
    name: string,
    count: number,
    x: number,
    y: number,
    z: number,
    pitch: number,
    dir: Direction,
    layer: number,
  ) {
    for (let i = 0; i < count; i++)
      add(
        block([0.9, 1.4, 0.08], [(i - (count - 1) / 2) * pitch - 0.45, -0.7, 0], x, y, z, dir),
        name + ` pad ${i + 1}`,
        gold,
        layer,
      );
  }
  function boardDetail(top: number, bottom: number, whoop: boolean) {
    chip('Processor package', 0, 0, bottom - 1, 6, 6, 1, -1);
    chip('IMU package', -2, 5, top, 3, 3, 0.8, 1);
    chip('OSD package', 0, -4, top, 6, 3, 0.9, 1);
    chip('Blackbox flash', whoop ? -5.5 : -6, 0, top, whoop ? 2 : 3, 4, 1, 1);
    chip('Regulator inductor', 5, 1, top, 3, 3, 1.8, 1, 0x50545b);
    for (const s of [-1, 1])
      for (let j = 0; j < 5; j++)
        chip(
          `Passive ${s}/${j}`,
          -3 + j * 1.5,
          s,
          top,
          0.65,
          1.0,
          0.45,
          1,
          j % 2 ? 0xa99676 : black,
        );
    chip('Boot switch', 3.8, -7, top, 2, 2, 0.8, 1, silver);
    if (!whoop) {
      if (m.layout === 'kakute') {
        pads('Side I/O', 8, -W / 2 + 1.5, -4.8, top, 1.6, 'west', 1);
      } else {
        pads('Front I/O', 8, 0, L / 2 - 1.8, top, 1.6, 'north', 1);
        pads('Rear I/O', 8, 0, -L / 2 + 1.8, top, 1.6, 'north', 1);
      }
      for (let i = 0; i < 3; i++)
        chip(
          `Status LED ${i + 1}`,
          -W / 2 + 1.3,
          2 + i * 2,
          top,
          0.8,
          1.2,
          0.5,
          1,
          [0x6490ca, 0x76aa70, 0xbc6259][i],
        );
    }
  }

  if (m.kind !== 'Cased autopilot') {
    const whoop = m.layout === 'whoop',
      z = m.layout === 'kakute' ? 1.6 : 3.0,
      top = z + m.board;
    // The cross outline and undimensioned whoop bores are illustrative, not
    // inferred square mounting dimensions. Numeric filters omit those values.
    const outline = whoop
      ? prism(
          [
            [-2, 15],
            [-4, 12],
            [-4, 7],
            [-7, 4],
            [-12, 4],
            [-15, 2],
            [-15, -2],
            [-12, -4],
            [-7, -4],
            [-4, -7],
            [-4, -12],
            [-2, -15],
            [2, -15],
            [4, -12],
            [4, -7],
            [7, -4],
            [12, -4],
            [15, -2],
            [15, 2],
            [12, 4],
            [7, 4],
            [4, 7],
            [4, 12],
            [2, 15],
          ],
          m.board,
          z,
        )
      : roundedRect(W, L, 3, z, m.board);
    const holes = mountingHoles(m).map(([x, y]) =>
      cylinder((m.hole ?? m.holeAssumed!) / 2, m.board + 2, [x, y, z - 1]),
    );
    add(subtract(outline, ...holes), 'PCB — fixed outline and mounting bores', pcb);
    boardDetail(top, z, whoop);
    if (whoop) {
      socket('Micro USB', 0, 0, 0, -9.5, 0, 'south', -1, 7.6, 4, 3, true);
      for (const s of [-1, 1])
        for (const t of [-1, 1]) {
          const name = `Motor ${s < 0 ? (t < 0 ? 1 : 2) : t < 0 ? 3 : 4}`;
          if (m.motorSockets)
            socket(name, 3, 1.25, s * 9, t * 2.8, 0, t > 0 ? 'north' : 'south', -1, 5.6, 2.2, 3);
          else pads(name, 3, s * 9, t * 2.8, z - 0.08, 1.25, 'north', -1);
          chip(name + ' ESC MOSFET bank', s * 9, t * 1.8, top, 4, 1.2, 0.7, 1);
        }
      // Clear of the upper mounting bore and its component-free annulus.
      chip('Receiver RF package', 0, 8.4, top, 3.8, 3, 1, 1);
      pads('Power and video', 4, 0, -8.5, top, 1.4, 'north', 1);
    } else {
      const usbHeight = H - top;
      socket(m.usb ?? 'USB', 0, 0, W / 2 - 3, 0, top, 'east', 1, 8.8, 6, usbHeight, true);
      if (m.layout === 'mini')
        socket('ESC · SH 8-pin', 8, 1, 0, L / 2 - 3, 0, 'north', -1, 10, 4, 3);
      else if (m.layout === 'v4') {
        socket('ESC · SH 8-pin', 8, 1, -W / 2 + 2.5, 0, 0, 'west', -1, 10, 4, 3);
        socket('HD VTX · SH 6-pin', 6, 1, W / 2 - 2.5, 0, 0, 'east', -1, 8, 4, 3);
        socket('microSD slot', 0, 0, 0, -10, 0, 'south', -1, 12, 10, 2.0, true);
      } else {
        socket('ESC · SH 8-pin', 8, 1, 0, L / 2 - 3.2, top, 'north', 1, 10, 4, usbHeight);
        socket('HD VTX · SH 6-pin', 6, 1, 0, -L / 2 + 3.2, top, 'south', 1, 8, 4, usbHeight);
        // Lower face component fixes the published six-millimetre envelope.
        chip('Lower regulator package', -6, 5, 0, 3, 3, 1.6, -1, 0x50545b);
      }
    }
  } else {
    const standard = m.layout === 'pixhawk',
      miniB = m.layout === 'pixhawk-mini-b';
    const boardZ = 2.0;
    add(roundedRect(W - 3, L - 3, 2, boardZ, m.board), 'Internal PCB envelope', pcb);
    chip('Processor envelope', 0, 0, boardZ + m.board, 8, 8, 1, 1);
    if (standard) {
      // Top-facing ports arranged as in the 6C pinout, not the Mini layout.
      const rows: [string, number, number, number][] = [
        ['POWER1', 6, -13, 1],
        ['DSM · ZH', 3, 1, 1],
        ['USB breakout', 4, 14, 1],
        ['POWER2', 6, -13, -6.5],
        ['GPS2', 6, 1, -6.5],
        ['CAN1', 4, 14, -6.5],
        ['GPS1', 10, -10, -14],
        ['SBUS OUT', 3, 4, -14],
        ['CAN2', 4, 14, -14],
        ['TELEM1', 6, -13, -21.5],
        ['TELEM2', 6, 0, -21.5],
        ['TELEM3', 6, 13, -21.5],
        ['PPM / SBUS RC', 5, -6, -29],
        ['I2C', 4, 7, -29],
        ['FMU PWM OUT', 10, -11, -36],
        ['I/O PWM OUT', 10, 11, -36],
      ];
      rows.forEach(([name, n, x, y]) =>
        socket(
          name,
          n,
          name.includes('ZH') ? 1.5 : 1.25,
          x,
          y,
          H - 3.5,
          'top',
          2,
          undefined,
          4,
          3.5,
        ),
      );
      socket('FMU Debug · SH', 10, 1, -W / 2 + 2, 23, 5, 'west', 1, 12, 4, 3.5);
      socket('I/O Debug · SH', 10, 1, W / 2 - 2, 23, 5, 'east', 1, 12, 4, 3.5);
      socket('USB-C', 0, 0, W / 2 - 2, 0, 4.7, 'east', 1, 8.8, 4, 3.2, true);
      socket('microSD slot', 0, 0, 0, -L / 2 + 2, 4.5, 'south', 1, 12, 4, 2, true);
    } else {
      for (const [name, n, x, z] of [
        ['POWER', 6, -12, 10.5],
        ['TELEM2', 6, 0, 10.5],
        ['TELEM1', 6, 12, 10.5],
        ['GPS1', 10, -9, 5.5],
        ['CAN2', 4, 5, 5.5],
        ['CAN1', 4, 14, 5.5],
      ] as [string, number, number, number][])
        socket(name, n, 1.25, x, L / 2 - 2, z, 'north', 1, undefined, 4, 3.6);
      socket('FMU Debug · SH', 6, 1, -W / 2 + 2, 9, 5.5, 'west', 1, 8, 4, 3.3);
      socket('USB-C', 0, 0, -W / 2 + 2, 9, 10.5, 'west', 1, 8.8, 4, 3.3, true);
      socket('I2C', 4, 1.25, -W / 2 + 2, -3, 5.5, 'west', 1, 7, 4, 3.3);
      socket('GPS2', 6, 1.25, -W / 2 + 2, -3, 10.5, 'west', 1, 9.25, 4, 3.3);
      socket('DSM · ZH', 3, 1.5, W / 2 - 2, 9, 7, 'east', 1, 6, 4, 3.3);
      socket('RSSI', 3, 1.25, W / 2 - 2, -3, 7, 'east', 1, 5.5, 4, 3.3);
      function header(
        name: string,
        n: number,
        x: number,
        y: number,
        z: number,
        rows: number,
        dir: Direction,
      ) {
        const w = (n - 1) * 2.54 + 2.6,
          d = dir === 'top' ? rows * 2.54 + 1 : 6,
          h = dir === 'top' ? 5 : rows * 2.54 + 1;
        const b = (size: Vec, origin: Vec) => block(size, origin, x, y, z, dir);
        const body = b([w, d, dir === 'top' ? 1.5 : h], [-w / 2, -d / 2, 0]);
        add(body, name + ' insulator', black, 2);
        cuts.push(b([w + 0.3, d + 0.3, h + 0.3], [-w / 2 - 0.15, -d / 2 - 0.15, -0.15]));
        for (let r = 0; r < rows; r++)
          for (let i = 0; i < n; i++) {
            const u = (i - (n - 1) / 2) * 2.54;
            // Pins emerge from the insulator surface, avoiding intersecting solids.
            add(
              dir === 'top'
                ? b([0.64, 0.64, 3.5], [u - 0.32, (r - (rows - 1) / 2) * 2.54 - 0.32, 1.5])
                : b([0.64, 3.5, 0.64], [u - 0.32, d / 2, (r + 0.5) * 2.54 + 0.18]),
              name + ` pin ${r + 1}/${i + 1}`,
              gold,
              2,
            );
          }
      }
      if (miniB) {
        header('MAIN 1–8 + AUX 1–4', 12, 0, -L / 2 + 12, H - 5, 3, 'top');
        for (const [name, x] of [
          ['AUX5', -11],
          ['AUX6', 0],
          ['RC IN', 11],
        ] as [string, number][])
          header(name, 3, x, -L / 2 + 4, H - 5, 1, 'top');
      } else {
        // End-facing contacts terminate at the overall case envelope.
        header('MAIN 1–8 + AUX 1–4', 12, 0, -L / 2 + 6.5, 8.5, 3, 'south');
        for (const [name, x] of [
          ['AUX5', -11],
          ['AUX6', 0],
          ['RC IN', 11],
        ] as [string, number][])
          header(name, 3, x, -L / 2 + 6.5, 4, 1, 'south');
        // Connector exit needs a tunnel beyond the recessed insulator.
        cuts.push(box([33, 7, 13], [-16.5, -L / 2, 3.8]));
      }
    }
    const arrowY = standard ? L * 0.34 : 2;
    const arrow = prism(
      [
        [-2.5, arrowY - 2],
        [0, arrowY + 5],
        [2.5, arrowY - 2],
        [0, arrowY - 0.5],
      ],
      0.08,
      H - 0.08,
    );
    const lid = roundedRect(W, L, 2, H - 0.9, 0.9);
    add(subtract(lid, ...cuts, arrow), 'Case lid', 0x32383e, 3);
    add(arrow, 'Forward orientation inlay', silver, 3);
    add(
      subtract(roundedRect(W, L, 2, 0, H - 0.9), roundedRect(W - 2, L - 2, 1, 1, H), ...cuts),
      'Case shell',
      0x454b51,
      -1,
    );
  }
  return out;
}
