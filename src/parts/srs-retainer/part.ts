import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { geometry, python, dimensions } from './lib/model';
const part: PartDefinition = {
  id: 'srs-retainer',
  name: 'SRS squib retainer',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'SRS AIRBAG',
  icon: 'circuit',
  complexity: 'AK-1 / AK-2 mating inserts',
  description:
    'Keyed inserts on the device side of a squib connection. TE AK II manufacturer CAD and an Aptiv AK-1 dimensional reference.',
  keywords: [
    'SRS',
    'airbag',
    'squib',
    'igniter',
    'initiator',
    'retainer',
    'receptacle',
    'pocket',
    'holder',
    'AK1',
    'AK2',
    'AK II',
    'Amphenol',
    'CA281A',
    'CA282B',
    'JST',
    'SQXW',
    'ISO 19072',
    'mating part',
    'insert',
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
      label: 'Retainer',
      description: 'Device-side insert only. The holder and initiator are separate parts.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!presets.some((row) => row.parameters.model === p.model))
      errors.push('Select a supported retainer.');
    if (Object.keys(p).some((key) => key !== 'model'))
      errors.push('Retainer geometry is fixed by the selected reference.');
    if (state !== 'assembled') errors.push('Select the retainer state.');
    return errors;
  },
  buildGeometry: geometry,
  python,
  dimensions,
  notes:
    'A connector mates with the pocket in a squib holder, through a keyed retainer; the initiator supplies the male contacts. Retainers are not complete igniters or metal holders. AK-1 and AK-2 are different interfaces: diameter alone does not establish compatibility. TE customer-view STEP solids are preserved, including their key differences and ears. No separate shorting-clip mechanism or male pins are added. Aptiv is an approximate dimensional sample, not a tolerance-controlled key. Existing connector reconstructions have unverified mating details; no automatic mating or certified fit is claimed. ISO 19072-2 specifies testing, not pocket dimensions. See the reference guide for the applicable parts of the standard.',
  sources: [
    {
      label: 'Interface guide and compatibility scope',
      url: '',
    },
    { label: 'TE 1823640 customer drawing', url: 'https://www.te.com/en/product-1-1823640-1.html' },
    { label: 'Aptiv AK-1 retainer', url: 'https://www.aptiv.com/docs/default-source/ecat-docs/ak-1-retainers-a4-web.pdf?Status=Master&sfvrsn=b2a5623c_3' },
    {
      label: 'ISO 19072-1:2019 · pocket definition',
      url: 'https://www.iso.org/standard/71992.html',
    },
    { label: 'ISO 19072-4:2019 · type 2 assembly', url: 'https://www.iso.org/standard/71946.html' },
  ],
};
export default part;
