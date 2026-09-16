import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'slot-profile',
  name: 'Modular T-slot extrusion',
  category: 'STRUCTURAL PARTS',
  subgroup: 'ALUMINIUM PROFILES',
  icon: 'bracket',
  description:
    'Configurable multi-cell extrusion for larger square and rectangular profile frames.',
  complexity: 'Parametric prototype',
  keywords: [
    'modular t-slot extrusion',
    'slot profile',
    '3030 extrusion \u00b7 prototype section',
    '4040 extrusion \u00b7 prototype section',
    '4080 extrusion \u00b7 prototype section',
    '8080 extrusion \u00b7 prototype section',
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
    if (n(p, 'slot') + 2 * n(p, 'wall') >= n(p, 'cell') * 0.6)
      errors.push('Slot cavity must fit within each extrusion cell.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Generic slot cavities, no Bosch/item/80-20 interchangeability claim. Existing source-backed 2020/2040 profiles remain in T-slot aluminium profile. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
