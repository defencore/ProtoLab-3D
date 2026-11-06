import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/electronics/assembly';
const part: PartDefinition = {
  id: 'adc-module',
  name: 'Analog input module',
  category: 'ELECTRONICS & VISION',
  subgroup: 'SENSORS & SWITCHES',
  icon: 'circuit',
  product: product as ProductProfile,
  description:
    'CJMCU-1220 ADS1220 analog input board; fixed installation reference with unverified mounting and connector dimensions.',
  complexity: 'Fixed supplier installation reference',
  keywords: ['ADC', 'ADS1220', 'CJMCU-1220', 'SPI', 'analog', 'converter'],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogFilterFields: [
    {
      key: 'manufacturer',
      label: 'Manufacturer / supplier',
      type: 'select',
      group: 'Supplier',
      options: [{ value: 'Unspecified', label: 'Unspecified' }],
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
    return p.model !== 'cjmcu-1220' ||
      Object.keys(p).some((key) => key !== 'model') ||
      state !== 'assembled'
      ? ['Select the supported fixed model and assembled state.']
      : [];
  },
  buildGeometry: () => assembly.geometry(pieces()),
  python: () => assembly.python(pieces()),
  dimensions: () => assembly.dimensions(pieces()),
  notes:
    'Selected purple CJMCU-1220 board. The seller identifies ADS1220 / code 102300-2 but supplies no dimensioned drawing. The adopted 22 \u00d7 21 mm PCB, 1.6 mm thickness, 0.6 mm corner radius and 5 \u00d7 5 \u00d7 1.2 mm illustrative chip are provisional; no mounting holes or pad locations are invented. Native Z0 is the assumed board underside. Loose headers and wires are excluded. Measure the delivered board, component height and soldered harness before fabrication. This is an installation reference, not verified supplier CAD, a pinout or a complete electrical design.',
  sources: [
    {
      label: 'Selected supplier listing',
      url: 'https://prom.ua/p2527653228-bitnyj-analogo-tsifrovoj.html',
    },
  ],
};
export default part;
