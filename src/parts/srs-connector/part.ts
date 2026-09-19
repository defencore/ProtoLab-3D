import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'srs-connector',
  name: 'SRS squib connector',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'SRS AIRBAG',
  icon: 'circuit',
  complexity: 'Fixed supplier models',
  description:
    'JST SQXW, Amphenol and TE AK II squib connectors with two or three contacts, CPA locks and pigtail leads.',
  keywords: [
    'SRS',
    'airbag',
    'squib',
    'pigtail',
    'CPA',
    'JST',
    'SQXW',
    'Amphenol',
    'CA281A',
    'CA282B',
    'TE Connectivity',
    'AK II',
    'AKII',
    'AKII+',
    'connector',
  ],
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Connector with illustrative leads; colors do not indicate polarity.',
    },
    {
      id: 'exploded',
      label: 'Exploded inspection',
      description:
        'Separate housing, cover, CPA and contacts. Inspection offsets are not operating travel.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model)) errors.push('Select a supported connector.');
    for (const [key, min, max] of [
      ['leadLength', 0, 150],
      ['wireDiameter', 1, 1.6],
    ] as const)
      if (
        typeof p[key] !== 'number' ||
        !Number.isFinite(p[key]) ||
        Number(p[key]) < min ||
        Number(p[key]) > max
      )
        errors.push(`${key} must be between ${min} and ${max} mm.`);
    for (const key of Object.keys(p))
      if (!['model', 'leadLength', 'wireDiameter'].includes(key))
        errors.push(`Connector dimensions are fixed; unsupported parameter: ${key}.`);
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Select a supported assembly state.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  notes:
    'Dimensioned manufacturer drawings anchor the connector envelopes. Small latches, key tolerances, wall thicknesses and contact details are approximate; JST assembled offsets are also estimated. These are mechanical layout references, not certified mating or replacement SRS hardware. Amphenol family codes do not specify ordering suffixes. Leads have illustrative colors and no electrical pinout. Separate mating retainers are not included in these connector models. TE contact positions, nozzle and locking details are illustrative; the brochure dimensions only the outer envelope.',
  sources: [
    ...new Map(
      models.map((m) => [
        m.source,
        {
          label:
            m.manufacturer +
            ' ' +
            (m.family === 'sqxw'
              ? 'SQXW'
              : m.family === 'te-akii'
                ? 'AK II / AK II+'
                : m.family.toUpperCase()) +
            ' drawing',
          url: m.source,
        },
      ]),
    ).values(),
  ],
};
export default part;
