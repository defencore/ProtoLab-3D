import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { tr8ScrewShape, tr8NutShape } from '../../tr8-compact-actuator/part';
import { driveLayout, mechanismLayout } from './layout';

/** Geometry contract for the quad variant; the released single mechanism is untouched. */
export interface VerticalLinkage {
  radius: number;
  outputX: number;
  pinOffsetX: number;
  coverEndOffsetX: number;
  coverHalfWidth: number;
}
export const linkageOptions: VerticalLinkage = {
  radius: mechanismLayout.radius,
  outputX: mechanismLayout.outputX,
  pinOffsetX: 0,
  coverEndOffsetX: 7.5,
  coverHalfWidth: mechanismLayout.coverHalfWidth,
};

/** The short cover has 1.9 mm pin-root wall outside the purchased nut's body. */
export function verticalNutCover(center: number, options: VerticalLinkage): Shape {
  const z = options.radius;
  const start = center - 2.5;
  const end = center + options.coverEndOffsetX;
  const axial = (radius: number, from: number, to: number): Shape =>
    cylinder(radius, to - from, [from, 0, z], 'x');
  const collar: Shape = {
    kind: 'intersect',
    children: [
      axial(11, start, start + 5),
      box([5, 2 * options.coverHalfWidth, 22], [start, -options.coverHalfWidth, z - 11]),
    ],
  };
  const tube: Shape = {
    kind: 'intersect',
    children: [
      axial(6.5, start, end),
      box([end - start, 2 * options.coverHalfWidth, 13], [start, -options.coverHalfWidth, z - 6.5]),
    ],
  };
  const flats = [false, true].map((positive) =>
    box(
      [end - start, 2, 8],
      [start, positive ? options.coverHalfWidth - 2 : -options.coverHalfWidth, z - 4],
    ),
  );
  const pins = [false, true].map((positive) =>
    cylinder(
      2,
      3.2,
      [
        center + options.pinOffsetX,
        positive ? options.coverHalfWidth : -options.coverHalfWidth - 3.2,
        z,
      ],
      'y',
    ),
  );
  const cuts: Shape[] = [axial(5.1, start - 0.1, center + 7.6)];
  if (end > center + 7.5) cuts.push(axial(4.3, center + 7.5, end + 0.1));
  for (const offset of [-8, 8])
    cuts.push({
      kind: 'cylinder',
      radius: 1.5,
      height: 4.7,
      origin: [start, 0, z + offset],
      axis: 'x',
      thread: { pitch: 0.5, internal: true, radialClearance: 0.05 },
    });
  return subtract(union(collar, tube, ...flats, ...pins), ...cuts);
}

export const forkSheetThickness = 3;
const forkBoreRadius = 3.025;
const forkPilotRadius = 2.9;
const pinDiameter = 2;
const pinLength = 10;
const forkSlot = (options: VerticalLinkage) => ({
  root: options.radius - 0.3,
  tip: options.radius / Math.cos(Math.PI / 9) + 0.30822227524088,
});

/** Unsplit 3 mm steel fork; its transverse bore is finish-drilled in the assembled joint. */
function forkStock(
  positive: boolean,
  options: VerticalLinkage,
  boreRadius = forkBoreRadius,
  crossDrilled = true,
): Shape {
  const inner = options.coverHalfWidth + 0.05;
  const armLow = positive ? inner : -inner - forkSheetThickness;
  const hubLow = armLow;
  const { root: slotRoot, tip: slotTip } = forkSlot(options);
  const axial = (radius: number, from: number, to: number, x = 0, z = 0): Shape =>
    cylinder(radius, to - from, [x, from, z], 'y');
  const hub = axial(5, hubLow, hubLow + forkSheetThickness);
  const arm = union(
    box([9, 3, slotTip - 3], [-4.5, armLow, 3]),
    axial(4.5, armLow, armLow + 3, 0, slotTip),
  );
  const slot = union(
    axial(2.05, armLow - 0.1, armLow + 3.1, 0, slotRoot),
    axial(2.05, armLow - 0.1, armLow + 3.1, 0, slotTip),
    box([4.1, 3.2, slotTip - slotRoot], [-2.05, armLow - 0.1, slotRoot]),
  );
  return subtract(
    union(hub, arm),
    axial(boreRadius, hubLow - 0.1, hubLow + forkSheetThickness + 0.1),
    slot,
    ...(crossDrilled
      ? [cylinder(pinDiameter / 2, 10.2, [-5.1, hubLow + forkSheetThickness / 2, 0], 'x')]
      : []),
  );
}

export function narrowFork(
  positive: boolean,
  options: VerticalLinkage,
  angleDegrees: number,
): Shape {
  return {
    kind: 'transform',
    translation: [options.outputX, 0, 0],
    rotation: [0, angleDegrees, 0],
    child: forkStock(positive, options),
  };
}

/** Physical joint midpoints. The library starts at local Z=0, so offset it by half its length. */
export function dowelDatums(angleDegrees: number) {
  const y = linkageOptions.coverHalfWidth + 0.05 + forkSheetThickness / 2;
  return [false, true].map((positive) => ({
    id: `output-${positive ? 'rear' : 'front'}-cross-pin`,
    center: [mechanismLayout.outputX, positive ? y : -y, 0] as Vec,
    rotation: [0, 90 + angleDegrees, 0] as Vec,
  }));
}

export const narrowOutputLayout = {
  pivot: [mechanismLayout.outputX, 0, 0] as Vec,
  bearingCenters: mechanismLayout.bearingCentres,
  outerClipCenters: mechanismLayout.bearingCentres.map(
    (center) => center + Math.sign(center) * 3.7,
  ),
  pinCenters: [-1, 1].map(
    (sign) => sign * (linkageOptions.coverHalfWidth + 0.05 + forkSheetThickness / 2),
  ),
  pinDiameter,
  pinLength,
  forkThickness: forkSheetThickness,
  forkBoreDiameter: 2 * forkBoreRadius,
  forkPilotDiameter: 2 * forkPilotRadius,
  shaftEnds: driveLayout.outputShaftEnds,
  headSpan: driveLayout.outputHeadSpan,
  headDiameter: driveLayout.outputHeadDiameter,
} as const;

/** New quad drive; the released single-drive stations remain unchanged. */
export function quadDrive(displacement: number) {
  return {
    screw: tr8ScrewShape({
      threadStartX: driveLayout.threadEnds[0],
      threadEndX: driveLayout.threadEnds[1],
      journals: [
        { from: driveLayout.screwEnds[0], to: driveLayout.stubEnd, diameter: 4 },
        { from: driveLayout.stubEnd, to: driveLayout.threadEnds[0], diameter: 5 },
        { from: driveLayout.threadEnds[1], to: driveLayout.screwEnds[1], diameter: 5 },
      ],
      grooves: driveLayout.clipCentres.map((center) => ({
        from: center - 0.35,
        to: center + 0.35,
        rootDiameter: 4.8,
      })),
      screwAxisZ: mechanismLayout.screwZ,
      angleDeg: (-360 * displacement) / 8,
    }),
    nut: tr8NutShape({
      flangeFaceX: -6 + displacement,
      neutralFlangeFaceX: -6,
      screwAxisZ: mechanismLayout.screwZ,
      longAxis: 'z',
    }),
  };
}

const outputCylinder = (radius: number, from: number, to: number): Shape =>
  cylinder(radius, to - from, [0, from, 0], 'y');
const outputAnnulus = (outer: number, inner: number, from: number, to: number): Shape =>
  subtract(outputCylinder(outer, from, to), outputCylinder(inner, from - 0.1, to + 0.1));
const placeOutput = (shape: Shape, angle: number): Shape => ({
  kind: 'transform',
  child: shape,
  translation: [mechanismLayout.outputX, 0, 0],
  rotation: [0, angle, 0],
});

function narrowOutputShaft(): Shape {
  const [from, to] = driveLayout.outputShaftEnds;
  const [headFrom, headTo] = driveLayout.outputHeadSpan;
  return subtract(
    union(
      outputCylinder(3, from, to),
      outputCylinder(driveLayout.outputHeadDiameter / 2, headFrom, headTo),
    ),
    ...narrowOutputLayout.outerClipCenters.map((center) =>
      outputAnnulus(3.1, 2.85, center - 0.4, center + 0.4),
    ),
    ...narrowOutputLayout.pinCenters.map((y) => cylinder(pinDiameter / 2, 6.2, [-3.1, y, 0], 'x')),
    box([8, 6.4, 4], [-4, 21.3, 2.5]),
  );
}

export interface NarrowOutputPiece {
  id: string;
  label: string;
  shape: Shape;
  color: number;
}

/** Complete new output hardware geometry; the quad frame supplies its own cheeks. */
export function narrowOutputPieces(angle: number): NarrowOutputPiece[] {
  const options = linkageOptions;
  const pieces: NarrowOutputPiece[] = [
    {
      id: 'output-shaft',
      label: 'Quad output shaft · Ø6 · integral Ø8 × 1 head and D-flat',
      shape: placeOutput(narrowOutputShaft(), angle),
      color: 0xaeb8c0,
    },
  ];
  for (const positive of [false, true]) {
    const side = positive ? 'rear' : 'front';
    pieces.push(
      {
        id: `output-${side}-crank`,
        label: 'Quad steel closed-slot fork · Ø2 pressed cross-pin',
        shape: narrowFork(positive, options, angle),
        color: 0x759bb3,
      },
      {
        id: `output-${side}-inner-spacer`,
        label: 'Quad output inner-ring thrust spacer',
        shape: placeOutput(
          outputAnnulus(
            3.9,
            3.025,
            positive
              ? options.coverHalfWidth + 0.05 + forkSheetThickness
              : mechanismLayout.bearingCentres[0] + 2.5,
            positive
              ? mechanismLayout.bearingCentres[1] - 2.5
              : -options.coverHalfWidth - 0.05 - forkSheetThickness,
          ),
          angle,
        ),
        color: 0xaeb8c0,
      },
      {
        id: `output-${side}-spacer`,
        label: 'Quad output outer-ring thrust spacer',
        shape: placeOutput(
          outputAnnulus(
            3.9,
            3.025,
            positive
              ? mechanismLayout.bearingCentres[1] + 2.5
              : mechanismLayout.bearingCentres[0] - 3.3,
            positive
              ? mechanismLayout.bearingCentres[1] + 3.3
              : mechanismLayout.bearingCentres[0] - 2.5,
          ),
          angle,
        ),
        color: 0xaeb8c0,
      },
    );
  }
  return pieces;
}

/** One 3 mm laser blank; both installed forks use this same flat profile. */
export function forkBlankShape(pilot = true): Shape {
  const inner = linkageOptions.coverHalfWidth + 0.05;
  return {
    kind: 'transform',
    rotation: [-90, 0, 0],
    translation: [0, 0, forkSheetThickness],
    child: {
      kind: 'transform',
      rotation: [0, 0, 0],
      translation: [0, -inner, 0],
      child: forkStock(true, linkageOptions, pilot ? forkPilotRadius : forkBoreRadius, false),
    },
  };
}

type ForkPoint = [number, number];
export type ForkLaserEdge =
  | { kind: 'line'; from: ForkPoint; to: ForkPoint }
  | { kind: 'circle'; center: ForkPoint; radius: number }
  | {
      kind: 'arc';
      from: ForkPoint;
      to: ForkPoint;
      center: ForkPoint;
      radius: number;
      start: number;
      end: number;
      clockwise: false;
    };

/** Exact line/arc cut contours. The transverse Ø2 bore is a later machining operation. */
export function forkLaserContours(pilot = true): ForkLaserEdge[][] {
  const { root, tip } = forkSlot(linkageOptions);
  const line = (from: ForkPoint, to: ForkPoint): ForkLaserEdge => ({ kind: 'line', from, to });
  const arc = (
    from: ForkPoint,
    to: ForkPoint,
    center: ForkPoint,
    radius: number,
    start: number,
    end: number,
  ): ForkLaserEdge => ({ kind: 'arc', from, to, center, radius, start, end, clockwise: false });
  return [
    [
      line([4.5, 3], [4.5, tip]),
      arc([4.5, tip], [-4.5, tip], [0, tip], 4.5, 0, Math.PI),
      line([-4.5, tip], [-4.5, 3]),
      line([-4.5, 3], [-4, 3]),
      arc([-4, 3], [4, 3], [0, 0], 5, Math.atan2(3, -4), Math.atan2(3, 4) + 2 * Math.PI),
      line([4, 3], [4.5, 3]),
    ],
    [{ kind: 'circle', center: [0, 0], radius: pilot ? forkPilotRadius : forkBoreRadius }],
    [
      line([2.05, root], [2.05, tip]),
      arc([2.05, tip], [-2.05, tip], [0, tip], 2.05, 0, Math.PI),
      line([-2.05, tip], [-2.05, root]),
      arc([-2.05, root], [2.05, root], [0, root], 2.05, Math.PI, 2 * Math.PI),
    ],
  ];
}

export function verticalNutFasteners(center: number) {
  return [-8, 8].map((offset) => ({
    id: `nut-flange-${offset < 0 ? 'negative' : 'positive'}`,
    diameter: 3,
    length: 8,
    underHead: [center - 6, 0, mechanismLayout.screwZ + offset] as Vec,
    direction: [1, 0, 0] as Vec,
    head: 'button' as const,
  }));
}
