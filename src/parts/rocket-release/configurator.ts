import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = {
  drive: 'four-motors',
  tubeOD: 80,
  tubeID: 76,
  release: 0,
  unlockAngle: 14,
  separation: 28,
  springTravel: 8,
  motor: '12',
  fitClearance: 0.5,
};
const number = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  step = 1,
  unit = 'mm',
): ParameterDefinition => ({ key, label, group, type: 'number', min, max, step, unit });
export const parameters: ParameterDefinition[] = [
  {
    key: 'drive',
    label: 'Drive layout',
    group: 'Drive',
    type: 'select',
    options: [
      { value: 'four-motors', label: 'Four gearmotors · 4 pinions' },
      { value: 'central-servo', label: 'One servo · central pinion + 4 idlers' },
    ],
    description:
      'The single-servo layout uses fixed idler axes and a 20:40:100 gear set. A 14° ring turn requires 70° of servo travel in the opposite direction.',
  },
  number('tubeOD', 'Tube outside diameter', 'Housing', 80, 160, 0.1),
  number('tubeID', 'Tube inside diameter', 'Housing', 76, 156, 0.1),
  number('fitClearance', 'Radial sleeve clearance', 'Housing', 0.2, 0.8, 0.1),
  {
    ...number('release', 'Release sequence', 'Motion', 0, 100, 1, '%'),
    description:
      '0–60% rotates the ring under eight retaining heads; 60–100% separates the unlocked upper tube. Position sequence, not a time or force simulation.',
  },
  number('unlockAngle', 'Ring rotation to unlock', 'Motion', 12, 20, 1, '°'),
  number('separation', 'Displayed separation distance', 'Motion', 16, 60),
  number('springTravel', 'Spring expansion travel', 'Springs', 4, 12),
  {
    key: 'motor',
    visibleWhen: (p) => p.drive === 'four-motors',
    label: 'Four gearmotor envelopes',
    group: 'Drive',
    type: 'select',
    options: [
      { value: '12', label: 'Ø12 mm × 35 mm · compact' },
      { value: '16', label: 'Ø16 mm × 35 mm' },
    ],
    description: 'Reconstructed installation envelopes; not manufacturer-specific motor models.',
  },
];
