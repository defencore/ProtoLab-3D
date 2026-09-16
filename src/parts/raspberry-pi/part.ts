import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
import * as native from './lib/pi5/model';
import * as lightweight from './lib/pi5/lightweight';
const part: PartDefinition = {
  id: 'raspberry-pi',
  name: 'Raspberry Pi single-board computer',
  category: 'ELECTRONICS & VISION',
  subgroup: 'SINGLE-BOARD COMPUTERS',
  icon: 'circuit',
  complexity: 'Fixed supplier models',
  description: 'Raspberry Pi computers and compute modules in distinct mechanical formats.',
  keywords: ['RPi', 'SBC', 'міні компʼютер', 'одноплатний'],
  parameters,
  defaults,
  presets: presets as unknown as Preset[],
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model', 'detail'],
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
      if (!['model', 'detail'].includes(key))
        errors.push(`Supplier dimensions are fixed; unsupported parameter: ${key}.`);
    if (!['lightweight', 'full'].includes(String(p.detail)))
      errors.push('Select a supported detail level.');
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Select a supported assembly state.');
    return errors;
  },
  buildGeometry: (p, state) =>
    p.model === 'raspberry-pi-5'
      ? (p.detail === 'full' ? native : lightweight).geometry(state)
      : assembly.geometry(pieces(p, state)),
  python: (p, state) =>
    p.model === 'raspberry-pi-5'
      ? (p.detail === 'full' ? native : lightweight).python(state)
      : assembly.python(pieces(p, state)),
  dimensions: (p, state) =>
    p.model === 'raspberry-pi-5'
      ? (p.detail === 'full' ? native : lightweight).dimensions(state)
      : assembly.dimensions(pieces(p, state)),
  notes:
    'Lightweight is the default for working assemblies. Pi 5 retains the exact source PCB and its holes, and replaces connector/package details with 19 simple bodies measured from the source CAD. Full detail restores all 2,689 source solids. Port cavities in lightweight mode are simplified visual references, not mating drawings. Source colors are illustrative and source revision limitations apply. Other boards omit individual contact pads and socket contacts in lightweight mode. PCB/body dimensions are supplier values; undimensioned component locations remain approximate. Flexible leads, mating plugs and accessories are excluded.',
  sources: [
    ...new Map(
      models.map((m) => [m.source, { label: m.manufacturer + ' — ' + m.name, url: m.source }]),
    ).values(),
  ],
};
export default part;
