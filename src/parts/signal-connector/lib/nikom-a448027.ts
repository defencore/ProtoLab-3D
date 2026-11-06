import { geometry, python, type Piece } from '../../../core/assembly/boundary/assembly';
import { box, roundedRect, subtract } from '../../../core/assembly/boundary/shapes';

export const nikomA448027 = {
  id: 'nikom-a448027',
  name: 'NIKOM A448027 · USB-C 6-pin panel receptacle',
  family: 'USB',
  contactType: 'socket',
  mounting: 'Panel · screw flange',
  sourceUrl: 'https://www.nikom.biz/ua/product_A448027.html',
  listingUrl: 'https://prom.ua/p2020699918-gnezdo-usb-type.html',
  listedDimensionsMm: [10, 7, 14],
  mountingHoleDiameterMm: 2.1,
  previewDimensionsMm: [14, 7, 10],
  datum: 'USB-C mouth centre at (0, 0, 0). +Z points outward. X follows the long flange edge.',
  limitations:
    'The supplier gives an unordered dimension triple and a nominal hole diameter. The photos show two flange holes. Hole centres, flange thickness, seating depth and a panel cutout remain unpublished. The model omits the two bores and uses illustrative shell, opening and rear-board geometry.',
} as const;

// Interpret the listed sizes for the display envelope only. The photos establish
// the flange, receptacle shell, visible tongue and rear PCB, without a drawing
// that resolves their individual sizes or the mounting-hole locations.
const [width, height, depth] = nikomA448027.previewDimensionsMm;
const flangeThickness = 1.4;
const shellDepth = 7.2;
const shell = roundedRect(9, 3.2, 1.55, -shellDepth, shellDepth);
const pieces: Piece[] = [
  {
    label: 'Panel flange · mounting-hole centres unresolved',
    color: 0x282a2a,
    shape: subtract(
      box([width, height, flangeThickness], [-width / 2, -height / 2, -flangeThickness]),
      shell,
    ),
  },
  {
    label: 'USB-C shell · illustrative envelope',
    color: 0x9a9fa2,
    shape: subtract(shell, roundedRect(8.4, 2.6, 1.25, -shellDepth - 0.1, shellDepth + 0.2)),
  },
  {
    label: 'Visible receptacle tongue · illustrative',
    color: 0x202426,
    shape: roundedRect(6.2, 0.7, 0.3, -shellDepth, shellDepth - 1.8),
  },
  {
    label: 'Rear breakout board · illustrative envelope',
    color: 0x28704d,
    shape: box([9, 1, depth - 3.2], [-4.5, -2.6, -depth]),
  },
];

export const nikomA448027Geometry = () => geometry(pieces);
export const nikomA448027Python = () => python(pieces);
