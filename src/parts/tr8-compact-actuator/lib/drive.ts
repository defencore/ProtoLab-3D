import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { currentGeometryMode } from '../../../core/geometry-mode';
import type { ThreadCallout } from '../../../core/thread-callouts';
import {
  screwAxisHeight,
  screwThreadStartX,
  screwThreadEndX,
  screwLeftEndX,
  screwRightEndX,
  screwStubEndX,
  screwClipCentres,
  screwInnerClipCentres,
} from './drive-layout';

/** TR8x8(P2): four right-hand starts, 2 mm axial pitch and 8 mm/revolution lead. */
export const tr8Thread = {
  diameter: 8,
  pitch: 2,
  lead: 8,
  starts: 4,
  includedAngle: 30,
  rootDiameter: 5.5,
  stockLength: 250,
  nut: {
    length: 15,
    bossDiameter: 10,
    flangeLength: 22,
    flangeWidth: 11,
    flangeThickness: 3.5,
    noseLength: 1.5,
    rearLength: 10,
    holeDiameter: 3.5,
    holePitch: 16,
  },
} as const;

export type Tr8Lead = 2 | 8;
/** Both executions use the same 2 mm axial pitch and 30 degree profile. */
export function tr8ThreadForLead(lead: Tr8Lead = 8) {
  if (lead !== 2 && lead !== 8) throw new Error('Choose a supported TR8 lead: 2 or 8 mm/revolution.');
  return { ...tr8Thread, lead, starts: lead === 2 ? 1 : 4 };
}

export interface AxialStation {
  from: number;
  to: number;
  diameter: number;
}
export interface ShaftGroove {
  from: number;
  to: number;
  rootDiameter: number;
}
export interface ScrewOptions {
  threadLead?: Tr8Lead;
  threadStartX: number;
  threadEndX: number;
  journals: readonly AxialStation[];
  grooves?: readonly ShaftGroove[];
  screwAxisZ: number;
  /** Physical screw rotation about +X; -360*nut travel/lead keeps the nut unrotated. */
  angleDeg?: number;
}
export interface NutOptions {
  threadLead?: Tr8Lead;
  /** Left face of the 3.5 mm flange; the small nose projects 1.5 mm left. */
  flangeFaceX: number;
  /** Flange station at zero output angle, used to keep the purchased nut unrotated. */
  neutralFlangeFaceX?: number;
  screwAxisZ: number;
  longAxis?: 'y' | 'z';
}

const axial = (radius: number, from: number, to: number, z: number): Shape =>
  cylinder(radius, to - from, [from, 0, z], 'x');
const toX = (shape: Shape, centerX: number, axisZ: number): Shape => ({
  kind: 'transform',
  child: shape,
  translation: [centerX, 0, axisZ],
  rotation: [0, 90, 0],
});

/** Closed helical stock: preview sections and native swept cuts share one profile. */
function trapezoidalStock(
  length: number,
  centerX: number,
  axisZ: number,
  phaseDegrees: number,
  internalTool = false,
  threadLead: Tr8Lead = 8,
): Shape {
  const thread = tr8ThreadForLead(threadLead);
  const pitch = thread.pitch;
  const tangent = Math.tan(Math.PI / 12);
  const root = internalTool ? 3.05 : tr8Thread.rootDiameter / 2;
  const tip = internalTool ? 4.25 : tr8Thread.diameter / 2;
  // The female tool has 0.08 mm axial flank clearance per side, plus a
  // continuous 6.1 mm pilot and 8.5 mm root relief. These are CAD inspection
  // allowances, not a claimed supplier fit or a thread-machining prescription.
  const allowance = internalTool ? 0.08 : 0;
  const halfRoot = pitch / 4 - (root - 3.5) * tangent + allowance;
  const halfTip = pitch / 4 - (tip - 3.5) * tangent + allowance;
  const phase = (phaseDegrees * Math.PI) / 180;
  const radialExtra = 0.15;
  const outline: [number, number][] = [];
  const point = (radius: number, angle: number): [number, number] => [
    radius * Math.cos(angle),
    radius * Math.sin(angle),
  ];
  const rootAngle = (2 * Math.PI * halfRoot) / thread.lead;
  const tipAngle = (2 * Math.PI * halfTip) / thread.lead;
  const flankSteps = 4 * 8 / thread.lead;
  const arcSteps = 8 * 8 / thread.lead;
  for (let start = 0; start < thread.starts; start++) {
    const center = (2 * Math.PI * start) / thread.starts;
    // Straight flanks in the axial section, with circular root and crest arcs.
    for (let i = 0; i <= flankSteps; i++)
      outline.push(
        point(root + ((tip - root) * i) / flankSteps, center - rootAngle + ((rootAngle - tipAngle) * i) / flankSteps),
      );
    for (let i = 1; i <= arcSteps; i++)
      outline.push(point(tip, center - tipAngle + (2 * tipAngle * i) / arcSteps));
    for (let i = 1; i <= flankSteps; i++)
      outline.push(
        point(tip - ((tip - root) * i) / flankSteps, center + tipAngle + ((rootAngle - tipAngle) * i) / flankSteps),
      );
    const next = (2 * Math.PI * (start + 1)) / thread.starts - rootAngle;
    for (let i = 1; i < arcSteps; i++)
      outline.push(point(root, center + rootAngle + ((next - center - rootAngle) * i) / arcSteps));
  }
  const layers = Math.max(16, Math.ceil((length / thread.lead) * 48));
  const rings: Vec[][] = Array.from({ length: layers + 1 }, (_, i) => {
    const z = length * (i / layers - 0.5);
    const rotation = phase + (2 * Math.PI * z) / thread.lead;
    return outline.map(([x, y]): Vec => [
      x * Math.cos(rotation) - y * Math.sin(rotation),
      x * Math.sin(rotation) + y * Math.cos(rotation),
      z,
    ]);
  });
  return toX(
    {
      kind: 'helical-worm',
      rings,
      tip,
      root,
      length,
      lead: thread.lead,
      starts: thread.starts,
      phase,
      hand: 1,
      grooveRoot: pitch / 2 - halfRoot,
      grooveTip: pitch / 2 - halfTip + radialExtra * tangent,
      radialExtra,
      startZ: -length / 2 - thread.lead,
    },
    centerX,
    axisZ,
  );
}

/** A single turned component cut from the 250 mm purchased threaded blank. */
export function screwShape(options: ScrewOptions): Shape {
  const thread = tr8ThreadForLead(options.threadLead);
  const { threadStartX: start, threadEndX: end, screwAxisZ: z } = options;
  if (!(end > start)) throw new Error('The retained TR8 thread length must be positive.');
  for (const journal of options.journals) {
    if (!(
      journal.to > journal.from &&
      journal.diameter > 0 &&
      journal.diameter < tr8Thread.rootDiameter
    ))
      throw new Error(
        'A fully cleaned turned journal must be smaller than the TR8 external root diameter.',
      );
  }
  const center = (start + end) / 2;
  const stock =
    currentGeometryMode() === 'full'
      ? trapezoidalStock(
          end - start,
          center,
          z,
          (center * 360) / thread.lead + (options.angleDeg ?? 0),
          false,
          thread.lead,
        )
      : axial(tr8Thread.diameter / 2, start, end, z);
  const solid = union(
    stock,
    ...options.journals.map((station) => axial(station.diameter / 2, station.from, station.to, z)),
  );
  const cuts = (options.grooves ?? []).map((groove) =>
    subtract(
      axial(tr8Thread.diameter / 2 + 0.1, groove.from, groove.to, z),
      axial(groove.rootDiameter / 2, groove.from - 0.05, groove.to + 0.05, z),
    ),
  );
  return cuts.length ? subtract(solid, ...cuts) : solid;
}

/** Exact H outline from the supplied drawing: R11 circle clipped to an 11 mm strip. */
export function nutShape(options: NutOptions): Shape {
  const thread = tr8ThreadForLead(options.threadLead);
  const { flangeFaceX: face, screwAxisZ: z, longAxis = 'y' } = options;
  const center = face + 6;
  const neutralCenter = (options.neutralFlangeFaceX ?? face) + 6;
  const flange: Shape = {
    kind: 'intersect',
    children: [
      axial(11, face, face + 3.5, z),
      box(
        [3.5, longAxis === 'y' ? 22 : 11, longAxis === 'y' ? 11 : 22],
        [face, longAxis === 'y' ? -11 : -5.5, z - (longAxis === 'y' ? 5.5 : 11)],
      ),
    ],
  };
  const body = union(axial(5, face - 1.5, face + 13.5, z), flange);
  const bore =
    currentGeometryMode() === 'full'
      ? trapezoidalStock(15.4, center, z, (neutralCenter * 360) / thread.lead, true, thread.lead)
      : axial(4.05, face - 1.7, face + 13.7, z);
  return subtract(
    body,
    bore,
    ...[-8, 8].map((offset) =>
      cylinder(
        1.75,
        3.7,
        [face - 0.1, longAxis === 'y' ? offset : 0, z + (longAxis === 'z' ? offset : 0)],
        'x',
      ),
    ),
  );
}

export function driveThreadCallout(
  internal: boolean,
  from: number,
  to: number,
  axisZ: number,
  threadLead: Tr8Lead = 8,
): ThreadCallout & { starts: number; lead: Tr8Lead; includedAngle: 30; rootDiameter: 5.5 } {
  const thread = tr8ThreadForLead(threadLead);
  return {
    designation: `Tr8x${thread.lead}(P2) RH; ${thread.starts} ${thread.starts === 1 ? 'start' : 'starts'}; 30 degree trapezoidal profile`,
    internal,
    nominalDiameter: 8,
    pitch: 2,
    starts: thread.starts,
    lead: thread.lead,
    includedAngle: 30,
    rootDiameter: 5.5,
    length: to - from,
    origin: [from, 0, axisZ],
    axis: [1, 0, 0],
    representation: currentGeometryMode() === 'full' ? 'machined-helix' : 'nominal-cylinder',
  };
}

/** Authoritative installed drive stack, including all four 0.7 mm DIN 471 grooves. */
export function configuredDrive(displacement: number) {
  const screwOptions: ScrewOptions = {
    threadStartX: screwThreadStartX,
    threadEndX: screwThreadEndX,
    journals: [
      { from: screwLeftEndX, to: screwStubEndX, diameter: 4 },
      { from: screwStubEndX, to: screwThreadStartX, diameter: 5 },
      { from: screwThreadEndX, to: screwRightEndX, diameter: 5 },
    ],
    grooves: [...screwClipCentres, ...screwInnerClipCentres].map((center) => ({
      from: center - 0.35,
      to: center + 0.35,
      rootDiameter: 4.8,
    })),
    screwAxisZ: screwAxisHeight,
    angleDeg: (-360 * displacement) / tr8Thread.lead,
  };
  const nutOptions: NutOptions = {
    flangeFaceX: -6 + displacement,
    neutralFlangeFaceX: -6,
    screwAxisZ: screwAxisHeight,
    longAxis: 'y',
  };
  return { screw: screwShape(screwOptions), nut: nutShape(nutOptions), screwOptions, nutOptions };
}
