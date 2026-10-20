import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogSelection, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/mechanical/assembly';
const part: PartDefinition = {
  id: 'electrical-connector',
  product: productData as ProductProfile,
  name: 'AMASS power connectors',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'POWER & INDUSTRIAL',
  icon: 'circuit',
  description:
    'Purchasable AMASS cable and panel connectors, vertical XT30UPB PCB connectors and right-angle XT60PW-M30/F30 PCB connectors with manufacturer outline and installation dimensions.',
  complexity: 'Fixed manufacturer dimensions',
  keywords: [
    'power and industrial connector',
    'electrical connector',
    'AMASS',
    'XT30',
    'XT90',
    'XT60',
    'MR60',
    'XT60E-F',
    'XT60E-M',
    'XT90E-M',
    'panel mount',
    'flange',
    'XT30UPB',
    'XT60PW',
    'XT60PW-M30',
    'XT60PW-F30',
    'PCB',
    'through hole',
    'right angle',
    'power plug',
    'male',
    'female',
  ],
  defaults,
  parameters,
  // JSON inference adds optional undefined fields across the distinct catalog rows.
  // Catalog validation checks each serialized row and its actual attributes.
  presets: presets as unknown as Preset[],
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
    'M/F refers to metal pins and sockets. Overall dimensions follow AMASS drawings; undimensioned contact spacing, wall thickness, keys and cover details are reconstructed. Panel E versions retain the documented flange, mounting centres, holes and recommended cutout dimensions; Z=0 is the rear flange/gasket face. XT60E-F includes its illustrated gasket with reconstructed thickness. Threads are smooth nominal bores. XT30UPB uses PCB plane Z=0 with 3 mm straight tails toward -Z. Right-angle XT60PW-M30/F30 uses PCB plane Y=0 with 3 mm power tails and 3.5 mm hold-down tabs toward -Y. Its filtered Y height includes the tabs. Mating is +Z for every model. PCB pin centres and recommended board-hole/slot dimensions follow the selected drawing; actual tail diameter and detailed contact retention are reconstructed. No wires, PCB or screws are included. These are assembly references, not tolerance-controlled mating tools. XT60-F uses the 2025V0 width of 15.5 mm; H and MR60 envelopes include the illustrated rear cover.',
  sources: [...new Set(models.map((m) => m.source))].map((url) => ({
    label: 'AMASS · manufacturer dimension drawing',
    url,
  })),
};
export default part;
