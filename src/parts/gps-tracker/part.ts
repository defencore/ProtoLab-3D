import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../flight-controller/lib/assembly';
const part: PartDefinition = {
  id: 'gps-tracker',
  name: 'GPS tracker ZX908',
  category: 'ELECTRONICS & VISION',
  subgroup: 'RADIO MODULES',
  icon: 'circuit',
  complexity: 'Detailed lightweight model',
  description: 'Bare tracker PCB with patch antenna, SIM holder, RF shield and service components.',
  keywords: ['GPS tracker ZX908', 'recovery', 'electronics'],
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
    return p.model !== 'zx908' ||
      Object.keys(p).some((k) => k !== 'model') ||
      !['assembled', 'exploded'].includes(s)
      ? ['Select the fixed GPS tracker ZX908 model and a supported state.']
      : [];
  },
  buildGeometry: (_, s) => assembly.geometry(pieces(s)),
  python: (_, s) => assembly.python(pieces(s)),
  dimensions: (_, s) => assembly.dimensions(pieces(s)),
  notes:
    'Mechanical installation reference. Main dimensions come from the supplied hardware reference; undimensioned details are illustrative. This is not an electrical pinout or a verified supply/current rating. Read GUIDE.md for measurement scope.',
};
export default part;
