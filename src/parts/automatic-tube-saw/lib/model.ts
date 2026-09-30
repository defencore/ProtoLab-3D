import guidePart from '../../linear-guide/part';
import { bearingPieces } from './hardware';
import type { Parameters } from '../../../core/types';
import { box, cylinder, prism, subtract, union, type Shape, type Vec } from './shapes';
import type { Piece } from './assembly';
import { bladePieces } from '../../circular-saw-blade/lib/model';
import { rollerPieces } from '../../conveyor-roller/lib/model';
import { cylinderPieces } from '../../compact-pneumatic-cylinder/lib/model';
import { motorPieces } from '../../machine-drive-motor/lib/model';
import { controlPieces } from '../../machine-control/lib/model';
import { engineering, DESIGN } from './engineering';
import { fixturePieces } from './fixtures';
import { handlingPieces } from './handling';
import { instrumentationPieces } from './instrumentation';
import { guardPieces } from './guards';
import { feedTablePieces, feedGripPieces } from './feed-table';
import { loadingPieces } from './stock-loading';
import { purgeDrivePieces } from './purge-drive';
import { dockingPieces, explodedModules } from './modules';
import { operatorPieces } from './operator-panel';
import { profile, profileSolid, pose } from './layout';
export interface MachinePiece extends Piece {
  group: string;
  procurement: 'MAKE' | 'BUY' | 'REFERENCE';
  process: string;
}
const steel = 0x718499,
  aluminium = 0xb9c4ce,
  dark = 0x343e47,
  plastic = 0xd8b66b;
const transform = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
export function machinePieces(p: Parameters, state: string): MachinePiece[] {
  const out: MachinePiece[] = [],
    e = engineering(p),
    D = Number(p.tubeDiameter),
    section = profile(p),
    r = D / 2,
    zTube = section.center;
  const mechanism = state === 'mechanism',
    a = Number(p.angle);
  const stroke = DESIGN.bladeCut - DESIGN.bladeHome;
  const up =
    state === 'cutting'
      ? stroke
      : state === 'retracting'
        ? stroke / 2
        : state === 'stroke'
          ? (Number(p.strokePosition) * stroke) / 100
          : 0;
  const liftOffset = DESIGN.bladeHome - 640 + up;
  const feed = [
    'feeding',
    'clamping',
    'cutting',
    'retracting',
    'releasing',
    'transferring',
    'sorting',
    'stroke',
  ].includes(state)
    ? e.advance
    : 0;
  const movingX = -1100 + feed;
  const movingOpen = [
    'cutting',
    'retracting',
    'releasing',
    'transferring',
    'sorting',
    'returning',
  ].includes(state);
  function add(
    label: string,
    shape: Shape,
    color = steel,
    group = 'Frame',
    procurement: MachinePiece['procurement'] = 'MAKE',
    process = 'Cut, weld and machine; drawing tolerances pending',
  ) {
    out.push({ label, shape, color, group, procurement, process });
  }
  function purchased(parts: Piece[], position: Vec, rotation: Vec, group: string) {
    for (const q of parts)
      add(
        q.label,
        transform(q.shape, position, rotation),
        q.color,
        group,
        'BUY',
        'Purchased component; see its library source and geometry limitations',
      );
  }
  function tube(size: Vec, origin: Vec, wall = 3) {
    return subtract(
      box(size, origin),
      box(
        [size[0] + 2, size[1] - 2 * wall, size[2] - 2 * wall],
        [origin[0] - 1, origin[1] + wall, origin[2] + wall],
      ),
    );
  }
  function plate(
    label: string,
    w: number,
    d: number,
    t: number,
    x: number,
    y: number,
    z: number,
    holes: [number, number, number][] = [],
  ) {
    add(
      label,
      subtract(
        box([w, d, t], [x, y, z]),
        ...holes.map(([hx, hy, diam]) => cylinder(diam / 2, t + 2, [hx, hy, z - 1])),
      ),
    );
  }
  function bolt(x: number, y: number, z: number, d = 8, length = 25, group = 'Fasteners') {
    add(
      `BUY ISO4762 M${d}x${length} · 8.8 · nominal thread`,
      union(
        cylinder(d / 2, length, [x, y, z - length], 'z', {
          pitch: d === 6 ? 1 : d === 8 ? 1.25 : 1.5,
        }),
        cylinder(d * 0.75, d, [x, y, z]),
      ),
      dark,
      group,
      'BUY',
      'Standard screw; confirm final stack and thread engagement',
    );
  }
  // Welded frame and independently supported modular roller tables.
  if (p.feedMode !== 'manual')
    for (const y of [-310, 250]) {
      add(
        'Infeed longitudinal beam RHS60x60x3',
        tube([1020, 60, 60], [-1450, y, 760]),
        steel,
        'Infeed base',
      );
    }
  for (const y of [-640, 580])
    add('Wide saw cabinet load beam RHS60x60x3', tube([1144, 60, 60], [-430, y, 760]));
  for (const x of p.feedMode === 'manual' ? [-440, 610] : [-1400, -600, -440, 610]) {
    const group = x < -450 ? 'Infeed base' : x > 1000 ? 'Outfeed base' : 'Frame';
    const wide = x === -440 || x === 610,
      span = wide ? 1220 : 560;
    const crossZ = wide ? 760 : 700;
    const crossShape = transform(
      tube([span, 60, 60], [-span / 2, -30, 0]),
      [x, 0, crossZ],
      [0, 0, 90],
    );
    add(
      'S235 cross member RHS60x60x3',
      x === -440 ? subtract(crossShape, box([62, 70, 50], [x - 31, -35, 773])) : crossShape,
      steel,
      group,
    );
    for (const y of wide ? [-610, 610] : [-280, 280]) {
      add(
        'S235 square-tube leg 60x60x3',
        subtract(
          box([60, 60, crossZ - 50], [x - 30, y - 30, 50]),
          box([54, 54, crossZ - 48], [x - 27, y - 27, 49]),
        ),
        steel,
        group,
      );
      plate('Steel foot plate 100x100x8', 100, 100, 8, x - 50, y - 50, 42, [
        [x - 32, y, 11],
        [x + 32, y, 11],
      ]);
      out[out.length - 1].group = group;
    }
  }
  if (p.feedMode !== 'manual') {
    const feedStart = out.length;
    // Reuse the library rail and closed ball circuits at the HG20 mounting envelope.
    const railParams = {
      ...guidePart.defaults,
      length: 1000,
      railWidth: 20,
      railHeight: 17.5,
      railHole: 6,
      counterbore: 9.5,
      counterDepth: 8.5,
      holePitch: 60,
      endOffset: 30,
      blockLength: 77.5,
      blockWidth: 63,
      totalHeight: 30,
      baseClearance: 4.6,
      blockPitchX: 40,
      blockPitchY: 53,
      blockHole: 5,
      holeDepth: 8,
    };
    for (const y of [-115, 115]) {
      add('Feed rail mounting beam RHS60x60x3', tube([1000, 60, 60], [-1400, y - 30, 760]));
      add(
        'BUY profile rail HG20 mounting envelope',
        transform({ kind: 'library-guide', parameters: railParams, state: 'rail' }, [-900, y, 820]),
        aluminium,
        'Feed axis',
        'BUY',
      );
      for (const dx of [-55, 55])
        add(
          'BUY recirculating carriage HGW20 mounting envelope',
          transform(
            {
              kind: 'library-guide',
              parameters: {
                ...railParams,
                position: 50 + ((movingX + dx + 900) * 100) / (1000 - 77.5),
              },
              state: 'carriage',
            },
            [-900, y, 820],
          ),
          aluminium,
          'Feed axis',
          'BUY',
        );
    }
    const carriageHoles = [-55, 55].flatMap((dx) =>
      [-115, 115].flatMap((y) =>
        [-20, 20].flatMap((hx) =>
          [-26.5, 26.5].map((hy) => [movingX + dx + hx, y + hy, 6.6] as [number, number, number]),
        ),
      ),
    );
    plate(
      'Feed carriage · Al6082 plate 220x480x12',
      220,
      480,
      12,
      movingX - 110,
      -240,
      850,
      carriageHoles,
    );
    for (const [x, y] of carriageHoles) bolt(x, y, 862, 6, 20, 'Feed axis');
    add(
      'BUY SFU1605 screw · lead5 · 5 mm helical race · smooth export',
      cylinder(8, 1000, [-1410, 0, 800], 'x', { pitch: 5, rounded: true }),
      aluminium,
      'Feed axis',
      'BUY',
      'Specify end machining to the selected BK/BF supports; groove omitted',
    );
    add(
      'BUY SFU1605 nut · mounting interface pending supplier drawing',
      subtract(
        cylinder(24, 42, [movingX - 21, 0, 800], 'x'),
        cylinder(8.1, 44, [movingX - 22, 0, 800], 'x'),
      ),
      plastic,
      'Feed axis',
      'BUY',
      'Supplier-specific flange and support dimensions must be confirmed',
    );
    add(
      'Ball nut carrier · clamp split and drill after supplier confirmation',
      subtract(
        box([50, 60, 45], [movingX - 25, -30, 805]),
        cylinder(24.1, 52, [movingX - 26, 0, 800], 'x'),
      ),
      steel,
      'Feed axis',
    );
    for (const x of [-1405, -415])
      add(
        'Ball screw end support · reserved BK/BF12 interface',
        subtract(box([30, 60, 40], [x - 15, -30, 780]), cylinder(8.1, 32, [x - 16, 0, 800], 'x')),
        steel,
        'Feed axis',
        'REFERENCE',
        'Select support set and machine journals before release',
      );
    for (const x of [-1405, -415])
      add('Feed screw support riser', box([30, 60, 20], [x - 15, -30, 760]), steel, 'Feed axis');
    add(
      'Feed motor mounting plate',
      subtract(
        box([8, 90, 80], [-1450, -45, 770]),
        cylinder(19.1, 10, [-1451, 0, 800], 'x'),
        ...[-23.57, 23.57].flatMap((y) =>
          [-23.57, 23.57].map((dz) => cylinder(2.75, 10, [-1451, y, 800 + dz], 'x')),
        ),
      ),
      steel,
      'Feed axis',
    );
    add('Feed motor bracket foot', box([70, 90, 10], [-1450, -45, 760]), steel, 'Feed axis');
    purchased(motorPieces({ model: '23hs30-2804-me1k' }), [-1450, 0, 800], [0, 90, 0], 'Feed axis');
    add(
      'BUY flexible coupling D25 L30 · 6.35/12 bores to confirm',
      subtract(cylinder(12.5, 30, [-1435, 0, 800], 'x'), cylinder(6, 32, [-1436, 0, 800], 'x')),
      plastic,
      'Feed axis',
      'REFERENCE',
      'Final motor and screw shaft interfaces pending',
    );
    for (const q of out.slice(feedStart)) if (q.group === 'Frame') q.group = 'Feed axis';
    out.push(...feedGripPieces(p, movingX, movingOpen));
  }
  out.push(
    ...fixturePieces(p, state),
    ...purgeDrivePieces(p, state),
    ...(p.feedMode === 'manual' ? [] : feedTablePieces(p)),
    ...(p.feedMode === 'automatic' ? loadingPieces(p, state) : []),
    ...operatorPieces(p),
    ...(p.feedMode === 'manual' ? [] : handlingPieces(p, state)),
    ...instrumentationPieces(p, state, movingX),
  );
  // Manual mitre turntable and lifting saw subassembly, wholly below the feed at rest.
  const sawShape = (s: Shape) => transform(s, [0, 0, 0], [0, 0, a]);
  add(
    'S235 saw turntable · D700x15 · manual mitre',
    subtract(
      cylinder(350, 15, [0, 0, 300]),
      cylinder(20, 17, [0, 0, 299]),
      sawShape(cylinder(31, 17, [175, 120, 299])),
    ),
    steel,
    'Saw base',
  );
  for (const deg of [-45, 0, 45]) {
    const b = (deg * Math.PI) / 180;
    bolt(320 * Math.cos(b), 320 * Math.sin(b), 315, 10, 30, 'Mitre locking');
  }
  for (const y of [-230, 230]) {
    add(
      'Saw lift ground guide D25',
      sawShape(cylinder(12.5, 520, [120, y, 320])),
      aluminium,
      'Saw lift',
      'BUY',
      'Guide supports and bearing selection pending load calculation',
    );
    add(
      'Saw guide foot',
      sawShape(
        subtract(box([55, 55, 25], [92.5, y - 27.5, 315]), cylinder(12.55, 27, [120, y, 314])),
      ),
      steel,
      'Saw lift',
    );
    add(
      'Saw guide upper cross support',
      sawShape(subtract(box([80, 50, 20], [110, y - 25, 820]), cylinder(12.55, 22, [120, y, 819]))),
      steel,
      'Saw lift',
    );
    add(
      'Saw lift carriage bushing',
      sawShape(
        subtract(
          box([40, 50, 70], [100, y - 25, 490 + liftOffset]),
          cylinder(12.6, 72, [120, y, 489 + liftOffset]),
        ),
      ),
      steel,
      'Saw lift',
      'BUY',
      'Reserved linear bearing housing; confirm selected series',
    );
  }
  add(
    'Saw moving backplate · S235 t15',
    sawShape(
      subtract(
        box([15, 520, 185], [140, -260, 490 + liftOffset]),
        cylinder(16, 17, [139, 0, 640 + up], 'x'),
      ),
    ),
    steel,
    'Saw lift',
  );
  add(
    'Saw base support frame · four load-bearing columns',
    subtract(box([520, 600, 20], [-170, -300, 280]), cylinder(245, 22, [0, 0, 279])),
    steel,
    'Saw base',
  );
  for (const x of [-170, 310])
    for (const y of [-280, 280])
      add('Saw base support leg', box([40, 40, 230], [x, y - 20, 50]), steel, 'Saw base');
  const liftShape = (shape: Shape) => sawShape(pose(shape, [0, 120, 0]));
  add(
    'BUY SFU1605 saw lift screw · L550 · 2:1 reduction',
    liftShape(cylinder(8, 550, [175, 0, 275], 'z', { pitch: 5, rounded: true })),
    aluminium,
    'Saw lift',
    'BUY',
    'Supplier end machining and normally engaged holding brake must be confirmed',
  );
  for (const z of [315, 800])
    add(
      'Saw lift screw bearing support',
      liftShape(subtract(box([60, 60, 20], [155, -30, z]), cylinder(8.1, 22, [175, 0, z - 1]))),
      steel,
      'Saw lift',
    );
  add(
    'Saw lift upper bearing crossmember',
    sawShape(box([30, 510, 25], [155, -255, 820])),
    steel,
    'Saw lift',
  );
  add(
    'Saw lift nut housing',
    liftShape(
      subtract(
        box([60, 60, 45], [155, -30, 480 + liftOffset]),
        cylinder(8.1, 47, [175, 0, 479 + liftOffset]),
      ),
    ),
    aluminium,
    'Saw lift',
  );
  add(
    'Saw lift nut-to-carriage cross plate',
    liftShape(
      subtract(
        box([65, 70, 15], [155, -35, 525 + liftOffset]),
        cylinder(9, 17, [175, 0, 524 + liftOffset]),
      ),
    ),
    steel,
    'Saw lift',
  );
  for (const q of motorPieces({ model: '23hs30-2804-me1k' }))
    add(q.label, liftShape(pose(q.shape, [245, 0, 250])), q.color, 'Saw lift', 'BUY');
  add(
    'Lift motor flange bracket',
    liftShape(subtract(box([75, 130, 8], [207.5, -65, 242]), cylinder(19.1, 10, [245, 0, 241]))),
    steel,
    'Saw lift',
  );
  for (const y of [-65, 55])
    add(
      'Lift motor bracket standoff',
      liftShape(box([75, 10, 30], [207.5, y, 250])),
      steel,
      'Saw lift',
    );
  for (const [x, r] of [
    [175, 30],
    [245, 15],
  ])
    add(
      'Lift synchronous pulley · 2:1 speed reduction',
      liftShape(
        subtract(cylinder(r, 14, [x, 0, 265]), cylinder(x === 175 ? 8 : 3.175, 16, [x, 0, 264])),
      ),
      dark,
      'Saw lift',
      'BUY',
    );
  add(
    'Saw lift synchronous belt',
    liftShape(
      subtract(
        prism(
          beltOutline(1, [
            [175, 0, 30],
            [245, 0, 15],
          ]),
          12,
          266,
        ),
        prism(
          beltOutline(-0.5, [
            [175, 0, 30],
            [245, 0, 15],
          ]),
          14,
          265,
        ),
      ),
    ),
    dark,
    'Saw lift',
    'BUY',
  );
  add(
    'Lift screw safety brake reservation · normally engaged',
    liftShape(subtract(cylinder(30, 28, [175, 0, 285]), cylinder(8.1, 30, [175, 0, 284]))),
    0xc99c43,
    'Saw lift',
    'REFERENCE',
    'Select a rated power-off holding brake before operation; a ballscrew is backdrivable',
  );
  const sawZ = DESIGN.bladeHome + up;
  for (const q of bladePieces({ model: 'lu5h50001' }))
    add(
      q.label,
      sawShape(transform(q.shape, [0, 0, sawZ], [0, 90, 0])),
      q.color,
      'Saw spindle',
      'BUY',
      'Use manufacturer blade; tooth detail illustrative',
    );
  add(
    'Saw spindle · 42CrMo4 · D30 bearing journals · drawing pending',
    sawShape(cylinder(15, 260, [-18, 0, sawZ], 'x')),
    aluminium,
    'Saw spindle',
  );
  for (const x of [-10, 2])
    add(
      'Saw blade flange D100x8 · ground mating face',
      sawShape(
        subtract(cylinder(50, 8, [x, 0, sawZ], 'x'), cylinder(15.05, 10, [x - 1, 0, sawZ], 'x')),
      ),
      steel,
      'Saw spindle',
    );
  for (const x of [35, 105]) {
    for (const item of bearingPieces(`6206 spindle ${x}`, [x, 0, sawZ], 'x', 30, 62, 16))
      add(
        item.label,
        sawShape(item.shape),
        item.color,
        'Saw spindle',
        'BUY',
        'Bearing internal geometry is illustrative; supplier envelope is 30/62/16.',
      );
    add(
      'Spindle bearing carrier · steel boreD62',
      sawShape(
        subtract(
          box([24, 90, 100], [x - 4, -45, sawZ - 70]),
          cylinder(31.02, 26, [x - 5, 0, sawZ], 'x'),
        ),
      ),
      steel,
      'Saw spindle',
    );
  }
  add(
    'Spindle bearing support shelf',
    sawShape(box([125, 110, 16], [15, -55, sawZ - 86])),
    steel,
    'Saw spindle',
  );
  const motorAt: Vec = [240, -190, sawZ - 110];
  for (const q of motorPieces({ model: 'bevi90l2' }))
    add(
      q.label,
      sawShape(transform(q.shape, motorAt, [90, 0, -90])),
      q.color,
      'Saw drive',
      'BUY',
      'BEVI supplier external dimensions; verify mounting plate and belt alignment',
    );
  add(
    'Spindle pulley D100 · pitch reference',
    sawShape(
      subtract(cylinder(50, 20, [210, 0, sawZ], 'x'), cylinder(15, 22, [209, 0, sawZ], 'x')),
    ),
    dark,
    'Saw drive',
    'REFERENCE',
    'Select a balanced purchased pulley and rated belt',
  );
  add(
    'Motor pulley D80 · pitch reference',
    sawShape(
      subtract(
        cylinder(40, 20, [210, -190, sawZ - 110], 'x'),
        cylinder(12, 22, [209, -190, sawZ - 110], 'x'),
      ),
    ),
    dark,
    'Saw drive',
    'REFERENCE',
    '80:100 nominal speed ratio; actual pitch diameters control ratio',
  );
  // Belt tangencies are the convex hull of the two pitch circles in the YZ plane.
  function beltOutline(
    extra: number,
    circles = [
      [0, 0, 50],
      [110, -190, 40],
    ],
  ): [number, number][] {
    const pts: [number, number][] = [];
    for (const [cx, cy, rad] of circles)
      for (let i = 0; i < 64; i++) {
        const t = (i * Math.PI) / 32;
        pts.push([cx + (rad + extra) * Math.cos(t), cy + (rad + extra) * Math.sin(t)]);
      }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: number[], a: number[], b: number[]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (arr: [number, number][]) => {
      const h: [number, number][] = [];
      for (const q of arr) {
        while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
        h.push(q);
      }
      return h.slice(0, -1);
    };
    return [...half(pts), ...half([...pts].reverse())];
  }
  add(
    'Drive belt · continuous reference path · rating pending',
    sawShape(
      transform(
        subtract(prism(beltOutline(1), 15, 212.5), prism(beltOutline(-2), 17, 211.5)),
        [0, 0, sawZ],
        [0, 90, 0],
      ),
    ),
    dark,
    'Saw drive',
    'REFERENCE',
    'Select belt section, length, tension and speed rating from supplier data',
  );
  add(
    'Motor support shelf · S235 t12',
    sawShape(box([425, 210, 12], [155, -295, sawZ - 212])),
    steel,
    'Saw drive',
  );
  for (const y of [-270, -120])
    add('Motor shelf brace', sawShape(box([15, 20, 85], [155, y, sawZ - 200])), steel, 'Saw drive');
  // Cabinet with purchased components, separate from the chip path.
  add(
    'Control cabinet · steel 600x250x500',
    subtract(box([600, 250, 500], [-1350, 330, 160]), box([596, 246, 498], [-1348, 332, 162])),
    steel,
    'Controls',
    'BUY',
    'Select an enclosure with the required ingress and cooling rating',
  );
  for (const x of [-1300, -800]) {
    add(
      'Control cabinet support hanger',
      box([40, 40, 220], [x - 20, 270, 540]),
      steel,
      'Controls',
    );
    add('Control cabinet mounting angle', box([40, 65, 12], [x - 20, 270, 540]), steel, 'Controls');
  }
  let cx = -1300;
  for (const model of ['atv12hu22m2', 'dvp14ss211t', 'cl57t-v3', 'lrs15024', 'pnozx3']) {
    const parts = controlPieces({ model });
    purchased(parts, [cx, 335, 230], [0, 0, 0], 'Controls');
    cx += model === 'atv12hu22m2' ? 125 : model === 'lrs15024' ? 155 : 75;
  }
  const shown =
    p.feedMode === 'manual'
      ? Math.min(500, Number(p.stockLength))
      : Boolean(p.fullStock)
        ? Number(p.stockLength)
        : Math.min(Number(p.stockLength), 1250);
  if (state === 'bar-change' && p.feedMode === 'automatic') {
    add(
      'Previous bar · retained remnant · removal required',
      profileSolid(p, e.endRemainder, -e.endRemainder - 2),
      0xaa8981,
      'Workpiece',
      'REFERENCE',
    );
    add(
      'Next bar · queued behind closed admission stop',
      profileSolid(
        p,
        Boolean(p.fullStock) ? Number(p.stockLength) : 500,
        -1712 - (Boolean(p.fullStock) ? Number(p.stockLength) : 500),
      ),
      0x739ea8,
      'Workpiece',
      'REFERENCE',
    );
  }
  if (!mechanism && state !== 'bar-change' && state !== 'rejecting') {
    const atCut = ['feeding', 'clamping', 'cutting', 'retracting', 'stroke'].includes(state);
    const end = atCut ? Number(p.cutLength) + e.kerfAxial / 2 : -e.kerfAxial / 2;
    const tube = profileSolid(p, shown, -shown + end);
    const kerf = sawShape(box([4, 400, 300], [-2, -200, 850]));
    add(
      'Aluminium stock · workpiece',
      ['cutting', 'retracting'].includes(state) ? subtract(tube, kerf) : tube,
      0x739ea8,
      'Workpiece',
      'REFERENCE',
      'Actual section dimensions and straightness must be measured',
    );
    if (['releasing', 'transferring', 'sorting'].includes(state)) {
      const x =
        state === 'releasing'
          ? e.kerfAxial / 2
          : state === 'transferring'
            ? 360
            : e.shortPart
              ? 820 - Number(p.cutLength) / 2
              : 2460 + e.outfeedOffset;
      const offcut = profileSolid(p, Number(p.cutLength), x);
      add(
        'Separated offcut · positive take-away and sorting',
        state === 'sorting' && e.shortPart ? pose(offcut, [0, -330, -498]) : offcut,
        0x83b4be,
        'Workpiece',
        'REFERENCE',
        'Illustrative staged transfer; sensors must confirm the real part path',
      );
    }
  }
  if (state === 'rejecting' && p.feedMode !== 'manual')
    add(
      'Classified bar remnant - scrap chute',
      pose(profileSolid(p, e.endRemainder, 760 + e.outfeedOffset), [0, -700, -650]),
      0xaa8981,
      'Workpiece',
      'REFERENCE',
      'Illustrative scrap path; ordered sensor transitions prove removal.',
    );
  const rollerXs = [
    ...(Boolean(p.fullStock)
      ? Array.from(
          { length: Math.max(1, Math.ceil((Number(p.stockLength) - 1600) / 500) + 1) },
          (_, i) => -1600 - i * 500,
        )
      : [-1600]),
  ];
  for (const x of p.feedMode === 'manual' ? [] : rollerXs) {
    purchased(rollerPieces({ installationLength: 300 }), [x, 0, 875], [90, 0, 0], 'Roller tables');
    for (const y of [-156, 150])
      add(
        'Roller end bracket · M8 through hole',
        subtract(box([40, 6, 55], [x - 20, y, 835]), cylinder(4.3, 8, [x, y - 1, 875], 'y')),
        steel,
        'Roller tables',
      );
    if (x < -1450) {
      for (const y of [-160, 140])
        add('Infeed table leg', box([30, 30, 800], [x - 15, y, 35]), steel, 'Roller tables');
    }
    add(
      'Roller support crossbar',
      box([40, x < -1450 ? 330 : 620, 15], [x - 20, x < -1450 ? -165 : -310, 820]),
      steel,
      'Roller tables',
    );
  }
  out.push(...guardPieces(p, state), ...dockingPieces(p));
  for (const q of out) if (q.group === 'Controls') q.shape = pose(q.shape, [1020, 320, 0]);
  return explodedModules(out, state);
}
