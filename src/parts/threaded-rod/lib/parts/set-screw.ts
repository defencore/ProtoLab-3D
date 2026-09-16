import presetData from './set-screw.presets.json';
import type { Preset as ModulePreset } from '../../../../core/types';
const modulePresets = presetData as ModulePreset[];

import type { Parameters, PartDefinition, Preset } from '../../../../core/types';
import {
  buildFastenerGeometry,
  fastenerDimensions,
  fastenerParameters,
  fastenerPython,
  updateFastenerParameters,
  validateFastener,
} from '../core/fasteners';

const defaults: Parameters = {
  diameter: 2.5,
  length: 8,
  shankDiameter: 2.5,
  drive: 'hex',
  driveWidth: 1.3,
  driveThickness: 0.4,
  driveDepth: 1.2,
  driveSides: 5,
  threadMode: 'modeled',
  threadSpan: 'full',
  pitch: 0.45,
  handedness: 'right',
  threadStart: 0,
  threadLength: 6,
  tip: 'cone',
  tipLength: 1.25,
  tipDiameter: 0,
};

const part: PartDefinition = {
  id: 'set-screw',
  name: 'Set screw / grub screw',
  category: 'FASTENERS & THREADS',
  subgroup: 'BOLTS & SCREWS',
  icon: 'bolt',
  complexity: 'Drive, point & thread',
  description:
    'A headless fastener with a recessed drive and configurable cone, cup, flat, chamfered or dog point.',
  keywords: [
    'grub',
    'headless',
    'set screw',
    'goujon',
    'DIN 913',
    'DIN 914',
    'DIN 915',
    'ISO 4027',
    'cone point',
    'cup point',
    'dog point',
    'M2.5x8',
    'M2.5',
    'shaft collar',
  ],
  parameters: fastenerParameters(true),
  presetMatchKeys: ['diameter', 'drive', 'tip'],
  defaults,
  presets: modulePresets,
  validate: (p) => validateFastener(p, true),
  updateParameters: (p, changedKey) => updateFastenerParameters(p, changedKey, true),
  buildGeometry: (p) => buildFastenerGeometry(p, true),
  python: (p) => fastenerPython(p, true),
  dimensions: (p) => fastenerDimensions(p, true),
  notes:
    'Prototype reference, not a certified DIN 914 / ISO 4027 fastener. M2.5 × 8 uses the requested cone-point format, 0.45 mm pitch and a 1.3 mm hex socket. Material grade is not modeled. The thread is a truncated single-start 60° reference with no fit tolerances; cross and six-lobe drive forms are dimensional approximations. Overall length includes the point. Cup recesses are conical.',
  sources: [
    {
      label: 'Gvyntok cone-point set-screw dimensional grid',
      url: 'https://gvyntok.com/wp-content/uploads/2024/06/040-260-001.pdf',
    },
    {
      label: 'Requested M-Teh M2.5 × 8 cone-point set screw',
      url: 'https://m-teh.com.ua/ru/hvynt-nastanovnyi-m2.5kh8mm-shestyhr.-nerzh.-304-konus/',
    },
    {
      label: 'Böllhoff ISO 4027 reference dimensions',
      url: 'https://eshop-pl.boellhoff.com/out/media/pdf/ISO_4027_Edelstahl_A2___en.pdf',
    },
    {
      label: 'Aspen M2.5 cone-point dimensional reference',
      url: 'https://www.aspenfasteners.com/content/2D_PDF/product66/ME268-25045X3.PDF',
    },
  ],
};
export default { ...part, presets: modulePresets };
