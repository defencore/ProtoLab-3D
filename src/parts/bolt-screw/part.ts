import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition, Parameters, Preset } from '../../core/types';

import { numberParameter } from '../../core/geometry';
import {
  buildFastenerGeometry,
  fastenerDimensions,
  fastenerParameters,
  fastenerPython,
  selectParameter,
  updateFastenerParameters,
  validateFastener,
} from './lib/core/fasteners';

const defaults: Parameters = {
  diameter: 6,
  length: 25,
  shankDiameter: 6,
  head: 'hex',
  headSize: 10,
  headHeight: 4,
  headSides: 6,
  flangeDiameter: 14.4,
  flangeThickness: 1.2,
  neckSize: 6,
  neckHeight: 3,
  countersinkAngle: 90,
  drive: 'none',
  driveWidth: 3,
  driveThickness: 0.9,
  driveDepth: 2,
  driveSides: 5,
  threadMode: 'modeled',
  threadSpan: 'full',
  pitch: 1,
  handedness: 'right',
  threadStart: 0,
  threadLength: 20,
  tip: 'chamfer',
  tipLength: 0.6,
  tipDiameter: 4,
};

const part: PartDefinition = {
  id: 'bolt-screw',
  name: 'Bolt & screw',
  category: 'FASTENERS',
  subgroup: 'BOLTS & SCREWS',
  icon: 'bolt',
  complexity: 'Head, drive & thread',
  description:
    'Choose the head, recessed drive, thread placement and point to build a complete custom fastener.',
  keywords: [
    'hex bolt',
    'screw',
    'countersunk',
    'pan',
    'round',
    'button',
    'socket cap',
    'Phillips',
    'slotted',
    'Allen',
    'six-lobe',
    'Torx',
    'thread',
    'left hand',
    'shoulder',
    'flange',
    'carriage',
    'square neck',
    'elevator',
    'furniture',
    'cheese',
    'DIN 933',
    'DIN 931',
    'DIN 960',
    'DIN 961',
    'DIN 6921',
    'DIN 603',
    'DIN 608',
    'DIN 15237',
    'DIN 912',
    'DIN 7991',
    'DIN 965',
    'DIN 7985',
    'DIN 967',
    'DIN 7420',
    'ISO 7380',
  ],
  parameters: [
    selectParameter('head', 'Head type', 'Head', [
      ['hex', 'Hexagonal'],
      ['countersunk', 'Countersunk'],
      ['pan', 'Pan / round'],
      ['button', 'Button'],
      ['socket-cap', 'Socket cap / cylindrical'],
      ['hex-flange', 'Hexagonal with flange'],
      ['button-flange', 'Button with flange'],
      ['pan-flange', 'Pan with flange'],
      ['carriage', 'Carriage / square neck'],
      ['countersunk-square', 'Countersunk / square neck'],
      ['elevator', 'Elevator / wide flat head'],
      ['cheese', 'Cheese / cylindrical'],
      ['polygon', 'Custom polygon'],
    ]),
    {
      ...numberParameter('headSize', 'Head size', 'dk', 'Head', 1.2, 150, 0.1),
      description:
        'Across flats for hexagonal and polygon heads; outside diameter for round heads.',
    },
    {
      ...numberParameter('headHeight', 'Head height', 'k', 'Head', 0.3, 60, 0.1),
      description:
        'Total head height, including any flange. A countersunk head may include a cylindrical rim above its conical underside.',
    },
    {
      ...numberParameter('headSides', 'Head sides', 'N', 'Head', 3, 16, 1),
      unit: '',
      visibleWhen: (p) => p.head === 'polygon',
    },
    {
      ...numberParameter('flangeDiameter', 'Flange diameter', 'dc', 'Head', 1.5, 200, 0.1),
      visibleWhen: (p) => ['hex-flange', 'button-flange', 'pan-flange'].includes(String(p.head)),
    },
    {
      ...numberParameter('flangeThickness', 'Flange thickness', 'c', 'Head', 0.1, 25, 0.1),
      visibleWhen: (p) => ['hex-flange', 'button-flange', 'pan-flange'].includes(String(p.head)),
    },
    {
      ...numberParameter('neckSize', 'Square neck across flats', 's', 'Neck', 1, 100, 0.1),
      visibleWhen: (p) => ['carriage', 'countersunk-square', 'elevator'].includes(String(p.head)),
    },
    {
      ...numberParameter('neckHeight', 'Square neck height', 'v', 'Neck', 0.1, 40, 0.1),
      visibleWhen: (p) => ['carriage', 'countersunk-square', 'elevator'].includes(String(p.head)),
    },
    {
      ...numberParameter('countersinkAngle', 'Countersink angle', 'α', 'Head', 30, 150, 1),
      unit: '°',
      visibleWhen: (p) => ['countersunk', 'countersunk-square'].includes(String(p.head)),
      description:
        'The conical underside uses this included angle; any remaining head height forms a cylindrical rim.',
    },
    ...fastenerParameters(false),
  ],
  presetMatchKeys: ['diameter', 'length', 'head', 'drive'],
  defaults,
  presets: modulePresets,
  validate: (p) => validateFastener(p),
  updateParameters: (p, changedKey) => updateFastenerParameters(p, changedKey),
  buildGeometry: (p) => buildFastenerGeometry(p),
  python: (p) => fastenerPython(p),
  dimensions: (p) => fastenerDimensions(p),
  notes:
    'Prototype geometry, not a DIN/ISO certification. Modeled threads use a truncated single-start 60° reference profile without fit tolerances or runout. Cross and six-lobe recesses are dimensional approximations, not certified Phillips or Torx tooling profiles. Rounded heads use a sampled dome profile. Slotted drives are closed pockets. Countersunk length includes the head; other bolt lengths are measured under the head. STL is a closed tessellation; FreeCAD cuts a swept helical groove into a solid blank.',
  sources: [
    {
      label: 'Gvyntok socket-cap dimensional grid',
      url: 'https://gvyntok.com/wp-content/uploads/2024/06/040-190-001.pdf',
    },
    {
      label: 'INDEX hex bolt size references',
      url: 'https://www.indexfix.com/wp-content/uploads/docs/catinsin21_en.pdf',
    },
    {
      label: 'Gvyntok bolt and screw catalog',
      url: 'https://gvyntok.com/product-category/bolty-i-vinty/',
    },
  ],
};
export default { ...part, presets: modulePresets };
