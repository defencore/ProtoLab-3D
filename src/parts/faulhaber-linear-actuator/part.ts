import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { geometry, dimensions, python } from './lib/model';
const part: PartDefinition = {
  id: 'faulhaber-linear-actuator',
  name: 'FAULHABER screw actuators',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'LINEAR ACTUATORS',
  icon: 'gear',
  complexity: 'Original manufacturer installation models',
  description:
    'FAULHABER screw actuators with catalog presets, dimensional drawings and original supplier installation geometry.',
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
    if (Object.keys(p).some((key) => !['model'].includes(key)))
      errors.push('Manufacturer dimensions are fixed; choose a catalogue preset.');
    if (state !== 'assembled') errors.push('Only the supplied installation model is available.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  notes:
    'Manufacturer external installation models with the standard cylindrical nut and screw length; no drive motor or motor-specific input adapter flange. FAULHABER supplies these actuator modules with a matched motor mounted; select the motor combination with the manufacturer. CAD archives combine alternative nuts and shaft ends side by side; only the centered standard execution is selected. Supplier CAD represents screw threads and ball recirculation as smooth installation surfaces and joins the nut, screw and housing into one solid. ML, SB, PB and TL variants with the same outside dimensions therefore share this simplified external solid; thread specification, lead/precision and force ratings remain distinct catalogue characteristics. This model does not expose a fictitious moving nut or internal mechanism. Catalogue body lengths are from the current dimensional drawings and can differ from the archived bare CAD body/flange execution. Check the linked drawing for the chosen motor combination; bounds include the supplied screw and nut.',
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
