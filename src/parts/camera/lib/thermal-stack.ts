import { box, cylinder, prism, roundedRect, ring, subtract, type Shape } from './shapes';
import type { Piece } from './assembly';

export interface ThermalStackGeometry {
  bodyDepth: number;
  projection: number;
  lensDiameter: number;
  focusRingDepth: number;
  mountDepth: number;
  usb: boolean;
}

/** DM/UC reference reconstruction. Unknown offsets are documented in the catalog. */
export function thermalStack(depth: number, spec: ThermalStackGeometry, state: string): Piece[] {
  const out: Piece[] = [];
  const gap = state === 'exploded' ? 6 : 0;
  const rear = -spec.bodyDepth,
    front = -spec.projection;
  const black = 0x26292c,
    pcb = 0x426957,
    gold = 0xb7aa6e;
  const add = (label: string, shape: Shape, color: number, z = 0) =>
    out.push({ label, shape, color, z });
  const corners = [-9, 9].flatMap((x) => [-9, 9].map((y) => [x, y] as const));
  const screwHoles = (z: number, h: number) =>
    corners.map(([x, y]) => cylinder(0.95, h + 0.2, [x, y, z - 0.1]));
  function plate(
    label: string,
    z: number,
    h: number,
    color: number,
    offset: number,
    hollow: boolean,
  ) {
    const cuts = screwHoles(z, h);
    if (hollow) cuts.push(roundedRect(15.5, 15.5, 1, z - 0.1, h + 0.2));
    add(label, subtract(roundedRect(21, 21, 1, z, h), ...cuts), color, offset);
  }
  plate('Rear interface PCB', rear, 1.2, pcb, -3 * gap, false);
  plate('Rear electronics housing', rear + 1.2, 3.5, black, -2.5 * gap, true);
  plate('Lower board edge', rear + 4.7, 0.5, gold, -2 * gap, false);
  plate('Detector electronics housing', rear + 5.2, 4.8, black, -1.5 * gap, true);
  plate('Upper board edge', rear + 10, 0.5, gold, -gap, false);
  plate('Detector chamber', rear + 10.5, front - 4.5 - rear - 10.5, black, -0.5 * gap, true);

  // Eight blind radial holes: two per side at 12 mm pitch. Axial offset is estimated.
  const cuts: Shape[] = [cylinder(6.4, 4.7, [0, 0, front - 4.6]), ...screwHoles(front - 4.5, 4.5)];
  for (const t of [-6, 6]) {
    cuts.push(cylinder(1, spec.mountDepth + 0.1, [-10.6, t, front - 2], 'x'));
    cuts.push(cylinder(1, spec.mountDepth + 0.1, [10.5 - spec.mountDepth, t, front - 2], 'x'));
    cuts.push(cylinder(1, spec.mountDepth + 0.1, [t, -10.6, front - 2], 'y'));
    cuts.push(cylinder(1, spec.mountDepth + 0.1, [t, 10.5 - spec.mountDepth, front - 2], 'y'));
  }
  for (const [x, y] of corners) cuts.push(cylinder(1.4, 0.8, [x, y, front - 0.7]));
  add('Front mounting plate', subtract(roundedRect(21, 21, 1, front - 4.5, 4.5), ...cuts), black);
  const head = (x: number, y: number, z: number, label: string, offset: number) =>
    add(
      label,
      subtract(
        cylinder(1.25, 0.5, [x, y, z]),
        box([1.7, 0.3, 0.3], [x - 0.85, y - 0.15, z + 0.3]),
        box([0.3, 1.7, 0.3], [x - 0.15, y - 0.85, z + 0.3]),
      ),
      0x42464a,
      offset,
    );
  corners.forEach(([x, y], i) => head(x, y, front - 0.55, `Front screw head ${i + 1}`, 0));
  [
    [-9, 9],
    [9, -9],
  ].forEach(([x, y], i) => head(x, y, rear - 0.55, `Rear screw head ${i + 1}`, -3 * gap));

  const radius = spec.lensDiameter / 2,
    ringDepth = spec.focusRingDepth;
  add(
    'Objective barrel',
    ring(radius - 0.45, 6.4, front, spec.projection - ringDepth - 0.3),
    black,
    gap,
  );
  add('Focus collar', ring(radius - 1.1, 6.4, -ringDepth - 0.3, 0.3), black, gap);
  const flutes = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    return cylinder(0.65, ringDepth + 0.2, [
      Math.cos(a) * (radius + 0.25),
      Math.sin(a) * (radius + 0.25),
      -ringDepth - 0.1,
    ]);
  });
  add(
    'Scalloped focus ring',
    subtract(
      cylinder(radius, ringDepth, [0, 0, -ringDepth]),
      cylinder(8.5, ringDepth + 0.2, [0, 0, -ringDepth - 0.1]),
      ...flutes,
    ),
    0x35393d,
    1.5 * gap,
  );
  const slots = [box([1, 18, 0.5], [-0.5, -9, -0.4]), box([18, 1, 0.5], [-9, -0.5, -0.4])];
  add(
    'Slotted lens retaining ring',
    subtract(ring(8.45, 6.4, -0.95, 0.95), ...slots),
    black,
    1.5 * gap,
  );
  add(
    'Convex LWIR optical envelope',
    {
      kind: 'revolve',
      profile: [
        [0, -0.9],
        [5.9, -0.9],
        [6.25, -0.7],
        [5.8, -0.35],
        [4, -0.15],
        [0, -0.05],
      ],
    },
    0x33424d,
    2 * gap,
  );

  // Rear-facing five-pin connector. The cavity and contacts remain distinct solids.
  const socketDepth = depth - spec.bodyDepth;
  add(
    '5-pin 1.25 mm connector shell',
    subtract(
      box([8.5, 3.3, socketDepth - 0.05], [-4.25, -6.65, -depth]),
      box([7, 2.1, socketDepth - 0.7], [-3.5, -6.05, -depth - 0.05]),
    ),
    0xd9d0ac,
    -3 * gap,
  );
  for (let i = 0; i < 5; i++)
    add(
      `Connector contact ${i + 1}`,
      box([0.3, 0.35, socketDepth - 1], [(i - 2) * 1.25 - 0.15, -5.175, -depth + 0.2]),
      gold,
      -3 * gap,
    );
  if (spec.usb) {
    const shifted = (w: number, h: number, r: number, z: number, length: number): Shape => {
      const shape = roundedRect(w, h, r, z, length);
      if (shape.kind !== 'prism') throw new Error('Expected connector outline');
      return prism(
        shape.points.map(([x, y]) => [x, y + 4.5]),
        length,
        z,
      );
    };
    add(
      'USB-C connector shield',
      subtract(
        shifted(8.8, 3.2, 1.6, -depth, socketDepth),
        shifted(7.8, 2.2, 1.1, -depth - 0.1, socketDepth + 0.2),
      ),
      0xaeb5bd,
      -3 * gap,
    );
    add(
      'USB-C connector tongue',
      box([6.5, 0.65, socketDepth - 0.6], [-3.25, 4.175, -depth + 0.4]),
      black,
      -3 * gap,
    );
  }
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      add(
        `Rear SMD envelope ${side}:${i + 1}`,
        box([1.5, 0.85, 0.6], [side * 6.5 - 0.75, -2.2 + i * 2.5, rear - 0.65]),
        i % 2 ? black : 0xaca58a,
        -3 * gap,
      );
    }
  return out;
}
