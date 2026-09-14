import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];

import type { Parameters, PartDefinition, Preset } from '../../core/types';
import { Mesh, MeshStandardMaterial } from 'three';
import { numberParameter } from '../../core/geometry';
import { din915ReferenceFiles } from './lib/catalog/din915';
import {
  buildFastenerGeometry,
  fastenerDimensions,
  fastenerParameters,
  fastenerPython,
  updateFastenerParameters,
  validateFastener,
} from './lib/core/fasteners';

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
  dogShoulderLength: 0,
  finish: 'plain',
};

const part: PartDefinition = {
  id: 'set-screw',
  name: 'Set screw / grub screw',
  category: 'FASTENERS',
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
    'DIN915',
    '12.9',
    'black steel',
    'ISO 4027',
    'cone point',
    'cup point',
    'dog point',
    'M2.5x8',
    'M2.5',
    'shaft collar',
  ],
  parameters: [
    ...fastenerParameters(true),
    {
      ...numberParameter(
        'dogShoulderLength',
        'Dog point shoulder chamfer',
        'a',
        'Point',
        0,
        10,
        0.05,
      ),
      visibleWhen: (p) => p.tip === 'dog',
      description:
        'Axial transition after the cylindrical point. Added to the dog cylinder length within overall L; the source does not specify this chamfer.',
    },
    {
      key: 'finish',
      label: 'Display finish',
      type: 'select',
      group: 'Appearance',
      options: [
        { value: 'plain', label: 'Plain metal' },
        { value: 'black', label: 'Black steel' },
      ],
      description:
        'Display color only. The listed material grade is retained in reference specifications.',
    },
  ],
  presetMatchKeys: ['diameter', 'drive', 'tip'],
  defaults,
  presets: modulePresets,
  validate: (p) => validateFastener(p, true),
  updateParameters: (p, changedKey) => updateFastenerParameters(p, changedKey, true),
  buildGeometry(p) {
    const model = buildFastenerGeometry(p, true);
    if (p.finish === 'black')
      model.traverse((object) => {
        if (object instanceof Mesh && object.material instanceof MeshStandardMaterial)
          object.material.color.set(0x34363b);
      });
    return model;
  },
  python: (p) =>
    fastenerPython(p, true) +
    (p.finish === 'black' ? '\ncomponent_colors = [(0.204, 0.212, 0.231)]' : ''),
  dimensions: (p) => fastenerDimensions(p, true),
  notes:
    'Prototype reference, not a certified fastener. M2.5 × 8 uses the requested DIN 914 cone-point format. DIN 915 black steel references retain the supplied M2–M16 dimension rows and stated grade 12.9. Their overall lengths and shoulder chamfers are editable prototype choices; the image supplies no stock lengths. Socket nominal sizes and printed tolerance intervals are retained separately, including source inconsistencies. Material strength is not modeled. The thread is a truncated single-start 60° reference with no fit tolerances. Overall length includes the point and its shoulder transition. Cup recesses are conical.',
  sources: [
    { label: 'User-supplied DIN 915 dimension table', url: din915ReferenceFiles.dimensions },
    { label: 'User-supplied DIN 915 black steel example', url: din915ReferenceFiles.photo },
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
