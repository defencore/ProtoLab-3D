import { Box3, Group, Vector3 } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { detailComponent } from '../../core/component-recipes';
import { componentGeometry, type ConfiguredPiece } from '../../core/assembly/detail-instances';
import { validateParameters } from '../../core/validation';
import { disposeModel } from '../../core/mechanical';
import {
  libraries,
  layout,
  purchasedPieces,
  fastenerPiece,
  hexNutPiece,
  configured,
  type Vec,
} from './lib/components';
import { framePieces, frameFasteners } from './lib/frame';
import { outputPieces, outputFastenerDatums } from './lib/output';
import { retentionPieces } from './lib/retention';
import { columnPieces, columnFasteners } from './lib/columns';
import { alignActuatorThreads } from './lib/mating';
import { configuredDrive } from './lib/drive';
import { actuatorPython } from './lib/native';
import { laserFabricationFiles } from './lib/fabrication';
import { machiningFiles } from './lib/machining';
import { laserPlates } from './lib/laser-plates';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';
import washer from '../washer/part';
export { layout as actuatorLayout } from './lib/components';
export {
  configured as configureActuatorPiece,
  fastenerPiece as actuatorFastenerPiece,
  hexNutPiece as actuatorHexNutPiece,
} from './lib/components';
export { alignActuatorThreads } from './lib/mating';
/** Public geometry factories for assemblies that reuse this validated drive. */
export { libraries as actuatorLibraries } from './lib/components';
export { actuatorPython as actuatorNativeSource } from './lib/native';
export type { ActuatorThreadLayout } from './lib/native';
export { screwShape as tr8ScrewShape, nutShape as tr8NutShape, driveThreadCallout, tr8ThreadForLead, type Tr8Lead } from './lib/drive';

export function actuatorPieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const v = layout(p, state),
    drive = configuredDrive(v.displacement);
  const custom = [
    {
      id: 'lead-screw',
      label: 'TR8×8(P2) screw · 250 mm stock cut and turned to 50 mm',
      shape: drive.screw,
      color: 0x92a7b6,
    },
    {
      id: 'lead-nut',
      label: 'TR8×8(P2) brass H-flange nut · 22×11×15 · four starts',
      shape: drive.nut,
      color: 0xc7a448,
    },
    ...framePieces(v.center),
    ...outputPieces(v.angle),
    ...retentionPieces(),
  ];
  const pieces: ConfiguredPiece[] = [
    ...purchasedPieces(p, state),
    ...columnPieces(),
    ...custom.map((item) => {
      const component = detailComponent(item.id, item.label, item.shape);
      const sheet = laserPlates.find((plate) => plate.id === item.id);
      const isScrew = item.id === 'lead-screw';
      const turned = /shaft|spacer|cap/i.test(item.id) || isScrew;
      if (item.id === 'lead-nut') {
        component.supply = 'purchased';
        component.procurement = {
          designation: 'TR8×8(P2) RH H-flange nut · 22×11×15',
          manufacturer: 'User-supplied nut drawing',
          source: 'User-supplied TR8 H-flange nut drawing (public URL unavailable)',
        };
        delete component.manufacturing;
      } else
        component.manufacturing = {
          material:
            sheet || turned
              ? 'Steel; grade and fit per production drawing'
              : 'Aluminium alloy 6061-T6',
          blank: sheet
            ? `${sheet.thickness} mm flat sheet`
            : isScrew
              ? 'TR8×8(P2) four-start threaded rod, 250 mm purchased stock'
              : 'Stock sized to the detail drawing',
          processes: sheet
            ? ['cutting', 'drilling']
            : turned
              ? ['turning', 'drilling']
              : ['milling', 'drilling'],
          requirements: sheet
            ? [
                'Laser cut the supplied contours; finish bearing pilots to the specified fit; deburr.',
              ]
            : isScrew
              ? [
                  'Cut and face to 50 mm; retain 26 mm of TR8 thread; turn Ø5 journals and Ø4 coupling stub; cut four DIN 471 grooves.',
                  'Verify actual stock root is larger than the finished journal diameter; assign journal fits and groove tolerances before turning.',
                ]
              : ['Dimension and tolerance the configured native solid before machining.'],
        };
      return { component, label: item.label, color: item.color, requireSingleSolid: true };
    }),
    ...frameFasteners(v.center).map(fastenerPiece),
    ...columnFasteners().map(fastenerPiece),
  ];
  const hardware = outputFastenerDatums(v.angle);
  pieces.push(...hardware.bolts.map(fastenerPiece));
  for (const item of hardware.washers)
    pieces.push(
      configured(
        washer,
        item.id,
        item.id,
        { bore: item.bore, outerDiameter: item.outerDiameter, thickness: item.thickness },
        item.center,
        item.rotation,
        'default',
        0xaeb5be,
      ),
    );
  for (const item of hardware.nuts)
    pieces.push(hexNutPiece(item.id, item.diameter, item.center, item.rotation));
  return alignActuatorThreads(pieces);
}
function build(p: Parameters, state: string): Group {
  const result = new Group();
  for (const piece of actuatorPieces(p, state)) {
    const unit = componentGeometry(libraries, [piece]);
    result.add(...[...unit.children]);
  }
  return result;
}
const part: PartDefinition = {
  identityParameters: (p) => ({ ...p, outputAngle: 0 }),
  id: 'tr8-compact-actuator',
  name: 'TR8×8(P2) rotary actuator · GMP16T-TEC1636 · 1 output · Ø56 laser steel · ±20°',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  complexity: 'Compact TR8 drive and laser-cut frame',
  description:
    'Compact fixed drive with a four-start TR8×8(P2) screw cut and turned from 250 mm stock to 50 mm. A brass H-flange nut and closed forks drive the centred Ø6 output shaft through ±20°. Three Ø56 laser discs use standard 30 mm metal columns.',
  keywords: [
    'TR8',
    'TR8x8',
    'T8x8',
    '2P',
    'H flange',
    'four start',
    'compact',
    'rotary actuator',
    'GMP16T',
    'three discs',
    'laser cut',
    '20 degrees',
    '\u0442\u0440\u0430\u043f\u0435\u0446\u0456\u0439\u043d\u0438\u0439',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['motorModel'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Set the output angle to move the complete mechanism.',
    },
    {
      id: 'negative-limit',
      label: '−20° end position',
      description: 'Minimum nut travel and negative output limit.',
    },
    {
      id: 'positive-limit',
      label: '+20° end position',
      description: 'Maximum nut travel and positive output limit.',
    },
  ],
  validate(p, state) {
    if (!['361-12', '107-12', '361-24', '107-24'].includes(String(p.motorModel)))
      return ['Choose a supported gearmotor.'];
    if (!Number.isFinite(Number(p.outputAngle)) || Math.abs(Number(p.outputAngle)) > 20)
      return ['Output angle must remain within ±20°.'];
    return actuatorPieces(p, state).flatMap((piece) =>
      validateParameters(
        libraries.find((item) => item.id === piece.component.libraryId)!,
        piece.component.parameters,
        piece.component.state,
      ).map((error) => piece.label + ': ' + error),
    );
  },
  composition(p) {
    return {
      components: actuatorPieces({ ...p, outputAngle: 0 }).map((piece) => piece.component),
      issues: [
        'Verify actual purchased nut and screw stock dimensions before machining.',
        'Specify load, bearing fits, lubrication, travel stops and motor control for the application.',
      ],
    };
  },
  buildGeometry: build,
  dimensions(p, state) {
    const model = build(p, state);
    try {
      return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
    } finally {
      disposeModel(model);
    }
  },
  python: (p, state) => actuatorPython(actuatorPieces(p, state), layout(p, state).displacement),
  notes:
    'Separate compact version; previous SFK assemblies remain unchanged. TR8×8(P2) has four starts, 2 mm axial pitch and 8 mm lead. The 50 mm turned screw retains a 26 mm threaded section with clean Ø5 bearing journals, four retaining-ring grooves and a Ø4 coupling stub. It is made from the specified 250 mm threaded stock. Nut dimensions follow the supplied 22×11×15 H-flange drawing. Axis spacing is 10 mm; nut travel is 10*tan(output angle), giving 7.2794 mm total stroke. Output shaft remains Ø6 with a short capped end and a projecting D-flat end. Main discs are Ø56×3; output cheeks use 4 mm steel. Laser files separate 3 and 4 mm stock. Four bearing pilots require finishing to the assigned production fit. Full mode models actual four-start trapezoidal flanks; no mesh conversion is used in FreeCAD.',
  sources: [
    { label: 'Supplied TR8 H-flange nut drawing', url: '' },
    { label: 'Supplied H-flange brass nut photo', url: '' },
    { label: 'Supplied 250 mm TR8 threaded stock', url: '' },
    { label: 'Multi-start thread lead and pitch', url: 'https://blog.igus.eu/multi-start-thread/' },
  ],
  fabricationFiles(p) {
    const quote = (v: unknown) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
    const rows = [
      ['ID', 'Component', 'Quantity', 'Library', 'Supply', 'Designation', 'Material'],
      ...actuatorPieces({ ...p, outputAngle: 0 }).map(({ component: c }) => [
        c.id,
        c.name,
        c.quantity,
        c.libraryId,
        c.supply,
        c.procurement?.designation,
        c.manufacturing?.material,
      ]),
    ];
    const motion = [-20, -10, 0, 10, 20]
      .map((outputAngle) => {
        const v = layout({ ...p, outputAngle });
        return [outputAngle, v.displacement, v.turns, v.rotation, v.pinRadius].join(',');
      })
      .join('\n');
    return [
      ...laserFabricationFiles(p),
      ...machiningFiles(),
      {
        id: 'bill-of-materials',
        label: 'Component list',
        description: 'Every bought and manufactured physical occurrence.',
        name: 'TR8-compact-component-list.csv',
        type: 'text/csv;charset=utf-8',
        content: rows.map((r) => r.map(quote).join(',')).join('\n') + '\n',
      },
      {
        id: 'motion-table',
        label: 'Motion table',
        description: 'Output angle, nut travel and screw rotation for 8 mm lead.',
        name: 'TR8-compact-motion.csv',
        type: 'text/csv;charset=utf-8',
        content:
          'OutputAngle_deg,NutTravel_mm,ScrewTurns,ScrewRotation_deg,PinRadius_mm\n' +
          motion +
          '\n',
      },
    ];
  },
};
export default part;
