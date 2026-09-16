import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'slewing-bearing',
  name: 'Slewing ring bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'ROTARY TABLES',
  icon: 'bearing',
  description:
    'Two independently movable annular rings with mounting circles and independent mounting bolt circles.',
  complexity: 'Parametric prototype',
  keywords: [
    'slewing ring bearing',
    'slewing bearing',
    'Slewing bearing \u00b7 \u00d8150 / \u00d890 mm',
    'Slewing bearing \u00b7 \u00d8250 / \u00d8160 mm',
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
    if ((n(p, 'diameter') - n(p, 'bore')) / 4 <= n(p, 'hole') * 1.5)
      errors.push('Bolt holes need sufficient ring width.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Ring envelopes and bores only; no rolling-element raceway, preload or load rating. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
