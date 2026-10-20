import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  prism,
  roundedRect,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { screw, hexNut } from './hardware';
import { parallelPanelInterface } from './parallel-installation';
import { dualParallelMountDetails, dualParallelMountHardware } from './parallel-dual-mount';
import type { DetailSpec } from './types';

export interface ParallelMountLayout {
  servoZ: number;
  servoY: number;
  switchZ: number;
}

const earAxes: [number, number][] = [-10, 35].flatMap((x) =>
  [-20, 20].map((y): [number, number] => [x, y]),
);
const pose = (shape: Shape, m: ParallelMountLayout): Shape => ({
  kind: 'transform',
  child: shape,
  translation: [0, m.servoY, m.servoZ],
  rotation: [0, 0, -90],
});

/** Fitted rectangular walls react case torque; the measured end faces retain its height. */
export function parallelMountDetails(p: Parameters, m: ParallelMountLayout): DetailSpec[] {
  const length = Number(p.baseLength),
    width = Number(p.baseWidth),
    panel = parallelPanelInterface(p);
  const worldAxes = earAxes.map(([x, y]): [number, number] => [y, m.servoY - x]);
  const nutCuts = earAxes.flatMap(([x, y]) => {
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
          -14.1 - m.servoZ,
        ),
        translation: [x, y, 0],
        rotation: [0, 0, 0],
      } as Shape,
      box([6.5, 10, 2.5], [x - 3.25, y > 0 ? y : y - 10, -14.1 - m.servoZ]),
    ];
  });
  const upperSleeve = subtract(
    union(
      {
        kind: 'transform',
        child: roundedRect(56, 35.6, 3, 16, 12.7),
        translation: [12.5, 0, 0],
        rotation: [0, 0, 0],
      } as Shape,
      ...earAxes.map(([x, y]) => cylinder(6, 11, [x, y, 16])),
      ...[-2, 13, 28].flatMap((x) =>
        [-1, 1].map((side): Shape => ({
          kind: 'transform',
          child: prism(
            [
              [side * 17.3, 21.1],
              [side * 29, 21.1],
              [side * 17.3, 28.6],
            ],
            4,
            x - 2,
          ),
          translation: [0, 0, 0],
          rotation: [90, 0, 90],
        })),
      ),
    ),
    box([46, 25.6, 22], [-10.5, -12.8, 15.1]),
    // Relieve the nearby wall where the lid's lower locating bosses nest into the rim.
    ...earAxes.map(([x, y]) => cylinder(5.2, 5, [x, y, 27])),
  );
  const panelHole = subtract(cylinder(6.1, 8, [0, 0, -1]), box([1, 1.9, 8], [5.2, -0.95, -1]));
  const base = subtract(
    union(
      {
        kind: 'transform',
        child: roundedRect(length, width, 4, panel.flangeBottom, panel.flangeThickness),
        translation: [0, panel.flangeCentre[1], 0],
        rotation: [0, 0, 0],
      },
      pose(upperSleeve, m),
    ),
    panelHole,
    // Continue the servo cavity and screw passages through the mounting flange itself.
    pose(box([46, 25.6, 8], [-10.5, -12.8, -m.servoZ - 1]), m),
    ...earAxes.map(([x, y]) => pose(cylinder(1.7, 24, [x, y, 14.2]), m)),
    ...panel.mountingHoles.map(([x, y]) =>
      cylinder(panel.holeDiameter / 2, panel.flangeThickness + 2, [x, y, -1]),
    ),
  );
  const switchFlare: Shape = {
    kind: 'loft',
    rings: [
      [
        [-16, -9.2, -19.8],
        [16, -9.2, -19.8],
        [16, 9.2, -19.8],
        [-16, 9.2, -19.8],
      ],
      [
        [-14.4, -8.4, -17],
        [14.4, -8.4, -17],
        [14.4, 8.4, -17],
        [-14.4, 8.4, -17],
      ],
    ],
  };
  const cradle = union(
    subtract(
      union(
        pose(
          {
            kind: 'transform',
            child: roundedRect(56, 35.6, 3, -4.5, 20.5),
            translation: [12.5, 0, 0],
            rotation: [0, 0, 0],
          },
          m,
        ),
        roundedRect(38, 26, 3, -19.7, 20.5),
        box([36, 9, 20.5], [-18, -17, -19.7]),
        ...worldAxes.map(([x, y]) => cylinder(6, 20.5, [x, y, -19.7])),
      ),
      pose(box([46, 25.6, 22], [-10.5, -12.8, -5]), m),
      box([28.8, 16.8, 18.1], [-14.4, -8.4, -17.01]),
      switchFlare,
      // The clocked lamp-ground blade exits right; the window is open to the split face.
      box([12, 10, 6.9], [13, -5, -6]),
      ...nutCuts.map((cut) => pose(cut, m)),
      ...worldAxes.map(([x, y]) => cylinder(1.7, 24, [x, y, -21])),
    ),
    pose(union(...[-17.8, 9.5].map((y) => box([8, 8.3, 3], [19, y, -4.5]))), m),
  );
  const lid = pose(
    subtract(
      union(
        subtract(
          union(
            {
              kind: 'transform',
              child: roundedRect(56, 35.6, 3, 28.7, 4),
              translation: [12.5, 0, 0],
              rotation: [0, 0, 0],
            },
            ...earAxes.map(([x, y]) => cylinder(5, 5.7, [x, y, 27])),
          ),
          // Retain a thin clearance roof above the tallest source-cover projections.
          box([46, 25.6, 5.8], [-10.5, -12.8, 26]),
        ),
        ...[-17.8, 9].map((y) => box([8, 8.8, 2.2], [19, y, 30.5])),
      ),
      cylinder(10.5, 9, [0, 0, 25]),
      ...earAxes.flatMap(([x, y]) => [
        cylinder(1.7, 9, [x, y, 25]),
        cylinder(3.1, 3.4, [x, y, 29.5]),
      ]),
    ),
    m,
  );
  const make = (
    id: string,
    label: string,
    shape: Shape,
    blank: string,
    color: number,
    requirements: string[],
  ): DetailSpec => ({
    id,
    label,
    shape,
    color,
    material: 'PETG; qualify the printed prototype',
    blank,
    processes: ['printing', 'drilling'],
    requirements,
  });
  const details = [
    make(
      'parallel-base',
      'Printed upper mounting flange with servo sleeve',
      base,
      `${length} × ${width} × 6 mm flange; integral 5 mm housing walls and upper gussets`,
      0x526477,
      [
        'Print the continuous flat underside at Z0.8 on the bed. The upper sleeve and six gussets rise above the 6 mm plate; no gasket recesses, blind locating sockets or lower nut counterbore are present.',
        'The nominal housing cavity is 46 × 25.6 mm. Fit it to the delivered case and printed dimensions; use fitted shims where needed so case torque reacts against broad walls without excessive play.',
        'The lower cradle meets the rigid split face at Z0.8. The flat parts have no locating collars or blind sockets; the through-bolts and fitted case walls locate the assembly.',
        'Nominal 0.8 mm TPU sheets lie against the flat underside, outside the PETG. No gasket compression or material rating is modeled.',
        'The host top remains Z0 beneath the nominal 0.8 mm panel sheet. Four diameter 4.5 mm through-holes and the right terminal-access branch follow the matching enclosure template.',
        'The keyed diameter 12.2 mm opening passes through the full 6 mm carrier. Omit the removable lower ASW washer and nut, and set its upper retaining nut against Z6.8; the case-seat TPU occupies Z0-0.8.',
      ],
    ),
    make(
      'parallel-cradle',
      'Printed lower servo and switch cradle',
      cradle,
      'Open-bottom 20.5 mm deep cradle with rounded case pockets and four captured-nut lands',
      0x60758a,
      [
        'Print the common open lower rim flat on the bed. Qualify the small retention-ledger overhangs and nut-slot bridges; the broad upper mounting flange is a separate print.',
        'The servo cavity remains 46 × 25.6 mm. Two side-connected retention ledges meet measured rear case faces at native Z -1.5 mm; the OEM pilot holes remain unused.',
        'The switch cavity is 28.8 × 16.8 mm around the 28 × 16 mm case. Fit its walls to prevent case rotation without squeezing the body. The lower 2.7 mm mouth flares to 32 × 18.4 mm for terminal access.',
        'The right window is open to the split face for the clocked switch ground blade. Verify the selected 6.3 mm receptacles and boots through the host-panel branch and open underside.',
        'Insert ordinary M3 AF5.5 × 2.4 mm nuts from the outer sides into AF5.8 pockets at Z -14 to -11.6 mm. Clear the 6.5 × 2.5 mm entry slots before fitting four M3 × 30 mm through ties.',
        'The flat rim ends at Z0.8 and meets the upper flange directly. Keep this rigid split face free of TPU and printing residue; all switch and servo contact faces retain their original positions.',
        'The authored 45 × 18 mm straight underside approach stops 0.1 mm before the supplier rear-cover envelope. It is a mounting-clearance study; actual connector ports, plug insertion and cable bends remain to be checked on the delivered servo.',
      ],
    ),
    make(
      'parallel-clamp',
      'Printed servo housing lid with recessed fasteners',
      lid,
      '56 × 35.6 × 4 mm cover ring, fitted inner relief, four bolt ears and integral contact ribs',
      0x73889c,
      [
        'Print the broad upper face on the bed, with the contact ribs upward. Clear supports from the recessed bolt pockets and confirm free screw access.',
        'The diameter 21 mm output opening clears the supplier diameter 19.2 mm disc. The lid ends at native Z32.7 mm, 1 mm below the rotor underside, including its recessed M3 heads.',
        'The relieved cover clears the source front projections to Z31.8 mm. Two 8 × 2 mm patches on the wider ribs contact the measured source front faces at Z30.5 mm.',
        'Four M3 × 30 mm socket screws seat at native Z29.5 mm in diameter 6.2 mm counterbores and clamp the lid, upper flange and lower cradle through one stack. Fit the 32 mm source contact-face spacing before tightening; do not distort the servo case.',
        'The fitted housing is a prototype mounting interface. Confirm free output motion, case retention and connected-cable access on the delivered servo; no force or service-life rating is assigned.',
      ],
    ),
  ];
  return p.mechanism === 'parallel-dual' ? dualParallelMountDetails(p, details) : details;
}

export function parallelMountHardware(p: Parameters, m: ParallelMountLayout): ConfiguredPiece[] {
  const installed = (piece: ConfiguredPiece): ConfiguredPiece => {
    const [x, y, z] = piece.component.placement!.translation;
    piece.component.placement = {
      translation: [y, m.servoY - x, m.servoZ + z] as Vec,
      rotation: [0, 0, -90],
    };
    return piece;
  };
  const hardware = earAxes.flatMap(([x, y]) => {
    const capturedNut = hexNut(`parallel-clamp-nut-${x}-${y}`, 3, 5.5, 2.4, [x, y, -14 - m.servoZ]);
    capturedNut.component.parameters = { ...capturedNut.component.parameters, pitch: 0.5 };
    return [
      installed(screw(`parallel-clamp-screw-${x}-${y}`, 3, 30, [x, y, 29.5])),
      installed(capturedNut),
    ];
  });
  return p.mechanism === 'parallel-dual'
    ? [...hardware, ...dualParallelMountHardware(p)]
    : hardware;
}
