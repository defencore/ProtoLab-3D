import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { at, guidedLayout } from './guided-layout';
import {
  guidedCavityShape,
  guidedInnerRadius,
  guidedNoseProfile,
  guidedOutsideShape,
  guidedProfileInterface,
} from './guided-profile';
import { guidedBodyAnchors } from './guided-retention';
import { guidedShellSupportStock, guidedSupportDatums } from './guided-supports';

/** The source M4 nyloc nuts are fixed to the shell; the screw ends also locate the cage. */
export const guidedShellAnchorDatums = guidedBodyAnchors.map((anchor) => ({
  ...anchor,
  nutRadius: 35,
  nutHeight: 5,
  nutOuterFaceRadius: 37.5,
  bossInnerRadius: anchor.angle === 0 ? 30.7 : 31,
  boreDiameter: 4.4,
  tubeBearingRadius: 45,
  screwLength: anchor.angle === 0 ? 18 : 25,
  screwTipRadius: anchor.angle === 0 ? 27 : 20,
  cageLandRadialRange: anchor.angle === 0 ? [26.5, 30.5] : [20.5, 28],
}));

const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
const radial = (shape: Shape, angle: number): Shape =>
  at(shape, { translation: [0, 0, 0], rotation: [0, 0, angle] });

function hexX(across: number, x: number, length: number, z: number): Shape {
  return at(
    prism(
      Array.from({ length: 6 }, (_, i): [number, number] => {
        const a = (i * Math.PI) / 3;
        return [
          -(z + (across / Math.sqrt(3)) * Math.sin(a)),
          (across / Math.sqrt(3)) * Math.cos(a),
        ];
      }),
      length,
      0,
    ),
    { translation: [x, 0, 0], rotation: [0, 90, 0] },
  );
}

/** Tip-down printing progresses toward decreasing Z, so this root grows toward the rear. */
function rearGrowingRoot(
  outer: number,
  bore: number,
  inner: number,
  width: number,
  back: number,
  front: number,
): Shape {
  const wedge: Shape = {
    kind: 'prism',
    axis: 'y',
    depth: width,
    origin: -width / 2,
    points: [
      [bore, front],
      [inner, back],
      [outer, back],
      [outer, front],
    ],
  };
  return wedge;
}

/**
 * One rear-open case has a flush tube root and tangent rounded optical annulus.
 * The native serializer recovers the profile's true circular ogive and cap arcs.
 */
export function guidedShellShape(p: Parameters): Shape {
  const a = guidedLayout(p),
    profile = guidedNoseProfile(p),
    supports = guidedSupportDatums(p),
    outside = guidedOutsideShape(p),
    cavity = guidedCavityShape(p);
  const bosses: Shape[] = [];
  for (const anchor of guidedShellAnchorDatums) {
    bosses.push(
      radial(
        box(
          [a.receiverRadius - anchor.bossInnerRadius, 16, 16],
          [anchor.bossInnerRadius, -8, anchor.z - 8],
        ),
        anchor.angle,
      ),
      radial(
        rearGrowingRoot(
          a.receiverRadius,
          a.boreRadius,
          anchor.bossInnerRadius,
          16,
          anchor.z + 7.8,
          anchor.z + 20,
        ),
        anchor.angle,
      ),
    );
  }
  // This shared negative-X nose supports the steel pins close to the cage land.
  // At Z=2 the ramp begins on the actual expanding cavity, then grows inward
  // over 18 mm of tip-down printing before reaching full section.
  bosses.push(
    radial(box([a.receiverRadius + supports.guideX, 14, 24], [-supports.guideX, -7, -40]), 180),
    radial(
      rearGrowingRoot(a.receiverRadius, guidedInnerRadius(p, 2), -supports.guideX, 14, -16, 2),
      180,
    ),
    guidedShellSupportStock(p),
  );
  return subtract(
    // Fuse the complete boss stock once, then clip it to the outside before
    // joining the shell. This avoids overlapping periodic cylindrical faces
    // and preserves a valid native topology through the final refinement.
    {
      kind: 'union',
      children: [subtract(outside, cavity), intersect(union(...bosses), outside)],
      nativeRefine: true,
    },
    cylinder(profile.apertureRadius, profile.tipZ + profile.shoulderLength + 0.4, [
      0,
      0,
      -profile.shoulderLength - 0.2,
    ]),
    ...guidedShellAnchorDatums.flatMap((anchor) => [
      radial(cylinder(anchor.boreDiameter / 2, 30, [19, 0, anchor.z], 'x'), anchor.angle),
      // The full source 5 mm nyloc nut enters from the open interior before the cage.
      // Its outer face seats at R37.5; the shoulder sets the outer bearing stock.
      radial(
        hexX(
          7.3,
          anchor.bossInnerRadius - 0.2,
          anchor.nutOuterFaceRadius - anchor.bossInnerRadius + 0.2,
          anchor.z,
        ),
        anchor.angle,
      ),
      // The negative-side pin guide blocks axial nut loading. This side mouth
      // preserves its D4.4 supporting bore over R28.2..31 while admitting the nut.
      ...(anchor.angle === 180
        ? [radial(box([6.5, 12, 7.3], [31, -12, anchor.z - 3.65]), anchor.angle)]
        : []),
    ]),
  );
}

export const guidedShellRequirements = [
  `The 90/86 execution has one continuous shell from Z=-98 to Z=142 with a centered R${guidedProfileInterface.apertureRadius} through-aperture. The D90 cylindrical root is flush with the tube and tangent to the main ogive; a tangent circular cap replaces the planar crown. Both curved walls have a concentric ${guidedProfileInterface.normalWall} mm inward normal offset. A broad Z68 case seat supports the cassette axially.`,
  'Load all four M4 5 mm-high nyloc nuts from the open shell cavity before inserting the populated cassette. Nut centers are R35 at 0/180 degrees and Z=-20/-32. The negative-side nuts enter through side mouths so the pin-guide bore remains intact. A broad open rear-entry key guides the strengthened backplate; the positive anchor bosses have X30.7 bearing faces.',
  'The selected tube screws bear on the aluminum tube at R45. Positive-X M4x18 tips reach X27, entering the cage land X26.5..30.5 by 3.5 mm. Negative-X M4x25 tips reach X=-20, traversing the strengthened cage land X=-28..-20.5.',
  'Fixed shell nuts establish the steel screw position. The screw ends act as positive locating/capture pins in the cage; they do not establish a clamping preload between the two cage halves or on any PCB.',
  'The shared negative-X pin guide ends at X=-28.2, nominally 0.2 mm clear of the strengthened X=-28 backplate. Broad front/rear bearing lands, a continuous trapezoidal sliding key and a transverse Z68 seat supplement the four retaining pins. Running clearance is not a continuously preloaded contact or a shock rating.',
  'Print tip-down so the boss roots grow inward toward decreasing Z. The continuous shell and selected orientation must be checked on the actual 256 mm build volume; the 240 mm shell height excludes any slicer-added raft.',
  'The broad case key enters a 3.2 mm-deep open groove in the 7.5 mm backplate, retaining a 4.3 mm floor and a 5.8 mm roof bridge. Its 45-degree flanks have 0.212 mm nominal normal clearance; there is no undercut retaining lip. Opposed case bearing lands carry X loads. The 0.2 mm running gaps are prototype allowances requiring a printed fit trial. Native source hardware, full insertion and nut-loading paths require verification.',
  'The 15 kg vehicle mass and 250 m/s environment do not specify deployment impulse, cassette acceleration, printed material allowables, service temperature or a demonstrated load margin.',
];
