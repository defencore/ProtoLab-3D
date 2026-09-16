import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'threaded-insert',
  name: 'Threaded insert and rivet nut',
  category: 'FASTENERS & THREADS',
  subgroup: 'INSERTS & RIVETS',
  icon: 'bolt',
  description: 'Heat-set, flanged insert, rivet nut and self-clinching nut forms.',
  complexity: 'Parametric prototype',
  keywords: [
    'threaded insert and rivet nut',
    'threaded insert',
    'Heat-set insert \u00b7 M3',
    'Press-fit insert \u00b7 M4',
    'Rivet nut \u00b7 M6',
    'Self-clinching nut \u00b7 M3',
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
    if (n(p, 'bore') >= n(p, 'diameter') || n(p, 'flange') < n(p, 'diameter'))
      errors.push('Keep bore smaller than body and flange at least as wide as body.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Rivet nut shown before setting; heat-set ribs are illustrative, not a thermal installation specification. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
