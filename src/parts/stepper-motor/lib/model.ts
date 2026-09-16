import type { Parameters } from '../../../core/types';
import models from './models.json';
import { box, cylinder, prism, subtract, union, type Shape } from './shapes';
import type { Piece } from './assembly';
export { models };
export function model(p: Parameters) {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown stepper model');
  return m;
}
function outline(w: number, c: number): [number, number][] {
  const r = w / 2;
  return [
    [-r + c, -r],
    [r - c, -r],
    [r, -r + c],
    [r, r - c],
    [r - c, r],
    [-r + c, r],
    [-r, r - c],
    [-r, -r + c],
  ];
}
export function pieces(p: Parameters, state: string): Piece[] {
  const m = model(p),
    w = m.width,
    L = m.length,
    sr = m.shaft / 2;
  const front =
    m.nema === 42 ? 12.5 : m.nema === 34 ? 10 : Math.min(L * 0.24, Math.max(4, w * 0.13));
  const rear = Math.min(L * 0.24, Math.max(4, w * 0.12)),
    bore = Math.max(sr + 1.5, m.pilot * 0.32);
  const gap = state === 'exploded' ? w * 0.45 : 0,
    angle = Number(p.outputAngle);
  const result: Piece[] = [];
  const add = (label: string, shape: Shape, color: number, z = 0, a = 0) =>
    result.push({ label, shape, color, z, angle: a });
  const mountHoles: Shape[] = [];
  for (const x of [-m.pitch / 2, m.pitch / 2])
    for (const y of [-m.pitch / 2, m.pitch / 2])
      mountHoles.push(
        cylinder(m.hole / 2, (m.holeDepth || front) + 0.1, [x, y, -(m.holeDepth || front)]),
      );
  add(
    'Front flange and locating pilot',
    subtract(
      union(
        prism(outline(w, w * 0.045), front, -front),
        cylinder(m.pilot / 2, m.pilotHeight, [0, 0, 0]),
      ),
      cylinder(bore, front + m.pilotHeight + 2, [0, 0, -front - 1]),
      ...mountHoles,
    ),
    0xb6bbc0,
    gap * 3,
  );
  const stackLength = L - front - rear,
    count = Math.max(5, Math.min(18, Math.round(stackLength / 3)));
  for (let i = 0; i < count; i++)
    add(
      `Lamination stack section ${i + 1}`,
      subtract(
        prism(
          outline(w - 0.12, w * 0.19),
          stackLength / count,
          -L + rear + (i * stackLength) / count,
        ),
        cylinder(bore, stackLength / count + 2, [0, 0, -L + rear + (i * stackLength) / count - 1]),
      ),
      i % 2 ? 0x343a40 : 0x434a50,
    );
  const screwR = Math.max(0.85, w * 0.023),
    screwPitch = w * 0.63;
  const screws: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => [(x * screwPitch) / 2, (y * screwPitch) / 2]);
  add(
    'Rear end cover',
    subtract(
      prism(outline(w, w * 0.08), rear, -L),
      cylinder(bore, rear + 2, [0, 0, -L - 1]),
      ...screws.map(([x, y]) => cylinder(screwR * 1.5, 1.8, [x, y, -L - 0.1])),
    ),
    0xa8aeb4,
    -gap,
  );
  for (const [i, [x, y]] of screws.entries())
    add(
      `Rear cover screw ${i + 1}`,
      subtract(
        cylinder(screwR * 1.3, 1.4, [x, y, -L + 0.1]),
        prism(
          Array.from(
            { length: 6 },
            (_, j) =>
              [
                x + screwR * 0.62 * Math.cos((j * Math.PI) / 3),
                y + screwR * 0.62 * Math.sin((j * Math.PI) / 3),
              ] as [number, number],
          ),
          0.7,
          -L,
        ),
      ),
      0x545a60,
      -gap,
    );
  for (const [name, z, offset, h] of [
    ['Front', -front, gap * 3, front + m.pilotHeight],
    ['Rear', -L, -gap, rear],
  ] as const) {
    add(
      `${name} bearing outer race`,
      subtract(cylinder(bore - 0.06, h, [0, 0, z]), cylinder(sr + 0.65, h + 2, [0, 0, z - 1])),
      0x747c84,
      offset,
    );
    add(
      `${name} bearing inner race`,
      subtract(cylinder(sr + 0.55, h, [0, 0, z]), cylinder(sr + 0.06, h + 2, [0, 0, z - 1])),
      0xd0d3d6,
      offset,
    );
  }
  let shaft: Shape = union(
    cylinder(sr, L - rear + m.extension, [0, 0, -L + rear]),
    cylinder(bore - 0.25, stackLength - 1, [0, 0, -L + rear + 0.5]),
  );
  if (m.shaftType === 'D')
    shaft = subtract(
      shaft,
      box(
        [m.shaft, m.shaft, m.flatLength + 0.1],
        [-sr, sr - m.flatDepth, m.extension - m.flatLength],
      ),
    );
  if (m.shaftType === 'keyed') {
    const z = m.extension - m.flatLength - 2,
      keyHeight = m.nema === 42 ? 2.5 : 2;
    shaft = subtract(
      shaft,
      box([m.keyWidth, m.keyWidth, m.flatLength], [-m.keyWidth / 2, sr - 2, z]),
    );
    add(
      'Parallel shaft key',
      box(
        [m.keyWidth - 0.06, 2 + keyHeight - 0.04, m.flatLength - 0.06],
        [-m.keyWidth / 2 + 0.03, sr - 1.98, z + 0.03],
      ),
      0xb4bbc2,
      gap,
      angle,
    );
  }
  add('Rotor and output shaft', shaft, 0xc0c6cc, gap, angle);
  const leadR = Math.min(1.3, Math.max(0.45, m.current * 0.16)),
    connectorWidth = (m.wires + 1) * leadR * 2.2;
  // The cable outlet and short straight leads are illustrative clearance geometry.
  add(
    'Cable outlet',
    box([connectorWidth, 2.5, rear * 0.65], [-connectorWidth / 2, w / 2, -L + rear * 0.15]),
    0x242a2e,
    -gap,
  );
  if (p.showLeads)
    for (let i = 0; i < m.wires; i++)
      add(
        `Lead ${i + 1}`,
        cylinder(
          leadR,
          w * 0.55,
          [(i - (m.wires - 1) / 2) * leadR * 2.2, w / 2 + 2.5, -L + rear * 0.5],
          'y',
        ),
        [0x22262a, 0xb3423f, 0x4d875f, 0x486eae, 0xe9c569, 0xe6e3d6][i],
        -gap,
      );
  return result;
}
