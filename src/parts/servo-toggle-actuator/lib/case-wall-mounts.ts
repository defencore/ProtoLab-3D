import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import washer from '../../washer/part';
import { hexNut, screw } from './hardware';
import { caseBrassStructure } from './case-brass-supports';
import { caseModularElectronics } from './case-electronics-grid';

type Side = 'front' | 'rear' | 'left' | 'right';
type Bounds = { min: Vec; max: Vec };
const nominalGapMm = 0.2;
const bossLocal: Bounds = { min: [0.2, -6, -4.5], max: [6.2, 6, 10] };
const locations: readonly { side: Side; along: number; index: number }[] = [
  { side: 'front', along: 30, index: 1 },
  { side: 'front', along: 184, index: 2 },
  { side: 'rear', along: 60, index: 1 },
  { side: 'rear', along: 154, index: 2 },
  { side: 'left', along: 75, index: 1 },
  { side: 'right', along: 25, index: 1 },
  { side: 'right', along: 125, index: 2 },
];

function definition(side: Side, along: number) {
  const slope = side === 'left' || side === 'right' ? 3 / 75 : 4 / 75;
  const theta = Math.atan(slope),
    phi = { front: 90, rear: -90, left: 0, right: 180 }[side],
    angle = (phi * Math.PI) / 180,
    u: Vec = [
      Math.cos(angle) * Math.cos(theta),
      Math.sin(angle) * Math.cos(theta),
      Math.sin(theta),
    ],
    v: Vec = [-Math.sin(angle), Math.cos(angle), 0],
    w: Vec = [
      -Math.cos(angle) * Math.sin(theta),
      -Math.sin(angle) * Math.sin(theta),
      Math.cos(theta),
    ];
  const at: Vec = {
    front: [along, (4 * 18) / 75, 0.5],
    rear: [along, 150 - (4 * 18) / 75, 0.5],
    left: [(3 * 18) / 75, along, 0.5],
    right: [214 - (3 * 18) / 75, along, 0.5],
  }[side] as Vec;
  const point = ([x, y, z]: Vec): Vec =>
    at.map((a, i) => a + u[i] * x + v[i] * y + w[i] * z) as Vec;
  const bounds = ({ min, max }: Bounds): Bounds => {
    const corners = [min[0], max[0]].flatMap((x) =>
      [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => point([x, y, z]))),
    );
    return {
      min: [0, 1, 2].map((i) => Math.min(...corners.map((p) => p[i]))) as Vec,
      max: [0, 1, 2].map((i) => Math.max(...corners.map((p) => p[i]))) as Vec,
    };
  };
  return {
    side,
    at,
    point,
    bounds,
    u,
    v,
    w,
    theta,
    phi,
    rotation: [0, (-theta * 180) / Math.PI, phi] as Vec,
  };
}

/** User-confirmed internal-wall coordinates; the wall thickness and seal compression remain nominal. */
export function caseWallMountStructure(p: Parameters) {
  const mounts = locations.map(({ side, along, index }) => {
    const m = definition(side, along),
      suffix = `${side}-${index}`;
    const hardwareIds = {
      screw: `case-wall-screw-${suffix}`,
      nut: `case-wall-nut-${suffix}`,
      washer: `case-wall-washer-${suffix}`,
      seal: `case-wall-seal-${suffix}`,
    };
    return {
      id: `case-wall-${suffix}`,
      side,
      alongWallMm: along,
      axisPoint: m.at,
      inwardAxis: m.u,
      cavityWallPoint: m.at,
      nominalGapMm,
      frame: { at: m.at, rotation: m.rotation },
      bossLocalBounds: bossLocal,
      additionsMaximumZ: 3.5,
      contactProbe: m.bounds({ min: [0.2, -4, -2], max: [0.35, 4, 0.5] }),
      contactLocalProbe: { min: [0.2, -4, -2] as Vec, max: [0.35, 4, 0.5] as Vec },
      wallProbe: m.bounds({ min: [-4, -5, -3], max: [0, 5, 3] }),
      nutId: hardwareIds.nut,
      hardwareIds,
      nutPlacement: {
        at: m.point([2.2, 0, 0]),
        rotation: [0, 90 - (m.theta * 180) / Math.PI, m.phi] as Vec,
      },
      nutSize: { boreMm: 3, acrossFlatsMm: 5.5, thicknessMm: 2.4 },
      boreDiameterMm: 3.4,
      nutPocket: {
        acrossFlatsMm: 5.8,
        axialStartMm: 2.2,
        axialLengthMm: 2.7,
        loadCheekMm: 2,
        innerCheekMm: 1.3,
      },
      minimumNutSeatAreaMm2: 12,
      rootProbe: m.bounds({ min: [0.6, -5.4, 0], max: [1.6, -3.7, 1.8] }),
      minimumRootVolumeMm3: 2,
      insertion: {
        mouth: m.point([3.55, 6, 0]),
        outward: m.v,
        translation: m.v.map((a) => a * 10) as Vec,
        minimumStartGapMm: 0.3,
        loadingWell: {
          bottomMouth: m.point([3.55, 10, (1 - Math.sin(m.theta) * 3.55) / Math.cos(m.theta)]),
          outward: m.w.map((n) => -n) as Vec,
          translation: m.w.map((n) => -4 * n) as Vec,
          minimumStartGapMm: 0.3,
          localBounds: { min: [2.2, 6, -8] as Vec, max: [4.9, 13.5, 3] as Vec },
          assemblyStage: 'supported-upper-assembly-before-lower-body-and-carrier',
          removedIds: [
            'case-lower-body',
            ...caseBrassStructure().supports.flatMap((support) => [
              ...support.retainedComponentIds,
              ...support.removedBeforeWithdrawalIds,
            ]),
            'case-electronics-buck-1-keeper',
            'case-electronics-buck-2-keeper',
            'case-electronics-filter-1-keeper',
            'case-electronics-adc-keeper',
            'case-electronics-filter-2-keeper',
            ...caseModularElectronics(p).adapters.flatMap((adapter) => [adapter.id, ...adapter.anchors.flatMap((anchor)=>[anchor.screwId,anchor.nutId])]),
            'case-electronics-heltec-keeper',
            'case-electronics-analogue-hood',
            ...[1, 2, 3, 4].flatMap((i) => [
              `case-electronics-hat-screw-${i}`,
              `case-electronics-hat-nut-${i}`,
              `case-electronics-hat-washer-${i}`,
            ]),
            'case-electronics-shield-bond-screw',
            'case-electronics-shield-bond-nut',
            'case-electronics-shield-bond-washer',
            'case-servo-driver-hat',
            'case-heltec-v4',
            'case-adc-cjmcu1220',
            'case-buck-1',
            'case-buck-2',
            'case-lc-filter-1',
            'case-lc-filter-2',
            'case-test-clip-carrier',
            'case-test-clip-red',
            'case-test-clip-black',
            'case-pwm-mosfet',
            'case-pwm-keeper',
          ],
        },
      },
      screwStack: {
        lengthMm: 11,
        underHeadLocalX: -5.3,
        headSizeMm: 5.5,
        headHeightMm: 3,
        tipLocalX: 5.7,
      },
      outerStack: [
        {
          id: hardwareIds.washer,
          minLocalX: -5.3,
          maxLocalX: -4.8,
          outerDiameterMm: 7,
          innerDiameterMm: 3.2,
        },
        {
          id: hardwareIds.seal,
          minLocalX: -4.8,
          maxLocalX: -4,
          outerDiameterMm: 10,
          innerDiameterMm: 3.2,
        },
      ],
      wallPort: { diameterMm: 3.4, normalThicknessMm: 4, couponHalfWidthMm: 8 },
    };
  });
  const ribs = [
    { id: 'case-wall-right-spine', min: [199, 54, -6.5] as Vec, max: [202, 137, 2] as Vec },
    {
      id: 'case-wall-sp20-cross-rib',
      min: [150.5, 106.25, -6.5] as Vec,
      max: [208, 109.25, 2] as Vec,
    },
    {
      id: 'case-wall-right-rear-root-rib',
      min: [200, 123.5, -3] as Vec,
      max: [210, 126.5, 2] as Vec,
    },
  ];
  return {
    requiresMeasuredCaseWall: false,
    exteriorScrewsIncluded: true,
    caseWallThicknessMm: 4,
    expectedMountCount: 7,
    panelSize: [Number(p.baseLength) || 214, Number(p.baseWidth) || 150.6] as const,
    panelFrontZ: 7.5,
    panelRearZ: 1.5,
    caseDatum: {
      grooveFloorZ: 18.5,
      grooveRimZ: 20.5,
      axisDepthBelowRimMm: 20,
      innerFloorZ: -56.5,
      topOpening: [214, 150] as const,
      bottomOpening: [208, 142] as const,
      depthMm: 75,
    },
    mounts,
    ribs,
    ribWitnesses: [
      { id: 'right-spine-stem', min: [199.2, 100, -6] as Vec, max: [201.8, 108, 1] as Vec },
      { id: 'sp20-cross-stem', min: [178, 106.45, -6] as Vec, max: [188, 109.05, 1] as Vec },
      {
        id: 'right-spine-junction',
        min: [199.2, 106.45, -6] as Vec,
        max: [201.8, 109.05, 1] as Vec,
      },
      {
        id: 'right-rear-boss-rib-root',
        min: [207, 123.7, -2.8] as Vec,
        max: [207.8, 126.3, -1.2] as Vec,
      },
    ],
    networkRegions: [
      {
        id: 'right-sp20-t-network',
        min: [198.8, 53.8, -6.6] as Vec,
        max: [213, 137.2, 2.1] as Vec,
        minimumVolumeMm3: 1500,
      },
    ],
    toolReserves: [
      [174, 127.75],
      [174, 87.75],
    ].map(([x, y], i) => ({
      id: `sp20-rear-tool-${i + 1}`,
      centre: [x, y] as const,
      radius: 17.5,
      minZ: -15,
      maxZ: 3.5,
      innerAcrossFlatsMm: 25.4,
      innerHexClockDegrees: 30,
      removedIds: [
        'case-electronics-analogue-hood',
        'case-electronics-shield-bond-screw',
        'case-electronics-shield-bond-nut',
        'case-electronics-shield-bond-washer',
      ],
    })),
    locationStatus:
      'Seven user-confirmed locations measured from the corresponding internal 214 × 150 groove-cavity corners. Toggle/clip row faces the handle and batteries face the hinges. All axes are 20 mm below the upper groove edge (Z0.5), normal to the nominal tapered walls. Verify the actual local wall and washer/seal footprint before drilling.',
    externalScrewSelection:
      'Seven available M3 × 15 socket screws are shortened to an effective 11 mm. The nominal stack is 4 mm case wall, 0.8 mm installed/compressed seal and 0.5 mm steel washer. Nuts span local X2.2..4.6 and screw tips reach X5.7, leaving 1.1 mm full-engagement tail and 0.5 mm recess inside the 6.2 mm boss. Measure the real wall and installed seal compression before cutting; no ingress or clamp-force rating is claimed.',
  };
}

type Mount = ReturnType<typeof caseWallMountStructure>['mounts'][number];
const place = (mount: Mount, child: Shape): Shape => ({
  kind: 'transform',
  child,
  translation: mount.frame.at,
  rotation: mount.frame.rotation,
});

/** Reapply these cutters AFTER the complete faceplate/additions union, including the six-millimetre slab. */
export function caseWallMountCutters(p: Parameters): Shape[] {
  return caseWallMountStructure(p).mounts.map((mount) => {
    const radius = 5.8 / Math.sqrt(3),
      hex: [number, number][] = Array.from({ length: 6 }, (_, i) => [
        radius * Math.cos(((i + 0.5) * Math.PI) / 3),
        radius * Math.sin(((i + 0.5) * Math.PI) / 3),
      ]),
      pocket: Shape = {
        kind: 'transform',
        child: prism(hex, 2.7, 0),
        translation: [2.2, 0, 0],
        rotation: [0, 90, 0],
      };
    return place(
      mount,
      union(
        cylinder(1.7, 11.1, [-4.2, 0, 0], 'x'),
        pocket,
        box([2.7, 6.3, 5.8], [2.2, 0, -2.9]),
        box([2.7, 7.5, 11], [2.2, 6, -8]),
      ),
    );
  });
}

/** Local rear ears retain their tapered-wall contact face; the old slab rectangle does not clip them away. */
export function caseWallMountShapes(p: Parameters): Shape {
  const m = caseWallMountStructure(p);
  const ears: Shape = {
    kind: 'intersect',
    children: [
      union(...m.mounts.map((mount) => place(mount, box([6, 12, 14.5], [0.2, -6, -4.5])))),
      box([214, 150, 23.5], [0, 0, -20]),
    ],
  };
  return subtract(
    union(ears, ...m.ribs.map(({ min, max }) => box(max.map((n, i) => n - min[i]) as Vec, min))),
    ...caseWallMountCutters(p),
  );
}

/** Actual exterior stack; seals are purchased annular references at provisional installed compression. */
export function caseWallMountHardware(p: Parameters): ConfiguredPiece[] {
  return caseWallMountStructure(p).mounts.flatMap((mount) => {
    const m = definition(mount.side, mount.alongWallMm),
      canonical = ([x, y, z]: Vec): Vec => [-y, x, z],
      rotation = (r: Vec): Vec => [r[0], r[1], r[2] + 90],
      bolt = screw(
        mount.hardwareIds.screw,
        3,
        11,
        canonical(m.point([-5.3, 0, 0])),
        rotation([0, -90 - (m.theta * 180) / Math.PI, m.phi]),
      ),
      nut = hexNut(
        mount.nutId,
        3,
        5.5,
        2.4,
        canonical(mount.nutPlacement.at),
        rotation(mount.nutPlacement.rotation),
      );
    bolt.label = bolt.component.name = 'Socket screw M3 × 15 shortened to 11 mm';
    bolt.component.procurement = {
      designation: bolt.label,
      manufacturer: 'Select supplier',
      source:
        'Shorten an available M3 × 15 screw to an effective under-head length of 11 mm and deburr its end after checking the actual wall/washer/seal stack.',
    };
    bolt.component.notes =
      'Effective 11 mm length after shortening an available M3 × 15 screw and deburring its end. Nominal 4 mm case wall + 0.8 mm compressed seal + 0.5 mm steel washer; fit the real stack before cutting. Full nut engagement with a 1.1 mm tail, recessed 0.5 mm inside the printed boss.';
    nut.component.notes =
      'Ordinary M3 AF5.5 × 2.4 nut. On the bare faceplate, lift the nut into the rear-open loading well, then slide it tangentially into its captured seat before other components and exterior screws/washer/seals are fitted. The hex T-slot captures it axially between 2 mm and 1.3 mm cheeks.';
    const ring = (seal: boolean): ConfiguredPiece => ({
      component: {
        id: seal ? mount.hardwareIds.seal : mount.hardwareIds.washer,
        name: seal
          ? 'Sealing washer Ø10 / Ø3.2 · installed thickness 0.8 mm'
          : 'Steel flat washer M3 · Ø7 / Ø3.2 × 0.5',
        libraryId: washer.id,
        parameters: { bore: 3.2, outerDiameter: seal ? 10 : 7, thickness: seal ? 0.8 : 0.5 },
        state: 'default',
        quantity: 1,
        supply: 'standard',
        placement: {
          translation: canonical(m.point([seal ? -4.4 : -5.05, 0, 0])),
          rotation: rotation(mount.nutPlacement.rotation),
        },
        notes: seal
          ? 'Purchased elastomeric annulus, represented at a provisional installed/compressed thickness of 0.8 mm. Select its free thickness/material and verify the real compression; this reference is not a TPU print or an ingress rating.'
          : 'Nominal steel washer outside the seal, bearing beneath the external socket head.',
        procurement: {
          designation: seal
            ? 'Elastomer sealing washer Ø10 / Ø3.2, installed 0.8 mm'
            : 'Steel washer Ø7 / Ø3.2 × 0.5',
          manufacturer: 'Select supplier',
          source: 'Nominal dimensional reference; qualify the delivered case-wall stack.',
        },
      },
      label: seal ? 'Compressed sealing washer reference' : 'Steel washer M3',
      color: seal ? 0x30373b : 0xa6afb8,
    });
    return [bolt, nut, ring(false), ring(true)];
  });
}
