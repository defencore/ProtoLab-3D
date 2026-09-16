import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'propeller',
  name: 'Propeller and rotor',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'PROPELLERS & ROTORS',
  icon: 'wing',
  description: 'Twisted air and marine propellers, axial fans and centrifugal impeller forms.',
  complexity: 'Parametric prototype',
  keywords: [
    'propeller and rotor',
    'propeller',
    'Air propeller \u00b7 2 blades',
    'Air propeller \u00b7 3 blades',
    'Air propeller \u00b7 4 blades',
    'Marine propeller \u00b7 3 blades',
    'Axial impeller \u00b7 7 blades',
    'Centrifugal impeller \u00b7 12 vanes',
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
      n(p, 'hub') >= n(p, 'diameter') * 0.5 ||
      n(p, 'bore') >= n(p, 'hub') - 4 ||
      n(p, 'chord') > n(p, 'diameter') * 0.4
    )
      errors.push('Hub, bore and chord must fit the rotor.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Four-point lens-like blade sections with geometric twist, not source NACA or a qualified propeller. No thrust, cavitation, fatigue, balancing or rotational-speed rating. Centrifugal variant uses straight radial vanes. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
