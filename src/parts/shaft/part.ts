import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'shaft',
  name: 'Stepped drive shaft',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'SHAFTS & KEYS',
  icon: 'gear',
  description: 'Three journals with optional keyway, retaining grooves or straight-sided splines.',
  complexity: 'Parametric prototype',
  keywords: [
    'stepped drive shaft',
    'shaft',
    'Stepped shaft \u00b7 \u00d820 / \u00d812 \u00d7 150 mm',
    'Shaft with tapered end',
    'Straight-sided splined shaft',
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
      n(p, 'length') <= 2 * n(p, 'endLength') ||
      n(p, 'endDiameter') >= n(p, 'diameter') ||
      n(p, 'keyWidth') >= n(p, 'diameter') ||
      n(p, 'keyDepth') >= n(p, 'diameter') / 3 ||
      n(p, 'groove') >= n(p, 'endLength') * 0.15
    )
      errors.push('Journal, keyway and groove dimensions must fit the shaft.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Spline flanks are straight-sided visual geometry, not an ISO spline fit. Keyway depth is measured radially from the centre journal surface. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
