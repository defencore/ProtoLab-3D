import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

import { assemblyStates, bearingParameters } from './lib/parts/bearing-utils';
import {
  radialGeometry,
  radialPython,
  radialDimensions,
  validateRadial,
} from './lib/parts/radial-catalog-utils';

const defaults = { bore: 17, outer: 40, width: 16, elements: 12, seals: 'rubber' };
const part: PartDefinition = {
  id: 'double-row-bearing',
  name: 'Double-row ball bearing',
  category: 'BEARINGS',
  subgroup: 'BALL BEARINGS',
  description:
    'Two radial ball rows with optional rubber sealing discs and straight race envelopes.',
  keywords: ['4202', '4203', '4304', 'double', 'row', 'radial'],
  icon: 'bearing',
  standard: 'Supplier envelope',
  complexity: 'Assembly',
  parameters: [
    ...bearingParameters,
    {
      ...numberParameter('elements', 'Elements per row', 'n', 'Rolling elements', 4, 64, 1),
      unit: '',
      description: 'Illustrative count; catalog presets verify envelope dimensions only.',
    },
    {
      key: 'seals',
      label: 'Seals',
      type: 'select',
      group: 'Rolling elements',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'rubber', label: 'Rubber seals · 2RS' },
      ],
    },
  ],
  defaults,
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width'],
  validate: (p) => validateRadial(p, 'double-row'),
  buildGeometry: (p, state) => radialGeometry(p, state, 'double-row'),
  python: (p, state) => radialPython(p, state, 'double-row'),
  dimensions: (p, state) => radialDimensions(p, state, 'double-row'),
  notes:
    'Supplier presets confirm the bore, outer diameter and total width only. Race profiles, rolling element size and count, contact geometry, seals, cages and clearances are simplified for spatial prototyping; these are not manufacturing drawings.',
  sources: [
    {
      label: 'Promtehimport · Double-row ball bearing',
      url: 'https://promtehimport.com.ua/radialni-dvoryadni-kulkovi-pidshipniki-c51/',
    },
  ],
};
export default { ...part, presets: modulePresets };
