import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Vector3 } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import {
  annulusPython,
  compoundPython,
  cylinder,
  DARK_STEEL,
  n,
  num,
  numberParameter,
  ring,
} from '../../core/geometry';
import { envelopeParameters, validateEnvelope } from './lib/parts/motion-bearing-utils';
import { assemblyStates } from './lib/parts/bearing-utils';
import { motionSources } from './lib/catalog/motion-bearings';

function values(p: Parameters, state: string) {
  const R = n(p, 'outer') / 2,
    r = n(p, 'bore') / 2,
    width = n(p, 'width'),
    washer = n(p, 'washer');
  return {
    R,
    r,
    width,
    washer,
    roller: (width - 2 * washer) / 2,
    rollerLength: (R - r) * 0.65,
    pitch: (R + r) / 2,
    offset: (width - washer) / 2 + (state === 'exploded' ? width * 0.8 : 0),
  };
}
const part: PartDefinition = {
  id: 'thrust-roller-bearing',
  name: 'Cylindrical thrust roller bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'THRUST BEARINGS',
  icon: 'bearing',
  complexity: 'Radial roller set',
  description:
    'Two axial washers and radially oriented cylindrical rollers for a thrust-bearing assembly.',
  keywords: ['thrust', 'roller', 'axial', '81105', '81110', 'cylindrical'],
  parameters: [
    ...envelopeParameters,
    numberParameter('washer', 'Shaft washer thickness', 's', 'Internal layout', 0.3, 40),
    {
      ...numberParameter('rollers', 'Illustrative roller count', 'n', 'Internal layout', 4, 50, 1),
      unit: '',
    },
  ],
  defaults: { bore: 25, outer: 42, width: 11, washer: 3, rollers: 12 },
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width'],
  sources: motionSources('thrust-roller-bearing'),
  validate(p) {
    const errors = validateEnvelope(p),
      v = values(p, 'assembled'),
      count = n(p, 'rollers');
    if (!Number.isInteger(count)) errors.push('Roller count must be an integer.');
    if (v.roller <= 0.1) errors.push('Two washers must leave a positive roller gap.');
    if (Math.hypot(v.pitch + v.rollerLength / 2, v.roller) >= v.R)
      errors.push('The rollers must fit within the outside diameter.');
    if (2 * v.pitch * Math.sin(Math.PI / count) <= 2 * Math.hypot(v.rollerLength / 2, v.roller))
      errors.push('Reduce the roller count to leave space between radial rollers.');
    return errors;
  },
  buildGeometry(p, state) {
    const group = new Group(),
      v = values(p, state);
    for (const side of [-1, 1]) {
      const washer = ring(v.R, v.r, v.washer);
      washer.position.z = side * v.offset;
      group.add(washer);
    }
    for (let i = 0; i < n(p, 'rollers'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'rollers'),
        direction = new Vector3(Math.cos(a), Math.sin(a), 0),
        roller = cylinder(v.roller, v.rollerLength, DARK_STEEL);
      roller.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), direction);
      roller.position.copy(direction.multiplyScalar(v.pitch));
      group.add(roller);
    }
    return group;
  },
  python(p, state) {
    const v = values(p, state),
      shapes = [-1, 1].map((side) =>
        annulusPython(v.R, v.r, v.washer, side * v.offset - v.washer / 2),
      );
    for (let i = 0; i < n(p, 'rollers'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'rollers');
      shapes.push(
        `Part.makeCylinder(${num(v.roller)}, ${num(v.rollerLength)}, App.Vector(${num((v.pitch - v.rollerLength / 2) * Math.cos(a))}, ${num((v.pitch - v.rollerLength / 2) * Math.sin(a))}, 0), App.Vector(${num(Math.cos(a))}, ${num(Math.sin(a))}, 0))`,
      );
    }
    return compoundPython(shapes);
  },
  dimensions: (p, state) => [
    n(p, 'outer'),
    n(p, 'outer'),
    n(p, 'width') * (state === 'exploded' ? 2.6 : 1),
  ],
  notes:
    'Supplier overall envelope and shaft-washer thickness. Both washers use that thickness in the simplified model. Roller count, length, equal washer bores and raceways are representative; cage and load rating are not modeled.',
};
export default { ...part, presets: modulePresets };
