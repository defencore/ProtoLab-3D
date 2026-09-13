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
  straightLayers,
  validateGear,
} from './lib/core/gears';

const defaults = {
  ...shaftBoreDefaults(),
  profileMode: 'standard',
  module: 1.5,
  teeth: 24,
  pressureAngle: 20,
  backlash: 0.1,
  faceWidth: 10,
  bore: 5,
  hub: true,
  hubDiameter: 16,
  hubLength: 16,
};
const part: PartDefinition = {
  id: 'spur-gear',
  name: 'Spur gear',
  category: 'MOTION',
  subgroup: 'GEARS & RACKS',
  icon: 'gear',
  complexity: 'Involute teeth',
  description:
    'An involute spur gear with module, tooth count, backlash, bore and optional extended hub.',
  keywords: ['gear', 'cog', 'pinion', 'involute', 'spur', 'transmission', 'module', 'teeth'],
  parameters: [
    {
      key: 'profileMode',
      label: 'Tooth profile use',
      type: 'select',
      group: 'Teeth',
      options: [
        { value: 'standard', label: 'Unshifted involute' },
        { value: 'layout', label: 'Small pinion · layout profile' },
      ],
      description:
        'Layout mode permits low tooth counts. The radial root relief does not reproduce manufacturing undercut or a supplier-specific profile shift.',
    },
    ...gearParameters().map((field) => (field.key === 'teeth' ? { ...field, min: 8 } : field)),
  ],
  defaults,
  presetMatchKeys: ['module', 'teeth', 'bore'],
  presets: modulePresets,
  validate: (p) =>
    validateGear(p).filter(
      (error) => !(p.profileMode === 'layout' && error.includes('does not model cutter undercut')),
    ),
  buildGeometry(p) {
    const v = gearValues(p);
    return gearGeometry(v, straightLayers(v));
  },
  python(p) {
    const v = gearValues(p);
    return gearPython(v, straightLayers(v));
  },
  dimensions(p) {
    const v = gearValues(p);
    return gearDimensions(v, straightLayers(v));
  },
  notes:
    'Small pinion layout mode allows undercut-range tooth counts using radial root relief, without reproducing the manufactured root or profile shift. Sampled involute flanks with radial root relief, circular tips and roots; no cutter-generated root fillets or profile shift. The selected shaft profile is an editable prototype fit. Pair equal module and pressure angle. Validate strength, fit and running clearance before use.',
  sources: gearSources,
};
export default { ...part, presets: modulePresets };
