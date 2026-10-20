import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/mechanical/assembly';
import product from './product.json';
import presetData from './presets.json';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { selected, sourceUrls } from './lib/catalog';
import { geometry, pieces } from './lib/model';

const part: PartDefinition = {
  id: 'panel-switch',
  name: 'Toggle switches & buttons',
  product: product as ProductProfile,
  category: 'SWITCHES & BUTTONS',
  subgroup: 'PANEL CONTROLS',
  icon: 'circuit',
  description:
    'Toggle switches, protective covers, rockers, rotary selectors and discrete momentary or latching buttons with fixed catalogue interfaces.',
  complexity: 'Manufacturer dimensions with declared visual simplifications',
  keywords: [
    'switch',
    'toggle',
    'guard',
    'protective cap',
    'rocker',
    'selector',
    'rotary switch',
    'pushbutton',
    'momentary',
    'latching',
    'tactile',
    'C&K',
    'APEM',
    'E-Switch',
    'Omron',
    'B3F',
    'PVA6',
    '7000',
    'R1966',
  ],
  defaults,
  parameters,
  presets: presetData.map((preset): Preset => ({
    ...preset,
    catalog: {
      ...preset.catalog,
      attributes: Object.fromEntries<string | number | boolean>(
        Object.entries(preset.catalog.attributes).filter(
          (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
        ),
      ),
      geometryEvidence: {
        ...preset.catalog.geometryEvidence,
        kind:
          preset.catalog.geometryEvidence.kind === 'envelope' ? 'envelope' : 'source-dimensions',
      },
    },
  })),
  presetMatchKeys: ['model'],
  catalogSelectionOnly: true,
  catalogFilterFields,
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Switch positioned relative to the panel face or PCB plane at Z=0.',
    },
    {
      id: 'exploded',
      label: 'Inspection separation',
      description:
        'Separate purchased internal components for inspection; no fabrication bill of materials is implied.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const key of Object.keys(p))
      if (!parameters.some((field) => field.key === key))
        errors.push(`Switch dimensions are fixed; unsupported parameter: ${key}.`);
    for (const field of parameters) {
      const value = p[field.key];
      if (field.type === 'number') {
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          (field.min !== undefined && value < field.min) ||
          (field.max !== undefined && value > field.max)
        )
          errors.push(`Choose a supported ${field.label.toLowerCase()}.`);
      } else if (!field.options?.some((option) => option.value === value))
        errors.push(`Choose a supported ${field.label.toLowerCase()}.`);
    }
    if (!['assembled', 'exploded'].includes(state)) errors.push('Choose a supported switch state.');
    if (errors.length) return errors;
    const m = selected(p.model);
    if (m.positions === 2 && p.position === 'center')
      errors.push('This switch has two positions; choose first or last.');
    if (m.guarded && p.guard === 'closed' && p.position !== 'first')
      errors.push(
        'The closed protective cover holds the toggle in its first position. Open the cover before moving the toggle.',
      );
    return errors;
  },
  updateParameters(p, key) {
    const m = selected(p.model);
    if (
      (key === 'guard' && p.guard === 'closed' && m.guarded) ||
      (key === 'model' && (m.positions === 2 || m.guarded))
    )
      return { ...p, position: 'first' };
    if (key === 'position' && m.guarded && p.position !== 'first') return { ...p, guard: 'open' };
    return p;
  },
  buildGeometry: geometry,
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  notes:
    'Fixed purchased configurations. Thread crests, terminals, contact mechanisms and undimensioned moulded details are simplified. DAIER ASW-07D and SAC-01 mounting dimensions follow the linked manufacturer drawings; undimensioned cover curves, wall thickness and installed guard adjustment remain illustrative. APEM switch and guard shell dimensions are explicitly approximate. Missing electrical ratings are unknown, not zero. The 12 mm APEM protective cover is paired only with the compatible bushing class. Nominal panel openings do not replace manufacturer tolerances or orientation features.',
  sources: Object.entries(sourceUrls).map(([label, url]) => ({ label, url })),
};
export default part;
