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
  composition: (p) => shapeComposition(pieces({ ...p, position: 0, turns: 0 }, 'assembled')),
  id: 'lead-screw-axis',
  product: productData as ProductProfile,
  name: 'Lead screw and nut',
  category: 'LINEAR MOTION',
  subgroup: 'LEAD SCREWS & STAGES',
  icon: 'rail',
  description:
    'Trapezoidal/ACME screw dimensional reference with a separate flange nut and adjustable travel.',
  complexity: 'Parametric prototype',
  keywords: [
    'lead screw and nut',
    'lead screw axis',
    'Trapezoidal screw \u00b7 \u00d88 \u00d7 250 mm',
    'ACME screw \u00b7 \u00d812.7 \u00d7 300 mm',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  updateParameters(p, key) {
    if (key === 'form') {
      const preset = presets.find((item) => item.parameters.form === p.form);
      return preset ? { ...p, ...preset.parameters } : p;
    }
    if (key === 'position') return { ...p, turns: n(p, 'position') / n(p, 'pitch') };
    if (key === 'pitch' || key === 'turns')
      return { ...p, position: n(p, 'turns') * n(p, 'pitch') };
    return p;
  },
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
      n(p, 'position') + n(p, 'nutLength') > n(p, 'length') ||
      n(p, 'nutDiameter') < n(p, 'diameter') + 12
    )
      errors.push('Nut must fit on the screw travel and leave a flange.');
    return errors;
  },
  buildGeometry: (p, s) => detailGeometry(detailLibrary, pieces(p, s)),
  dimensions: (p, s) => detailDimensions(detailLibrary, pieces(p, s)),
  python: (p, s) => detailPython(detailLibrary, pieces(p, s)),
  notes:
    'Only screw diameter and lead are declared; thread profile, pitch and starts are unspecified, so the screw remains a nominal envelope in both modes. Use the Thread tool with a defined profile for helical geometry. Input revolutions and nut travel are coupled by the selected lead; no backlash or efficiency simulation. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Simple uses nominal envelopes for declared threads; Full models declared helical features. Features without a defined pitch/profile remain nominal in both modes. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
