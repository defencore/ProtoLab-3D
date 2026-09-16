import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'cooling-fan',
  name: 'Axial cooling fan',
  category: 'ELECTRONICS & VISION',
  subgroup: 'COOLING & MOUNTING',
  icon: 'circuit',
  description:
    'Square axial fans with a central rotor, open airflow aperture and four mounting bores.',
  complexity: 'Parametric prototype',
  keywords: [
    'axial cooling fan',
    'cooling fan',
    'Axial fan \u00b7 40 \u00d7 40 \u00d7 10 mm',
    'Axial fan \u00b7 60 \u00d7 60 \u00d7 15 mm',
    'Axial fan \u00b7 80 \u00d7 80 \u00d7 25 mm',
    'Axial fan \u00b7 120 \u00d7 120 \u00d7 25 mm',
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
    if (n(p, 'pitch') + n(p, 'hole') >= n(p, 'size') || n(p, 'pitch') < n(p, 'size') * 0.65)
      errors.push('Mounting holes must lie in the frame corners.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Frame dimensions and mounting pitches are editable examples, not a specific fan SKU. Blade twist and airflow are not modeled. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
