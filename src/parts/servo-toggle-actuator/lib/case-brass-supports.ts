import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import purchasedComponent from '../../purchased-component/part';
import { screw } from './hardware';
import { caseBodyMountAxes } from './case-mechanical-layout';
import { caseLowerCapturePlaneZ } from './case-lower-split';

const floorBottom = -55.5;
const headSeat = -52.4;
const canonical = ([x, y, z]: Vec): Vec => [-y, x, z];
const hex = (af: number, height: number, [x, y, z]: Vec): Shape => ({
  kind: 'transform',
  child: prism(
    Array.from({ length: 6 }, (_, i): [number, number] => {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      return [(af / Math.sqrt(3)) * Math.cos(a), (af / Math.sqrt(3)) * Math.sin(a)];
    }),
    height,
    z,
  ),
  translation: [x, y, 0],
  rotation: [0, 0, 0],
});

/** User-confirmed AF5 stock; all coordinates are final operator millimetres. */
export function caseBrassLayout() {
  return [
    ...caseBodyMountAxes.map((at, i) => ({
      role: 'main' as const,
      at,
      index: i + 1,
      length: 50,
      bottomSeatZ: -47.5,
      topSeatZ: 2.5,
      padRadius: 4.5,
      threadDepth: 3.5,
    })),
    ...(
      [
        [185, 16],
        [185, 48],
        [206, 16],
        [206, 48],
      ] as const
    ).map((at, i) => ({
      role: 'carrier' as const,
      at,
      index: i + 1,
      length: 40,
      bottomSeatZ: -49.5,
      topSeatZ: -9.5,
      padRadius: 3.8,
      threadDepth: 5.5,
    })),
  ].map((s) => ({
    ...s,
    id: `case-brass-${s.role}-${s.index}`,
    bottomScrewId: `case-brass-bottom-screw-${s.role}-${s.index}`,
    topScrewId: s.role === 'main' ? `case-lid-screw-${s.index}` : undefined,
  }));
}

/** Main tray pads stop below the captured cradle feet; carrier roots keep their accepted seats. */
export function caseBrassFloorSeats(): Shape {
  return union(
    ...caseBrassLayout().map(({ role, at: [x, y], bottomSeatZ, padRadius }) =>
      cylinder(
        padRadius,
        (role === 'main' ? caseLowerCapturePlaneZ : bottomSeatZ + 1.4) - floorBottom,
        [x, y, floorBottom],
      ),
    ),
  );
}

/** Apply after the complete lower-body union so fitted cradle walls cannot refill a brass route. */
export function caseBrassFloorCutters(): Shape[] {
  return caseBrassLayout().flatMap(({ at: [x, y], bottomSeatZ, topSeatZ }) => [
    cylinder(2.9, headSeat - floorBottom + 0.1, [x, y, floorBottom - 0.1]),
    cylinder(1.7, bottomSeatZ - headSeat + 0.2, [x, y, headSeat - 0.1]),
    hex(5.3, topSeatZ - bottomSeatZ + 0.2, [x, y, bottomSeatZ]),
  ]);
}

export function caseBrassUpperCutters(role: 'main' | 'carrier'): Shape[] {
  return caseBrassLayout()
    .filter((s) => s.role === role)
    .map(({ at: [x, y] }) =>
      hex(5.3, role === 'main' ? 1.1 : 2.6, [x, y, role === 'main' ? 1.4 : -12.1]),
    );
}

export function caseBrassStructure() {
  return {
    coordinateSystem: 'operator XYZ millimetres',
    supports: caseBrassLayout().map((s) => {
      const [x, y] = s.at;
      const webPart = (partId: string, minZ: number, maxZ: number, minimumThicknessMm: number) => ({
        partId,
        minZ,
        maxZ,
        minimumThicknessMm,
        annularProbe: {
          axisPoint: [x, y, minZ] as Vec,
          minZ,
          maxZ,
          outerRadiusMm: 2.4,
          innerRadiusMm: 1.7,
          insetMm: 0.01,
        },
      });
      return {
        id: s.id,
        role: s.role,
        axisPoint: [x, y, s.bottomSeatZ] as Vec,
        axis: [0, 0, 1] as Vec,
        bodyLengthMm: s.length,
        acrossFlatsMm: 5,
        bottomSeatZ: s.bottomSeatZ,
        topSeatZ: s.topSeatZ,
        floorPartId: 'case-lower-body',
        bottomBearingPartId: s.role === 'main' ? 'case-lower-cradle' : 'case-lower-body',
        clampedPartIds:
          s.role === 'main' ? ['case-lower-body', 'case-lower-cradle'] : ['case-lower-body'],
        upperPartId: s.role === 'main' ? 'case-top-bridge' : 'case-test-clip-carrier',
        bottomScrewId: s.bottomScrewId,
        ...(s.topScrewId ? { topScrewId: s.topScrewId } : {}),
        bottomHeadSeatZ: headSeat,
        minimumFloorWebMm: s.bottomSeatZ - headSeat,
        webParts:
          s.role === 'main'
            ? [
                webPart('case-lower-body', headSeat, caseLowerCapturePlaneZ, 2.9),
                webPart('case-lower-cradle', caseLowerCapturePlaneZ, s.bottomSeatZ, 2),
              ]
            : [webPart('case-lower-body', headSeat, s.bottomSeatZ, 2.9)],
        minimumBearingAreaMm2: 12,
        femaleOpeningEnvelopeMm: 3,
        minimumUsableFemaleDepthMm: s.threadDepth,
        femaleDepthStatus:
          s.role === 'carrier'
            ? 'User confirmed at least 5.5 mm usable M3 depth for the FF40 stock.'
            : 'Minimum 3.5 mm usable depth required at both ends; verify the actual FF50 stock before assembly.',
        toolReserve: {
          acrossFlatsMm: 2.5,
          clockDegrees: 30,
          minZ: -75.5,
          maxZ: -53.9,
          removedIds: [] as string[],
        },
        rootProbes: [-1, 1].flatMap((side) => [
          {
            partId: 'case-lower-body',
            min: [x + (side < 0 ? -2.4 : 2), y - 0.4, headSeat + 0.1] as Vec,
            max: [
              x + (side < 0 ? -2 : 2.4),
              y + 0.4,
              (s.role === 'main' ? caseLowerCapturePlaneZ : s.bottomSeatZ) - 0.1,
            ] as Vec,
          },
          ...(s.role === 'main'
            ? [
                {
                  partId: 'case-lower-cradle',
                  min: [x + (side < 0 ? -2.4 : 2), y - 0.4, caseLowerCapturePlaneZ + 0.1] as Vec,
                  max: [x + (side < 0 ? -2 : 2.4), y + 0.4, s.bottomSeatZ - 0.1] as Vec,
                },
              ]
            : []),
        ]),
        retainedComponentIds: [s.id, s.bottomScrewId],
        removedBeforeWithdrawalIds: s.topScrewId ? [s.topScrewId] : [],
      };
    }),
    assembly:
      'On the detached lower assembly place the four cradle feet on the tray pads, insert the main FF50 standoffs through the sleeve routes and tighten the four original bottom M3 × 8 screws. Each main clamp spans 2.9 mm of tray and 2.0 mm of cradle foot before its unchanged brass seat. The four carrier screws and FF40 seats retain their original one-part floor stack. All eight heads remain 0.1 mm above the exterior floor plane. Main FF50 supports seat in the cassette underside; carrier FF40 supports seat in 2.5 mm-deep underside hex registers. Four M3 × 15 lid screws engage the main brass ends. Keep all bottom screws fitted during lid removal and ordinary service. Existing carrier ties retain withdrawal; no carrier top screws are added. Check actual end depth and screw bottoming before tightening.',
  };
}

/** Smooth nominal M3 end openings represent the required usable depth, not a measured thread profile. */
export function caseBrassHardware(): ConfiguredPiece[] {
  return caseBrassLayout().flatMap((s) => {
    const [x, y] = s.at;
    const recipe = subtract(
      hex(5, s.length, [0, 0, 0]),
      cylinder(1.5, s.threadDepth + 0.1, [0, 0, -0.1]),
      cylinder(1.5, s.threadDepth + 0.1, [0, 0, s.length - s.threadDepth]),
    );
    const body: ConfiguredPiece = {
      component: {
        id: s.id,
        name: `Brass M3 female/female standoff · AF5 × ${s.length}`,
        libraryId: purchasedComponent.id,
        parameters: {
          ...purchasedComponent.defaults,
          meshBackend: 'jscad',
          recipe: JSON.stringify(recipe),
        },
        state: purchasedComponent.states?.[0]?.id ?? 'default',
        quantity: 1,
        supply: 'purchased',
        placement: { translation: canonical([x, y, s.bottomSeatZ]), rotation: [0, 0, 90] },
        procurement: {
          designation: `M3 FF ${s.length}mm, brass hex AF5`,
          manufacturer: 'User stock',
          source: 'User-confirmed stock body length, female/female ends and 5 mm across flats.',
        },
        notes: `User stock dimensional reference. Smooth M3 opening envelopes extend ${s.threadDepth} mm at each end to represent the minimum usable depth, not a measured supplier thread or chamfer. ${s.role === 'carrier' ? 'Usable FF40 depth at least 5.5 mm was confirmed by the user.' : 'Verify at least 3.5 mm usable female depth at both ends of each FF50.'} Check screw bottoming and delivered dimensions; no force rating is assigned.`,
      },
      label: `Brass FF${s.length} support`,
      color: 0xb99647,
    };
    return [body, screw(s.bottomScrewId, 3, 8, canonical([x, y, headSeat]), [180, 0, 90])];
  });
}
