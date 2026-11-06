import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import detail from '../manufactured-detail/part';
import {
  componentDimensions,
  componentGeometry,
  componentPython,
} from '../../core/assembly/detail-instances';
import { defaults, parameters } from './configurator';
import { components, layout, pieces } from './lib/model';
import product from './product.json';
import presets from './presets.json';

const libraries = [detail];
const issues = [
  'Authored fit-calibration coupons, without a load, retention or service-life rating. Define application loads, material, print settings and measured fit before use.',
  'The round pin locates two transverse directions; rotation and axial withdrawal remain free. Add an independently checked retaining feature if required.',
];
const part: PartDefinition = {
  id: 'printed-pin-joint',
  name: 'Printed pin joint',
  category: 'FASTENERS & THREADS',
  subgroup: 'PRINTED JOINTS',
  description: 'Two printable coupons with a chamfered locating pin and a matching blind socket.',
  keywords: [
    '3D printing',
    'FDM',
    'FDM joint',
    'pin socket',
    'dowel',
    'peg',
    'alignment',
    'clearance',
    'printed connection',
  ],
  icon: 'bolt',
  complexity: 'Parametric fit coupon',
  preview: 'worker',
  product: product as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['pinDiameter', 'engagement', 'clearance'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Nominal engagement with the specified face and end gaps; no axial lock.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Socket withdrawn along the pin axis for inspection.',
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description: 'Separate pin-base-down and socket-opening-up parts on Z=0.',
    },
  ],
  validate(p, state) {
    const d = layout(p),
      errors: string[] = [];
    if (!['assembled', 'exploded', 'print'].includes(state))
      errors.push('Choose an implemented model state.');
    if (d.width / 2 - d.boreRadius < d.wall)
      errors.push('Coupon width must leave the specified minimum side wall around the socket.');
    if (d.chamfer >= d.r) errors.push('Pin chamfer must be smaller than the pin radius.');
    if (d.effectiveEngagement < Number(p.pinDiameter) / 2)
      errors.push('The straight engaged pin length must be at least half the pin diameter.');
    return errors;
  },
  composition: (p) => ({ components: components(p), issues }),
  buildGeometry: (p, s) => componentGeometry(libraries, pieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, pieces(p, s), true),
  python: (p, s) => componentPython(libraries, pieces(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, pieces(p, s)),
  assessment(p) {
    const d = layout(p);
    return [
      `Socket diameter ${(2 * d.boreRadius).toFixed(2)} mm; radial clearance ${(d.clearance / 2).toFixed(3)} mm; straight engagement ${d.effectiveEngagement.toFixed(2)} mm.`,
      ...issues,
    ];
  },
  notes:
    'Dimensions are authored prototype choices. Print and measure a clearance coupon before adapting the joint. A single round pin does not prevent rotation or provide axial retention.',
};
export default part;
