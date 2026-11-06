import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { cassetteContactSpec } from './cassette';
import { discCableReliefs } from './cable-routing';
import { layout, move, antennaRelief, type HardwareDescriptor, type PrintedPiece } from './spec';

const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
const radial = (shape: Shape, angle: number) => move(shape, [0, 0, 0], [-angle, 0, 0]);
const point = (x: number, radius: number, angle: number): Vec => [
  x,
  radius * Math.sin((angle * Math.PI) / 180),
  radius * Math.cos((angle * Math.PI) / 180),
];

export function endRetainerSpec(p: Parameters) {
  const d = layout(p),
    c = cassetteContactSpec(p);
  const positivePockets = c.endKeyPockets.filter((v) => v.min[0] > 0);
  const coreHalfLength = c.coreHalfLength;
  return {
    ...d,
    coreHalfLength,
    centersX: [-d.endMountX, d.endMountX],
    thickness: 16,
    shoulderRadius: Math.min(37.7, d.cassetteRadius - 5),
    shoulderLength: d.endMountX - 8 - coreHalfLength,
    nutInnerRadius: d.endDiscNutInnerRadius,
    nutOuterRadius: d.endDiscNutOuterRadius,
    screwLength: 12,
    screwHeadTopRadius: d.screwTop,
    screwTipRadius: d.screwTop - 12,
    angles: [0, 90, 180, 270],
    positivePockets,
    minimumAxialNutWall: 8 - d.nutAF / Math.sqrt(3),
    radialNutRoof: d.innerRadius - d.endDiscNutOuterRadius,
  };
}
type DiscSpec = ReturnType<typeof endRetainerSpec>;

function hexPocket(s: DiscSpec, x: number): Shape {
  return move(
    prism(
      Array.from({ length: 6 }, (_, i): [number, number] => {
        const angle = ((i + 0.5) * Math.PI) / 3;
        return [
          (s.nutAF / Math.sqrt(3)) * Math.cos(angle),
          (s.nutAF / Math.sqrt(3)) * Math.sin(angle),
        ];
      }),
      s.nutHeight,
      s.nutOuterRadius - s.nutHeight,
    ),
    [x, 0, 0],
  );
}

function disc(p: Parameters, sign: -1 | 1): Shape {
  const s = endRetainerSpec(p),
    x = sign * s.endMountX;
  const outerFace = x + (sign * s.thickness) / 2;
  const innerFace = sign * (s.endMountX - s.thickness / 2);
  const body: Shape = {
    kind: 'cylinder',
    radius: s.cassetteRadius,
    height: s.thickness,
    origin: [x - s.thickness / 2, 0, 0],
    axis: 'x',
    previewSegments: 128,
  };
  const contactPads = s.angles.map((angle) =>
    radial(
      intersect(
        cylinder(s.innerRadius, s.thickness, [x - s.thickness / 2, 0, 0], 'x'),
        box([s.thickness, 16, 13], [x - s.thickness / 2, -8, s.innerRadius - 12.5]),
      ),
      angle,
    ),
  );
  const shoulder = cylinder(
    s.shoulderRadius,
    s.shoulderLength,
    [sign > 0 ? s.coreHalfLength : innerFace, 0, 0],
    'x',
  );
  const keys = s.positivePockets.map((pocket) => {
    const minimum: Vec = [
      sign > 0 ? pocket.min[0] + 0.3 : innerFace - 0.2,
      pocket.min[1] + 0.3,
      pocket.min[2] + 0.3,
    ];
    const maximum: Vec = [
      sign > 0 ? innerFace + 0.2 : -pocket.min[0] - 0.3,
      pocket.max[1] - 0.3,
      pocket.max[2] - 0.3,
    ];
    return box(maximum.map((v, i) => v - minimum[i]) as Vec, minimum);
  });
  const cuts = s.angles.flatMap((angle) => [
    radial(
      cylinder(s.mountHole / 2, s.innerRadius - s.screwTipRadius + 3, [x, 0, s.screwTipRadius - 1]),
      angle,
    ),
    radial(hexPocket(s, x), angle),
    radial(
      box(
        [s.thickness / 2 + 0.2, (2 * s.nutAF) / Math.sqrt(3), s.nutHeight],
        [sign > 0 ? x : outerFace - 0.2, -s.nutAF / Math.sqrt(3), s.nutOuterRadius - s.nutHeight],
      ),
      angle,
    ),
  ]);
  return subtract(
    union(body, shoulder, ...contactPads, ...keys),
    ...cuts,
    ...antennaRelief(s),
    ...discCableReliefs(p),
  );
}

export function endRetainerPieces(p: Parameters): PrintedPiece[] {
  return ([-1, 1] as const).map((sign) => {
    const shape = disc(p, sign),
      side = sign > 0 ? 'positive' : 'negative';
    return {
      id: `end-disc-${side}`,
      label: `Solid ${side}-X end disc · four radial anchors`,
      shape,
      printShape: move(shape, [0, 0, 0], [0, sign * 90, 0]),
      color: 0x6d8c9a,
      role: 'cassette',
    };
  });
}

export function endRetainerHardware(p: Parameters): HardwareDescriptor[] {
  const s = endRetainerSpec(p);
  return ([-1, 1] as const).flatMap((sign) =>
    s.angles.flatMap((angle) => {
      const x = sign * s.endMountX,
        id = `disc-${sign > 0 ? 'positive' : 'negative'}-${angle}`;
      return [
        {
          id: `${id}-screw`,
          label: 'M3 × 12 DIN 7991 countersunk end-disc anchor',
          kind: 'screw' as const,
          diameter: 3,
          head: 'countersunk' as const,
          length: s.screwLength,
          headSize: 6,
          headHeight: 1.7,
          driveWidth: 2,
          driveDepth: 1.2,
          pitch: 0.5,
          translation: point(x, s.screwHeadTopRadius - s.screwLength / 2, angle),
          rotation: [-angle, 0, 0] as Vec,
        },
        {
          id: `${id}-nut`,
          label: 'M3 hex nut · massive end-disc capture',
          kind: 'nut' as const,
          diameter: 3,
          acrossFlats: 5.5,
          height: 2.4,
          pitch: 0.5,
          translation: point(x, s.nutInnerRadius, angle),
          rotation: [-angle, 0, 0] as Vec,
        },
      ];
    }),
  );
}
