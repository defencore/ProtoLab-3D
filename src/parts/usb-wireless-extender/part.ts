import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/electronics/assembly';
import {
  defaults,
  parameters,
  catalogSelection,
  catalogFilterFields,
  usbExtenderModel,
} from './configurator';
import { usbExtenderPieces, usbExtenderInterface } from './lib/model';
import presets from './presets.json';
import product from './product.json';

export { usbExtenderInterface } from './lib/model';

const part: PartDefinition = {
  id: 'usb-wireless-extender',
  name: 'Wireless USB extender',
  category: 'ELECTRONICS & VISION',
  subgroup: 'FLIGHT CONTROLLERS',
  icon: 'circuit',
  description:
    'SpeedyBee F405 WING MINI USB / Wireless Extender, transferred from the current project with its board and underside component envelopes.',
  complexity: 'Fixed project installation reference',
  keywords: ['SpeedyBee', 'F405', 'WING MINI', 'USB', 'Wireless Extender', 'WiFi', 'service board'],
  product: product as ProductProfile,
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
      label: 'Assembled',
      description:
        'Seven source visualization solids in the installed local frame; cables and mounting hardware excluded.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'The same seven visualization solids separated along Z for inspection; one supplied accessory remains one unit.',
    },
  ],
  validate(p, state) {
    return p.model !== usbExtenderModel ||
      Object.keys(p).some((key) => key !== 'model') ||
      !['assembled', 'exploded'].includes(state)
      ? ['Select the fixed SpeedyBee extender and a supported inspection state.']
      : [];
  },
  buildGeometry: (_, state) => assembly.geometry(usbExtenderPieces(state)),
  dimensions: (_, state) => assembly.dimensions(usbExtenderPieces(state)),
  python: (_, state) =>
    [
      assembly.python(usbExtenderPieces(state)),
      `component_metadata = [dict(SourceGeometrySHA256=${JSON.stringify(usbExtenderInterface.sourceWorldSha256)}, SourceGeometryScope="User project installation reconstruction; not manufacturer CAD") for _ in components]`,
    ].join('\n'),
  notes:
    'Local XY is the PCB center and Z=0 its underside. The underside SMD projects 1.5 mm below that datum; total installed envelope is 24.5 × 21.5 × 7 mm. The source records user-confirmed envelope and 16 mm mounting pitch. PCB thickness, 2.7 mm bores, 2.8 mm edge offset and all individual component shapes/positions remain fitting assumptions. This is the separate supplied service board, not the FC/PDB stack or another complete flight-controller kit. Confirm whether it is ordered separately or supplied within the same kit before procurement. Loose cables, screws, nuts and host seating parts are separate.',
  sources: [
    {
      label: 'SpeedyBee F405 WING MINI manufacturer identity and manual',
      url: 'https://www.speedybee.com/f405-wing-mini-download/',
    },
  ],
};
export default part;
