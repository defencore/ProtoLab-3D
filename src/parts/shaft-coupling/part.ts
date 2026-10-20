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
  composition: (p) => shapeComposition(pieces({ ...p, detail: 'detailed' }, 'assembled')),
  id: 'shaft-coupling',
  product: productData as ProductProfile,
  name: 'Shaft coupling',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'SHAFT COUPLINGS',
  icon: 'gear',
  description: 'Rigid, Oldham, bellows, slotted-beam and flange coupling forms.',
  complexity: 'Parametric prototype',
  keywords: [
    'shaft coupling',
    'shaft coupling',
    'Rigid coupling',
    'Oldham coupling',
    'Bellows coupling',
    'Beam coupling',
    'Flange coupling',
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
      n(p, 'diameter') <= n(p, 'bore') + 8 ||
      n(p, 'gap') >= n(p, 'length') * 0.65 ||
      n(p, 'gap') < 3
    )
      errors.push('Leave room for both hubs and the centre element.');
    return errors;
  },
  buildGeometry: (p, s) => detailGeometry(detailLibrary, pieces(p, s)),
  dimensions: (p, s) => detailDimensions(detailLibrary, pieces(p, s)),
  python: (p, s) => detailPython(detailLibrary, pieces(p, s)),
  notes:
    'Oldham grooves, beam slots and bellows are illustrative; select actual supplier dimensions before integration. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
