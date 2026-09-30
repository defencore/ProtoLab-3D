import { extrudedSection } from './profiles';
import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract } from './shapes';
import { collection, pose, profile, metal, paint, pom } from './layout';
import { cylinderPieces } from '../../compact-pneumatic-cylinder/lib/model';

// All stock-contact bottoms share Z900. The moving clamp grips from the sides,
// so its return stroke cannot catch a cut end on a raised lower radius insert.
export function feedTablePieces(p: Parameters) {
  const c = collection('Flat stock table');
  c.add(
    'Continuous infeed table · ground steel t8 · top Z900',
    subtract(box([1239.5, 140, 8], [-1650, -70, 892]), box([54, 304, 60], [-482, -152, 845])),
    metal,
  );
  for (const x of [-1420, -412]) {
    c.add('Infeed table end cross support', box([35, 560, 12], [x - 17.5, -280, 880]), paint);
    for (const y of [-280, 245])
      c.add(
        'Infeed table leveling pedestal · shim to Z900',
        box([35, 35, 60], [x - 17.5, y, 820]),
        paint,
      );
  }
  for (const y of [-65, 50])
    c.add(
      'Under-table longitudinal stiffener · clear of side-clamp carriage',
      box([1110, 15, 22], [-1610, y, 870]),
      paint,
    );
  // Four common bolting pads remain in manual mode; the motor/rails detach as a module.
  for (const x of [-1400, -600])
    for (const y of [-250, 250]) {
      c.add(
        'Automatic module docking pad · two D9 through bolts and D6 locating bore',
        subtract(
          box([80, 70, 10], [x - 40, y - 35, 750]),
          ...[-25, 25].map((dx) => cylinder(4.5, 12, [x + dx, y, 749])),
          cylinder(3, 12, [x, y + 20, 749]),
        ),
        metal,
      );
    }
  if (p.feedMode === 'manual')
    c.add(
      'Manual-mode connector blanking plate · keyed module identification',
      box([100, 6, 60], [-1460, -316, 730]),
      paint,
    );
  return c.pieces;
}

export function feedGripPieces(p: Parameters, x: number, open: boolean) {
  const c = collection('Feed gripper'),
    s = profile(p),
    r = s.width / 2;
  const hc = s.center,
    travel = open ? 25 : 0,
    front = r + 123.5,
    rear = -Math.max(90, r + 40);
  for (const [y, height] of [
    [rear, s.top + 12 - 862],
    [front, hc + 40 - 862],
  ]) {
    c.add(
      'Feed side-clamp upright · bolted to carriage',
      box([130, 16, height], [x - 65, y, 862]),
      paint,
    );
    c.add(
      'Feed side-clamp foot · two M8 through fixings',
      subtract(
        box([80, 40, 8], [x - 40, y - 10, 862]),
        ...[-25, 25].map((dx) => cylinder(4.5, 12, [x + dx, y + 8, 861])),
      ),
      metal,
    );
    for (const dx of [-25, 25]) c.screw(x + dx, y + 8, 870, 8, 25);
  }
  c.add(
    'Feed fixed side jaw backing',
    box([30, -r - 12 - rear - 16, s.height], [x - 15, rear + 16, 900]),
    metal,
  );
  const jaw = box(
    [24, 28, Math.min(s.height, 50)],
    [x - 12, -r - 12, hc - Math.min(s.height, 50) / 2],
  );
  c.add(
    'Feed fixed replaceable side insert · radius / flat · POM',
    subtract(box([24,r+12,Math.min(s.height,50)],[x-12,-r-12,hc-Math.min(s.height,50)/2]),extrudedSection(String(p.profile),s.width,s.height,26,x-13,900)),
    pom,
  );
  for (const q of cylinderPieces({ bore: 50, stroke: 25, extension: open ? 0 : 25 }))
    c.add(q.label, pose(q.shape, [x, front, hc], [90, 0, 0]), q.color, 'BUY');
  const face = box(
    [24, 28, Math.min(s.height, 50)],
    [x - 12, r - 8 + travel, hc - Math.min(s.height, 50) / 2],
  );
  c.add(
    'Feed moving replaceable side insert · POM',
    pose(subtract(box([24,r+20,Math.min(s.height,50)],[x-12,0,hc-Math.min(s.height,50)/2]),extrudedSection(String(p.profile),s.width,s.height,26,x-13,900)),[0,travel,0]),
    pom,
  );
  c.add(
    'Feed guided side jaw arm · M10 rod connection',
    subtract(
      box([110, 12, 50], [x - 55, r + 20 + travel, hc - 25]),
      cylinder(5.25, 14, [x, r + 19 + travel, hc], 'y'),
    ),
    metal,
  );
  for (const dx of [-45, 45]) {
    c.add('Feed shoe guide D8', cylinder(4, 115, [x + dx, r + 32 + travel, hc], 'y'), metal, 'BUY');
    c.add(
      'Feed shoe sleeve · D8.1 bore',
      subtract(
        cylinder(7, 25, [x + dx, front - 10, hc], 'y'),
        cylinder(4.05, 27, [x + dx, front - 11, hc], 'y'),
      ),
      metal,
      'BUY',
    );
  }
  // The upright plate is machined for the rod guides and all four cylinder screws.
  const upright = c.pieces.find(
    (q) =>
      q.label === 'Feed side-clamp upright · bolted to carriage' &&
      q.shape.kind === 'box' &&
      q.shape.origin[1] === front,
  );
  if (upright)
    upright.shape = subtract(
      upright.shape,
      ...[-45, 45].map((dx) => cylinder(7.05, 18, [x + dx, front - 1, hc], 'y')),
      ...[-23.25, 23.25].flatMap((dx) =>
        [-23.25, 23.25].map((dz) => cylinder(2.75, 18, [x + dx, front - 1, hc + dz], 'y')),
      ),
    );
  return c.pieces;
}
