import { Group } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { n } from '../../core/geometry';
import {
  box,
  cylinder,
  union,
  subtract,
  component,
  pythonShape,
  type Shape,
} from '../../core/assembly/boundary/shapes';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';

/** PCB rear Z=0; origin is the optical axis, looking forward along +Z. */
export const ov9281Interface = {
  boardWidth: 25,
  boardHeight: 23.86,
  boardThickness: 1.6,
  boardTop: 8.86,
  boardBottom: -15,
  lensDiameter: 14,
  fixedProjection: 7.2,
  rearEnvelope: 1,
  mountingHoles: [-10.5, 10.5].flatMap((x) => [6.86, -5.64].map((y) => ({ x, y, diameter: 2.2 }))),
  auxiliaryHoles: [-9.2, 9.2].map((x) => ({ x, y: 0, diameter: 2.2 })),
  connector: {
    pins: 15,
    width: 17,
    height: 3.5,
    depth: 2.4,
    mouth: [0, -15, 2.8] as [number, number, number],
    exit: [0, -1, 0] as [number, number, number],
  },
  fieldOfView: { diagonal: 110, horizontal: 93, vertical: 70 },
  drawing:
    'https://www.waveshare.com/img/devkit/accBoard/OV9281-110-Camera/OV9281-110-Camera-details-size.jpg',
};

/** Source hole centers with explicitly authored rear-contact and population allowances. */
export const rearContactInterface = {
  pcbRearZ: 0,
  mountingHoles: ov9281Interface.mountingHoles.map((hole) => ({ ...hole, z: 0 })),
  contactButtonDiameter: 3,
  componentKeepoutDiameter: 3.4,
  populationReferenceDepth: ov9281Interface.rearEnvelope,
  supplierPadOuterDiameter: null,
  supplierRearComponentHeights: null,
  contactBasis: 'Official rear photograph shows bare annuli at the four outer mounting bores.',
  dimensionBasis:
    'D3 contact buttons, D3.4 rear-envelope reliefs and 1 mm population depth are authored fitting allowances.',
  drawingUrl: ov9281Interface.drawing,
  rearPhotoUrl: 'https://www.waveshare.com/media/catalog/product/o/v/ov9281-110-camera-4.jpg',
};

export function ov9281Shapes(p: Parameters): {
  pcb: Shape;
  rear: Shape;
  lens: Shape;
  connector: Shape;
} {
  const a = ov9281Interface;
  const holes = [...a.mountingHoles, ...a.auxiliaryHoles].map(({ x, y, diameter }) =>
    cylinder(diameter / 2, 3, [x, y, -1.1]),
  );
  return {
    pcb: subtract(box([25, 23.86, 1.6], [-12.5, -15, 0]), ...holes),
    rear: subtract(
      box([25, 23.86, 1.02], [-12.5, -15, -1]),
      ...holes,
      ...rearContactInterface.mountingHoles.map(({ x, y }) =>
        cylinder(
          rearContactInterface.componentKeepoutDiameter / 2,
          rearContactInterface.populationReferenceDepth + 0.4,
          [x, y, -rearContactInterface.populationReferenceDepth - 0.1],
        ),
      ),
    ),
    lens: union(
      box([14, 14, 7.22], [-7, -7, 1.58]),
      cylinder(7, n(p, 'focusExtension') + 0.02, [0, 0, 8.78]),
    ),
    connector: box([17, 3.5, 2.42], [-8.5, -15, 1.58]),
  };
}
export function ov9281Shape(p: Parameters): Shape {
  return union(...Object.values(ov9281Shapes(p)));
}

const part: PartDefinition = {
  id: 'waveshare-ov9281-110',
  name: 'Waveshare OV9281-110 camera',
  category: 'ELECTRONICS & VISION',
  subgroup: 'CAMERAS & VISION',
  icon: 'camera',
  complexity: 'Waveshare 21653 · 25 x 23.86 mm · global shutter',
  description:
    'Purchased monochrome OV9281-110 camera, SKU 21653, with supplier-dimensioned PCB, six D2.2 bores and a focus-adjustable D14 objective.',
  keywords: [
    'OV9281',
    'OV9281-110',
    '21653',
    'Waveshare',
    'global shutter',
    'monochrome',
    'CSI',
    'Raspberry Pi 5',
    'dual camera',
    '100 mm ribbon',
    'rocket nose',
  ],
  product: product as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['focusExtension'],
  validate(p) {
    return typeof p.focusExtension === 'number' &&
      Number.isFinite(p.focusExtension) &&
      p.focusExtension >= 7 &&
      p.focusExtension <= 10
      ? []
      : ['Use the supplier-drawn 7 to 10 mm manual-focus projection.'];
  },
  buildGeometry(p) {
    const s = ov9281Shapes(p);
    return new Group().add(
      component(s.pcb, 'OV9281 PCB and six D2.2 holes', 0x32634b),
      component(s.rear, 'Rear population reference with authored mounting reliefs', 0x444a50),
      component(s.lens, 'D14 objective and reference lens holder', 0x292d33),
      component(s.connector, '15-pin FFC connector envelope', 0xd4cbb5),
    );
  },
  python: (p) => `shape = ${pythonShape(ov9281Shape(p))}`,
  dimensions: (p) => [25, 23.86, 9.8 + n(p, 'focusExtension')],
  assessment: (p) => [
    'PCB 25 x 23.86 x 1.6 mm; optical axis 8.86 mm below the top edge. Four outer D2.2 mounting holes and two auxiliary D2.2 holes follow the supplier drawing.',
    `D14 lens; fixed projection 7.2 mm plus ${p.focusExtension} mm adjustable section. PCB rear Z=0; objective points +Z.`,
    '110 degrees diagonal, 93 horizontal and 70 vertical. The 14 mm holder, 17 x 3.5 x 2.4 mm connector and 1 mm rear population are conservative fitting envelopes, not dimensioned supplier component models.',
    'The rear photograph identifies four bare mounting annuli. D3.4 reliefs in the rear reference admit authored D3 contact buttons; actual pad outside diameter and rear component heights require delivered-part verification.',
    'For Pi 5 specify a compatible 100 mm 22-to-15-pin camera FFC. Stock leads are not included in this mechanical unit.',
  ],
  notes:
    'Supplier drawing defines PCB, bores, optical-axis offset, D14 objective and 7.2 plus 7 to 10 mm front stack. Holder square, FFC body and 1 mm rear population are explicitly authored envelopes. The official rear photograph supports four clear mounting zones; the D3.4 envelope relief and D3 contact-button contract are authored, with actual pad diameter unknown. Rear passives and the two factory lens-screw heads are not individually reconstructed. Hole coordinates use the optical axis and PCB rear as datums. Internal 0.02 mm overlaps fuse component envelopes without changing their outside dimensions. No supplied flexible cable or separate mounting hardware is included. Nominal geometry does not establish optical quality, cable pinout or simultaneous operation with an unidentified second sensor.',
  sources: [
    { label: 'Waveshare 21653 product', url: 'https://www.waveshare.com/ov9281-110-camera.htm' },
    { label: 'Manufacturer dimension drawing', url: ov9281Interface.drawing },
    {
      label: 'Official rear photograph: mounting annuli, passives and factory lens screws',
      url: rearContactInterface.rearPhotoUrl,
    },
    {
      label: 'Pi 5 and dual-camera connection',
      url: 'https://www.waveshare.com/wiki/OV9281-110_Camera',
    },
  ],
};
export default part;
