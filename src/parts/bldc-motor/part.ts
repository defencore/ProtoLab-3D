import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { pieces, models } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'bldc-motor',
  name: 'Brushless DC motor (BLDC)',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'BRUSHLESS MOTORS',
  icon: 'gear',
  description:
    'Brushless motors from micro whoop and FPV to large multirotors and RC drives, with ventilated bells, separate windings and magnets, supplier mounting patterns and output interfaces.',
  complexity: 'Fixed supplier models',
  keywords: [
    'motor',
    'electric',
    'двигун',
    'електродвигун',
    'BLDC',
    'brushless',
    'quadcopter',
    'multirotor',
    'FPV',
    'whoop',
    'cinewhoop',
    'квадрокоптер',
    'дрон',
    'BETAFPV',
    'iFlight',
    'XING',
    'NIDICI',
    'T-MOTOR',
    'MN4014',
    'MN6007',
    'U8 Lite',
    'outrunner',
    'inrunner',
    'безколекторний',
    'SunnySky X2204',
    'SunnySky X2212',
    'SunnySky X2814',
    'SunnySky X3520 V3',
    'SunnySky X4120 V3',
    'SunnySky X5330',
    '30401906',
    '30405001',
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
    'Fixed supplier dimensions; filters select models without resizing them. Mounting holes use nominal diameters without helical threads. Cover thicknesses not specified by drawings, cosmetic details, internal rotor/stator clearances, winding envelopes and short leads are approximations. Exploded view and shaft angle only change geometric placement. Current and power conditions are listed per model. Reference drawings take precedence over rounded product-table dimensions. XING2 1404 shaft/body split is reconstructed and excluded from dimensional filters. U8 Lite uses a propeller flange; its internal shaft is excluded from exposed-shaft filtering.',
  sources: [
    ...new Map(
      models.map((m) => [
        m.source,
        {
          label:
            m.manufacturer + ' — ' + (m.rotor === 'inrunner' ? 'XERUN G3 specifications' : m.code),
          url: m.source,
        },
      ]),
    ).values(),
  ],
};
export default part;
