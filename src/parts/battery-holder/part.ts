import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/mechanical/assembly';
const part: PartDefinition = {
  id: 'battery-holder',
  product: productData as ProductProfile,
  name: 'Cylindrical cell holder',
  browseFamily: { id: 'battery-holders', label: 'Battery holders' },
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'BATTERIES & HOLDERS',
  icon: 'circuit',
  description: 'Open tray for 18650, 21700, AA or AAA cells with configurable count and clearance.',
  complexity: 'Parametric prototype',
  keywords: [
    'cylindrical cell holder',
    'battery holder',
    'Holder \u00b7 2 \u00d7 18650',
    'Holder \u00b7 2 \u00d7 21700',
    'Holder \u00b7 4 \u00d7 AA',
    'Holder \u00b7 2 \u00d7 AAA',
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
    if (n(p, 'wall') >= n(p, 'diameter') * 0.25)
      errors.push('Tray wall is too thick for this cell.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Mechanical cell pockets only; spring contacts, protected-cell extra length and polarity wiring are not supplied. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
