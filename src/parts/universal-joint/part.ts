import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'universal-joint',
  name: 'Universal and ball joint',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'JOINTS & ROD ENDS',
  icon: 'gear',
  description: 'Cross-yoke universal joint and spherical joint dimensional references.',
  complexity: 'Parametric prototype',
  keywords: [
    'universal and ball joint',
    'universal joint',
    'Cross-yoke universal joint',
    'Ball-and-socket joint',
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
    if (n(p, 'shaft') >= n(p, 'diameter') * 0.4 || n(p, 'length') < n(p, 'diameter') * 2.2)
      errors.push('Joint diameter and overall length must clear the shaft/yokes.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Neutral pose only. Ball head is sampled as a revolved circular profile inside a cylindrical clearance housing; socket retention and manufactured bearing races are not modeled. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
