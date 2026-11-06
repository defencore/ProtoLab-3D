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

export { layout as actuatorLayout } from './lib/components';

export function actuatorPieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const v = layout(p, state);
  const custom = [...framePieces(v.center), ...outputPieces(v.angle), ...retentionPieces()];
  const pieces: ConfiguredPiece[] = [
    ...purchasedPieces(p, state),
    ...custom.map((item) => {
      const component = detailComponent(item.id, item.label, item.shape);
      const bronze = /bronze|bush|roller/i.test(item.label);
      const shaft = /shaft|spacer|pin|stud|ring|washer|rod/i.test(item.label);
      component.manufacturing = {
        material: bronze
          ? 'Bearing bronze'
          : shaft
            ? 'Steel, grade to suit the specified load'
            : 'Aluminium alloy 6061-T6',
        blank: 'Stock sized to the component drawing',
        processes: bronze || shaft ? ['turning', 'drilling'] : ['milling', 'drilling'],
        requirements: ['Dimension and tolerance the configured native solid before machining.'],
      };
      return { component, label: item.label, color: item.color, requireSingleSolid: true };
    }),
    ...frameFasteners(v.center).map(fastenerPiece),
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
  id: 'sfk-rotary-actuator',
  name: 'SFK0825 ball screw rotary actuator · GMP16T-TEC1636 · 1 output · machined supports · ±20°',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  complexity: 'Clocked nut cover and closed slotted forks',
  description:
    'A 90°-clocked ball nut carries a matching threaded cover and short side pins. Two closed slotted forks capture its flats and turn a narrow perpendicular shaft through ±20°, with a closed end and extended output.',
  keywords: [
    'SFK0825',
    '0825',
    'SFK08025',
    'GMP16T',
    'TEC1636',
    'rotary actuator',
    '20 degrees',
    'closed slotted fork',
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
    'Fixed-axis mechanical prototype with the stock SFK0825 nut clocked 90°. A profile-following cover carries two integral short Ø4 pins on its flat sides. Four M3 screws pass through the stock flange into blind threads in the cover. Closed radial slots let the pins slide freely while their inner faces capture the cover flats against roll. A 56 mm base and thin bored F686 seats narrow the transverse unit; a compact cap closes one end and the opposite Ø6 shaft end extends farther. Output is ±20° with a 13 mm arm and 13 tan(angle) nut travel. Four F686-2RS bearings remain. The M6 source journal and mating nuts keep nominal envelopes; specify loads, fits and tolerances before manufacture.',
  sources: [
    { label: 'Supplied KAIYADE SFK nut table', url: '' },
    {
      label: 'Supplied 0802 EK6/EF6 end-machining reference',
      url: '',
    },
    {
      label: 'Supplied LF D14 L22 coupling drawing',
      url: '',
    },
    {
      label: 'Supplied GMP16T-TEC1636 data',
      url: 'https://www.ttmotor.com/uploads/GMP16T-TEC1636.pdf',
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
