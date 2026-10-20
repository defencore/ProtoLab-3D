import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import data from './presets.json';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { validateStandoff, geometry, python, dimensions } from './lib/model';
const presets = data as Preset[];
const part: PartDefinition = {
  id: 'pcb-standoff',
  browseFamily: { id: 'spacers-standoffs', label: 'Spacers & standoffs', primary: true },
  product: profile as ProductProfile,
  name: 'PCB spacer and standoff',
  category: 'FASTENERS & THREADS',
  subgroup: 'SPACERS & STANDOFFS',
  icon: 'bolt',
  description:
    'Supplier-qualified round and hex PCB spacers and female/female, male/female or male/male standoffs.',
  complexity: 'Fixed supplier SKU',
  keywords: [
    'PCB',
    'spacer',
    'standoff',
    'bushing',
    'female',
    'male',
    'metric',
    'UNC',
    'DREMEC',
    'Kosmodrom',
  ],
  defaults,
  parameters,
  presets,
  catalogSelectionOnly: true,
  catalogFilterFields,
  presetMatchKeys: ['catalogItem'],
  validate: (p) => validateStandoff(p, presets),
  buildGeometry: (p) => geometry(p),
  python: (p) => python(p),
  dimensions,
  notes:
    'A fixed supplier installation model. Simple keeps nominal thread envelopes and drawing/source notes; Full models only explicitly authored thread pitch and spans. Unpublished blind-hole depths remain distinct, visibly open installation envelopes and are never assigned invented manufacturing callouts. Self-tapping openings remain smooth pilot envelopes. Metric/UNC labels identify the source interface; authored helical profiles do not establish a certified fit class. Appearance is illustrative. Exact supplier article, material, coating, dimensions and limitations remain attached to the selected catalog item.',
};
export default part;
