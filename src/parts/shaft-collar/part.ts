import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'shaft-collar',
  name: 'Shaft collar',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'SHAFTS & KEYS',
  icon: 'gear',
  description: 'Set-screw and split-clamp shaft collars with editable axial bore.',
  complexity: 'Parametric prototype',
  keywords: [
    'shaft collar',
    'shaft collar',
    'Set-screw collar \u00b7 \u00d812 bore',
    'Split collar \u00b7 \u00d812 bore',
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
    if (n(p, 'bore') + 2 * n(p, 'screw') >= n(p, 'diameter') || n(p, 'screw') >= n(p, 'length'))
      errors.push('Collar must leave material around bore and screw.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    ' Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
