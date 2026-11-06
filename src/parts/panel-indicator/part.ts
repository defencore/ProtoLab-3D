import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/electronics/assembly';

const part: PartDefinition = {
  id: 'panel-indicator',
  product: productData as ProductProfile,
  name: 'Lehao AD16-16C panel indicator',
  category: 'SWITCHES & BUTTONS',
  subgroup: 'PANEL CONTROLS',
  icon: 'circuit',
  complexity: 'Fixed provisional installation envelope with colour choices',
  description:
    'Lehao AD16-16C panel lamp with five lens colour choices, retaining nut and two rear terminals. Geometry is provisional pending a Lehao drawing.',
  keywords: ['Lehao', 'AD16-16C', 'indicator', 'pilot light', 'panel lamp', 'LED', '16mm'],
  validationNotice:
    'Provisional envelope: Lehao identity is retailer-listed, but no Lehao dimension drawing was found. The assumed 19 × 45 mm envelope and 16 mm mounting interface must be checked against the actual item. Yellow, blue and white are illustrative colour choices.',
  parameters,
  defaults,
  presets: presets as unknown as Preset[],
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Indicator, lens, retaining nut and two terminals; panel and wiring excluded.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate the same components for inspection without changing product identity.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const key of Object.keys(p))
      if (!parameters.some((field) => field.key === key))
        errors.push(`Indicator dimensions are fixed; unsupported parameter: ${key}.`);
    for (const field of parameters)
      if (!field.options?.some((option) => option.value === p[field.key]))
        errors.push(`Choose a supported ${field.label.toLowerCase()}.`);
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Select a supported indicator state.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  notes:
    'Provisional Lehao packaging model. The retailer catalogue establishes the Lehao AD16-16C designation only. Head diameter 19 mm, total length 45 mm, nominal mounting diameter 16 mm, the 5 mm front projection, shank, nut and terminal details are assumptions. Comparable AD16-16C products from other brands do not establish Lehao interchangeability. Red and green occur in the Lehao listing; yellow, blue and white are visual choices without Lehao availability evidence. Voltage, current, IP rating, polarity and terminal numbering are unspecified. Thread geometry, wires, panel, insulation clearances and optical internals are omitted. Origin is the assumed front panel plane; lens faces +Z and the terminals extend toward −Z. Nut position illustrates a 2 mm panel, which is not supplied or exported. Confirm the real product before releasing a panel cutout or ordering hardware.',
  sources: [
    {
      label: 'JD indexed retailer listing — Lehao AD16-16C identity; no dimensional drawing',
      url: 'https://www.jd.com/jiage/670d59f660d70a08559.html',
    },
    {
      label: 'JD indexed retailer listing — red and green appearance choices',
      url: 'https://www.jd.com/jiage/98558181401b33059af3.html?catID=38255&electedExtAttrSet=&extAttrValue=expand_name%2C&sort_type=sort_default',
    },
    {
      label: 'Siemens APT AD16-16C — comparison only; a different manufacturer',
      url: 'https://www.si-apt.com/products/indicator/24',
    },
  ],
};

export default part;
