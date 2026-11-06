import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import detail from '../manufactured-detail/part';
import { defaults, parameters, catalogSelection } from './configurator';
import { configured, layout, validate } from './lib/model';
import presets from './presets.json';
import profile from './product.json';

const libraries = [detail];
const part: PartDefinition = {
  id: 'printed-snap-joint',
  name: 'Printed cantilever snap joint',
  category: 'FASTENERS & THREADS',
  subgroup: 'PRINTED JOINTS',
  icon: 'bracket',
  complexity: 'Printable calibration prototype',
  description:
    'Releasable cantilever latch coupon with a rounded root, 45-degree hook and open receiver.',
  keywords: [
    '3D printing',
    'FDM',
    'snap fit',
    'snap-fit',
    'cantilever',
    'latch',
    'clip',
    'printed joint',
  ],
  defaults,
  parameters,
  catalogSelection,
  presets: presets as Preset[],
  presetMatchKeys: ['length', 'width', 'thickness', 'hook', 'clearance'],
  identityParameters: ({ strainLimit: _strainLimit, ...physical }) => physical,
  product: profile as ProductProfile,
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Relaxed arm behind the receiver catch; assembly datum is the receiver floor.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Separate inspection positions; component identity and quantities remain unchanged.',
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description: 'Arm on its side and receiver floor down, separated on Z=0.',
    },
  ],
  validate,
  composition: (p) => ({
    components: configured(p).map((piece) => piece.component),
    issues: [
      'Calibration prototype: qualify polymer, print orientation, mating fit, working load and cycle life before production.',
    ],
  }),
  buildGeometry: (p, s) => componentGeometry(libraries, configured(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(p, s), true),
  python: (p, s) => componentPython(libraries, configured(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(p, s)),
  assessment: (p) => [
    `Nominal uniform-beam strain estimate: ${layout(p).strainPercent.toFixed(3)}% at ${p.hook} mm lift; user screening limit ${p.strainLimit}%. The estimate excludes local stress concentrations, material anisotropy and fatigue.`,
    `Insert the arm in +X. The hook lifts over the catch, then relaxes. Lift the exposed tip in +Z until the hook clears the catch and withdraw in -X. Uniform-beam tab-lift estimate: ${layout(p).tabLiftEstimate.toFixed(2)} mm for a full hook-depth lift. Side rails guide lateral position; this coupon does not establish a rated structural connection.`,
  ],
  notes:
    'Clearance is per mating side. Authored calibration dimensions have no supplier or strength certification. Root arcs and the 45-degree hook are actual modeled features. Print, measure and cycle-test the selected polymer and printer configuration.',
  sources: [
    {
      label: 'Protolabs Network: snap-fit design guidance',
      url: 'https://www.hubs.com/knowledge-base/how-design-snap-fit-joints-3d-printing/',
    },
    {
      label: 'Formlabs: 3D-printed snap-fit design and materials',
      url: 'https://formlabs.com/blog/designing-3d-printed-snap-fit-enclosures/',
    },
  ],
};
export default part;
