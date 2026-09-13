import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { motionSources } from './lib/catalog/motion-bearings';
import {
  sphericalMeridian,
  turnedMesh,
  turnedPython,
  type TurnedProfile,
} from './lib/parts/motion-bearing-utils';
import { Group } from 'three';
import type { PartDefinition } from '../../core/types';
import {
  annulusPython,
  cylinder,
  DARK_STEEL,
  n,
  num,
  numberParameter,
  ring,
} from '../../core/geometry';

function innerProfile(p: PartDefinition['defaults']): TurnedProfile {
  const r = n(p, 'bore') / 2,
    R = n(p, 'outer') / 2,
    seat = (R + r) / 2,
    B = n(p, 'width');
  return [[r, -B / 2], ...sphericalMeridian(seat, B), [r, B / 2], [r, -B / 2]];
}
const part: PartDefinition = {
  id: 'rod-end-bearing',
  name: 'Rod end bearing',
  category: 'BEARINGS',
  subgroup: 'ROD END BEARINGS',
  description: 'Eye bearing and a male shank for linkages, steering and actuator layouts.',
  keywords: ['heim', 'rose joint', 'linkage', 'eye', 'rod', 'male'],
  icon: 'bearing',
  complexity: 'Assembly',
  parameters: [
    numberParameter('bore', 'Bore diameter', 'd', 'Eye', 2, 100),
    numberParameter('outer', 'Head diameter', 'D', 'Eye', 8, 200),
    numberParameter('width', 'Inner-member width', 'B', 'Eye', 3, 100),
    numberParameter('headWidth', 'Head width', 'C1', 'Eye', 3, 100),
    numberParameter('stemDiameter', 'Shank diameter', 'ds', 'Shank', 2, 80),
    numberParameter('stemLength', 'Shank extension', 'L', 'Shank', 5, 200),
  ],
  defaults: { bore: 8, outer: 22, width: 9, headWidth: 9, stemDiameter: 8, stemLength: 28 },
  presetMatchKeys: ['bore', 'outer', 'width', 'headWidth', 'stemDiameter'],
  sources: motionSources('rod-end-bearing'),
  presets: modulePresets,
  validate(p) {
    const errors: string[] = [];
    if (n(p, 'width') < n(p, 'headWidth'))
      errors.push('Overall inner-ring width must be at least the head width.');
    if (n(p, 'outer') <= n(p, 'bore') * 1.65)
      errors.push('Head diameter must exceed 1.65 times the bore.');
    if (n(p, 'stemDiameter') > n(p, 'outer') * 0.6)
      errors.push('Shank diameter must not exceed 60% of the head diameter.');
    const r = n(p, 'bore') / 2,
      seat = (n(p, 'outer') / 2 + r) / 2;
    if (n(p, 'width') / 2 >= Math.sqrt(Math.max(0, seat * seat - (r + 0.1) ** 2)))
      errors.push('The spherical inner member needs material around the bore at both side faces.');
    return errors;
  },
  buildGeometry(p) {
    const group = new Group();
    const R = n(p, 'outer') / 2,
      r = n(p, 'bore') / 2,
      w = n(p, 'headWidth');
    const bearingR = r + (R - r) * 0.5;
    group.add(ring(R, bearingR + (R - r) * 0.04, w), turnedMesh(innerProfile(p), DARK_STEEL));
    const length = n(p, 'stemLength') + (R - bearingR - (R - r) * 0.04) / 2;
    const stem = cylinder(n(p, 'stemDiameter') / 2, length);
    stem.rotation.x = Math.PI / 2;
    stem.position.y = -R - n(p, 'stemLength') + length / 2;
    group.add(stem);
    return group;
  },
  python(p) {
    const R = n(p, 'outer') / 2,
      r = n(p, 'bore') / 2,
      w = n(p, 'headWidth');
    const bearingR = r + (R - r) * 0.5;
    return `housing = ${annulusPython(R, bearingR + (R - r) * 0.04, w)}
shank = Part.makeCylinder(${num(n(p, 'stemDiameter') / 2)}, ${num(n(p, 'stemLength') + (R - bearingR - (R - r) * 0.04) / 2)}, App.Vector(0, ${num(-R - n(p, 'stemLength'))}, 0), App.Vector(0, 1, 0))
housing = housing.fuse(shank).removeSplitter()
bushing = ${turnedPython(innerProfile(p))}
shape = Part.makeCompound([housing, bushing])`;
  },
  dimensions: (p) => [
    n(p, 'outer'),
    n(p, 'outer') + n(p, 'stemLength'),
    Math.max(n(p, 'width'), n(p, 'headWidth'), n(p, 'stemDiameter')),
  ],
  notes:
    'Eye housing and spherical inner member with an unthreaded male shank. Supplier presets verify marked eye and nominal shank dimensions; spherical seat conformity, head outline and thread geometry are representative. Spherical articulation is not simulated. B is the inner-member width; the shank can make the overall assembly thicker. Origin is at the eye center.',
};
export default { ...part, presets: modulePresets };
