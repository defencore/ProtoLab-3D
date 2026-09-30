import type { Parameters } from '../../../core/types';
import { collection, pose, profile, paint, metal } from './layout';
import { box, cylinder, subtract } from './shapes';
import { rollerPieces } from '../../conveyor-roller/lib/model';
import { cylinderPieces } from '../../compact-pneumatic-cylinder/lib/model';
// This fixed nip bridges the handover from the shuttle to the take-away belt.
// It moves an intact, already classified remnant; never uses a new bar as a pusher.
export function purgeDrivePieces(p: Parameters, state: string) {
  if (p.feedMode === 'manual') return [];
  const c = collection('Fixed stock traction'),
    s = profile(p),
    x = -455;
  for (const q of rollerPieces({ model: 'ec5000', installationLength: 300 }))
    c.add('Stock traction - ' + q.label, pose(q.shape, [x, 0, 875], [90, 0, 0]), q.color, 'BUY');
  for (const y of [-156, 150]) {
    c.add(
      'Traction bearing pedestal',
      subtract(box([40, 6, 70], [x - 20, y, 815]), cylinder(6.3, 8, [x, y - 1, 875], 'y')),
      paint,
    );
    c.add('Traction mounting foot', box([50, 80, 12], [x - 25, y - 35, 803]), paint);
  }
  const top = s.top + 160.5,
    open = state === 'hood-open',
    lift = open ? 25 : 0;
  for (const y of [-185, 165])
    c.add('Traction upper roller stand', box([35, 20, top - 900], [x - 17.5, y, 900]), paint);
  c.add(
    'Traction upper roller cylinder mount',
    subtract(
      box([60, 380, 12], [x - 30, -190, top]),
      ...[-23.25, 23.25].flatMap((dx) =>
        [-23.25, 23.25].map((dy) => cylinder(2.75, 14, [x + dx, dy, top - 1])),
      ),
    ),
    metal,
  );
  for (const q of cylinderPieces({ bore: 50, stroke: 25, extension: open ? 0 : 25 }))
    c.add(
      'Traction pressure - ' + q.label,
      pose(q.shape, [x, 0, top], [180, 0, 0]),
      q.color,
      'BUY',
    );
  c.add(
    'Traction captive upper pressure roller',
    cylinder(25, 140, [x, -70, s.top + 25 + lift], 'y'),
    0x405e67,
    'BUY',
    'Select non-marking roller sleeve and bearings; adjustable regulator is separate from the cutting clamps.',
  );
  c.add(
    'Traction upper roller axle D12',
    cylinder(6, 180, [x, -90, s.top + 25 + lift], 'y'),
    metal,
  );
  for (const y of [-90, 80])
    c.add(
      'Traction guided roller fork',
      subtract(
        box([30, 10, 42], [x - 15, y, s.top + 12 + lift]),
        cylinder(6.1, 12, [x, y - 1, s.top + 25 + lift], 'y'),
      ),
      metal,
    );
  c.add('Traction roller crosshead', box([45, 180, 12], [x - 22.5, -90, s.top + 50 + lift]), metal);
  for (const y of [-90, 90]) {
    c.add('Traction fork guide D12', cylinder(6, 110, [x, y, s.top + 50 + lift]), metal, 'BUY');
    c.add(
      'Traction guide bush',
      subtract(cylinder(10, 28, [x, y, top - 10]), cylinder(6.05, 30, [x, y, top - 11])),
      metal,
      'BUY',
    );
  }
  return c.pieces;
}
