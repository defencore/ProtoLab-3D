import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { box, circle, cylinder, plate, union, subtract, type Shape, type Point } from './shapes';
import { cellLocations, wingLayout, wingTies } from './wing-layout';

const welded = (solid: Shape): Shape => ({
  kind: 'fusedLayers',
  children: [solid],
  planes: [],
  solid,
});
const strap = (a: Point, b: Point, width: number, z: number, height: number): Shape => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (-(b[1] - a[1]) * width) / (2 * d),
    dy = ((b[0] - a[0]) * width) / (2 * d);
  return plate(
    [
      [a[0] + dx, a[1] + dy],
      [b[0] + dx, b[1] + dy],
      [b[0] - dx, b[1] - dy],
      [a[0] - dx, a[1] - dy],
    ],
    [],
    z,
    height,
  );
};
/** The series bridge goes around the back of the servo, at the disk end.
 * Local +Z points toward the servo disk; the installed nose reverses this axis. */
export function cellBridgePath(p: Parameters): Point[] {
  const x = wingLayout(p).batteryX;
  return [
    [x, -24],
    [-23, -8],
    [-23, 8],
    [x, 24],
  ];
}
const ribbon = (points: Point[], width: number, z: number, height: number): Shape => {
  // Mitred polygon, not overlapping round cable envelopes.
  const offsets = (side: number): Point[] =>
    points.map((point, i) => {
      const normal = (a: Point, b: Point): Point => {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
      };
      const before = normal(points[Math.max(0, i - 1)], points[Math.max(1, i)]);
      const after = normal(
        points[Math.min(i, points.length - 2)],
        points[Math.min(i + 1, points.length - 1)],
      );
      const scale = (side * width) / 2 / (1 + before[0] * after[0] + before[1] * after[1]);
      return [point[0] + (before[0] + after[0]) * scale, point[1] + (before[1] + after[1]) * scale];
    });
  return plate([...offsets(1), ...offsets(-1).reverse()], [], z, height);
};
/** Open notches let the preformed contacts enter axially, without threading
 * either tabs or attached wires through a closed bore. */
export function cellDeckBosses(p: Parameters): Shape[] {
  if (p.wingBattery !== '2x18650') return [];
  const r = +p.wingCellDiameter / 2,
    w = wingLayout(p);
  return cellLocations(p).map(([x, y]) =>
    subtract(
      union(
        plate(circle(r + 2.5, x, y), [circle(6.5, x, y)], w.cellTop + 2, 44 - w.cellTop - 2),
        plate(circle(r + 2.5, x, y), [circle(r + 1.5, x, y)], w.cellTop - 1, 3),
      ),
      ribbon(cellBridgePath(p), 10, w.cellTop - 2, 9),
    ),
  );
}
/** Integral support under the complete bridge floor, carried by the nose disk.
 * Local Z increases downward in the installed assembly. No unsupported plastic span. */
export function cellBridgeSupport(p: Parameters): Shape[] {
  if (p.wingBattery !== '2x18650') return [];
  const w = wingLayout(p);
  return [
    subtract(
      ribbon(cellBridgePath(p), 8.8, w.cellTop + 3, 44 - w.cellTop - 3),
      ...cellLocations(p).map(([x, y]) => cylinder(4.5, 8, [x, y, w.cellTop])),
    ),
  ];
}
export function cylindricalPack(p: Parameters): Piece[] {
  const w = wingLayout(p),
    r = +p.wingCellDiameter / 2,
    out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0xc6cdd5) => out.push({ label, shape, color });
  const cells = cellLocations(p);
  const t = w.retentionThickness;
  const arms = cells.flatMap(([x, y]) =>
    [-31, 31].map((tx) => strap([x, y], [tx, Math.sign(y) * 18], 8, w.base, t)),
  );
  // Closed cell rings and two continuous rails carry loads into all four ties.
  // Wires exit on the outside face through plastic slots; no radial metal cut
  // interrupts either ring or any of the four structural arms.
  add(
    '2S 18650 common retention plate · Al6061 t3 · closed cell rings · twin 6 mm rails · four 8 mm arms · integral collars h3',
    welded(
      subtract(
        union(
          ...[-1, 1].map((side) =>
            box([6, 49, t], [w.batteryX + side * (r - 1) - 3, -24.5, w.base]),
          ),
          ...arms,
          ...cells.map(([x, y]) => cylinder(r + 2.5, t, [x, y, w.base])),
          ...cells.map(([x, y]) =>
            plate(circle(r + 2.5, x, y), [circle(r + 1.5, x, y)], w.base + t, 3),
          ),
          ...wingTies.map(([x, y]) => cylinder(4.5, t, [x, y, w.base])),
        ),
        ...cells.map(([x, y]) => cylinder(6.5, t + 2, [x, y, w.base - 1])),
        ...wingTies.map(([x, y]) => cylinder(1.1, t + 2, [x, y, w.base - 1])),
      ),
    ),
  );
  cells.forEach(([x, y], i) => {
    const positiveAtTop = i === 0;
    add(
      `BUY 18650 cell ${i + 1} · 2S1P · measured Ø${p.wingCellDiameter}×${p.wingCellLength} · ${p.wingCellMass} g · ${positiveAtTop ? 'positive toward servo disk' : 'positive toward FC'}`,
      cylinder(r, +p.wingCellLength - 1, [x, y, w.cellBottom + 0.5]),
      0x487b87,
    );
    for (const top of [false, true]) {
      const positive = top === positiveAtTop;
      const z = top ? w.cellTop - 0.5 : w.cellBottom;
      add(
        `BUY 18650 cell ${i + 1} ${positive ? 'positive' : 'negative'} terminal · steel · envelope reference`,
        cylinder(positive ? 3 : r - 0.3, 0.5, [x, y, z]),
        0x929eac,
      );
      if (positive)
        add(
          `18650 cell ${i + 1} positive shoulder insulator · PA12 fit reference`,
          plate(circle(r, x, y), [circle(3.1, x, y)], z, 0.5),
          0xdcdcd2,
        );
    }
    // The shoulders and collars retain the cell cans. Contact tabs carry no
    // structural load. The common bridge backing is captured under the disk seats.
    add(
      `18650 cell ${i + 1} disk insulating cup · PRINT PA12 · shoulder t1 collar h5 · open bridge notch`,
      welded(
        subtract(
          union(
            plate(circle(r + 1.2, x, y), [circle(6, x, y)], w.cellTop, 1),
            plate(circle(r + 1.2, x, y), [circle(r + 0.2, x, y)], w.cellTop - 5, 5),
          ),
          ribbon(cellBridgePath(p), 6.4, w.cellTop, 2),
        ),
      ),
      0xdddcd2,
    );
    const notch = box([r + 3, 5.2, t + 7], [x, y - 2.6, w.base]);
    add(
      `18650 cell ${i + 1} nose-tip insulating cup · PRINT PA12 · integral recessed output guard · open wire notch w5.2`,
      welded(
        union(
          subtract(
            union(
              plate(circle(r + 1.2, x, y), [], w.cellBottom - 1, 6),
              plate(circle(5.8, x, y), [], w.base, t + 0.1),
            ),
            cylinder(r + 0.2, 5.1, [x, y, w.cellBottom]),
            cylinder(4.5, t + 1.2, [x, y, w.base - 0.1]),
            notch,
          ),
          // The floor is captured against the outside of the metal end frame.
          // A slot open to the edge receives the bent tab before the cell is fitted.
          subtract(
            plate(circle(r + 1.2, x, y), [], w.base - 1.2, 1.2),
            box([r + 3, 4.8, 2], [x - 1.4, y - 2.4, w.base - 1.5]),
          ),
          // Two rails support the output pad and separate a soldered lead from metal.
          box([r + 1, 1.2, 1.2], [x - 1, y - 3.6, w.base - 1.2]),
          box([r + 1, 1.2, 1.2], [x - 1, y + 2.4, w.base - 1.2]),
          box([5, 4.8, 0.8], [x - 1, y - 2.4, w.base - 0.8]),
          // Three-sided guard is open in the outgoing-wire direction (+X).
          box([1.2, 9.6, 1.8], [x - 4.8, y - 4.8, w.base - 3]),
          box([r + 5, 1.2, 1.8], [x - 4.8, y - 4.8, w.base - 3]),
          box([r + 5, 1.2, 1.8], [x - 4.8, y + 3.6, w.base - 3]),
          // Raised polarity mark on the insulating flange, away from the contact.
          box([3, 0.6, 0.3], [x - 8, y - 0.3, w.base - 1.5]),
          ...(i === 1 ? [box([0.6, 3, 0.3], [x - 6.8, y - 1.5, w.base - 1.5])] : []),
        ),
      ),
      0xdddcd2,
    );
    add(
      `18650 cell ${i + 1} fixed output ${i === 0 ? 'MINUS B-' : 'PLUS B+'} · formed nickel t0.2 · supported pad 5x4 · weld to cell before assembly`,
      welded(
        union(
          box([5, 4, 0.2], [x - 2.5, y - 2, w.cellBottom - 0.2]),
          box([0.2, 4, w.cellBottom - w.base + 1], [x - 1.2, y - 2, w.base - 1]),
          box([5.2, 4, 0.2], [x - 1.2, y - 2, w.base - 1]),
        ),
      ),
      i === 0 ? 0x555c65 : 0xc05b4f,
    );
    out[out.length - 1].metadata = {
      ElectricalNode: i === 0 ? 'B-' : 'B+',
      CellTerminal: `Cell ${i + 1} ${i === 0 ? 'negative' : 'positive'}`,
      Service:
        'Fixed output pad; disconnect load before charging. Wire is laid into the open notch.',
    };
  });
  const path = cellBridgePath(p),
    contactZ = w.cellTop + 1.8;
  // The complete nose is inverted on export: increasing local Z points DOWN
  // in the installed assembly. Plastic starts at the underside of the lamella.
  add(
    '2S angled bridge backing · PRINT PA12 · substrate t1 on integral disk support · captured end flanges · edge lips h0.6 · behind servo',
    welded(
      subtract(
        union(
          ribbon(path, 8.8, contactZ + 0.2, 1),
          subtract(ribbon(path, 8.8, contactZ - 0.4, 0.7), ribbon(path, 6.4, contactZ - 0.5, 1)),
          ...cells.map(([x, y]) =>
            subtract(
              plate(circle(r + 1.2, x, y), [], w.cellTop + 1, 1),
              ribbon(path, 6.4, w.cellTop + 0.9, 1.2),
            ),
          ),
        ),
        ...cells.map(([x, y]) => cylinder(4.5, 4, [x, y, w.cellTop + 0.9])),
      ),
    ),
    0xe6c58d,
  );
  add(
    '2S angled series bridge B1 · cell 1 positive to cell 2 negative · formed nickel w4 t0.2 · on top of PA12 backing · behind servo · service midpoint',
    welded(
      union(
        ribbon(path, 4, contactZ, 0.2),
        ...cells.map(([x, y]) =>
          union(
            box([5, 4, 0.2], [x - 2.5, y - 2, w.cellTop]),
            box([4, 0.2, contactZ - w.cellTop + 0.2], [x - 2, y - 0.1, w.cellTop]),
          ),
        ),
      ),
    ),
    0xaeb9c2,
  );
  out[out.length - 1].metadata = {
    ElectricalNode: 'B1',
    CellTerminal: 'Cell 1 positive / Cell 2 negative',
    Service:
      'Series midpoint, not a power output. Accessible on the insulating backing after removing the nose shell.',
  };
  return out;
}

/** Axial access to the recessed output pads, with the nose shell removed.
 * Clip jaw size remains a measured service-tool input, not a universal fit. */
export function cellTerminalServiceZones(p: Parameters): { label: string; shape: Shape }[] {
  if (p.wingBattery !== '2x18650') return [];
  const w = wingLayout(p);
  return cellLocations(p).map(([x, y], i) => ({
    label: `2S fixed ${i === 0 ? 'MINUS' : 'PLUS'} output pad axial access`,
    shape: box([4, 3, 4], [x - 0.5, y - 1.5, w.base - 5]),
  }));
}
