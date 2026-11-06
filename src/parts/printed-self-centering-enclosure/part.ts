import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import detail from '../manufactured-detail/part';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters, catalogSelection } from './configurator';
import { layout, components, pieces, validate } from './lib/model';
import product from './product.json';
import presets from './presets.json';
const libraries = [detail];
const issues = [
  'Empty authored enclosure template. Lay out real boards, connectors, cables, mounts and thermal paths before finalizing a device enclosure.',
  'Tapered entry assists alignment; final straight-guide clearance leaves play. No zero-play centering, latch, sealing or self-locking function is claimed.',
  'Qualify dimensional accuracy, corner contact, friction, warpage, wall stiffness and actual service loads on printed samples.',
];
const part: PartDefinition = {
  id: 'printed-self-centering-enclosure',
  name: 'Printed self-centering enclosure',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  description:
    'Empty box with a taper-guided lid, relieved locating corners and a separate planar insertion stop.',
  keywords: [
    '3D printed enclosure',
    'self centering',
    'self-centering',
    'tapered',
    'lead in',
    'lid',
    'pilot',
    'case',
    'housing',
    'alignment',
    'interlock',
  ],
  icon: 'box',
  complexity: 'Taper-guided enclosure template',
  preview: 'worker',
  product: product as ProductProfile,
  defaults,
  parameters,
  catalogSelection,
  presets: presets as Preset[],
  presetMatchKeys: ['width', 'depth', 'height', 'rimDepth', 'clearance'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'Planar lid shoulder seated on the rim with the straight pilot inside the opening.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Lid fully withdrawn in +Z for inspection; installed project composition remains unchanged.',
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description: 'Base floor down and lid outer face down, separated on Z=0 with an 8 mm gap.',
    },
  ],
  validate,
  composition: (p) => ({ components: components(p), issues }),
  buildGeometry: (p, s) => componentGeometry(libraries, pieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, pieces(p, s), true),
  python: (p, s) => componentPython(libraries, pieces(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, pieces(p, s)),
  assessment(p) {
    const d = layout(p);
    return [
      `45-degree tip guide: nominal initial capture reach +/-${d.capture.toFixed(2)} mm in X or Y; taper correction range ${d.a.toFixed(2)} mm per side.`,
      `Final straight section ${d.straight.toFixed(2)} mm; nominal residual translation +/-${d.c.toFixed(2)} mm in either lateral axis. The shoulder stops axial insertion.`,
      ...issues,
    ];
  },
  notes:
    'The four planar lead-in faces assist alignment during insertion. Actual correction depends on friction and freedom of the lid to move; corner relief and finite guide clearance do not establish a precision kinematic coupling. No lid retention or environmental rating is provided.',
  sources: [
    {
      label: 'Protolabs Network: enclosure alignment and printed mating features',
      url: 'https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/',
    },
  ],
};
export default part;
