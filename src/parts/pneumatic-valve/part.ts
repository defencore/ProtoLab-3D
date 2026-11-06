import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import models from './lib/models.json';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/boundary/assembly';
const part: PartDefinition = {
  id: 'pneumatic-valve',
  name: 'Pneumatic valve',
  category: 'PNEUMATICS & GAS',
  subgroup: 'VALVES & AIR PREPARATION',
  icon: 'box',
  product: product as ProductProfile,
  description:
    'Fixed 4V210-08 DC24V directional valve and 2VD0102 one-way flow-control references with explicit source limitations.',
  complexity: 'Fixed supplier execution; installation reference',
  keywords: [
    '4V210',
    '4V210-08',
    '24V',
    'DC24V',
    'pneumatic',
    'solenoid',
    'valve',
    '5/2',
    '2VD0102',
    'flow control',
    'banjo',
  ],
  defaults,
  parameters,
  catalogFilterFields,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'Complete supplier unit with provisional external installation geometry; accessories and undimensioned internals are omitted.',
    },
  ],
  validate(p, state) {
    return !models.some((m) => m.id === p.model) ||
      Object.keys(p).some((key) => key !== 'model') ||
      state !== 'assembled'
      ? ['Select a supported fixed supplier model and assembled state.']
      : [];
  },
  buildGeometry: (p) => assembly.geometry(pieces(p)),
  python: (p) => assembly.python(pieces(p)),
  dimensions: (p) => assembly.dimensions(pieces(p)),
  notes:
    'Source identity and geometry fidelity are separate. These are inherited installation envelopes with unresolved supplier interfaces, not verified mounting drawings, pressure-qualified components or procurement-ready designs. Review each model scope and obtain the exact ordered drawing before design release.',
  sources: models.map((m) => ({ label: m.name + ' supplier listing', url: m.source })),
};
export default part;
