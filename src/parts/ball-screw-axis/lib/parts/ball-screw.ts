import presetData from './ball-screw.presets.json';
import type { Preset as ModulePreset } from '../../../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition } from '../../../../core/types';

import {
  ballScrewDefaults,
  ballScrewDimensions,
  ballScrewGeometry,
  ballScrewPython,
  validateBallScrew,
} from './ball-screw-geometry';
import { ballScrewParameters } from './ball-screw-parameters';

const part: PartDefinition = {
  id: 'ball-screw',
  name: 'Ball screw assembly',
  category: 'LINEAR MOTION',
  subgroup: 'BALL SCREWS',
  icon: 'rail',
  complexity: 'Screw + rolling nut',
  description:
    'Helical ball screw, configurable flanged nut, stepped end journals and lead-linked nut travel.',
  keywords: [
    'ball screw',
    'ballscrew',
    'ballscrew guide',
    'ball screw guide',
    'linear screw drive',
    'SFK',
    'SFU',
    'SFS',
    'SFE',
    'DFU',
    'SFI',
    'DFI',
    'SFH',
    'SFY',
    'C5',
    'C7',
    'linear actuator',
    'machined end',
    'miniature',
  ],
  parameters: ballScrewParameters,
  defaults: ballScrewDefaults,
  presets: modulePresets,
  presetMatchKeys: ['family', 'shaftDiameter', 'lead', 'nutLength', 'nutDiameter'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Screw, nut and loaded ball train in their working positions.',
    },
    {
      id: 'cutaway',
      label: 'Cutaway · raceway balls',
      description: 'Open the front half of the nut housing to show its helical ball train.',
    },
    {
      id: 'screw',
      label: 'Screw only',
      description: 'Export the grooved shaft and its machined end journals.',
    },
    { id: 'nut', label: 'Nut only', description: 'Export the nut centered at the origin.' },
  ],
  validate: (p) => validateBallScrew(p),
  buildGeometry: ballScrewGeometry,
  python: ballScrewPython,
  dimensions: ballScrewDimensions,
  sources: [
    { label: 'Supplied ball nut construction families', url: '' },
    { label: 'Supplied ball nut size options', url: '' },
    { label: 'Supplied SFU dimension table', url: '' },
    {
      label: 'Supplied miniature screw and length options',
      url: '',
    },
    {
      label: 'Supplied C7 miniature screw options',
      url: '',
    },
  ],
  notes:
    'Catalog dimensions apply only to the fields marked by each preset. Circular raceway clearance, loaded ball spacing, deflectors, return covers, preload spacer and lubrication pilot bore are representative prototype geometry. C5/C7 is requested accuracy metadata, not a manufacturing certificate. Overall shaft length includes machined journals; their dimensions are editable custom values. Positive rotation translates the nut by one lead per revolution. Continuous return routing and production contact profiles are not modeled. The inspection cutaway is offset by 0.001 mm to keep periodic CAD faces robust.',
};
export default { ...part, presets: modulePresets };
