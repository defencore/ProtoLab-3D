import type { Piece } from '../../flight-controller/lib/assembly';
import {
  box,
  cylinder,
  prism,
  roundedRect,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../flight-controller/lib/shapes';
import components from './components.json';
export const h7Spec = {
  boardWidth: 50,
  boardDepth: 44,
  boardThickness: 1.12268,
  cornerRadius: 3.69759345062,
  holeDiameter: 4,
  holePitch: 30.6,
  envelopeWidth: 50.97594,
  envelopeDepth: 44,
  envelopeHeight: 7.48268,
  rearDepth: 3.1,
  frontHeight: 3.26,
};
export const mountingHoles: [number, number][] = [-1, 1].flatMap((x) =>
  [-1, 1].map((y) => [x * 15.3, y * 15.3] as [number, number]),
);
export function pieces(state = 'assembled'): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color: number, layer = 0) =>
    out.push({
      label: 'BUY LCH7 v3.2 · ' + label,
      shape,
      color,
      z: state === 'exploded' ? layer * 9 : 0,
    });
  const board = subtract(
    roundedRect(50, 44, h7Spec.cornerRadius, 3.1, h7Spec.boardThickness),
    ...mountingHoles.map(([x, y]) => cylinder(2, 1.4, [x, y, 3])),
  );
  add('PCB 50x44 t1.12268 · 4xD4 on 30.6 pitch', board, 0x244f41);
  const keepouts = mountingHoles.map(([x, y]) => cylinder(3, 8, [x, y, -0.1]));
  const used: Shape[] = [];
  const bounds: number[][] = [];
  for (const c of components) {
    const o = c.origin as Vec,
      size = c.size as Vec,
      [x, y, z] = o,
      [w, d, h] = size;
    let raw: Shape = box(size, o);
    const socket = [18, 735, 577, 572].includes(c.sourceSolid);
    if (socket) {
      const t = Math.min(0.5, h / 4);
      const cut =
        c.sourceSolid === 18 || c.sourceSolid === 735
          ? box([w, d - 2 * t, h - 2 * t], [x + t, y + t, z + t])
          : box([w - 2 * t, d, h - 2 * t], [x + t, y - t, z + t]);
      raw = subtract(raw, cut);
    }
    if (c.sourceSolid === 466) {
      const k = 0.5;
      raw = prism(
        [
          [x + k, y],
          [x + w - k, y],
          [x + w, y + k],
          [x + w, y + d - k],
          [x + w - k, y + d],
          [x + k, y + d],
          [x, y + d - k],
          [x, y + k],
        ],
        h,
        z,
      );
    }
    const overlaps = used.filter((_, i) =>
      bounds[i].every((v, a) => (a < 3 ? v < o[a] + size[a] : v > o[a - 3])),
    );
    const shape = subtract(raw, ...keepouts, ...overlaps);
    used.push(raw);
    bounds.push([...o, ...o.map((n, i) => n + size[i])]);
    const label =
      c.sourceSolid === 466
        ? 'Main processor package'
        : c.sourceSolid === 18
          ? 'USB connector shell'
          : socket
            ? 'Edge connector housing'
            : c.sourceSolid === 686
              ? 'Rear power package'
              : `Component package ${c.sourceSolid}`;
    add(
      label,
      shape,
      socket
        ? c.sourceSolid === 18
          ? 0xb8bdc2
          : 0xddd9c8
        : [117, 118, 686].includes(c.sourceSolid)
          ? 0x59616b
          : c.sourceSolid === 786
            ? 0xc8b584
            : 0x282d35,
      z < 3.1 ? -1 : 1,
    );
  }
  // Grouped perimeter leads convey the package layout without importing hundreds
  // of individual source pins. Their positions are illustrative, not a pinout.
  const cpu = components.find((c) => c.sourceSolid === 466)!;
  const [x, y, z] = cpu.origin,
    [w, d] = cpu.size;
  const leads: Shape[] = [];
  for (let i = 0; i < 14; i++) {
    const a = 0.9 + i * 0.93;
    leads.push(
      box([0.45, 0.6, 0.12], [x + a, y - 0.6, 4.22268]),
      box([0.45, 0.6, 0.12], [x + a, y + d, 4.22268]),
      box([0.6, 0.45, 0.12], [x - 0.6, y + a, 4.22268]),
      box([0.6, 0.45, 0.12], [x + w, y + a, 4.22268]),
    );
  }
  add('Grouped processor leads · illustrative', union(...leads), 0xa3abb2, 1);
  for (const c of components.filter((c) => [18, 735, 577, 572].includes(c.sourceSolid))) {
    const [x, y, z] = c.origin,
      [w, d, h] = c.size;
    const east = c.sourceSolid === 18 || c.sourceSolid === 735;
    const n = c.sourceSolid === 18 ? 1 : 6;
    const pins = Array.from({ length: n }, (_, i) =>
      east
        ? box(
            [w - 0.8, n === 1 ? d - 2 : 0.25, 0.2],
            [x + 0.65, y + (n === 1 ? 1 : ((i + 1) * d) / (n + 1)), z + h / 2],
          )
        : box([0.25, d - 0.8, 0.2], [x + ((i + 1) * w) / (n + 1), y + 0.2, z + h / 2]),
    );
    add(
      `Connector ${c.sourceSolid} simplified contacts`,
      union(...pins),
      0xc8ac68,
      z < 3.1 ? -1 : 1,
    );
  }
  return out;
}
