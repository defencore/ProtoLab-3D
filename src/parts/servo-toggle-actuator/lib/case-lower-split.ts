import {
  box,
  cylinder,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { caseBodyMountAxes } from './case-mechanical-layout';

const bounds = (min: Vec, max: Vec) => ({ min, max });
export const caseLowerCapturePlaneZ = -49.5;
export const caseLowerMainBrassSeatZ = -47.5;
export const caseLowerSleeveRadiusMm = 4.5;
export const caseLowerFloorFootprint = {
  size: [206.8, 141.2] as const,
  centre: [107, 75] as const,
  cornerRadius: 6,
  bottomZ: -55.5,
  topZ: -52.5,
  previousSize: [204, 138] as const,
};

/** Four straight sleeves join the unchanged fitted cradle to feet clamped under the existing FF50 stock. */
export function caseLowerCradlePosts(): Shape {
  return union(
    ...caseBodyMountAxes.map(([x, y]) =>
      cylinder(caseLowerSleeveRadiusMm, 1.5 - caseLowerCapturePlaneZ, [
        x,
        y,
        caseLowerCapturePlaneZ,
      ]),
    ),
  );
}

function postOpening(x: number, y: number) {
  const side = x < 83.5 ? -1 : 1;
  return {
    ...bounds(
      [x + (side < 0 ? -4.6 : 1.8), y - 1.2, -47.5],
      [x + (side < 0 ? -1.8 : 4.6), y + 1.2, -19.7],
    ),
    outward: [side, 0, 0] as Vec,
    widthMm: 2.4,
    facingFlatIndex: side < 0 ? 2 : 5,
    mouth: [x + side * 4.6, y, -33.6] as Vec,
    basis:
      'Longitudinal cleaning access in the new sleeve extension only; the full 2 mm foot and original upper cradle are unchanged.',
  };
}

export function caseLowerCradlePostCuts(): Shape[] {
  return caseBodyMountAxes.map(([x, y]) => {
    const { min, max } = postOpening(x, y);
    return box(max.map((v, i) => v - min[i]) as Vec, min);
  });
}

export function caseLowerCarrierSupportStructure() {
  const rootWall = bounds([134.7, 12, -12], [139, 54, 1.5]);
  const seatWall = bounds([146, 12, -12], [149.5, 54, 1.5]);
  const crossRibs = [18, 46].map((y) => bounds([134.7, y, -12], [149.5, y + 4, 1.5]));
  return {
    partId: 'case-lower-cradle',
    carrierId: 'case-test-clip-carrier',
    architecture: 'straight-bed-rooted-ladder' as const,
    printBedPlaneZ: 1.5,
    positiveBearingPlaneZ: -12,
    rootWall,
    seatWall,
    crossRibs,
    fullDepthMm: 13.5,
    rootWallThicknessMm: 4.3,
    seatWallThicknessMm: 3.5,
    crossRibThicknessMm: 4,
    minimumMemberThicknessMm: 3.5,
    mainWallLapMm: 3,
    maxX: 149.5,
    bedContactPatches: [
      bounds([134.8, 16.1, 1.4], [138.9, 49.9, 1.5]),
      bounds([146.1, 12.1, 1.4], [149.4, 53.9, 1.5]),
      bounds([139.1, 18.1, 1.4], [145.9, 21.9, 1.5]),
      bounds([139.1, 46.1, 1.4], [145.9, 49.9, 1.5]),
    ],
    mainWallLapProbes: [18.1, 46.1].map((y) =>
      bounds([134.8, y, -11.8], [137.6, y + 3.8, 1.3]),
    ),
    seatWallLapProbes: [18.1, 46.1].map((y) =>
      bounds([146.1, y, -13], [149.4, y + 3.8, -10.1]),
    ),
    sections: [
      {
        id: 'carrier-ladder-front-rib-section',
        normal: 'x' as const,
        ...bounds([141.9, 18, -12], [142.1, 22, 1.5]),
        minimumAreaMm2: 54,
      },
      {
        id: 'carrier-ladder-rear-rib-section',
        normal: 'x' as const,
        ...bounds([141.9, 46, -12], [142.1, 50, 1.5]),
        minimumAreaMm2: 54,
      },
      {
        id: 'carrier-ladder-main-spine-section',
        normal: 'y' as const,
        ...bounds([134.7, 31.9, -12], [139, 32.1, 1.5]),
        minimumAreaMm2: 58.05,
      },
      {
        id: 'carrier-ladder-seat-spine-section',
        normal: 'y' as const,
        ...bounds([146, 31.9, -12], [149.5, 32.1, 1.5]),
        minimumAreaMm2: 47.25,
      },
    ],
    retainedBrassSupportIds: [1, 2, 3, 4].map((i) => `case-brass-carrier-${i}`),
    webWitnesses: [
      {
        id: 'carrier-ladder-main-root',
        partId: 'case-lower-cradle',
        ...bounds([134.8, 20, -11.8], [138.9, 46, 1.3]),
      },
      {
        id: 'carrier-ladder-front-rib',
        partId: 'case-lower-cradle',
        ...bounds([139.1, 18.1, -11.8], [145.9, 21.9, 1.3]),
      },
      {
        id: 'carrier-ladder-rear-rib',
        partId: 'case-lower-cradle',
        ...bounds([139.1, 46.1, -11.8], [145.9, 49.9, 1.3]),
      },
      {
        id: 'carrier-ladder-seat-root',
        partId: 'case-lower-cradle',
        ...bounds([146.1, 20, -11.8], [149.4, 46, 1.3]),
      },
    ],
    basis:
      'A straight rectangular ladder replaces the thin diagonal web and its flange. Both continuous spines and the two separated 4 mm ribs start directly on the inverted Z1.5 print bed. The 4.3 mm root spine laps the full original 3 mm main wall; the 3.5 mm outer spine joins the existing clip-seat side wall over a full 2 mm height. The original carrier, positive seats, two registrations, complete ties and four FF40 brass supports remain unchanged. Local supports elsewhere in the cradle remain a separate print check; no force rating is inferred.',
  };
}

export function caseLowerCarrierSupportLadder(): Shape {
  const m = caseLowerCarrierSupportStructure();
  return union(
    ...[m.rootWall, m.seatWall, ...m.crossRibs].map(({ min, max }) =>
      box(max.map((v, i) => v - min[i]) as Vec, min),
    ),
  );
}

export function caseLowerSplitStructure() {
  return {
    trayId: 'case-lower-body',
    cradleId: 'case-lower-cradle',
    attachment: 'four-main-brass-post-capture' as const,
    capturePlaneZ: caseLowerCapturePlaneZ,
    fittedCradleBaseZ: -19.7,
    floorFootprint: caseLowerFloorFootprint,
    assembly:
      'Place the four cradle feet on the tray pads, insert the original FF50 standoffs through the upper AF5.3 routes and tighten the four original bottom M3 × 8 screws. Each screw clamps the 2.9 mm tray web and 2.0 mm cradle foot into the brass end. These bottom screws stay fitted when the lid is removed, so the tray and cradle remain one handling assembly. No separate seam screws, nuts, rail keys or long support rails remain.',
  };
}

/** Source-bound per-part clamp planes; these are geometric fit checks, not a force rating. */
export function caseLowerFourPostCapture() {
  return {
    trayId: 'case-lower-body',
    cradleId: 'case-lower-cradle',
    capturePlaneZ: caseLowerCapturePlaneZ,
    brassSeatZ: caseLowerMainBrassSeatZ,
    headSeatZ: -52.4,
    carrierSupport: caseLowerCarrierSupportStructure(),
    minimumTrayWebMm: 2.9,
    minimumCradleFootWebMm: 2,
    minimumCombinedWebMm: 4.9,
    retainedWhenLidRemoved: true,
    posts: caseBodyMountAxes.map(([x, y], i) => {
      const inward = y < 35 ? 1 : -1;
      const loY = y + (inward > 0 ? 2.9 : -3.2);
      const cleaningSlot = postOpening(x, y);
      const retainedSide = cleaningSlot.outward[0] < 0 ? 1 : -1;
      return {
        id: `lower-cradle-post-${i + 1}`,
        trayId: 'case-lower-body',
        cradleId: 'case-lower-cradle',
        brassId: `case-brass-main-${i + 1}`,
        bottomScrewId: `case-brass-bottom-screw-main-${i + 1}`,
        lidScrewId: `case-lid-screw-${i + 1}`,
        axisPoint: [x, y, caseLowerCapturePlaneZ] as Vec,
        axis: [0, 0, 1] as Vec,
        outerRadiusMm: caseLowerSleeveRadiusMm,
        cleaningSlot,
        minZ: caseLowerCapturePlaneZ,
        maxZ: 1.5,
        brassSeatZ: caseLowerMainBrassSeatZ,
        capturePlaneZ: caseLowerCapturePlaneZ,
        headSeatZ: -52.4,
        bottomScrewTipZ: -44.4,
        boreDiameterMm: 3.4,
        routeAcrossFlatsMm: 5.3,
        routeClockDegrees: 30,
        routeMinZ: caseLowerMainBrassSeatZ,
        minimumTrayWebMm: 2.9,
        minimumCradleFootWebMm: 2,
        minimumCombinedWebMm: 4.9,
        minimumMetalBearingAreaMm2: 12,
        minimumTrayCradleBearingAreaMm2: 50,
        footBounds: bounds(
          [x - 4.5, y - 4.5, caseLowerCapturePlaneZ],
          [x + 4.5, y + 4.5, caseLowerMainBrassSeatZ],
        ),
        socketRegistration: {
          partId: 'case-lower-cradle',
          supportId: `case-brass-main-${i + 1}`,
          axisPoint: [x, y, caseLowerMainBrassSeatZ] as Vec,
          acrossFlatsMm: 5.3,
          hexClockDegrees: 30,
          minZ: caseLowerMainBrassSeatZ,
          maxZ: 1.5,
          engagementMm: 49,
          blockingTranslationMm: 0.4,
          minimumNominalWallMm: 4.5 - 5.3 / Math.sqrt(3),
          wallProbeSegments: Array.from({ length: 6 }, (_, face) => ({
            face,
            segments: [
              { minZ: face === cleaningSlot.facingFlatIndex ? -19.55 : -47.35, maxZ: 1.35 },
            ],
          })),
          wallGapScope:
            'The five retained extension flats and complete original upper collar; the cleaning opening itself is not assigned a closed-wall gap.',
        },
        contacts: [
          {
            id: 'foot-to-tray',
            movingId: 'case-lower-cradle',
            fixedId: 'case-lower-body',
            planeZ: caseLowerCapturePlaneZ,
            contactBox: bounds(
              [x - 4.5, y - 4.5, caseLowerCapturePlaneZ - 0.02],
              [x + 4.5, y + 4.5, caseLowerCapturePlaneZ + 0.02],
            ),
            shift: [0, 0, -0.01] as Vec,
            minimumAreaMm2: 50,
          },
          {
            id: 'brass-to-foot',
            movingId: `case-brass-main-${i + 1}`,
            fixedId: 'case-lower-cradle',
            planeZ: caseLowerMainBrassSeatZ,
            contactBox: bounds(
              [x - 4.5, y - 4.5, caseLowerMainBrassSeatZ - 0.02],
              [x + 4.5, y + 4.5, caseLowerMainBrassSeatZ + 0.02],
            ),
            shift: [0, 0, -0.01] as Vec,
            minimumAreaMm2: 12,
          },
          {
            id: 'head-to-tray',
            movingId: `case-brass-bottom-screw-main-${i + 1}`,
            fixedId: 'case-lower-body',
            planeZ: -52.4,
            contactBox: bounds([x - 3, y - 3, -52.42], [x + 3, y + 3, -52.38]),
            shift: [0, 0, 0.01] as Vec,
            minimumAreaMm2: 12,
          },
        ],
        webAnnuli: [
          {
            partId: 'case-lower-body',
            minZ: -52.4,
            maxZ: caseLowerCapturePlaneZ,
            outerRadiusMm: 2.4,
            innerRadiusMm: 1.7,
            minimumThicknessMm: 2.9,
            annularProbe: {
              axisPoint: [x, y, -52.4] as Vec,
              minZ: -52.4,
              maxZ: caseLowerCapturePlaneZ,
              outerRadiusMm: 2.4,
              innerRadiusMm: 1.7,
              insetMm: 0.01,
            },
          },
          {
            partId: 'case-lower-cradle',
            minZ: caseLowerCapturePlaneZ,
            maxZ: caseLowerMainBrassSeatZ,
            outerRadiusMm: 2.4,
            innerRadiusMm: 1.7,
            minimumThicknessMm: 2,
            annularProbe: {
              axisPoint: [x, y, caseLowerCapturePlaneZ] as Vec,
              minZ: caseLowerCapturePlaneZ,
              maxZ: caseLowerMainBrassSeatZ,
              outerRadiusMm: 2.4,
              innerRadiusMm: 1.7,
              insetMm: 0.01,
            },
          },
        ],
        sleeveWallProbes: [
          bounds(
            [x + (retainedSide < 0 ? -4.1 : 3.7), y - 0.25, -47.3],
            [x + (retainedSide < 0 ? -3.7 : 4.1), y + 0.25, -19.6],
          ),
          bounds([x - 0.25, y - 4.1, -47.3], [x + 0.25, y - 3.7, -19.6]),
          bounds([x - 0.25, y + 3.7, -47.3], [x + 0.25, y + 4.1, -19.6]),
        ],
        slotEdgeProbes: [-1, 1].map((side) =>
          bounds(
            [x + (cleaningSlot.outward[0] < 0 ? -3.4 : 3), y + (side < 0 ? -1.75 : 1.35), -47.3],
            [x + (cleaningSlot.outward[0] < 0 ? -3 : 3.4), y + (side < 0 ? -1.35 : 1.75), -19.9],
          ),
        ),
        closedEndProbes: [
          bounds(
            [x + (cleaningSlot.outward[0] < 0 ? -4.1 : 3.7), y - 0.25, -49.4],
            [x + (cleaningSlot.outward[0] < 0 ? -3.7 : 4.1), y + 0.25, -47.6],
          ),
          bounds(
            [x + (cleaningSlot.outward[0] < 0 ? -4.1 : 3.7), y - 0.25, -19.6],
            [x + (cleaningSlot.outward[0] < 0 ? -3.7 : 4.1), y + 0.25, -18.6],
          ),
        ],
        jointRootProbes: [
          bounds([x + 2.6, loY, -19.8], [x + 3, loY + 0.3, -18.6]),
          bounds([x - 3, loY, -19.8], [x - 2.6, loY + 0.3, -18.6]),
        ],
        upperRootProbes: [
          bounds([x + 2.6, loY, -19.6], [x + 3.6, loY + 0.3, -18.6]),
          bounds([x - 3.6, loY, -19.6], [x - 2.6, loY + 0.3, -18.6]),
        ],
        footRootProbes: [-1, 1].map((side) =>
          bounds(
            [x + (side < 0 ? -2.4 : 2), y - 0.3, -49.4],
            [x + (side < 0 ? -2 : 2.4), y + 0.3, -47.6],
          ),
        ),
        toolReserve: {
          acrossFlatsMm: 2.5,
          clockDegrees: 30,
          minZ: -75.5,
          maxZ: -53.9,
          removedIds: [] as string[],
        },
        retainedComponentIds: [`case-brass-main-${i + 1}`, `case-brass-bottom-screw-main-${i + 1}`],
        removedBeforeWithdrawalIds: [`case-lid-screw-${i + 1}`],
      };
    }),
    limits:
      'The four existing bottom screws permanently capture both printed webs and the original FF50 supports; ordinary lid removal does not release the lower joint. The sleeve extensions have narrow outward longitudinal cleaning openings, with closed feet and intact original upper collars. The carrier-side ladder has two straight full-depth ribs and both spines rooted directly on the inverted print bed. The inverted print is 51 mm high and retains the true internal closing ledges; remove all local support through the cleaning openings before inserting the metal posts. The measured reference slicer comparison includes the added print burden of this four-point capture architecture and does not establish production settings. Do not chamfer into the actual brass-end seat or assume delivered-stock thread depth.',
  };
}
