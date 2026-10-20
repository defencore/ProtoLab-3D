import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults } from './configurator';
import presets from './presets.json';
import models from './lib/models.json';
export { controlMounting, controlMountingSources } from './lib/mounting';
import { controlMounting, controlMountingSources } from './lib/mounting';
import { controlSpec, controlPieces } from './lib/model';
import { geometry, python } from '../../core/assembly/boundary/assembly';
const part: PartDefinition = {
  id: 'machine-control',
  product: productData as ProductProfile,
  name: 'Industrial control and power equipment',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'INDUSTRIAL CONTROL EQUIPMENT',
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
    {
      key: 'inputPhase',
      label: 'VFD input phases',
      type: 'select',
      group: 'Drive ratings',
      options: [
        { value: '1', label: 'Single phase' },
        { value: '1 or 3', label: 'Single or three phases' },
      ],
    },
    {
      key: 'power',
      label: 'VFD motor power',
      type: 'number',
      unit: 'W',
      group: 'Drive ratings',
      min: 0,
      max: 10000,
      step: 100,
    },
    {
      key: 'outputCurrent',
      label: 'VFD rated output current',
      type: 'number',
      unit: 'A',
      group: 'Drive ratings',
      min: 0,
      max: 100,
      step: 0.1,
    },
    {
      key: 'outputFrequencyMax',
      label: 'Maximum motor frequency',
      type: 'number',
      unit: 'Hz',
      group: 'Drive ratings',
      min: 0,
      max: 1000,
      step: 1,
    },
  ],
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  validate: (p) =>
    !models.some((m) => m.id === p.model)
      ? ['Select a catalog component.']
      : p.model === 'xb5as8444' &&
          (!Number.isFinite(Number(p.panelThickness)) ||
            Number(p.panelThickness) < 1 ||
            Number(p.panelThickness) > 6)
        ? ['XB5 panel clamping thickness must be1..6 mm.']
        : [],
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
component_metadata = [{"Procurement":"BUY_STANDARD","GeometryEvidence":"Published external dimensions and selected explicit mounting interfaces; housing, collar and DIN latch contours illustrative. Delivered mounting drawing approval remains required"}]*${controlPieces(p).length}`,
  assessment: (p) => [
    controlSpec(p).spec,
    controlMounting(p).note,
    'Each selected device is one purchase item; case and terminals are visual subdivisions.',
  ],
  notes:
    'Reference models for cabinet space allocation. No wiring, thermal or functional-safety validation is implied.',
  sources: [
    ...models.map((m) => ({ label: m.name, url: m.source })),
    ...Object.entries(controlMountingSources).map(([label, url]) => ({
      label: 'Mounting interface: ' + label,
      url,
    })),
  ],
};
export default part;
