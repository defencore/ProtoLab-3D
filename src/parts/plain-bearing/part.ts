import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { compoundPython, DARK_STEEL, n, numberParameter } from '../../core/geometry';
import {
  envelopeParameters,
  sphericalMeridian,
  turnedMesh,
  turnedPython,
  validateEnvelope,
  type TurnedProfile,
} from './lib/parts/motion-bearing-utils';
import { motionSources } from './lib/catalog/motion-bearings';

function profiles(p: Parameters): TurnedProfile[] {
  const R = n(p, 'outer') / 2,
    r = n(p, 'bore') / 2,
    width = n(p, 'width'),
    C = n(p, 'outerWidth'),
    seat = r + (R - r) * 0.67;
  const inner: TurnedProfile = [
    [r, -width / 2],
    ...sphericalMeridian(seat, width),
    [r, width / 2],
    [r, -width / 2],
  ];
  const start = Math.sqrt((seat + 0.02) ** 2 - (C * C) / 4);
  const outer: TurnedProfile = [
    [start, -C / 2],
    [R, -C / 2],
    [R, C / 2],
    ...sphericalMeridian(seat + 0.02, C, false),
    [start, -C / 2],
  ];
  return [outer, inner];
}
const part: PartDefinition = {
  id: 'plain-bearing',
  name: 'Spherical plain bearing',
  category: 'BEARINGS',
  subgroup: 'PLAIN BEARINGS',
  icon: 'bearing',
  complexity: 'Spherical sliding seat',
  description:
    'A GE-style spherical inner ring in a matching concave outer ring, without rolling elements.',
  keywords: ['plain', 'spherical', 'sliding', 'GE08', 'GE20', 'bushing', 'articulation'],
  parameters: [
    ...envelopeParameters,
    numberParameter('outerWidth', 'Outer ring width', 'C', 'Sliding seat', 1, 100),
  ],
  defaults: { bore: 8, outer: 16, width: 8, outerWidth: 5 },
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width', 'outerWidth'],
  sources: motionSources('plain-bearing'),
  validate(p) {
    const errors = validateEnvelope(p),
      R = n(p, 'outer') / 2,
      r = n(p, 'bore') / 2,
      seat = r + (R - r) * 0.67,
      width = n(p, 'width');
    if (n(p, 'outerWidth') >= width)
      errors.push('The spherical inner ring must project beyond the outer ring.');
    if (seat <= width / 2 || seat * seat - (width * width) / 4 <= (r + 0.1) ** 2)
      errors.push(
        'Reduce width or increase the radial envelope to preserve the spherical inner-ring wall.',
      );
    return errors;
  },
  buildGeometry(p) {
    const group = new Group();
    profiles(p).forEach((profile, index) =>
      group.add(turnedMesh(profile, index ? DARK_STEEL : undefined)),
    );
    return group;
  },
  python: (p) => compoundPython(profiles(p).map(turnedPython)),
  dimensions: (p) => [n(p, 'outer'), n(p, 'outer'), n(p, 'width')],
  notes:
    'Supplier bore, outer diameter and ring widths. Spherical seat radius and clearance are representative, sampled in the meridian. Lubrication grooves, split outer ring, seals, articulation travel and contact stress are omitted.',
};
export default { ...part, presets: modulePresets };
