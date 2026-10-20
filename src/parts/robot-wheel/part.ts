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
  id: 'robot-wheel',
  product: productData as ProductProfile,
  name: 'Robot and pneumatic wheel',
  category: 'STRUCTURAL PARTS',
  subgroup: 'WHEELS & ROLLERS',
  icon: 'bracket',
  description: 'Pneumatic, omni and mecanum wheel construction references.',
  complexity: 'Parametric prototype',
  keywords: [
    'robot and pneumatic wheel',
    'robot wheel',
    'Pneumatic wheel \u00b7 \u00d8100 mm',
    'Omni wheel \u00b7 \u00d8100 mm',
    'Mecanum wheel \u00b7 \u00d8100 mm',
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
    if (n(p, 'bore') >= n(p, 'diameter') * 0.35 || n(p, 'width') >= n(p, 'diameter') * 0.6)
      errors.push('Wheel proportions must leave rim and tyre material.');
    return errors;
  },
  buildGeometry: (p, s) => detailGeometry(detailLibrary, pieces(p, s)),
  dimensions: (p, s) => detailDimensions(detailLibrary, pieces(p, s)),
  python: (p, s) => detailPython(detailLibrary, pieces(p, s)),
  notes:
    'Omni/mecanum rollers run on bored axles with supporting forks. The fixed hub, forks and axles form one rigid CAD component; rollers remain independent. No roller contact or load simulation. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
