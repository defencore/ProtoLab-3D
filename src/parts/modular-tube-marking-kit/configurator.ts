import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';
import { tubeMounting } from '../modular-tube-avionics/lib/service';
import { defaultTubeProfile, tubeProfiles } from '../modular-tube-avionics/lib/tube-interface';

export const defaults: Parameters = {
  tubeProfile: defaultTubeProfile,
  fitAllowance: 0.8,
  jointAllowance: 0.2,
  markDiameter: 3.2,
  side: 'first',
  showTube: true,
};

export const parameters: ParameterDefinition[] = [
  {
    key: 'tubeProfile',
    label: 'Tube profile',
    type: 'select',
    group: 'Tube interface',
    options: tubeProfiles.map((profile) => ({ value: profile.id, label: profile.label })),
    description:
      'The same supported workpiece profile as the avionics. Only D90/D86 is currently defined. Tool-bore clearance remains the independent fitting allowance; the avionics insert clearance does not resize these tools.',
  },
  {
    ...numberParameter(
      'fitAllowance',
      'Tube diametral fitting allowance',
      'cD',
      'Fit',
      0.1,
      1,
      0.05,
    ),
    description:
      'Total clearance of the free frame bore over the nominal tube outside diameter. The fixed tangent lands and pressure shoe locate the tube separately. This does not resize the project window or hole pattern.',
  },
  {
    ...numberParameter(
      'jointAllowance',
      'Tool registration fitting allowance',
      'c',
      'Fit',
      0.1,
      0.5,
      0.05,
    ),
    description:
      'Fitting allowance at the removable tool registers and shoe guide. Seat the tool datum faces before marking.',
  },
  {
    ...numberParameter(
      'markDiameter',
      'Center-mark passage',
      'd',
      'Marking',
      3.1,
      tubeMounting.pilotDiameter,
      0.1,
    ),
    description:
      'The default 3.2 mm passage accepts a nominal 3 mm transfer tool. Finish the tube holes to the project diameter after removing the marking kit.',
  },
  {
    key: 'side',
    label: 'Marking pass',
    type: 'select',
    group: 'Setup',
    options: [
      { value: 'first', label: 'First window and hole line' },
      { value: 'opposite', label: 'Opposite window and hole line' },
    ],
    description:
      'Move only the window stencil and two rails between the opposed registers. The front base, pressure shoe and all hardware remain fixed.',
    visibleWhen: (_p, state) => state !== 'print',
  },
  {
    key: 'showTube',
    label: 'Show reference tube',
    type: 'boolean',
    group: 'Inspection',
    visibleWhen: (_p, state) => state !== 'print',
  },
];
