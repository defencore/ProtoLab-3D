import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/electronics/assembly';
export { gpsTrackerInterface } from './lib/interface';
const part: PartDefinition = {
  id: 'gps-tracker',
  product: productData as ProductProfile,
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
    'Mechanical installation reference, cross-checked against the current source project ZX908 component 233. Its 26 visual solids and 35 × 20 × 4.5 mm bounds are retained; native PCB corner arcs replace the source facets with a recorded maximum 0.009631 mm corner deviation. Supplier dimensions, component interfaces and electrical ratings remain unverified. Read GUIDE.md and lib/source-provenance.json for scope.',
};
export default part;
