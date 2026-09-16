import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'blind-rivet',
  name: 'Blind rivet',
  category: 'FASTENERS & THREADS',
  subgroup: 'INSERTS & RIVETS',
  icon: 'bolt',
  description: 'Uninstalled blind rivet with separate sleeve and pull mandrel.',
  complexity: 'Parametric prototype',
  keywords: [
    'blind rivet',
    'blind rivet',
    'Blind rivet \u00b7 \u00d84.8 \u00d7 12 mm',
    'Blind rivet \u00b7 \u00d83.2 \u00d7 8 mm',
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
    if (n(p, 'diameter') <= n(p, 'mandrel') + 0.3 || n(p, 'head') < n(p, 'diameter'))
      errors.push('Mandrel must clear the sleeve bore.');
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
