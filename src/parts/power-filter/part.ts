import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/electronics/assembly';
const part: PartDefinition = {
  id: 'power-filter',
  name: 'Power supply filter',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'POWER FILTERS',
  icon: 'circuit',
  product: product as ProductProfile,
  description:
    'iFlight LC power filter; fixed board installation reference with undimensioned connector and lead details.',
  complexity: 'Fixed supplier installation reference',
  keywords: ['LC', 'filter', 'iFlight', 'power', 'supply', 'noise'],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogFilterFields: [
    {
      key: 'manufacturer',
      label: 'Manufacturer / supplier',
      type: 'select',
      group: 'Supplier',
      options: [{ value: 'iFlight', label: 'iFlight' }],
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
    return p.model !== 'iflight-lc-filter-16x6' ||
      Object.keys(p).some((key) => key !== 'model') ||
      state !== 'assembled'
      ? ['Select the supported fixed model and assembled state.']
      : [];
  },
  buildGeometry: () => assembly.geometry(pieces()),
  python: () => assembly.python(pieces()),
  dimensions: () => assembly.dimensions(pieces()),
  notes:
    'Selected seller version with an adopted 16 \u00d7 6 \u00d7 3 mm external envelope. The 1 mm PCB thickness, 0.35 mm corners and central 10 \u00d7 4 \u00d7 2 mm component volume are unverified. Native Z0 is the assumed board underside. No mounting holes, terminal coordinates or wire geometry are invented. Do not substitute the larger current iFlight revision without checking its fit. Confirm the delivered revision, copper-free retaining lands, solder joints, insulation and component height. The model does not qualify filter behavior, electrical ratings or the completed circuit.',
  sources: [
    {
      label: 'Selected supplier listing',
      url: 'https://prom.ua/p2956989595-filtr-pitaniya-iflight.html',
    },
  ],
};
export default part;
