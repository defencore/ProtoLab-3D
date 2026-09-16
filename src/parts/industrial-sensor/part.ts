import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'industrial-sensor',
  name: 'Industrial sensor',
  category: 'ELECTRONICS & VISION',
  subgroup: 'SENSORS & SWITCHES',
  icon: 'circuit',
  description:
    'Cylindrical inductive sensors, shaft encoders and mechanical limit-switch references.',
  complexity: 'Parametric prototype',
  keywords: [
    'industrial sensor',
    'industrial sensor',
    'Proximity sensor \u00b7 M8 body',
    'Proximity sensor \u00b7 M12 body',
    'Proximity sensor \u00b7 M18 body',
    'Shaft encoder \u00b7 \u00d840 body',
    'Roller limit switch',
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
    if (n(p, 'shaft') >= n(p, 'diameter') * 0.6)
      errors.push('Shaft/cable must be smaller than the sensor body.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'M8/M12/M18 specify nominal body diameter only; thread, sensing distance and electrical pinout are unspecified. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
