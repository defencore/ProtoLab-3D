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
  id: 'cable-carrier',
  product: productData as ProductProfile,
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
  buildGeometry: (p, s) => detailGeometry(detailLibrary, pieces(p, s)),
  dimensions: (p, s) => detailDimensions(detailLibrary, pieces(p, s)),
  python: (p, s) => detailPython(detailLibrary, pieces(p, s)),
  notes:
    'Straight articulated carrier with alternating hinge ears and bores; detailed mode includes integral hinge pins. Bend stops and minimum bend radius are not defined. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
