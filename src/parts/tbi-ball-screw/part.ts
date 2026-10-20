import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { defaults, parameters, catalogSelection, catalogFilterFields } from './configurator';
import { build, recipe, validate, screwModel } from './lib/model';
import presets from './presets.json';
import product from './product.json';
const part: PartDefinition = {
  id: 'tbi-ball-screw',
  name: 'TBI ball screw and nut',
  category: 'LINEAR MOTION',
  subgroup: 'BALL SCREWS',
  icon: 'rail',
  product: product as ProductProfile,
  description:
    'Source-dimensioned SFU, SFNU and SFB screw/nut models with fixed mounting interfaces and editable unmachined shaft length.',
  complexity: '19 manufacturer dimensioned models',
  keywords: [
    'TBI',
    'ballscrew',
    'ball screw',
    'SFU',
    'SFNU',
    'SFB',
    '1204',
    '1205',
    '1210',
    '1604',
    '1605',
    '1610',
    '2005',
    '2010',
    '2505',
    '2510',
    '3205',
    '3210',
    'lead',
    'nut',
  ],
  preview: 'worker',
  parameters,
  defaults,
  catalogSelection,
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  presets: presets as Preset[],
  physicalStates: ['screw', 'nut'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Screw and nut at the configured travel position.',
    },
    { id: 'screw', label: 'Screw only', description: 'Unmachined right-hand customer-cut screw.' },
    {
      id: 'nut',
      label: 'Nut only',
      description: 'One source nut, centered at its axial midpoint.',
    },
  ],
  validate,
  buildGeometry: build,
  python: recipe,
  dimensions(p, s) {
    const m = screwModel(p);
    return s === 'screw'
      ? [m.diameter, m.diameter, Number(p.length)]
      : s === 'nut'
        ? [m.flangeWidth, m.flangeDiameter, m.nutLength]
        : [m.flangeWidth, m.flangeDiameter, Number(p.length)];
  },
  assessment(p) {
    const m = screwModel(p);
    return [
      `${m.code}: nominal diameter ${m.diameter} mm; lead ${m.lead} mm/rev; nut ${m.nutDiameter} x ${m.nutLength} mm.`,
      `Mounting: flange diameter ${m.flangeDiameter} mm, flats ${m.flangeWidth} mm, pitch circle ${m.mountCircle} mm, holes diameter ${m.mountHole} mm. Shaft ends are unmachined; choose the actual supplier accuracy, preload and end-machining drawing separately.`,
    ];
  },
  notes:
    'TBI Ball Screw catalog 25.02-1F, printed C73/C76. SFNU01605-4 is a 45 mm-long TBI nut, not a generic 50 mm SFU1605 envelope. SFB01205/01210 have four holes at 45/135/225/315 degrees; other included nuts use the six-hole 45/90-degree pattern. Shaft length is a customer cut, not a stock availability claim. Simple shows a smooth nominal screw; Full adds a representative lead-correct helical raceway. Nut bore running clearance, raceway contact section, internal return passages and lubrication port location/depth are not source-manufacturing dimensions. SFU01204-4 is supplied without a wiper. No BK/BF machining dimensions or accuracy/preload grade are inferred from the nominal size.',
  sources: [
    {
      label: 'TBI MOTION Ball Screw catalog 25.02-1F, C73/C76',
      url: 'https://i0528.tbimotion.com.tw/storage/pdf/TBIMOTION_BallScrew_25.02-1F%28EN%29.pdf',
    },
  ],
};
export default part;
