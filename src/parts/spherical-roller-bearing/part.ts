import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

import { boreTypeParameter } from './lib/parts/self-aligning-details';
import { assemblyStates, bearingParameters } from './lib/parts/bearing-utils';
import {
  radialGeometry,
  radialPython,
  radialDimensions,
  validateRadial,
} from './lib/parts/radial-catalog-utils';

const defaults = { bore: 25, outer: 52, width: 18, elements: 12, boreType: 'straight' };
const part: PartDefinition = {
  id: 'spherical-roller-bearing',
  name: 'Spherical roller bearing',
  category: 'BEARINGS',
  subgroup: 'ROLLER BEARINGS',
  description: 'Two rows of inclined barrel rollers inside a curved outer race envelope.',
  keywords: ['22205', '22206', '22207', '22208', 'barrel', 'spherical'],
  icon: 'bearing',
  standard: 'Supplier envelope',
  complexity: 'Assembly',
  parameters: [
    ...bearingParameters,
    boreTypeParameter(true),
    {
      ...numberParameter('elements', 'Elements per row', 'n', 'Rolling elements', 4, 64, 1),
      unit: '',
      description: 'Illustrative count; catalog presets verify envelope dimensions only.',
    },
  ],
  defaults,
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width', 'boreType'],
  validate: (p) => validateRadial(p, 'spherical'),
  buildGeometry: (p, state) => radialGeometry(p, state, 'spherical'),
  python: (p, state) => radialPython(p, state, 'spherical'),
  dimensions: (p, state) => radialDimensions(p, state, 'spherical'),
  notes:
    'Supplier presets identify the recorded envelope and construction options. Tapered bores use the nominal small-end diameter; an adapter sleeve is a separate component. Race profiles, rolling element size and count, seal profiles, cages and clearance gaps are prototype geometry. These are not manufacturing drawings.',
  sources: [
    {
      label: 'Promtehimport · Spherical roller bearing',
      url: 'https://promtehimport.com.ua/rolikovi-sferichni-pidshipniki-c42/',
    },
  ],
};
export default { ...part, presets: modulePresets };
