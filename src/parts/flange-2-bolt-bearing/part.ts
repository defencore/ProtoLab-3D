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
const defaults = {
  ...flangeDefaults,
  flangeLength: 113,
  flangeWidth: 60,
  mountPitch: 90,
  flangeThickness: 11,
};
const part: PartDefinition = {
  id: 'flange-2-bolt-bearing',
  name: 'Two-bolt flange bearing',
  category: 'BEARINGS',
  subgroup: 'PILLOW & FLANGE BLOCK BEARINGS',
  icon: 'bearing',
  complexity: 'Oval flange unit',
  description:
    'An oval two-hole flange with raised cast housing and an offset sealed UC-style bearing insert.',
  keywords: ['UCFL', 'UCFL204', 'oval', 'diamond', 'flange', 'two bolt', 'mounted bearing'],
  parameters: flangeParameters,
  defaults,
  presets: modulePresets,
  presetMatchKeys: ['bore', 'flangeLength', 'flangeWidth', 'width', 'mountPitch'],
  validate: (p) => validateFlange(p, 2),
  buildGeometry: (p) => flangeGeometry(p, 2),
  python: (p) => flangePython(p, 2),
  dimensions: flangeDimensions,
  notes: flangeNotes,
  sources: [
    {
      label: 'Promtehimport · UCFL204 drawing and mounting dimensions',
      url: 'https://promtehimport.com.ua/offer/pidshipnik-korpusniyi-ucfl204-fo-bearings-o1128/',
    },
  ],
};
export default { ...part, presets: modulePresets };
