import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import models from './lib/models.json';
export const defaults: Parameters = { model: 'leland-82122' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Cartridge model',
    type: 'select',
    group: 'Cartridge selection',
    options: models.map((m) => ({ value: m.id, label: m.name })),
    description: 'Fixed manufacturer dimensions. Grams refer to the CO₂ charge, not gross weight.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  ...(['neckType', 'connection'] as const).map((key) => ({
    key,
    label: key === 'neckType' ? 'Neck type' : 'Neck connection',
    type: 'select' as const,
    group: 'Cartridge selection',
    options: [
      ...new Set(
        models.map((m) =>
          key === 'neckType' ? (m.tpi ? 'Threaded' : 'Unthreaded') : m.connection,
        ),
      ),
    ].map((v) => ({ value: v, label: v })),
    catalogSummary: true,
  })),
  ...(
    [
      ['gasMass', 'CO₂ fill mass', 'g', 45],
      ['diameter', 'Body diameter', 'mm', 40],
      ['length', 'Overall length', 'mm', 150],
      ['neckDiameter', 'Neck diameter', 'mm', 20],
      ['neckLength', 'Neck length', 'mm', 20],
      ['tpi', 'Threads per inch', 'TPI', 24],
      ['pitch', 'Thread pitch', 'mm', 2],
    ] as const
  ).map(([key, label, unit, max]) => ({
    key,
    label,
    unit,
    type: 'number' as const,
    min: 0,
    max,
    step: 0.01,
    group: 'Dimensions',
    catalogSummary: ['gasMass', 'diameter', 'length'].includes(key),
  })),
];
