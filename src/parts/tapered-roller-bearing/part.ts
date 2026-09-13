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

const defaults = { bore: 17, outer: 40, width: 13.25, elements: 12 };
const part: PartDefinition = {
  id: 'tapered-roller-bearing',
  name: 'Tapered roller bearing',
  category: 'BEARINGS',
  subgroup: 'ROLLER BEARINGS',
  description: 'Conical rollers and tapered race envelopes using the total assembly width T.',
  keywords: ['30202', '30203', '30205', 'tapered', 'conical'],
  icon: 'bearing',
  standard: 'Supplier envelope',
  complexity: 'Assembly',
  parameters: [
    ...bearingParameters.map((field) =>
      field.key === 'width'
        ? {
            ...field,
            label: 'Overall assembly width',
            symbol: 'T',
            description: 'Total bearing width, not inner-ring width B.',
          }
        : field,
    ),
    {
      ...numberParameter('elements', 'Elements per row', 'n', 'Rolling elements', 4, 64, 1),
      unit: '',
      description: 'Illustrative count; catalog presets verify envelope dimensions only.',
    },
  ],
  defaults,
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width'],
  validate: (p) => validateRadial(p, 'tapered'),
  buildGeometry: (p, state) => radialGeometry(p, state, 'tapered'),
  python: (p, state) => radialPython(p, state, 'tapered'),
  dimensions: (p, state) => radialDimensions(p, state, 'tapered'),
  notes:
    'Supplier presets confirm the bore, outer diameter and total width only. Race profiles, rolling element size and count, contact geometry, seals, cages and clearances are simplified for spatial prototyping; these are not manufacturing drawings. Inner-ring width B and outer-ring width C are approximated; use overall assembly width T for fitting.',
  sources: [
    {
      label: 'Promtehimport · Tapered roller bearing',
      url: 'https://promtehimport.com.ua/rolikovi-konichni-pidshipniki-c39/',
    },
  ],
};
export default { ...part, presets: modulePresets };
