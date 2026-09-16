import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'flight-controller',
  name: 'Flight controller',
  category: 'ELECTRONICS & VISION',
  subgroup: 'FLIGHT CONTROLLERS',
  icon: 'circuit',
  complexity: 'Fixed supplier models',
  description:
    'Whoop AIO, stack FC and enclosed autopilots selected by physical size, mounting and connectors.',
  keywords: [
    'FC',
    'FPV',
    'autopilot',
    'AIO',
    'Pixhawk',
    'Holybro',
    'Kakute',
    'SpeedyBee',
    'BETAFPV',
    'flight controller',
    'політний контролер',
    'польотний контролер',
    'автопілот',
    'робототехніка',
  ],
  parameters,
  defaults,
  presets: presets as unknown as Preset[],
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'Controller only; excludes loose cables, dampers, external ESC and breakout boards.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Separate PCB, enclosure and connector layers. Undimensioned internals are illustrative.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model)) errors.push('Select a supported controller model.');
    for (const key of Object.keys(p))
      if (key !== 'model')
        errors.push(`Controller dimensions are fixed; unsupported parameter: ${key}.`);
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Select a supported assembly state.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  notes:
    'Catalog variants differ mechanically or by physical connections. Processor, firmware and receiver-protocol variations alone do not create separate entries. External geometry is reconstructed from manufacturer drawings and photographs; undimensioned component sizes and connector offsets are approximate. Read model scope before designing a mount. Unknown dimensions are omitted from numeric filters. Bare FC dimensions exclude external ESCs, cables and dampers. Pixhawk regulated controller input is separate from the servo power rail. This model is not an electrical pinout or wiring diagram.',
  sources: [
    ...new Map(
      models.map((m) => [m.source, { label: m.manufacturer + ' — ' + m.name, url: m.source }]),
    ).values(),
  ],
};
export default part;
