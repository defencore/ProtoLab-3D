import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition, Parameters } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
import {
  choice,
  handedness,
  sample,
  tau,
  v,
  wireDimensions,
  wireGeometry,
  wirePython,
} from './lib/core/spring-geometry';

function values(p: Parameters, state: string) {
  const w = n(p, 'wireDiameter'),
    turns = n(p, 'turns');
  const height = n(p, 'freeLength') - w - (state === 'compressed' ? n(p, 'compression') : 0);
  const primary = (n(p, 'outerDiameter') - w) / 2,
    secondary = (n(p, 'secondaryDiameter') - w) / 2;
  const closed = p.ends === 'closed',
    hand = p.handedness === 'left' ? -1 : 1;
  const endTurns = 0.75,
    minPitch = 1.12 * w;
  const integral = (turn: number): number =>
    turn < endTurns
      ? turn / 2 - (endTurns * Math.sin((Math.PI * turn) / endTurns)) / (2 * Math.PI)
      : turn > turns - endTurns
        ? turns - endTurns - integral(turns - turn)
        : turn - endTurns / 2;
  const points = sample(
    (t) => {
      const r =
        p.profile === 'conical'
          ? primary + (secondary - primary) * t
          : p.profile === 'barrel'
            ? secondary + (primary - secondary) * Math.sin(Math.PI * t)
            : p.profile === 'hourglass'
              ? primary + (secondary - primary) * Math.sin(Math.PI * t)
              : primary;
      const z = closed
        ? minPitch * turns * t +
          ((height - minPitch * turns) * integral(turns * t)) / (turns - endTurns)
        : height * t;
      return v(
        r * Math.cos(hand * tau * turns * t),
        r * Math.sin(hand * tau * turns * t),
        z - height / 2,
      );
    },
    Math.ceil(turns * 32),
  );
  return { w, height, primary, secondary, turns, points };
}
const defaults = {
  outerDiameter: 20,
  secondaryDiameter: 14,
  wireDiameter: 2,
  freeLength: 40,
  turns: 6,
  compression: 12,
  profile: 'cylindrical',
  ends: 'open',
  handedness: 'right',
};
const part: PartDefinition = {
  id: 'compression-spring',
  name: 'Compression spring',
  category: 'SPRINGS',
  subgroup: 'HELICAL SPRINGS',
  icon: 'spring',
  complexity: '4 profiles',
  description:
    'Cylindrical, conical, barrel and hourglass springs with configurable end pitch and travel.',
  keywords: [
    'spring',
    'coil',
    'compression',
    'conical',
    'barrel',
    'hourglass',
    'variable diameter',
  ],
  parameters: [
    choice('profile', 'Coil profile', 'Coil', [
      ['cylindrical', 'Cylindrical'],
      ['conical', 'Conical'],
      ['barrel', 'Barrel'],
      ['hourglass', 'Hourglass'],
    ]),
    numberParameter('outerDiameter', 'Largest outside diameter', 'D', 'Coil', 4, 150),
    {
      ...numberParameter('secondaryDiameter', 'Smaller outside diameter', 'D₂', 'Coil', 3, 149),
      visibleWhen: (p) => p.profile !== 'cylindrical',
      description: 'Small end of a cone, both ends of a barrel, or the waist of an hourglass.',
    },
    numberParameter('wireDiameter', 'Wire diameter', 'd', 'Coil', 0.4, 12),
    { ...numberParameter('turns', 'Total turns', 'n', 'Coil', 2, 30, 0.25), unit: '' },
    handedness,
    choice('ends', 'End pitch', 'Ends', [
      ['open', 'Open / uniform pitch'],
      ['closed', 'Reduced pitch at both ends'],
    ]),
    numberParameter('freeLength', 'Free length', 'L', 'Travel', 5, 300),
    {
      ...numberParameter('compression', 'Compression travel', 'x', 'Travel', 0, 250),
      visibleWhen: (_, state) => state === undefined || state === 'compressed',
    },
  ],
  presetMatchKeys: ['profile', 'outerDiameter', 'wireDiameter'],
  defaults,
  presets: modulePresets,
  states: [
    { id: 'relaxed', label: 'Free', description: 'Unloaded free length' },
    { id: 'compressed', label: 'Compressed', description: 'Shortened by the specified travel' },
  ],
  validate(p, s) {
    const { w, height, primary, secondary, turns } = values(p, s),
      errors: string[] = [];
    if (primary <= w || (p.profile !== 'cylindrical' && secondary <= w))
      errors.push('Every outside diameter must exceed three wire diameters.');
    if (p.profile !== 'cylindrical' && secondary >= primary)
      errors.push('The smaller diameter must be below the largest diameter.');
    if (height / turns <= w * 1.15)
      errors.push(
        'Length is too short: reduce travel, turns or wire diameter to preserve coil clearance.',
      );
    return errors;
  },
  buildGeometry(p, s) {
    const { points, w } = values(p, s);
    return wireGeometry(points, w);
  },
  python(p, s) {
    const { points, w } = values(p, s);
    return wirePython(points, w);
  },
  dimensions(p, s) {
    const { points, w } = values(p, s);
    return wireDimensions(points, w);
  },
  notes:
    'One continuous round-wire solid. Reduced-pitch ends are unground and retain a small clearance. State changes describe assembly geometry, not force, stress, fatigue or telescoping contact.',
};
export default { ...part, presets: modulePresets };
