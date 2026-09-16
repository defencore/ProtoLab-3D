import type { Parameters } from '../../../core/types';
import models from './models.json';
import { box, cylinder, prism, subtract, union, type Shape } from './shapes';
import type { Piece } from './assembly';
import { dronePieces } from './drone';
export { models };
export function model(p: Parameters) {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown BLDC model');
  return m;
}
export function mountHoles(
  m: (typeof models)[number],
): { x: number; y: number; diameter: number }[] {
  const count = m.mountPattern === 'dual-circle' || m.mountPattern === 'alternating' ? 8 : 4;
  return Array.from({ length: count }, (_, i) => {
    const t =
      ((m.mountPattern === 'alternating' ? 22.5 + i * 45 : 45 + (i % 4) * 90) * Math.PI) / 180;
    const d =
      m.mountPattern === 'dual-circle'
        ? i < 4
          ? m.mountX
          : m.mountY
        : m.mountPattern === 'cross'
          ? i % 2
            ? m.mountY
            : m.mountX
          : m.mountX;
    return {
      x: (d / 2) * Math.cos(t),
      y: (d / 2) * Math.sin(t),
      diameter: m.mountPattern === 'alternating' && i % 2 ? 4 : m.hole,
    };
  });
}
function sector(r0: number, r1: number, start: number, end: number, z: number, h: number): Shape {
  const points: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const a = ((start + ((end - start) * i) / 8) * Math.PI) / 180;
    points.push([r1 * Math.cos(a), r1 * Math.sin(a)]);
  }
  for (let i = 8; i >= 0; i--) {
    const a = ((start + ((end - start) * i) / 8) * Math.PI) / 180;
    points.push([r0 * Math.cos(a), r0 * Math.sin(a)]);
  }
  return prism(points, h, z);
}
export function pieces(p: Parameters, state: string): Piece[] {
  const selected = model(p);
  if (selected.drone)
    return dronePieces(
      {
        ...selected,
        drone: selected.drone,
        statorDiameter: selected.statorDiameter!,
        statorLength: selected.statorLength!,
        slots: selected.slots!,
      },
      p,
      state,
    );
  const m = selected,
    R = m.diameter / 2,
    L = m.length,
    sr = m.shaft / 2,
    gap = state === 'exploded' ? R * 0.8 : 0;
  const result: Piece[] = [],
    angle = Number(p.outputAngle);
  const add = (label: string, shape: Shape, color: number, z = 0, rotates = false) =>
    result.push({ label, shape, color, z, angle: rotates ? angle : 0 });
  const ring = (outer: number, inner: number, z: number, h: number) =>
    subtract(cylinder(outer, h, [0, 0, z]), cylinder(inner, h + 2, [0, 0, z - 1]));
  if (m.rotor === 'outrunner') {
    const mini = m.id === 'x2204',
      base = mini ? 1.1 : m.holeDepth + 0.6,
      top = mini ? 1.4 : m.adapterDepth + 0.5,
      wall = mini ? 0.8 : 1.1;
    const holes = mountHoles(m);
    let baseShape: Shape = cylinder(mini ? R * 0.82 : R - wall - 0.3, base, [0, 0, -L]);
    if (mini)
      baseShape = union(
        baseShape,
        ...holes.map((h) =>
          union(
            cylinder(2, base, [h.x, h.y, -L]),
            sector(
              3,
              15.75,
              (Math.atan2(h.y, h.x) * 180) / Math.PI - 8,
              (Math.atan2(h.y, h.x) * 180) / Math.PI + 8,
              -L,
              base,
            ),
          ),
        ),
      );
    if (m.pilotHeight)
      baseShape = union(
        baseShape,
        cylinder(m.pilot / 2, m.pilotHeight, [0, 0, -L - m.pilotHeight]),
      );
    add(
      'Stationary mounting base',
      subtract(
        baseShape,
        cylinder(sr + 0.6, base + m.pilotHeight + 2, [0, 0, -L - m.pilotHeight - 1]),
        ...holes.map((h) => cylinder(h.diameter / 2, m.holeDepth + 0.1, [h.x, h.y, -L - 0.05])),
        ...(mini
          ? []
          : Array.from({ length: 4 }, (_, i) =>
              sector(R * 0.48, R * 0.83, i * 90 - 17, i * 90 + 17, -L - 0.1, base + 0.2),
            )),
      ),
      0x939ca5,
      -gap,
    );
    const bellStart = -L + base + 0.3,
      bellHeight = -bellStart;
    const vents = Array.from({ length: 6 }, (_, i) =>
      sector(R * 0.58, R * 0.88, i * 60 + 8, i * 60 + 48, -top - 0.1, top + 0.2),
    );
    const adapter = mini
      ? []
      : Array.from({ length: m.adapterCount }, (_, i) => {
          const a = (i * 2 * Math.PI) / m.adapterCount;
          return cylinder(m.adapterHole / 2, m.adapterDepth + 0.1, [
            (m.adapterCircle / 2) * Math.cos(a),
            (m.adapterCircle / 2) * Math.sin(a),
            -m.adapterDepth,
          ]);
        });
    add(
      'Ventilated rotor bell',
      subtract(
        cylinder(R, bellHeight, [0, 0, bellStart]),
        cylinder(R - wall, bellHeight - top + 0.1, [0, 0, bellStart - 0.1]),
        cylinder(sr + 0.05, bellHeight + 2, [0, 0, bellStart - 1]),
        ...vents,
        ...adapter,
      ),
      m.id.includes('v3') ? 0xa94b34 : 0x454d59,
      gap * 1.7,
      true,
    );
    const statorR = m.statorDiameter! / 2,
      z = -L + base + 0.7,
      h = Math.min(m.statorLength!, L - base - top - 1.3);
    const teeth = Array.from({ length: 12 }, (_, i) =>
      sector(statorR * 0.52, statorR * 0.96, i * 30 - 3, i * 30 + 3, z, h),
    );
    add('Stator core and teeth', union(ring(statorR * 0.58, sr + 0.8, z, h), ...teeth), 0x727d84);
    for (let i = 0; i < 12; i++)
      for (const side of [-1, 1])
        add(
          `Copper winding envelope ${i + 1}${side < 0 ? 'A' : 'B'}`,
          sector(
            statorR * 0.62,
            statorR * 0.92,
            i * 30 + side * 8 - 3.5,
            i * 30 + side * 8 + 3.5,
            z + 0.08,
            h - 0.16,
          ),
          i % 2 ? 0xc28042 : 0xa9612e,
        );
    const magnetInner = R - wall - 0.8;
    for (let i = 0; i < m.poles; i++)
      add(
        `Rotor magnet ${i + 1}`,
        sector(
          magnetInner,
          R - wall - 0.08,
          (i * 360) / m.poles + 1,
          ((i + 1) * 360) / m.poles - 1,
          z,
          h,
        ),
        i % 2 ? 0x74777c : 0x94989d,
        gap * 1.7,
        true,
      );
    add(
      'Rear bearing',
      ring(sr + 0.52, sr + 0.05, -L - m.pilotHeight, base + m.pilotHeight),
      0xb8c1c9,
      -gap,
    );
    const shaftStart = mini ? -L - 0.8 : -L - m.pilotHeight;
    const extension = mini ? 0 : m.extension;
    let shaft: Shape = cylinder(sr, extension - shaftStart, [0, 0, shaftStart]);
    if (m.flatLength)
      shaft = subtract(
        shaft,
        box(
          [m.shaft, m.shaft, m.flatLength + 0.1],
          [-sr, sr - m.flatDepth, m.extension - m.flatLength],
        ),
      );
    add('Output shaft', shaft, 0xc4cbd2, gap * 1.7, true);
    if (mini) {
      add('Prop saver hub', ring(4.25, sr + 0.06, 0, 7.5), 0xbcc5cc, gap * 1.7, true);
      for (const side of [-1, 1])
        add(
          `Prop saver screw ${side}`,
          cylinder(1.25, 5.1, [0, side > 0 ? 4.3 : -9.4, 4], 'y'),
          0x929ca4,
          gap * 1.7,
          true,
        );
    }
    if (p.showLeads)
      for (let i = 0; i < 3; i++)
        add(
          `Phase lead ${i + 1}`,
          cylinder(
            mini ? 0.5 : Math.min(1.7, R * 0.055),
            R * 0.85,
            [(i - 1) * R * 0.17, R - wall - 0.2, -L + base * 0.5],
            'y',
          ),
          [0xd8ba61, 0x9b3733, 0x34373a][i],
          -gap,
        );
  } else {
    const front = 6,
      rear = 5,
      inner = R - 2;
    // The inrunner interior is intentionally left as a simple rotor clearance envelope.
    const mount = mountHoles(m);
    add(
      'Front mounting cover',
      subtract(
        cylinder(R, front, [0, 0, -front]),
        cylinder(8, front + 2, [0, 0, -front - 1]),
        ...mount.map((h) => cylinder(h.diameter / 2, m.holeDepth + 0.1, [h.x, h.y, -m.holeDepth])),
      ),
      0x747d85,
      gap * 3,
    );
    add('Front bearing', ring(8 - 0.05, sr + 0.05, -5, 5), 0xb8c0c6, gap * 3);
    const finCount = 14,
      bodyLength = L - front - rear,
      step = bodyLength / finCount;
    const profile: [number, number][] = [
      [inner, -L + rear],
      [R, -L + rear],
    ];
    for (let i = 0; i < finCount; i++) {
      const z = -L + rear + i * step;
      if (i) profile.push([R, z]);
      profile.push([R, z + step * 0.55], [R - 0.7, z + step * 0.55], [R - 0.7, z + step]);
    }
    profile.push([inner, -front]);
    add('Finned motor housing', { kind: 'revolve', profile }, 0x353e49);
    const rearScrews = Array.from({ length: 3 }, (_, i) => {
      const a = ((i * 120 + 90) * Math.PI) / 180;
      return [R * 0.72 * Math.cos(a), R * 0.72 * Math.sin(a)] as const;
    });
    add(
      'Rear sensor end cap',
      subtract(
        cylinder(R, rear, [0, 0, -L]),
        cylinder(5.5, rear + 2, [0, 0, -L - 1]),
        ...rearScrews.map(([x, y]) => cylinder(1.8, 1.8, [x, y, -L - 0.1])),
      ),
      0x777e86,
      -gap,
    );
    add('Rear bearing', ring(5.45, sr + 0.05, -L, rear), 0xaab2ba, -gap);
    for (const [i, [x, y]] of rearScrews.entries())
      add(
        `End cap screw ${i + 1}`,
        subtract(
          cylinder(1.65, 1.4, [x, y, -L + 0.1]),
          box([0.6, 3.4, 0.6], [x - 0.3, y - 1.7, -L]),
        ),
        0x404850,
        -gap,
      );
    let shaft = union(
      cylinder(sr, L + m.extension, [0, 0, -L]),
      cylinder(9, bodyLength - 2, [0, 0, -L + rear + 1]),
    );
    shaft = subtract(shaft, box([5, 5, 16.1], [-sr, sr - 0.5, 2.5]));
    add('Rotor and D shaft', shaft, 0xbdc5cd, gap, true);
    for (let i = 0; i < 3; i++)
      add(
        `Phase terminal ${'ABC'[i]}`,
        subtract(
          box([4, 6, 3], [(i - 1) * 7 - 2, -3, -L - 3]),
          cylinder(1.1, 4, [(i - 1) * 7, 0, -L - 3.5]),
        ),
        0xc79b45,
        -gap,
      );
    add(
      'Sensor socket',
      subtract(box([9, 5, 3.5], [-4.5, 7, -L - 3.5]), box([7, 3, 2], [-3.5, 8, -L - 3.6])),
      0x272b30,
      -gap,
    );
    if (p.showLeads)
      for (let i = 0; i < 3; i++)
        add(
          `Phase lead ${i + 1}`,
          cylinder(1.5, 15, [(i - 1) * 7, 0, -L - 18], 'z'),
          [0xd5b558, 0x9e4540, 0x454a50][i],
          -gap,
        );
  }
  return result;
}
