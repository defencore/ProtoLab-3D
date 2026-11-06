import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import { geometry, python, dimensions } from './lib/model';

export { mountingLayout } from './lib/layout';

const part: PartDefinition = {
  id: 'recovery-electronics-mount',
  browseLabel: 'Recovery electronics mounting detail',
  name: 'Recovery electronics locating platform and disc',
  category: 'ELECTRONICS MOUNTS',
  subgroup: 'MODULE ADAPTERS',
  icon: 'bracket',
  preview: 'worker',
  product: product as ProductProfile,
  complexity: 'Fixed source mounting details',
  description:
    'Separate current GPS Tracker ZX908, JHE42B and SpeedyBee USB extender mounting details: integrated lower locator, flat upper retaining disc and exact compliant GPS retainers.',
  keywords: [
    'GPS',
    'ZX908',
    'JHE42B',
    'buzzer',
    'USB extender',
    'SpeedyBee',
    'F405 WING MINI',
    'holder',
    'mount',
    'recovery',
    'search platform',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  catalogSelection: [{ key: 'model' }],
  validate(p, state) {
    return Object.keys(p).some((key) => key !== 'model') ||
      !presets.some((preset) => preset.id === p.model) ||
      state !== 'default'
      ? ['Select a fixed source mounting detail in its physical state.']
      : [];
  },
  buildGeometry: (p) => geometry(p),
  python: (p) => python(p),
  dimensions: (p) => dimensions(p),
  notes:
    'Faithful reconstruction of the user project current R06 assembly: analytic plates and exact retained native BREP for the GPS compliant retainers. Both plates retain local XY at the tube axis and underside Z=0; retainer local XY is its footprint centre and Z=0 is its underside. The lower platform contains 2 mm locator walls and integral USB supports; the upper disc is a flat 3 mm sheet. Electronics, ties, posts, screws and nuts are separate items. GPS retainer material and compression remain provisional. Source dimensions do not establish manufacturing tolerances, actual connector fit, cable access or a flight load rating. See GUIDE.md and source-record.json for revision and verification evidence.',
};
export default part;
