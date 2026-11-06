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
  complexity: 'Source dimensions and explicitly provisional supplier envelopes',
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
    'DS-225',
    'BERM',
    'BEM-LA16',
  ],
  defaults,
  parameters,
  presets: presetData.map((preset): Preset => {
    const { sourceKind, ...catalog } = preset.catalog;
    return {
      ...preset,
      catalog: {
        ...catalog,
        ...(sourceKind === 'attachment' ? { sourceKind: 'attachment' as const } : {}),
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
    };
  }),
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
    if (p.mountingHardware === 'upper-only' && m.id !== 'daier-asw-07d')
      errors.push('Upper-nut-only mounting is available for the bare ASW-07D.');
    if (m.positions === 2 && p.position === 'center')
      errors.push('This switch has two positions; choose first or last.');
    if (m.guarded && p.guard === 'closed' && p.position !== 'first')
      errors.push(
        'The closed protective cover holds the toggle in its first position. Open the cover before moving the toggle.',
      );
    return errors;
  },
  updateParameters(p, key) {
    const next =
      key === 'model' && p.model !== 'daier-asw-07d' ? { ...p, mountingHardware: 'standard' } : p;
    const m = selected(next.model);
    if (
      (key === 'guard' && next.guard === 'closed' && m.guarded) ||
      (key === 'model' && (m.positions === 2 || m.guarded))
    )
      return { ...next, position: 'first' };
    if (key === 'position' && m.guarded && next.position !== 'first')
      return { ...next, guard: 'open' };
    return next;
  },
  buildGeometry: geometry,
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  notes:
    'Fixed purchased configurations. Thread crests, terminals, contact mechanisms and undimensioned moulded details are simplified. BERM BEM-LA16 models are provisional supplier-listed envelopes: all dimensions, terminal layouts and inspection travel require measurement; colour and voltage order codes are incomplete, and the square listing has conflicting action descriptions. DAIER DS-225 follows the supplied rectangular black bezel and round actuator photo, with mounting/body dimensions referenced to the earlier drawing. Green is the photo-derived default cap appearance; the user-requested red and black choices change only that cap and do not establish supplier colour order codes, availability or electrical options. Undimensioned bezel dimensions remain illustrative. DAIER ASW-07D and SAC-01 mounting dimensions follow the linked manufacturer drawings; undimensioned cover curves, wall thickness and installed guard adjustment remain illustrative. APEM switch and guard shell dimensions are explicitly approximate. Missing electrical ratings are unknown, not zero. The 12 mm APEM protective cover is paired only with the compatible bushing class. Nominal panel openings do not replace manufacturer tolerances or orientation features.',
  sources: [
    ...Object.entries(sourceUrls).map(([label, url]) => ({ label, url })),
    { label: 'User-supplied DS-225 photo and mounting drawing' },
  ],
};
export default part;
