import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogSelection, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'electrical-connector',
  name: 'AMASS power connectors',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'POWER & INDUSTRIAL',
  icon: 'circuit',
  description:
    'Purchasable XT30U, XT60, XT60U, XT60H, XT90H and MR60 connectors, each with male and female contacts and manufacturer outline dimensions.',
  complexity: 'Fixed manufacturer dimensions',
  keywords: [
    'power and industrial connector',
    'electrical connector',
    'AMASS',
    'XT30',
    'XT90',
    'XT60',
    'MR60',
    'power plug',
    'male',
    'female',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection,
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Separate housing, contacts and rear cover where supplied.',
    },
    { id: 'exploded', label: 'Exploded', description: 'Axially separated physical components.' },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model)) errors.push('Select a supported AMASS model.');
    if (Object.keys(p).some((k) => !['model', 'detail'].includes(k)))
      errors.push('Manufacturer dimensions are fixed; select another model.');
    if (!['assembled', 'exploded'].includes(state)) errors.push('Choose a valid model state.');
    if (!['envelope', 'detailed'].includes(String(p.detail)))
      errors.push('Choose a valid detail level.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'M/F refers to metal pins and sockets. Overall dimensions follow AMASS drawings; undimensioned contact spacing, wall thickness, keys and cover details are reconstructed. These are assembly reference models, not tolerance-controlled mating tools. XT60-F uses the 2025V0 width of 15.5 mm; H and MR60 envelopes include the illustrated rear cover.',
  sources: [...new Set(models.map((m) => m.source))].map((url) => ({
    label: 'AMASS · manufacturer dimension drawing',
    url,
  })),
};
export default part;
