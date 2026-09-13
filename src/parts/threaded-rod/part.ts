import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition, Parameters } from '../../core/types';
import setScrew from './lib/parts/set-screw';
import {
  buildFastenerGeometry,
  fastenerDimensions,
  fastenerPython,
  validateFastener,
} from './lib/core/fasteners';
import { n, numberParameter } from '../../core/geometry';

const expanded = (p: Parameters): Parameters => ({
  ...setScrew.defaults,
  diameter: p.diameter,
  shankDiameter: p.diameter,
  length: p.length,
  pitch: p.pitch,
  handedness: p.handedness,
  threadMode: p.threadMode,
  drive: 'none',
  tip: 'chamfer',
  tipLength: Math.min(n(p, 'diameter') * 0.12, n(p, 'length') * 0.1),
  tipDiameter: n(p, 'diameter') * 0.76,
  threadSpan: 'full',
});
const part: PartDefinition = {
  id: 'threaded-rod',
  name: 'Threaded rod / stud',
  category: 'FASTENERS',
  subgroup: 'STUDS & RODS',
  icon: 'bolt',
  complexity: 'Continuous metric thread',
  description:
    'Cut-to-length threaded rod with selectable thread direction and detailed or smooth geometry.',
  keywords: ['DIN 975', 'DIN 976', 'stud', 'rod', 'threaded bar', 'allthread'],
  defaults: { diameter: 6, length: 100, pitch: 1, handedness: 'right', threadMode: 'envelope' },
  presets: modulePresets,
  parameters: [
    numberParameter('diameter', 'Thread diameter', 'd', 'Dimensions', 1, 160),
    numberParameter('length', 'Overall length', 'L', 'Dimensions', 3, 3000),
    numberParameter('pitch', 'Thread pitch', 'P', 'Thread', 0.2, 12),
    {
      key: 'handedness',
      label: 'Thread direction',
      group: 'Thread',
      type: 'select',
      options: [
        { label: 'Right hand', value: 'right' },
        { label: 'Left hand', value: 'left' },
      ],
    },
    {
      key: 'threadMode',
      label: 'Thread geometry',
      group: 'Thread',
      type: 'select',
      options: [
        { label: 'Smooth envelope', value: 'envelope' },
        { label: 'Modeled helical thread', value: 'modeled' },
      ],
    },
  ],
  presetMatchKeys: ['diameter', 'length', 'handedness'],
  validate(p) {
    return validateFastener(expanded(p), true);
  },
  buildGeometry(p) {
    return buildFastenerGeometry(expanded(p), true);
  },
  python(p) {
    return fastenerPython(expanded(p), true);
  },
  dimensions(p) {
    return fastenerDimensions(expanded(p), true);
  },
  notes:
    'Stock lengths use a smooth nominal thread envelope for fast assembly layout. Detailed threads are limited to 80 turns; shorten the cut length before enabling them. No drive recess is present.',
};
export default { ...part, presets: modulePresets };
