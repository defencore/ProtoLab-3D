import type { ParameterDefinition, Parameters } from '../../core/types';

export const defaults: Parameters = { model: 'pcie-m2-d' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Adapter board',
    type: 'select',
    group: 'Model',
    options: [{ value: 'pcie-m2-d', label: 'Waveshare PCIe TO M.2 Board (D) · SKU 27709' }],
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'boardLength',
    label: 'PCB length',
    type: 'number',
    unit: 'mm',
    group: 'Dimensions',
    catalogSummary: true,
  },
  {
    key: 'boardWidth',
    label: 'PCB maximum width',
    type: 'number',
    unit: 'mm',
    group: 'Dimensions',
    catalogSummary: true,
  },
];
