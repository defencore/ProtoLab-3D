import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'brake',
  name: 'Brake assembly',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'BRAKES & GRIPPERS',
  icon: 'gear',
  description:
    'Disc and drum brake mounting forms with separate rotating and stationary bodies.',
  complexity: 'Parametric prototype',
  keywords: [
    'brake assembly',
    'brake',
    'Disc brake \u00b7 \u00d880 mm',
    'Drum brake \u00b7 \u00d880 mm',
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
    if (n(p, 'bore') >= n(p, 'diameter') * 0.4 || n(p, 'depth') <= n(p, 'thickness') + 4)
      errors.push('Brake requires rotor and caliper clearance.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'No braking torque, coil or friction model; caliper pads and actuators are omitted. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
