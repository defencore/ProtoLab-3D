import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { geometry, dimensions, python } from './lib/model';
const part: PartDefinition = {
  id: 'faulhaber-am',
  name: 'FAULHABER AM stepper motors',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'STEPPER MOTORS',
  icon: 'gear',
  complexity: 'Original manufacturer CAD · fixed catalogue models',
  description:
    'FAULHABER AM motor series with verified manufacturer CAD, mounting geometry and winding-specific catalogue presets.',
  keywords: [
    'FAULHABER',
    'AM',
    'motor',
    'двигун',
    'мотор',
    'brushless',
    'stepper',
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
      description:
        'Original external installation geometry, including mounting interface and shaft.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!presets.some((preset) => preset.parameters.model === p.model))
      errors.push('Choose a listed FAULHABER motor.');
    if (Object.keys(p).some((key) => key !== 'model'))
      errors.push('Manufacturer motor dimensions are fixed; choose a catalogue preset.');
    if (state !== 'assembled') errors.push('Only the supplied installation model is available.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  notes:
    'Original manufacturer STEP geometry for the listed standard mechanical executions. Front mounting plane is Z=0; the output shaft points along +Z. Body length in the catalogue excludes shaft and rear projections; displayed bounds include all supplied geometry. Winding variants share the same mechanical model. Supplier CAD is an external installation solid, with no separate internal rotor, bearings or windings; cable runs and optional encoders/controllers/gearheads are excluded. Thread detail follows supplier CAD. Colors are illustrative. AM current and holding torque refer to both phases energized; boosted torque is a separate rating. Phase voltage is not a recommended chopper-driver supply voltage. No motor simulation.',
  sources: [
    ...new Map(
      presets
        .flatMap((p) => [
          { label: p.name, url: p.catalog.sourceUrl },
          ...p.catalog.alternateSourceUrls.map((url, i) => ({
            label: p.name + (i === 0 ? ' · datasheet' : ' · CAD'),
            url,
          })),
        ])
        .map((s) => [s.url, s]),
    ).values(),
  ],
};
export default part;
