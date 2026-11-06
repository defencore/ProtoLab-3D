import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { tr8ScrewShape, tr8NutShape } from '../../tr8-compact-actuator/part';
import { linkage, outputBearing, type CncLayout } from './layout';

export const followerDiameter = 4;
export const followerLength = 3.2;
const axial = (radius: number, from: number, to: number, z: number): Shape =>
  cylinder(radius, to - from, [from, 0, z], 'x');
const alongOutput = (radius: number, from: number, to: number): Shape =>
  cylinder(radius, to - from, [0, from, 0], 'y');
const placeOutput = (shape: Shape, outputX: number, angle: number): Shape => ({
  kind: 'transform',
  child: shape,
  translation: [outputX, 0, 0],
  rotation: [0, angle, 0],
});
const forkSlot = (layout: CncLayout) => ({
  root: layout.lever - 0.3,
  tip: layout.lever / Math.cos(Math.PI / 9) + 0.30822227524088,
});

/** Long-Z H collar and machined side flats; body-only export independently tests anti-roll contact. */
export function carrierBodyShape(layout: CncLayout, center: number): Shape {
  const z = layout.lever,
    start = center - 2.5,
    end = center + linkage.coverEndOffset;
  const collar: Shape = {
    kind: 'intersect',
    children: [
      axial(11, start, start + 5, z),
      box([5, 2 * linkage.coverHalfWidth, 22], [start, -linkage.coverHalfWidth, z - 11]),
    ],
  };
  const pads = [false, true].map((positive) =>
    box(
      [end - start, 2, 8],
      [start, positive ? linkage.coverHalfWidth - 2 : -linkage.coverHalfWidth, z - 4],
    ),
  );
  return subtract(
    union(collar, axial(6.5, start, end, z), ...pads),
    axial(5.1, start - 0.1, center + 7.6, z),
    ...[-8, 8].map((offset): Shape => ({
      kind: 'cylinder',
      radius: 1.5,
      height: 4.7,
      origin: [start, 0, z + offset],
      axis: 'x',
      thread: { pitch: 0.5, internal: true, radialClearance: 0.05 },
    })),
  );
}

/** Only the outward follower remains; the outward fork face constrains both nut-roll directions. */
export function carrierShape(layout: CncLayout, center: number): Shape {
  return union(
    carrierBodyShape(layout, center),
    cylinder(
      followerDiameter / 2,
      followerLength,
      [center, linkage.coverHalfWidth, layout.lever],
      'y',
    ),
  );
}

function forkStock(layout: CncLayout, boreRadius: number, crossDrilled: boolean): Shape {
  const low = linkage.forkInnerFace,
    t = linkage.forkThickness,
    half = linkage.forkArmHalfWidth;
  const { root, tip } = forkSlot(layout);
  const side = (r: number, from: number, to: number, x = 0, z = 0): Shape =>
    cylinder(r, to - from, [x, from, z], 'y');
  const slot = union(
    side(linkage.slotWidth / 2, low - 0.1, low + t + 0.1, 0, root),
    side(linkage.slotWidth / 2, low - 0.1, low + t + 0.1, 0, tip),
    box([linkage.slotWidth, t + 0.2, tip - root], [-linkage.slotWidth / 2, low - 0.1, root]),
  );
  return subtract(
    union(
      side(5, low, low + t),
      box([2 * half, t, tip - 3], [-half, low, 3]),
      side(half, low, low + t, 0, tip),
    ),
    side(boreRadius, low - 0.1, low + t + 0.1),
    slot,
    ...(crossDrilled
      ? [cylinder(linkage.crossPinDiameter / 2, 10.2, [-5.1, linkage.pinCentreY, 0], 'x')]
      : []),
  );
}
export function forkShape(layout: CncLayout, outputX: number, angle: number): Shape {
  return placeOutput(forkStock(layout, 3.025, true), outputX, angle);
}

/** The closed plain end remains outside the collar; no head, inner fork or inner retaining ring exists. */
export function outputShaftShape(layout: CncLayout, outputX: number, angle: number): Shape {
  const groove = subtract(
    alongOutput(3.1, layout.outputClip - 0.4, layout.outputClip + 0.4),
    alongOutput(2.85, layout.outputClip - 0.5, layout.outputClip + 0.5),
  );
  const flatStart = layout.outputTail - 6.2;
  return placeOutput(
    subtract(
      alongOutput(outputBearing.bore / 2, linkage.shaftInnerEnd, layout.outputTail),
      groove,
      cylinder(linkage.crossPinDiameter / 2, 6.2, [-3.1, linkage.pinCentreY, 0], 'x'),
      box([8, layout.outputTail - flatStart + 0.2, 4], [-4, flatStart, 2.5]),
    ),
    outputX,
    angle,
  );
}

export function outputSleeves(layout: CncLayout, outputX: number, angle: number) {
  const [inner, outer] = layout.outputBearingCentres,
    w = outputBearing.width / 2;
  return [
    { id: 'output-inner-spacer', from: inner - w - layout.outputInnerSleeve, to: inner - w },
    { id: 'output-inter-spacer', from: inner + w, to: inner + w + layout.outputInterSleeve },
    { id: 'output-spacer', from: outer + w, to: outer + w + layout.outputOuterSleeve },
  ].map((item) => ({
    ...item,
    shape: placeOutput(
      subtract(
        alongOutput(linkage.spacerOuter / 2, item.from, item.to),
        alongOutput(linkage.spacerBore / 2, item.from - 0.1, item.to + 0.1),
      ),
      outputX,
      angle,
    ),
  }));
}

export function driveShapes(layout: CncLayout, outputX: number, travel: number) {
  return {
    screw: tr8ScrewShape({
      threadStartX: layout.threadEnds[0],
      threadEndX: layout.threadEnds[1],
      journals: [
        { from: layout.screwEnds[0], to: layout.stubEnd, diameter: 4 },
        { from: layout.stubEnd, to: layout.threadEnds[0], diameter: 5 },
        { from: layout.threadEnds[1], to: layout.screwEnds[1], diameter: 5 },
      ],
      grooves: layout.screwClipCentres.map((center) => ({
        from: center - 0.35,
        to: center + 0.35,
        rootDiameter: 4.8,
      })),
      screwAxisZ: layout.lever,
      angleDeg: (-360 * travel) / 8,
    }),
    nut: tr8NutShape({
      flangeFaceX: outputX + travel - 6,
      neutralFlangeFaceX: outputX - 6,
      screwAxisZ: layout.lever,
      longAxis: 'z',
    }),
  };
}

export function crossPinDatum(outputX: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  const center: Vec = [outputX, linkage.pinCentreY, 0];
  return {
    id: 'output-rear-cross-pin',
    center,
    origin: [
      center[0] - (linkage.crossPinLength / 2) * Math.cos(radians),
      center[1],
      (linkage.crossPinLength / 2) * Math.sin(radians),
    ] as Vec,
    rotation: [0, 90 + angle, 0] as Vec,
  };
}

/** Flat 3 mm stock; shaft pilot is finished and the transverse pin bore is matched after assembly. */
export function forkBlankShape(layout: CncLayout, pilot = true): Shape {
  const inner = linkage.forkInnerFace;
  const blank = forkStock(layout, pilot ? 2.9 : 3.025, false);
  return {
    kind: 'transform',
    translation: [0, 0, linkage.forkThickness],
    rotation: [-90, 0, 0],
    child: {
      kind: 'transform',
      translation: [0, -inner, 0],
      rotation: [0, 0, 0],
      child: blank,
    },
  };
}
