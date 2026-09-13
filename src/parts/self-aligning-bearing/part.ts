import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

import {
  boreTypeParameter,
  selfAligningGeometry,
  selfAligningPython,
} from './lib/parts/self-aligning-details';
import { assemblyStates, bearingParameters } from './lib/parts/bearing-utils';
import { radialDimensions, validateRadial } from './lib/parts/radial-catalog-utils';

const defaults = {
  bore: 12,
  outer: 32,
  width: 10,
  elements: 12,
  boreType: 'straight',
  seals: 'open',
};
const part: PartDefinition = {
  id: 'self-aligning-bearing',
  name: 'Self-aligning ball bearing',
  category: 'BEARINGS',
  subgroup: 'BALL BEARINGS',
  description: 'Two ball rows and a curved outer race envelope for self-aligning bearing layouts.',
  keywords: ['1201', '1205', '1206', 'spherical', 'self-aligning'],
  icon: 'bearing',
  standard: 'Supplier envelope',
  complexity: 'Assembly',
  parameters: [
    ...bearingParameters,
    boreTypeParameter(false),
    {
      key: 'seals',
      label: 'Closure',
      group: 'Construction',
      type: 'select',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'rubber', label: '2RS · rubber seals on both sides' },
      ],
    },
    {
      ...numberParameter('elements', 'Elements per row', 'n', 'Rolling elements', 4, 64, 1),
      unit: '',
      description: 'Illustrative count; catalog presets verify envelope dimensions only.',
    },
  ],
  defaults,
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width', 'boreType', 'seals'],
  validate: (p) => validateRadial(p, 'self-aligning'),
  buildGeometry: selfAligningGeometry,
  python: selfAligningPython,
  dimensions: (p, state) => radialDimensions(p, state, 'self-aligning'),
  notes:
    'Supplier presets identify the recorded envelope and construction options. Tapered bores use the nominal small-end diameter; an adapter sleeve is a separate component. Race profiles, rolling element size and count, seal profiles, cages and clearance gaps are prototype geometry. These are not manufacturing drawings.',
  sources: [
    {
      label: 'Promtehimport · Self-aligning ball bearing',
      url: 'https://promtehimport.com.ua/samovstanovlyuvalni-dvoryadni-kulkovi-pidshipniki-c35/',
    },
  ],
};
export default { ...part, presets: modulePresets };
