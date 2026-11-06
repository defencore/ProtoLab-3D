import type { Parameters } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import { caseBodyMountAxes } from './case-mechanical-layout';

export type ElectronicsPose = { at: Vec; rotation: Vec };
/** Operator coordinates; module origins retain their library PCB datums. */
export function caseElectronicsLayout(_p: Parameters) {
  const pose = (at: Vec, rotation: Vec = [0, 0, 0]): ElectronicsPose => ({ at, rotation });
  return {
    floorBottom: -55.5,
    floorTop: -52.5,
    floorMin: [5, 6] as const,
    floorMax: [209, 144] as const,
    floorPerimeterWidth: 6,
    honeycombHoleFlat: 12,
    honeycombWeb: 2.6,
    mountingIslandRadius: 8,
    tieLandWidth: 5,
    hat: pose([152, 38.5, -40.5]),
    heltec: pose([53, 33, -44], [0, 0, 90]),
    adc: pose([177, 102, -44]),
    bucks: [pose([35, 10, -33.7], [-90, 0, 0]), pose([35, 52, -33.7], [-90, 0, 0])],
    filters: [pose([140, 83, -46]), pose([176, 126, -44])],
    pwm: pose([181, 31, -18.8], [-90, 0, 0]),
    pwmReserve: [28, 18, 8] as const,
    bodyMountAxes: caseBodyMountAxes,
    batteryPocketCentres: [
      [65, 91],
      [65, 124.5],
    ] as const,
    batteryPocketSize: [89, 25] as const,
    batterySeatTop: -53.1,
    batteryWallThickness: 1.6,
    batteryWallTop: 1.5,
    batteryPierCentresY: [91, 107.75, 124.5] as const,
    xt60MiddleReactionPier: { min: [7.5, 107.75] as const, max: [20.5, 110.75] as const },
    batterySeatStripRows: [79, 99, 112.5, 132.5] as const,
    batteryEndLipRows: [77, 103.5, 110.5, 137] as const,
    tieWidth: 2.5,
    tieThickness: 1,
    tieSlot: [3.2, 1.4] as const,
    alternateBuckTieCentres: [
      [-4, 5.5, 12],
      [-8, -2, 8],
    ] as const,
    quietPodMin: [156, 80] as const,
    quietPodMax: [198, 138] as const,
    quietPodRoof: -31,
    quietPodWall: 1.5,
    analogueRearEntry: { centre: [184, 138] as const, width: 8, height: 7, foilSetback: 1 },
    spiEntryY: [86, 91] as const,
    filteredSupplyEntryY: [120, 125] as const,
    foilLayerMax: 0.15,
    foilSeamLayers: 2,
    foilOverlapMin: 10,
    shieldBond: [149, 130] as const,
    shieldLugReserve: [8, 8, 1] as const,
    adcReserve: [24, 24, 12] as const,
    buckReserve: [42, 22, 8] as const,
    filterReserve: [20, 7, 4] as const,
    serviceScrewIds: [1, 2, 3, 4].map((n) => `case-lid-screw-${n}`),
    serviceTranslation: [0, 0, -85] as Vec,
  };
}
