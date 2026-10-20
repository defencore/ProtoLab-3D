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
  id: 'gearbox',
  product: productData as ProductProfile,
  name: 'Gear reducer',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'REDUCERS & DIFFERENTIALS',
  icon: 'gear',
  description:
    'Parallel spur reduction, stacked planetary stages and a right-angle miter pair, with separate gears, shafts and covers.',
  complexity: 'Parametric prototype',
  keywords: [
    'gear reducer',
    'gearbox',
    'Reducer \u00b7 parallel shafts',
    'Reducer \u00b7 right-angle shafts',
    'Reducer \u00b7 coaxial shafts',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Separate physical components.' },
    {
      id: 'internals',
      label: 'Gears & shafts',
      description: 'Inspect transmission components with the casing removed.',
    },
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
    if (!['assembled', 'internals', 'exploded'].includes(state))
      errors.push('Choose a valid model state.');
    if (n(p, 'length') < n(p, 'diameter') * 0.55 || n(p, 'shaft') > n(p, 'diameter') * 0.17)
      errors.push('Housing length and shaft bore must leave space for the gears.');
    if (
      n(p, 'mountPitch') + n(p, 'mountHole') >= n(p, 'diameter') ||
      n(p, 'mountPitch') <= n(p, 'shaft') * 2 ||
      n(p, 'shaft') >= n(p, 'diameter') * 0.3
    )
      errors.push('Shaft and bolt circle must fit the reducer housing.');
    // The input journal has a 0.7× shaft diameter, a 1.5× outer diameter
    // and the same radial running clearance as the configured end covers.
    // Its outer wall must remain outside that clearance bore.
    const clearance = Math.min(0.2, n(p, 'diameter') * 0.002);
    if (p.form === 'parallel' && n(p, 'shaft') * 0.7 * 0.25 <= clearance)
      errors.push(
        'Shaft diameters must leave positive journal bushing walls around their running clearance.',
      );
    return errors;
  },
  buildGeometry: (p, s) => detailGeometry(detailLibrary, pieces(p, s)),
  dimensions: (p, s) => detailDimensions(detailLibrary, pieces(p, s)),
  python: (p, s) => detailPython(detailLibrary, pieces(p, s)),
  notes:
    'Detailed mode contains a 20:40 spur pair, 18:18:54 planetary stages (4:1 each), or a 1:1 miter pair. Involutes are sampled; conical teeth are reference lofts, not manufactured bevel flanks. Cutter fillets, bearings and load ratings require separate engineering. Use exploded state to inspect the transmission. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [
    {
      label: 'KHK · gear geometry reference',
      url: 'https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html',
    },
  ],
};
export default part;
