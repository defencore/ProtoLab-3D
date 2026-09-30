import type { Parameters } from '../../../core/types';
import type { MachinePiece } from './model';
import { collection, pose, metal, paint } from './layout';
import { box, cylinder, subtract, union } from './shapes';

export type MachineMode = 'manual' | 'assisted' | 'automatic';
export function moduleName(q: MachinePiece) {
  if (/^(Powered outfeed|Tilting receiver|Output module|Outfeed base)$/.test(q.group))
    return '03 - Discharge module';
  if (
    /^(Receiver|Cut exit|Roller outlet|Chute|Scrap|Optical bridge|Outfeed emergency)/.test(q.label)
  )
    return '03 - Discharge module';
  if (
    /^(Feed axis|Feed gripper|Flat stock table|Roller tables|Infeed base|Fixed stock traction)$/.test(
      q.group,
    ) ||
    /^(Feed carriage|Feed rail|Infeed longitudinal|Infeed emergency|Infeed material|Leading-edge|BUY Kuebler|Measuring|Encoder mounting|Feed sensor|Feed home|Feed overtravel)/.test(
      q.label,
    )
  )
    return '02 - Measuring and feed module';
  if (q.group === 'Stock separation module') return '04 - Automatic bar admission';
  return '01 - Standalone cutting cell';
}
export function dockingPieces(p: Parameters) {
  const c = collection('Module docking');
  for (const x of [-425, 635])
    for (const y of [-270, 270]) {
      c.add(
        'Common module flange - two M12 bolts and D8 dowel',
        subtract(
          box([10, 70, 100], [x, y - 35, 745]),
          ...[770, 820].map((z) => cylinder(6.6, 12, [x - 1, y, z], 'x')),
          cylinder(4, 12, [x - 1, y + 20, 795], 'x'),
        ),
        metal,
      );
      c.add(
        'Welded docking flange support',
        box([70, 60, 20], [x < 0 ? x : x - 60, y - 30, 760]),
        paint,
      );
      if (p.feedMode !== 'manual') {
        c.add(
          'Removable module mating flange',
          subtract(
            box([10, 70, 100], [x + (x < 0 ? -12 : 12), y - 35, 745]),
            ...[770, 820].map((z) => cylinder(6.6, 40, [x - 15, y, z], 'x')),
          ),
          metal,
        );
        for (const z of [770, 820])
          c.add(
            'BUY M12x50 module clamp bolt - nominal',
            union(cylinder(6, 50, [x - 20, y, z], 'x'), cylinder(9, 12, [x + 30, y, z], 'x')),
            0x303a42,
            'BUY',
          );
      }
    }
  if (p.feedMode !== 'manual')
    for (const y of [-260, 260]) {
      c.add(
        'Outfeed setup slide - 80 mm adjustment, two M10 clamps',
        subtract(box([160, 60, 12], [625, y - 30, 720]), box([90, 11, 14], [645, y - 5.5, 719])),
        metal,
      );
    }
  return c.pieces;
}
export function explodedModules(pieces: MachinePiece[], state: string) {
  if (state !== 'modules') return pieces;
  return pieces.map((q) => ({
    ...q,
    shape: pose(
      q.shape,
      moduleName(q).startsWith('02')
        ? [-650, 0, 0]
        : moduleName(q).startsWith('03')
          ? [650, 0, 0]
          : moduleName(q).startsWith('04')
            ? [-1000, 0, 0]
            : [0, 0, 0],
    ),
  }));
}
