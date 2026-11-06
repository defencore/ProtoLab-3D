import { Group } from 'three';
import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  box,
  cylinder,
  subtract,
  roundedRect,
  component,
  pythonShape,
  type Shape,
} from '../../core/assembly/boundary/shapes';
import { defaults, parameters, catalogFilterFields } from './configurator';
import product from './product.json';
import presets from './presets.json';

/** Adapter face as shown in the manufacturer's dimension photo; socket is at +X. */
export const adapterInterface = {
  board: { length: 85, width: 56.5, thickness: 1.6 },
  bounds: { min: [-45.5, -28.25, 0], max: [42.5, 28.25, 8] },
  holes: [-19, 39].flatMap((x) => [-24.25, 24.75].map((y) => ({ x, y, diameter: 2.7, z: 0 }))),
  pi5Alignment: { translation: [0, 0.25, 0], rotation: [0, 0, 180] },
  ssd: {
    axis: [1, 0, 0],
    centerY: 9.95,
    socketPlaneX: 37.5,
    pcbBottomZ: 4,
    mountingX: [-42.5, -22.5, -4.5, 7.5],
    lengths: [80, 60, 42, 30],
    width: 22,
  },
  ribbonConnector: {
    min: [14, -9, 1.6],
    max: [19, 3, 3.2],
    heightEvidence: 'Authored low-profile envelope; no published connector height.',
    mouth: [19, -3, 2.4],
    exit: [1, 0, 0],
    widthAxis: [0, 1, 0],
    datumEvidence:
      'In-plane entry from +X toward the M.2 socket is visible in the official connected photo. Numerical mouth center follows the authored connector envelope, not a dimensioned mating drawing; actual contact and insertion depth remain unmeasured.',
    sourceUrl:
      'https://www.waveshare.com/img/devkit/accBoard/PCIe-TO-M.2-Board-D/PCIe-TO-M.2-Board-D-details-2.jpg',
    contactOrientation:
      'Align the triangle marks on the same side, as shown by the manufacturer; an exposed copper contact face is not inferred from the seated photograph.',
  },
  ribbonPassage: {
    min: [26, -12, 0],
    max: [30, 2, 1.6],
    evidence:
      'Photo-derived PCB routing opening already present in the library solid; exact contour and tolerances are not dimensioned.',
  },
} as const;

/** Loose included lead reference, separate from fixed adapter board geometry. */
export const adapterCableReference = {
  conductors: 16,
  nominalLength: 40,
  unit: 'mm',
  sourceUrl: 'https://www.waveshare.com/PCIe-TO-M.2-Board-D.htm',
  scope:
    'Nominal stock lead listed in the vendor package. Actual exposed lead, insertion lengths and selected cable belong to the host assembly data.',
} as const;

type Piece = { shape: Shape; label: string; color: number };
export function adapterPieces(): Piece[] {
  const pcb = subtract(
    roundedRect(85, 56.5, 3.5, 0, 1.6),
    ...adapterInterface.holes.map((h) => cylinder(h.diameter / 2, 3.6, [h.x, h.y, -1])),
    cylinder(10, 3.6, [0, -8, -1]),
    box([4, 14, 3.6], [26, -12, -1]),
  );
  const socket = subtract(
    box([8.5, 23, 6.4], [34, -1.55, 1.6]),
    box([9.5, 22, 1.2], [33.5, -1.05, 3.8]),
  );
  return [
    {
      shape: pcb,
      label: 'PCB with mounting holes and reference ventilation openings',
      color: 0x272d31,
    },
    { shape: socket, label: 'M-key socket · reference envelope', color: 0x24292e },
    ...[-42.5, -22.5, -4.5, 7.5].map((x, i) => ({
      shape: subtract(cylinder(3, 2.4, [x, 9.95, 1.6]), cylinder(1, 4.4, [x, 9.95, 0.6])),
      label: ['2280', '2260', '2242', '2230'][i] + ' SSD fixing position · reference',
      color: 0xb0a27e,
    })),
    {
      shape: box([5, 12, 1.6], [14, -9, 1.6]),
      label: '16-pin PCIe ribbon socket · low-profile reference envelope',
      color: 0xd8d8ca,
    },
    {
      shape: subtract(box([9, 6, 6], [21, -22, 1.6]), box([7, 4, 6], [22, -21, 2.6])),
      label: 'Auxiliary power socket · reference envelope',
      color: 0xd8d8ca,
    },
  ];
}

const part: PartDefinition = {
  id: 'waveshare-pcie-m2-d',
  name: 'Waveshare PCIe TO M.2 Board (D)',
  category: 'ELECTRONICS & VISION',
  subgroup: 'STORAGE & ADAPTERS',
  icon: 'circuit',
  complexity: 'Fixed Pi 5 NVMe adapter · 27709',
  description:
    'Top-mounted Raspberry Pi 5 NVMe adapter with a source-dimensioned mounting pattern and separate SSD fixing references.',
  keywords: [
    'Waveshare',
    'PCIe',
    'M.2',
    'NVMe',
    'SSD',
    'adapter board D',
    '27709',
    'Raspberry Pi 5',
    '2280',
    '2260',
    '2242',
    '2230',
    'nose payload',
    'camera cassette',
  ],
  product: product as ProductProfile,
  defaults,
  parameters,
  catalogFilterFields,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model', label: 'Adapter board' }],
  presetMatchKeys: ['model'],
  validate(p) {
    if (p.model !== 'pcie-m2-d') return ['Select the Waveshare PCIe TO M.2 Board (D).'];
    return Object.keys(p)
      .filter((key) => key !== 'model')
      .map((key) => 'Supplier dimensions are fixed; unsupported parameter: ' + key + '.');
  },
  buildGeometry: () =>
    new Group().add(
      ...adapterPieces().map((piece) => component(piece.shape, piece.label, piece.color)),
    ),
  python() {
    const pieces = adapterPieces();
    return [
      'components = []',
      ...pieces.map((p) => 'components.append((' + pythonShape(p.shape) + ').removeSplitter())'),
      'shape = Part.makeCompound(components)',
      'component_labels = ' + JSON.stringify(pieces.map((p) => p.label)),
      'component_colors = ' +
        JSON.stringify(
          pieces.map((p) => [
            ((p.color >> 16) & 255) / 255,
            ((p.color >> 8) & 255) / 255,
            (p.color & 255) / 255,
          ]),
        ),
    ].join('\n');
  },
  dimensions: () => [88, 56.5, 8],
  assessment: () => [
    'PCB bottom is Z=0; SSD socket is at +X. An 80 mm SSD reference spans X=-42.5..37.5, centered at Y=9.95, with PCB bottom Z=4. These seat and height values require measurement.',
    'For nominal Pi 5 source mounting holes X=-39/+19 and Y=+/-24.5, rotate the adapter 180 degrees about Z and translate +0.25 in Y before applying the stack height. The final connector and cooler clearances still require verification.',
    'No SSD, PCIe ribbon, power lead, cooler, loose standoffs or screws are included.',
  ],
  notes:
    'Reconstructed mechanical reference. Published PCB outline dimensions and mounting pitch come from the vendor dimension image. Datum offsets, board thickness, exact fan/slot contours, bore sizes and all component heights are authored or photo-derived. The 8 mm overall height is a conservative packing assumption. The outboard 2280 fixing boss projects 3 mm beyond the left PCB edge. This is not original manufacturer CAD, a mating drawing, an electrical design or an SSD compatibility test.',
  sources: [
    {
      label: 'Waveshare adapter product and SKU 27709',
      url: 'https://www.waveshare.com/product/modules/pcie-to-m.2-board-d.htm',
    },
    {
      label: 'Waveshare adapter dimension drawing',
      url: 'https://www.waveshare.com/img/devkit/accBoard/PCIe-TO-M.2-Board-D/PCIe-TO-M.2-Board-D-details-size.jpg',
    },
    {
      label: 'Waveshare adapter wiki',
      url: 'https://www.waveshare.com/wiki/PCIe_TO_M.2_Board_(D)',
    },
  ],
};
export default part;
