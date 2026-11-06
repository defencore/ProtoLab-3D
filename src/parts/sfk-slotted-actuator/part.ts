import { Box3, Group, Vector3 } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { componentGeometry } from '../../core/assembly/detail-instances';
import { withGeometryMode } from '../../core/geometry-mode';
import { disposeModel } from '../../core/mechanical';
import { validateParameters } from '../../core/validation';
import { actuatorPieces, layout, libraries, nominalJournalNut, type Vec } from './lib/components';
import { actuatorPython } from './lib/native';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';

export { actuatorPieces, layout as actuatorLayout } from './lib/components';

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
  id: 'sfk-slotted-actuator',
  name: 'SFK0825 ball screw rotary actuator · GMP16T-TEC1636 · 1 output · twin slotted cranks · ±20°',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  complexity: 'Twin slotted cranks and opposed rollers',
  description:
    'The previous SFK0825 mechanism is preserved as a separate assembly: fixed screw axis, opposed nut rollers and two slotted cranks turning a perpendicular shaft through ±20°.',
  keywords: [
    'SFK0825',
    '0825',
    'GMP16T',
    'TEC1636',
    'slotted crank',
    'previous version',
    'ball screw',
    'rotary actuator',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Set the output angle of the slotted-crank mechanism.',
    },
    {
      id: 'negative-limit',
      label: '−20° end position',
      description: 'Previous slotted-crank assembly at its negative limit.',
    },
    {
      id: 'positive-limit',
      label: '+20° end position',
      description: 'Previous slotted-crank assembly at its positive limit.',
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
  dimensions(p, state) {
    const group = build(p, state);
    try {
      return new Box3().setFromObject(group, true).getSize(new Vector3()).toArray() as Vec;
    } finally {
      disposeModel(group);
    }
  },
  python: (p, state) => actuatorPython(actuatorPieces(p, state)),
  notes:
    'Preserves the previous 76-occurrence SFK0825 assembly with its original colors, geometry recipes, fixed screw axis, twin slotted cranks, opposed bronze rollers and four F686-2RS bearings. The 12.2 mm arm offset gives nut travel x=12.2 tan(angle), with 8.880874 mm total stroke for ±20°. The direct trunnion version is a separate library item. The source M6 journal and mating nuts remain nominal envelopes in every detail mode. Verify fits, load and drawing tolerances before manufacture; powered reversal and sensing are external.',
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
    const law = [-20, -10, 0, 10, 20]
      .map((outputAngle) => {
        const v = layout({ ...p, outputAngle });
        return [outputAngle, v.displacement, v.center, v.turns, v.rollerRadius].join(',');
      })
      .join('\n');
    return [
      {
        id: 'bill-of-materials',
        label: 'Component list',
        description: 'Every original purchased and machined occurrence.',
        name: 'SFK0825-slotted-component-list.csv',
        type: 'text/csv;charset=utf-8',
        content: rows.map((row) => row.map(quote).join(',')).join('\n') + '\n',
      },
      {
        id: 'kinematics',
        label: 'Motion table',
        description: 'Original slotted-crank angle, travel and screw turns.',
        name: 'SFK0825-slotted-motion.csv',
        type: 'text/csv;charset=utf-8',
        content:
          'OutputAngle_deg,NutDisplacement_mm,NutCentreX_mm,ScrewTurns,RollerRadius_mm\n' +
          law +
          '\n',
      },
    ];
  },
};

export default part;
