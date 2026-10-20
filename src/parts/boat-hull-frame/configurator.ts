import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = {
  length: 900,
  beam: 280,
  depth: 130,
  thickness: 4,
  frameCount: 7,
  deadrise: 12,
  sternBeam: 70,
  rocker: 18,
  sheer: 8,
  keelHeight: 80,
  web: 16,
  fitClearance: 0.15,
  lightening: true,
  explodedGap: 30,
};
const number = (
  key: string,
  label: string,
  min: number,
  max: number,
  group = 'Hull dimensions',
  unit = 'mm',
  step = 1,
): ParameterDefinition => ({ key, label, min, max, group, unit, step, type: 'number' });
export const parameters: ParameterDefinition[] = [
  number('length', 'Frame length', 400, 1800),
  number('beam', 'Maximum frame beam', 140, 600),
  number('depth', 'Hull deck datum height', 70, 300),
  number('thickness', 'Measured sheet thickness', 2, 10, 'Sheet and joints', 'mm', 0.1),
  number('frameCount', 'Transverse frames', 4, 10, 'Sheet and joints', '', 1),
  number('fitClearance', 'Total slot width clearance', 0, 0.6, 'Sheet and joints', 'mm', 0.05),
  number('web', 'Minimum perimeter web', 8, 40, 'Sheet and joints'),
  number('keelHeight', 'Keel web height', 30, 200, 'Sheet and joints'),
  number('deadrise', 'Bottom deadrise', 0, 30, 'Hull shape', '°', 1),
  number('sternBeam', 'Transom beam', 45, 90, 'Hull shape', '%', 1),
  number('rocker', 'Bow bottom rise', 0, 45, 'Hull shape'),
  number('sheer', 'Bow deck rise', 0, 35, 'Hull shape'),
  { key: 'lightening', label: 'Lightening openings', type: 'boolean', group: 'Sheet and joints' },
  {
    ...number('explodedGap', 'Frame separation', 10, 80, 'Inspection'),
    visibleWhen: (_, s) => s === 'exploded',
  },
];
export const catalogSelection = [];
