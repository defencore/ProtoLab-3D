import type { Parameters } from '../../../core/types';
import cells from '../../li-ion-cell/lib/models.json';
export const polar = (r: number, a: number): [number, number] => [
  r * Math.cos((a * Math.PI) / 180),
  r * Math.sin((a * Math.PI) / 180),
];
export const ties = [45, 135, 225, 315].map((a) => polar(34, a));
// Service screws enter from the gas face, through the web, into the columns.
export const electronicsMount = {
  webThickness: 5,
  clearanceDiameter: 4.5,
  screwLength: 16,
  washerThickness: 0.8,
  washerOuterDiameter: 9,
  washerInnerDiameter: 4.3,
} as const;
export const electronicsMountPenetration =
  electronicsMount.screwLength - electronicsMount.webThickness - electronicsMount.washerThickness;
export const isH7 = (p: Parameters) => p.avionicsLayout === 'h7-4s';
export const is4S = (p: Parameters) =>
  p.avionicsLayout === 'h7-4s' || p.avionicsLayout === 'wing-4s';
export const controllerCarrierGap = 10;
export const controllerCarrierThickness = 6;
export const dispenserNutRearZ = -27;
export const cartridgeRearZ = 104.5;
export const parachuteExitRadius = 1;
// Osculati 39.306.08 catalogue envelope: a/b/c/E/M/H. M is eye-centre height,
// not thread engagement. The supplier does not dimension the internal thread depth.
export const bodyEye = {
  outerDiameter: 32.6,
  innerDiameter: 20,
  barDiameter: 6.3,
  baseDiameter: 16,
  centreHeight: 17,
  height: 33.3,
  webThickness: 8,
  backingThickness: 4,
  washerThickness: 1.6,
  boltLength: 20,
  boltHeadHeight: 8,
  source: 'https://www.yachtshop.eu/PDF/OSCULATI/ENG_2026/741_OSCULATI_ENG_2026.pdf',
} as const;
export const bodyEyePenetration =
  bodyEye.boltLength - bodyEye.webThickness - bodyEye.backingThickness - bodyEye.washerThickness;
export const finderMounts = (p: Parameters) =>
  is4S(p)
    ? [22.5, 112.5, 202.5, 292.5].map((a) => polar(36, a))
    : [45, 135, 225, 315].map((a) => polar(26.5, a));
export const dispenserMounts = Array.from({ length: 6 }, (_, i) => polar(16.5, 30 + 60 * i));
export function layout(p: Parameters) {
  const cell = cells.find((c) => c.id === p.cellModel)!;
  const t = +p.plateThickness;
  const h7 = isH7(p);
  const fourS = is4S(p);
  const directMotor = p.aftLayout === 'direct-motor';
  const foundationTop = dispenserNutRearZ - +p.dispenserDiskGap,
    foundationBottom = foundationTop - t;
  const controllerPlateTop = dispenserNutRearZ - +p.dispenserDiskGap;
  const cellTop = (fourS ? foundationBottom : 0) - 2.25,
    cellBottom = cellTop - cell.height;
  const clampTop = cellBottom - 2,
    clampBottom = clampTop - t;
  const controllerCarrierTop = fourS ? clampBottom - controllerCarrierGap : controllerPlateTop;
  const finderDepth = fourS ? 48 : 39;
  return {
    cell,
    t,
    h7,
    fourS,
    directMotor,
    cellCount: fourS ? 4 : 2,
    cellPositions: (fourS
      ? [
          [-12.3, -12.3],
          [12.3, -12.3],
          [12.3, 12.3],
          [-12.3, 12.3],
        ]
      : [
          [-29, 0],
          [29, 0],
        ]) as [number, number][],
    foundationTop,
    foundationBottom,
    finderTrayRadius: fourS ? 40.5 : 32,
    // Only the O-ring side needs release clearance. Fixed seats are finish-fit from D86.
    releaseSpigot: (86 - +p.releaseFitGap) / 2,
    releaseInner: (86 - +p.releaseFitGap) / 2 - 3,
    fixedSpigot: 43,
    fixedInner: 40,
    // Compact lower bulkhead: D100 x80 stock leaves 20 mm gross length reserve.
    bodySkirtLength: directMotor ? 26 : 30,
    bodySkirtWall: directMotor ? 5 : 3,
    bodySkirtInner: directMotor ? 38 : 40,
    bodyTieRadius: directMotor ? 31 : 33,
    bodyBackingRadius: directMotor ? 37 : 42,
    cellX: 29,
    insertPilotRadius: 6.35,
    insertHoleRadius: 6.5,
    bulkheadSocketDepth: 1.5,
    bulkheadPilotHeight: 1.45,
    cellTop,
    cellBottom,
    controllerPlateTop,
    controllerPlateBottom: controllerPlateTop - t,
    controllerCarrierTop,
    controllerCarrierBottom: controllerCarrierTop - (fourS ? controllerCarrierThickness : t),
    clampTop,
    clampBottom,
    outputPadZ: cellBottom - 2 - t - 1.8,
    electronicsTubeLength: -clampBottom + (fourS ? finderDepth - 1 : 16),
    finderTrayZ: clampBottom - finderDepth,
    packBottom: cartridgeRearZ + +p.packFrontGap,
    bodyEnd: 5 + +p.bayLength,
    rearBulkhead: directMotor ? null : 5 + +p.bayLength + +p.payloadBayLength,
    motorInterfaceZ: 5 + +p.bayLength + (directMotor ? 50 : +p.payloadBayLength + 8),
  };
}
export function assessment(p: Parameters) {
  const area = (Math.PI * 86 ** 2) / 4;
  const force =
    +p.pinCount * +p.measuredPinForce + +p.sealDrag + +p.separatingMass * 9.80665 * +p.axialGravity;
  const pressure = force / area; // N/mm2 = MPa; gauge pressure
  const pressurePa = pressure * 1e6,
    volumeM3 = +p.gasVolume / 1000;
  const temperatureK = +p.temperature + 273.15,
    specificGasConstant = 188.92;
  const gasGrams = ((pressurePa * volumeM3) / (specificGasConstant * temperatureK)) * 1000;
  const effectiveRecoveredMass =
    +p.recoveredMass - (p.aftLayout === 'direct-motor' ? +p.omittedPayloadMass : 0);
  const peakHarnessLoad = effectiveRecoveredMass * 9.80665 * +p.openingLoadFactor;
  const designHarnessLoad = peakHarnessLoad * +p.structuralFactor;
  return {
    area,
    force,
    pressureKPa: pressure * 1000,
    gasGrams,
    fullChargeKPa: (0.016 * specificGasConstant * temperatureK) / volumeM3 / 1000,
    batteryForce: ((layout(p).cellCount * layout(p).cell.weight) / 1000) * 9.80665 * +p.designG,
    grossVolume: (area * +p.bayLength) / 1e6,
    peakHarnessLoad,
    effectiveRecoveredMass,
    designHarnessLoad,
    noseDesignLoad: +p.separatingMass * 9.80665 * +p.openingLoadFactor * +p.structuralFactor,
    tieAxialStressMPa: designHarnessLoad / (4 * 20.1),
    packRadialClearance: (86 - +p.packDiameter) / 2,
  };
}
