import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/mechanical/assembly';
const part: PartDefinition = {
  id: 'fluid-valve',
  product: productData as ProductProfile,
  name: 'Fluid valve and air preparation unit',
  category: 'PNEUMATICS & GAS',
  subgroup: 'VALVES & AIR PREPARATION',
  icon: 'box',
  description: 'Valve blocks, solenoids, FRL bowls and vacuum ejector mounting references.',
  complexity: 'Parametric prototype',
  keywords: [
    'fluid valve and air preparation unit',
    'fluid valve',
    '3/2 pneumatic valve',
    '5/2 pneumatic valve',
    '5/3 pneumatic valve',
    'Check valve',
    'Flow-control valve',
    'Relief valve',
    'Ball valve',
    'FRL preparation unit',
    'Vacuum ejector',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Separate physical components.' },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Axially separated components for inspection.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const field of parameters) {
      if (
        field.type === 'number' &&
        field.step === 1 &&
        field.unit === '' &&
        !Number.isInteger(n(p, field.key))
      )
        errors.push(field.label + ' must be a whole number.');
    }
    if (!['assembled', 'exploded'].includes(state)) errors.push('Choose a valid model state.');
    if (
      n(p, 'port') >= Math.min(n(p, 'height'), n(p, 'width')) * 0.5 ||
      n(p, 'port') > n(p, 'length') * 0.12
    )
      errors.push('Ports need separation and wall material.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Ports are straight passage references, not a connected spool circuit. No flow coefficient, pneumatic logic, filtration or relief-pressure model. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
