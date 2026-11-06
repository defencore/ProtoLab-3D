import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { defaults, parameters } from './configurator';
import {
  platformComposition,
  platformGeometry,
  platformPython,
  platformDimensions,
} from './lib/model';
import product from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'recovery-electronics-platform',
  name: 'Recovery electronics platform',
  category: 'ELECTRONICS MOUNTS',
  subgroup: 'MODULE ADAPTERS',
  icon: 'bracket',
  preview: 'worker',
  description:
    'Current source seating layout for ZX908, the project JHE42B reference and SpeedyBee USB extender, with separate lower platform, flat upper disc and four GPS retainers.',
  complexity: 'Transferred source seating study',
  keywords: [
    'GPS',
    'ZX908',
    'JHE42B',
    'buzzer',
    'USB',
    'Wireless Extender',
    'F405 WING MINI',
    'recovery',
    'platform',
    'holder',
    'PEM',
  ],
  product: product as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  catalogSelection: [{ key: 'model' }],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'Current source module and mounting-detail placements; supporting posts, screws, nuts and ties excluded.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Separate module, retainer and upper-disc layers for inspection; canonical component identities and placements are preserved.',
    },
  ],
  validate(p, state) {
    return p.model !== 'pem-current' ||
      Object.keys(p).some((key) => key !== 'model') ||
      !['assembled', 'exploded'].includes(state)
      ? ['Select the current source layout and a supported inspection state.']
      : [];
  },
  buildGeometry: (_, state) => platformGeometry(state),
  python: (_, state) => platformPython(state),
  dimensions: (_, state) => platformDimensions(state),
  composition: () => platformComposition(),
  notes:
    'Source faithful seating study with nine physical occurrences and reusable library definitions. The latest stack overlay is authoritative. Lower underside is local Z=0; original world Z=155. All inspection offsets remain outside physical composition. The JHE42B project box and GPS compliant retainers remain references. This study excludes supporting posts, screws, nuts, ties, cables, controller and enclosure; it does not establish a complete retained assembly or production readiness. Select each module and mounting detail separately in the library.',
};
export default part;
