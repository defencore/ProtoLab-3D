import type { Parameters, PartDefinition } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { defaultTubeProfile, resolveTubeProfile } from './tube-interface';

/** This core is qualified for the explicitly registered D90/D86 interface. */
const qualifiedTube = resolveTubeProfile({ tubeProfile: defaultTubeProfile });

/** X points aft; Z points toward the Grandado lid; lengths are millimetres. */
export const datums = {
  radius: qualifiedTube.insertRadius,
  discThickness: 10,
  nose: { root: -100, tip: -255, aft: -70 },
  flight: { front: -70, back: 70 },
  spool: { front: 70, back: 120 },
  power: { front: 120, back: 250 },
  tail: { front: 250, back: 262 },
  keys: [
    [-26, 18],
    [26, 18],
    [0, -22],
  ] as [number, number][],
  channelY: [-37.3, 37.3],
  channelZ: -10,
  cableDiameter: 6,
  channelDiameter: 7,
  channelLeadIn: 0.6,
  anchorOffsetX: 5.75,
  keySize: 6,
  keyDepth: 4,
} as const;

/** Qualified workpiece dimensions shared by the installation and marking tools. */
export const tubeReferenceDatums = {
  outerDiameter: qualifiedTube.outerDiameter,
  innerDiameter: qualifiedTube.innerDiameter,
  frontX: datums.nose.root,
  backX: datums.tail.back,
} as const;

/** Matched projected cut and cover key; corners retain a real machining radius. */
export const accessWindowDatums = {
  x: -41.8,
  length: 83.6,
  y: -29.3,
  width: 58.6,
  cornerRadius: 2.5,
} as const;
export const at = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
export const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });

export interface PrintedItem {
  id: string;
  name: string;
  shape: Shape;
  /** Neutral manufacturing form in the same local frame as the installed body. */
  printShape?: Shape;
  material: 'PETG' | 'TPU';
  module: 'flight' | 'spool' | 'power' | 'nose' | 'tail' | 'template';
  /** Rotation applied to installed geometry before laying the part on the bed. */
  printRotation?: Vec;
  previewBackend?: 'jscad' | 'manifold';
}

export function printed(
  item: PrintedItem,
  shape = item.shape,
  manufacturingForm = false,
): ConfiguredPiece {
  const options = {
    nativeRefine: true,
    meshBackend: item.previewBackend ?? 'manifold',
    preserveAuthoredFrame: item.printShape ? true : undefined,
  } as const;
  const component = detailComponent(item.id, item.name, shape, options);
  if (item.printShape) {
    const installed = detailComponent(item.id, item.name, item.shape, options);
    const neutral = detailComponent(item.id, item.name, item.printShape, options);
    if (JSON.stringify(installed.placement) !== JSON.stringify(neutral.placement))
      throw new Error(`${item.id} manufacturing and installed forms need the same local frame.`);
    component.parameters.manufacturingRecipe = neutral.parameters.recipe;
    if (manufacturingForm) component.state = 'manufacturing';
  }
  component.manufacturing = {
    material: item.material,
    blank: 'FDM print',
    processes: ['printing'],
    requirements: [
      'Check the supplied fit coupon and actual components before printing the complete set.',
      'Printed fit and geometric capture do not establish vibration, impact or recovery load qualification.',
      ...(item.material === 'TPU'
        ? [
            'Use the user-selected TPU 95A. Qualify the actual grade, fit, insertion force, creep and damping on a prototype.',
          ]
        : []),
      ...(['grandado-through-cover', 'flight-lower-cover'].includes(item.id)
        ? [
            'Print on the long side in the exported orientation with the supplied cover profile. Keep short tie tunnels free of supports; remove accessible supports from the open interior and through head bores, then gauge every passage before assembly.',
          ]
        : []),
      ...(item.material === 'PETG' &&
      (item.module === 'power' ||
        [
          'flight-frame',
          'flight-board-carrier',
          'nose-base-frame',
          'nose-camera-keeper',
          'nose-pi-carrier',
          'square-key-fit-coupon',
          'grandado-through-cover',
          'flight-lower-cover',
        ].includes(item.id))
        ? [
            'Use the dedicated dense structural PETG profile: 0.20 mm layers, eight walls, 100% rectilinear infill, eight top and bottom layers. Qualify actual filament, bonding and support removal.',
            ...(item.id === 'square-key-fit-coupon'
              ? [
                  'Print the flat base on the bed. Check side insertion, anti-rotation and access from both threaded ends with the actual M3×10 coupling before printing the full frame.',
                ]
              : item.id.endsWith('-disc')
                ? [
                    'Print the end disc flat in its exported orientation. Broad recessed bearing seats, rather than axial fingers, transfer carrier loads.',
                  ]
                : [
                    'Keep the longitudinal X axis in the build-plate/layer plane in the exported orientation; do not stand the part on an axial end to reduce supports.',
                  ]),
          ]
        : []),
    ],
  };
  component.notes = `Modular tube avionics / ${item.module} / ${item.id}`;
  return {
    component,
    label: item.name,
    color: item.material === 'TPU' ? 0xe45dc0 : item.module === 'template' ? 0xdcb355 : 0xd7dce0,
    requireSingleSolid: true,
  };
}

export function purchased(
  part: PartDefinition,
  id: string,
  presetId: string,
  translation: Vec,
  rotation: Vec = [0, 0, 0],
  state = 'assembled',
): ConfiguredPiece {
  const preset = part.presets.find((candidate) => candidate.id === presetId);
  if (!preset) throw new Error(`Missing library product ${part.id}:${presetId}`);
  return {
    component: {
      id,
      name: preset.name,
      libraryId: part.id,
      presetId,
      parameters: { ...part.defaults, ...preset.parameters },
      state,
      quantity: 1,
      supply: preset.product?.supply ?? part.product.supply,
      placement: { translation, rotation },
    },
    label: preset.name,
    color: 0x457b68,
    preserveLibraryAppearance: true,
  };
}

/** Two outward-open grooves accept the harnesses before the tube is fitted. */
export function cableCuts(x: number, length: number): Shape[] {
  const r = datums.channelDiameter / 2,
    lead = datums.channelLeadIn;
  return datums.channelY.flatMap((y) => [
    cylinder(r, length + 2, [x - 1, y, datums.channelZ], 'x'),
    box([length + 2, 15, datums.channelDiameter], [x - 1, y > 0 ? y : y - 15, datums.channelZ - r]),
    ...[false, true].flatMap((aft) => {
      const endX = aft ? x + length : x,
        innerX = endX + (aft ? -lead : lead),
        endRadius = r + lead;
      const cone: Shape = {
        kind: 'revolve',
        profile: aft
          ? [
              [0, -lead],
              [r, -lead],
              [endRadius, 0.01],
              [0, 0.01],
            ]
          : [
              [0, -0.01],
              [endRadius, -0.01],
              [r, lead],
              [0, lead],
            ],
      };
      return [
        at(cone, [endX, y, datums.channelZ], [0, 90, 0]),
        prism(
          [
            [endX, datums.channelZ - endRadius],
            [innerX, datums.channelZ - r],
            [innerX, datums.channelZ + r],
            [endX, datums.channelZ + endRadius],
          ],
          15,
          y > 0 ? y : y - 15,
          'y',
        ),
      ];
    }),
  ]);
}

/** Native gauge reserves each user-specified bundle; it is not a purchased cable. */
export function cableGauges(x = datums.flight.front, length = datums.tail.back - x): Shape[] {
  return datums.channelY.map((y) =>
    cylinder(datums.cableDiameter / 2, length, [x, y, datums.channelZ], 'x'),
  );
}

/** The forward face accepts the preceding module; the aft face keys the next. */
export function discShape(
  x: number,
  p: Parameters,
  male = true,
  cableTools: Shape[] = cableCuts(x, datums.discThickness),
): Shape {
  const fit = Number(p.keyClearance);
  const stock = cylinder(datums.radius, datums.discThickness, [x, 0, 0], 'x');
  const pins = male ? datums.keys.map(([y, z]) => box([4.2, 6, 6], [x + 9.8, y - 3, z - 3])) : [];
  const sockets = datums.keys.map(([y, z]) =>
    box([4.4, 6 + fit, 6 + fit], [x - 0.1, y - 3 - fit / 2, z - 3 - fit / 2]),
  );
  // Nut pockets are open from the module interior for installation before closure.
  const anchorX = x + datums.anchorOffsetX;
  const anchors = [-1, 1].flatMap((sign) => [
    cylinder(1.7, 18, [anchorX, sign > 0 ? 28 : -46, 0], 'y'),
    // Mirror the actual 15-degree nut clocking. The open aft half admits the
    // nut; the closed fore flanks resist rotation once the exit is capped.
    prism(
      Array.from({ length: 6 }, (_, i): [number, number] => {
        const angle = (sign * 15 * Math.PI) / 180 + (i * Math.PI) / 3;
        return [
          anchorX + (5.8 / Math.sqrt(3)) * Math.cos(angle),
          (5.8 / Math.sqrt(3)) * Math.sin(angle),
        ];
      }),
      2.8,
      sign > 0 ? 34 : -36.8,
      'y',
    ),
    // Start before the axis so a clocked hex corner cannot snag the mouth
    // during straight axial loading; the closed fore flanks remain intact.
    box([5.4, 2.8, 6.5], [anchorX - 0.4, sign > 0 ? 34 : -36.8, -3.25]),
  ]);
  return subtract(union(stock, ...pins), ...sockets, ...cableTools, ...anchors);
}

export function endDiscs(
  module: PrintedItem['module'],
  front: number,
  back: number,
  p: Parameters,
): PrintedItem[] {
  return [front, back - 10].map((x, i) => ({
    id: `${module}-${i ? 'aft' : 'forward'}-disc`,
    name: `${module} ${i ? 'aft' : 'forward'} keyed end disc`,
    shape: discShape(x, p),
    material: 'PETG',
    module,
    printRotation: [0, -90, 0],
  }));
}
