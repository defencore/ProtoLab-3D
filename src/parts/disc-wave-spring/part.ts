import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'disc-wave-spring',
  name: 'Disc, wave and leaf spring',
  category: 'SPRINGS',
  subgroup: 'DISC & LEAF SPRINGS',
  icon: 'spring',
  description: 'Conical disc springs, wave washers and curved leaf springs.',
  complexity: 'Parametric prototype',
  keywords: [
    'disc, wave and leaf spring',
    'disc wave spring',
    'Disc spring \u00b7 \u00d840 / \u00d820 mm',
    'Wave washer \u00b7 \u00d840 / \u00d820 mm',
    'Leaf spring \u00b7 120 \u00d7 20 mm',
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
    if (n(p, 'diameter') <= n(p, 'bore') + 2 * n(p, 'thickness'))
      errors.push('Leave positive annular spring width.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Free-state geometry only; no stiffness, force or fatigue calculation. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
