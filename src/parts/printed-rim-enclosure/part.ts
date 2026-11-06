import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import detail from '../manufactured-detail/part';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters, catalogSelection, updateParameters } from './configurator';
import { components, pieces, layout, validate } from './lib/model';
import product from './product.json';
import presets from './presets.json';
const libraries = [detail];
const issues = [
  'Empty authored enclosure template. Lay out actual boards, plugs, cables, heat paths and mounts before adapting it to a device.',
  'Rim features align the lid and overlap the seam; they do not latch it or establish a water/dust seal. Add separately verified retention and sealing if required.',
  'Qualify polymer, print process, wall stiffness, distortion, working loads and actual printed fits before release.',
];
const part: PartDefinition = {
  id: 'printed-rim-enclosure',
  name: 'Printed rim enclosure',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  description:
    'Empty printed box and lid with stepped, recessed tongue-and-groove or labyrinth perimeter seams.',
  icon: 'box',
  complexity: 'Parametric enclosure template',
  preview: 'worker',
  keywords: [
    '3D printed enclosure',
    'case',
    'housing',
    'rabbet',
    'step',
    'lip',
    'groove',
    'labyrinth',
    'interlock',
    'lid',
    'recess',
  ],
  product: product as ProductProfile,
  defaults,
  parameters,
  catalogSelection,
  updateParameters,
  presets: presets as Preset[],
  presetMatchKeys: ['model', 'width', 'depth', 'height', 'clearance'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'Lid shoulder seated on the base rim; the mating recess has positive side and end clearance.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Lid withdrawn along +Z for inspection; component identities and installed placements stay canonical.',
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description:
        'Base floor down and lid outer face down, separately placed on Z=0 with an 8 mm gap.',
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
      `Per-side clearance ${d.c} mm; rim engagement ${d.e} mm; overall assembled height ${(d.H + d.lidHeight).toFixed(2)} mm.`,
      p.model === 'groove'
        ? 'The perimeter tongue sits in a recessed channel; the thick lid has an inner underside panel.'
        : p.model === 'labyrinth'
          ? 'An outer skirt and separate inner rib overlap both sides of the base lip; no gasket or leak rating is provided.'
          : 'The outer lid skirt locates over the base inner lip; the planar shoulder limits insertion.',
      ...issues,
    ];
  },
  notes:
    'Author-designed empty shell templates, without purchased hardware, contents, ports, a latch or a sealing rating. All clearances require printer/material calibration. The three rim models implement different physical seam sections.',
  sources: [
    {
      label: 'Protolabs Network: enclosure layout and mating features',
      url: 'https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/',
    },
  ],
};
export default part;
