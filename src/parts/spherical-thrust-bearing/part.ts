import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Quaternion, Vector3 } from 'three';
import type { PartDefinition } from '../../core/types';
import { compoundPython, DARK_STEEL, n, num, numberParameter } from '../../core/geometry';
import { envelopeParameters, validateEnvelope } from './lib/parts/motion-bearing-utils';
import { assemblyStates } from './lib/parts/bearing-utils';
import {
  sphericalThrustCage,
  sphericalThrustCagePython,
  sphericalThrustProfiles,
  sphericalThrustValues,
  thrustRevolve,
  thrustRevolvePython,
} from './lib/parts/spherical-thrust-geometry';

const defaults = { bore: 90, outer: 155, width: 39, elements: 16, contactAngle: 50 };
const part: PartDefinition = {
  id: 'spherical-thrust-bearing',
  name: 'Spherical thrust roller bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'THRUST BEARINGS',
  icon: 'bearing',
  complexity: 'Inclined barrel roller row',
  standard: '292 / 293 / 294 series',
  description:
    'A separable housing washer and shaft washer with inclined asymmetric barrel rollers and a windowed cage.',
  keywords: [
    'spherical',
    'thrust',
    'axial',
    'roller',
    '292',
    '293',
    '294',
    '29318',
    '29412',
    'self-aligning',
  ],
  defaults,
  parameters: [
    ...envelopeParameters.map((field) =>
      field.key === 'width' ? { ...field, symbol: 'T' } : field,
    ),
    {
      ...numberParameter('elements', 'Illustrative roller count', 'n', 'Internal layout', 4, 64, 1),
      unit: '',
    },
    {
      ...numberParameter(
        'contactAngle',
        'Nominal contact angle',
        'α',
        'Internal layout',
        40,
        70,
        1,
      ),
      unit: '°',
      description:
        'Representative normal to the roller axis, measured from the radial plane. Not a supplier-verified contact geometry.',
    },
  ],
  presets: modulePresets,
  states: assemblyStates,
  presetMatchKeys: ['bore', 'outer', 'width'],
  validate(p) {
    const errors = validateEnvelope(p),
      v = sphericalThrustValues(p);
    if (!Number.isInteger(v.count)) errors.push('Rolling element count must be a whole number.');
    if (v.seatRadius <= v.R + 0.01)
      errors.push(
        'Increase the contact angle so the spherical raceway spans the outside diameter.',
      );
    if (!Number.isFinite(v.halfGap) || v.radii[0] <= v.r || v.radii[3] >= v.R)
      errors.push('The roller row and cage must fit inside the radial envelope.');
    if (v.beta * 2 >= ((Math.PI * 2) / v.count) * 0.9)
      errors.push('Too many rolling elements for the cage windows. Reduce the element count.');
    const halfAxial = (v.length / 2) * Math.sin(v.angle) + v.radius * Math.cos(v.angle);
    if (halfAxial >= v.w * 0.43) errors.push('The inclined roller row needs more axial width.');
    if (
      v.seat(v.radii[0]) - v.cageThickness / 2 <= 0 ||
      v.seat(v.radii[3]) + v.cageThickness / 2 >= v.w
    )
      errors.push('The inclined cage must stay between the mounting faces.');
    return errors;
  },
  buildGeometry(p, state) {
    const v = sphericalThrustValues(p),
      profiles = sphericalThrustProfiles(p),
      group = new Group(),
      offset = state === 'exploded' ? v.w * 0.7 : 0;
    const housing = thrustRevolve(profiles.housing),
      shaft = thrustRevolve(profiles.shaft);
    housing.name = 'Spherical housing washer';
    shaft.name = 'Shaft washer';
    housing.position.z = -offset;
    shaft.position.z = offset;
    group.add(housing, shaft, sphericalThrustCage(p));
    for (let i = 0; i < v.count; i++) {
      const a = (i * Math.PI * 2) / v.count,
        axis = new Vector3(
          Math.cos(a) * Math.cos(v.angle),
          Math.sin(a) * Math.cos(v.angle),
          Math.sin(v.angle),
        );
      const roller = thrustRevolve(profiles.roller, DARK_STEEL);
      roller.name = 'Inclined asymmetric barrel roller';
      roller.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis));
      roller.position.set(v.pitch * Math.cos(a), v.pitch * Math.sin(a), v.w / 2);
      group.add(roller);
    }
    group.position.z = -v.w / 2;
    return group;
  },
  dimensions: (p, state) => [
    n(p, 'outer'),
    n(p, 'outer'),
    n(p, 'width') * (state === 'exploded' ? 2.4 : 1),
  ],
  python(p, state) {
    const v = sphericalThrustValues(p),
      profiles = sphericalThrustProfiles(p),
      offset = state === 'exploded' ? v.w * 0.7 : 0;
    const setup = [
      `housing=${thrustRevolvePython(profiles.housing)}\nhousing.translate(App.Vector(0,0,-${num(offset)}))`,
      `shaft=${thrustRevolvePython(profiles.shaft)}\nshaft.translate(App.Vector(0,0,${num(offset)}))`,
      sphericalThrustCagePython(p),
    ];
    const names = ['housing', 'shaft', 'cage'];
    for (let i = 0; i < v.count; i++) {
      const a = (i * Math.PI * 2) / v.count,
        id = `roller_${i}`;
      setup.push(
        `${id}=${thrustRevolvePython(profiles.roller)}\n${id}.rotate(App.Vector(0,0,0),App.Vector(${num(-Math.sin(a))},${num(Math.cos(a))},0),${num(90 - (v.angle * 180) / Math.PI)})\n${id}.translate(App.Vector(${num(v.pitch * Math.cos(a))},${num(v.pitch * Math.sin(a))},${num(v.w / 2)}))`,
      );
      names.push(id);
    }
    return [
      ...setup,
      compoundPython(names),
      `shape.translate(App.Vector(0,0,-${num(v.w / 2)}))`,
    ].join('\n');
  },
  notes:
    'The spherical housing raceway, inclined asymmetric barrel rollers and conical windowed cage distinguish this family from cylindrical thrust bearings. Supplier presets verify only d/D/T. Washer sections, roller size/count, cage shape, contact angle and raceway conformity are representative; the assembly is not a load or self-alignment simulation.',
  sources: [
    {
      label: 'SKF spherical roller thrust bearing construction',
      url: 'https://www.skf.com/ng/products/rolling-bearings/roller-bearings/spherical-roller-thrust-bearings',
    },
    {
      label: 'Promtehimport 29318-M supplier envelope',
      url: 'https://promtehimport.com.ua/offer/pidshipnik-29318-m-cx-poland-o9994/',
    },
  ],
};
export default { ...part, presets: modulePresets };
