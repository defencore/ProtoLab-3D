import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import { adapterGeometry, adapterPython, adapterDimensions, validateAdapter } from './lib/model';

const part: PartDefinition = {
  id: 'electronics-module-adapter',
  browseLabel: 'Electronic module adapter',
  name: 'Electronic module adapters',
  category: 'ELECTRONICS MOUNTS',
  subgroup: 'MODULE ADAPTERS',
  icon: 'bracket',
  preview: 'worker',
  product: product as ProductProfile,
  description:
    'Separate printable horizontal cradles and braced upright stands for a 20 mm M3 grid, with fitted HAT, Heltec, ADS1220, BEC and LC variants.',
  complexity: '20 mm M3 modular interface',
  keywords: [
    'adapter',
    'module',
    'PCB',
    'mount',
    'bracket',
    'holder',
    'grid',
    'M3',
    '20mm',
    'horizontal',
    'vertical',
    'HAT',
    'LoRa32',
    'Heltec',
    'ADS1220',
    'CJMCU-1220',
    'DC-DC',
    'BEC',
    'LC',
    'filter',
    'replaceable',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: [
    'model',
    'mountSpanX',
    'mountSpanY',
    'boardWidth',
    'boardDepth',
    'boardThickness',
    'seatHeight',
    'clearance',
  ],
  updateParameters(p, key) {
    if (key !== 'model') return p;
    if (!String(p.model).startsWith('universal-')) return { ...defaults, model: p.model };
    return p;
  },
  validate: validateAdapter,
  buildGeometry: adapterGeometry,
  python: adapterPython,
  dimensions: adapterDimensions,
  notes:
    'A manufactured insulating adapter, without PCB, screws, nuts or straps. Fitted variants reuse the exact authored case-adapter recipe; universal variants expose PCB dimensions and regular mounting spans. The PCB itself is never scaled. Universal seats assume clear PCB edge lands and need physical component, solder, thermal and wiring checks. Ordinary M3 nuts are held against rotation in open-top pockets; keep the unfastened adapter upright and hold nuts during underside screw installation. The 2 mm feet match the case base load stack. Changing the screw length or base interface needs a new engagement check.',
};
export default part;
