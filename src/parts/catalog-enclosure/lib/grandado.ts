import * as THREE from 'three';
import {
  box,
  cylinder,
  prism,
  roundedRect,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import {
  geometry as piecesGeometry,
  python as piecesPython,
  type Piece,
} from '../../../core/assembly/boundary/assembly';
import {
  grandadoBodyMeasurements,
  grandadoRimSpec,
  grandadoRimBand,
  grandadoRimFlange,
} from './grandado-rim';
export { grandadoBodyMeasurements, grandadoRimSpec } from './grandado-rim';

/** Published envelope plus delivered-sample measurements; unmeasured interfaces remain estimates. */
export const grandadoSpec = {
  bodyLength: 83,
  bodyWidth: 58,
  height: 35,
  earProjection: 13.5,
  screwCenters: [
    [-36.5, -24],
    [-36.5, 24],
    [36.5, -24],
    [36.5, 24],
  ],
  earCenters: [
    [-49.5, 0],
    [49.5, 0],
  ],
  pcbCenters: [
    [-31, 0],
    [31, 0],
    [-17, -20],
    [17, -20],
    [-17, 20],
    [17, 20],
  ],
  baseZ: -17.5,
  floorTop: -15.1,
  bodyTop: 4.5,
  bodyHardHeight: grandadoBodyMeasurements.bodyHardHeight,
  bodyIncludingRimHeight: grandadoBodyMeasurements.bodyIncludingRimHeight,
  sealingRimHeight: grandadoBodyMeasurements.sealingRimHeight,
  sealingRimTop: 6.3,
  lidBottom: 4.7,
  lidTop: 17.5,
  pcbBossTop: -10.1,
  pcbBossBoreBottom: -14.5,
  earZ: -17.5,
  earTop: -11.5,
  earThickness: grandadoBodyMeasurements.earThickness,
  lidLift: 26,
  screwShankRadius: 1.3,
  screwHeadRadius: 2.9,
  screwHeadHeight: 1.3,
  screwTipZ: 1.5,
  screwUnderHeadZ: 15.8,
  screwHeadTopZ: 17.1,
  screwBlindBottomZ: -6.5,
  insertBottomZ: -0.2,
  insertTopZ: 4.4,
  factoryGrooveWidth: 1.8,
  factoryGrooveDepth: 2,
  factoryOuterWall: 1.6,
  factoryInnerWall: 1,
  factoryGrooveFloorBacking: 1,
} as const;

const colors = { body: 0xe5e3dc, lid: 0xeeece5, brass: 0xb99449, screw: 0xb7bbc1 };
const s = grandadoSpec;
const atCorners = (radius: number, z: number, height: number): Shape[] =>
  s.screwCenters.map(([x, y]) => cylinder(radius, height, [x, y, z]));

/** Measured height and approximate uniform wall; corner/post profile remains estimated. */
export function grandadoRaisedRim(): Shape {
  return grandadoRimBand(grandadoRimSpec.wall, s.bodyTop, s.sealingRimHeight);
}

/** The unmeasured 2 mm backing joins the measured inboard rim to the estimated lower cavity. */
export function grandadoSupportLedge(): Shape {
  return grandadoRimFlange(
    s.bodyTop - grandadoRimSpec.supportLedgeHeight,
    grandadoRimSpec.supportLedgeHeight,
    grandadoRimSpec.wall / 2,
  );
}

function ear(side: -1 | 1): Shape {
  const z = s.earZ;
  const h = s.earTop - z;
  return union(
    prism(
      [
        [side * 39.5, -12.5],
        [side * 52, -4.9],
        [side * 52, 4.9],
        [side * 39.5, 12.5],
      ],
      h,
      z,
    ),
    cylinder(5.5, h, [side * 49.5, 0, z]),
  );
}

function body(): Shape {
  const height = s.bodyTop - s.baseZ;
  const shell = subtract(
    roundedRect(s.bodyLength, s.bodyWidth, 5, s.baseZ, height),
    roundedRect(78.6, 53.6, 2.8, s.floorTop, s.bodyTop - s.floorTop + 1),
  );
  const posts = atCorners(4.8, s.floorTop - 0.1, s.bodyTop - s.floorTop + 0.1);
  const pcbBosses = s.pcbCenters.map(([x, y]) =>
    cylinder(3.5, s.pcbBossTop - s.floorTop + 0.1, [x, y, s.floorTop - 0.1]),
  );
  return subtract(
    union(
      shell,
      ...posts,
      ...pcbBosses,
      ear(-1),
      ear(1),
      grandadoSupportLedge(),
      grandadoRaisedRim(),
    ),
    ...atCorners(2.15, s.screwBlindBottomZ, s.bodyTop - s.screwBlindBottomZ + 0.1),
    ...s.pcbCenters.map(([x, y]) =>
      cylinder(1.3, s.pcbBossTop - s.pcbBossBoreBottom + 0.2, [x, y, s.pcbBossBoreBottom]),
    ),
    ...s.earCenters.map(([x, y]) => cylinder(2, s.earTop - s.earZ + 0.4, [x, y, s.earZ - 0.2])),
  );
}

function lid(): Shape {
  const height = s.lidTop - s.lidBottom;
  const railX = s.bodyLength / 2 - s.factoryOuterWall - s.factoryGrooveWidth / 2;
  const railY = s.bodyWidth / 2 - s.factoryOuterWall - s.factoryGrooveWidth / 2;
  const shell = subtract(
    roundedRect(s.bodyLength, s.bodyWidth, 5, s.lidBottom, height),
    roundedRect(
      s.bodyLength - 2 * s.factoryOuterWall,
      s.bodyWidth - 2 * s.factoryOuterWall,
      5 - s.factoryOuterWall,
      s.lidBottom - 0.1,
      15.5 - s.lidBottom + 0.1,
    ),
  );
  return subtract(
    union(
      shell,
      ...atCorners(4.8, s.lidBottom, height),
      grandadoRimFlange(
        s.lidBottom,
        s.factoryGrooveDepth + s.factoryGrooveFloorBacking,
        s.factoryGrooveWidth / 2 + s.factoryInnerWall,
        railX,
        railY,
      ),
    ),
    grandadoRimBand(
      s.factoryGrooveWidth,
      s.lidBottom - 0.1,
      s.factoryGrooveDepth + 0.1,
      railX,
      railY,
    ),
    ...atCorners(2, s.lidBottom - 0.3, s.lidTop - s.lidBottom + 0.6),
    ...atCorners(3.4, 15.7, 2),
  );
}

function screw(x: number, y: number): Shape {
  return subtract(
    union(
      cylinder(s.screwShankRadius, s.screwUnderHeadZ - s.screwTipZ, [x, y, s.screwTipZ]),
      cylinder(s.screwHeadRadius, s.screwHeadHeight, [x, y, s.screwUnderHeadZ]),
    ),
    box([3.8, 0.8, 0.8], [x - 1.9, y - 0.4, 16.55]),
    box([0.8, 3.8, 0.8], [x - 0.4, y - 1.9, 16.55]),
  );
}

export function grandadoPieces(state: string): Piece[] {
  const lift = state === 'open' ? s.lidLift : 0;
  const pieces: Piece[] = [
    {
      label: 'Grandado measured lower body · raised sealing rim and 6 mm ears',
      color: colors.body,
      shape: body(),
    },
    {
      label: 'Grandado white lid · recessed screw holes',
      color: colors.lid,
      shape: lid(),
      z: lift,
    },
    ...s.screwCenters.map(([x, y], index): Piece => ({
      label: `Grandado brass lid insert ${index + 1}`,
      color: colors.brass,
      shape: subtract(
        cylinder(2, s.insertTopZ - s.insertBottomZ, [x, y, s.insertBottomZ]),
        cylinder(1.4, s.insertTopZ - s.insertBottomZ + 0.2, [x, y, s.insertBottomZ - 0.1]),
      ),
    })),
    ...s.screwCenters.map(([x, y], index): Piece => ({
      label: `Grandado lid screw ${index + 1}`,
      color: colors.screw,
      shape: screw(x, y),
      z: lift,
    })),
  ];
  if (state === 'body-only')
    return pieces.filter((_, index) => index === 0 || (index >= 2 && index < 6));
  if (state === 'body-with-screws') return pieces.filter((_, index) => index !== 1);
  return pieces;
}

export function grandadoGeometry(state: string): THREE.Group {
  const pieces = grandadoPieces(state);
  const group = piecesGeometry(pieces);
  group.children.forEach((piece, index) =>
    piece.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        const metal = pieces[index].color === colors.brass || pieces[index].color === colors.screw;
        material.metalness = metal ? 0.85 : 0.02;
        material.roughness = metal ? 0.32 : 0.5;
      }
    }),
  );
  return group;
}

export const grandadoPython = (state: string) => piecesPython(grandadoPieces(state));
export const grandadoDimensions = (state: string): [number, number, number] => [
  s.bodyLength + 2 * s.earProjection,
  s.bodyWidth,
  state === 'body-only'
    ? s.bodyIncludingRimHeight
    : state === 'body-with-screws'
      ? 34.6
      : s.height + (state === 'open' ? s.lidLift : 0),
];
