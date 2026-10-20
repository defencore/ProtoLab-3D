import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition, Parameters } from '../../core/types';
import setScrew from '../set-screw/part';
import {
  buildFastenerGeometry,
  fastenerDimensions,
  fastenerPython,
  validateFastener,
} from '../../core/hardware/fasteners';
import { n, numberParameter } from '../../core/geometry';

export const threadedRodFastenerParameters = (p: Parameters): Parameters => ({
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
  tipDiameter: Math.min(
    n(p, 'diameter') * 0.76,
    n(p, 'diameter') - ((17 * Math.sqrt(3)) / 24) * n(p, 'pitch') - 0.02,
  ),
  threadSpan: 'full',
});
const part: PartDefinition = {
  id: 'threaded-rod',
  product: productData as ProductProfile,
  name: 'Threaded rod and stud',
  category: 'FASTENERS & THREADS',
  subgroup: 'STUDS & RODS',
  icon: 'bolt',
  complexity: 'Continuous metric thread',
  description:
    'Cut-to-length threaded rod with selectable thread direction, drawing callouts and selectable Simple / Full thread detail.',
  keywords: ['DIN 975', 'DIN 976', 'stud', 'rod', 'threaded bar', 'allthread'],
  defaults: { diameter: 6, length: 100, pitch: 1, handedness: 'right', threadMode: 'envelope' },
  presets: modulePresets,
  parameters: [
    numberParameter('diameter', 'Thread diameter', 'd', 'Dimensions', 1, 160),
    numberParameter('length', 'Overall length', 'L', 'Dimensions', 3, 3000),
    numberParameter('pitch', 'Thread pitch', 'P', 'Thread', 0.2, 12),
    {
      key: 'threadMode',
      label: 'Thread representation',
      group: 'Thread',
      type: 'select',
      options: [{ label: 'Threaded', value: 'envelope' }],
    },
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
  ],
  presetMatchKeys: ['diameter', 'length', 'handedness'],
  validate(p) {
    return validateFastener(threadedRodFastenerParameters(p), true);
  },
  buildGeometry(p) {
    return buildFastenerGeometry(threadedRodFastenerParameters(p), true);
  },
  python(p) {
    return fastenerPython(threadedRodFastenerParameters(p), true);
  },
  dimensions(p) {
    return fastenerDimensions(threadedRodFastenerParameters(p), true);
  },
  notes:
    'Simple uses nominal thread envelopes for fast layout; Full exports real helical flanks over the declared thread length. Diameter, pitch, handedness and length are preserved as drawing callouts. No drive recess is present.',
};
export default { ...part, presets: modulePresets };
