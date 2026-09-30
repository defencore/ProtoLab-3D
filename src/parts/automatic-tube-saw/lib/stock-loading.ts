import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union, type Shape } from './shapes';
import { collection, pose, around, profile, paint, metal } from './layout';
import { cylinderPieces } from '../../compact-pneumatic-cylinder/lib/model';
import { measurementPieces } from '../../machine-measurement/lib/model';
import { rollerPieces } from '../../conveyor-roller/lib/model';

export const admissionX = -1700;
export function gateLink(degrees: number) {
  const angle = -degrees;
  const theta = (degrees * Math.PI) / 180;
  const base: [number, number, number] = [-1880, 220, 1070];
  const tip: [number, number, number] = [
    -1700 - 40 * Math.cos(theta),
    220,
    1070 - 40 * Math.sin(theta),
  ];
  const dx = tip[0] - base[0],
    dz = tip[2] - base[2];
  return {
    angle,
    base,
    tip,
    length: Math.hypot(dx, dz),
    extension: Math.hypot(dx, dz) - 140,
    rotation: (Math.atan2(dx, dz) * 180) / Math.PI,
  };
}
export function loadingPieces(p: Parameters, state: string) {
  const c = collection('Stock separation module'),
    s = profile(p),
    automatic = p.feedMode === 'automatic';
  if (!automatic) return [];
  const open = state !== 'bar-change',
    g = gateLink(open ? 90 : 0),
    pivot: [number, number, number] = [admissionX, 0, 1070];
  const swing = (q: Shape) => around(q, pivot, [0, g.angle, 0]);
  c.add(
    'Single-bar admission gate · steel t12 · full-section positive stop',
    swing(box([12, 180, 169], [admissionX - 6, -90, 901])),
    0xd6a843,
    'MAKE',
    'Closed blade stops 1 mm above the continuous table. Never close onto a bar; two endpoint sensors and clear-zone confirmation are mandatory.',
  );
  c.add('Admission gate shaft D20', cylinder(10, 410, [admissionX, -160, 1070], 'y'), metal);
  for (const y of [-150, 150]) {
    c.add(
      'Admission shaft bearing pedestal',
      subtract(
        box([45, 20, 45], [admissionX - 22.5, y - 10, 1047.5]),
        cylinder(10.05, 22, [admissionX, y - 11, 1070], 'y'),
      ),
      paint,
    );
    c.add(
      'Admission gate support column',
      box([40, 30, 247.5], [admissionX - 20, y - 15, 800]),
      paint,
    );
    c.add('Admission module floor leg', box([40, 40, 760], [admissionX - 20, y - 20, 40]), paint);
    c.add('Admission module anchored foot', box([90, 90, 8], [admissionX - 45, y - 45, 32]), metal);
  }
  c.add('Admission flat bridge · flush Z900', box([160, 140, 8], [-1810, -70, 892]), metal);
  c.add('Admission table cross beam', box([40, 330, 20], [-1720, -165, 872]), paint);
  c.add(
    'Gate crank · radius40',
    swing(
      subtract(box([50, 12, 14], [-1745, 214, 1063]), cylinder(4.1, 14, [-1740, 213, 1070], 'y')),
    ),
    metal,
  );
  if (automatic) {
    for (const q of cylinderPieces({ bore: 32, stroke: 50, extension: g.extension }))
      c.add(q.label, pose(pose(q.shape, [0, 0, 20]), g.base, [0, g.rotation, 0]), q.color, 'BUY');
    for (const [name, pos] of [
      ['rear', g.base],
      ['rod', g.tip],
    ] as const)
      c.add(
        `Admission ${name} pin D8`,
        cylinder(4, 36, [pos[0], pos[1] - 18, pos[2]], 'y'),
        metal,
        'BUY',
      );
    c.add(
      'Gate actuator rear adapter · pin to body 20 mm',
      pose(
        subtract(box([20, 20, 30], [-10, -10, -10]), cylinder(4.1, 22, [-0.0, -11, 0], 'y')),
        g.base,
        [0, g.rotation, 0],
      ),
      metal,
    );
    c.add(
      'Gate rod clevis · 19 mm effective pin offset',
      pose(
        subtract(
          box([20, 20, 29], [-10, -10, g.length - 19]),
          cylinder(4.1, 22, [0, -11, g.length], 'y'),
        ),
        g.base,
        [0, g.rotation, 0],
      ),
      metal,
    );
    c.add(
      'Gate actuator rear support to module',
      union(box([35, 95, 12], [-1897.5, 140, 1048]), box([35, 35, 248], [-1897.5, 140, 800])),
      paint,
    );
    c.add('Gate actuator support frame tie', box([215, 330, 20], [-1900, -165, 780]), paint);
    for (const x of [-2110, -1850]) {
      for (const q of rollerPieces({ model: 'ec5000', installationLength: 300 }))
        c.add(
          'Admission drive · ' + q.label,
          pose(q.shape, [x, 0, 875], [90, 0, 0]),
          q.color,
          'BUY',
        );
      for (const y of [-156, 150]) {
        c.add(
          'Admission roller bearing bracket',
          subtract(box([40, 6, 70], [x - 20, y, 815]), cylinder(6.3, 8, [x, y - 1, 875], 'y')),
          paint,
        );
        c.add('Admission conveyor leg', box([40, 40, 775], [x - 20, y - 17, 40]), paint);
      }
    }
    for (const y of [-175, 145])
      c.add(
        'Removable automatic loading conveyor rail',
        box([640, 30, 40], [-2240, y, 775]),
        paint,
      );
  } else {
    c.add(
      'Manual admission gate captive locking handle',
      swing(cylinder(12, 60, [admissionX, 175, 1070], 'y')),
      0x303a42,
      'BUY',
    );
  }
  for (const y of [-165, 145])
    c.add('Admission sensor frame longitudinal tie', box([650, 20, 20], [-1900, y, 780]), paint);
  // A beam on each side distinguishes a queued nose from a departing tail.
  for (const [name, x] of [
    ['Queue nose', -1760],
    ['Old tail clear', admissionX + Number(p.stockGap)],
  ] as const) {
    for (const sign of [-1, 1]) {
      for (const q of measurementPieces({ model: 'e3z-t81' }))
        c.add(
          `${name} beam · ${q.label}`,
          pose(q.shape, [x, sign * 140, s.center - 15.5], [0, 0, sign < 0 ? 0 : 180]),
          q.color,
          'BUY',
        );
      c.add(
        `${name} sensor post`,
        box([20, 20, s.center - 795], [x + 6, sign * 140 - 10, 800]),
        paint,
      );
      c.add(`${name} sensor cross support`, box([35, 310, 12], [x - 9, -155, 800]), paint);
    }
  }
  for (const [name, x, z] of [
    ['Gate closed', -1720, 920],
    ['Gate open', -1555, 1067],
  ] as const) {
    for (const q of measurementPieces({ model: 'e2b-m12' }))
      c.add(`${name} proof · ${q.label}`, pose(q.shape, [x, 146, z], [90, 0, 0]), q.color, 'BUY');
    c.add(
      `${name} sensor bracket`,
      subtract(box([35, 6, 40], [x - 17.5, 112, z - 20]), cylinder(6.1, 8, [x, 111, z], 'y')),
      metal,
    );
    c.add(`${name} sensor stand`, box([35, 20, z - 812], [x - 17.5, 120, 812]), paint);
    c.add(`${name} sensor stand foot`, box([35, 280, 12], [x - 17.5, -155, 800]), paint);
  }
  c.add(
    'Gate sensor flag · confirms blade itself, not actuator',
    swing(box([28, 9, 165], [-1724, 88, 902])),
    metal,
  );
  if (Boolean(p.showGuards) && state !== 'mechanism') {
    for (const y of [-205, 260])
      c.add('Stock admission fixed side guard', box([760, 3, 360], [-2240, y, 800]), paint);
    c.add(
      'Interlocked single-bar loading cover · transparent envelope',
      box([760, 465, 4], [-2240, -202, 1160]),
      0x819ba9,
      'REFERENCE',
      'Extend the enclosed single-bar loading bay for actual stock length. No butt feeding or open loading while the active bar crosses the stop.',
    );
    c.add(
      'Loading cover lock · independent monitored circuit',
      box([65, 30, 80], [-2070, -217, 1080]),
      0xe2bb34,
      'REFERENCE',
    );
  }
  return c.pieces;
}
