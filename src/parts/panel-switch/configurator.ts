import type { ParameterDefinition, Parameters } from '../../core/types';
import { daierColours, ds225CapColours, models } from './lib/catalog';
export const defaults: Parameters = {
  model: 'ck-7101syzqe',
  position: 'first',
  guard: 'closed',
  colour: 'red',
  panelThickness: 0.3,
  mountingHardware: 'standard',
  capColour: 'green',
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
    label: 'Lens / transparent plastic colour',
    type: 'select',
    group: 'Model',
    filterable: false,
    options: daierColours.map(({ value, label }) => ({ value, label })),
    visibleWhen: (p) => {
      const model = models.find((m) => m.id === p.model);
      return model?.illuminated === true || model?.bermHead !== undefined;
    },
    description:
      'DAIER: manufacturer-listed LED and matching SAC-01 plastic. BERM: illustrative red, green, yellow or blue cap appearance; confirm the complete colour and lamp-voltage order code.',
  },
  {
    key: 'capColour',
    label: 'Button cap colour',
    type: 'select',
    group: 'Model',
    filterable: false,
    options: ds225CapColours.map(({ value, label }) => ({ value, label })),
    visibleWhen: (p) => p.model === 'daier-ds-225',
    description:
      'DS-225 cap appearance: green follows the supplied photo; red and black follow the requested controller controls. Illustrative RGB colours do not establish supplier order codes, availability or electrical options.',
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
    visibleWhen: (p) => ['daier-asw-07d', 'daier-ds-225'].includes(String(p.model)),
    description:
      'ASW-07D: sets the upper nut seat to Z = 3 mm + this value. DS-225: keeps the bezel at Z=0 and seats the washer and nut behind the panel at negative Z. Mounting dimensions stay fixed.',
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
    options: options(models.map((m) => m.behavior).filter((value) => value !== 'Unverified')),
  },
  {
    key: 'headShape',
    label: 'Button head shape',
    type: 'select',
    group: 'Switch',
    catalogSummary: true,
    options: options(models.flatMap((m) => (m.bermHead ? [m.bermHead] : []))),
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
    key: 'mountFlatWidth',
    label: 'Panel opening across flats',
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
