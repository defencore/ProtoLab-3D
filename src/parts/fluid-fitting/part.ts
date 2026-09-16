import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'fluid-fitting',
  name: 'Fluid fitting and quick coupling',
  category: 'PNEUMATICS & GAS',
  subgroup: 'FITTINGS & HOSES',
  icon: 'box',
  description:
    'Straight, elbow, tee and bulkhead fittings with configurable flow passage and connection envelopes.',
  complexity: 'Parametric prototype',
  keywords: [
    'fluid fitting and quick coupling',
    'fluid fitting',
    'Straight push-in fitting \u00b7 6 mm passage',
    'Elbow fitting \u00b7 6 mm passage',
    'T fitting \u00b7 6 mm passage',
    'Quick coupling \u00b7 6 mm passage',
    'Bulkhead threaded fitting',
    'Cone-seat fitting',
    'Face-seal fitting',
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
      n(p, 'connectionDiameter') <= n(p, 'passage') + 2 ||
      n(p, 'diameter') < n(p, 'connectionDiameter')
    )
      errors.push('Flow bore must leave wall inside each connection.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Connection names identify envelopes only. Thread pitch/taper, JIC cone angle and ORFS groove dimensions must be taken from the mating standard or supplier drawing. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
