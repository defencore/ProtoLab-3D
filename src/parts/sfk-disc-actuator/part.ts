import { Box3, Group, Vector3 } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { detailComponent } from '../../core/component-recipes';
import { componentGeometry, type ConfiguredPiece } from '../../core/assembly/detail-instances';
import { validateParameters } from '../../core/validation';
import {
  libraries,
  layout,
  purchasedPieces,
  fastenerPiece,
  hexNutPiece,
  configured,
  nominalJournalNut,
  type Vec,
} from './lib/components';
import { withGeometryMode } from '../../core/geometry-mode';
import { disposeModel } from '../../core/mechanical';
import { framePieces, frameFasteners } from './lib/frame';
import { outputPieces, outputFastenerDatums } from './lib/output';
import { retentionPieces } from './lib/retention';
import { alignActuatorThreads } from './lib/mating';
import { actuatorPython } from './lib/native';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';
import washer from '../washer/part';
import { columnPieces, columnFasteners } from './lib/columns';
import { laserFabricationFiles } from './lib/fabrication';
import { laserPlates } from './lib/laser-plates';

export { layout as actuatorLayout } from './lib/components';

export function actuatorPieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const v = layout(p, state);
  const custom = [...framePieces(v.center), ...outputPieces(v.angle), ...retentionPieces()];
  const pieces: ConfiguredPiece[] = [
    ...purchasedPieces(p, state),
    ...columnPieces(),
    ...custom.map((item) => {
      const component = detailComponent(item.id, item.label, item.shape);
      const sheet = laserPlates.some((plate) => plate.id === item.id);
      const bronze = /bronze|bush|roller/i.test(item.label);
      const shaft = /shaft|spacer|pin|stud|ring|washer|rod/i.test(item.label);
      component.manufacturing = {
        material: sheet
          ? 'Steel sheet, grade selected for the application'
          : bronze
            ? 'Bearing bronze'
            : shaft
              ? 'Steel, grade to suit the specified load'
              : 'Aluminium alloy 6061-T6',
        blank: sheet ? '4 mm flat sheet' : 'Stock sized to the component drawing',
        processes: sheet
          ? ['cutting', 'drilling']
          : bronze || shaft
            ? ['turning', 'drilling']
            : ['milling', 'drilling'],
        requirements: sheet
          ? [
              'Laser-cut the supplied flat blank; all sheet features are through cuts.',
              'Finish four bearing pilot bores from 12.8 mm to the specified bearing fit; CAD shows a 13.02 mm clearance envelope.',
              'Deburr and verify flatness and actual 4 mm sheet thickness.',
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
  const group = new Group();
  for (const piece of actuatorPieces(p, state)) {
    const instance = nominalJournalNut(piece)
      ? withGeometryMode('simple', () => componentGeometry(libraries, [piece]))
      : componentGeometry(libraries, [piece]);
    group.add(...[...instance.children]);
  }
  return group;
}

const part: PartDefinition = {
  identityParameters: (p) => ({ ...p, outputAngle: 0 }),
  id: 'sfk-disc-actuator',
  name: 'SFK0825 ball screw rotary actuator · GMP16T-TEC1636 · 1 output · Ø68 laser steel · ±20°',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  complexity: 'Three laser-cut discs and metal standoffs',
  description:
    'Three 4 mm steel discs and standard metal standoffs support a fixed SFK0825 drive, offset 13 mm toward the upper rim. Symmetric laser-cut cheeks centre the perpendicular output shaft between the bearing discs; the closed forks provide ±20° motion.',
  keywords: [
    'SFK0825',
    '0825',
    'SFK08025',
    'GMP16T',
    'TEC1636',
    'rotary actuator',
    '20 degrees',
    'closed slotted fork',
    'laser cut',
    'three discs',
    'standoff',
    'ball screw',
    'mechanism',
    '\u043c\u0435\u0445\u0430\u043d\u0456\u0437\u043c',
    '\u0428\u0412\u041f',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Set the output angle to move the complete mechanism.',
    },
    {
      id: 'negative-limit',
      label: '−20° end position',
      description:
        'Nut cover and closed slotted forks at the negative limit; the drive stays fixed.',
    },
    {
      id: 'positive-limit',
      label: '+20° end position',
      description:
        'Nut cover and closed slotted forks at the positive limit; the drive stays fixed.',
    },
  ],
  presetMatchKeys: ['motorModel'],
  validate(p, state) {
    const errors: string[] = [];
    if (!['361-12', '107-12', '361-24', '107-24'].includes(String(p.motorModel)))
      errors.push('Choose a supported gearmotor.');
    if (!Number.isFinite(Number(p.outputAngle)) || Math.abs(Number(p.outputAngle)) > 20)
      errors.push('Output angle must remain within ±20°.');
    if (errors.length) return errors;
    for (const piece of actuatorPieces(p, state)) {
      const definition = libraries.find((candidate) => candidate.id === piece.component.libraryId)!;
      errors.push(
        ...validateParameters(definition, piece.component.parameters, piece.component.state).map(
          (error) => piece.label + ': ' + error,
        ),
      );
    }
    return errors;
  },
  composition(p) {
    return {
      components: actuatorPieces({ ...p, outputAngle: 0 }).map((piece) => piece.component),
      issues: [
        'SFK0825 uses the supplied 0802 EK6/EF6 end reference provisionally; verify the delivered shaft journals.',
        'Determine load, duty cycle, fits and component drawing tolerances before manufacture.',
      ],
    };
  },
  buildGeometry: build,
  dimensions: (p, state) => {
    const group = build(p, state);
    try {
      return new Box3().setFromObject(group, true).getSize(new Vector3()).toArray() as Vec;
    } finally {
      disposeModel(group);
    }
  },
  python: (p, state) => actuatorPython(actuatorPieces(p, state)),
  notes:
    'A separate three-disc frame for the fixed SFK0825 rotary mechanism. The complete drive is offset 13 mm upward from the disc centres, with the disc rims and column pattern unchanged. Three D68 steel discs and two tabbed output cheeks use 4 mm sheet and through-cut profiles. Bearing holes are laser-cut at 12.8 mm and finished to the configured 13.02 mm installation envelope; assign the production fit before cutting. The output bearing axis is centred at X13.4 between the discs; the nut neutral centre is X8.5. Three DREMEC 115x50 female/female and three 215x55 female/male brass standoffs set exact 50/55 mm clear gaps. No tapped sheet holes, housing pockets or bent tabs are required. Four F686-2RS bearings, a clocked nut cover, closed radial forks, narrow capped shaft and ±20° tangent motion remain. The current machined-support and previous slotted-crank families remain separate.',
  sources: [
    { label: 'Supplied KAIYADE SFK nut table', url: 'references/kaiyade-sfk/dimension-table.png' },
    {
      label: 'Supplied 0802 EK6/EF6 end-machining reference',
      url: 'references/kaiyade-sfk/ek6-ef6-0802.png',
    },
    {
      label: 'Supplied LF D14 L22 coupling drawing',
      url: 'references/jaw-coupling/lf-d14-l22-drawing.png',
    },
    {
      label: 'Supplied GMP16T-TEC1636 data',
      url: 'references/gmp16-gearmotor/tec1636-dimensions.png',
    },
  ],
  fabricationFiles(p) {
    const components = actuatorPieces({ ...p, outputAngle: 0 }).map((piece) => piece.component);
    const quote = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
    const rows = [
      ['ID', 'Component', 'Quantity', 'Library', 'Supply', 'Material', 'Designation', 'Source'],
      ...components.map((item) => [
        item.id,
        item.name,
        item.quantity,
        item.libraryId,
        item.supply,
        item.manufacturing?.material,
        item.procurement?.designation,
        item.procurement?.source,
      ]),
    ];
    const csv = rows.map((row) => row.map(quote).join(',')).join('\n') + '\n';
    const law = [-20, -10, 0, 10, 20]
      .map((outputAngle) => {
        const v = layout({ ...p, outputAngle });
        return [outputAngle, v.displacement, v.center, v.turns, v.pinRadius, v.crankRadius].join(
          ',',
        );
      })
      .join('\n');
    return [
      ...laserFabricationFiles(p),
      {
        id: 'bill-of-materials',
        label: 'Component list',
        description: 'Every purchased and machined physical occurrence.',
        name: 'SFK0825-component-list.csv',
        type: 'text/csv;charset=utf-8',
        content: csv,
      },
      {
        id: 'kinematics',
        label: 'Motion table',
        description: 'Output angle, nut displacement and screw turns.',
        name: 'SFK0825-motion.csv',
        type: 'text/csv;charset=utf-8',
        content:
          'OutputAngle_deg,NutDisplacement_mm,NutCentreX_mm,ScrewTurns,PinRadius_mm,CrankRadius_mm\n' +
          law +
          '\n',
      },
    ];
  },
};
export default part;
