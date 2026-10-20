import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import { models, frames, selected, geometry, python } from './lib/model';
import presets from './presets.json';
export { frames, models, sourceFrame, assemblyPlacement, sheetFabrication } from './lib/frames';
const part: PartDefinition = {
  id: 'multicopter-frame-component',
  name: 'Multicopter frame component',
  browseFamily: { id: 'multicopter-frame', label: 'Multicopter frames' },
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MULTICOPTERS',
  icon: 'bracket',
  product: {
    kind: 'detail',
    supply: 'manufactured',
    description:
      'Fixed upstream physical CAD component. Use its source fabrication/procurement definition.',
    processes: ['cutting'],
    releaseRequirements: [
      'Resolve material, drawing revision and purchased hardware specification before release.',
    ],
  },
  description:
    'Native parts from six open frame projects: carbon plates and arms, PODRACER canopy, COMET Y6 printed structure and X8 motor covers.',
  complexity: 'Upstream CAD · fixed components',
  keywords: [
    'multicopter',
    'source one',
    'source two',
    'source v',
    'podracer',
    'hexacopter',
    'octocopter',
    'COMET',
    'Y6',
    'X8',
    'carbon',
    'arm',
    'plate',
    'reference',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  catalogSelectionOnly: true,
  catalogFilterFields: [
    {
      key: 'frame',
      label: 'Frame project',
      group: 'Source part',
      type: 'select',
      options: frames.map((f) => ({ value: f.name, label: f.name })),
    },
    { key: 'width', label: 'Width', group: 'Source envelope', type: 'number', unit: 'mm' },
    { key: 'depth', label: 'Depth', group: 'Source envelope', type: 'number', unit: 'mm' },
    { key: 'height', label: 'Height', group: 'Source envelope', type: 'number', unit: 'mm' },
    {
      key: 'volume',
      label: 'Native volume',
      group: 'Source envelope',
      type: 'number',
      unit: 'mm3',
    },
    {
      key: 'route',
      label: 'Part route',
      group: 'Source part',
      type: 'select',
      options: ['sheet', 'print', 'soft', 'purchase'].map((value) => ({ value, label: value })),
    },
  ],
  presetMatchKeys: ['component'],
  validate: (p) =>
    models.some((m) => m.id === p.component) ? [] : ['Choose a valid upstream component.'],
  buildGeometry: (p) => geometry(selected(p.component)),
  dimensions: (p) => [...selected(p.component).dimensions] as [number, number, number],
  python: (p) => python(selected(p.component)),
  notes:
    'Native source BRep is retained; preview chord tolerance 0.025 mm. SOURCE V closed shells are wrapped as solids. SOURCE data: GPL-3.0-only; COMET data: CERN-OHL-W-2.0. See lib/NOTICE.md. No arbitrary scaling or inferred product certification.',
  sources: frames.map((f) => ({ label: f.name + ' original CAD', url: f.source.url })),
};
export default part;
