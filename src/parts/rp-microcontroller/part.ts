import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'rp-microcontroller',
  name: 'Raspberry Pi Pico board',
  category: 'ELECTRONICS & VISION',
  subgroup: 'MICROCONTROLLER BOARDS',
  icon: 'circuit',
  complexity: 'Fixed supplier models',
  description: 'RP2040 boards with USB, castellated I/O and optional onboard wireless hardware.',
  keywords: ['Pico', 'RP2040', 'RPi', 'мікроконтролер'],
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
      description: 'Board or module, excluding loose cables, antennas and mating hardware.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate PCB, component, connector and enclosure layers.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model)) errors.push('Select a supported board or module.');
    for (const key of Object.keys(p))
      if (key !== 'model')
        errors.push(`Supplier dimensions are fixed; unsupported parameter: ${key}.`);
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Select a supported assembly state.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  notes:
    'PCB/body dimensions are supplier values; protruding connectors are included in rendered bounds separately. Undimensioned component positions, heights, corner radii and contacts are approximate. Use the linked drawing and physical hardware to confirm mounting and connector clearance. Flexible leads, external antennas, mating plugs and accessories are excluded. The model is a mechanical packaging reference, not a PCB fabrication file or electrical pinout.',
  sources: [
    ...new Map(
      models.map((m) => [m.source, { label: m.manufacturer + ' — ' + m.name, url: m.source }]),
    ).values(),
  ],
};
export default part;
