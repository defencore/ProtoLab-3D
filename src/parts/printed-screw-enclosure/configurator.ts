import type { ParameterDefinition, Parameters } from '../../core/types';
import { supportedLidRange } from './lib/model';

export const defaults: Parameters = {
  width: 80,
  depth: 60,
  height: 30,
  wall: 2.4,
  lidThickness: 6,
  headStyle: 'socket',
  bossWidth: 14,
  headRecess: 0.3,
  holeClearance: 0.4,
  nutClearance: 0.3,
  pocketClearance: 0.2,
  headClearance: 0.2,
};
const number = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  group: string,
  description?: string,
): ParameterDefinition => ({
  key,
  label,
  type: 'number',
  unit: 'mm',
  min,
  max,
  step,
  group,
  description,
});
export const parameters: ParameterDefinition[] = [
  number('width', 'Outside width', 54, 180, 1, 'Envelope'),
  number('depth', 'Outside depth', 48, 140, 1, 'Envelope'),
  number('height', 'Body height', 20, 90, 1, 'Envelope'),
  number('wall', 'Wall and floor thickness', 2, 4, 0.1, 'Envelope'),
  number('lidThickness', 'Lid thickness', 5.5, 9, 0.1, 'Envelope'),
  {
    key: 'headStyle',
    label: 'Screw head seat',
    type: 'select',
    group: 'Closure',
    options: [
      {
        value: 'socket',
        label: 'Recessed M3 socket head / DIN 912',
        availableWhen: (p) => {
          const r = supportedLidRange(p, 'socket');
          return r.min <= r.max;
        },
      },
      {
        value: 'countersunk',
        label: 'Recessed M3 countersunk head / DIN 7991',
        availableWhen: (p) => {
          const r = supportedLidRange(p, 'countersunk');
          return r.min <= r.max;
        },
      },
    ],
    description: 'Selects an actual sourced M3 × 12 screw. Source dimensions remain fixed.',
  },
  number('bossWidth', 'Corner boss width', 12, 22, 0.5, 'Closure'),
  number('headRecess', 'Screw face below lid surface', 0.1, 1, 0.1, 'Closure'),
  number('holeClearance', 'Screw diametral clearance', 0.2, 0.8, 0.05, 'Fit'),
  number(
    'nutClearance',
    'Nut across-flats clearance',
    0.1,
    0.6,
    0.05,
    'Fit',
    'Pocket across flats minus the sourced 5.5 mm nut size. Side-entry slot has the same width.',
  ),
  number(
    'pocketClearance',
    'Nut vertical pocket clearance',
    0.1,
    0.5,
    0.05,
    'Fit',
    'Total pocket height minus nut height. The installed nut bears on the pocket roof; this clearance remains below it. Insert at mid-clearance, then seat upward.',
  ),
  number(
    'headClearance',
    'Head pocket radial clearance',
    0.1,
    0.5,
    0.05,
    'Fit',
    'Applies to free cylindrical access surfaces. The countersink cone retains its nominal seating surface.',
  ),
];

export const catalogSelection = [];

export function updateParameters(p: Parameters, changedKey: string): Parameters {
  if (!['headStyle', 'wall', 'headRecess'].includes(changedKey)) return p;
  const next = { ...p };
  let style: 'socket' | 'countersunk' = next.headStyle === 'countersunk' ? 'countersunk' : 'socket';
  let range = supportedLidRange(next, style);
  if (range.min > range.max && style === 'countersunk') {
    style = 'socket';
    next.headStyle = style;
    range = supportedLidRange(next, style);
  }
  if (range.min <= range.max)
    next.lidThickness = Math.min(range.max, Math.max(range.min, Number(next.lidThickness)));
  return next;
}
