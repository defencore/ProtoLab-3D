import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'clamp-band-release',
  name: 'Clamp Band Separation Mechanism',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'gear',
  complexity: 'Two clamp concepts · staged release',
  description:
    'Annular separation interface with a split V-clamp band or captive pivoting jaws, an open central passage and optional spring stations. Reference-inspired concept geometry.',
  keywords: [
    'separation',
    'clamp band',
    'release',
    'V band',
    'Marman',
    'ring',
    'parachute',
    'REXUS',
    'segmented clamp',
  ],
  parameters,
  defaults,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Use Release sequence to inspect the opening and separation phases.',
    },
    { id: 'released', label: 'Released', description: 'Clamps open and upper interface lifted.' },
    {
      id: 'exploded',
      label: 'Interface inspection',
      description: 'Upper interface displaced axially to expose the clamp.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const field of parameters) {
      const v = p[field.key];
      if (
        field.type === 'number' &&
        (!Number.isFinite(Number(v)) || Number(v) < field.min! || Number(v) > field.max!)
      )
        errors.push(`${field.label} is outside its allowed range.`);
      if (field.type === 'select' && !field.options?.some((o) => o.value === v))
        errors.push(`Choose a valid ${field.label.toLowerCase()}.`);
      if (field.type === 'boolean' && typeof v !== 'boolean')
        errors.push(`${field.label} must be enabled or disabled.`);
    }
    if (!Number.isInteger(+p.segments) || +p.segments % 2)
      errors.push('Use an even number of clamp segments.');
    if (+p.diameter - +p.bore < 4) errors.push('Interface radial wall must be at least 2 mm.');
    if (p.layout === 'pivot' && +p.bore < +p.diameter - 4 * (+p.diameter / 90))
      errors.push(
        'The inner-ring layout requires a thin-wall interface: increase the bore to clear its ring guides.',
      );
    if (!['assembled', 'released', 'exploded'].includes(state))
      errors.push('Choose a valid inspection state.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  assessment: (p) => [
    `Nominal flange bore: ${p.bore} mm. ${p.segments} distributed clamp segments.`,
    p.layout === 'band'
      ? 'The pull pin withdraws during 0–15%; two V-clamp halves then turn 20 degrees around a common retained hinge during 15–55%.'
      : 'The guided split ring contracts at constant neutral-axis arc length during 0–25%. Two constant-length links drive its ends. Released heel stops permit a 42 degree jaw opening during 25–55%. The guide frame reduces the available passage.',
    'Axial separation starts at 55%. Spring plungers follow for an 8 mm scaled stroke, then their captive stops limit further extension. Six open guide sleeves are located outside the clamp motion envelope.',
    'Source figures provide topology, not dimensions. These editable dimensions and spring geometry are design-study choices; no load or release reliability rating is assigned.',
  ],
  notes:
    'Separate FreeCAD solids with component labels. Nominal fastener envelopes have no modeled helical threads. Springs have no specified rate or preload. No cutter internals, drive electronics, manufacturing tolerances or TechDraw sheets are included. This reference-inspired concept requires mechanical detailing and verification before fabrication.',
  sources: [
    {
      label:
        'Pepermans et al. (2019), Flight testing of parachute recovery systems aboard REXUS, Figure 6',
      url: 'https://www.researchgate.net/figure/Separation-mechanism-clamp-band_fig1_335946613',
    },
  ],
};
export default part;
