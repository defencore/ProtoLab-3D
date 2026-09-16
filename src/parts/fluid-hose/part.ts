import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'fluid-hose',
  name: 'Hose and tube segment',
  category: 'PNEUMATICS & GAS',
  subgroup: 'FITTINGS & HOSES',
  icon: 'box',
  description: 'Straight or bent hollow tube for cable, pneumatic and hydraulic routing.',
  complexity: 'Parametric prototype',
  keywords: [
    'hose and tube segment',
    'fluid hose',
    'Straight tube \u00b7 \u00d810 / \u00d86 mm',
    'Tube elbow \u00b7 \u00d810 / \u00d86 mm',
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
    if (n(p, 'bore') >= n(p, 'diameter') || n(p, 'radius') <= n(p, 'diameter'))
      errors.push('Tube needs a positive wall and a bend radius greater than its diameter.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Rigid routing reference; no flexible deformation, reinforcement or minimum-bend-radius rating. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
