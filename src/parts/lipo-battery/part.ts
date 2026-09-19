import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'lipo-battery',
  name: 'LiPo and LiHV battery pack',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'BATTERY PACKS',
  icon: 'circuit',
  complexity: 'Fixed manufacturer models',
  description:
    'Li-Po / LiHV battery packs with fixed source dimensions and separate capacity / discharge ratings.',
  keywords: [
    'battery',
    'batteries',
    'rechargeable battery',
    'cells',
    '1S1P',
    '2S1P',
    '4S1P',
    '3S1P',
    'LiPo',
    'LiHV',
    '1S',
    '2S',
    '3S',
    '4S',
    'pack',
  ],
  parameters,
  defaults,
  presets: presets as unknown as Preset[],
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'External assembly',
      description: 'Sealed battery exterior; holders, mating contacts and loose cables excluded.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model)) errors.push('Select a supported battery model.');
    for (const key of Object.keys(p))
      if (key !== 'model') errors.push('Manufactured dimensions are fixed: ' + key);
    if (state !== 'assembled') errors.push('Select external assembly.');
    return errors;
  },
  buildGeometry: (p) => assembly.geometry(pieces(p)),
  python: (p) => assembly.python(pieces(p)),
  dimensions: (p) => assembly.dimensions(pieces(p)),
  notes:
    'Published pack dimensions; cables, plugs and balance leads excluded. Wrapper seams, end folds and label regions are illustrative, not dimensioned in the source. Connector type is not specified by this series table. Published C-rate is not a verified harness current rating.',
  sources: [
    ...new Map(
      models.map((m) => [m.source, { label: m.manufacturer + ' — ' + m.name, url: m.source }]),
    ).values(),
  ],
};
export default part;
