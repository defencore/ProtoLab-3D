import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import catalog from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'camera',
  name: 'Camera and thermal imaging module',
  category: 'ELECTRONICS & VISION',
  subgroup: 'CAMERAS & VISION',
  icon: 'camera',
  description:
    'Fixed FPV, thermal, IP, board and stereo-depth cameras for robotics, with source specifications, interface filters and reconstructed CAD envelopes.',
  complexity: 'Fixed supplier models',
  keywords: [
    'camera',
    'FPV',
    'thermal',
    'LWIR',
    'IP',
    'PoE',
    'vision',
    'robotics',
    'stereo',
    'depth',
    'cameras',
    'thermal imager',
    'RunCam',
    'Caddx',
    'DJI',
    'FLIR',
    'Lepton',
    'MLX90640',
    'Reolink',
    'Raspberry Pi',
    'RealSense',
    'Luxonis',
    'OAK-D',
    'DM256',
    'DM384',
    'DM640',
    'UC256',
    'UC384',
    'UC640',
    'NCZOBOE',
  ],
  parameters,
  defaults,
  presets: presets as unknown as Preset[],
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  catalogFilterFields,
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Manufactured camera envelope; check per-model inclusions.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Separate optical and electronic envelopes for inspection. Internal geometry is illustrative.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!catalog.some((m) => m.id === p.model)) errors.push('Select a supported camera model.');
    for (const key of Object.keys(p))
      if (key !== 'model')
        errors.push(`Camera dimensions are fixed; unsupported parameter: ${key}.`);
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Select a supported assembly state.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  notes:
    'Source dimensions describe the selected camera/module, not necessarily a complete camera system. Read the model scope before designing a mount. Undimensioned lens profiles, enclosures, electronics and connectors are reconstructed. Unknown dimensions/specifications are excluded from filters; no TVL-to-pixel conversion or inference of camera-only ratings from complete systems. Maximum resolution and maximum frame rate may use different operating modes. Optical surfaces are visual envelopes, not an optical simulation. No live camera feed or software driver is included.',
  sources: [
    ...new Map(
      catalog.map((m) => [m.source, { label: m.manufacturer + ' — ' + m.name, url: m.source }]),
    ).values(),
  ],
};
export default part;
