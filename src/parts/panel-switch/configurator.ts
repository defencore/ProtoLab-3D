import type { ParameterDefinition, Parameters } from '../../core/types';
import { daierColours, models } from './lib/catalog';
export const defaults: Parameters = {
  model: 'ck-7101syzqe',
  position: 'first',
  guard: 'closed',
  colour: 'red',
  panelThickness: 0.3,
  mountingHardware: 'standard',
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Switch model',
    type: 'select',
    group: 'Model',
    options: models.map((m) => ({ value: m.id, label: m.name })),
  },
  {
    key: 'colour',
    label: 'LED / transparent plastic colour',
    type: 'select',
    group: 'Model',
    filterable: false,
    options: daierColours.map(({ value, label }) => ({ value, label })),
    visibleWhen: (p) => models.find((m) => m.id === p.model)?.illuminated === true,
    description:
      'Manufacturer-listed red, green, yellow or blue LED. The SAC-01 transparent plastic has the same colour on the paired product.',
  },
  {
    key: 'mountingHardware',
    label: 'Mounting hardware',
    type: 'select',
    group: 'Mounting',
    filterable: false,
    options: [
      { value: 'standard', label: 'Both nuts and lower washer' },
      { value: 'upper-only', label: 'Upper nut only' },
    ],
    visibleWhen: (p) => p.model === 'daier-asw-07d',
    description:
      'Upper nut only removes the loose lower washer and retaining nut for assemblies with their own supporting case seat. The switch case, bushing, actuator and terminals remain fixed.',
  },
  {
    key: 'panelThickness',
    label: 'Panel thickness',
    type: 'number',
    unit: 'mm',
    min: 0.3,
    max: 4,
    step: 0.1,
    group: 'Mounting',
    filterable: false,
    visibleWhen: (p) => p.model === 'daier-asw-07d',
    description:
      'Sets the upper nut seat to Z = 3 mm + this value. With standard hardware, the panel rear face sits above the lower nut at Z = 3 mm. Upper-nut-only assemblies provide their own supporting seat.',
  },
  {
    key: 'position',
    label: 'Actuator position',
    type: 'select',
    group: 'Position',
    filterable: false,
    options: [
      { value: 'first', label: 'First / released' },
      { value: 'center', label: 'Center' },
      { value: 'last', label: 'Last / pressed' },
    ],
    description:
      'Mechanical inspection pose. A momentary switch does not remain pressed without external force.',
  },
  {
    key: 'guard',
    label: 'Protective cover',
    type: 'select',
    group: 'Position',
    filterable: false,
    options: [
      { value: 'closed', label: 'Closed' },
      { value: 'open', label: 'Open' },
    ],
    visibleWhen: (p) => models.find((m) => m.id === p.model)?.guarded === true,
    description:
      'Closed cover holds the toggle in its first position. Open cover rotates around the fixed hinge.',
  },
];
const options = (values: string[]) =>
  [...new Set(values)].map((value) => ({ value, label: value }));
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    type: 'select',
    group: 'Identity',
    options: options(models.map((m) => m.manufacturer)),
  },
  {
    key: 'actuation',
    label: 'Actuator',
    type: 'select',
    group: 'Switch',
    catalogSummary: true,
    options: options(models.map((m) => m.actuation)),
  },
  {
    key: 'behavior',
    label: 'Action',
    type: 'select',
    group: 'Switch',
    catalogSummary: true,
    options: options(models.map((m) => m.behavior)),
  },
  {
    key: 'circuit',
    label: 'Circuit',
    type: 'select',
    group: 'Switch',
    catalogSummary: true,
    options: options(models.map((m) => m.circuit)),
  },
  { key: 'positions', label: 'Positions', type: 'number', unit: '', group: 'Switch' },
  { key: 'terminalCount', label: 'Terminals', type: 'number', unit: '', group: 'Connection' },
  {
    key: 'termination',
    label: 'Termination',
    type: 'select',
    group: 'Connection',
    options: options(models.map((m) => m.termination)),
  },
  {
    key: 'mounting',
    label: 'Mounting',
    type: 'select',
    group: 'Mounting',
    options: options(models.map((m) => m.mounting)),
  },
  {
    key: 'mountDiameter',
    label: 'Round panel opening',
    type: 'number',
    unit: 'mm',
    group: 'Mounting',
    catalogSummary: true,
  },
  {
    key: 'cutoutLength',
    label: 'Rectangular opening length',
    type: 'number',
    unit: 'mm',
    group: 'Mounting',
  },
  {
    key: 'cutoutWidth',
    label: 'Rectangular opening width',
    type: 'number',
    unit: 'mm',
    group: 'Mounting',
  },
  { key: 'guarded', label: 'Protective cover included', type: 'boolean', group: 'Switch' },
];
