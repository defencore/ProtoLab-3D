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
import { parallelPanelInterface, parallelTerminalChannel } from './parallel-installation';
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
    panel = parallelPanelInterface(p),
    flangeCutHeight = panel.flangeTop + 2,
    nativeSplit = panel.flangeBottom - m.servoZ,
    cradleHeight = panel.flangeBottom + 19.7;
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
        child: roundedRect(56, 35.6, 3, nativeSplit, 28.7 - nativeSplit),
        translation: [12.5, 0, 0],
        rotation: [0, 0, 0],
      } as Shape,
      ...earAxes.map(([x, y]) => cylinder(6, 27 - nativeSplit, [x, y, nativeSplit])),
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
  const panelHole = subtract(
    cylinder(6.1, flangeCutHeight, [0, 0, -1]),
    box([1, 1.9, flangeCutHeight], [5.2, -0.95, -1]),
  );
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
    // The thicker external TPU changes the flat seating plane; the source nut stays put.
    cylinder(panel.switchNutSeat.radius, 2, [0, 0, panel.switchNutSeat.floorZ]),
    // Continue the servo cavity and screw passages through the mounting flange itself.
    pose(box([46, 25.6, flangeCutHeight], [-10.5, -12.8, -m.servoZ - 1]), m),
    ...earAxes.map(([x, y]) => pose(cylinder(1.7, 24, [x, y, 14.2]), m)),
    ...panel.mountingHoles.map(([x, y]) =>
      cylinder(panel.holeDiameter / 2, flangeCutHeight, [x, y, -1]),
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
            child: roundedRect(56, 35.6, 3, -4.5, cradleHeight),
            translation: [12.5, 0, 0],
            rotation: [0, 0, 0],
          },
          m,
        ),
        roundedRect(38, 26, 3, -19.7, cradleHeight),
        box([36, 9, cradleHeight], [-18, -17, -19.7]),
        ...worldAxes.map(([x, y]) => cylinder(6, cradleHeight, [x, y, -19.7])),
      ),
      pose(box([46, 25.6, 22], [-10.5, -12.8, -5]), m),
      box([28.8, 16.8, panel.flangeBottom + 17.3], [-14.4, -8.4, -17.01]),
      switchFlare,
      // The clocked lamp-ground blade exits right; the window is open to the split face.
      parallelTerminalChannel(),
      ...nutCuts.map((cut) => pose(cut, m)),
      ...worldAxes.map(([x, y]) => cylinder(1.7, 24, [x, y, -21])),
    ),
    pose(union(...[-17.8, 9.5].map((y) => box([8, 8.3, 3], [19, y, -4.5]))), m),
    // Fixed rear-cover shoulders beside the shaft end support the case from below.
    // Keep the central rear disc and the full 18 mm cable approach unobstructed.
    pose(union(...[-17.8, 10].map((y) => box([10, 7.8, 4.5], [-5, y, -4.5]))), m),
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
        // Match the shaft-end stationary shoulders without loading the rotating disc.
        ...[-17.8, 9].map((y) => box([10, 8.8, 3.7], [-5, y, 29])),
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
        'Print the continuous flat underside at Z1.5 on the bed. The upper sleeve and six gussets rise above the 6 mm plate; no gasket recesses, blind locating sockets or lower nut counterbore are present.',
        'The nominal housing cavity is 46 × 25.6 mm. Fit it to the delivered case and printed dimensions; use fitted shims where needed so case torque reacts against broad walls without excessive play.',
        'The lower cradle meets the rigid split face at Z1.5. The flat parts have no locating collars or blind sockets; the through-bolts and fitted case walls locate the assembly.',
        'Nominal 1.5 mm TPU sheets lie against the flat underside, outside the PETG. No gasket compression or material rating is modeled.',
        'The host top remains Z0 beneath the nominal 1.5 mm panel sheet. Four diameter 4.5 mm through-holes and the right terminal-access branch follow the matching enclosure template.',
        'The keyed diameter 12.2 mm opening passes through the carrier. A diameter 18.6 mm top counterseat is 0.7 mm deep, with its floor at Z6.8 and 5.3 mm of solid PETG below. The existing upper ASW nut stays at that floor; omit the removable lower washer and nut. The 1.5 mm TPU case frame occupies Z0-1.5.',
      ],
    ),
    make(
      'parallel-cradle',
      'Printed lower servo and switch cradle',
      cradle,
      'Open-bottom 21.2 mm deep cradle with rounded case pockets and four captured-nut lands',
      0x60758a,
      [
        'Print the common open lower rim flat on the bed. Qualify the small retention-ledger overhangs and nut-slot bridges; the broad upper mounting flange is a separate print.',
        'The servo cavity remains 46 × 25.6 mm. Two rear ledges contact case faces at native Z -1.5 mm; two additional 10 × 7.8 mm shaft-end pads reach the stationary rear-cover shoulders at native Z0. These pads rise directly from the print bed and join the sidewalls. The central rear disc and OEM pilot holes remain clear.',
        'The switch cavity is 28.8 × 16.8 mm around the 28 × 16 mm case. Fit its walls to prevent case rotation without squeezing the body. The lower 2.7 mm mouth flares to 32 × 18.4 mm for terminal access.',
        'The 18.4 mm wide side window opens to the split face across the full switch-pocket width. The authored 14 mm receptacle envelope clears a 10 mm insertion stroke at lateral offsets of -1, 0 and +1 mm. Use the matching 20 mm wide host-panel branch and fit the actual 6.3 mm receptacle and boot.',
        'Insert ordinary M3 AF5.5 × 2.4 mm nuts from the outer sides into AF5.8 pockets at Z -14 to -11.6 mm. Clear the 6.5 × 2.5 mm entry slots before fitting four M3 × 30 mm through ties.',
        'The flat rim ends at Z1.5 and meets the upper flange directly. Keep this rigid split face free of TPU and printing residue; all switch and servo contact faces retain their original positions.',
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
        'The diameter 21 mm output opening gives 0.9 mm radial clearance to the diameter 19.2 mm disc and rocker boss. The lid ends at native Z32.7 mm, 2 mm below the broad rocker underside; only its disc-sized boss extends 1 mm lower inside the opening.',
        'The relieved cover clears the source front projections to Z31.8 mm. Two 8 × 2 mm patches on the wider ribs contact the measured source front faces at Z30.5 mm.',
        'Two additional shaft-end ribs meet the stationary front-cover shoulders at native Z29.0 mm. Each has a 17.60 square mm contact patch and clears the rotating output disc by 0.9 mm, opposing the existing lower cradle pads.',
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
