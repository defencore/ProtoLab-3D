import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { screw, hexNut } from './hardware';
import { parallelPanelInterface, roundedPlate } from './parallel-installation';
import { parallelManualSwitchGasketPocket } from './parallel-gaskets';
import { parallelLegendCutters } from './parallel-legends';
import type { DetailSpec } from './types';

/** Extend the split pocket without changing the driven switch, servo or retaining lid. */
export function dualParallelMountDetails(p: Parameters, details: DetailSpec[]): DetailSpec[] {
  const manual = parallelPanelInterface(p).manualSwitch!,
    rearY = manual.centre[1],
    rearAxes = manual.tieAxes;
  const hole = subtract(
    cylinder(6.1, 10, [0, rearY, -1]),
    box([1, 1.9, 10], [-6.2, rearY - 0.95, -1]),
  );
  const rearBaseCuts = [
    hole,
    parallelManualSwitchGasketPocket(),
    ...parallelLegendCutters(),
    ...rearAxes.flatMap(([x, y]) => [
      cylinder(1.7, 10, [x, y, -1]),
      cylinder(3.1, 3.2, [x, y, 3]),
      cylinder(4.2, 1.3, [x, y, -0.1]),
    ]),
  ];
  const flare: Shape = {
    kind: 'loft',
    rings: [
      [
        [-16, rearY - 9.2, -19.8],
        [16, rearY - 9.2, -19.8],
        [16, rearY + 9.2, -19.8],
        [-16, rearY + 9.2, -19.8],
      ],
      [
        [-14.4, rearY - 8.4, -17],
        [14.4, rearY - 8.4, -17],
        [14.4, rearY + 8.4, -17],
        [-14.4, rearY + 8.4, -17],
      ],
    ],
  };
  const rearNutCuts = rearAxes.flatMap(([x, y]) => {
    const radius = 5.8 / Math.sqrt(3);
    return [
      {
        kind: 'transform',
        child: prism(
          Array.from({ length: 6 }, (_, i): [number, number] => [
            radius * Math.cos(((i + 0.5) * Math.PI) / 3),
            radius * Math.sin(((i + 0.5) * Math.PI) / 3),
          ]),
          2.5,
          -14.1,
        ),
        translation: [x, y, 0],
        rotation: [0, 0, 0],
      } as Shape,
      box([10, 6.5, 2.5], [x > 0 ? x : x - 10, y - 3.25, -14.1]),
      cylinder(1.7, 24, [x, y, -21]),
    ];
  });
  const rearPocket = union(
    roundedPlate(38, 26, 3, [0, rearY], -19.7, 19.7),
    box([36, 11, 19.7], [-18, -78, -19.7]),
    ...rearAxes.flatMap(([x, y]) => [
      cylinder(5.5, 19.7, [x, y, -19.7]),
      cylinder(4, 1.1, [x, y, -0.1]),
    ]),
  );
  return details.map((detail) => {
    if (detail.id === 'parallel-base')
      return {
        ...detail,
        shape: subtract(
          union(detail.shape, cylinder(12, manual.webTop - 5.9, [0, rearY, 5.9])),
          ...rearBaseCuts,
        ),
        requirements: [
          ...detail.requirements!,
          'The rear manual switch remains at case datum Z0. Its keyed carrier reaches Z6.8 to meet the source lower guard nut; the flush 0.8 mm TPU case-seat gasket fills the underside recess. The source guard adjustment is illustrative and must be set on the delivered assembly.',
          'Two staggered rear M3 ties have recessed heads at Z3-6, clear of the guarded toggle. Their locators seat in the lower cradle; the left tie is offset behind the horizontal ground-terminal approach.',
        ],
      };
    if (detail.id === 'parallel-cradle')
      return {
        ...detail,
        shape: subtract(
          union(detail.shape, rearPocket),
          box([28.8, 16.8, 18.1], [-14.4, rearY - 8.4, -17.01]),
          flare,
          box([12, 10, 6.1], [-25, rearY - 5, -6]),
          ...rearNutCuts,
        ),
        requirements: [
          ...detail.requirements!,
          'A second 28.8 × 16.8 mm antirotation pocket surrounds the manual switch at Y -90 mm. The same open bottom, flared terminal mouth and left ground-terminal channel remain accessible.',
          'Two M3 × 20 mm ties seat at Z3 and end at Z -17, engaging AF5.5 × 2.4 mm nuts at Z -14 to -11.6. Insert the captured nuts from the outer X sides before joining the split carrier.',
        ],
      };
    return detail;
  });
}

export function dualParallelMountHardware(p: Parameters): ConfiguredPiece[] {
  return parallelPanelInterface(p).manualSwitch!.tieAxes.flatMap(([x, y], i) => {
    const nut = hexNut(`manual-clamp-nut-${i + 1}`, 3, 5.5, 2.4, [x, y, -14]);
    nut.component.parameters = { ...nut.component.parameters, pitch: 0.5 };
    return [screw(`manual-clamp-screw-${i + 1}`, 3, 20, [x, y, 3]), nut];
  });
}
