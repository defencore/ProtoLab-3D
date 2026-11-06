import type { Parameters } from '../../../core/types';
import {
  cylinder,
  roundedRect,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { defaults as sourceDefaults } from '../../grandado-tube-mount/configurator';
import {
  replacementLidGroove,
  replacementLidSeatingSkirt,
  replacementLidSpec,
} from '../../grandado-tube-mount/lib/replacement-lid';
import { grandadoSpec } from '../../catalog-enclosure/lib/grandado';
import { accessWindowDatums, at, intersect, tubeReferenceDatums } from './shared';

/** Cover heads are no longer raised to fit an arbitrarily selected screw pair. */
export const coverDatums = {
  outerRadius: tubeReferenceDatums.outerDiameter / 2 + 2.6,
  innerRadius: tubeReferenceDatums.innerDiameter / 2,
  tubeRadius: tubeReferenceDatums.outerDiameter / 2,
  peripheralWrap: 2.6,
  centralRoof: 4.6,
  upperBearing: 35.6,
  lowerBearing: -34.2,
  upperHardSeat: 31.2,
  upperBearingWeb: 2.4,
  lowerFrameContact: -29.9,
  lowerHardSeat: -31.2,
  couplingBottom: -17.5,
  couplingLength: 10,
  grip: 69.8,
} as const;
const sourceParameters = () => ({
  ...sourceDefaults,
  tubeOD: tubeReferenceDatums.outerDiameter,
  tubeID: tubeReferenceDatums.innerDiameter,
  fitClearance: 0.2,
});

export function smoothUpperCover(): Shape {
  return structuralCover(true);
}

function structuralCover(upper: boolean): Shape {
  const source = sourceParameters();
  const s = replacementLidSpec(source);
  const outerRadius = coverDatums.outerRadius,
    innerRadius = coverDatums.innerRadius,
    coreStart = s.bodySeamZ,
    bearing = upper ? coverDatums.upperBearing : -coverDatums.lowerBearing;
  const axial = (radius: number, length: number): Shape =>
    cylinder(radius, length, [-length / 2, 0, 0], 'x');
  const roof = intersect(
    subtract(axial(outerRadius, s.coverLength + 2), axial(innerRadius, s.coverLength + 4)),
    roundedRect(s.coverLength, s.coverWidth, s.coverCornerRadius, 0, outerRadius + 2),
  );
  const cores = s.screwSeats.map(({ x, y }) =>
    cylinder(s.bossCoreRadius, outerRadius - coreStart, [x, y, coreStart]),
  );
  // Full cores back both groove flanks where the channel turns around each screw.
  const skirt = upper ? [replacementLidSeatingSkirt(source)] : [];
  const pipeOutsideWindow = subtract(
    axial(s.tubeRadius, s.coverLength + 4),
    roundedRect(
      accessWindowDatums.length,
      accessWindowDatums.width,
      accessWindowDatums.cornerRadius,
      0,
      2 * outerRadius,
    ),
  );
  const holes = s.screwSeats.flatMap(({ x, y }) => [
    cylinder(s.screwThroughDiameter / 2, outerRadius + 3, [x, y, s.bodySeamZ - 1]),
    cylinder(s.screwCounterboreDiameter / 2, outerRadius + 3, [x, y, bearing]),
  ]);
  return subtract(
    intersect(union(roof, ...cores, ...skirt), axial(outerRadius, s.coverLength + 2)),
    pipeOutsideWindow,
    ...holes,
    ...(upper ? [replacementLidGroove(source)] : []),
  );
}

/** Matching structural outside and full lower cores; no nonfunctional seal skirt. */
export function lowerCoverBlank(_p: Parameters): Shape {
  const source = structuralCover(false);
  const mirrored = at(source, [0, 0, 0], [180, 0, 0]);
  const posts = grandadoSpec.screwCenters.map(([x, y]) =>
    cylinder(5, coverDatums.lowerFrameContact - coverDatums.lowerHardSeat + 0.2, [
      x,
      y,
      coverDatums.lowerHardSeat - 0.2,
    ]),
  );
  return subtract(
    union(mirrored, ...posts),
    ...grandadoSpec.screwCenters.map(([x, y]) =>
      cylinder(1.7, 24, [x, y, -coverDatums.outerRadius - 1]),
    ),
  );
}
