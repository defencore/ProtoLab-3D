import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'bearing-locknut',
  name: 'Bearing locknut and tab washer',
  category: 'BEARINGS & SEALS',
  subgroup: 'BEARING MOUNTING',
  icon: 'bearing',
  description: 'Slotted bearing locknut with an independent tab-lock washer.',
  complexity: 'Parametric prototype',
  keywords: [
    'bearing locknut and tab washer',
    'bearing locknut',
    'Locknut and tab washer \u00b7 \u00d825 thread',
    'Locknut and tab washer \u00b7 \u00d840 thread',
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
    if (n(p, 'diameter') < n(p, 'bore') + 6 || n(p, 'washer') < n(p, 'diameter'))
      errors.push('Locknut and washer need radial wall material.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'KM/MB-style arrangement with manually entered dimensions; no DIN size correspondence is claimed. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
