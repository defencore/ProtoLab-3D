import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { layout } from './motion';
import { box, cylinder, ring, union, subtract, transform, rotate, type Shape } from './shapes';
import { screw, matingHole } from './hardware';
import { batteryLayout, batteryPosts } from './balance';
import { packSeatPlate, packWirePorts, wireLiner } from './pack-support';
/** Formed series tab with raised bridge, leaving the cell end-retainers unloaded. */
function seriesTab(points: [number, number][], terminal: number, bridge: number): Shape {
  const w = 4,
    t = 0.15;
  const segments = points.slice(1).map((b, i) => {
    const a = points[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    return transform(
      box([Math.hypot(dx, dy) + w, w, t], [-w / 2, -w / 2, bridge]),
      (Math.atan2(dy, dx) * 180) / Math.PI,
      [...a, 0],
    );
  });
  const ends = [points[0], points[points.length - 1]].flatMap(([x, y]) => [
    box([w, w, t], [x - w / 2, y - w / 2, terminal]),
    box(
      [t, w, Math.abs(terminal - bridge) + t],
      [x - t / 2, y - w / 2, Math.min(terminal, bridge)],
    ),
  ]);
  return union(...segments, ...ends);
}
export function batteryPieces(p: Parameters): Piece[] {
  const out: Piece[] = [],
    bottom = 10.5,
    top = 75.7,
    cells = batteryLayout(p),
    seatMaterial = p.cellSeatMaterial === 'pa12' ? 'PRINT PA12 · prototype' : 'POM · CNC';
  cells.forEach(([x, y], i) => {
    const polarity = i === 1 ? 'reversed; B1− / B2+' : i === 0 ? 'B− / B1+' : 'B2− / B+';
    const orient = (s: Shape): Shape =>
      i === 1 ? transform(rotate(transform(s, 0, [-x, -y, -43.1]), 180, 'x'), 0, [x, y, 43.1]) : s;
    out.push(
      {
        label: `18650 cell ${i + 1} · 3S1P · jacket · Ø18.6×65.2 · ${p.cellMass} g · ${polarity}`,
        shape: orient(cylinder(9.3, 64.65, [x, y, bottom + 0.25])),
        color: 0x5b927c,
      },
      {
        label: `18650 cell ${i + 1} · negative terminal`,
        shape: orient(cylinder(9.05, 0.25, [x, y, bottom])),
        color: 0x929eac,
      },
      {
        label: `18650 cell ${i + 1} · positive insulator`,
        shape: orient(ring(9.05, 5.8, top - 0.3, 0.3, x, y)),
        color: 0x252a31,
      },
      {
        label: `18650 cell ${i + 1} · positive terminal`,
        shape: orient(cylinder(5.8, 0.3, [x, y, top - 0.3])),
        color: 0xc5ccd4,
      },
      {
        label: `18650 end cushion ${i + 1} · silicone · Ø18.2/12×1`,
        shape: ring(9.1, 6, 75.7, 1, x, y),
        color: 0x526e8b,
      },
    );
  });
  out.push(
    {
      label: `3S common outer seat plate · ${seatMaterial} · web t2.5 · lightening pockets · 3×Ø19 seats depth6 · terminal access Ø12`,
      shape: packSeatPlate(p, false),
      color: 0xede9db,
    },
    {
      label: `3S common servo-side seat plate · ${seatMaterial} · web t3 · 3×Ø19 seats depth6 · terminal access Ø12`,
      shape: packSeatPlate(p, true),
      color: 0xede9db,
    },
    {
      label: '3S common seat backing plate · Al6061 · t2 · terminal access Ø12',
      shape: packSeatPlate(p, true, true),
      color: 0xc6cdd5,
    },
    ...packWirePorts.flatMap(([x, y], i) => [
      {
        label: `3S harness liner outer ${i + 1} · TPU 95A · bore Ø6 · flange Ø10 · grip5.5`,
        shape: wireLiner(x, y, 5, 5.5),
        color: 0x526e8b,
      },
      {
        label: `3S harness liner servo-side ${i + 1} · TPU 95A · bore Ø6 · flange Ø10 · grip5`,
        shape: wireLiner(x, y, 76.7, 5),
        color: 0x526e8b,
      },
    ]),
  );
  const [a, b, c] = cells;
  out.push(
    {
      label: '3S series tab B1 · cell 1+ to cell 2− · formed nickel t0.15 · routing reference',
      shape: seriesTab([a, [a[0], 16], [b[0], 16], b], top, 83),
      color: 0xd6d8d9,
    },
    {
      label: '3S series tab B2 · cell 2+ to cell 3− · formed nickel t0.15 · routing reference',
      shape: seriesTab([b, c], bottom - 0.15, 1.8),
      color: 0xd6d8d9,
    },
  );
  const m = layout(p);
  batteryPosts(m.radius).forEach(([x, y], i) => {
    const lower = transform(rotate(screw(2, 9), 180, 'x'), 0, [x, y, 14]),
      upper = transform(screw(2, 6), 0, [x, y, 40 + m.stackOffset]);
    out.push(
      {
        label: `3S frame tie to servo disk ${i + 1} · Al6061 · Ø5 shoulder at76.7 · Ø3 neck · M2 ends`,
        shape: subtract(
          union(cylinder(2.5, 66.2, [x, y, 10.5]), cylinder(1.5, 11.3, [x, y, 76.7])),
          matingHole(lower),
          matingHole(upper),
        ),
        color: 0xc6cdd5,
      },
      {
        label: `3S seat clamping spacer ${i + 1} · Al6061 · Ø5/3.2×6.3`,
        shape: ring(2.5, 1.6, 81.7, 6.3, x, y),
        color: 0xc6cdd5,
      },
      { label: `3S frame lower screw ${i + 1}`, shape: lower, color: 0x929eac },
      { label: `3S frame servo disk screw ${i + 1}`, shape: upper, color: 0x929eac },
    );
  });
  return out;
}
