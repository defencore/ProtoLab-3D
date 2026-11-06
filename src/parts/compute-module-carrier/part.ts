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
    'Raspberry Pi Compute Module 5 IO and Waveshare carrier boards. CM5-NANO-A/B retain incomplete manufacturer CAD as engineering references with missing connector bodies. Compute module, cooler, cables and expansion cards are separate.',
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
    'CM5-NANO-A',
    'CM5-NANO-B',
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
  validationNotice:
    'NANO models are incomplete CAD references. Resolve missing connector geometry before enclosure design.',
  states: [
    {
      id: 'assembled',
      label: 'Board',
      description: 'Purchased carrier board; compute module and expansion cards excluded.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate the PCB and fitted components for inspection of the purchased board.',
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
      `${model.geometryKind === 'manufacturer-cad' ? 'Incomplete manufacturer CAD engineering reference. ' : ''}${model.name}: ${model.width} × ${model.length} mm PCB. ${model.revision}.`,
      'Select the CM5 separately from Raspberry Pi single-board computer. This carrier model includes neither a compute module nor a cooler, M.2 card, microSD card, case or loose wiring.',
      'Check the selected board outline and mounting features, connector access and fitted module/cooler clearance when designing an enclosure. Do not assume that NANO carriers provide the separate mounting bores of larger IO boards.',
      model.limitations,
    ];
  },
  notes:
    'NANO models retain incomplete manufacturer CAD: CM5 and MIPI connector bodies are missing or misassigned; NANO-B also lacks RJ45, mini HDMI and microSD bodies. Their reported bounds describe retained source shapes and do not establish complete enclosure fit. Other models use source-dimension reconstructions with illustrative connector cavities and minor details. Per-model evidence records source revisions, exclusions and unresolved geometry. Colors are illustrative. Purchased carrier boards exclude the compute module and external accessories. The exploded view preserves the same procurement identity.',
  sources: models.flatMap((model) => [
    { label: model.manufacturer + ' — ' + model.name, url: model.source },
    ...model.references.map((url) => ({ label: model.name + ' — mechanical source', url })),
  ]),
};
export default part;
