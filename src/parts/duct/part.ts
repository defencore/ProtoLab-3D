import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'duct',
  name: 'Nozzle, diffuser and inlet',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'DUCTS & LANDING GEAR',
  icon: 'wing',
  description: 'Hollow circular ducts with independently adjustable inlet, outlet and length.',
  complexity: 'Parametric prototype',
  keywords: [
    'nozzle, diffuser and inlet',
    'duct',
    'Convergent circular nozzle',
    'Divergent circular diffuser',
    'Bell-mouth inlet',
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
    if (2 * n(p, 'wall') >= Math.min(n(p, 'inlet'), n(p, 'outlet')))
      errors.push('Duct wall closes the flow passage.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Geometric flow passage only; pressure loss and compressible-flow performance are not calculated. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
