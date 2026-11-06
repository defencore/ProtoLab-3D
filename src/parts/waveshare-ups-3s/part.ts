import { Group } from 'three';
import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  box,
  cylinder,
  union,
  subtract,
  roundedRect,
  component,
  pythonShape,
  type Shape,
} from '../../core/assembly/boundary/shapes';
import { defaults, parameters, catalogFilterFields } from './configurator';
import product from './product.json';
import presets from './presets.json';

/** Local X follows the cell axes. Electronics face +Z; connectors face the holder at -Z. */
export const upsInterface = {
  board: { length: 93, width: 60, thickness: 1.6 },
  bounds: { min: [-46.5, -30, -21.5], max: [46.5, 30, 6.6] },
  holes: [-43, 43].flatMap((x) => [-23, 23].map((y) => ({ x, y, diameter: 3.1, z: 0 }))),
  cellSeats: [-19.5, 0, 19.5].map((y) => ({
    center: [0, y, -11.4],
    axis: [1, 0, 0],
    maximumLength: 67,
    referenceDiameter: 18.6,
  })),
  p28aPlacements: [-19.5, 0, 19.5].map((y) => ({
    translation: [-32.6, y, -11.4],
    rotation: [0, 90, 0],
  })),
} as const;

type Piece = { shape: Shape; label: string; color: number };
export function upsPieces(): Piece[] {
  const pcb = subtract(
    roundedRect(93, 60, 4.32, 0, 1.6),
    ...upsInterface.holes.map((h) => cylinder(h.diameter / 2, 3.6, [h.x, h.y, -1])),
  );
  const holder = subtract(
    box([77.8, 60, 21.5], [-38.9, -30, -21.5]),
    ...[-19.5, 0, 19.5].map((y) => box([67, 19.2, 20.5], [-33.5, y - 9.6, -22])),
  );
  return [
    { shape: pcb, label: 'PCB with manufacturer mounting pattern', color: 0x272d31 },
    {
      shape: holder,
      label: 'Empty three-cell holder · reconstructed open channels',
      color: 0x30343a,
    },
    {
      shape: box([8, 8, 5], [13, 10, 1.6]),
      label: 'Regulator inductor · reference envelope',
      color: 0x7f8587,
    },
    {
      shape: box([7, 7, 2], [-8, 0, 1.6]),
      label: 'Control package · reference envelope',
      color: 0x171b20,
    },
    // The manufacturer photos show these sockets on the battery face, outside the holder.
    ...[15, 5, -5, -15].map((y, i) => ({
      shape: box([5, 6, 7], [41, y - 3, -7]),
      label:
        [
          '5 V output terminal',
          'Battery series terminal',
          'Switch terminal',
          'Charge input terminal',
        ][i] + ' · reference envelope',
      color: 0xe6e4db,
    })),
    {
      shape: box([5, 10, 2.5], [-45.2, -16.6, -2.5]),
      label: 'I2C and auxiliary header · reference envelope',
      color: 0x262b31,
    },
    {
      shape: union(
        ...[-43.97, -41.43].flatMap((x) =>
          [-15.41, -12.87, -10.33, -7.79].map((y) =>
            box([0.64, 0.64, 6.5], [x - 0.32, y - 0.32, -9]),
          ),
        ),
      ),
      label: 'I2C and auxiliary header contacts · reference envelope',
      color: 0xc7b579,
    },
    {
      shape: union(box([5, 4, 1.8], [-45.2, -1.6, -1.8]), cylinder(1.1, 0.8, [-42.7, 0.4, -2.6])),
      label: 'BOOT button · reference envelope',
      color: 0xbfc0b7,
    },
  ];
}

const part: PartDefinition = {
  id: 'waveshare-ups-3s',
  name: 'Waveshare UPS Module 3S',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'BATTERIES & HOLDERS',
  icon: 'circuit',
  complexity: 'Fixed 93 × 60 mm board and holder',
  description:
    'Three-series-cell UPS board with an empty fitted holder and source-dimensioned mounting pattern, excluding removable cells and loose accessories.',
  keywords: [
    'Waveshare',
    'UPS',
    'Module 3S',
    '18650',
    '5V 5A',
    'Raspberry Pi 5',
    'battery backup',
    'nose payload',
    'camera cassette',
  ],
  product: product as ProductProfile,
  defaults,
  parameters,
  catalogFilterFields,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model', label: 'Module' }],
  presetMatchKeys: ['model'],
  validate(p) {
    if (p.model !== 'ups-module-3s') return ['Select the Waveshare UPS Module 3S.'];
    return Object.keys(p)
      .filter((key) => key !== 'model')
      .map((key) => 'Supplier dimensions are fixed; unsupported parameter: ' + key + '.');
  },
  buildGeometry: () =>
    new Group().add(
      ...upsPieces().map((piece) => component(piece.shape, piece.label, piece.color)),
    ),
  python() {
    const pieces = upsPieces();
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
  dimensions: () => [93, 60, 28.1],
  assessment: () => [
    'PCB bottom is Z=0; electronics face +Z. The four two-pin sockets, auxiliary header and BOOT button face -Z beside the empty holder. Holder extends to Z=-21.5; conservative electronics envelope reaches Z=6.6.',
    'Add three cells separately. Nominal P28A seats have centers X=0, Y=-19.5/0/+19.5, Z=-11.4 with cell axes parallel to X. These seat details are reconstructed and require fit verification.',
    'The source STEP mounting bores are D3.1; the wiki specifies nominal D3.0. Confirm actual screw clearance and insulating-panel spacing.',
  ],
  notes:
    'One purchased board and fitted holder unit. PCB outline, thickness, mounting pitch and lower holder envelope were measured from the official 2022 STEP. Holder channels, cell seats, components and connector envelopes are authored packaging geometry. Source STEP represents a filled holder envelope; this model opens it for separate cell occurrences. Cells, cables, charger, acrylic panels and loose screws are not included. This is not a wiring, load, thermal or fit approval.',
  sources: [
    {
      label: 'Waveshare UPS Module 3S specifications and resources',
      url: 'https://www.waveshare.com/wiki/UPS_Module_3S',
    },
    {
      label: 'Waveshare dimension drawing',
      url: 'https://www.waveshare.com/img/devkit/accBoard/UPS-Module-3S/UPS-Module-3S-details-size.jpg',
    },
    {
      label: 'Waveshare 2022 STEP envelope reference',
      url: 'https://files.waveshare.com/upload/3/38/UPS_Module_3Sstep.zip',
    },
    {
      label: 'Waveshare battery-face connector, header and BOOT layout',
      url: 'https://www.waveshare.net/photo/accBoard/UPS-Module-3S/UPS-Module-3S-3.jpg',
    },
  ],
};
export default part;
