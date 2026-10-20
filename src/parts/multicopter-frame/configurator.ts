import type { Parameters, ParameterDefinition } from '../../core/types';
import { frames } from '../multicopter-frame-component/part';
export const defaults: Parameters = {
  model: 'source-one-v5',
  mass: 0.65,
  motorThrust: 12,
  loadFactor: 3,
  dynamicFactor: 1.5,
  flexuralModulus: 40,
  allowableStress: 0,
  stressConcentration: 3,
  propDiameter: 127,
  rotorHeight: 38,
  bladeAxialEnvelope: 5,
  explodedGap: 12,
};
const field = (
  key: string,
  label: string,
  min: number,
  max: number,
  unit: string,
  step: number,
  group = 'Load case',
): ParameterDefinition => ({ key, label, type: 'number', min, max, unit, step, group });
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Source frame',
    type: 'select',
    group: 'Frame',
    options: frames.map((f) => ({ value: f.id, label: f.name })),
  },
  field('mass', 'Total flying mass', 0.15, 3, 'kg', 0.05),
  field('motorThrust', 'Maximum thrust per motor', 1, 40, 'N', 0.5),
  field('loadFactor', 'Manoeuvre load factor', 1, 10, 'g', 0.5),
  field('dynamicFactor', 'Additional dynamic factor', 1, 3, '', 0.1),
  {
    ...field(
      'flexuralModulus',
      'Assumed arm flexural modulus',
      5,
      150,
      'GPa',
      1,
      'Material assumptions',
    ),
    description:
      'Screening assumption; replace with data for the actual laminate and fibre direction.',
  },
  {
    ...field(
      'allowableStress',
      'Assumed arm stress allowable',
      0,
      500,
      'MPa',
      5,
      'Material assumptions',
    ),
    description: "A chosen design allowable, not the upstream manufacturer's certified strength.",
  },
  field('stressConcentration', 'Local stress multiplier', 1, 6, '', 0.1, 'Material assumptions'),
  field('propDiameter', 'Propeller diameter', 80, 150, 'mm', 0.1, 'Envelope'),
  field('rotorHeight', 'Propeller plane above arm top', 20, 80, 'mm', 0.5, 'Envelope'),
  {
    ...field('bladeAxialEnvelope', 'Full axial blade envelope', 1, 80, 'mm', 0.5, 'Envelope'),
    description:
      'Full swept thickness of one rotor, including blade flex. Coaxial rotors use equal outward motor-to-propeller offsets.',
    visibleWhen: (p) => frames.find((f) => f.id === p.model)?.motorsPerArm === 2,
  },
  {
    ...field('explodedGap', 'Separation between components', 5, 40, 'mm', 1, 'Inspection'),
    visibleWhen: (_, state) => !state || state === 'exploded',
  },
];
export const catalogSelection = [];
for (const parameter of parameters)
  if (parameter.group === 'Material assumptions')
    parameter.visibleWhen = (p) => p.model === 'source-one-v5';
