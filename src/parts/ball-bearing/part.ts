import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import {
  radialGeometry,
  radialPython,
  radialDimensions,
  validateRadial,
} from './lib/parts/radial-catalog-utils';
import type { PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';
import { assemblyStates, bearingParameters } from './lib/parts/bearing-utils';

const part: PartDefinition = {
  id: 'ball-bearing',
  name: 'Deep groove ball bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'BALL BEARINGS',
  description:
    'Deep-groove radial races with a ball set and selectable open, shielded or sealed faces.',
  keywords: ['608', '6001', '6204', 'radial', 'shaft', 'ball', 'skateboard'],
  icon: 'bearing',
  standard: 'Metric envelope',
  complexity: 'Assembly',
  parameters: [
    {
      key: 'seals',
      label: 'Closure',
      type: 'select',
      group: 'Bearing construction',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'metal', label: 'Metal shields · ZZ / 2Z' },
        { value: 'rubber', label: 'Rubber seals · 2RS' },
        { value: 'metal-one', label: 'One metal shield · Z' },
        { value: 'rubber-one', label: 'One rubber seal · RS' },
      ],
    },
    ...bearingParameters,
    { ...numberParameter('balls', 'Ball count', 'n', 'Rolling elements', 3, 32, 1), unit: '' },
  ],
  defaults: { bore: 8, outer: 22, width: 7, balls: 7, seals: 'open' },
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width'],
  sources: [
    {
      label: 'Promtehimport · Deep groove ball bearings',
      url: 'https://promtehimport.com.ua/radialni-odnoryadni-pidshipniki-c34/',
    },
  ],
  validate: (p) => validateRadial(p, 'ball'),
  buildGeometry: (p, state) => radialGeometry(p, state, 'ball'),
  python: (p, state) => radialPython(p, state, 'ball'),
  dimensions: (p, state) => radialDimensions(p, state, 'ball'),
  notes:
    'Sampled concave raceways, edge relief and closure faces make open, shielded and sealed constructions distinct. Ball diameter/count, groove conformity, seal lips and cage details are representative; supplier dimensions verify only the marked envelope and attributes.',
};
export default { ...part, presets: modulePresets };
