import { extrudedSection } from './profiles';
import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union } from './shapes';
import { cylinderPieces } from '../../compact-pneumatic-cylinder/lib/model';
import { collection, pose, profile, paint, metal, dark, pom } from './layout';
import { engineering } from './engineering';
export function fixturePieces(p: Parameters, state: string) {
  const c = collection('Cutting fixtures'),
    s = profile(p),
    e = engineering(p),
    a = Number(p.angle);
  const bladeSlot = pose(box([8, 620, 250], [-4, -310, 875]), [0, 0, 0], [0, 0, a]);
  const automatic = p.feedMode !== 'manual';
  const beltPocket = box([683, 104, 100], [7, -52, 820]);
  const pockets = automatic ? [beltPocket] : [];
  // The relieved knife edge clears the real belt wrap rather than intersecting it.
  // Five millimetres to the top tangent is smaller than the shortest supported part.
  if (automatic)
    c.add(
      'Flush steel nose bridge · ground top Z900 · 5 mm tangent gap',
      subtract(
        box([4, 104, 12], [e.beltStart - 1, -52, 888]),
        cylinder(9.5, 106, [e.beltStart + 8, -53, 891], 'y'),
        bladeSlot,
      ),
      metal,
    );
  const boltHoles = [-370, 550].flatMap((x) =>
    [-280, 280].map((y) => cylinder(4.5, 20, [x, y, 884])),
  );
  c.add(
    'Steel cutting table t12 · flush mitre insert and supported take-away belt',
    subtract(
      box([1040, 620, 12], [-410, -310, 888]),
      cylinder(300.4, 16, [0, 0, 886]),
      ...pockets,
      ...boltHoles,
    ),
    metal,
  );
  c.add(
    `Stationary keyed throat cassette D600 t12 · ${a} deg · 8 mm slot · replace on angle change`,
    subtract(cylinder(300, 12, [0, 0, 888]), bladeSlot, ...pockets),
    metal,
  );
  c.add(
    'Turned throat support ring · bolted to saw base posts',
    subtract(cylinder(345, 20, [0, 0, 868]), cylinder(290, 22, [0, 0, 867]), ...pockets),
    paint,
  );
  if (automatic && e.outfeedOffset > 0)
    c.add(
      'Angle-kit flat infill between throat and docked belt',
      subtract(box([e.outfeedOffset, 104, 12], [7, -52, 888]), bladeSlot),
      metal,
    );
  for (const x of [-370, 550])
    for (const y of [-280, 280]) {
      c.add(
        'Table support pedestal · RHS40 clearance fixing',
        subtract(
          box([40, 40, 28], [x - 20, y - 20, 860]),
          box([34, 34, 30], [x - 17, y - 17, 859]),
        ),
        paint,
      );
      c.add(
        'Table outboard support column',
        box([40, 40, 40], [x - 20, Math.sign(y) * 610 - 20, 820]),
        paint,
      );
      c.add(
        'Table transverse support arm',
        box([40, 350, 28], [x - 20, y < 0 ? -630 : 280, 860]),
        paint,
      );
      c.screw(x, y, 900, 8, 30);
    }
  for (const sign of [-1, 1]) {
    const x = sign * e.offcutClamp,
      bodyX =
        sign *
        Math.max(
          Math.abs(x) + 90,
          (s.width / 2 + 160) * Math.tan((Math.abs(a) * Math.PI) / 180) + 60,
        );
    const open =
      state === 'hood-open' ||
      (sign < 0
        ? state === 'feeding'
        : !['clamping', 'cutting', 'retracting', 'stroke'].includes(state));
    const topOpen =
      sign < 0
        ? open
        : ['hood-open', 'assembled', 'feeding', 'mechanism', 'returning', 'sorting'].includes(
            state,
          );
    const lift = topOpen ? 25 : 0,
      sideLift = open ? 25 : 0;
    const top = s.top + 135.5,
      rear = -s.width / 2 - 100;
    // The stand is bolted to the table; horizontal slots allow moving the whole fixture toward the kerf.
    c.add(
      `${sign < 0 ? 'Stock' : 'Offcut'} fixture slotted base`,
      subtract(
        box([100, 75, 12], [bodyX - 50, rear - 25, 900]),
        ...[-30, 30].map((dx) =>
          union(
            cylinder(4.5, 14, [bodyX + dx, rear - 12, 899]),
            cylinder(4.5, 14, [bodyX + dx, rear + 22, 899]),
            box([9, 34, 14], [bodyX + dx - 4.5, rear - 12, 899]),
          ),
        ),
      ),
      paint,
    );
    for (const dx of [-30, 30]) c.screw(bodyX + dx, rear, 912, 8, 30);
    c.add(
      'Vertical clamp stand · RHS40 with bolted height collar',
      subtract(
        box([40, 40, top - 912], [bodyX - 20, rear - 20, 912]),
        box([34, 34, top - 910], [bodyX - 17, rear - 17, 911]),
      ),
      paint,
    );
    c.add(
      'Vertical cylinder cantilever mount · four D5.5 mounting bores',
      subtract(
        box([76, -rear + 65, 12], [bodyX - 38, rear - 20, top]),
        ...[-23.25, 23.25].flatMap((dx) =>
          [-23.25, 23.25].map((dy) => cylinder(2.75, 14, [bodyX + dx, dy, top - 1])),
        ),
        ...[-45, 45].map((y) => cylinder(10.05, 14, [bodyX, y, top - 1])),
      ),
      metal,
    );
    for (const q of cylinderPieces({ bore: 50, stroke: 25, extension: topOpen ? 0 : 25 }))
      c.add(q.label, pose(q.shape, [bodyX, 0, top], [180, 0, 0]), q.color, 'BUY');
    for (const dx of [-23.25, 23.25])
      for (const dy of [-23.25, 23.25]) c.screw(bodyX + dx, dy, top + 12, 5, 90);
    // Two guide rods carry the offset shoe moment; the pneumatic piston is not a cantilever bearing.
    for (const y of [-45, 45]) {
      c.add(
        'Vertical shoe guide D12 · captive at moving arm',
        cylinder(6, 105, [bodyX, y, s.top + 32 + lift]),
        metal,
        'BUY',
      );
      c.add(
        'Vertical guide bushing sleeve',
        subtract(cylinder(10, 30, [bodyX, y, top - 5]), cylinder(6.05, 32, [bodyX, y, top - 6])),
        dark,
        'BUY',
      );
    }
    c.add(
      'Vertical shoe guided toe arm · steel t12',
      subtract(
        box([Math.abs(bodyX - x) + 12, 110, 12], [Math.min(x, bodyX) - 6, -55, s.top + 20 + lift]),
        cylinder(5.25, 14, [bodyX, 0, s.top + 19 + lift]),
      ),
      metal,
    );
    c.add(
      'BUY ISO4762 M10x30 · vertical rod-to-toe screw · nominal thread',
      union(
        cylinder(5, 30, [bodyX, 0, s.top + 20 + lift]),
        cylinder(7.5, 10, [bodyX, 0, s.top + 10 + lift]),
      ),
      dark,
      'BUY',
    );
    const upper = box(
      [12, Math.min(s.width + 12, 100), 28],
      [x - 6, -Math.min(s.width + 12, 100) / 2, s.top - 8 + lift],
    );
    if (sign < 0)
      c.add(
        `Replaceable ${s.round ? 'radius' : 'flat'} top insert · POM · two M4 fixings`,
        subtract(
          box([12, s.width + 8, 30], [x - 6, -s.width / 2 - 4, s.top - 10 + lift]),
          extrudedSection(String(p.profile), s.width, s.height, 16, x - 8, 900 + lift),
        ),
        pom,
      );
    else {
      const rw = Math.min(80, s.width + 20);
      c.add(
        'Exchangeable outfeed rolling top shoe D12 · reduced pressure during transfer',
        subtract(
          cylinder(6, rw, [x, -rw / 2, s.top + 6 + lift], 'y'),
          cylinder(2.1, rw + 2, [x, -rw / 2 - 1, s.top + 6 + lift], 'y'),
        ),
        pom,
      );
      c.add(
        'Rolling shoe axle D4 · retained at both fork ears',
        cylinder(2, rw + 12, [x, -rw / 2 - 6, s.top + 6 + lift], 'y'),
        metal,
      );
      for (const y of [-rw / 2 - 6, rw / 2 + 2])
        c.add(
          'Rolling shoe fork ear',
          subtract(
            box([12, 4, 18], [x - 6, y, s.top + 2 + lift]),
            cylinder(2.1, 6, [x, y - 1, s.top + 6 + lift], 'y'),
          ),
          metal,
        );
    }
    // Split rear fences stop short of the kerf. Each is adjusted with the fixture, not swept through the blade.
    const fence = box(
      [140, 12, s.height + 8],
      [sign < 0 ? x - 134 : x - 6, -s.width / 2 - 12, 900],
    );
    c.add(
      'Adjustable rear datum fence · two M8 slots · replaceable facing',
      subtract(fence, bladeSlot),
      metal,
    );
    c.add(
      'Rear fence support angle',
      box([100, Math.abs(rear + s.width / 2) - 12, 10], [bodyX - 50, rear, 900]),
      paint,
    );
    // Horizontal cylinder, with its own regulator, uses an offset guided toe like the vertical clamp.
    const front = s.width / 2 + 135.5,
      hc = Math.max(950, s.center);
    c.add(
      'Horizontal clamp base · twin M8 adjustment slots',
      subtract(
        box([100, 100, 12], [bodyX - 50, s.width / 2 + 55, 900]),
        ...[-30, 30].map((dx) => box([9, 70, 14], [bodyX + dx - 4.5, s.width / 2 + 70, 899])),
      ),
      paint,
    );
    c.add(
      'Horizontal cylinder rear mounting plate',
      subtract(
        box([76, 12, hc + 40 - 912], [bodyX - 38, front, 912]),
        ...[-23.25, 23.25].flatMap((dx) =>
          [-23.25, 23.25].map((dz) => cylinder(2.75, 14, [bodyX + dx, front - 1, hc + dz], 'y')),
        ),
        ...[-23, 23].map((dz) => cylinder(10.05, 14, [bodyX, front - 1, hc + dz], 'y')),
      ),
      metal,
    );
    for (const q of cylinderPieces({ bore: 50, stroke: 25, extension: open ? 0 : 25 }))
      c.add(q.label, pose(q.shape, [bodyX, front, hc], [90, 0, 0]), q.color, 'BUY');
    c.add(
      'Horizontal guided toe arm · steel t12',
      subtract(
        box(
          [Math.abs(bodyX - x) + 12, 12, 66],
          [Math.min(x, bodyX) - 6, s.width / 2 + 20 + sideLift, hc - 33],
        ),
        cylinder(5.25, 14, [bodyX, s.width / 2 + 19 + sideLift, hc], 'y'),
      ),
      metal,
    );
    c.add(
      'BUY ISO4762 M10x30 · horizontal rod-to-toe screw · nominal thread',
      union(
        cylinder(5, 30, [bodyX, s.width / 2 + 20 + sideLift, hc], 'y'),
        cylinder(7.5, 10, [bodyX, s.width / 2 + 10 + sideLift, hc], 'y'),
      ),
      dark,
      'BUY',
    );
    if (hc > s.center)
      c.add(
        'Horizontal low-profile shoe drop link',
        box([12, 12, hc - s.center + 30], [x - 6, s.width / 2 + 20 + sideLift, s.center - 15]),
        metal,
      );
    for (const dz of [-23, 23]) {
      c.add(
        'Horizontal shoe guide D10',
        cylinder(5, 105, [bodyX, s.width / 2 + 32 + sideLift, hc + dz], 'y'),
        metal,
        'BUY',
      );
      c.add(
        'Horizontal guide bushing block',
        subtract(
          cylinder(10, 25, [bodyX, front - 12, hc + dz], 'y'),
          cylinder(5.05, 27, [bodyX, front - 13, hc + dz], 'y'),
        ),
        dark,
        'BUY',
      );
    }
    const side = box(
      [12, 28, Math.min(50, s.height)],
      [x - 6, s.width / 2 - 8 + sideLift, s.center - Math.min(50, s.height) / 2],
    );
    c.add(
      `Replaceable ${s.round ? 'radius' : 'flat'} side insert · POM`,
      pose(
        subtract(
          box(
            [12, s.width / 2 + 20, Math.min(50, s.height)],
            [x - 6, 0, s.center - Math.min(50, s.height) / 2],
          ),
          extrudedSection(String(p.profile), s.width, s.height, 16, x - 8, 900),
        ),
        [0, sideLift, 0],
      ),
      pom,
    );
  }
  return c.pieces;
}
