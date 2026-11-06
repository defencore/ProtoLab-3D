import type { ParameterDefinition, Parameters } from '../../core/types';
import presets from './presets.json';

export const fittedModels = [
  ['hat', 'Bus Servo Driver HAT (A)'],
  ['heltec', 'Heltec V4 / LoRa32'],
  ['adc', 'ADS1220 / CJMCU-1220'],
  ['buck-1', 'BEC / DC-DC · 12 V'],
  ['buck-2', 'BEC / DC-DC · 5 V'],
  ['filter-1', 'LC filter · sensor supply'],
  ['filter-2', 'LC filter · ADS1220 supply'],
] as const;
export const adapterModels = presets.map((preset) => ({
  value: preset.parameters.model,
  label: preset.name,
}));
export const defaults: Parameters = {
  model: 'universal-flat',
  mountSpanX: 20,
  mountSpanY: 20,
  boardWidth: 24,
  boardDepth: 20,
  boardThickness: 1.6,
  seatHeight: 6,
  clearance: 0.3,
};
const universal = (p: Parameters) => String(p.model).startsWith('universal-');
const field = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  step: number,
): ParameterDefinition => ({
  key,
  label,
  type: 'number',
  unit: 'mm',
  group,
  min,
  max,
  step,
  visibleWhen: universal,
});
export const parameters: ParameterDefinition[] = [
  { key: 'model', label: 'Adapter', type: 'select', options: adapterModels, group: 'Module' },
  field('mountSpanX', 'Mounting span X', 'M3 grid · 20 mm', 20, 120, 20),
  field('mountSpanY', 'Mounting row spacing Y', 'M3 grid · 20 mm', 20, 100, 40),
  field('boardWidth', 'PCB width', 'Module fit', 12, 120, 0.5),
  field('boardDepth', 'PCB length / upright height', 'Module fit', 8, 120, 0.5),
  field('boardThickness', 'PCB thickness', 'Module fit', 0.6, 3.2, 0.1),
  field('seatHeight', 'PCB support height', 'Module fit', 6, 30, 0.5),
  field('clearance', 'Side clearance', 'Module fit', 0.15, 1, 0.05),
];
