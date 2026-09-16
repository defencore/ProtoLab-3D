import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { Parameters, PartDefinition } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
import { bearingParameters, validateBearing } from './lib/parts/bearing-utils';
import { bushingGeometry, bushingLayout, bushingPython } from './lib/parts/linear-bushing-body';
import { lmkReference, lmkReferenceUrl } from './lib/catalog/lmk-reference';

// HepcoMotion's LMF/K tables share B, H, PCD and counterbore dimensions.
const defaults: Parameters = Object.fromEntries(
  Object.entries({ ...lmkReference[16], width: 37 }).filter(([key]) => key !== 'flangeWidth'),
);
const bodyParameters = (p: Parameters): Parameters => ({
  ...p,
  // A square clipped by its inscribed circle yields the circular LMF flange.
  flangeWidth: n(p, 'flangeDiameter'),
});

const part: PartDefinition = {
  id: 'round-flange-linear-bearing',
  name: 'Round-flange linear bushing',
  category: 'LINEAR MOTION',
  subgroup: 'LINEAR BUSHINGS',
  icon: 'bearing',
  complexity: 'Flange + ball circuits',
  description:
    'LMF / LMFL circular-flange linear bushing with four counterbored mounting holes, end wipers and recirculating balls.',
  keywords: [
    'LMF',
    'LMFL',
    'LMF16UU',
    'LMF25LUU',
    'round',
    'flange',
    'linear',
    'bushing',
    'ball circuits',
  ],
  defaults,
  parameters: [
    ...bearingParameters.map((field) =>
      field.key === 'width' ? { ...field, label: 'Overall length', symbol: 'L' } : field,
    ),
    numberParameter('flangeDiameter', 'Flange diameter', 'B', 'Mounting flange', 10, 350),
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
      description: 'Complete circular flange, sleeve, cage, wipers and balls.',
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
      diameter = n(p, 'flangeDiameter'),
      thickness = n(p, 'flangeThickness'),
      pcd = n(p, 'boltCircle'),
      counterbore = n(p, 'counterbore');
    if (v.radius < 0.08) errors.push('The sleeve needs more radial space for the ball circuits.');
    if (diameter <= n(p, 'outer') + 0.5) errors.push('The flange must extend beyond the sleeve.');
    if (thickness <= v.sealWidth + 0.1 || thickness >= n(p, 'width') - 2 * v.sealWidth)
      errors.push('Flange thickness must fit between the end wipers.');
    if (n(p, 'counterDepth') >= thickness || counterbore <= n(p, 'holeDiameter'))
      errors.push('Counterbores need a positive shoulder within the flange.');
    if (pcd / 2 - counterbore / 2 <= v.R + 0.15 || pcd + counterbore >= diameter - 0.3)
      errors.push('Mounting counterbores need clearance from the sleeve and flange perimeter.');
    if (!Number.isInteger(n(p, 'circuits')))
      errors.push('Ball circuit count must be a whole number.');
    return errors;
  },
  buildGeometry: (p, state) => bushingGeometry(bodyParameters(p), state, true),
  python: (p, state) => bushingPython(bodyParameters(p), state, true),
  dimensions: (p, state) => [
    state === 'cutaway' ? (n(p, 'flangeDiameter') + n(p, 'outer')) / 2 : n(p, 'flangeDiameter'),
    n(p, 'flangeDiameter'),
    n(p, 'width'),
  ],
  sources: [
    { label: 'HepcoMotion · LMF / LMFL mounting dimensions, pages 10–13', url: lmkReferenceUrl },
    {
      label: 'HepcoMotion · LMF16UU circular flange drawing',
      url: 'https://hepcomotion.partcommunity.com/3d-cad-models/lmf-standard-flanged-units-hepcomotion?info=hepcomotion%2F27_ball_bushings%2Flmf_series.prj',
    },
  ],
  notes:
    'Supplier d/D/L values define the sleeve envelope. Mounting flange dimensions identified as sourced use the linked HepcoMotion cross-reference; manufacturer interchangeability and tolerances are not asserted. The flange has four counterbored holes. Ball return paths, cage windows and end wipers are representative prototype internals; extended variants use continuous return circuits.',
};
export default { ...part, presets: modulePresets };
