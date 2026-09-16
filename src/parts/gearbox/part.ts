import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'gearbox',
  name: 'Gear reducer',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'REDUCERS & DIFFERENTIALS',
  icon: 'gear',
  description: 'Editable gearbox housings, mounting holes and input/output shafts for integration.',
  complexity: 'Parametric prototype',
  keywords: [
    'gear reducer',
    'gearbox',
    'Reducer \u00b7 parallel shafts',
    'Reducer \u00b7 right-angle shafts',
    'Reducer \u00b7 coaxial shafts',
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
      n(p, 'mountPitch') + n(p, 'mountHole') >= n(p, 'diameter') ||
      n(p, 'mountPitch') <= n(p, 'shaft') * 2 ||
      n(p, 'shaft') >= n(p, 'diameter') * 0.3
    )
      errors.push('Shaft and bolt circle must fit the reducer housing.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'External mounting model only. Detailed mode adds external stage covers, not operating gear internals. Ratios, backlash, self-locking and supplier interchangeability are not inferred. Stage covers are inspection components; use exploded state to view them. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
