import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { catalogFilterFields, defaults, parameters } from './configurator';
import { dimensions, geometry, models, python, selected } from './lib/model';
import presets from './presets.json';
import product from './product.json';

const part: PartDefinition = {
  id: 'compute-module-carrier',
  name: 'Compute module carrier board',
  product: product as ProductProfile,
  category: 'ELECTRONICS & VISION',
  subgroup: 'SINGLE-BOARD COMPUTERS',
  icon: 'circuit',
  complexity: 'CM5 · carrier boards',
  description:
    'Raspberry Pi Compute Module 5 IO and compact Waveshare carrier boards, with mounting holes and connector envelopes from manufacturer design files. Compute module, cooler, cables and expansion cards are separate.',
  keywords: [
    'Raspberry Pi',
    'RPi',
    'Pi 5',
    'Compute Module 5',
    'CM5',
    'CM5IO',
    'IO board',
    'carrier',
    'baseboard',
    'expansion board',
    'Waveshare',
    'CM5-IO-BASE-A',
    'GPIO',
    'PCIe',
    'M.2',
    'SBC',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model', label: 'Carrier board model' }],
  catalogFilterFields,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Board',
      description: 'Purchased carrier board; compute module and expansion cards excluded.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate visual board and connector envelopes for inspection.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((model) => model.id === p.model))
      errors.push('Select a supported CM5 carrier board.');
    for (const key of Object.keys(p))
      if (key !== 'model')
        errors.push('Carrier dimensions are fixed; unsupported parameter: ' + key + '.');
    if (!['assembled', 'exploded'].includes(state)) errors.push('Select a supported board view.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  assessment(p) {
    const model = selected(p);
    return [
      `${model.name}: ${model.width} × ${model.length} mm PCB. ${model.revision}.`,
      'Select the CM5 separately from Raspberry Pi single-board computer. This carrier model includes neither a compute module nor a cooler, M.2 card, microSD card, case or loose wiring.',
      'PCB mounting bores are separate from the four compute-module mounting bores. Check connector access and the fitted module/cooler clearance when designing an enclosure.',
      model.limitations,
    ];
  },
  notes:
    'Lightweight source-dimension reconstructions. Board outlines, mounting bores and major connector envelopes follow the cited revision of manufacturer design files. Connector cavities, colors and minor electronics are illustrative; signal pins, PCB traces, solder fillets and flexible cables are omitted. These are purchased carrier boards, not printable PCB designs. Do not treat an exploded inspection view as a different bill of materials.',
  sources: models.flatMap((model) => [
    { label: model.manufacturer + ' — ' + model.name, url: model.source },
    ...model.references.map((url) => ({ label: model.name + ' — mechanical source', url })),
  ]),
};
export default part;
