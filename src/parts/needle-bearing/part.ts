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

const defaults = { bore: 6, outer: 10, width: 8, elements: 12, seals: 'open' };
const part: PartDefinition = {
  id: 'needle-bearing',
  name: 'Drawn-cup needle roller bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'ROLLER BEARINGS',
  description:
    'Thin drawn cup with open ends or two retained lip seals; the shaft acts as the inner race.',
  keywords: [
    'HK0608',
    'HK0810',
    'HK0812',
    'HK1010',
    'HK1616LL',
    'needle',
    'drawn',
    'cup',
    'sealed',
  ],
  icon: 'bearing',
  standard: 'Supplier envelope',
  complexity: 'Assembly',
  parameters: [
    ...bearingParameters.map((field) =>
      field.key === 'bore'
        ? {
            ...field,
            label: 'Shaft diameter',
            symbol: 'Fw',
            description: 'Diameter under the rollers; this bearing has no inner ring.',
          }
        : field.key === 'width'
          ? { ...field, symbol: 'C' }
          : field,
    ),
    {
      ...numberParameter('elements', 'Elements per row', 'n', 'Rolling elements', 4, 64, 1),
      unit: '',
      description: 'Illustrative count; catalog presets verify envelope dimensions only.',
    },
    {
      key: 'seals',
      label: 'End closure',
      type: 'select',
      group: 'Rolling elements',
      options: [
        { value: 'open', label: 'Open · HK' },
        { value: 'rubber', label: 'Two rubber lip seals · HK…LL' },
      ],
      description:
        'Two retained seals shorten the needle and cage assembly inside the same total width.',
    },
  ],
  defaults,
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width'],
  validate: (p) => validateRadial(p, 'needle'),
  buildGeometry: (p, state) => radialGeometry(p, state, 'needle'),
  python: (p, state) => radialPython(p, state, 'needle'),
  dimensions: (p, state) => radialDimensions(p, state, 'needle'),
  notes:
    'Catalog records identify the verified envelope dimensions and closure. NTN HK…LL construction uses two rubber lip seals retained inside the cup, with a shorter needle and cage assembly. Seal lip sections, race profiles, roller size and count, cage windows and clearances are representative geometry for spatial prototyping, not manufacturing drawings. The seals remain with the cup in the exploded view.',
  sources: [
    {
      label: 'Promtehimport · Drawn cup needle bearing',
      url: 'https://promtehimport.com.ua/golchasti-pidshipniki-c44/',
    },
    {
      label: 'NTN · HK1616LL double-sealed construction',
      url: 'https://bearingfinder.ntnamericas.com/item/needle-roller-bearings/drawn-cup-needle-roller-bearings/hk1616ll',
    },
    {
      label: 'NTN · Drawn-cup seal cross-sections, pages B-46–B-48',
      url: 'https://www.ntn-snr.com/sites/default/files/2017-03/needle_roller_bearings_en.pdf',
    },
  ],
};
export default { ...part, presets: modulePresets };
