import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';

export const article = {
  id: 'amphenol-095-902-545-100',
  designation: '095-902-545-100',
  front: 8.49,
  rear: -10.01,
  flangeAF: 11,
  rearThreadDiameter: 6.35,
  rearFlatHeight: 5.85,
  openingDiameter: 6.6,
  openingHeight: 6.1,
  cableLength: 100,
  cableDiameter: 1.13,
  heatshrinkLength: 12.7,
  // Undimensioned installation envelopes, not measured manufacturer hardware.
  flangeThickness: 2,
  washerDiameter: 10.5,
  washerThickness: 0.5,
  nutAF: 8,
  nutThickness: 1.6,
  oRingDiameter: 7.8,
  oRingCompressedThickness: 0.4,
};
const hex = (af: number, height: number, z: number): Shape =>
  prism(
    Array.from({ length: 6 }, (_, i) => {
      const angle = Math.PI / 6 + (i * Math.PI) / 3;
      return [(af / Math.sqrt(3)) * Math.cos(angle), (af / Math.sqrt(3)) * Math.sin(angle)] as [
        number,
        number,
      ];
    }),
    height,
    z,
  );
const ring = (od: number, id: number, height: number, z: number) =>
  subtract(cylinder(od / 2, height, [0, 0, z]), cylinder(id / 2, height + 0.2, [0, 0, z - 0.1]));

/** +Z faces outside; flange rear seat is Z=0, with the single D-flat toward +Y. */
export function pieces(p: Parameters, state: string): Piece[] {
  const t = Number(p.panelThickness);
  const rear = subtract(cylinder(3.175, 9.3, [0, 0, -9.3]), box([20, 10, 10], [-10, 2.675, -10]));
  const body = subtract(
    union(
      rear,
      cylinder(2.65, 0.71, [0, 0, article.rear]),
      hex(article.flangeAF, article.flangeThickness, 0),
      cylinder(2.7, 2, [0, 0, 2]),
      cylinder(3.175, 4.49, [0, 0, 4]),
    ),
    cylinder(2.3, 4.5, [0, 0, 4.2]),
    cylinder(0.565, 1.2, [0, 0, -10.1]),
    // A separate compressed seal occupies this recessed groove, clear of the host panel.
    ring(article.oRingDiameter, 6.5, article.oRingCompressedThickness, 0),
  );
  return [
    {
      label: 'SMA female bulkhead body — analytical installation envelope',
      shape: body,
      color: 0xc7a65b,
    },
    {
      label: 'Recessed PTFE socket insulator — approximate',
      shape: ring(4.6, 1.3, 3.6, 4.2),
      color: 0xeee9d8,
    },
    {
      label: 'Female centre socket — approximate mating geometry',
      shape: ring(1.3, 0.9, 3.6, 4.2),
      color: 0xc7a65b,
    },
    {
      label: 'Compressed O-ring — approximate recessed band',
      shape: ring(article.oRingDiameter, 6.5, 0.4, 0),
      color: 0x353535,
      z: state === 'exploded' ? -3 : 0,
    },
    {
      label: 'Inner lock washer — approximate solid ring',
      shape: ring(
        article.washerDiameter,
        6.6,
        article.washerThickness,
        -t - article.washerThickness,
      ),
      color: 0xabb0b7,
      z: state === 'exploded' ? -6 : 0,
    },
    {
      label: 'Inner retaining nut — approximate 8 mm AF envelope',
      shape: subtract(
        hex(
          article.nutAF,
          article.nutThickness,
          -t - article.washerThickness - article.nutThickness,
        ),
        cylinder(3.3, 2, [0, 0, -t - article.washerThickness - article.nutThickness - 0.1]),
      ),
      color: 0xabb0b7,
      z: state === 'exploded' ? -10 : 0,
    },
  ];
}
