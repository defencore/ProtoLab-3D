import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'parallel-gripper',
  name: 'Parallel gripper',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'BRAKES & GRIPPERS',
  icon: 'gear',
  description: 'Two-jaw gripper with editable opening, finger geometry and mounting holes.',
  complexity: 'Parametric prototype',
  keywords: [
    'parallel gripper',
    'parallel gripper',
    'Parallel gripper \u00b7 30 mm opening',
    'Parallel gripper \u00b7 60 mm opening',
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
    if (n(p, 'opening') + 2 * n(p, 'thickness') > n(p, 'width'))
      errors.push('Jaws must stay inside the guide width.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Geometric jaw travel only; internal rack/screw/air drive and gripping force are unspecified. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
