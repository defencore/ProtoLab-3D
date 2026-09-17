import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { geometry, dimensions, python } from './lib/model';
const part: PartDefinition = {
  id: 'faulhaber-planetary',
  name: 'FAULHABER planetary gearheads',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'REDUCERS & DIFFERENTIALS',
  icon: 'gear',
  complexity: 'Original manufacturer installation models',
  description:
    'FAULHABER planetary gearheads with catalog presets, dimensional drawings and original supplier installation geometry.',
  keywords: [
    'FAULHABER',
    'motor',
    'actuator',
    'gearhead',
    'двигун',
    'редуктор',
    'актуатор',
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
    if (Object.keys(p).some((key) => !['model'].includes(key)))
      errors.push('Manufacturer dimensions are fixed; choose a catalogue preset.');
    if (state !== 'assembled') errors.push('Only the supplied installation model is available.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  notes:
    'Original manufacturer external installation solids for the standard output-shaft execution and the selected number of gear stages. Shafts, pilots and mounting holes follow supplier CAD. Gear teeth, bearings and internal stages are not separate parts in these files. Ratios within the same stage count can legitimately share the same external geometry; their ratio and torque ratings remain distinct. Ratios are rounded catalogue values. The selected gearhead excludes the motor and motor-specific input adapter flanges supplied separately in the CAD archives. Catalogue L2 and the bare CAD body can consequently differ (notably the 22/32 mm GPT families). CAD bounds include the output shaft and all supplied projections. The 22GPT HT L2 values follow the dimensional drawing, which resolves duplicate shop length fields. No arbitrary scaling, gearbox simulation or load calculation.',
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
