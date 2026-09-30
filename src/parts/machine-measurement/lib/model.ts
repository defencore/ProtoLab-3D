import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union, type Shape } from './shapes';
import type { Piece } from './assembly';
export function measurementPieces(p: Parameters): Piece[] {
  const pieces: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0xb6c1cb) =>
    pieces.push({ label, shape, color });
  if (p.model === 'mwe21') {
    const r = 200 / (2 * Math.PI);
    add(
      'Kuebler MWE21 measuring wheel · PU · circumference200 mm',
      subtract(cylinder(r, 12, [0, -6, 0], 'y'), cylinder(3, 14, [0, -7, 0], 'y')),
      0x313c42,
    );
    add(
      'Sendix KIS40 encoder · D40 envelope · 1000 ppr option',
      cylinder(20, 40, [0, 14, 0], 'y'),
      0x99a8b5,
    );
    add('Encoder shaft D6', cylinder(3, 62, [0, -8, 0], 'y'));
    add(
      'Spring arm · adjustable preload · approximate housing contour',
      subtract(box([88, 8, 22], [-10, 6, -11]), cylinder(3.2, 10, [0, 5, 0], 'y')),
      0x386a90,
    );
    add('Spring pivot / preload adjuster', cylinder(15, 32, [70, -5, 0], 'y'), 0x386a90);
    add(
      'Arm mounting face · four D5.5 holes · verify supplier drawing',
      subtract(
        box([42, 8, 42], [49, -13, -21]),
        ...[-14, 14].flatMap((dx) =>
          [-14, 14].map((dz) => cylinder(2.75, 10, [70 + dx, -14, dz], 'y')),
        ),
      ),
    );
  } else if (p.model === 'e3z-t81') {
    add(
      'OMRON E3Z-T81 receiver · 10.8x20x31 · two M3 P25.4',
      subtract(
        box([10.8, 20, 31], [-5.4, -20, 0]),
        ...[2.8, 28.2].map((z) => cylinder(1.25, 13, [-6.5, -11, z], 'x')),
      ),
      0x30383f,
    );
    add('Optical lens · sensing face +Y', cylinder(3.2, 0.8, [0, 0, 15.5], 'y'), 0xa43535);
    add('Cable exit · strain relief', cylinder(2, 8, [0, -14, -8]), 0x202830);
    add('Status indicator', box([3, 2, 1], [-1.5, -5, 31]), 0x68bb6c);
  } else {
    add('OMRON E2B-M12KS04-WP-B1 2M · M12x1 body · L47', cylinder(6, 47, [0, 0, 0]), 0xa5afb9);
    add('Sensing face · 4 mm nominal sensing range', cylinder(5.4, 0.5, [0, 0, 47]), 0x2f3a46);
    for (const z of [18, 27])
      add(
        'M12x1 mounting nut · nominal bore',
        subtract(cylinder(8.5, 4, [0, 0, z]), cylinder(6.05, 6, [0, 0, z - 1])),
      );
    add('Cable tail · strain relief', cylinder(2, 10, [0, 0, -10]), 0x252d34);
  }
  return pieces;
}
