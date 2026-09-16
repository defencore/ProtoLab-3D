import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'differential',
  name: 'Differential carrier',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'REDUCERS & DIFFERENTIALS',
  icon: 'gear',
  description: 'Editable carrier and opposed half-shafts for differential packaging.',
  complexity: 'Parametric prototype',
  keywords: [
    'differential carrier',
    'differential',
    'Differential carrier \u00b7 \u00d880 \u00d7 60 mm',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Separate physical components.' },
    {
      id: 'internals',
      label: 'Gears & shafts',
      description: 'Inspect transmission components with the casing removed.',
    },
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
    if (!['assembled', 'internals', 'exploded'].includes(state))
      errors.push('Choose a valid model state.');
    if (n(p, 'shaft') > Math.min(n(p, 'diameter') * 0.27, n(p, 'length') * 0.36) * 1.1)
      errors.push('Half-shaft bore must fit inside the bevel gear small end.');
    if (n(p, 'shaft') >= n(p, 'diameter') * 0.35)
      errors.push('Carrier must leave room around the half-shaft.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Detailed construction includes two bevel side gears, two spider pinions, a cross pin and a driven carrier. Teeth are sampled conical reference profiles; tooth contact, spline fits, bearing and strength design require separate engineering. Prototype dimensions are not a manufacturer catalog specification.',
  sources: [],
};
export default part;
