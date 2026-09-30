import type { Parameters } from '../../../core/types';
import { box, cylinder, prism, subtract, union, type Shape } from './shapes';
import { cylinderPieces } from '../../compact-pneumatic-cylinder/lib/model';
import { rollerPieces } from '../../conveyor-roller/lib/model';
import { collection, pose, around, profile, trayLink, paint, metal, dark, pom } from './layout';
import { engineering } from './engineering';
function hull(points: [number, number][]) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (ps: [number, number][]) => {
    const h: [number, number][] = [];
    for (const q of ps) {
      while (h.length > 1) {
        const a = h[h.length - 2],
          b = h[h.length - 1];
        if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) > 0) break;
        h.pop();
      }
      h.push(q);
    }
    return h.slice(0, -1);
  };
  return [...half(points), ...half([...points].reverse())];
}
function belt(x1: number, x2: number, r1: number, r2: number, width: number) {
  const outline = (offset: number) =>
    hull(
      [
        [x1, r1],
        [x2, r2],
      ].flatMap(([x, r]) =>
        Array.from(
          { length: 64 },
          (_, i) =>
            [
              x + (r + offset) * Math.cos((i * Math.PI) / 32),
              899 - r + (r + offset) * Math.sin((i * Math.PI) / 32),
            ] as [number, number],
        ),
      ),
    );
  return subtract(
    prism(outline(1), width, -width / 2, 'y'),
    prism(outline(-1), width + 2, -width / 2 - 1, 'y'),
  );
}
export function handlingPieces(p: Parameters, state: string) {
  const c = collection('Powered outfeed'),
    e = engineering(p),
    s = profile(p);
  const tilt = (state === 'sorting' && e.shortPart) || state === 'rejecting' ? 60 : 0,
    linkage = trayLink(tilt);
  function conveyor(x1: number, x2: number, nose: number, width: number, tip = false) {
    const firstPiece = c.pieces.length;
    const move = (shape: Shape) => (tip ? around(shape, linkage.pivot, [tilt, 0, 0]) : shape);
    const driveX = x2;
    const frameStart = tip ? x1 - 20 : 172;
    c.add(
      tip ? 'Tilting receiver conveyor belt' : 'Take-away belt · small nose for 20 mm rings',
      move(belt(x1, x2, nose, 25, width)),
      0x405e67,
      'BUY',
      'Order reinforced belt compatible with small nose radius, swarf and lubricant; tracking and life require supplier approval',
    );
    c.add(
      'Belt wear bed · removable stainless plate',
      move(box([x2 - x1 - 35, width, 4], [x1 + 12, -width / 2, 892])),
      metal,
    );
    c.add(
      'Small-nose idler · sealed bearings',
      move(
        subtract(
          cylinder(nose, width + 6, [x1, -width / 2 - 3, 899 - nose], 'y'),
          cylinder(4, width + 8, [x1, -width / 2 - 4, 899 - nose], 'y'),
        ),
      ),
      metal,
      'BUY',
    );
    c.add(
      'Nose idler axle D8 · retained both ends',
      move(cylinder(4, width + 26, [x1, -width / 2 - 13, 899 - nose], 'y')),
      metal,
    );
    for (const q of rollerPieces({ model: 'ec5000', installationLength: 300 }))
      c.add(
        q.label,
        move(pose(q.shape, [driveX, 0, 874], [90, 0, 0])),
        q.color,
        'BUY',
        'Order AI control and supplier-approved length, crown and shaft interface.',
      );
    for (const y of [-148, 142]) {
      c.add(
        'Conveyor side frame · bearing bores and slotted tension adjustment',
        move(
          subtract(
            box([x2 - frameStart + 20, 6, 45], [frameStart, y, 850]),
            cylinder(6.3, 8, [x2, y - 1, 874], 'y'),
            cylinder(4.2, 8, [x1, y - 1, 899 - nose], 'y'),
            ...(tip ? [cylinder(8.1, x2 - frameStart + 22, [frameStart - 1, 245, 880], 'x')] : []),
          ),
        ),
        paint,
      );
      if (!tip)
        c.add('Conveyor bolted support leg', box([35, 35, 80], [x2 - 17.5, y - 14, 770]), paint);
    }
    // The first small roller is supported by brackets close to the narrow belt, not by a free axle.
    for (const y of [-width / 2 - 10, width / 2 + 4])
      c.add(
        'Nose bearing support bracket',
        move(
          subtract(
            box([24, 6, 35], [x1 - 12, y, 865]),
            cylinder(4.2, 8, [x1, y - 1, 899 - nose], 'y'),
            ...(tip ? [cylinder(8.1, x2 - frameStart + 22, [frameStart - 1, 245, 880], 'x')] : []),
          ),
        ),
        paint,
      );
    for (const y of [-width / 2 - 10, width / 2 + 4])
      c.add(
        'Nose bracket support tie',
        move(box([Math.max(x1 + 35, frameStart + 20) - x1 + 22, 6, 12], [x1 - 12, y, 853])),
        paint,
      );
    for (const x of [Math.max(x1 + 35, frameStart + 20), x2 - 40])
      c.add('Conveyor cross tie', move(box([20, 284, 6], [x - 10, -142, 850])), paint);
    if (tip)
      for (const x of [720, 1500, 2300])
        c.add(
          'Receiver hinge lug',
          move(
            subtract(box([20, 125, 35], [x, 142, 860]), cylinder(8.1, 22, [x - 1, 245, 880], 'x')),
          ),
          paint,
        );
    if (tip) for (const q of c.pieces.slice(firstPiece)) q.group = 'Tilting receiver';
  }
  conveyor(16, 640, 8, 100);
  conveyor(695, 2370, 25, 240, true);
  for (const x of [650, 2420]) {
    c.add(
      'Receiver pivot pedestal · M8 fixing',
      subtract(box([12, 55, 105], [x - 6, 217.5, 790]), cylinder(8.1, 14, [x - 7, 245, 880], 'x')),
      paint,
    );
    c.add(
      'Receiver pivot bushing',
      subtract(
        cylinder(13, 12, [x - 6, 245, 880], 'x'),
        cylinder(8.05, 14, [x - 7, 245, 880], 'x'),
      ),
      pom,
      'BUY',
    );
  }
  c.add('Receiver captive pivot shaft D16', cylinder(8, 1810, [636, 245, 880], 'x'), metal);
  for (const x of [1000, 2050]) {
    const linkage = trayLink(tilt, x);
    c.add(
      'Receiver crank radius120',
      around(
        subtract(box([12, 135, 12], [x - 6, 235, 874]), cylinder(6.1, 14, [x - 7, 365, 880], 'x')),
        linkage.pivot,
        [tilt, 0, 0],
      ),
      metal,
    );
    for (const q of cylinderPieces({ bore: 50, stroke: 200, extension: linkage.extension }))
      c.add(
        q.label,
        pose(pose(q.shape, [0, 0, 20]), linkage.base, [linkage.rotation, 0, 0]),
        q.color,
        'BUY',
      );
    for (const z of [0, linkage.length])
      c.add(
        'Receiver cylinder clevis adapter',
        pose(
          subtract(
            box([24, 24, 30], [-12, -12, z === 0 ? -10 : z - 20]),
            cylinder(6.1, 26, [-13, 0, z], 'x'),
          ),
          linkage.base,
          [linkage.rotation, 0, 0],
        ),
        metal,
      );
    c.add(
      'Receiver cylinder rear mounting flange',
      pose(
        subtract(
          box([65.5, 65.5, 4], [-32.75, -32.75, 16]),
          ...[-23.25, 23.25].flatMap((x) =>
            [-23.25, 23.25].map((y) => cylinder(2.75, 6, [x, y, 15])),
          ),
        ),
        linkage.base,
        [linkage.rotation, 0, 0],
      ),
      metal,
    );
    for (const [name, point] of [
      ['base', linkage.base],
      ['rod', linkage.tip],
    ] as const) {
      c.add(
        `Receiver ${name} clevis pin D12`,
        cylinder(6, 90, [point[0] - 45, point[1], point[2]], 'x'),
        metal,
        'BUY',
      );
      const fixedPoint = name === 'rod' ? trayLink(0, x).tip : point;
      const ears = [-45, 35].map((dx) =>
        subtract(
          box([10, 30, 30], [fixedPoint[0] + dx, fixedPoint[1] - 15, fixedPoint[2] - 15]),
          cylinder(6.1, 12, [fixedPoint[0] + dx - 1, fixedPoint[1], fixedPoint[2]], 'x'),
        ),
      );
      const clevis = union(
        ...ears,
        box([90, 30, 9], [fixedPoint[0] - 45, fixedPoint[1] - 15, fixedPoint[2] - 15]),
      );
      c.add(
        `Receiver ${name} clevis bracket`,
        name === 'rod' ? around(clevis, linkage.pivot, [tilt, 0, 0]) : clevis,
        paint,
      );
    }
    c.add('Receiver cylinder base stand', box([100, 80, 25], [x - 50, 310, 470]), paint);
    for (const y of [310, 370])
      c.add('Receiver actuator anchored pedestal', box([35, 25, 430], [x - 17.5, y, 40]), paint);
  }
  c.add('Receiver mechanical closed stop', box([35, 26, 60], [2350, -168, 790]), paint);
  for (const x of [650, 1500, 2420])
    for (const y of [-180, 280]) {
      c.add('Discharge module floor leg', box([40, 40, 740], [x - 20, y - 20, 40]), paint);
      c.add('Discharge leveling foot', box([100, 100, 10], [x - 50, y - 50, 30]), metal);
    }
  for (const y of [-200, 260])
    c.add('Discharge frame longitudinal beam', box([1810, 40, 50], [630, y, 780]), paint);
  for (const x of [650, 1500, 2420])
    c.add('Discharge frame crossmember', box([40, 500, 40], [x - 20, -200, 440]), paint);
  // Enclosed gravity chute outside the blade compartment and below the cross beams.
  c.add(
    'Short-part chute floor · sloped toward collection box',
    pose(box([1770, 750, 3], [0, 0, 0]), [660, -510, 350], [15, 0, 0]),
    metal,
  );
  for (const x of [660, 2427])
    c.add(
      'Short-part chute sidewall',
      pose(box([3, 750, 120], [0, 0, 0]), [x, -510, 350], [15, 0, 0]),
      paint,
    );
  c.add(
    'Removable short-part collection box',
    subtract(box([1860, 330, 260], [610, -700, 50]), box([1852, 322, 260], [614, -696, 54])),
    0x556c7e,
    'BUY',
    'Empty with machine stopped; box position and chute-clear sensor are cycle permissives',
  );
  c.add(
    'Separate scrap bin - facing trims and bar ends only',
    subtract(box([1860, 330, 150], [610, -1070, 50]), box([1852, 322, 150], [614, -1066, 54])),
    0x975346,
    'BUY',
  );
  const reject = state === 'rejecting',
    flapAngle = reject ? 15 : -65;
  c.add(
    'Reject selector flap - Al6082 t3 - gravity chute extension',
    around(box([1770, 400, 3], [660, -910, 350]), [0, -510, 350], [flapAngle, 0, 0]),
    metal,
  );
  c.add(
    'Reject selector shaft D20 - coupled outer cranks',
    cylinder(10, 2020, [530, -510, 350], 'x'),
    metal,
  );
  for (const x of [550, 2530]) {
    const theta = (flapAngle * Math.PI) / 180,
      base: [number, number, number] = [x, -600, 145],
      tip: [number, number, number] = [x, -510 - 40 * Math.cos(theta), 350 - 40 * Math.sin(theta)],
      len = Math.hypot(tip[1] - base[1], tip[2] - base[2]),
      rotation = (Math.atan2(base[1] - tip[1], tip[2] - base[2]) * 180) / Math.PI;
    c.add(
      'Reject selector bearing pedestal',
      subtract(
        box([20, 40, 40], [x - 10, -530, 330]),
        cylinder(10.1, 22, [x - 11, -510, 350], 'x'),
      ),
      paint,
    );
    c.add('Reject selector support post', box([30, 30, 290], [x - 15, -530, 40]), paint);
    c.add('Reject actuator floor bracket', box([50, 60, 95], [x - 25, -630, 40]), paint);
    c.add(
      'Reject selector crank R40',
      around(
        subtract(box([12, 55, 14], [x - 6, -555, 343]), cylinder(4.1, 14, [x - 7, -550, 350], 'x')),
        [x, -510, 350],
        [flapAngle, 0, 0],
      ),
      metal,
    );
    for (const q of cylinderPieces({ bore: 50, stroke: 100, extension: len - 193.5 }))
      c.add(
        'Reject flap - ' + q.label,
        pose(pose(q.shape, [0, 0, 20]), base, [rotation, 0, 0]),
        q.color,
        'BUY',
      );
    for (const z of [0, len])
      c.add(
        'Reject actuator clevis with D8 pin',
        pose(
          subtract(
            box([24, 24, 30], [-12, -12, z === 0 ? -10 : z - 20]),
            cylinder(4.1, 26, [-13, 0, z], 'x'),
          ),
          base,
          [rotation, 0, 0],
        ),
        metal,
      );
    for (const point of [base, tip])
      c.add(
        'Reject selector captive pin D8',
        cylinder(4, 40, [point[0] - 20, point[1], point[2]], 'x'),
        metal,
        'BUY',
      );
  }
  // Outfeed roller table is independent of the sorting tray: long pieces continue downstream.
  for (const x of [2440, 2500, 2560, 2620, 2680, 2740]) {
    for (const q of rollerPieces({
      model: x === 2500 ? 'ec5000' : '1700',
      installationLength: 300,
    }))
      c.add(q.label, pose(q.shape, [x, 0, 875], [90, 0, 0]), q.color, 'BUY');
    for (const y of [-156, 150])
      c.add(
        'Outfeed roller mounting bracket',
        subtract(box([35, 6, 60], [x - 17.5, y, 820]), cylinder(4.3, 8, [x, y - 1, 875], 'y')),
        paint,
      );
  }
  for (const y of [-175, 145])
    c.add('Outfeed roller table beam', box([390, 30, 35], [2400, y, 785]), paint);
  for (const x of [2430, 2760])
    for (const y of [-160, 160])
      c.add('Outfeed roller table leg', box([30, 30, 750], [x - 15, y - 15, 35]), paint);
  for (const q of c.pieces) q.shape = pose(q.shape, [e.outfeedOffset, 0, 0]);
  return c.pieces;
}
