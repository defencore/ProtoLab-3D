import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  cylinder,
  roundedRect,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import boltPart from '../../bolt-screw/part';
import nutPart from '../../hex-nut/part';
import { layout } from './layout';

export const housingLibraries = [boltPart, nutPart];
export function housingLayout(p: Parameters) {
  const v = layout(p);
  const gearPocketRadius = v.gearTipRadius + v.gap;
  const boltX = Math.max(gearPocketRadius + 3.25, v.front.flangeOuter / 2 + 4.5);
  const xHalf = Math.max(boltX + 4.3, v.wormBearingEnd + 2);
  const yMin = -Math.max(gearPocketRadius, v.front.flangeOuter / 2) - v.wall;
  const yMax = v.centerDistance + v.wormBearing.flangeOuter / 2 + v.wall;
  const minimumBaseBottom = Math.min(
    v.innerBottom - v.wall,
    -v.wormBearing.flangeOuter / 2 - v.wall,
  );
  const lidTop = Math.max(v.frontTop + 1, v.wormBearing.flangeOuter / 2 + v.wall);
  const screwLength = 2 * Math.ceil((lidTop - minimumBaseBottom) / 2);
  // Standard even-length countersunk screws finish inside the lower recess.
  const baseBottom = lidTop - screwLength - 0.25;
  const boltPositions = [-1, 1].flatMap((x) =>
    [-5, 5].map((y): [number, number] => [x * boltX, y]),
  );
  const locatorPositions: [number, number][] = [
    [-boltX, 0],
    [boltX, 0],
  ];
  const depth = lidTop - baseBottom;
  return {
    xHalf,
    yMin,
    yMax,
    width: 2 * xHalf,
    height: yMax - yMin,
    centerY: (yMin + yMax) / 2,
    baseBottom,
    lidTop,
    depth,
    splitZ: 0,
    cornerRadius: 4,
    gearPocketRadius,
    pocketBottom: v.innerTop,
    pocketTop: v.frontBottom,
    wormPocketRadius: 5.2,
    wormPocketEnd: v.wormBearingStart,
    boltPositions,
    screwLength,
    screwClearance: 3.2,
    nutBottom: baseBottom + 0.2,
    nutHeight: 2.4,
    nutPocketAF: 5.9 + Number(p.housingJoinClearance),
    nutCornerRadius: 1.5,
    locatorPositions,
    locatorDiameter: 4,
    locatorHeight: 1.2,
    locatorDepth: 1.4,
    locatorClearance: Number(p.housingJoinClearance),
  };
}
const move = (child: Shape, translation: Vec): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation: [0, 0, 0],
});

/** Rounded hexagon, flats normal to X. R1.5 corners accept a Ø3 end mill. */
export function nutPocket(af: number, radius: number, z: number, height: number): Shape {
  const r = af / Math.sqrt(3),
    tangent = radius / Math.sqrt(3);
  const corners = Array.from({ length: 6 }, (_, i) => {
    const angle = Math.PI / 6 + (i * Math.PI) / 3;
    const vertex: [number, number] = [r * Math.cos(angle), r * Math.sin(angle)];
    const neighbor = (a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
    const before = neighbor(angle - Math.PI / 3),
      after = neighbor(angle + Math.PI / 3);
    const along = (point: [number, number]): [number, number] => [
      vertex[0] + ((point[0] - vertex[0]) * tangent) / r,
      vertex[1] + ((point[1] - vertex[1]) * tangent) / r,
    ];
    const center: [number, number] = [
      vertex[0] - (radius / Math.cos(Math.PI / 6)) * Math.cos(angle),
      vertex[1] - (radius / Math.cos(Math.PI / 6)) * Math.sin(angle),
    ];
    const arc: [number, number][] = Array.from({ length: 7 }, (_, j) => {
      const a = angle - Math.PI / 6 + (j * Math.PI) / 18;
      return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
    });
    return { before: along(before), after: along(after), arc };
  });
  return {
    kind: 'curve-loft',
    segments: corners.flatMap((c, i) => [
      { kind: 'line' as const, points: [corners[(i + 5) % 6].after, c.before] },
      { kind: 'arc' as const, points: c.arc },
    ]),
    layers: [
      { scale: 1, angle: 0, z },
      { scale: 1, angle: 0, z: z + height },
    ],
  };
}
function headPocket(x: number, y: number, face: number): Shape {
  return move(
    {
      kind: 'revolve',
      profile: [
        [0, face - 1.8],
        [1.6, face - 1.8],
        [3.1, face - 0.2],
        [3.1, face + 0.1],
        [0, face + 0.1],
      ],
    },
    [x, y, 0],
  );
}
export function housingShapes(p: Parameters): { base: Shape; lid: Shape } {
  const v = layout(p),
    h = housingLayout(p),
    seat = v.seatClearance / 2;
  // Every pocket opens at the split, an exterior Z face, or a worm shaft end.
  // The worm trough is a ball-end/form-milled semicircle in each half.
  const cuts: Shape[] = [
    cylinder(h.gearPocketRadius, h.pocketTop - h.pocketBottom, [0, 0, h.pocketBottom]),
    cylinder(h.wormPocketRadius, 2 * h.wormPocketEnd, [-h.wormPocketEnd, v.centerDistance, 0], 'x'),
    cylinder(v.front.outer / 2 + seat, h.lidTop - v.frontBottom + 1, [0, 0, v.frontBottom]),
    cylinder(v.front.flangeOuter / 2 + seat, h.lidTop - (v.frontTop - v.front.flangeWidth) + 1, [
      0,
      0,
      v.frontTop - v.front.flangeWidth,
    ]),
    cylinder(v.inner.outer / 2 + seat, v.innerTop - h.baseBottom + 1, [0, 0, h.baseBottom - 1]),
    cylinder(
      v.inner.flangeOuter / 2 + seat,
      v.innerBottom + v.inner.flangeWidth - h.baseBottom + 1,
      [0, 0, h.baseBottom - 1],
    ),
    ...[-1, 1].flatMap((s) => [
      cylinder(
        v.wormBearing.outer / 2 + seat,
        h.xHalf - v.wormBearingStart + 1,
        [s < 0 ? -h.xHalf - 1 : v.wormBearingStart, v.centerDistance, 0],
        'x',
      ),
      cylinder(
        v.wormBearing.flangeOuter / 2 + seat,
        h.xHalf - v.wormBearingEnd + v.wormBearing.flangeWidth + 1,
        [s < 0 ? -h.xHalf - 1 : v.wormBearingEnd - v.wormBearing.flangeWidth, v.centerDistance, 0],
        'x',
      ),
    ]),
    ...h.boltPositions.map(([x, y]) =>
      cylinder(h.screwClearance / 2, h.depth + 2, [x, y, h.baseBottom - 1]),
    ),
  ];
  const shell = (z: number, depth: number) =>
    move(roundedRect(h.width, h.height, h.cornerRadius, z, depth), [0, h.centerY, 0]);
  return {
    base: subtract(
      union(
        shell(h.baseBottom, -h.baseBottom),
        ...h.locatorPositions.map(([x, y]) =>
          cylinder(h.locatorDiameter / 2, h.locatorHeight + 0.1, [x, y, -0.1]),
        ),
      ),
      ...cuts,
      ...h.boltPositions.map(([x, y]) =>
        move(nutPocket(h.nutPocketAF, h.nutCornerRadius, h.baseBottom - 1, h.nutHeight + 1.2), [
          x,
          y,
          0,
        ]),
      ),
    ),
    lid: subtract(
      shell(0, h.lidTop),
      ...cuts,
      ...h.boltPositions.map(([x, y]) => headPocket(x, y, h.lidTop)),
      ...h.locatorPositions.map(([x, y]) =>
        cylinder((h.locatorDiameter + h.locatorClearance) / 2, h.locatorDepth + 0.1, [x, y, -0.1]),
      ),
    ),
  };
}
export function housingHardware(p: Parameters): ConfiguredPiece[] {
  const h = housingLayout(p),
    tipZ = h.lidTop - h.screwLength;
  return h.boltPositions.flatMap(([x, y], i) => {
    const bolt: Parameters = {
      ...boltPart.defaults,
      diameter: 3,
      shankDiameter: 3,
      length: h.screwLength,
      head: 'countersunk',
      headSize: 6,
      headHeight: 1.7,
      countersinkAngle: 90,
      drive: 'hex',
      driveWidth: 2,
      driveDepth: 0.6,
      driveThickness: 0.5,
      pitch: 0.5,
      handedness: 'right',
      tip: 'flat',
      threadMode: 'envelope',
      threadSpan: 'full',
    };
    const nut: Parameters = {
      ...nutPart.defaults,
      bore: 3,
      acrossFlats: 5.5,
      height: h.nutHeight,
      pitch: 0.5,
      handedness: 'right',
      threadAllowance: 0.04,
    };
    return [
      {
        component: {
          id: `case-screw-${i + 1}`,
          libraryId: boltPart.id,
          name: `DIN 7991 M3×${h.screwLength} case joining screw`,
          parameters: bolt,
          state: boltPart.states?.[0]?.id ?? 'default',
          quantity: 1,
          supply: boltPart.product.supply,
          placement: {
            translation: [x, y, h.lidTop - h.screwLength / 2] as Vec,
            rotation: [0, 0, (360 * (tipZ - h.nutBottom)) / 0.5] as Vec,
          },
          procurement: {
            designation: `DIN 7991 M3×${h.screwLength}`,
            manufacturer: 'Standard hardware',
            source: 'Select actual screw grade and supplier',
          },
        },
        label: `Case joining screw ${i + 1}`,
        color: 0xa7afb7,
        preserveLibraryAppearance: true,
      },
      {
        component: {
          id: `case-nut-${i + 1}`,
          libraryId: nutPart.id,
          name: 'DIN 934 M3 captive case nut',
          parameters: nut,
          state: nutPart.states?.[0]?.id ?? 'default',
          quantity: 1,
          supply: nutPart.product.supply,
          placement: { translation: [x, y, h.nutBottom] as Vec, rotation: [0, 0, 0] as Vec },
          procurement: {
            designation: 'DIN 934 M3',
            manufacturer: 'Standard hardware',
            source: 'Select actual nut grade and supplier',
          },
        },
        label: `Captive case nut ${i + 1}`,
        color: 0xa7afb7,
        preserveLibraryAppearance: true,
      },
    ];
  });
}
