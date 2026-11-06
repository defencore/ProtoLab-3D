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
import { layout, move, type PrintedPiece } from './spec';

const jointFit = 0.3;
const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
const centered = (size: Vec, center: Vec): Shape =>
  box(size, center.map((value, index) => value - size[index] / 2) as Vec);
const tubeCircle = (radius: number, height: number, origin: Vec): Shape => ({
  kind: 'cylinder',
  radius,
  height,
  origin,
  axis: 'x',
  previewSegments: 128,
});

/** Independent ring stations leave the whole marking area accessible between them. */
export function jigLayout(p: Parameters) {
  const d = layout(p);
  const boreRadius = d.ringBore / 2;
  const ringOuterRadius = boreRadius + 6;
  const innerStation = d.ringX - d.ringThickness / 2;
  const windowHalf = d.windowLength / 2;
  const railInnerY = d.windowWidth / 2;
  const railWidth = 4;
  const railBase = Math.sqrt(boreRadius ** 2 - railInnerY ** 2);
  const lugBottom = -ringOuterRadius - 8.8;
  const spineSeatTop = -ringOuterRadius - 0.3;
  return {
    ...d,
    boreRadius,
    ringOuterRadius,
    innerStation,
    windowHalf,
    railInnerY,
    railWidth,
    railBase,
    railHeight: 5,
    lugBottom,
    lugWidth: 18,
    lugHeight: 10.8,
    spineWidth: 24,
    spineBottom: lugBottom - 6,
    spineSeatTop,
    spineLength: 2 * (d.ringX + d.ringThickness / 2 + 5),
    bottomKeyZ: (lugBottom + spineSeatTop) / 2,
    topKeyZ: boreRadius + 4,
    topBarBottom: boreRadius + 0.5,
    topBarTop: boreRadius + 8.5,
    topBarWidth: 50,
    topTenonBottom: boreRadius + 1.5,
    topTenonHeight: 5,
    topTenonWidth: 10,
    topTenonLength: 3.5,
    keyWidth: 2.2,
    keyHeight: 2,
    guideXs: [-d.endMountX, d.endMountX] as const,
    guideAngles: [0, 90, 180, 270] as const,
    ringGuideAngles: [90, 180, 270] as const,
    jointFit,
  };
}

type JigLayout = ReturnType<typeof jigLayout>;
const keyCut = (d: JigLayout, x: number, z: number, length: number): Shape =>
  centered([d.keyWidth + jointFit, length, d.keyHeight + jointFit], [x, 0, z]);

function radialGuidePod(d: JigLayout, sign: -1 | 1, angle: number): Shape {
  const startX = sign > 0 ? d.innerStation - 11 : -d.innerStation - 1;
  const pod = intersect(
    subtract(
      tubeCircle(d.ringOuterRadius, 12, [startX, 0, 0]),
      tubeCircle(d.boreRadius, 14, [startX - 1, 0, 0]),
    ),
    box([12, 12, d.ringOuterRadius + 1], [startX, -6, 0]),
  );
  return move(
    subtract(
      pod,
      cylinder(d.mountHole / 2, d.ringOuterRadius - d.boreRadius + 2, [
        sign * d.endMountX,
        0,
        d.boreRadius - 1,
      ]),
    ),
    [0, 0, 0],
    [-angle, 0, 0],
  );
}

function alignmentRing(d: JigLayout, sign: -1 | 1): Shape {
  const x = sign * d.ringX;
  const topKeyX = sign * (d.ringX - 1);
  const ring = subtract(
    tubeCircle(d.ringOuterRadius, d.ringThickness, [x - d.ringThickness / 2, 0, 0]),
    tubeCircle(d.boreRadius, d.ringThickness + 2, [x - d.ringThickness / 2 - 1, 0, 0]),
  );
  const lowerLug = box(
    [d.ringThickness, d.lugWidth, d.lugHeight],
    [x - d.ringThickness / 2, -d.lugWidth / 2, d.lugBottom],
  );
  const upperKeyBar = box(
    [d.ringThickness, d.topBarWidth, d.topBarTop - d.topBarBottom],
    [x - d.ringThickness / 2, -d.topBarWidth / 2, d.topBarBottom],
  );
  const mortiseX = sign > 0 ? d.innerStation - 0.1 : -d.innerStation - d.topTenonLength - jointFit;
  return subtract(
    union(
      ring,
      lowerLug,
      upperKeyBar,
      ...d.ringGuideAngles.map((angle) => radialGuidePod(d, sign, angle)),
    ),
    box(
      [d.topTenonLength + jointFit + 0.1, d.topTenonWidth + jointFit, d.topTenonHeight + jointFit],
      [mortiseX, -(d.topTenonWidth + jointFit) / 2, d.topTenonBottom - jointFit / 2],
    ),
    keyCut(d, x, d.bottomKeyZ, d.lugWidth + 2),
    keyCut(d, topKeyX, d.topKeyZ, d.topBarWidth + 2),
  );
}

function rearSpine(d: JigLayout): Shape {
  const seats = [-1, 1].map((sign): Shape => {
    const x = sign * d.ringX;
    return subtract(
      box(
        [d.ringThickness + jointFit + 8, d.spineWidth, d.spineSeatTop - d.lugBottom + 0.1],
        [x - (d.ringThickness + jointFit + 8) / 2, -d.spineWidth / 2, d.lugBottom - 0.1],
      ),
      box(
        [d.ringThickness + jointFit, d.lugWidth + jointFit, d.lugHeight + 1],
        [x - (d.ringThickness + jointFit) / 2, -(d.lugWidth + jointFit) / 2, d.lugBottom],
      ),
      keyCut(d, x, d.bottomKeyZ, d.spineWidth + 2),
    );
  });
  const spine = union(
    box([d.spineLength, d.spineWidth, 6], [-d.spineLength / 2, -d.spineWidth / 2, d.spineBottom]),
    ...seats,
    ...(d.antenna ? [cylinder(d.antennaHole / 2 + 3, 6,
      [d.antennaX, d.antennaY, d.spineBottom]),
      box([d.antennaHole + 6, Math.abs(d.antennaY), 6],
        [d.antennaX - d.antennaHole / 2 - 3, Math.min(d.antennaY, 0), d.spineBottom]),
    ] : []),
  );
  return d.antenna ? subtract(spine,
    cylinder(d.antennaHole / 2, -d.boreRadius + 2 - d.spineBottom,
      [d.antennaX, d.antennaY, d.spineBottom - 0.1]),
  ) : spine;
}

function railTenon(d: JigLayout, sign: -1 | 1, side: -1 | 1, allowance = 0): Shape {
  const width = 2.2 + allowance;
  const height = 4.6 + allowance;
  const length = 3 + allowance;
  const x = sign > 0 ? d.windowHalf - 0.05 : -d.windowHalf - length;
  return box(
    [length + 0.05, width, height],
    [x, side * (d.railInnerY + d.railWidth / 2) - width / 2, d.railBase - allowance / 2],
  );
}

function markingArch(d: JigLayout, sign: -1 | 1): Shape {
  const length = d.innerStation - d.windowHalf;
  const start = sign > 0 ? d.windowHalf : -d.innerStation;
  const curve = intersect(
    subtract(
      tubeCircle(d.boreRadius + 5, length, [start, 0, 0]),
      tubeCircle(d.boreRadius, length + 2, [start - 1, 0, 0]),
    ),
    box(
      [length + 0.2, d.windowWidth + 2 * d.railWidth, d.boreRadius + 10],
      [start - 0.1, -d.railInnerY - d.railWidth, 0],
    ),
  );
  const railSockets = [-1, 1].map((side) =>
    box(
      [length, d.railWidth, d.railHeight + 1.5],
      [start, side > 0 ? d.railInnerY : -d.railInnerY - d.railWidth, d.railBase],
    ),
  );
  const tenonStart = sign > 0 ? d.innerStation - 0.1 : -d.innerStation - d.topTenonLength;
  const tenon = box(
    [d.topTenonLength + 0.1, d.topTenonWidth, d.topTenonHeight],
    [tenonStart, -d.topTenonWidth / 2, d.topTenonBottom],
  );
  const neckStart = sign > 0 ? d.innerStation - 9 : -d.innerStation;
  const neck = box(
    [9, d.topTenonWidth, d.topTenonHeight],
    [neckStart, -d.topTenonWidth / 2, d.topTenonBottom],
  );
  const markings: Shape[] = [
    cylinder(d.mountHole / 2, d.boreRadius + 15, [sign * d.endMountX, 0, 0]),
  ];
  return subtract(
    union(curve, ...railSockets, tenon, neck),
    ...markings,
    ...([-1, 1] as const).map((side) => railTenon(d, sign, side, jointFit)),
    keyCut(d, sign * (d.ringX - 1), d.topKeyZ, d.topTenonWidth + 2),
  );
}

function markingRail(d: JigLayout, side: -1 | 1): Shape {
  return union(
    box(
      [d.windowLength, d.railWidth, d.railHeight],
      [-d.windowHalf, side > 0 ? d.railInnerY : -d.railInnerY - d.railWidth, d.railBase],
    ),
    railTenon(d, -1, side),
    railTenon(d, 1, side),
  );
}

/** Headed transverse keys retain the rectangular joint; the head limits insertion travel. */
function slidingKey(d: JigLayout, x: number, z: number, span: number): Shape {
  const bottom = z - d.keyHeight / 2;
  const bar = prism(
    [
      [x - d.keyWidth / 2, -span / 2 - 0.1],
      [x + d.keyWidth / 2, -span / 2 - 0.1],
      [x + d.keyWidth / 2 - 0.15, span / 2 + 0.8],
      [x - d.keyWidth / 2 + 0.15, span / 2 + 0.8],
    ],
    d.keyHeight,
    bottom,
  );
  return union(bar, box([7, 3.5, 3], [x - 3.5, -span / 2 - 3.5, bottom]));
}

export function jigPieces(p: Parameters): PrintedPiece[] {
  const d = jigLayout(p);
  const result: PrintedPiece[] = [];
  for (const sign of [-1, 1] as const) {
    const end = sign < 0 ? 'left' : 'right';
    const ring = alignmentRing(d, sign);
    result.push({
      id: `jig-ring-${end}`,
      label: `Jig ${end} alignment ring · ID ${d.ringBore} mm`,
      shape: ring,
      printShape: move(ring, [0, 0, 0], [0, sign * 90, 0]),
      color: 0x349ca7,
      role: 'jig',
    });
    const arch = markingArch(d, sign);
    result.push({
      id: `jig-marking-arch-${end}`,
      label: `Jig ${end} curved marking arch`,
      shape: arch,
      printShape: move(arch, [0, 0, 0], [0, -sign * 90, 0]),
      color: 0xe9b44c,
      role: 'jig',
    });
    for (const position of ['lower', 'upper'] as const) {
      const x = sign * (d.ringX - (position === 'upper' ? 1 : 0));
      const z = position === 'upper' ? d.topKeyZ : d.bottomKeyZ;
      const key = slidingKey(d, x, z, position === 'upper' ? d.topBarWidth : d.spineWidth);
      result.push({
        id: `jig-key-${position}-${end}`,
        label: `Jig ${end} ${position} headed sliding key`,
        shape: key,
        printShape: key,
        color: 0xd77859,
        role: 'jig',
      });
    }
  }
  const spine = rearSpine(d);
  result.push({
    id: 'jig-rear-spine',
    label: `Jig rear alignment spine · shouldered ring seats${d.antenna ? ' and underside SMA entry' : ''}`,
    shape: spine,
    printShape: spine,
    color: 0x59717b,
    role: 'jig',
  });
  for (const side of [-1, 1] as const) {
    const rail = markingRail(d, side);
    result.push({
      id: `jig-marking-rail-${side < 0 ? 'front' : 'back'}`,
      label: `Jig ${side < 0 ? 'front' : 'back'} straight marking rail · keyed ends`,
      shape: rail,
      printShape: rail,
      color: 0xe9b44c,
      role: 'jig',
    });
  }
  return result;
}
