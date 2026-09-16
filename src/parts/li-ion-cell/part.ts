import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'li-ion-cell',
  name: 'Li-ion cylindrical cell',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'RECHARGEABLE CELLS',
  icon: 'circuit',
  complexity: 'Fixed manufacturer models',
  description:
    'Li-ion cells \u00b7 18650 / 21700 with fixed source dimensions and separate capacity / discharge ratings.',
  keywords: [
    'battery',
    'batteries',
    'акумулятор',
    'батарея',
    'батарейки',
    '18650',
    '21700',
    'Molicel',
    'Li-ion',
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
    'Maximum cell envelopes from current manufacturer product pages. Flat-top unprotected cells only; protected and button-top versions have different lengths. Cap, gasket and rolled-rim details are approximate. Electrical ratings require the linked model datasheet conditions; no internal cell construction is modeled.',
  sources: [
    ...new Map(
      models.map((m) => [m.source, { label: m.manufacturer + ' — ' + m.name, url: m.source }]),
    ).values(),
  ],
};
export default part;
