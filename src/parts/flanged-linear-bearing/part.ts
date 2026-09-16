import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
import { bearingParameters, validateBearing } from './lib/parts/bearing-utils';
import { bushingGeometry, bushingLayout, bushingPython } from './lib/parts/linear-bushing-body';
import { lmkReference, lmkReferenceUrl } from './lib/catalog/lmk-reference';
const defaults = { ...lmkReference[16], width: 37 };
const part: PartDefinition = {
  id: 'flanged-linear-bearing',
  name: 'Square-flange linear bushing',
  category: 'LINEAR MOTION',
  subgroup: 'LINEAR BUSHINGS',
  icon: 'bearing',
  complexity: 'Flange + ball circuits',
  description:
    'LMK / LMKL square-flange linear bushing with counterbored mounting holes and recirculating balls.',
  keywords: ['LMK', 'LMKL', 'LMK16UU', 'flange', 'linear', 'bushing', 'square', 'ball circuits'],
  defaults,
  parameters: [
    ...bearingParameters.map((field) =>
      field.key === 'width' ? { ...field, label: 'Overall length', symbol: 'L' } : field,
    ),
    numberParameter('flangeWidth', 'Flange width', 'K', 'Mounting flange', 8, 250),
    numberParameter('flangeDiameter', 'Flange corner diameter', 'B', 'Mounting flange', 10, 350),
    numberParameter('flangeThickness', 'Flange thickness', 'H', 'Mounting flange', 1, 50),
    numberParameter('boltCircle', 'Bolt circle diameter', 'PCD', 'Mounting flange', 5, 300),
    numberParameter('holeDiameter', 'Mounting hole diameter', 'd1', 'Mounting flange', 1, 30),
    numberParameter('counterbore', 'Counterbore diameter', 'd2', 'Mounting flange', 2, 45),
    numberParameter('counterDepth', 'Counterbore depth', 'h', 'Mounting flange', 0.1, 35),
    { ...numberParameter('circuits', 'Ball circuits', 'N', 'Internals', 3, 8, 1), unit: '' },
  ],
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Complete flanged sleeve, cage, wipers and balls.',
    },
    {
      id: 'cutaway',
      label: 'Cutaway · ball circuits',
      description: 'Expose the return paths through an open half housing.',
    },
  ],
  validate(p) {
    const errors = validateBearing(p),
      v = bushingLayout(p),
      F = n(p, 'flangeWidth'),
      T = n(p, 'flangeThickness'),
      B = n(p, 'flangeDiameter'),
      PCD = n(p, 'boltCircle'),
      cb = n(p, 'counterbore');
    if (v.radius < 0.08) errors.push('The sleeve needs more radial space for the ball circuits.');
    if (F <= n(p, 'outer') + 0.5 || B < F || B > F * Math.SQRT2)
      errors.push(
        'The flange must surround the sleeve; its corner diameter must lie between its width and diagonal.',
      );
    if (T <= v.sealWidth + 0.1 || T >= n(p, 'width') - 2 * v.sealWidth)
      errors.push('Flange thickness must fit between the end wipers.');
    if (n(p, 'counterDepth') >= T || cb <= n(p, 'holeDiameter'))
      errors.push('Counterbores need a positive shoulder within the flange.');
    if (PCD / 2 - cb / 2 <= v.R + 0.15 || PCD / Math.SQRT2 + cb >= F - 0.3 || PCD + cb >= B - 0.3)
      errors.push('Mounting counterbores need clearance from the sleeve and flange edges.');
    return errors;
  },
  buildGeometry: (p, state) => bushingGeometry(p, state, true),
  python: (p, state) => bushingPython(p, state, true),
  dimensions: (p, state) => [
    state === 'cutaway' ? (n(p, 'flangeWidth') + n(p, 'outer')) / 2 : n(p, 'flangeWidth'),
    n(p, 'flangeWidth'),
    n(p, 'width'),
  ],
  sources: [{ label: 'HepcoMotion LMK / LMKL mounting dimension reference', url: lmkReferenceUrl }],
  notes:
    'Supplier d/D/L values define the bushing envelope. Flange dimensions, when identified as sourced, use the linked manufacturer cross-reference. Manufacturer interchangeability and tolerances are not asserted. Balls, cage windows and seals are prototype internals.',
};
export default { ...part, presets: modulePresets };
