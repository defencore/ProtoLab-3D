import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import presets from './presets.json';
export const defaults: Parameters = { model: 'te-akii-1' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Retainer model / key',
    type: 'select',
    group: 'Model',
    options: presets.map((p) => ({ value: p.parameters.model, label: p.name })),
    description:
      'Select the interface family and mechanical key independently of the connector wire exit.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = ['manufacturer', 'interface', 'key'].map(
  (key) => ({
    key,
    label: { manufacturer: 'Manufacturer', interface: 'Interface family', key: 'Mechanical key' }[
      key
    ]!,
    type: 'select',
    group: 'Interface',
    catalogSummary: true,
    options: [
      ...new Set(
        presets.map((p) => p.catalog.attributes[key as 'manufacturer' | 'interface' | 'key']),
      ),
    ].map((value) => ({ value, label: value })),
  }),
);
