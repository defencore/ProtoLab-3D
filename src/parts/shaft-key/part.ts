import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'shaft-key',
  name: 'Shaft key',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'SHAFTS & KEYS',
  icon: 'gear',
  description: 'Parallel and Woodruff keys for configurable shaft/hub connections.',
  complexity: 'Parametric prototype',
  keywords: [
    'shaft key',
    'shaft key',
    'Parallel key \u00b7 6 \u00d7 6 \u00d7 25 mm',
    'Round-end key \u00b7 6 \u00d7 6 \u00d7 25 mm',
    'Woodruff key \u00b7 4 \u00d7 6 \u00d7 16 mm',
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
    if (n(p, 'length') <= n(p, 'width') || n(p, 'height') >= n(p, 'length'))
      errors.push('Key length must exceed width and height.');
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
