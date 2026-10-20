import type { Parameters, ParameterDefinition } from '../../core/types';
import { models, sourceFrame } from './lib/model';
export const defaults: Parameters = { component: 'part-53' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'component',
    label: 'Upstream physical component',
    group: 'Component',
    type: 'select',
    options: models.map((p) => ({
      value: p.id,
      label: sourceFrame(p.frameId).name + ' · ' + p.label,
    })),
  },
];
export const catalogSelection = [];
