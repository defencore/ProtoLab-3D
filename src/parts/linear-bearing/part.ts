import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { motionSources } from './lib/catalog/motion-bearings';
import type { PartDefinition } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
import { bearingParameters, validateBearing } from './lib/parts/bearing-utils';
import { bushingGeometry, bushingLayout, bushingPython } from './lib/parts/linear-bushing-body';

const part: PartDefinition = {
  id: 'linear-bearing',
  name: 'Linear ball bushing',
  category: 'LINEAR MOTION',
  subgroup: 'LINEAR BUSHINGS',
  description:
    'Grooved steel sleeve, return cage, end wipers and closed recirculating ball circuits.',
  keywords: ['LM8UU', 'LM12UU', 'linear', 'bushing', 'rail', 'shaft', 'recirculating balls'],
  icon: 'bearing',
  complexity: 'Ball circuits',
  parameters: [
    ...bearingParameters.map((field) =>
      field.key === 'width' ? { ...field, label: 'Length', symbol: 'L' } : field,
    ),
    { ...numberParameter('circuits', 'Ball circuits', 'N', 'Internals', 3, 8, 1), unit: '' },
  ],
  defaults: { bore: 8, outer: 15, width: 24, circuits: 4 },
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width'],
  sources: motionSources('linear-bearing'),
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Complete sleeve, cage, wipers and balls.' },
    {
      id: 'cutaway',
      label: 'Cutaway · ball circuits',
      description: 'Open half of the sleeve and cage to inspect loaded and return paths.',
    },
  ],
  validate(p) {
    const errors = validateBearing(p);
    if (bushingLayout(p).radius < 0.08)
      errors.push('The sleeve needs more radial space for the ball circuits.');
    return errors;
  },
  buildGeometry: (p, state) => bushingGeometry(p, state),
  python: (p, state) => bushingPython(p, state),
  dimensions: (p) => [n(p, 'outer'), n(p, 'outer'), n(p, 'width')],
  notes:
    'Supplier bore, outside diameter and length define the envelope. Ball size/count, retaining grooves, cage openings and seal sections are representative prototype geometry. Cutaway exports the displayed open housing.',
};
export default { ...part, presets: modulePresets };
