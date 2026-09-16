import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import { geometry, python, PIN_LENGTH } from './lib/model';
import presets from './presets.json';
const part: PartDefinition = {
  id: 'srs-igniter',
  name: 'SRS igniter housing',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'SRS AIRBAG',
  icon: 'circuit',
  complexity: 'Adjustable exterior · fixed reference pins',
  description:
    'Variant 2 exterior with a metal cap, stepped housing and two fixed reference pins. Adjust the body dimensions for assembly layout.',
  keywords: [
    'SRS',
    'airbag',
    'igniter',
    'squib',
    'CA281A',
    'Amphenol',
    'VDA-AK1',
    'envelope',
    'dummy',
    'макет',
    'запальник',
    'подушка безпеки',
  ],
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelection: [],
  states: [
    {
      id: 'exterior',
      label: 'Exterior layout',
      description:
        'Solid exterior components and illustrative pins; connector retention geometry is not represented.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const field of parameters) {
      const value = p[field.key];
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < field.min! ||
        value > field.max!
      )
        errors.push(`${field.label} must be between ${field.min} and ${field.max} mm.`);
    }
    if (Object.keys(p).some((key) => !parameters.some((field) => field.key === key)))
      errors.push('Unsupported exterior parameter.');
    if (Number(p.capDiameter) > Number(p.collarDiameter))
      errors.push('The upper collar must be at least as wide as the metal cap.');
    if (Number(p.collarDiameter) >= Number(p.bodyDiameter))
      errors.push('The upper collar must be narrower than the housing.');
    if (Number(p.baseDiameter) >= Number(p.bodyDiameter))
      errors.push('The lower boss must be narrower than the housing.');
    if (Number(p.overallHeight) - PIN_LENGTH - Number(p.capHeight) < 3)
      errors.push('Allow at least 3 mm of housing height between the metal cap and pins.');
    if (state !== 'exterior') errors.push('Select the exterior layout state.');
    return errors;
  },
  buildGeometry: geometry,
  python,
  dimensions: (p) => [Number(p.bodyDiameter), Number(p.bodyDiameter), Number(p.overallHeight)],
  notes:
    'The supplied variant 2 drawing dimensions only the maximum diameter (11 ±0.1 mm), total height including pins (22.5 ±0.2 mm), and exposed pin length (7.3 mm). Defaults use nominal values; tolerances are not clearance allowances. Other exterior proportions and pin cross-sections are illustrative. Two fixed pins use the existing CA281A library model’s 4 mm center spacing; their 1 mm diameter is a layout approximation, not a published terminal specification. Changing the housing does not scale the pins. No keyed receptacle, retainer, latch seats, internal components or operating geometry are included. Real connector compatibility is not verified.',
  sources: [
    {
      label: 'User-supplied variant 2 drawing',
      url: '',
    },
    {
      label: 'Model dimensions and approximation scope',
      url: '',
    },
    {
      label: 'Amphenol CA281A — interface family reference',
      url: 'https://www.amphenol-auto.com/Uploads/file/20201019/1603095217709849.pdf',
    },
  ],
};
export default part;
