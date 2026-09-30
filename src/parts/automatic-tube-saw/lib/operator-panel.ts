import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract } from './shapes';
import { collection, pose, paint, metal, dark } from './layout';
import { controlPieces } from '../../machine-control/lib/model';

export function operatorPieces(p: Parameters) {
  const c = collection('Operator panel and emergency stops');
  c.add(
    'DDCS operator console · enclosed rear wiring space',
    subtract(
      box([430, 106, 280], [-40, -810, 960]),
      box([422, 100, 272], [-36, -810, 964]),
      box([231, 8, 141], [-10.5, -816, 1026.35]),
      cylinder(11.2, 10, [320, -816, 1140], 'y'),
    ),
    paint,
  );
  // The face sheet is separate so it can be drilled after checking the delivered controller.
  c.add(
    'Operator face sheet · DDCS cutout verify on delivered unit · D22 controls',
    subtract(
      box([430, 4, 280], [-40, -814, 960]),
      box([231, 6, 141], [-10.5, -815, 1026.35]),
      ...[
        [320, 1140],
        [45, 990],
        [115, 990],
        [185, 990],
        [270, 990],
      ].map(([x, z]) => cylinder(11.2, 6, [x, -815, z], 'y')),
    ),
    metal,
  );
  for (const q of controlPieces({ model: 'ddcs-v4-1' }))
    c.add(q.label, pose(q.shape, [105, -765.8, 1020], [0, 0, 180]), q.color, 'BUY');
  for (const x of [20, 340]) {
    c.add('Console support arm to cabinet frame', box([40, 204, 30], [x - 20, -784, 790]), paint);
    c.add('Console upright', box([40, 40, 140], [x - 20, -784, 820]), paint);
  }
  for (const [x, name, color] of [
    [45, 'Separate safety reset', 0x4388ba],
    [115, 'Cycle start', 0x44ad6a],
    [185, 'Controlled stop', dark],
    [270, 'Keyed STANDALONE / ASSISTED / AUTO selector', dark],
  ] as const) {
    c.add(
      name,
      pose(cylinder(11, 30, [0, 0, 0]), [x, -789, 990], [90, 0, 0]),
      color,
      'REFERENCE',
      'Select sealed industrial D22 operator; no software reset of emergency stops',
    );
    if (x === 270)
      c.add('Mode selector key', box([5, 10, 25], [x - 2.5, -829, 977.5]), metal, 'REFERENCE');
  }
  for (const [name, x, y, z] of [
    ['Operator', 320, -762, 1120],
    ['Infeed', -1500, -285, 1040],
    ['Outfeed', 2700, -285, 1040],
  ] as const) {
    if (p.feedMode === 'manual' && name !== 'Operator') continue;
    for (const q of controlPieces({ model: 'xb5as8444' }))
      c.add(
        `${name} emergency stop · ${q.label}`,
        pose(q.shape, [x, y, z], [0, 0, 180]),
        q.color,
        'BUY',
      );
    c.add(
      `${name} emergency stop yellow background`,
      subtract(
        cylinder(30, 2, [x, y - 54, z + 20], 'y'),
        cylinder(11.2, 4, [x, y - 55, z + 20], 'y'),
      ),
      0xf4cf27,
    );
    if (name !== 'Operator') {
      c.add(
        `${name} emergency stop station enclosure`,
        subtract(
          box([85, 65, 85], [x - 42.5, y - 52, z - 22]),
          box([79, 59, 79], [x - 39.5, y - 49, z - 19]),
          cylinder(11.2, 8, [x, y - 56, z + 20], 'y'),
        ),
        paint,
      );
      c.add(`${name} emergency stop pedestal`, box([35, 35, 1010], [x - 17.5, y - 10, 8]), paint);
      c.add(
        `${name} emergency stop anchored foot`,
        subtract(
          box([120, 120, 8], [x - 60, y - 60, 0]),
          ...[-45, 45].map((dx) => cylinder(5.5, 10, [x + dx, y, -1])),
        ),
        metal,
      );
    }
  }
  c.add(
    p.feedMode !== 'manual'
      ? 'Powered feed module keyed safety connector'
      : 'MANUAL fixed-guard coded plug',
    box([55, 20, 60], [-410, -330, 690]),
    0xc4af49,
    'REFERENCE',
    'Dedicated mode detection plus independently monitored guard circuit; never bridge emergency-stop channels',
  );
  return c.pieces;
}
