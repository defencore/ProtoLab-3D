import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';

type RadiusFunction = (p: Parameters, z: number) => number;

export function windowMountCoordinates(p: Parameters) {
  const l = n(p, 'noseLength');
  return {
    glassRear: l,
    ringRear: l - 10.6,
    ringFront: l - 0.8,
    innerRadius: 8.2,
    outerRadius: 11.4,
    earInnerRadius: 11.3,
    earOuterRadius: 13.2,
    earRear: l - 8.8,
    earFront: l - 4,
    earSweep: 30,
    lockAngle: 45,
    releaseTravel: 2.4,
    entryRear: l - 10.5,
    channelRear: l - 11.4,
    channelNominalFront: l - 5.6,
    channelClearFront: l - 5.4,
    dogRear: l - 6.45,
    dogFront: l - 3.8,
    rearGasketThickness: 0.8,
    frontGasketRear: l + 1,
    frontGasketThickness: 0.4,
    frontSeatRear: l + 1.4,
    frontSeatFront: l + 3.4,
    loadSeatRear: l - 12.2,
    loadSeatFront: l - 8.8,
    supportRear: l - 13.6,
    cameraClearanceFront: l - 11.9,
  };
}

function annulus(outer: number, inner: number, z: number, height: number): Shape {
  return subtract(
    cylinder(outer, height, [0, 0, z]),
    cylinder(inner, height + 0.4, [0, 0, z - 0.2]),
  );
}

function roofRecess(
  inner: number,
  outer: number,
  z: number,
  flatTop: number,
  roofTop: number,
  angle: number,
  sweep: number,
): Shape {
  return {
    kind: 'transform',
    translation: [0, 0, 0],
    rotation: [0, 0, angle - sweep / 2],
    child: {
      kind: 'revolve',
      segments: 96,
      sweep,
      profile: [
        [inner, z],
        [outer, z],
        [outer, flatTop],
        [12.4, roofTop],
        [inner, roofTop],
      ],
    },
  };
}
/** Faceted, broad ears keep this separate rigid ring compatible with the primitive mesh backend. */
function ear(
  inner: number,
  outer: number,
  z: number,
  height: number,
  angle: number,
  sweep: number,
): Shape {
  const angles = Array.from(
    { length: 13 },
    (_, i) => ((angle - sweep / 2 + (sweep * i) / 12) * Math.PI) / 180,
  );
  const points: [number, number][] = [
    ...angles.map((a) => [outer * Math.cos(a), outer * Math.sin(a)] as [number, number]),
    ...angles
      .slice()
      .reverse()
      .map((a) => [inner * Math.cos(a), inner * Math.sin(a)] as [number, number]),
  ];
  return prism(points, height, z);
}

/** The rigid ring seats on the cassette; its bayonet ears retain the window when the cassette is absent. */
export function windowRetainerShape(p: Parameters): Shape {
  const a = windowMountCoordinates(p);
  return union(
    annulus(a.outerRadius, a.innerRadius, a.ringRear, a.ringFront - a.ringRear),
    ...[0, 120, 240].map((entry) =>
      ear(
        a.earInnerRadius,
        a.earOuterRadius,
        a.earRear,
        a.earFront - a.earRear,
        entry + a.lockAngle,
        a.earSweep,
      ),
    ),
    ...[0, 120, 240].map((entry): Shape => ({
      kind: 'transform',
      translation: [0, 0, 0],
      rotation: [0, 0, entry + a.lockAngle - a.earSweep / 2],
      child: {
        kind: 'revolve',
        segments: 96,
        sweep: a.earSweep,
        profile: [
          [11.3, a.ringRear],
          [11.4, a.ringRear],
          [a.earOuterRadius, a.earRear],
          [11.3, a.earRear],
        ],
      },
    })),
  );
}

/** Full circumferential support replaces the previous three small contact pads. */
export function windowRearGasketShape(p: Parameters): Shape {
  const a = windowMountCoordinates(p);
  return annulus(a.outerRadius, a.innerRadius, a.ringFront, a.rearGasketThickness);
}

/** Requires the housing's internal front seat to move +0.4 mm; the external contour and glass stay fixed. */
export function windowFrontGasketShape(p: Parameters): Shape {
  const a = windowMountCoordinates(p);
  return annulus(11.5, 8.7, a.frontGasketRear, a.frontGasketThickness);
}

/** Flat rear face goes on the bed; the shared cone is captured by the housing crown. */
export function windowFrontSeatShape(p: Parameters): Shape {
  const a = windowMountCoordinates(p);
  return {
    kind: 'revolve',
    segments: 96,
    profile: [
      [8.7, a.frontSeatRear],
      [11.5, a.frontSeatRear],
      [10.5, a.frontSeatRear + 1],
      [9.8, a.frontSeatFront],
      [8.7, a.frontSeatFront],
    ],
  };
}

/** Flat-printed annulus bearing on the frame cone instead of a printed bridge. */
export function windowLoadSeatShape(p: Parameters): Shape {
  const a = windowMountCoordinates(p);
  const blank: Shape = {
    kind: 'revolve',
    segments: 96,
    profile: [
      [a.innerRadius, a.loadSeatRear],
      [15.4, a.loadSeatRear],
      [13.2, a.loadSeatFront],
      [11.6, a.loadSeatFront],
      [11.6, a.ringRear],
      [a.innerRadius, a.ringRear],
    ],
  };
  return subtract(
    blank,
    ...[60, 180, 300].map((angle): Shape => ({
      kind: 'transform',
      translation: [0, 0, 0],
      rotation: [0, 0, angle - 31],
      child: {
        kind: 'revolve',
        segments: 96,
        sweep: 62,
        profile: [
          [11.6, a.ringRear],
          [13.4, a.loadSeatFront],
          [13.4, a.loadSeatFront + 0.2],
          [11.6, a.loadSeatFront + 0.2],
        ],
      },
    })),
  );
}

/** Entry → turn 45 degrees → advance 2.4 mm into the dogs. No angular key crosses the cassette interface. */
export function windowHousingCuts(p: Parameters): Shape[] {
  const a = windowMountCoordinates(p);
  const ramp = 13.45 - 12.4;
  return [0, 120, 240].flatMap((entry) => [
    roofRecess(
      11.1,
      13.45,
      a.entryRear,
      a.channelClearFront - ramp,
      a.channelClearFront,
      entry,
      34,
    ),
    roofRecess(
      11.1,
      13.45,
      a.channelRear,
      a.channelClearFront - ramp,
      a.channelClearFront,
      entry + 22.5,
      79,
    ),
    roofRecess(11.1, 13.45, a.dogRear, a.dogFront, a.dogFront + ramp, entry + a.lockAngle, 34),
  ]);
}

/** One rigid, open annular load path joins the existing camera collar to the window ring's rear face. */
export function frameWindowSupportShape(p: Parameters, frameRadius?: RadiusFunction): Shape {
  const a = windowMountCoordinates(p);
  const stations: [number, number][] = Array.from({ length: 17 }, (_, i) => {
    const z = a.supportRear + ((a.loadSeatFront - a.supportRear) * i) / 16;
    return [frameRadius ? frameRadius(p, z) - 0.1 : 16.5 - (z - a.supportRear) * 0.4, z];
  });
  const outside: Shape = {
    kind: 'revolve',
    segments: 96,
    profile: [...stations, [0, a.loadSeatFront], [0, a.supportRear]],
  };
  const cameraClearance: Shape = {
    kind: 'intersect',
    children: [
      box([24.8, 24.8, a.loadSeatRear - a.supportRear + 0.2], [-12.4, -12.4, a.supportRear - 0.2]),
      cylinder(15.4, a.loadSeatRear - a.supportRear + 0.2, [0, 0, a.supportRear - 0.2]),
    ],
  };
  return subtract(
    outside,
    cylinder(a.innerRadius, a.loadSeatFront - a.supportRear + 0.4, [0, 0, a.supportRear - 0.2]),
    cameraClearance,
    {
      kind: 'revolve',
      segments: 96,
      profile: [
        [0, a.loadSeatRear],
        [15.4, a.loadSeatRear],
        [13.2, a.loadSeatFront],
        [13.2, a.loadSeatFront + 0.2],
        [0, a.loadSeatFront + 0.2],
      ],
    },
    // The side-isolation flanges project to X=+/-13 near Z=L-13.6..L-13.25.
    cylinder(13.3, 0.8, [0, 0, a.supportRear - 0.2]),
    // The seat enters radially after the camera is removed; the installed pilot closes this path.
    box([40, 40, a.loadSeatFront - a.loadSeatRear + 0.25], [-20, 0, a.loadSeatRear - 0.05]),
  );
}

export function windowRetainerServicePoses(p: Parameters) {
  const a = windowMountCoordinates(p);
  return {
    locked: {
      translation: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    },
    released: {
      translation: [0, 0, -a.releaseTravel] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    },
    entry: {
      translation: [0, 0, -a.releaseTravel] as [number, number, number],
      rotation: [0, 0, -a.lockAngle] as [number, number, number],
    },
  };
}

export const windowMountRequirements = [
  'The D23/D17/6 mm outside envelope is user-supplied. Window material, spherical wall thickness and flange thickness remain to be measured; the current 1 mm construction values are assumptions.',
  'The rear washer, rigid ring and cassette face are nominally seated without an axial gap. Verify the printed and delivered stack; any compensation shim or elastic preload requires a qualified fit.',
  'The cassette backing prevents the rigid ring moving rearwards out of its bayonet dogs. The 0.2 mm channel running clearance leaves 1.4 mm nominal positive dog engagement before release.',
  'Unlock the main nose normally: the flat cassette/ring interface allows the housing and window group to turn and lift away together. No angular key joins the ring to the cassette.',
  'For window replacement only, remove the cassette, pull the retaining ring rearwards by 2.4 mm, turn it back 45 degrees, then withdraw it through the entry slots. Do not force it against the glass.',
  'The separate flat-printed front seat bears on the full housing cone. Remove it rearwards after the retaining ring, gaskets and glass; no adhesive or unsupported integral front lip is used.',
  'The rear load seat bears on a half-cone and rear landing in the frame. Its full annular floor backs the retaining ring; the ring skirt pilots in its upper counterbore and closes the radial release path while the housing is installed.',
  'After removing the housing/window group and the camera/pocket, slide the separate load seat out towards +Y. The half-open frame socket permits deliberate installation and replacement without bending the rigid seat.',
  'The camera clearance and R8.2 optical bore preserve the existing objective and field-of-view envelope. Check the actual optical window, camera focus, gaskets and printed support before use.',
  'A 250 m/s flight condition is an input for load development, not a pressure or impact rating. Qualify pressure in both directions, vibration, temperature, layer orientation and the measured window before flight.',
];
