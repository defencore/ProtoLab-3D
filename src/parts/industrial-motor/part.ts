import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'industrial-motor',
  name: 'DC and industrial motor',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'DC & INDUSTRIAL MOTORS',
  icon: 'wheel',
  description:
    'Brushed DC, geared DC, industrial foot/flange, servo and torque-motor forms with shafts and mounts.',
  complexity: 'Parametric prototype',
  keywords: [
    'dc and industrial motor',
    'industrial motor',
    'Brushed DC motor \u00b7 \u00d850',
    'Geared DC motor \u00b7 compact',
    'Foot-mounted industrial motor',
    'Flange-mounted industrial motor',
    'Industrial servo \u00b7 60 mm frame',
    'Pancake torque motor',
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
    if (n(p, 'pitch') + n(p, 'hole') >= n(p, 'diameter') || n(p, 'shaft') >= n(p, 'pitch') * 0.6)
      errors.push('Mounting circle and shaft must fit the motor face.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'IEC/servo labels indicate construction form only, not frame-standard compliance. Coil windings and electromagnetic travel/torque are not modeled. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
