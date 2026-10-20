import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = { component: 'contact' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'component',
    label: 'Detail to manufacture',
    type: 'select',
    group: 'Component',
    options: [
      { value: 'contact', label: 'Aluminium contact plate' },
      { value: 'insulator', label: 'POM locating base' },
    ],
  },
];
