import { roundGuideComposition, roundGuidePieces } from './lib/composition';
import { componentGeometry, componentPython } from '../../core/assembly/detail-instances';
import manufacturedPart from '../manufactured-detail/part';
import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition } from '../../core/types';
import { n, num, numberParameter } from '../../core/geometry';
import { roundCircuit } from './lib/parts/guide-circuits';

const defaults = {
  shaftDiameter: 8,
  length: 200,
  blockLength: 30,
  blockWidth: 24,
  blockHeight: 24,
  clearance: 0.1,
  position: 50,
  holeDiameter: 3.4,
  pitchX: 18,
  pitchY: 18,
};
const part: PartDefinition = {
  id: 'round-linear-guide',
  composition: roundGuideComposition,
  product: productData as ProductProfile,
  name: 'Round shaft guide',
  category: 'LINEAR MOTION',
  subgroup: 'ROUND SHAFT GUIDES',
  icon: 'rail',
  complexity: 'Shaft + block',
  description: 'A round guide shaft and sliding block with a shaft bore and mounting holes.',
  keywords: ['linear', 'shaft', 'rod', 'guide', 'round rail', 'slide', 'bushing'],
  parameters: [
    numberParameter('shaftDiameter', 'Shaft diameter', 'd', 'Shaft', 3, 50),
    numberParameter('length', 'Shaft length', 'L', 'Shaft', 40, 1000),
    numberParameter('blockLength', 'Block length', 'Lb', 'Sliding block', 10, 150),
    numberParameter('blockWidth', 'Block width', 'W', 'Sliding block', 10, 120),
    numberParameter('blockHeight', 'Block height', 'H', 'Sliding block', 10, 100),
    numberParameter('clearance', 'Radial bore clearance', 'c', 'Sliding block', 0.01, 1),
    {
      ...numberParameter('position', 'Travel position', 'x', 'Sliding block', 0, 100, 1),
      unit: '%',
    },
    numberParameter('holeDiameter', 'Mounting hole diameter', 'D', 'Mounting', 1, 12),
    numberParameter('pitchX', 'Hole spacing along shaft', 'Px', 'Mounting', 5, 120),
    numberParameter('pitchY', 'Hole spacing across shaft', 'Py', 'Mounting', 5, 100),
  ],
  presetMatchKeys: ['shaftDiameter'],
  defaults,
  presets: modulePresets,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Shaft and block in their assembly positions.',
    },
    {
      id: 'cutaway',
      label: 'Cutaway · ball circuits',
      description: 'Open housing and cage expose four recirculating ball loops.',
    },
    { id: 'shaft', label: 'Shaft only', description: 'Export the round shaft.' },
    { id: 'block', label: 'Block only', description: 'Export the bored sliding block.' },
  ],
  validate(p) {
    const errors: string[] = [],
      d = n(p, 'shaftDiameter') + n(p, 'clearance') * 2;
    if (n(p, 'length') < n(p, 'blockLength') + 2)
      errors.push('Shaft length must exceed block length by at least 2 mm.');
    if (d + 2 >= Math.min(n(p, 'blockWidth'), n(p, 'blockHeight')))
      errors.push('Block dimensions must leave at least 1 mm around the shaft bore.');
    if (
      n(p, 'pitchX') + n(p, 'holeDiameter') >= n(p, 'blockLength') - 1 ||
      n(p, 'pitchY') + n(p, 'holeDiameter') >= n(p, 'blockWidth') - 1
    )
      errors.push('Mounting holes need edge clearance inside the sliding block.');
    if (n(p, 'pitchY') - n(p, 'holeDiameter') <= d + 0.5)
      errors.push('Mounting holes must not intersect the shaft bore.');
    if (n(p, 'pitchX') <= n(p, 'holeDiameter') + 0.5)
      errors.push('Mounting holes along the shaft need at least 0.5 mm of separation.');
    if (roundCircuit(p).radius <= 0.15)
      errors.push(
        'Shaft, block and mounting holes must leave room for the recirculating ball insert.',
      );
    return errors;
  },
  buildGeometry(p, state) {
    const model = componentGeometry([manufacturedPart], roundGuidePieces(p, state));
    if (state === 'cutaway') {
      model.rotation.x = Math.PI;
      model.position.z = n(p, 'blockHeight');
    }
    return model;
  },
  python(p, state) {
    const recipe = componentPython([manufacturedPart], roundGuidePieces(p, state));
    return state !== 'cutaway'
      ? recipe
      : recipe +
          `
for component in components:
    component.rotate(App.Vector(0,0,${num(n(p, 'blockHeight') / 2)}),App.Vector(1,0,0),180)
shape = Part.makeCompound(components)`;
  },
  dimensions(p, state) {
    return state === 'shaft'
      ? [n(p, 'length'), n(p, 'shaftDiameter'), n(p, 'shaftDiameter')]
      : [
          n(p, state === 'block' ? 'blockLength' : 'length'),
          state === 'cutaway' ? n(p, 'blockWidth') / 2 + roundCircuit(p).outer : n(p, 'blockWidth'),
          n(p, 'blockHeight'),
        ];
  },
  notes:
    'Custom round-shaft assembly with four closed ball circuits, a slotted return cage and end wipers. The cutaway exposes the insert inside the bored housing. Ball sizes/counts and clearance chambers are representative; presets are not manufacturer-verified bushing or housing dimensions. Clearance is radial.',
};
export default { ...part, presets: modulePresets };
