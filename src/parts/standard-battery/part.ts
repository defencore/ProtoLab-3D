import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'standard-battery',
  name: 'Primary battery',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'PRIMARY BATTERIES',
  icon: 'circuit',
  complexity: 'Fixed manufacturer models',
  description:
    'Standard batteries \u00b7 AAAA / AAA / AA / CR123A with fixed source dimensions and separate capacity / discharge ratings.',
  keywords: [
    'battery',
    'batteries',
    'акумулятор',
    'батарея',
    'батарейки',
    'AAAA',
    'AAA',
    'AA',
    'CR123A',
    'C',
    'D',
    '9V PP3',
    'CR2032',
    'CR123',
    '4xA',
    '3xA',
    '2xA',
    'Energizer',
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
    'Maximum industry-standard envelopes from Energizer drawings. Button diameters use published maxima and projections use published minima; other rim and gasket details are approximate. The 9V snap center spacing is 12.7 mm (midpoint of 12.45\u201312.95); undimensioned snap diameters are illustrative. No holders or internal chemistry geometry are modeled.',
  sources: [
    ...new Map(
      models.map((m) => [m.source, { label: m.manufacturer + ' — ' + m.name, url: m.source }]),
    ).values(),
  ],
};
export default part;
