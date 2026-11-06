import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';
import { defaultTubeProfile, tubeProfiles } from './lib/tube-interface';

export const defaults: Parameters = {
  tubeProfile: defaultTubeProfile,
  cameraSetup: 'ov9281',
  module: 'all',
  keyClearance: 0.3,
  showTube: true,
  showElectronics: true,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'tubeProfile',
    label: 'Tube profile',
    type: 'select',
    group: 'Tube interface',
    options: tubeProfiles.map((profile) => ({ value: profile.id, label: profile.label })),
    visibleWhen: (_p, state) => state !== 'templates',
    description:
      'Supported nominal tube interface. Only D90/D86 is currently defined; additional profiles require their own geometry and fit checks. Purchased components keep their actual dimensions.',
  },
  {
    key: 'cameraSetup',
    label: 'Camera cartridge',
    type: 'select',
    group: 'Equipment',
    visibleWhen: (_p, state) => state !== 'templates',
    options: [
      { value: 'ov9281', label: 'Waveshare 21653 · OV9281-110' },
      { value: 'camera-19', label: 'IMX577 19x19 · rear MIPI · M2.5 mounts' },
    ],
  },
  {
    key: 'module',
    label: 'Visible module',
    type: 'select',
    group: 'Inspection',
    visibleWhen: (_p, state) => !['cable-routes', 'lower-cover', 'templates'].includes(state ?? ''),
    options: [
      { value: 'all', label: 'Complete modular assembly' },
      { value: 'nose', label: 'Removable nose and computer' },
      { value: 'flight', label: 'Grandado and flight controllers' },
      { value: 'spool', label: 'Harness service spool' },
      { value: 'power', label: 'UPS and separate 3S holder' },
      { value: 'tail', label: 'Tail closure and TPU buffer' },
    ],
  },
  {
    ...numberParameter(
      'keyClearance',
      'Square key total fitting allowance',
      'c',
      'Printed fits',
      0.2,
      0.6,
      0.05,
    ),
    description:
      'Total width added to the avionics 6 mm square-key sockets. Qualify on the supplied avionics coupon; this changes neither the 85.6 mm insert diameter nor the standalone marking-kit registers.',
  },
  {
    key: 'showTube',
    label: 'Show tube reference',
    type: 'boolean',
    group: 'Inspection',
    description: 'Show or hide the tube in the browser. FreeCAD copies include it in these views.',
    visibleWhen: (p, state) =>
      ['all', 'flight'].includes(String(p.module)) &&
      ['assembled', 'cutaway', 'service'].includes(state ?? 'assembled'),
  },
  {
    key: 'showElectronics',
    label: 'Show purchased components',
    type: 'boolean',
    group: 'Inspection',
    visibleWhen: (_p, state) => ['assembled', 'cutaway', 'service'].includes(state ?? 'assembled'),
  },
];
