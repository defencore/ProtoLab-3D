import type { ParameterDefinition, Parameters } from '../../core/types';

export const defaults: Parameters = {
  model: 'stepped',
  width: 80,
  depth: 60,
  height: 28,
  wall: 5,
  lidThickness: 2.4,
  rimDepth: 4,
  rimThickness: 1.6,
  clearance: 0.25,
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
  {
    key: 'model',
    label: 'Rim construction',
    type: 'select',
    group: 'Seam geometry',
    options: [
      { value: 'stepped', label: 'Stepped rabbet / outer skirt' },
      { value: 'groove', label: 'Perimeter tongue and recessed groove' },
      { value: 'labyrinth', label: 'Labyrinth / outer skirt and inner rib' },
    ],
  },
  number('width', 'Outside width', 35, 180, 1, 'Envelope'),
  number('depth', 'Outside depth', 30, 140, 1, 'Envelope'),
  number(
    'height',
    'Base shoulder height',
    12,
    80,
    1,
    'Envelope',
    'Base floor datum Z=0 to the planar lid stop. The raised rim and lid add to this height.',
  ),
  number('wall', 'Base wall and floor', 3.5, 10, 0.1, 'Envelope'),
  number('lidThickness', 'Lid closing plate thickness', 1.5, 8, 0.1, 'Envelope'),
  number('rimDepth', 'Rim engagement height', 2, 10, 0.1, 'Seam geometry'),
  number('rimThickness', 'Raised rim / inner rib thickness', 1.2, 4, 0.1, 'Seam geometry'),
  number(
    'clearance',
    'Clearance per mating side / rim end',
    0.05,
    0.5,
    0.05,
    'Fit',
    'Cartesian clearance on each mating wall and between the raised rim top and lid. The planar shoulder remains in contact. Calibrate on the actual printer.',
  ),
];
export const catalogSelection = [];

/** A model change retains the envelope where possible and reconciles its mating walls. */
export function updateParameters(p: Parameters, key: string): Parameters {
  if (key !== 'model') return p;
  const r = Number(p.rimThickness),
    c = Number(p.clearance),
    e = Number(p.rimDepth);
  const wall = Math.max(Number(p.wall), p.model === 'groove' ? r + 2 * (c + 1.2) : r + c + 1.2);
  const minimumOpening = 12 + 2 * wall + (p.model === 'labyrinth' ? 2 * (c + r) : 0);
  return {
    ...p,
    wall,
    width: Math.max(Number(p.width), minimumOpening),
    depth: Math.max(Number(p.depth), minimumOpening),
    height: Math.max(Number(p.height), wall + e + 1),
  };
}
