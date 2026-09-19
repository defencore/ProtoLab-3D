import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { pieces, models } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'stepper-motor',
  name: 'NEMA stepper motor',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'STEPPER MOTORS',
  icon: 'gear',
  description:
    'Fixed STEPPERONLINE motors from NEMA 8 to NEMA 42, with mounting flanges, bearings, laminated bodies and round, D or keyed shafts.',
  complexity: 'Fixed supplier models',
  keywords: [
    'motor',
    'electric',
    'electric motor',
    'stepper',
    'NEMA',
    '8HS12-0506S',
    '11HS12-0674S',
    '14HS10-0404S',
    '17HS08-1004S',
    '17HS19-2004S1',
    '23HS30-2804S2',
    '24HS40-4204S',
    '34HE45-6004S',
    '42HS79-8004S',
  ],
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  catalogFilterFields,
  states: [
    { id: 'assembled', label: 'Assembled', description: 'Complete motor at its fixed dimensions.' },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate covers and rotor for inspection. Internal geometry is illustrative.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const key of Object.keys(p))
      if (!parameters.some((f) => f.key === key))
        errors.push(`Motor dimensions are fixed; unsupported parameter: ${key}.`);
    if (!models.some((m) => m.id === p.model)) errors.push('Select a supported motor model.');
    if (
      typeof p.outputAngle !== 'number' ||
      !Number.isFinite(p.outputAngle) ||
      Math.abs(p.outputAngle) > 180
    )
      errors.push('Shaft position must be between −180° and 180°.');
    if (typeof p.showLeads !== 'boolean')
      errors.push('Cable visibility must be enabled or disabled.');
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Select a supported assembly state.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  notes:
    'Fixed supplier dimensions; filters select models without resizing them. Mounting holes use nominal diameters without helical threads. Cover thicknesses not specified by drawings, cosmetic details, internal rotor/stator clearances, winding envelopes and short leads are approximations. Exploded view and shaft angle only change geometric placement. Current and power conditions are listed per model. Reference drawings take precedence over rounded product-table dimensions.',
  sources: models.map((m) => ({ label: m.name + ' — manufacturer specifications', url: m.source })),
};
export default part;
