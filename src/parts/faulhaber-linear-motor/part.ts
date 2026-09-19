import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { geometry, dimensions, python } from './lib/model';
const part: PartDefinition = {
  id: 'faulhaber-linear-motor',
  name: 'FAULHABER LM linear servomotors',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'LINEAR ACTUATORS',
  icon: 'gear',
  complexity: 'Original manufacturer installation models',
  description:
    'FAULHABER LM linear servomotors with catalog presets, dimensional drawings and original supplier installation geometry.',
  keywords: [
    'FAULHABER',
    'motor',
    'actuator',
    'gearhead',
    'gearbox',
    ...presets.map((p) => p.name),
  ],
  defaults,
  parameters,
  catalogFilterFields,
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  catalogSelectionOnly: true,
  states: [
    {
      id: 'assembled',
      label: 'Manufacturer model',
      description: 'Supplier installation geometry for the selected catalogue execution.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!presets.some((preset) => preset.parameters.model === p.model))
      errors.push('Choose a listed FAULHABER model.');
    if (Object.keys(p).some((key) => !['model', 'position'].includes(key)))
      errors.push('Manufacturer dimensions are fixed; choose a catalogue preset.');
    if (
      typeof p.position !== 'number' ||
      !Number.isFinite(p.position) ||
      p.position < 0 ||
      p.position > 100
    )
      errors.push('Rod position must be between 0% and 100%.');
    if (state !== 'assembled') errors.push('Only the supplied installation model is available.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  notes:
    'Original FAULHABER housing and stroke-specific rod CAD assembled on their common Z axis. Position is a percentage of nominal stroke, from 0% to 100%, with 50% at the center of the catalog body. It translates only the rod and is not an electrical simulation. The 11 (analog Hall) and 12 (sin/cos) sensor versions share the same 1X mechanical housing. LM0830 includes the separate terminal foil provided in supplier CAD. Rod length is not stroke; mounting dimensions and terminal projections follow supplier CAD. Optional guides, cables and controllers are excluded. The supplier installation models do not resolve internal magnets, coils or sensors.',
  sources: [
    ...new Map(
      presets
        .flatMap((p) => [
          { label: p.name, url: p.catalog.sourceUrl },
          ...p.catalog.alternateSourceUrls.map((url) => ({
            label: p.name + (url.endsWith('.zip') ? ' · CAD' : ' · datasheet'),
            url,
          })),
        ])
        .map((s) => [s.url, s]),
    ).values(),
  ],
};
export default part;
