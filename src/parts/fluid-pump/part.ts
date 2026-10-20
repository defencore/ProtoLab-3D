import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/mechanical/assembly';
const part: PartDefinition = {
  id: 'fluid-pump',
  product: productData as ProductProfile,
  name: 'Fluid pump and hydraulic motor',
  category: 'PNEUMATICS & GAS',
  subgroup: 'PUMPS & MOTORS',
  icon: 'box',
  description:
    'Gear-pump, vane-pump and hydraulic-motor external forms with shaft, flange and ports.',
  complexity: 'Parametric prototype',
  keywords: [
    'fluid pump and hydraulic motor',
    'fluid pump',
    'External gear pump',
    'Vane pump',
    'Hydraulic motor',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  updateParameters(p, key) {
    if (key !== 'form') return p;
    const preset = presets.find((item) => item.parameters.form === p.form);
    return preset ? { ...p, ...preset.parameters } : p;
  },
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
    if (n(p, 'shaft') >= n(p, 'diameter') * 0.4 || n(p, 'port') >= n(p, 'length') * 0.25)
      errors.push('Ports and shaft must fit the housing.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'External mounting geometry only; pumping elements and displacement are unspecified. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
