import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'shaft-support',
  name: 'Shaft and screw support',
  category: 'LINEAR MOTION',
  subgroup: 'SHAFT & SCREW SUPPORTS',
  icon: 'rail',
  description:
    'Pillow and flange supports for round shafts and screw ends, with through bores and mounting holes.',
  complexity: 'Parametric prototype',
  keywords: [
    'shaft and screw support',
    'shaft support',
    'Split shaft support \u00b7 \u00d812',
    'Flange shaft support \u00b7 \u00d812',
    'Fixed screw-end support \u00b7 \u00d812',
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
      n(p, 'mountPitch') + n(p, 'mountHole') >= n(p, 'width') ||
      n(p, 'height') < n(p, 'bore') / 2 + 5 ||
      n(p, 'width') < n(p, 'bore') + 18
    )
      errors.push('Shaft and mounting holes must fit the support.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'SK/SHF/BK/BF/FK/FF describe arrangements only; dimensions are not supplier size tables. Bearing seats are simplified to the entered through bore. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
