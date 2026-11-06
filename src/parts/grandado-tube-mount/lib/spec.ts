import type { Parameters } from '../../../core/types';
import { box, cylinder, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { grandadoSpec } from '../../catalog-enclosure/lib/grandado';

export interface PrintedPiece {
  id: string;
  label: string;
  shape: Shape;
  /** Orientation for printing; the layout places this shape on Z=0. */
  printShape: Shape;
  color: number;
  role: 'jig' | 'cassette';
  /** Preserve this known-valid topology when OpenCASCADE refinement changes it. */
  nativeRefine?: boolean;
  /** Preserve the installation frame independently of native Boolean refinement. */
  preserveAuthoredFrame?: boolean;
}

export interface HardwareDescriptor {
  id: string;
  label: string;
  kind: 'screw' | 'nut' | 'washer';
  diameter: number;
  head?: 'socket-cap' | 'countersunk';
  length?: number;
  headSize?: number;
  headHeight?: number;
  driveWidth?: number;
  driveDepth?: number;
  acrossFlats?: number;
  height?: number;
  pitch?: number;
  bore?: number;
  outerDiameter?: number;
  thickness?: number;
  translation: Vec;
  rotation: Vec;
}

export const move = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});

export function layout(p: Parameters) {
  const value = (key: string) => Number(p[key]);
  const od = value('tubeOD'),
    id = value('tubeID'),
    radius = od / 2;
  const boxLength = grandadoSpec.bodyLength,
    boxWidth = grandadoSpec.bodyWidth,
    boxHeight = grandadoSpec.height;
  const protrusion = 1;
  const boxTop = radius + protrusion;
  // Keep the physically tried lid and battery datums while correcting the body.
  const bodySeamZ = boxTop - 14.8;
  const boxBottom = bodySeamZ - grandadoSpec.bodyHardHeight;
  const bodyLowering = boxTop - boxHeight - boxBottom;
  const fit = value('fitClearance'),
    mountPitch = value('mountPitch');
  const holderLength = value('holderLength'),
    holderWidth = value('holderWidth'),
    holderHeight = value('holderHeight');
  const holderTop = bodySeamZ - 32,
    holderBottom = holderTop - holderHeight;
  const earThickness = value('earThickness'),
    earTop = boxBottom + earThickness;
  const earClearance = value('earClearance');
  const earPocketTop = earTop + earClearance;
  const nutTop = boxBottom - 2.4,
    nutBottom = nutTop - 2.4;
  return {
    od,
    id,
    radius,
    innerRadius: id / 2,
    cassetteRadius: id / 2 - fit,
    fit,
    boxLength,
    boxWidth,
    boxHeight,
    boxTop,
    protrusion,
    boxBottom,
    bodyLowering,
    bodySeamZ,
    bodyHardHeight: grandadoSpec.bodyHardHeight,
    bodyIncludingRimHeight: grandadoSpec.bodyIncludingRimHeight,
    bodyRimHeight: grandadoSpec.sealingRimHeight,
    bodyRimTopZ: bodySeamZ + grandadoSpec.sealingRimHeight,
    lidOuterRadius: boxTop,
    lidRoofThickness: 3,
    lidLipThickness: 1,
    minimumStructure: 3,
    boxTranslation: boxBottom - grandadoSpec.baseZ,
    earThickness,
    earTop,
    earClearance,
    earPocketTop,
    cassetteJoinZ: earPocketTop,
    mountPitch,
    mountXs: [-mountPitch / 2, mountPitch / 2] as const,
    mountHole: value('mountHole'),
    nutAF: value('nutAF'),
    nutHeight: value('nutHeight'),
    nutTop,
    nutBottom,
    screwHeadDiameter: 6,
    screwHeadHeight: 1.7,
    screwTop: Math.sqrt(radius * radius - 3 * 3) - 0.05,
    holderLength,
    holderWidth,
    holderHeight,
    holderTop,
    holderBottom,
    cellRadius: 9.3,
    cellLength: 65.2,
    cellPitch: 19.29,
    cellCenterZ: holderBottom + 1.6 + 9.3,
    cellSupportZ: holderBottom + 1.6,
    trayBottom: holderBottom - 3,
    trayTop: holderBottom,
    windowLength: boxLength + value('windowClearance'),
    windowWidth: boxWidth + value('windowClearance'),
    ringBore: od + value('ringClearance'),
    ringX: 78,
    ringThickness: 5,
    endMountX: 70,
    endDiscNutInnerRadius: 34,
    endDiscNutOuterRadius: 36.4,
    antenna: p.antenna === true,
    antennaX: value('antennaX'),
    antennaY: value('antennaY'),
    antennaHole: value('antennaHole'),
    connectorClearance: value('connectorClearance'),
    smaY: -boxWidth / 2 + 15.5,
    smaZMin: boxBottom + 0.9,
    smaZMax: boxBottom + 20,
    smaProjection: value('smaProjection'),
    powerCenterAboveBottom: 12,
    powerCenterZ: boxBottom + 12,
    powerDiameter: 19,
    powerDepth: value('powerDepth'),
    powerCableDiameter: value('powerCableDiameter'),
  };
}
export type Layout = ReturnType<typeof layout>;

/** User's occupied connector rectangles, expanded by an adjustable service allowance. */
export function connectorReliefs(d: Layout): Shape[] {
  const c = d.connectorClearance;
  return [
    box(
      [d.smaProjection + 2 * c, 11 + 2 * c, 19.1 + 2 * c],
      [d.boxLength / 2 - c, d.smaY - 5.5 - c, d.smaZMin - c],
    ),
    cylinder(
      d.powerDiameter / 2 + c,
      d.powerDepth + 2 * c,
      [0, -d.boxWidth / 2 - c, d.powerCenterZ],
      'y',
    ),
  ];
}

/** Underside entry stops in the wiring plenum, below the unbroken holder floor. */
export function antennaRelief(d: Layout): Shape[] {
  const bottom = -d.radius - 1;
  const top = d.trayBottom - 3;
  return d.antenna ? [cylinder(d.antennaHole / 2 + 0.5, top - bottom,
    [d.antennaX,d.antennaY,bottom])] : [];
}

export const tubeCylinder = (d: Layout, length: number, radius = d.cassetteRadius): Shape =>
  cylinder(radius, length, [-length / 2, 0, 0], 'x');

/** A 90° countersink continuing above the small flat head rim, as cut by a conical tool. */
export function tubeCountersink(d: Layout, x: number): Shape {
  const bottom = d.screwTop - d.screwHeadHeight;
  const top = d.radius + 1;
  const cone: Shape = {
    kind: 'revolve',
    profile: [
      [0, bottom],
      [1.5, bottom],
      [1.5 + top - bottom, top],
      [0, top],
    ],
  };
  return move(cone, [x, 0, 0]);
}
