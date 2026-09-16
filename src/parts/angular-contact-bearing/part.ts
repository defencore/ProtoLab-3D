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

const defaults = { bore: 12, outer: 28, width: 8, elements: 10, contactAngle: 25 };
const part: PartDefinition = {
  id: 'angular-contact-bearing',
  name: 'Angular contact ball bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'BALL BEARINGS',
  description:
    'Single ball row with opposite race shoulders for combined radial and axial layouts.',
  keywords: ['7001', '7200', '7201', 'angular', 'contact'],
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
      ...numberParameter(
        'contactAngle',
        'Illustrative contact angle',
        'α',
        'Rolling elements',
        10,
        45,
        1,
      ),
      unit: '°',
      description: 'Prototype shoulder angle; not a supplier-verified internal dimension.',
    },
  ],
  defaults,
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width'],
  validate: (p) => validateRadial(p, 'angular'),
  buildGeometry: (p, state) => radialGeometry(p, state, 'angular'),
  python: (p, state) => radialPython(p, state, 'angular'),
  dimensions: (p, state) => radialDimensions(p, state, 'angular'),
  notes:
    'Supplier presets confirm the bore, outer diameter and total width only. Race profiles, rolling element size and count, contact geometry, seals, cages and clearances are simplified for spatial prototyping; these are not manufacturing drawings.',
  sources: [
    {
      label: 'Promtehimport · Angular contact ball bearing',
      url: 'https://promtehimport.com.ua/radialno-uporni-kulkovi-pidshipniki-c36/',
    },
  ],
};
export default { ...part, presets: modulePresets };
