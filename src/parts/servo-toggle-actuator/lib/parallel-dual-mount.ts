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
import {
  parallelPanelInterface,
  parallelTerminalChannel,
  roundedPlate,
} from './parallel-installation';
import { parallelLegendCutters } from './parallel-legends';
import type { DetailSpec } from './types';

/** Extend the split pocket without changing the driven switch, servo or retaining lid. */
export function dualParallelMountDetails(p: Parameters, details: DetailSpec[]): DetailSpec[] {
  const panel = parallelPanelInterface(p),
    manual = panel.manualSwitch!,
    rearY = manual.centre[1],
    rearAxes = manual.tieAxes,
    cradleHeight = panel.flangeBottom + 19.7,
    seat = manual.guardSeat;
  const hole = subtract(
    cylinder(6.1, 10, [0, rearY, -1]),
    box([1, 1.9, 10], [5.2, rearY - 0.95, -1]),
  );
  const rearBaseCuts = [
    hole,
    cylinder(panel.switchNutSeat.radius, 4, [0, rearY, panel.switchNutSeat.floorZ]),
    ...parallelLegendCutters(panel.flangeTop),
    ...rearAxes.flatMap(([x, y]) => [cylinder(1.7, 12, [x, y, -1]), cylinder(3.1, 8, [x, y, 3])]),
  ];
  const guardSaddle = subtract(
    roundedPlate(...seat.outerSize, 0.8, seat.centre, panel.flangeTop, seat.rimZ - panel.flangeTop),
    roundedPlate(...seat.pocketSize, 0.2, seat.centre, seat.floorZ, 1),
    // Separate broad end lands avoid fragile strips beside the existing nut and washer.
    box([19.4, 22, 3], [-9.7, rearY - 11, 7.4]),
  );
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
    roundedPlate(38, 26, 3, [0, rearY], -19.7, cradleHeight),
    box([36, 11, cradleHeight], [-18, -78, -19.7]),
    ...rearAxes.map(([x, y]) => cylinder(5.5, cradleHeight, [x, y, -19.7])),
  );
  return details.map((detail) => {
    if (detail.id === 'parallel-base')
      return {
        ...detail,
        shape: subtract(union(detail.shape, guardSaddle), ...rearBaseCuts),
        requirements: [
          ...detail.requirements!,
          'The manual switch case stays at Z0 above its separate 1.5 mm TPU frame. The flat carrier spans Z1.5-7.5; its top nut counterseat ends at Z6.8. Two supported upper end lands seat the SAC-01 steel base at Z9.5, with a 0.2 mm deep outline register and a rim at Z9.7. The central nut and washer remain accessible between the lands; the flange underside stays flat.',
          'Two staggered rear M3 ties have heads seated at Z3 in counterbores open through the top. The right tie is at Y -76 mm, retaining 3.1 mm of PETG between its bore and the widened terminal channel. Flat rigid shoulders meet the lower cradle at Z1.5 without locating collars.',
        ],
      };
    if (detail.id === 'parallel-cradle')
      return {
        ...detail,
        shape: subtract(
          union(detail.shape, rearPocket),
          box([28.8, 16.8, panel.flangeBottom + 17.3], [-14.4, rearY - 8.4, -17.01]),
          flare,
          parallelTerminalChannel(rearY),
          ...rearNutCuts,
        ),
        requirements: [
          ...detail.requirements!,
          'A second 28.8 × 16.8 mm antirotation pocket surrounds the manual switch at Y -90 mm. It has the same open bottom, flared terminal mouth and 18.4 mm wide ground-terminal channel. Match the moved right through-tie in both the upper flange and lower cradle.',
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
