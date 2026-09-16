import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'dowel-pin',
  name: 'Solid dowel pin',
  category: 'FASTENERS & THREADS',
  subgroup: 'PINS & DOWELS',
  icon: 'bolt',
  description: 'Straight and tapered locating pins with editable end chamfers.',
  complexity: 'Parametric prototype',
  keywords: [
    'solid dowel pin',
    'dowel pin',
    'Cylindrical pin \u00b7 \u00d86 \u00d7 30 mm',
    'Taper pin \u00b7 \u00d86 \u00d7 30 mm',
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
      n(p, 'diameter') - (p.form === 'taper' ? n(p, 'length') * n(p, 'taper') : 0) <=
        2 * n(p, 'chamfer') ||
      n(p, 'length') <= 2 * n(p, 'chamfer')
    )
      errors.push('Taper and chamfers must leave a positive end section.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    ' Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
