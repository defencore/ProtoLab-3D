import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import presets from './presets.json';

export const defaults: Parameters = { model: 'jcg108-3m' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Antenna / cable execution',
    type: 'select',
    group: 'Model',
    options: presets.map((preset) => ({ value: preset.parameters.model, label: preset.name })),
    description:
      'Source drawing offers 3 m and 5 m leads. Connector execution is unspecified; geometry is a nominal housing reference.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];

export const catalogFilterFields: ParameterDefinition[] = [
  ...(
    [
      ['manufacturer', 'Manufacturer', 'Product'],
      ['frequencyBands', 'Published frequency bands', 'RF characteristics'],
      ['connector', 'Published connector options', 'Interface'],
      ['cableType', 'Cable type', 'Interface'],
      ['mounting', 'Mounting', 'Interface'],
      ['radomeMaterial', 'Radome material', 'Product'],
      ['polarization', 'Polarization', 'RF characteristics'],
    ] as const
  ).map(([key, label, group]) => ({
    key,
    label,
    group,
    type: 'select' as const,
    options: [...new Set(presets.map((preset) => preset.catalog.attributes[key]))].map((value) => ({
      value,
      label: value,
    })),
    catalogSummary: key === 'frequencyBands',
  })),
  ...(
    [
      ['leadLength', 'Drawing lead length L', 'mm', 'Interface'],
      ['gain', 'Published zenith gain', 'dBi', 'RF characteristics'],
      ['impedance', 'Nominal impedance', 'ohm', 'RF characteristics'],
      ['bodyLength', 'Housing length (X)', 'mm', 'Housing dimensions'],
      ['bodyHeight', 'Main housing span (Y)', 'mm', 'Housing dimensions'],
      ['overallHeight', 'Housing span including boss (Y)', 'mm', 'Housing dimensions'],
      ['bodyDepth', 'Maximum housing depth (Z)', 'mm', 'Housing dimensions'],
      ['pcbLength', 'Internal PCB length', 'mm', 'Internal PCB dimensions'],
      ['pcbWidth', 'Internal PCB width', 'mm', 'Internal PCB dimensions'],
      ['pcbThickness', 'Internal PCB thickness', 'mm', 'Internal PCB dimensions'],
    ] as const
  ).map(([key, label, unit, group]) => ({
    key,
    label,
    unit,
    group,
    type: 'number' as const,
    min: 0,
    catalogSummary: ['leadLength', 'bodyLength'].includes(key),
  })),
];
