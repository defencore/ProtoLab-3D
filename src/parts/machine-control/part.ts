import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
import { controlSpec, controlPieces } from './lib/model';
import { geometry, python } from './lib/assembly';
const part: PartDefinition = {
  id: 'machine-control',
  name: 'Machine control component',
  category: 'MACHINE TOOLS',
  subgroup: 'DRIVES & CONTROLS',
  description:
    'Purchased DDCS motion controller, emergency stop, PLC, motor drive, power supply and safety relay with source-based external dimensions.',
  keywords: [
    'PLC',
    'VFD',
    'Delta',
    'Schneider',
    'Pilz',
    'MEAN WELL',
    'control',
    'DDCS',
    'emergency stop',
  ],
  icon: 'circuit',
  complexity: 'Fixed catalog dimensions',
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogFilterFields: [
    {
      key: 'width',
      label: 'Width',
      type: 'number',
      unit: 'mm',
      min: 0,
      max: 500,
      step: 0.01,
      group: 'Dimensions',
      catalogSummary: true,
    },
  ],
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  validate: (p) => (models.some((m) => m.id === p.model) ? [] : ['Select a catalog component.']),
  buildGeometry: (p) => geometry(controlPieces(p)),
  dimensions: (p) => {
    const m = controlSpec(p);
    return [m.w, m.d, m.h];
  },
  python: (p) =>
    python(controlPieces(p)) +
    `
component_manufactured = [False]*${controlPieces(p).length}
component_groups = [["Controls"]]*${controlPieces(p).length}
component_metadata = [{"Procurement":"BUY_STANDARD","GeometryEvidence":"Published overall dimensions only; terminal contours illustrative; mounting holes and DIN clips require supplier drawings"}]*${controlPieces(p).length}`,
  assessment: (p) => [
    controlSpec(p).spec,
    'Each selected device is one purchase item; case and terminals are visual subdivisions.',
  ],
  notes:
    'Reference models for cabinet space allocation. No wiring, thermal or functional-safety validation is implied.',
  sources: models.map((m) => ({ label: m.name, url: m.source })),
};
export default part;
