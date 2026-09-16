import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition } from '../../core/types';

import {
  flangeDefaults,
  flangeParameters,
  validateFlange,
  flangeGeometry,
  flangePython,
  flangeDimensions,
  flangeNotes,
} from './lib/parts/flange-bearing-utils';
const part: PartDefinition = {
  id: 'flange-4-bolt-bearing',
  name: 'Four-bolt flange bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'MOUNTED BEARINGS',
  icon: 'bearing',
  complexity: 'Square flange unit',
  description:
    'A square four-hole flange with raised cast housing and an offset sealed UC-style bearing insert.',
  keywords: ['UCF', 'UCF204', 'square', 'flange', 'four bolt', 'mounted bearing'],
  parameters: flangeParameters,
  defaults: flangeDefaults,
  presets: modulePresets,
  presetMatchKeys: ['bore', 'flangeLength', 'flangeWidth', 'width', 'mountPitch'],
  validate: (p) => validateFlange(p, 4),
  buildGeometry: (p) => flangeGeometry(p, 4),
  python: (p) => flangePython(p, 4),
  dimensions: flangeDimensions,
  notes: flangeNotes,
  sources: [
    {
      label: 'Promtehimport · UCF204 photo and manufacturer section drawing',
      url: 'https://promtehimport.com.ua/offer/pidshipnik-korpusniyi-ucf204-fo-bearings-o1163/',
    },
  ],
};
export default { ...part, presets: modulePresets };
