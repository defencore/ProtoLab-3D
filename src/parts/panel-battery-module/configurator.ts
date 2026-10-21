import type { Parameters, ParameterDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';
export const defaults: Parameters = {
  pack: '4S',
  panelThickness: 2,
  showPanel: true,
  showCells: true,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'pack',
    label: 'Battery module',
    type: 'select',
    group: 'Module',
    options: [
      { value: '3S', label: '3S / three 18650 cells' },
      { value: '4S', label: '4S / four 18650 cells' },
    ],
  },
  {
    ...numberParameter('panelThickness', 'Host panel thickness', 't', 'Installation', 1, 6, 0.5),
    description:
      'A flat front flange seats on the panel; four M4 bolts secure it to rear clamp strips with recessed nuts.',
  },
  { key: 'showPanel', label: 'Show host panel', type: 'boolean', group: 'Installation' },
  { key: 'showCells', label: 'Show reference cells', type: 'boolean', group: 'Module' },
];
