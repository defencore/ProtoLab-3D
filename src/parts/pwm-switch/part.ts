import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces, userReferencePieces } from './lib/model';
import * as assembly from '../../core/assembly/electronics/assembly';
const part: PartDefinition = {
  id: 'pwm-switch',
  product: productData as ProductProfile,
  name: 'PWM electronic switch',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'POWER SWITCHES',
  icon: 'circuit',
  complexity: 'Detailed lightweight model',
  description:
    'Selected 17x13x10 mm switch and an independently selectable unidentified 26x16x6 mm user body reference.',
  keywords: ['PWM electronic switch', 'recovery', 'electronics'],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Separate lightweight solids; loose leads and mating cables excluded.',
    },
    {
      id: 'exploded',
      availableWhen: (p) => p.model !== 'user-mosfet-26x16',
      label: 'Exploded',
      description: 'PCB, major components and enclosure separated for inspection.',
    },
  ],
  validate(p, s) {
    return !['pwm-switch-17x13', 'user-mosfet-26x16'].includes(String(p.model)) ||
      Object.keys(p).some((k) => k !== 'model') ||
      !['assembled', 'exploded'].includes(s) ||
      (p.model === 'user-mosfet-26x16' && s !== 'assembled')
      ? ['Select the fixed PWM electronic switch model and a supported state.']
      : [];
  },
  buildGeometry: (p, s) =>
    assembly.geometry(p.model === 'user-mosfet-26x16' ? userReferencePieces() : pieces(s)),
  python: (p, s) =>
    assembly.python(p.model === 'user-mosfet-26x16' ? userReferencePieces() : pieces(s)),
  dimensions: (p, s) =>
    assembly.dimensions(p.model === 'user-mosfet-26x16' ? userReferencePieces() : pieces(s)),
  notes:
    'Mechanical installation reference. Main dimensions come from the supplied hardware reference; undimensioned details are illustrative. This is not an electrical pinout or a verified supply/current rating. Read GUIDE.md for measurement scope.',
};
export default part;
