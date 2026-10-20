import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, cylinder, subtract } from '../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../core/assembly/boundary/assembly';
import product from './product.json';
import presets from './presets.json';
export const HGR20 = {
  width: 20,
  height: 17.5,
  pitch: 60,
  bore: 6,
  counterbore: 9.5,
  counterboreDepth: 8.5,
  maximumLength: 4000,
} as const;
export const guideSource = 'https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf';
export function railParameters(length = 1900): Parameters {
  return { model: 'hgr20', length };
}
export function railLayout(p: Parameters) {
  const length = Number(p.length),
    count = Math.floor((length - 10) / HGR20.pitch) + 1;
  const endOffset = (length - (count - 1) * HGR20.pitch) / 2;
  return { ...HGR20, length, endOffset, count, bottom: 0, top: HGR20.height };
}
export function railMountingHoles(p: Parameters): [number, number, number][] {
  const v = railLayout(p);
  return Array.from({ length: Math.max(0, v.count) }, (_, i) => [
    -v.length / 2 + v.endOffset + i * v.pitch,
    0,
    0,
  ]);
}
function pieces(p: Parameters): Piece[] {
  const v = railLayout(p);
  const tools = railMountingHoles(p).flatMap(([x]) => [
    cylinder(v.bore / 2, v.height + 2, [x, 0, -1]),
    cylinder(v.counterbore / 2, v.counterboreDepth + 1, [x, 0, v.height - v.counterboreDepth]),
  ]);
  // The catalog dimensions installation interfaces; undimensioned raceway radii remain illustrative.
  for (const side of [-1, 1])
    for (const z of [7, 12])
      tools.push(cylinder(1.1, v.length + 2, [-v.length / 2 - 1, side * 10, z], 'x'));
  return [
    {
      label: 'HIWIN HGR20 customer-cut rail',
      color: 0xa1a8ae,
      shape: subtract(
        box([v.length, v.width, v.height], [-v.length / 2, -v.width / 2, 0]),
        ...tools,
      ),
    },
  ];
}
const part: PartDefinition = {
  id: 'cnc-guide-rail',
  name: 'Profile guide rail',
  product: product as ProductProfile,
  category: 'LINEAR MOTION',
  subgroup: 'PROFILE RAILS',
  icon: 'rail',
  complexity: 'HGR20 customer-cut rail',
  description:
    'Reusable HGR20 rail with source mounting dimensions and an explicit customer-cut length.',
  keywords: ['CNC', 'HGR20', 'HIWIN', 'guide', 'rail', 'long travel'],
  defaults: railParameters(),
  catalogFilterFields: [
    {
      key: 'width',
      label: 'Rail width',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
      catalogSummary: true,
    },
    {
      key: 'height',
      label: 'Rail height',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
      catalogSummary: true,
    },
    {
      key: 'holePitch',
      label: 'Mounting pitch',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
    { key: 'bore', label: 'Mounting bore', type: 'number', group: 'Source dimensions', unit: 'mm' },
    {
      key: 'counterbore',
      label: 'Counterbore diameter',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
    {
      key: 'counterboreDepth',
      label: 'Counterbore depth',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
  ],
  parameters: [
    {
      key: 'model',
      label: 'Rail profile',
      type: 'select',
      group: 'Profile',
      options: [{ value: 'hgr20', label: 'HIWIN HGR20' }],
    },
    {
      key: 'length',
      label: 'Requested cut length',
      type: 'number',
      group: 'Order',
      unit: 'mm',
      min: 100,
      max: 4000,
      step: 1,
    },
  ],
  presets: presets as Preset[],
  validate(p) {
    const v = railLayout(p),
      errors: string[] = [];
    if (p.model !== 'hgr20') errors.push('Choose the HGR20 profile.');
    if (!Number.isFinite(v.length) || v.length < 100 || v.length > 4000)
      errors.push('Rail cut length must be 100–4000 mm.');
    if (v.endOffset < 5 || v.endOffset > 30 + 1e-8)
      errors.push('Choose a cut length leaving 5–30 mm symmetric mounting-hole end distances.');
    return errors;
  },
  buildGeometry: (p) => geometry(pieces(p)),
  python: (p) => python(pieces(p)),
  dimensions: (p) => [Number(p.length), 20, 17.5],
  assessment: (p) => [
    `Requested HGR20 cut length ${p.length} mm; derived symmetric hole end distance ${railLayout(p).endOffset} mm. Confirm this cut and accuracy/preload execution with the supplier.`,
  ],
  notes:
    'Native rail direction X, centre Y0, mounting base Z0. HIWIN G99TE22-2011 pp36–37 supplies the 20×17.5 profile, Ø6/Ø9.5×8.5 counterbores and 60 mm pitch. Rail length and symmetric end distance are customer order dimensions; stock availability is not asserted. The source recommends end distances no greater than half the pitch. Undimensioned raceway cross sections and small edge radii are illustrative installation geometry; this is not a rail manufacturing drawing.',
  sources: [
    { label: 'HIWIN HG dimension and cut-length tables, printed pp36–37', url: guideSource },
  ],
};
export default part;
