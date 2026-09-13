import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { shaftBoreDefaults } from './lib/core/shaft-bore';
import type { PartDefinition } from '../../core/types';
import {
  gearDimensions,
  gearGeometry,
  gearParameters,
  gearPython,
  gearSources,
  gearValues,
  helicalLayers,
  validateGear,
} from './lib/core/gears';
import { n, numberParameter } from '../../core/geometry';

const defaults = {
  ...shaftBoreDefaults(),
  module: 1.5,
  teeth: 24,
  pressureAngle: 20,
  backlash: 0.1,
  faceWidth: 12,
  bore: 6,
  hub: false,
  hubDiameter: 16,
  hubLength: 18,
  helixAngle: 20,
  hand: 'right',
  style: 'helical',
};
const part: PartDefinition = {
  id: 'helical-gear',
  name: 'Helical & herringbone gear',
  category: 'MOTION',
  subgroup: 'GEARS & RACKS',
  icon: 'gear',
  complexity: '2 tooth arrangements',
  description:
    'Normal-module involute teeth with a left or right helix, or a continuous herringbone arrangement.',
  keywords: ['gear', 'helical', 'herringbone', 'double helix', 'chevron', 'pinion', 'transmission'],
  parameters: [
    {
      key: 'style',
      label: 'Tooth arrangement',
      type: 'select',
      group: 'Helix',
      options: [
        { label: 'Single helix', value: 'helical' },
        { label: 'Herringbone', value: 'herringbone' },
      ],
    },
    { ...numberParameter('helixAngle', 'Helix angle', 'β', 'Helix', 5, 40, 1), unit: '°' },
    {
      key: 'hand',
      label: 'Helix hand',
      type: 'select',
      group: 'Helix',
      options: [
        { label: 'Right hand', value: 'right' },
        { label: 'Left hand', value: 'left' },
      ],
      description: 'For herringbone, this is the hand of the lower half.',
    },
    ...gearParameters(true),
  ],
  defaults,
  presets: modulePresets,
  validate(p) {
    const v = gearValues(p, true);
    const errors = validateGear(p, true);
    if ((v.width * Math.tan(v.beta)) / v.pitchRadius > Math.PI / 3)
      errors.push(
        'Total helix twist must be at most 60°. Reduce face width or helix angle, or increase module / tooth count.',
      );
    if (!['left', 'right'].includes(String(p.hand))) errors.push('Choose a valid helix hand.');
    if (!['helical', 'herringbone'].includes(String(p.style)))
      errors.push('Choose a valid tooth arrangement.');
    if (n(p, 'helixAngle') === 0)
      errors.push('Use the spur gear generator for a zero helix angle.');
    return errors;
  },
  buildGeometry(p) {
    const v = gearValues(p, true);
    return gearGeometry(v, helicalLayers(p, v));
  },
  python(p) {
    const v = gearValues(p, true);
    return gearPython(v, helicalLayers(p, v));
  },
  dimensions(p) {
    const v = gearValues(p, true);
    return gearDimensions(v, helicalLayers(p, v));
  },
  notes:
    'Normal-module involute profile with radial root relief. Helix surfaces use short ruled loft sections; herringbone has no center relief groove. Parallel-shaft mates need equal normal module / pressure angle and opposite helix hands. Prototype geometry, not a rated transmission.',
  sources: gearSources,
};
export default { ...part, presets: modulePresets };
