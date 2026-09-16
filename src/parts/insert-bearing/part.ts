import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group } from 'three';
import type { PartDefinition } from '../../core/types';
import {
  annulusPython,
  compoundPython,
  DARK_STEEL,
  n,
  numberParameter,
  ring,
} from '../../core/geometry';
import {
  envelopeParameters,
  sphericalMeridian,
  turnedMesh,
  turnedPython,
  validateEnvelope,
  type TurnedProfile,
} from './lib/parts/motion-bearing-utils';
import { motionSources } from './lib/catalog/motion-bearings';

function outerProfile(p: PartDefinition['defaults']): TurnedProfile {
  const R = n(p, 'outer') / 2,
    h = n(p, 'hubDiameter') / 2,
    c = n(p, 'outerWidth');
  const inner = h + (R - h) * 0.4;
  return [[inner, -c / 2], ...sphericalMeridian(R, c), [inner, c / 2], [inner, -c / 2]];
}
const part: PartDefinition = {
  id: 'insert-bearing',
  name: 'Insert bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'MOUNTED BEARINGS',
  icon: 'bearing',
  complexity: 'Spherical outer seat',
  description:
    'A UC-style bearing insert with a crowned outer seat, face seals and an extended shaft ring.',
  keywords: [
    'UC',
    'insert',
    'mounted',
    'housing',
    'spherical seat',
    'locking bearing',
    'UC204',
    'UC205',
  ],
  parameters: [
    ...envelopeParameters,
    numberParameter('outerWidth', 'Outer ring width', 'C', 'Insert', 1, 100),
    numberParameter('hubDiameter', 'Inner ring shoulder diameter', 'd1', 'Insert', 2, 250),
  ],
  defaults: { bore: 20, outer: 47, width: 31, outerWidth: 17, hubDiameter: 27.56 },
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width', 'outerWidth'],
  sources: motionSources('insert-bearing'),
  validate(p) {
    const errors = validateEnvelope(p),
      R = n(p, 'outer') / 2,
      h = n(p, 'hubDiameter') / 2,
      c = n(p, 'outerWidth');
    if (c >= n(p, 'width'))
      errors.push('The outer ring must be narrower than the extended inner ring.');
    if (h <= n(p, 'bore') / 2 + 0.2 || h >= R * 0.85)
      errors.push(
        'The inner shoulder must surround the shaft bore and leave room for the outer ring.',
      );
    if (c / 2 >= R || Math.sqrt(R * R - (c * c) / 4) <= h + (R - h) * 0.45)
      errors.push('The crowned outer ring needs positive wall thickness at both ends.');
    return errors;
  },
  buildGeometry(p) {
    const group = new Group(),
      R = n(p, 'outer') / 2,
      h = n(p, 'hubDiameter') / 2,
      c = n(p, 'outerWidth');
    group.add(turnedMesh(outerProfile(p)), ring(h, n(p, 'bore') / 2, n(p, 'width')));
    for (const side of [-1, 1]) {
      const seal = ring(h + (R - h) * 0.4, h + 0.02, c * 0.08, DARK_STEEL);
      seal.position.z = side * c * 0.44;
      group.add(seal);
    }
    return group;
  },
  python(p) {
    const R = n(p, 'outer') / 2,
      h = n(p, 'hubDiameter') / 2,
      c = n(p, 'outerWidth');
    return compoundPython([
      turnedPython(outerProfile(p)),
      annulusPython(h, n(p, 'bore') / 2, n(p, 'width')),
      ...[-1, 1].map((side) =>
        annulusPython(h + (R - h) * 0.4, h + 0.02, c * 0.08, side * c * 0.44 - c * 0.04),
      ),
    ]);
  },
  dimensions: (p) => [n(p, 'outer'), n(p, 'outer'), n(p, 'width')],
  notes:
    'Supplier envelope and marked shoulder dimensions only. Outer-seat curvature, seal sections and symmetric inner-ring extension are representative. Set-screw holes, rolling elements, raceways and locking screws are omitted.',
};
export default { ...part, presets: modulePresets };
