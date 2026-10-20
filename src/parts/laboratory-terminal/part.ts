import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/mechanical/assembly';
import { defaults, parameters, catalogSelection, catalogFilterFields } from './configurator';
import { models, pieces } from './lib/model';
import presets from './presets.json';
import product from './product.json';
const part: PartDefinition = {
  id: 'laboratory-terminal',
  name: 'Laboratory terminal',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'LABORATORY TERMINALS',
  icon: 'circuit',
  product: product as ProductProfile,
  description:
    'Banana plugs and sockets, binding posts, speaker spring terminals, lever splices and pluggable screw terminals selected by supplier model.',
  complexity: 'Fixed catalog models',
  keywords: [
    'terminal',
    'laboratory',
    'banana',
    'binding post',
    'speaker terminal',
    'spring clip',
    'power supply',
    'bench',
    'Pomona',
    'CLIFF',
    'WAGO',
    '221',
    'Phoenix Contact',
    'MSTB',
    '4mm',
    '2mm',
    'socket',
    'jack',
    'lever',
    'screw terminal',
  ],
  defaults,
  parameters,
  presets: presets.map((preset): Preset => ({
    ...preset,
    catalog: {
      ...preset.catalog,
      geometryEvidence: { ...preset.catalog.geometryEvidence, kind: 'source-dimensions' },
      attributes: Object.fromEntries(
        Object.entries(preset.catalog.attributes).filter(([, value]) => value !== undefined),
      ),
    },
  })),
  catalogSelection,
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Housing, conductors and mounting hardware in the reference installation pose.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate the existing components rigidly for inspection.',
    },
  ],
  validate(p, s) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model))
      errors.push('Choose a supported laboratory terminal.');
    if (Object.keys(p).some((k) => k !== 'model'))
      errors.push('Supplier dimensions are fixed; choose another model.');
    if (!['assembled', 'exploded'].includes(s)) errors.push('Choose a valid terminal state.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Reconstructed from official drawings and product illustrations. Published fitting dimensions and reconstructed details are identified per model. Female bores and wire channels are open. Threads, spring force, internal clamp mechanisms and moulding details are simplified. Select the ordered supplier revision before making panel cutouts or mating tools.',
  sources: [...new Set(models.map((m) => m.source))].map((url) => ({
    label: 'Manufacturer · dimensions and product reference',
    url,
  })),
};
export default part;
