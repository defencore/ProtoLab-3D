import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition, Parameters } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
import {
  handedness,
  hasWireCollision,
  joinPaths,
  sample,
  tau,
  v,
  wireDimensions,
  wireGeometry,
  wireLoftPython,
} from './lib/core/spring-geometry';

function values(p: Parameters, state: string) {
  const w = n(p, 'wireDiameter'),
    originalTurns = n(p, 'turns');
  const turns = originalTurns + (state === 'wound' ? n(p, 'deflection') / 360 : 0);
  const r = (((n(p, 'outerDiameter') - w) / 2) * originalTurns) / turns,
    h = originalTurns * w * 1.3;
  const hand = p.handedness === 'left' ? -1 : 1,
    gap = n(p, 'coilGap'),
    bridge = n(p, 'bridgeLength');
  const first = sample(
    (t) => {
      const angle = hand * tau * turns * (t - 1);
      return v(r * Math.cos(angle), r * Math.sin(angle), -gap / 2 - h + h * t);
    },
    Math.ceil(turns * 32),
  );
  const second = sample(
    (t) => {
      const angle = -hand * tau * turns * t;
      return v(r * Math.cos(angle), r * Math.sin(angle), gap / 2 + h * t);
    },
    Math.ceil(turns * 32),
  );
  const leadA = sample((t) => v(r, hand * bridge * t, -gap / 2), 8);
  const bow = sample(
    (t) =>
      v(r, hand * (bridge + (gap / 2) * Math.sin(Math.PI * t)), (-gap / 2) * Math.cos(Math.PI * t)),
    32,
  );
  const leadB = sample((t) => v(r, hand * bridge * (1 - t), gap / 2), 8);
  const angle = -hand * tau * turns;
  const directionA = v(
    hand * r * Math.sin(angle),
    -hand * r * Math.cos(angle),
    -h / (tau * turns),
  ).normalize();
  const directionB = v(
    hand * r * Math.sin(angle),
    -hand * r * Math.cos(angle),
    h / (tau * turns),
  ).normalize();
  const legA = sample(
    (t) => first[0].clone().addScaledVector(directionA, n(p, 'legLengthA') * (1 - t)),
    12,
  );
  const legB = sample(
    (t) => second[second.length - 1].clone().addScaledVector(directionB, n(p, 'legLengthB') * t),
    12,
  );
  return { w, r, h, turns, points: joinPaths(legA, first, leadA, bow, leadB, second, legB) };
}
const defaults = {
  outerDiameter: 18,
  wireDiameter: 1.5,
  turns: 3,
  coilGap: 8,
  bridgeLength: 12,
  legLengthA: 24,
  legLengthB: 24,
  deflection: 45,
  handedness: 'right',
};
const part: PartDefinition = {
  id: 'double-torsion-spring',
  name: 'Double torsion spring',
  category: 'SPRINGS',
  subgroup: 'TORSION SPRINGS',
  icon: 'spring',
  complexity: '2 states',
  description:
    'Oppositely wound coaxial coils joined by one continuous U bridge, with independently sized outer legs.',
  keywords: ['spring', 'double torsion', 'twin coil', 'clothespin', 'clamp', 'u bridge'],
  parameters: [
    numberParameter('outerDiameter', 'Free outside diameter', 'D', 'Coil', 5, 120),
    numberParameter('wireDiameter', 'Wire diameter', 'd', 'Coil', 0.4, 10),
    { ...numberParameter('turns', 'Turns per coil', 'n', 'Coil', 2, 15, 0.25), unit: '' },
    handedness,
    numberParameter('coilGap', 'Inner end centreline gap', 'G', 'Bridge', 3, 100),
    numberParameter('bridgeLength', 'Bridge straight reach', 'U', 'Bridge', 3, 150),
    numberParameter('legLengthA', 'First outer leg', 'A', 'Legs', 3, 200),
    numberParameter('legLengthB', 'Second outer leg', 'B', 'Legs', 3, 200),
    {
      ...numberParameter('deflection', 'Winding per coil', 'θ', 'Travel', 5, 180, 5),
      visibleWhen: (_, state) => state === undefined || state !== 'relaxed',
      unit: '°',
    },
  ],
  presetMatchKeys: ['outerDiameter', 'wireDiameter'],
  defaults,
  presets: modulePresets,
  states: [
    { id: 'relaxed', label: 'Free', description: 'Original coil and leg positions' },
    { id: 'wound', label: 'Wound', description: 'Both outer legs wind toward the U bridge' },
  ],
  validate(p, s) {
    const { w, r, h, turns, points } = values(p, s),
      errors: string[] = [];
    if (r <= w) errors.push('Coil diameter must exceed three wire diameters in this state.');
    if (h / turns <= 1.08 * w)
      errors.push('The winding closes the coil clearance; reduce deflection.');
    if (n(p, 'coilGap') < 4 * w) errors.push('Bridge gap must be at least four wire diameters.');
    if (Math.min(n(p, 'bridgeLength'), n(p, 'legLengthA'), n(p, 'legLengthB')) < 2 * w)
      errors.push('Straight bridge and leg lengths must each be at least two wire diameters.');
    if (!errors.length && hasWireCollision(points, w))
      errors.push(
        'The selected ends or legs intersect the spring wire. Increase their spacing or change the end orientation.',
      );
    return errors;
  },
  buildGeometry(p, s) {
    const { points, w } = values(p, s);
    return wireGeometry(points, w);
  },
  python(p, s) {
    const { points, w } = values(p, s);
    return wireLoftPython(points, w);
  },
  dimensions(p, s) {
    const { points, w } = values(p, s);
    return wireDimensions(points, w);
  },
  notes:
    'One continuous round-wire solid lofted through circular sections; the surface is segmented along the path. Coils are separated along a shared axis and have opposite winding directions. The inner end gap is measured between wire centrelines; clear gap is smaller by one wire diameter. Bridge reach is measured before its semicircular bend. State geometry is illustrative, without torque or stress calculations.',
};
export default { ...part, presets: modulePresets };
