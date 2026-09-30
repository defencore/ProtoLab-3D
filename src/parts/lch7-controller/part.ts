import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../flight-controller/lib/assembly';
const part: PartDefinition = {
  id: 'lch7-controller',
  name: 'LCH7 v3.2',
  category: 'ELECTRONICS & VISION',
  subgroup: 'FLIGHT CONTROLLERS',
  icon: 'circuit',
  complexity: 'Detailed lightweight model',
  description:
    'LCH7 v3.2 controller with FR4 PCB, mounting holes, major components, connector housings and contacts.',
  keywords: ['LCH7 v3.2', 'recovery', 'electronics'],
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
    return p.model !== 'lch7-v3-2' ||
      Object.keys(p).some((k) => k !== 'model') ||
      !['assembled', 'exploded'].includes(s)
      ? ['Select the fixed LCH7 v3.2 model and a supported state.']
      : [];
  },
  buildGeometry: (_, s) => assembly.geometry(pieces(s)),
  python: (_, s) => assembly.python(pieces(s)),
  dimensions: (_, s) => assembly.dimensions(pieces(s)),
  notes:
    'Mechanical installation reference. Main dimensions come from the supplied hardware reference; undimensioned details are illustrative. This is not an electrical pinout or a verified supply/current rating. Read GUIDE.md for mounting materials and installation.',
};
export default part;
