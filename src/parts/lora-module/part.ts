import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from '../../core/assembly/electronics/assembly';
const part: PartDefinition = {
  id: 'lora-module',
  product: productData as ProductProfile,
  name: 'LoRa radio module',
  category: 'ELECTRONICS & VISION',
  subgroup: 'RADIO MODULES',
  icon: 'circuit',
  complexity: 'Fixed supplier models',
  description: 'SX1278 and SX1262 radio modules and Heltec ESP32-S3 LoRa development boards.',
  keywords: [
    'Semtech',
    'LoRa',
    'SX1262',
    'SX1278',
    'Heltec',
    'WiFi LoRa 32',
    'V3.2',
    'ESP32-S3',
    'OLED',
    'radio module',
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
      models.flatMap(
        (m) =>
          [
            [m.source, { label: m.manufacturer + ' — ' + m.name, url: m.source }],
            ...m.references.map((url) => [
              url,
              { label: m.manufacturer + ' — supporting reference', url },
            ]),
          ] as [string, { label: string; url: string }][],
      ),
    ).values(),
  ],
};
export default part;
