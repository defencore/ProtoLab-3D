import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import models from './lib/models.json';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/boundary/assembly';
const part: PartDefinition = {
  id: 'air-preparation-unit',
  name: 'Pneumatic air preparation unit',
  category: 'PNEUMATICS & GAS',
  subgroup: 'VALVES & AIR PREPARATION',
  icon: 'box',
  product: product as ProductProfile,
  description:
    'Fixed AR2000 and AFR2000 G1/4 regulators with documented installation-reference geometry.',
  complexity: 'Fixed supplier execution; installation reference',
  keywords: [
    'AR2000',
    'AR2000-02',
    'AFR2000',
    'G1/4',
    'filter',
    'regulator',
    'air',
    'preparation',
    'pneumatic',
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
