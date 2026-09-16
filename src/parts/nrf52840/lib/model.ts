import type { Parameters } from '../../../core/types';
import data from './models.json';
import type { Piece } from './assembly';
import { box, cylinder, prism, roundedRect, subtract, type Shape, type Vec } from './shapes';
interface Detail {
  kind: string;
  name: string;
  x: number;
  y: number;
  z: number;
  w: number;
  l: number;
  h: number;
  color?: number;
  count?: number;
  rows?: number;
  pitch?: number;
  dir?: string;
  bore?: number;
  castellated?: boolean;
}
interface Model {
  id: string;
  width: number;
  length: number;
  board: number;
  color: number;
  construction: string;
  height?: number;
  holes: number[][];
  details: Detail[];
}
const models = data.filter((m) => m.id !== 'adafruit-feather-nrf52840') as unknown as Model[];
const black = 0x25282c,
  gold = 0xc6ab68,
  silver = 0xaab4bc;
export function pieces(p: Parameters, state: string): Piece[] {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown module model');
  const out: Piece[] = [],
    bores: Shape[] = [];
  const add = (shape: Shape, label: string, color: number, layer = 1) =>
    out.push({ shape, label, color, z: state === 'exploded' ? layer * 10 : 0 });
  const rect = (d: Detail, h = d.h, z = d.z) =>
    box([d.w, d.l, h], [d.x - d.w / 2, d.y - d.l / 2, z]);
  for (const [x, y, diameter] of m.holes)
    bores.push(cylinder(diameter / 2, m.board + 2, [x, y, -1]));
  for (const d of m.details) {
    const color = d.color ?? black;
    const layer = d.z < 0 ? -1 : d.kind === 'header' ? 2 : 1;
    if (d.kind === 'pads' || d.kind === 'header') {
      const count = d.count ?? 1,
        rows = d.rows ?? 1,
        pitch = d.pitch ?? 2.54;
      const horizontal = d.dir !== 'vertical';
      const coords = Array.from({ length: count }, (_, i) =>
        Array.from({ length: rows }, (_, j) => {
          const u = (i - (count - 1) / 2) * pitch,
            v = (j - (rows - 1) / 2) * pitch;
          return [d.x + (horizontal ? u : v), d.y + (horizontal ? v : u)];
        }),
      ).flat();
      for (const [i, [x, y]] of coords.entries()) {
        const r = (d.bore ?? 1) / 2;
        bores.push(cylinder(r, m.board + 2, [x, y, -1]));
        add(
          subtract(
            cylinder(r + 0.32, 0.06, [x, y, m.board]),
            cylinder(r, 0.3, [x, y, m.board - 0.1]),
          ),
          `${d.name} pad ${i + 1}`,
          gold,
          0,
        );
        if (d.castellated) {
          const edge = (Math.sign(x) * m.width) / 2;
          const outer = Math.min(0.65, Math.abs(edge - x) - r - 0.32 - 0.05),
            inner = outer * 0.6;
          bores.push(cylinder(inner, m.board + 2, [edge, y, -1]));
          const start = edge < 0 ? -Math.PI / 2 : Math.PI / 2;
          const arc = (r: number) =>
            Array.from(
              { length: 25 },
              (_, j) =>
                [
                  edge + r * Math.cos(start + (j * Math.PI) / 24),
                  y + r * Math.sin(start + (j * Math.PI) / 24),
                ] as [number, number],
            );
          const ring = prism([...arc(outer), ...arc(inner).reverse()], 0.06, m.board, 'z');
          add(ring, `${d.name} edge contact ${i + 1}`, gold, 0);
        }
        if (d.kind === 'header') {
          add(
            box([0.64, 0.64, d.h], [x - 0.32, y - 0.32, m.board + 0.06]),
            `${d.name} pin ${i + 1}`,
            gold,
            2,
          );
          const base = box(
            [pitch - 0.06, pitch - 0.06, 2.2],
            [x - pitch / 2 + 0.03, y - pitch / 2 + 0.03, m.board + 0.06],
          );
          add(
            subtract(base, box([0.64, 0.64, 2.4], [x - 0.32, y - 0.32, m.board - 0.04])),
            `${d.name} insulator ${i + 1}`,
            black,
            2,
          );
        }
      }
    } else if (d.kind === 'socket') {
      const wall = Math.min(0.4, d.h / 5);
      let cavity: Shape;
      if (d.dir === 'east')
        cavity = box(
          [d.w, d.l - 2 * wall, d.h - 2 * wall],
          [d.x - d.w / 2 + wall, d.y - d.l / 2 + wall, d.z + wall],
        );
      else if (d.dir === 'west')
        cavity = box(
          [d.w, d.l - 2 * wall, d.h - 2 * wall],
          [d.x - d.w / 2 - wall, d.y - d.l / 2 + wall, d.z + wall],
        );
      else if (d.dir === 'south')
        cavity = box(
          [d.w - 2 * wall, d.l, d.h - 2 * wall],
          [d.x - d.w / 2 + wall, d.y - d.l / 2 - wall, d.z + wall],
        );
      else if (d.dir === 'top')
        cavity = box(
          [d.w - 2 * wall, d.l - 2 * wall, d.h],
          [d.x - d.w / 2 + wall, d.y - d.l / 2 + wall, d.z + wall],
        );
      else
        cavity = box(
          [d.w - 2 * wall, d.l, d.h - 2 * wall],
          [d.x - d.w / 2 + wall, d.y - d.l / 2 + wall, d.z + wall],
        );
      add(subtract(rect(d), cavity), d.name + ' housing', d.color ?? silver, layer);
      // Recessed tongue is a separate solid, leaving an open mating cavity.
      const side = d.dir === 'east' || d.dir === 'west' || (d.dir === 'top' && d.l > d.w);
      const tongue = box(
        [d.w - 2 * wall - 0.4, d.l - 2 * wall - 0.4, Math.min(0.4, d.h / 6)],
        [d.x - d.w / 2 + wall + 0.2, d.y - d.l / 2 + wall + 0.2, d.z + d.h / 2],
      );
      add(tongue, d.name + ' tongue', black, layer);
      const count = d.count ?? 4;
      for (let i = 0; i < count; i++) {
        const u =
          ((i - (count - 1) / 2) * (side ? d.l - 2 * wall - 1 : d.w - 2 * wall - 1)) / count;
        add(
          box(
            [side ? 0.7 : 0.18, side ? 0.18 : 0.7, 0.06],
            [
              d.x + (side ? -0.35 : u - 0.09),
              d.y + (side ? u - 0.09 : -0.35),
              d.z + d.h / 2 + Math.min(0.4, d.h / 6),
            ],
          ),
          d.name + ` contact ${i + 1}`,
          gold,
          layer,
        );
      }
    } else if (d.kind === 'cylinder')
      add(cylinder(d.w / 2, d.h, [d.x, d.y, d.z]), d.name, color, layer);
    else add(rect(d), d.name, color, layer);
  }
  if (m.construction === 'Enclosed regulator' || m.construction === 'Wrapped ESC') {
    const h = m.height!;
    const outer = roundedRect(m.width, m.length, 1, 0, h - 0.8);
    const inner = box([m.width - 2, m.length - 2, h], [1 - m.width / 2, 1 - m.length / 2, 0.8]);
    add(subtract(outer, inner), 'Insulated body shell', m.color, 0);
    add(roundedRect(m.width, m.length, 1, h - 0.8, 0.8), 'Top cover', m.color, 3);
  } else {
    const board = roundedRect(m.width, m.length, Math.min(1, m.width / 10), 0, m.board);
    add(bores.length ? subtract(board, ...bores) : board, 'PCB — ' + m.id, m.color, 0);
  }
  return out;
}
