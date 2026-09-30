import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../flight-controller/lib/assembly';
const part: PartDefinition = {
  id: 'pwm-switch',
  name: 'PWM electronic switch',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'POWER SWITCHES',
  icon: 'circuit',
  complexity: 'Detailed lightweight model',
  description:
    'Selected 17x13x10 mm switch with rounded sleeve, terminal exits and signal connection.',
  keywords: ['PWM electronic switch', 'recovery', 'electronics'],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Separate lightweight solids; loose leads and mating cables excluded.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'PCB, major components and enclosure separated for inspection.',
    },
  ],
  validate(p, s) {
    return p.model !== 'pwm-switch-17x13' ||
      Object.keys(p).some((k) => k !== 'model') ||
      !['assembled', 'exploded'].includes(s)
      ? ['Select the fixed PWM electronic switch model and a supported state.']
      : [];
  },
  buildGeometry: (_, s) => assembly.geometry(pieces(s)),
  python: (_, s) => assembly.python(pieces(s)),
  dimensions: (_, s) => assembly.dimensions(pieces(s)),
  notes:
    'Mechanical installation reference. Main dimensions come from the supplied hardware reference; undimensioned details are illustrative. This is not an electrical pinout or a verified supply/current rating. Read GUIDE.md for measurement scope.',
};
export default part;
