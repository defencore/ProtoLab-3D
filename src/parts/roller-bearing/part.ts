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
  id: 'roller-bearing',
  name: 'Cylindrical roller bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'ROLLER BEARINGS',
  description: 'Radial bearing envelope with straight cylindrical rolling elements.',
  keywords: ['roller', 'shaft', 'radial', 'NU', 'cylindrical'],
  icon: 'bearing',
  complexity: 'Assembly',
  parameters: [
    {
      key: 'ribs',
      label: 'Rib arrangement',
      type: 'select',
      group: 'Bearing construction',
      options: [
        { value: 'NU', label: 'NU · outer-ring ribs' },
        { value: 'N', label: 'N · inner-ring ribs' },
        { value: 'NJ', label: 'NJ · one inner rib' },
        { value: 'NUP', label: 'NUP · two inner ribs' },
      ],
    },
    ...bearingParameters,
    { ...numberParameter('rollers', 'Roller count', 'n', 'Rolling elements', 3, 32, 1), unit: '' },
  ],
  defaults: { bore: 20, outer: 47, width: 14, rollers: 10, ribs: 'NU' },
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width'],
  sources: [
    {
      label: 'Promtehimport · Cylindrical roller bearings',
      url: 'https://promtehimport.com.ua/rolikovi-cilindrichni-pidshipniki-c43/',
    },
  ],
  validate: (p) => validateRadial(p, 'cylindrical'),
  buildGeometry: (p, state) => radialGeometry(p, state, 'cylindrical'),
  python: (p, state) => radialPython(p, state, 'cylindrical'),
  dimensions: (p, state) => radialDimensions(p, state, 'cylindrical'),
  notes:
    'NU, N, NJ and NUP layouts distinguish which ring carries retaining ribs. Roller size/count, cage windows and rib dimensions are representative. NUP uses a continuous inner-ring envelope; its separate loose collar and edge crowning are omitted.',
};
export default { ...part, presets: modulePresets };
