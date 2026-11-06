import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { parameters, defaults, catalogFilterFields, catalogSelection } from './configurator';
import { enclosureModel, enclosureModels } from './lib/catalog';
import {
  geometry,
  python,
  dimensions,
  hasCover,
  exportGeometry,
  exportDimensions,
} from './lib/model';

const part: PartDefinition = {
  id: 'catalog-enclosure',
  product: product as ProductProfile,
  name: 'Catalog enclosures',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  icon: 'box',
  complexity: 'Fixed catalog outside dimensions',
  description:
    'Purchased Altınkaya enclosure families and the Grandado 83 × 58 × 35 mm flanged box with the photographed white screw-fastened lid.',
  keywords: [
    'enclosure',
    'box',
    'case',
    'housing',
    'electronics',
    'project box',
    'Altinkaya',
    'Altınkaya',
    'Grandado',
    'waterproof',
    'clear cover',
    'DIN rail',
    'panel mount',
    'wall mount',
    'handheld',
    'desktop',
    'rack',
  ],
  parameters,
  defaults,
  catalogSelection,
  catalogFilterFields,
  catalogSelectionOnly: true,
  // These installed physical configurations omit the supplied lid; procurement remains one source SKU.
  physicalStates: ['body-only', 'body-with-screws'],
  presetMatchKeys: ['model'],
  presets: presets as unknown as Preset[],
  catalogSortOptions: [
    {
      key: 'volume',
      label: 'Smallest outside volume',
      direction: 'asc',
      productOf: ['length', 'width', 'height'],
    },
    { key: 'length', label: 'Smallest outside A', direction: 'asc' },
    { key: 'width', label: 'Smallest outside B', direction: 'asc' },
    { key: 'height', label: 'Smallest outside C', direction: 'asc' },
  ],
  states: [
    {
      id: 'assembled',
      label: 'Closed / body view',
      description: 'Body and cover in place; modeled fastening hardware remains assembled.',
    },
    {
      id: 'open',
      label: 'Cover lifted',
      description:
        'Lift the cover and its modeled screws to inspect the body and mounting features.',
      availableWhen: (p) => hasCover(enclosureModel(p.model)),
    },
    {
      id: 'body-only',
      label: 'Grandado body without cover',
      description: 'Body and brass inserts for installation with a replacement cover.',
      availableWhen: (p) => p.model === 'grandado-83-58-35-clear',
    },
    {
      id: 'body-with-screws',
      label: 'Grandado body and cover screws',
      description:
        'Original body, inserts and four original screws; the supplied flat lid is omitted for a replacement-cover installation.',
      availableWhen: (p) => p.model === 'grandado-83-58-35-clear',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!enclosureModels.some((model) => model.id === p.model))
      errors.push('Select a supported enclosure model.');
    if (Object.keys(p).some((key) => key !== 'model'))
      errors.push('Catalog dimensions are fixed; choose a different enclosure model.');
    if (!['assembled', 'open', 'body-only', 'body-with-screws'].includes(state))
      errors.push('Choose a valid enclosure state.');
    if (['body-only', 'body-with-screws'].includes(state) && p.model !== 'grandado-83-58-35-clear')
      errors.push('The replacement-cover body view is available only for Grandado.');
    if (
      state === 'open' &&
      enclosureModels.some((model) => model.id === p.model) &&
      !hasCover(enclosureModel(p.model))
    )
      errors.push('This open-top model has no cover to lift.');
    return errors;
  },
  buildGeometry: geometry,
  buildExportGeometry: exportGeometry,
  exportDimensions,
  python,
  dimensions,
  notes:
    'Grandado retains the published 83 ×58 ×35 mm nominal closed body envelope. Delivered-sample measurements establish the 22 mm lower hard-body height, 1.8 mm raised rim, 23.8 mm body including rim and 6 mm ears. Its analytic dogleg rim has an approximately uniform 1 mm wall; the corner/post shape,2 mm backing ledge, deeper cavity and original-lid internals remain inferred. The 110 mm modeled length including ears, pitch, PCB bosses and screw/insert dimensions remain estimates; upper insert/bore estimates follow the hard seating datum. The factory screw geometry and single supplier identity remain unchanged. The retailer title says clear while its gallery shows opaque white. Grandado exports the closed physical assembly during lifted-lid inspection. Other catalog models retain illustrative shells and covers matching their published envelopes. Confirm actual interfaces before production; an article IP rating does not certify this reconstruction or a modified enclosure.',
  sources: [
    {
      label: 'Altınkaya · enclosure categories',
      url: 'https://www.altinkaya.com/en/categories/enclosures',
    },
    {
      label: 'Grandado · 83 × 58 × 35 mm clear-cover project box',
      url: 'https://gbr.grandado.com/products/2pcs-83x58x35-mm-waterproof-clear-cover-plastic-electronic-cable-project-box-instrument-enclosure-case-white',
    },
  ],
};

export default part;
