import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { geometry, python } from '../../core/assembly/boundary/assembly';
import { parameters, defaults, catalogSelection, catalogFilterFields } from './configurator';
import { guidePieces, guideLayout, validateGuide } from './lib/model';
import product from './product.json';
import presets from './presets.json';
const part: PartDefinition = {
  id: 'hiwin-profile-guide',
  name: 'HIWIN profile guide',
  category: 'LINEAR MOTION',
  subgroup: 'PROFILE RAILS',
  icon: 'rail',
  product: product as ProductProfile,
  description:
    'MGN/MGW miniature and HGH/HGW industrial guides with fixed source mounting dimensions, editable rail length and one to four carriages.',
  complexity: '30 manufacturer dimensioned models',
  keywords: [
    'HIWIN',
    'MGN7',
    'MGN9',
    'MGN12H',
    'MGN15',
    'MGW',
    'HGR15',
    'HGR20',
    'HGR25',
    'HGR30',
    'HGH20CA',
    'HGW20CC',
    'linear rail',
    'carriage',
    'guide',
    'miniature',
  ],
  preview: 'worker',
  parameters,
  defaults,
  catalogSelection,
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  presets: presets as Preset[],
  physicalStates: ['rail', 'carriage'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Ordered rail with the configured number and positions of carriages.',
    },
    { id: 'rail', label: 'Rail only', description: 'Independent customer-cut source rail.' },
    {
      id: 'carriage',
      label: 'One carriage',
      description: 'One purchased carriage at the source mounting-height datum.',
    },
  ],
  validate: validateGuide,
  buildGeometry: (p, s) => geometry(guidePieces(p, s)),
  python: (p, s) => python(guidePieces(p, s)),
  dimensions(p, s) {
    const v = guideLayout(p);
    return s === 'rail'
      ? [v.length, v.m.railWidth, v.m.railHeight]
      : s === 'carriage'
        ? [v.m.blockLength, v.m.width, v.m.height - v.m.bottom]
        : [v.length, v.m.width, v.m.height];
  },
  assessment(p) {
    const v = guideLayout(p);
    return [
      `${v.m.code}: rail ${v.m.railWidth} x ${v.m.railHeight} mm; carriage ${v.m.width} x ${v.m.blockLength} mm; assembly height ${v.m.height} mm.`,
      `Rail holes: ${v.holes} longitudinal stations, ${v.m.railRows} row(s), ${v.m.railPitch} mm pitch, symmetric end distance ${v.edge.toFixed(3)} mm. Confirm customer-cut length, end distances, accuracy and preload with the supplier.`,
    ];
  },
  notes:
    'HIWIN G99TE22-2011 pp37,41,86,87. Exact published mounting interfaces and envelopes; customer-cut length and block arrangement are editable. MGN/MGW conventional C/H executions are distinct from the newer -O models. MGW15 uses two rail-mounting rows 23 mm apart. HGH/HGW size25 has a 23 mm-wide rail; size30 has a 28 mm-wide rail. Mounting threads use source nominal diameters and depths. Undimensioned raceway shapes, cover/centre-body contours, channel clearance and internal rolling circuits are illustrative. This is a source-dimensioned installation model, not manufacturer CAD or a rail manufacturing drawing.',
  sources: [
    {
      label: 'HIWIN Linear Guideway catalog, G99TE22-2011',
      url: 'https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf',
    },
  ],
};
export default part;
