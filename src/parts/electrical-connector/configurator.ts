import type { Parameters, ParameterDefinition, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'xt60-m', detail: 'envelope' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'AMASS connector model',
    type: 'select',
    group: 'Connector selection',
    options: models.map((m) => ({
      value: m.id,
      label: `${m.name} · ${m.sex === 'M' ? 'Male pins' : 'Female sockets'}`,
    })),
    description: 'Fixed manufacturer outline dimensions. M/F describes the metal contacts.',
  },
  {
    key: 'detail',
    label: 'Model detail',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'envelope', label: 'Assembly · housing and contacts' },
      { value: 'detailed', label: 'Detailed · grip and contact slots' },
    ],
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  ...(['family', 'sex'] as const).map((key) => ({
    key,
    label: key === 'family' ? 'Connector series' : 'Contact type',
    type: 'select' as const,
    group: 'Connector selection',
    catalogSummary: true,
    options: [...new Set(models.map((m) => m[key]))].map((value) => ({
      value,
      label: value === 'M' ? 'M · Male pins' : value === 'F' ? 'F · Female sockets' : value,
    })),
  })),
  ...(['pins', 'width', 'height', 'length'] as const).map((key) => ({
    key,
    label: key === 'pins' ? 'Contacts' : `Overall ${key}`,
    type: 'number' as const,
    group: 'Dimensions',
    min: 0,
    max: 50,
    step: 0.01,
    unit: key === 'pins' ? '' : 'mm',
    catalogSummary: true,
  })),
  {
    key: 'mounting',
    label: 'Mounting',
    type: 'select',
    group: 'Connector selection',
    catalogSummary: true,
    options: [
      { value: 'Panel', label: 'Panel flange' },
      { value: 'PCB vertical', label: 'PCB vertical' },
      { value: 'PCB right angle', label: 'PCB right angle' },
    ],
  },
  ...(['mountPitch', 'mountDiameter', 'flangeThickness'] as const).map((key) => ({
    key,
    label:
      key === 'mountPitch'
        ? 'Mounting centres'
        : key === 'mountDiameter'
          ? 'Mounting bore'
          : 'Flange stack',
    type: 'number' as const,
    group: 'Dimensions',
    min: 0,
    max: 50,
    step: 0.01,
    unit: 'mm',
    catalogSummary: true,
  })),
  ...(
    [
      ['contactPitch', 'PCB contact pitch'],
      ['pcbHoleDiameter', 'Recommended power hole'],
      ['pinProjection', 'Power tail projection'],
      ['pcbHoldPitch', 'Hold-down centres'],
      ['pcbRowOffset', 'PCB row separation'],
      ['pcbSlotWidth', 'Recommended slot width'],
      ['pcbSlotLength', 'Recommended slot length'],
      ['pcbTabProjection', 'Hold-down projection'],
    ] as const
  ).map(([key, label]) => ({
    key,
    label,
    type: 'number' as const,
    group: 'PCB mounting',
    min: 0,
    max: 50,
    step: 0.01,
    unit: 'mm',
  })),
];
