import detailLibrary from '../manufactured-detail/part';
import {
  detailGeometry,
  detailPython,
  detailDimensions,
} from '../../core/assembly/detail-instances';
import { shapeComposition } from '../../core/component-recipes';
import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
const part: PartDefinition = {
  composition: (p) => shapeComposition(pieces({ ...p }, 'assembled')),
  id: 'brake',
  product: productData as ProductProfile,
  name: 'Brake assembly',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'BRAKES',
  icon: 'gear',
  description:
    'Disc caliper with friction pads and piston, or open drum with shoes, anchors and backing plate.',
  complexity: 'Parametric prototype',
  keywords: [
    'brake assembly',
    'brake',
    'Disc brake \u00b7 \u00d880 mm',
    'Drum brake \u00b7 \u00d880 mm',
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
    if (n(p, 'bore') >= n(p, 'diameter') * 0.4 || n(p, 'depth') <= n(p, 'thickness') + 4)
      errors.push('Brake requires rotor and caliper clearance.');
    return errors;
  },
  buildGeometry: (p, s) => detailGeometry(detailLibrary, pieces(p, s)),
  dimensions: (p, s) => detailDimensions(detailLibrary, pieces(p, s)),
  python: (p, s) => detailPython(detailLibrary, pieces(p, s)),
  notes:
    'Separate rotor, friction and support components with running clearances. Drum actuation and return springs are not modeled; no braking-torque or friction simulation. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
