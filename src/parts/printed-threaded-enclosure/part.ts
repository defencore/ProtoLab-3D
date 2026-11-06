import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import shell from '../printed-threaded-shell/part';
import { defaults, parameters } from './configurator';
import { components, configured } from './lib/model';
import presets from './presets.json';
import product from './product.json';
const libraries = [shell];
const part: PartDefinition = {
  id: 'printed-threaded-enclosure',
  name: 'Printed screw-cap enclosure',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  product: product as ProductProfile,
  icon: 'box',
  complexity: 'Coarse helical enclosure prototype',
  description:
    'Complete empty can and screw-on lid with actual printable helices, a planar shoulder stop and positive neck-to-roof clearance.',
  keywords: [
    '3D printing',
    'screw interlock',
    'printed screw joint',
    'threaded enclosure',
    'screw cap',
    'jar',
    'interlock',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['diameter', 'pitch', 'height', 'clearance'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Right-hand cap seated on the body shoulder with matching thread phase.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Cap above the neck for inspection; no change in physical part definitions.',
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description:
        'Can floor down and cap closed face down, separated by 8 mm on Z=0. Actual helices remain in STL.',
    },
  ],
  validate(p, s) {
    const errors = ['assembled', 'exploded', 'print'].includes(s)
      ? []
      : ['Select an implemented model state.'];
    return [
      ...errors,
      ...shell.validate({ ...p, model: 'body' }, 'default'),
      ...shell.validate({ ...p, model: 'cap' }, 'default'),
    ];
  },
  composition: (p) => ({
    components: components(p),
    issues: [
      'Authored empty enclosure: define actual equipment layout, loads, heat paths, ports and attachment interfaces before application use.',
      'Calibrate printed thread fit and qualify operating torque, creep and cycle life. No detent, gasket, pressure or ingress rating is provided.',
    ],
  }),
  buildGeometry: (p, s) => componentGeometry(libraries, configured(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(p, s), true),
  python: (p, s) => componentPython(libraries, configured(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(p, s)),
  assessment: (p) => [
    `Right-hand single-start lead ${p.pitch} mm/revolution. Unscrewing the cap by angle theta requires simultaneous +Z lift ${p.pitch} × theta / 360 mm.`,
    `Female radial thread allowance ${p.clearance} mm; neck-to-roof clearance ${p.roofGap} mm. The planar shoulder establishes the seated axial position.`,
  ],
  notes:
    'Essential helical geometry is retained in both Simple and Full and in STL. The examples are authored design dimensions, not supplier products or ISO fit gauges. Rotate the cap counterclockwise as viewed from above while lifting to remove; axial pull alone is intentionally blocked by the thread.',
  sources: [
    {
      label: 'Formlabs: design options for printed screw threads',
      url: 'https://formlabs.com/blog/adding-screw-threads-3d-printed-parts/',
    },
  ],
};
export default part;
