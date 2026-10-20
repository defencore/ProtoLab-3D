import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/mechanical/assembly';
const part: PartDefinition = {
  id: 'sheet-bracket',
  product: productData as ProductProfile,
  name: 'Bent sheet bracket',
  category: 'STRUCTURAL PARTS',
  subgroup: 'BRACKETS & MOUNTS',
  icon: 'bracket',
  description: 'U and Z brackets with editable thickness, bends and mounting bores.',
  complexity: 'Parametric prototype',
  keywords: [
    'bent sheet bracket',
    'sheet bracket',
    'U bracket \u00b7 40 mm wide',
    'Z bracket \u00b7 40 mm wide',
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
      n(p, 'wall') >= n(p, 'height') / 3 ||
      n(p, 'pitch') + n(p, 'hole') >= n(p, 'length') ||
      n(p, 'hole') >= n(p, 'width')
    )
      errors.push('Holes and bends must fit the sheet.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Sharp ideal bends; bend allowance, springback and flat-pattern development are not included. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
