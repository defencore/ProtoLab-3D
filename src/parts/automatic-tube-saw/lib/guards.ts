import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union, type Shape } from './shapes';
import { collection, around, profile, paint, metal, dark } from './layout';
export function guardPieces(p: Parameters, state: string) {
  if (state === 'mechanism' || !p.showGuards) return [];
  const c = collection('Guards'),
    s = profile(p),
    angle = state === 'hood-open' ? 65 : 0;
  // Fixed lower cabinet encloses the complete blade/drive sweep, not just the cutting slot.
  for (const y of [-640, 636])
    c.add(
      'Fixed lower blade cabinet · steel t4',
      subtract(box([1090, 4, 600], [-430, y, 300]), cylinder(50, 10, [0, -646, 450], 'y')),
      paint,
    );
  for (const x of [-430, 656])
    c.add(
      'Lower cabinet end wall · service fasteners',
      subtract(box([4, 1280, 600], [x, -640, 300]), box([10, 340, 95], [652, -170, 810])),
      paint,
    );
  c.add(
    'Cabinet base sheet · bolted to crossmembers',
    box([1090, 1280, 4], [-430, -640, 296]),
    paint,
  );
  c.add(
    'Cabinet top infill outside the cutting table',
    subtract(
      box([1090, 1280, 4], [-430, -640, 884]),
      box([1044, 624, 6], [-412, -312, 883]),
      box([32, 340, 100], [630, -170, 810]),
    ),
    paint,
  );
  c.add(
    'Rear extraction flange D100 · duct connection',
    subtract(cylinder(60, 6, [0, -646, 450], 'y'), cylinder(50, 10, [0, -648, 450], 'y')),
    metal,
    'BUY',
  );
  const hinge: [number, number, number] = [0, -350, 1320];
  const cover = (shape: Shape) => around(shape, hinge, [angle, 0, 0]);
  for (const x of [-420, 616]) {
    const opening = box([8, s.width + 30, s.height + 25], [x - 2, -s.width / 2 - 15, 890]);
    c.add(
      'Hood end panel · stock tunnel opening',
      cover(subtract(box([4, 700, 420], [x, -350, 900]), opening)),
      0xdce2e5,
    );
  }
  c.add('Hinged hood rear panel', cover(box([1040, 4, 420], [-420, -350, 900])), 0xdce2e5);
  const window = box([600, 8, 200], [-300, 346, 1050]);
  c.add(
    'Hood front panel with retained inspection window',
    cover(subtract(box([1040, 4, 420], [-420, 346, 900]), window)),
    0xdce2e5,
  );
  c.add(
    'Polycarbonate inspection window · retained perimeter',
    cover(box([624, 8, 224], [-312, 350, 1038])),
    0x729fac,
    'MAKE',
    'Impact grade, thickness and retaining frame require containment verification',
  );
  for (const x of [-310, 306])
    c.add('Window vertical retaining bar', cover(box([12, 5, 224], [x, 358, 1038])), metal);
  for (const z of [1038, 1250])
    c.add('Window horizontal retaining bar', cover(box([624, 5, 12], [-312, 358, z])), metal);
  c.add('Hood roof', cover(box([1040, 700, 4], [-420, -350, 1320])), 0xdce2e5);
  c.add(
    'Hood handle',
    cover(
      union(
        box([140, 15, 15], [-70, 380, 1000]),
        box([15, 34, 15], [-70, 350, 1000]),
        box([15, 34, 15], [55, 350, 1000]),
      ),
    ),
    dark,
    'BUY',
  );
  for (const x of [-340, 460]) {
    c.add('Hood hinge pin · retained D12', cylinder(6, 80, [x, -350, 1320], 'x'), metal, 'BUY');
    c.add(
      'Hood fixed hinge pedestal',
      subtract(box([80, 30, 30], [x, -365, 1305]), cylinder(6.1, 82, [x - 1, -350, 1320], 'x')),
      paint,
    );
    c.add('Hinge support upright', box([40, 40, 420], [x + 20, -390, 900]), paint);
    c.add('Hinge support foot', box([80, 60, 12], [x, -400, 888]), paint);
  }
  c.add('Guard locking switch fixed bracket', box([50, 45, 100], [540, 350, 880]), paint);
  c.add(
    'Guard lock · positive locking device reserved envelope',
    box([40, 32, 80], [545, 360, 900]),
    0xdfbe45,
    'REFERENCE',
    'Select guard locking with monitored standstill release; ordinary part sensors are not safety-rated guard switches',
  );
  c.add('Hood interlock tongue', cover(box([8, 25, 35], [556, 345, 970])), metal);
  // The powered infeed tunnel encloses the fixed traction nip; it is wider/taller than the stock throat.
  for (const upstream of [true, false]) {
    const powered = upstream && p.feedMode !== 'manual';
    const x = upstream ? (powered ? -525 : -475) : 620,
      length = upstream ? (powered ? 105 : 55) : 170;
    const half = powered ? 220 : s.width / 2 + 20,
      top = powered ? s.top + 205 : s.top + 41;
    for (const y of [-half, half - 4])
      c.add('Adjustable stock access tunnel side', box([length, 4, top - 900], [x, y, 900]), paint);
    c.add('Stock tunnel top cover', box([length, 2 * half, 4], [x, -half, top]), paint);
    if (powered)
      c.add(
        'Traction tunnel entry guard',
        subtract(
          box([4, 2 * half, top - 900], [x, -half, 900]),
          box([6, s.width + 30, s.height + 25], [x - 1, -s.width / 2 - 15, 899]),
        ),
        paint,
      );
  }
  return c.pieces;
}
