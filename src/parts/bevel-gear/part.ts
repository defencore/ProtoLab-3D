import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { shaftBoreDefaults } from './lib/core/shaft-bore';
import type { Parameters, PartDefinition } from '../../core/types';
import {
  gearDimensions,
  gearGeometry,
  gearParameters,
  gearPython,
  gearSources,
  gearValues,
  validateGear,
} from './lib/core/gears';
import { n, numberParameter } from '../../core/geometry';

const defaults = {
  ...shaftBoreDefaults(),
  module: 2,
  teeth: 24,
  pressureAngle: 20,
  backlash: 0.1,
  faceWidth: 8,
  bore: 6,
  coneAngle: 45,
};
function values(p: Parameters) {
  const v = gearValues(p);
  const scale = 1 - (v.width * Math.tan((n(p, 'coneAngle') * Math.PI) / 180)) / v.pitchRadius;
  return {
    v,
    scale,
    layers: [
      { z: -v.width / 2, angle: 0, scale: 1 },
      { z: v.width / 2, angle: 0, scale },
    ],
  };
}
const part: PartDefinition = {
  id: 'bevel-gear',
  name: 'Bevel gear',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'GEARS & GEAR DRIVES',
  icon: 'gear',
  complexity: 'Tapered approximation',
  description:
    'A tapered involute gear for bevel-drive space planning, with a straight shaft bore.',
  keywords: ['gear', 'bevel', 'conical', 'miter', 'mitre', 'right angle', 'transmission'],
  parameters: [
    {
      ...numberParameter('coneAngle', 'Pitch cone angle', 'δ', 'Cone', 10, 70, 1),
      unit: '°',
      description: 'The pitch radius tapers by axial width × tan(cone angle).',
    },
    ...gearParameters(false, false).map((field) =>
      field.key === 'module' ? { ...field, label: 'Large-end module' } : field,
    ),
  ],
  defaults,
  presets: modulePresets,
  validate(p) {
    const { scale } = values(p);
    const errors = validateGear(p, false, scale);
    if (scale < 0.35)
      errors.push('The small-end scale must be at least 35%. Reduce axial width or cone angle.');
    return errors;
  },
  buildGeometry(p) {
    const { v, layers } = values(p);
    return gearGeometry(v, layers);
  },
  python(p) {
    const { v, layers } = values(p);
    return gearPython(v, layers);
  },
  dimensions(p) {
    const { v, layers } = values(p);
    return gearDimensions(v, layers);
  },
  notes:
    'Layout approximation: a planar involute profile is scaled along the axis. This is not a generated bevel tooth surface and is not guaranteed to mesh. Use for envelope and shaft-placement prototypes only; axial width is not cone face width.',
  sources: gearSources,
};
export default { ...part, presets: modulePresets };
