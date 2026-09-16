import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition } from '../../core/types';

import {
  ballScrewDefaults,
  ballScrewDimensions,
  ballScrewGeometry,
  ballScrewPython,
  validateBallScrew,
} from './lib/parts/ball-screw-geometry';
import { ballNutParameters, ballScrewParameters } from './lib/parts/ball-screw-parameters';

const part: PartDefinition = {
  id: 'ball-nut',
  name: 'Ball screw nut',
  category: 'LINEAR MOTION',
  subgroup: 'BALL SCREWS',
  icon: 'bearing',
  complexity: 'Rolling nut',
  description:
    'Single or double ball nut with a mounting flange, helical raceway, rolling balls and construction-specific return features.',
  keywords: [
    'ball nut',
    'ball screw nut',
    'SFK',
    'SFU',
    'SFS',
    'SFE',
    'DFU',
    'SFI',
    'DFI',
    'SFH',
    'SFY',
    'flanged nut',
    'preload',
  ],
  parameters: [
    ...ballNutParameters,
    ...ballScrewParameters
      .filter((field) => !ballNutParameters.some((nutField) => nutField.key === field.key))
      .map((field) => ({ ...field, visibleWhen: () => false, filterable: false })),
  ],
  defaults: ballScrewDefaults,
  presets: modulePresets,
  presetMatchKeys: ['family', 'shaftDiameter', 'lead', 'nutLength', 'nutDiameter'],
  states: [
    {
      id: 'assembled',
      label: 'Complete nut',
      description: 'A standalone nut assembly centered on its mounting axis.',
    },
    {
      id: 'cutaway',
      label: 'Cutaway · raceway balls',
      description: 'Remove the front half of the housing to reveal the helical ball train.',
    },
  ],
  validate: (p) => validateBallScrew(p, true),
  buildGeometry: (p, state) => ballScrewGeometry(p, state, true),
  python: (p, state) => ballScrewPython(p, state, true),
  dimensions: (p, state) => ballScrewDimensions(p, state, true),
  sources: [
    { label: 'Supplied ball nut construction families', url: '' },
    { label: 'Supplied ball nut size options', url: '' },
    { label: 'Supplied SFU dimension table', url: '' },
  ],
  notes:
    'Source-backed presets identify the dimensions transcribed from their drawing. Loaded ball spacing, circular raceway clearance, return features, preload spacer, and blind lubrication pilot bore are prototype details. A family name alone does not verify the remaining dimensions or certify a production nut. The inspection cutaway is offset by 0.001 mm to keep periodic CAD faces robust.',
};
export default { ...part, presets: modulePresets };
