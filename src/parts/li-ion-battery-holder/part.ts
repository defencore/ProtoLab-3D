import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { models, selected, geometry, dimensions, python } from './lib/model';
import presets from './presets.json';
import product from './product.json';

const part: PartDefinition = {
  id: 'li-ion-battery-holder',
  name: '18650 battery holder',
  browseFamily: { id: 'battery-holders', label: 'Battery holders', primary: true },
  product: product as ProductProfile,
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'BATTERIES & HOLDERS',
  icon: 'circuit',
  complexity: '2, 3 or 4 cells · supplier models',
  description:
    'Open 18650 holders with spring contacts: 2S, 3S and 4S versions, plus MPD holders with independent PCB contacts. All models omit wires.',
  keywords: [
    '18650',
    'battery',
    'holder',
    'cell',
    '2S',
    '3S',
    '4S',
    '2S1P',
    '3S1P',
    '4S1P',
    'BeiLaMoo',
    'MPD',
    'spring',
    'BH18650',
    'BK-18650',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model', label: 'Holder model' }],
  catalogFilterFields,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Empty holder with its spring contacts, without wires.',
    },
    {
      id: 'exploded',
      label: 'Separate components',
      description: 'Inspect the housing and spring contacts as one purchased unit.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model)) errors.push('Choose a supported 18650 holder.');
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Choose assembly or component inspection.');
    for (const key of Object.keys(p))
      if (!parameters.some((field) => field.key === key))
        errors.push('Holder dimensions are fixed; unsupported parameter: ' + key + '.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  assessment(p) {
    const m = selected(p);
    return [
      `${m.cells} × 18650 · ${m.circuit === 'Independent' ? 'independent cell contacts' : m.circuit + ' series connection listed by the supplier'}.`,
      `Body: ${m.length} × ${m.width} × ${m.height} mm. Batteries and mounting screws are selected separately.`,
      ...(m.wired
        ? [
            'Wires are omitted from the model. The body is a reconstruction of the published envelope; check the hole pattern on the delivered holder before cutting an enclosure.',
          ]
        : [
            'Original MPD CAD with independent contacts and PCB pins extending 3.2 mm below the body. The drawing specifies 2-56 mounting screws in the diameter 3.2 mm holes.',
          ]),
    ];
  },
  notes:
    'BeiLaMoo wire-lead products are modelled without wires. They reproduce published outer dimensions using MPD geometry as a declared installation reference, with inferred wire exits and removed PCB tails. They are reconstructions, not BeiLaMoo manufacturer CAD; fine moulding details and mounting-hole patterns require verification. Series connection follows the written catalogue specification; the maker reuses a photograph marked parallel, so confirm the ordered electrical execution. Wires, internal bus routing, solder joints and batteries are omitted. MPD versions retain the original STEP housing and independent contacts after a rigid coordinate transform. No contact-current rating is inferred from the CAD.',
  sources: models.map((m) => ({ label: m.manufacturer + ' ' + m.designation, url: m.source })),
};
export default part;
