import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'track-drive',
  name: 'Tracked running gear',
  category: 'STRUCTURAL PARTS',
  subgroup: 'WHEELS & ROLLERS',
  icon: 'bracket',
  description: 'Continuous track envelope with separate drive and idler wheel bodies.',
  complexity: 'Parametric prototype',
  keywords: [
    'tracked running gear',
    'track drive',
    'Track module \u00b7 \u00d870 wheels',
    'Track module \u00b7 \u00d8120 wheels',
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
      n(p, 'centres') <= n(p, 'diameter') ||
      n(p, 'bore') >= n(p, 'diameter') * 0.5 ||
      n(p, 'thickness') <= 0.2
    )
      errors.push('Track loop requires separated wheels and positive thickness.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Smooth track path, no discrete links, suspension or drive-lug engagement. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
