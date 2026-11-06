import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/electronics/assembly';
const part: PartDefinition = {
  id: 'li-ion-pack',
  name: 'Li-ion battery pack',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'BATTERIES & HOLDERS',
  icon: 'circuit',
  product: product as ProductProfile,
  description:
    'SYLA LR2170LA 4S1P 21700 Li-ion pack with XT60; fixed supplier envelope with illustrative wrapper and harness details.',
  complexity: 'Fixed supplier installation reference',
  keywords: ['Li-ion', 'SYLA', 'Lishen', 'LR2170LA', '21700', '4S1P', 'XT60', 'battery', 'pack'],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogFilterFields: [
    {
      key: 'manufacturer',
      label: 'Manufacturer / supplier',
      type: 'select',
      group: 'Supplier',
      options: [{ value: 'SYLA / Lishen cells', label: 'SYLA / Lishen cells' }],
    },
  ],
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'One supplied unit; undimensioned internals, loose leads and mating accessories are omitted.',
    },
  ],
  validate(p, state) {
    return p.model !== 'syla-lr2170la-4s1p-xt60' ||
      Object.keys(p).some((key) => key !== 'model') ||
      state !== 'assembled'
      ? ['Select the supported fixed model and assembled state.']
      : [];
  },
  buildGeometry: () => assembly.geometry(pieces()),
  python: () => assembly.python(pieces()),
  dimensions: () => assembly.dimensions(pieces()),
  notes:
    'The supplier listing establishes the assembled pack SKU, 4S1P 21700 configuration and 88 \u00d7 24 \u00d7 74 mm wrapped body. XT60 termination is the selected supplier option; XT90 is a different order option. Native Z0 is the body bottom and X/Y are centered. The 1.5 mm corner radius is illustrative. Internal cells, spot welds, leads and the mating plug are omitted because the source does not dimension their positions or lead lengths. Cable exit, connector sex, bend space and actual wrapped dimensions require the delivered pack. The listed current does not qualify a project harness or protection circuit.',
  sources: [
    {
      label: 'Selected supplier listing',
      url: 'https://syla.com.ua/product/akumulyatorna-zbirka-li-ion-4s1p-21700-lishen-lr2170la-4000-mag-144v-35a-v-odyn-ryad/',
    },
  ],
};
export default part;
