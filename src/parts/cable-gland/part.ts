import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'cable-gland',
  name: 'Cable gland',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'CABLE ENTRY',
  icon: 'circuit',
  description: 'Panel cable gland with separate compression nut, body and seal envelope.',
  complexity: 'Parametric prototype',
  keywords: [
    'cable gland',
    'cable gland',
    'Cable gland \u00b7 \u00d86 cable',
    'Cable gland \u00b7 \u00d810 cable',
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
      n(p, 'thread') <= n(p, 'cable') + 3 ||
      n(p, 'hex') <= n(p, 'thread') ||
      n(p, 'length') <= n(p, 'nut') + 5
    )
      errors.push('Gland wall, nut and panel thread need clearance.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Nominal smooth thread and cable passage. No ingress-protection rating or compression/sealing simulation. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
