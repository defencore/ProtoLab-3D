import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'seal-profile',
  name: 'Seal and gasket profile',
  category: 'BEARINGS & SEALS',
  subgroup: 'STATIC SEALS',
  icon: 'bearing',
  description: 'Rod seals, piston cups, wipers and flat annular gaskets.',
  complexity: 'Parametric prototype',
  keywords: [
    'seal and gasket profile',
    'seal profile',
    'Flat annular gasket',
    'U-cup seal',
    'Rod wiper',
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
    if ((n(p, 'diameter') - n(p, 'bore')) / 2 <= 2 * n(p, 'lip') || n(p, 'height') <= n(p, 'lip'))
      errors.push('Profile needs positive wall and base thickness.');
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
