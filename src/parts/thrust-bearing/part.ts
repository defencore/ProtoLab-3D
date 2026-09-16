import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { motionSources } from './lib/catalog/motion-bearings';
import { turnedMesh, turnedPython, type TurnedProfile } from './lib/parts/motion-bearing-utils';
import { Group } from 'three';
import type { PartDefinition } from '../../core/types';
import { compoundPython, DARK_STEEL, n, num, numberParameter, sphere } from '../../core/geometry';
import { assemblyStates, bearingParameters, validateBearing } from './lib/parts/bearing-utils';

function washerProfiles(p: PartDefinition['defaults'], state: string): TurnedProfile[] {
  const R = n(p, 'outer') / 2,
    r = n(p, 'bore') / 2,
    w = n(p, 'width'),
    ball = Math.min(w * 0.25, (R - r) * 0.4),
    pitch = (R + r) / 2,
    groove = ball + Math.min(w, R - r) * 0.004;
  const offset = state === 'exploded' ? w * 0.8 : 0;
  const top: TurnedProfile = Array.from({ length: 65 }, (_, i) => {
    const radius = R - ((R - r) * i) / 64,
      delta = radius - pitch;
    return [
      radius,
      -Math.max(
        ball * 0.82,
        Math.abs(delta) < groove ? Math.sqrt(groove * groove - delta * delta) : 0,
      ) - offset,
    ];
  });
  const lower: TurnedProfile = [
    [r, -w / 2 - offset],
    [R, -w / 2 - offset],
    ...top,
    [r, -w / 2 - offset],
  ];
  return [lower, lower.map(([radius, z]) => [radius, -z] as [number, number]).reverse()];
}
const part: PartDefinition = {
  id: 'thrust-bearing',
  name: 'Thrust ball bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'THRUST BEARINGS',
  description: 'Two axial washers and a ball set for axial load assembly layouts.',
  keywords: ['axial', 'thrust', 'washer', '51100'],
  icon: 'bearing',
  complexity: 'Assembly',
  parameters: [
    ...bearingParameters,
    { ...numberParameter('balls', 'Ball count', 'n', 'Rolling elements', 3, 32, 1), unit: '' },
  ],
  defaults: { bore: 10, outer: 24, width: 9, balls: 8 },
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width'],
  sources: motionSources('thrust-bearing'),
  states: assemblyStates,
  validate(p) {
    const errors = validateBearing(p);
    const count = n(p, 'balls');
    const pitchR = (n(p, 'outer') + n(p, 'bore')) / 4;
    const ballR = Math.min(n(p, 'width') * 0.25, (n(p, 'outer') - n(p, 'bore')) * 0.2);
    if (!Number.isInteger(count)) errors.push('Ball count must be a whole number.');
    if (2 * pitchR * Math.sin(Math.PI / count) <= 2 * ballR)
      errors.push('Too many balls for this bearing envelope.');
    return errors;
  },
  buildGeometry(p, state) {
    const group = new Group();
    const R = n(p, 'outer') / 2,
      r = n(p, 'bore') / 2,
      width = n(p, 'width');
    const ballR = Math.min(width * 0.25, (R - r) * 0.4),
      pitchR = (R + r) / 2;
    for (const profile of washerProfiles(p, state)) group.add(turnedMesh(profile));
    for (let i = 0; i < n(p, 'balls'); i++) {
      const angle = (i * 2 * Math.PI) / n(p, 'balls');
      const ball = sphere(ballR, DARK_STEEL);
      ball.position.set(Math.cos(angle) * pitchR, Math.sin(angle) * pitchR, 0);
      group.add(ball);
    }
    return group;
  },
  python(p, state) {
    const R = n(p, 'outer') / 2,
      r = n(p, 'bore') / 2,
      width = n(p, 'width');
    const ballR = Math.min(width * 0.25, (R - r) * 0.4),
      pitchR = (R + r) / 2;
    const shapes = washerProfiles(p, state).map((profile) => turnedPython(profile));
    for (let i = 0; i < n(p, 'balls'); i++) {
      const angle = (i * 2 * Math.PI) / n(p, 'balls');
      shapes.push(
        `Part.makeSphere(${num(ballR)}, App.Vector(${num(Math.cos(angle) * pitchR)}, ${num(Math.sin(angle) * pitchR)}, 0))`,
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
    'Axial washers with sampled concave ball tracks and a separated ball row. Ball size/count, washer section and groove conformity are representative; cages and rated thrust capacity are not modeled.',
};
export default { ...part, presets: modulePresets };
