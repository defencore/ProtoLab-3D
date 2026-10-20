import type { Parameters } from '../../../core/types';
import { millingLayout } from './layout';
import { millingAcceptanceRequirements } from './requirements';
import { beamLoadComplianceMm } from './beam-screening';

/** Screening models only. Units: N, mm, N/mm². No measured joint stiffness. */
export const screeningModuli = { aluminium: 70000, steel: 210000 } as const;
export const screeningForces = [100, 300, 500] as const;

function positive(...values: number[]) {
  if (values.some((value) => !Number.isFinite(value) || value <= 0))
    throw new Error('Screening dimensions and elastic modulus must be finite and positive.');
}
function load(force: number) {
  if (!Number.isFinite(force) || force < 0)
    throw new Error('Screening force must be finite and nonnegative.');
}
export function rectangularSecondMoment(width: number, thickness: number) {
  positive(width, thickness);
  return (width * thickness ** 3) / 12;
}
/** Full one-piece web and two front ribs; openings and the local nut platform are excluded. */
export function uSectionSecondMoment(
  width: number,
  webThickness: number,
  ribThickness: number,
  ribDepth: number,
) {
  positive(width, webThickness, ribThickness, ribDepth);
  const webArea = width * webThickness,
    ribArea = 2 * ribThickness * ribDepth,
    ribCentre = (webThickness + ribDepth) / 2,
    centroid = (ribArea * ribCentre) / (webArea + ribArea);
  return (
    rectangularSecondMoment(width, webThickness) +
    webArea * centroid ** 2 +
    2 * rectangularSecondMoment(ribThickness, ribDepth) +
    ribArea * (ribCentre - centroid) ** 2
  );
}
/** Section through the rear support recess, before individual bores and root fillets. */
export function recessedUSectionSecondMoment(
  width: number,
  webThickness: number,
  ribThickness: number,
  ribDepth: number,
  recessWidth: number,
  recessDepth: number,
) {
  positive(width, webThickness, ribThickness, ribDepth, recessWidth, recessDepth);
  if (recessWidth >= width || recessDepth >= webThickness)
    throw new Error('The recess must leave web and side stock.');
  const sections = [
    { area: width * webThickness, y: 0, ownI: rectangularSecondMoment(width, webThickness) },
    {
      area: 2 * ribThickness * ribDepth,
      y: (webThickness + ribDepth) / 2,
      ownI: 2 * rectangularSecondMoment(ribThickness, ribDepth),
    },
    {
      area: -recessWidth * recessDepth,
      y: (recessDepth - webThickness) / 2,
      ownI: -rectangularSecondMoment(recessWidth, recessDepth),
    },
  ];
  const area = sections.reduce((sum, section) => sum + section.area, 0);
  const centroid = sections.reduce((sum, section) => sum + section.area * section.y, 0) / area;
  return sections.reduce(
    (sum, section) => sum + section.ownI + section.area * (section.y - centroid) ** 2,
    0,
  );
}
/** Spindle/tool is a rigid lever below the loaded plate, clamped at the lower guide row. */
export function plateToolDeflection(
  force: number,
  guideToTip: number,
  clampToTip: number,
  width: number,
  thickness: number,
  modulus: number,
) {
  load(force);
  positive(guideToTip, clampToTip, modulus);
  if (clampToTip > guideToTip)
    throw new Error('This strip model needs the spindle clamp below the lower guide row.');
  return (
    (force * (guideToTip ** 3 - clampToTip ** 3)) /
    (3 * modulus * rectangularSecondMoment(width, thickness))
  );
}
export function centralRibDeflection(
  force: number,
  span: number,
  width: number,
  height: number,
  modulus: number,
) {
  load(force);
  positive(span, modulus);
  return (force * span ** 3) / (48 * modulus * rectangularSecondMoment(width, height));
}
export function nutCarrierDeflection(
  force: number,
  arm: number,
  width: number,
  thickness: number,
  modulus: number,
) {
  load(force);
  positive(arm, modulus);
  return (force * arm ** 3) / (3 * modulus * rectangularSecondMoment(width, thickness));
}

/** All cases come from the current authored layout, never a factory performance claim. */
export function millingStructuralScreen(p: Parameters) {
  const v = millingLayout(p);
  const lowerGuideToTip = v.guideLow - v.blockSpacingZ / 2 - v.tableTop;
  const clampToTip = v.toolProjection + v.spindle.clampCenterZ;
  const movingI = recessedUSectionSecondMoment(
    v.movingPlateWidth,
    v.movingPlateThickness,
    v.movingRibThickness,
    v.movingRibDepth,
    v.zRearChannelWidth,
    v.zRearChannelDepth,
  );
  const towerI = uSectionSecondMoment(
    v.fixedPlateWidth,
    v.fixedPlateThickness,
    v.fixedRibThickness,
    v.fixedRibDepth,
  );
  const towerEI = screeningModuli.aluminium * towerI;
  const towerCases = (forceN: number, restrainRotation: boolean) =>
    [0, v.workZ / 2, v.workZ].map((zMm) => ({
      zMm,
      deflectionMm: beamLoadComplianceMm(
        forceN,
        towerEI,
        [-1, 1].map((side) => ({
          positionMm: v.beamCenter + (side * v.railSpacingX) / 2,
          restrainRotation,
        })),
        [
          {
            positionMm: v.guideLow - v.blockSpacingZ / 2 + zMm,
            forceFactor: 1 + lowerGuideToTip / v.blockSpacingZ,
          },
          {
            positionMm: v.guideLow + v.blockSpacingZ / 2 + zMm,
            forceFactor: -lowerGuideToTip / v.blockSpacingZ,
          },
        ],
      ),
    }));
  return {
    method: 'recessed-u-section-and-guide-row-beam-screening-v3',
    status: 'not-qualified' as const,
    assumptions: [
      'Aluminium E=70 GPa and steel E=210 GPa are assumed; selected stock grades still need delivered certificates.',
      'Forces 100/300/500 N are independent sensitivity cases, not approved machining envelopes.',
      'The moving section includes the broad rear support recess; individual shaft/nut/flange bores, root fillets and varying pocket heights are excluded. The fixed section remains unperforated. Both assume rigid spindle/guide connections.',
      'Table ribs are simply supported; actual end-joint restraint and slat load sharing are unmeasured.',
      'Rib stiffness uses the gross manufacturer 100×100×8 section value; holes/end inserts and local slot/slat flexibility need qualification.',
      'Fixed tower uses actual guide force pairs at three Z poses with either clamped or freely rotating X support rows; these are model alternatives, not measured bounds.',
      'Different axes/poses are separate cases. These deflections must not be summed as a total accuracy prediction.',
      'No chatter, bearing/preload compliance, thermal drift, workholding or tool bending is qualified.',
    ],
    dimensions: {
      lowerGuideToTip,
      clampToTip,
      movingPlateWidth: v.movingPlateWidth,
      movingPlateThickness: v.movingPlateThickness,
      movingSectionI: movingI,
      fixedPlateWidth: v.fixedPlateWidth,
      fixedPlateThickness: v.fixedPlateThickness,
      fixedSectionI: towerI,
      tableRibSpan: v.tableRibSpan,
      tableRibWidth: v.tableRibWidth,
      tableRibHeight: v.tableRibHeight,
      tableRibCatalogI: v.tableRibCatalogI,
      nutCarrierArm: v.zPlateBack + v.zRearChannelDepth - v.zScrewY,
      nutCarrierDepth: v.zNutCarrierDepth,
      nutCarrierThickness: v.zNutCarrierThickness,
    },
    cases: screeningForces.map((forceN) => ({
      forceN,
      movingPlateToolYmm:
        (forceN * (lowerGuideToTip ** 3 - clampToTip ** 3)) /
        (3 * screeningModuli.aluminium * movingI),
      fixedTowerClampedYmm: Math.max(...towerCases(forceN, true).map((one) => one.deflectionMm)),
      fixedTowerRowRotationYmm: Math.max(
        ...towerCases(forceN, false).map((one) => one.deflectionMm),
      ),
      tableSingleRibZmm:
        (forceN * v.tableRibSpan ** 3) / (48 * screeningModuli.steel * v.tableRibCatalogI),
      tableTwoRibZmm:
        ((forceN / 2) * v.tableRibSpan ** 3) / (48 * screeningModuli.steel * v.tableRibCatalogI),
      nutCarrierZmm: nutCarrierDeflection(
        forceN,
        v.zPlateBack + v.zRearChannelDepth - v.zScrewY,
        v.zNutCarrierWidth - 34.05,
        v.zNutCarrierThickness,
        screeningModuli.aluminium,
      ),
    })),
  };
}

export const millingQualificationRequirements = [
  ...millingAcceptanceRequirements,
  'Define actual materials, cutter, cutting force, feed, acceleration, stock/fixture mass and loaded accuracy before selecting the operating envelope.',
  'Validate the reinforced moving Z saddle, fixed Z tower, integral nut platform, table ribs and position-dependent bed deformation as a complete load path, including joint slip and chatter under load.',
  'Prove running torque with the selected driver voltage/current, actual moving masses, screw/rotor inertia, friction and a stated reserve; holding torque is not running torque.',
  'Order traceable screw accuracy/preload and guide accuracy/preload. Check critical speed, buckling, bearing rigidity, lubrication, covers and installed alignment.',
  'Qualify the power-loss Z restraint with delivered brake sizing, static holding reserve, release timing, fault feedback and a tested stopping sequence. A holding brake is not an approved dynamic stopping brake.',
  'Qualify spindle nameplate/VFD current and torque-speed range. For water spindles, prove actual coolant temperature, operating-point flow and heat rejection of the selected active cooler.',
  'Release actual alloy/temper, bolt grade, washer hardness, thread pull-out, preload/torque and machine datum tolerances; the current shape/engagement checks do not establish them.',
  'Verify long-stock availability or release a fabrication route, machining access and assembly sequence for all blanks; produce inspected detail and assembly drawings.',
  'Complete guarded-machine electrical, protective-bonding, limits, emergency-stop, interlock and commissioning documentation. A modeled relay is not a validated safety circuit.',
  'Review applicable ISO 16090-1 safety requirements and ISO 230-series machine acceptance tests using the adopted editions. No standards compliance is declared.',
];

export function millingQualificationAssessment(p: Parameters): string[] {
  const s = millingStructuralScreen(p).cases.find((one) => one.forceN === 100)!;
  return [
    'Finished-part target: ±0.025 mm (complete 0.05 mm tolerance field) for D16T and nonferrous prototypes. Mechanical status: not qualified for manufacturing or powered operation.',
    `Separate member estimates at 100 N: Z saddle ${(s.movingPlateToolYmm * 1000).toFixed(1)} µm, fixed tower up to ${(s.fixedTowerRowRotationYmm * 1000).toFixed(1)} µm, single table rib ${(s.tableSingleRibZmm * 1000).toFixed(1)} µm. These estimates exclude joints, guides, tool and thermal errors; they do not establish finished-part accuracy.`,
    'Delivered servo, screw/guide executions, Z brake, cooling and guarding still need commissioning. Linear feedback measures carriage motion; loaded cutter position must be verified with calibration and machining tests.',
  ];
}
