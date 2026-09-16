import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogSelection, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { geometry, python, model } from './lib/model';
const part: PartDefinition = {
  id: 'co2-cartridge',
  name: 'CO₂ cartridge',
  category: 'PNEUMATICS & GAS',
  subgroup: 'GAS CARTRIDGES',
  icon: 'box',
  complexity: 'Fixed manufacturer dimensions',
  description:
    'CO₂ cartridges from 8 to 45 g, including threaded and smooth-neck 16 g versions. Rounded steel body, sealed cap and modeled UNF neck thread.',
  keywords: [
    'CO2',
    'CO₂',
    'cartridge',
    'gas',
    'cylinder',
    'capsule',
    'балон',
    'балончик',
    'газ',
    'вуглекислий',
    '16g',
    '8g',
    '12g',
    '20g',
    '25g',
    '33g',
    '38g',
    '45g',
    'threaded',
    'unthreaded',
    'smooth',
    'Leland',
    '3/8',
    '1/2',
    'UNF',
  ],
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelection,
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'sealed',
      label: 'Sealed cartridge',
      description:
        'Closed external body for assembly layout, with a modeled neck thread where specified.',
    },
  ],
  validate(p, state) {
    const e: string[] = [];
    if (!models.some((m) => m.id === p.model)) e.push('Select a supported cartridge.');
    if (Object.keys(p).some((k) => k !== 'model'))
      e.push('Manufacturer dimensions are fixed; select another cartridge.');
    if (state !== 'sealed') e.push('Select sealed cartridge.');
    return e;
  },
  buildGeometry: geometry,
  python,
  dimensions(p) {
    const m = model(p);
    return [m.diameter, m.diameter, m.length];
  },
  notes:
    'Fixed dimensions from Leland specification tables Rev 14.0 (inches converted to mm). Fill mass is CO₂ content, not gross cartridge weight. Rounded base, shoulder, cap and thread coverage are reconstructed where undimensioned. UNF is a nominal 60° profile, without the source’s 1A/2A tolerance allowance. One closed external CAD solid for placement and clearance studies; the pressure cavity, wall thickness and puncture mechanism are not modeled. Matching gas mass does not imply matching connection or dimensions.',
  sources: [...new Set(models.map((m) => m.source))].map((url) => ({
    label: 'Leland — body and neck dimensions (Rev 14.0)',
    url,
  })),
};
export default part;
