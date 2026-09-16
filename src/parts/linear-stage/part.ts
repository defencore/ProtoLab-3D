import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'linear-stage',
  name: 'Linear slide module',
  category: 'LINEAR MOTION',
  subgroup: 'LEAD SCREWS & STAGES',
  icon: 'rail',
  description: 'Belt-stage, dovetail and telescopic guide mounting forms.',
  complexity: 'Parametric prototype',
  keywords: [
    'linear slide module',
    'linear stage',
    'Belt-driven linear slide',
    'Dovetail slide',
    'Telescopic rail',
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
      n(p, 'position') + n(p, 'carriage') > n(p, 'length') ||
      n(p, 'holePitch') >= n(p, 'width') - 6
    )
      errors.push('Carriage and mounting holes must fit the stage.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Guide forms are mounting references; internal rolling elements, telescopic nesting limits and motor drive are not modeled. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
