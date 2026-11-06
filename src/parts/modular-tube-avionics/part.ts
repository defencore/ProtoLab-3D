import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters } from './configurator';
import { libraries, configured, composition, initialize, issues, tubeReference } from './lib/model';
import product from './product.json';
import presets from './presets.json';
import { resolveTubeProfile, validateTubeProfile } from './lib/tube-interface';

export const states = [
  {
    id: 'assembled',
    label: 'Installed assembly',
    description: 'Canonical modular stack and actual library components.',
  },
  {
    id: 'cutaway',
    label: 'Tube cutaway',
    description: 'Half of the reference tube is hidden for inspection.',
  },
  {
    id: 'service',
    label: 'Service access',
    description:
      'Cover and fairing moved away for access; this view does not certify a removal path.',
  },
  {
    id: 'lower-cover',
    label: 'Lower cover · ELRS and antenna',
    description:
      'Inspect the removable lower cover with integral tie passages for the receiver and T antenna. Electronics envelopes are non-procured references.',
  },
  {
    id: 'cable-routes',
    label: 'Cable routes · 2 × Ø6',
    description:
      'Inspect both complete reserved bundle paths with covers hidden. Colored gauges are references, not procured wiring or a verified electrical harness.',
  },
  {
    id: 'print',
    label: 'Printable parts · multiple beds',
    description:
      'Individual PETG and TPU parts on Z=0. Separate the materials and beds in the slicer.',
  },
  {
    id: 'templates',
    label: 'Interface fit coupon',
    description:
      'Check modular keys, M3 clearance and the coupling seat before printing the full kit. Use modular-tube-marking-kit:d90-86 for tube windows and hole locations.',
  },
];
const part: PartDefinition = {
  id: 'modular-tube-avionics',
  name: 'Modular tube avionics',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'circuit',
  description:
    'Ø85.6 keyed PETG/TPU electronics modules for a Ø90/86 tube, removable compute nose and independently identified purchased components. Engineering reference pending physical and recovery load qualification.',
  complexity: 'Modular PETG / TPU · engineering reference',
  preview: 'worker',
  keywords: [
    'Grandado',
    '85.6',
    '90/86',
    'RPi 5',
    'NVMe',
    'F405 WING MINI',
    'LCH7',
    'modular',
    'tube',
    'template',
    'ELRS',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  product: product as ProductProfile,
  states,
  catalogSelection: [],
  presetMatchKeys: ['tubeProfile', 'cameraSetup'],
  catalogIdentityParameters: (p, preset) => ({ ...p, showTube: preset.parameters.showTube }),
  identityParameters(p) {
    const { module: _module, showTube: _tube, showElectronics: _electronics, ...physical } = p;
    return { ...physical, tubeProfile: resolveTubeProfile(p).id };
  },
  validate(p, state) {
    const errors: string[] = [];
    if (!states.some((candidate) => candidate.id === state))
      errors.push('Select a supported assembly or inspection view.');
    for (const key of Object.keys(p))
      if (!(key in defaults)) errors.push(`Unsupported modular avionics parameter: ${key}.`);
    for (const field of parameters) {
      const value = p[field.key];
      if (
        field.type === 'number' &&
        (typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < field.min! ||
          value > field.max!)
      )
        errors.push(`${field.label} is outside its finite range.`);
      if (field.type === 'boolean' && typeof value !== 'boolean')
        errors.push(`Choose ${field.label.toLowerCase()}.`);
      if (field.type === 'select' && !field.options?.some((option) => option.value === value))
        errors.push(`Choose ${field.label.toLowerCase()}.`);
    }
    return errors.length ? errors : validateTubeProfile(p);
  },
  initializeGeometry: initialize,
  composition,
  assemblyReferences: [
    {
      visibilityParameter: 'showTube',
      component: (p, state) => tubeReference(p, state)?.component,
    },
  ],
  buildGeometry: (p, s) => componentGeometry(libraries, configured(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(p, s, true), true),
  python: (p, s) => componentPython(libraries, configured(p, s, true)),
  dimensions: (p, s) => componentDimensions(libraries, configured(p, s)),
  exportDimensions: (p, s) => componentDimensions(libraries, configured(p, s, true)),
  standaloneCad(p, s) {
    const pieces = configured(p, s, true, { includeTube: true });
    return {
      python: componentPython(libraries, pieces),
      dimensions: componentDimensions(libraries, pieces),
    };
  },
  assessment: (p) => {
    const tube = resolveTubeProfile(p);
    return [
      'For reusable physical window and hole stencils, select modular-tube-marking-kit:d90-86. It is a separate workshop kit and does not add parts to this installed assembly.',
      `Tube profile ${tube.id}: OD ${tube.outerDiameter} / ID ${tube.innerDiameter} mm, wall ${tube.wallThickness} mm, insert Ø${tube.insertDiameter} mm and ${tube.insertDiametralClearance} mm total diametral clearance.`,
      'Both smooth curved covers are installed after axial insertion. Through-screw lengths are selected by the user.',
      'Three 6 mm square keys and matching 4.4 mm-deep sockets align each module interface. Radial tube screws provide axial retention; the keys do not carry an assigned parachute load.',
      ...issues,
    ];
  },
  notes:
    'See GUIDE.md for the design record, deliberate Grandado modification, exact component IDs and unresolved engineering evidence. Standalone FreeCAD copies include the tube reference in All and Flight assembly views. Use the Printable parts state for individual fabricated parts on multiple beds; each connected print must fit 256×256×256 mm.',
};
export default part;
