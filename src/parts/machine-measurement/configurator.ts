import type { ParameterDefinition, Parameters } from '../../core/types';
export const defaults: Parameters = { model: 'mwe21' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Measurement component',
    type: 'select',
    group: 'Catalog',
    options: [
      { value: 'mwe21', label: 'Kuebler MWE21 · C200 · encoder1000 ppr' },
      { value: 'e3z-t81', label: 'OMRON E3Z-T81 · PNP through-beam pair' },
      { value: 'e2b-m12', label: 'OMRON E2B-M12KS04-WP-B1 2M' },
    ],
  },
];
