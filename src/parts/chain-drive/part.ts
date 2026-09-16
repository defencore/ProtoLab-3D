import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'chain-drive',
  name: 'Roller chain and sprocket drive',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'BELTS CHAINS & CABLES',
  icon: 'gear',
  description: 'Two equal sprockets and a separate roller-chain path reference.',
  complexity: 'Parametric prototype',
  keywords: [
    'roller chain and sprocket drive',
    'chain drive',
    'Roller chain drive \u00b7 12.7 mm pitch',
    'Roller chain drive \u00b7 15.875 mm pitch',
    'Roller chain drive \u00b7 19.05 mm pitch',
    'Roller chain drive \u00b7 25.4 mm pitch',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Separate physical components.' },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Axially separated components for inspection.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const field of parameters) {
      if (
        field.type === 'number' &&
        field.step === 1 &&
        field.unit === '' &&
        !Number.isInteger(n(p, field.key))
      )
        errors.push(field.label + ' must be a whole number.');
    }
    if (!['assembled', 'exploded'].includes(state)) errors.push('Choose a valid model state.');
    const r = n(p, 'pitch') / (2 * Math.sin(Math.PI / n(p, 'teeth')));
    if (n(p, 'centres') < 2 * r + n(p, 'pitch') || n(p, 'bore') >= 2 * r - n(p, 'pitch'))
      errors.push('Sprocket and chain clearance is insufficient.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Nominal pitches correspond to common chain families; widths and tooth forms are editable approximations. Continuous chain envelope omits individual pins, plates, rollers and master links; it is not a sprocket cutting profile. Dimensions are editable prototype choices, not source-certified product dimensions or a manufacturing drawing. Threads are smooth nominal envelopes unless explicitly stated. No load, pressure or service-life rating is implied.',
  sources: [],
};
export default part;
