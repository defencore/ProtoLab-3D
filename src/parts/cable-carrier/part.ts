import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'cable-carrier',
  name: 'Cable duct and drag chain',
  category: 'STRUCTURAL PARTS',
  subgroup: 'CABLE MANAGEMENT',
  icon: 'bracket',
  description: 'Open cable duct and articulated rectangular cable carrier reference.',
  complexity: 'Parametric prototype',
  keywords: [
    'cable duct and drag chain',
    'cable carrier',
    'Cable duct \u00b7 25 \u00d7 18 mm',
    'Drag chain \u00b7 25 \u00d7 18 mm',
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
      2 * n(p, 'wall') >= Math.min(n(p, 'width'), n(p, 'height')) ||
      n(p, 'length') / n(p, 'links') < 3
    )
      errors.push('Carrier section and link pitch must leave material.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Straight carrier only; link hinges, bend stops and minimum bend radius are not defined. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
