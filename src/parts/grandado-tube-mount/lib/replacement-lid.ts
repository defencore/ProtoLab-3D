import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  roundedRect,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { grandadoBodyMeasurements, grandadoPieces, grandadoRimSpec, grandadoSpec } from '../../catalog-enclosure/lib/grandado';
import { layout, move, type PrintedPiece } from './spec';

const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
type Point = [number, number];
type GrooveSegment =
  | { kind: 'line'; points: [Point, Point] }
  | { kind: 'arc'; points: [Point, Point, Point]; center: Point; radius: number };

/** Reuse the delivered-body measurements from its purchased library definition. */
const measuredBodyRim = {
  outerLength: grandadoBodyMeasurements.reportedRimOuter[0],
  outerWidth: grandadoBodyMeasurements.reportedRimOuter[1],
  innerLength: grandadoBodyMeasurements.reportedRimInner[0],
  innerWidth: grandadoBodyMeasurements.reportedRimInner[1],
} as const;

/** One closed face-seal path. Every screw passage lies outside this contour. */
function gasketPath(railX: number, railY: number, r: number): GrooveSegment[] {
  const x = 36.5,
    y = 24;
  const line = (a: Point, b: Point): GrooveSegment => ({ kind: 'line', points: [a, b] });
  const arc = (cx: number, cy: number, start: number): GrooveSegment => {
    const point = (angle: number): Point => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    return {
      kind: 'arc',
      center: [cx, cy],
      radius: r,
      points: [point(start), point(start + Math.PI / 4), point(start + Math.PI / 2)],
    };
  };
  return [
    line([-x + r, railY], [x - r, railY]),
    line([x - r, railY], [x - r, y]),
    arc(x, y, Math.PI),
    line([x, y - r], [railX, y - r]),
    line([railX, y - r], [railX, -y + r]),
    line([railX, -y + r], [x, -y + r]),
    arc(x, -y, Math.PI / 2),
    line([x - r, -y], [x - r, -railY]),
    line([x - r, -railY], [-x + r, -railY]),
    line([-x + r, -railY], [-x + r, -y]),
    arc(-x, -y, 0),
    line([-x, -y + r], [-railX, -y + r]),
    line([-railX, -y + r], [-railX, y - r]),
    line([-railX, y - r], [-x, y - r]),
    arc(-x, y, (3 * Math.PI) / 2),
    line([-x + r, y], [-x + r, railY]),
  ];
}

/** The factory body/inserts remain unchanged; original screws use lowered seats and trimmed tips. */
export function replacementLidSpec(p: Parameters) {
  const d = layout(p);
  const screwUnderHeadZ = d.bodySeamZ + 3;
  const screwHeadTopZ = screwUnderHeadZ + grandadoSpec.screwHeadHeight;
  const screwOffsetZ = screwUnderHeadZ - (d.boxTranslation + grandadoSpec.screwUnderHeadZ);
  const screwTipTrim = 2;
  const factoryScrewTipZ = d.boxTranslation + grandadoSpec.screwTipZ + screwOffsetZ + screwTipTrim;
  const factoryBlindBottomZ = d.boxTranslation + grandadoSpec.screwBlindBottomZ;
  const outerWall = Number(p.gasketOuterWall);
  const endWall = Number(p.gasketEndWall);
  const innerWall = Number(p.gasketInnerWall);
  const width = Number(p.gasketGrooveWidth);
  const depth = Number(p.gasketGrooveDepth);
  const axialFitAllowance = Number(p.lidAxialFitAllowance ?? 0);
  const endRelief = axialFitAllowance / 2;
  const skirtWall = outerWall + width + innerWall;
  const skirtEndWall = endWall + width + innerWall + endRelief;
  const railX = grandadoSpec.bodyLength / 2 - endWall - width / 2;
  const railY = grandadoSpec.bodyWidth / 2 - outerWall - width / 2;
  const endInnerFlankX = railX - width / 2 - endRelief;
  const endOuterFlankX = railX + width / 2;
  const postRadius = grandadoSpec.screwHeadRadius + 0.1 + width / 2;
  const innerRadius = d.lidOuterRadius - d.lidRoofThickness;
  const outerRailY = railY + width / 2;
  const sourceSideContactWidth = Math.max(
    0, Math.min(railY + width / 2, grandadoRimSpec.railY + grandadoRimSpec.wall / 2) - Math.max(railY - width / 2, grandadoRimSpec.railY - grandadoRimSpec.wall / 2),
  );
  const sourceEndContactWidth = Math.max(
    0, Math.min(endOuterFlankX, grandadoRimSpec.railX + grandadoRimSpec.wall / 2) - Math.max(endInnerFlankX, grandadoRimSpec.railX - grandadoRimSpec.wall / 2),
  );
  const grooveMinimumDepth = Math.min(
    depth,
    Math.sqrt(innerRadius ** 2 - outerRailY ** 2) - d.bodySeamZ,
  );
  const grooveMaximumDepth = Math.min(depth, innerRadius - d.bodySeamZ);
  return {
    outerRadius: d.lidOuterRadius,
    innerRadius: d.lidOuterRadius - d.lidRoofThickness,
    lipInnerRadius: d.lidOuterRadius - d.lidLipThickness,
    tubeRadius: d.radius,
    roofThickness: d.lidRoofThickness,
    lipThickness: d.lidLipThickness,
    apexZ: d.lidOuterRadius,
    apexAbovePipe: d.lidOuterRadius - d.radius,
    bodySeamZ: d.bodySeamZ,
    bodyTranslation: d.boxTranslation,
    bodyLength: grandadoSpec.bodyLength,
    bodyWidth: grandadoSpec.bodyWidth,
    bodyCornerRadius: 5,
    skirtWall,
    skirtEndWall,
    skirtInnerLength: grandadoSpec.bodyLength - 2 * skirtEndWall,
    skirtInnerWidth: grandadoSpec.bodyWidth - 2 * skirtWall,
    skirtInnerCornerRadius: 5 - Math.max(skirtWall, skirtEndWall),
    gasketGroove: {
      path: gasketPath(railX, railY, postRadius),
      closed: true,
      railX,
      railY,
      postCenterlineRadius: postRadius,
      outerWall,
      endWall,
      innerWall,
      totalRimWidth: skirtWall,
      totalRimLength: skirtEndWall,
      width,
      axialFitAllowance,
      endRelief,
      endInnerFlankX,
      endOuterFlankX,
      endWidth: width + endRelief,
      endReliefHalfSpanY: 24 - postRadius,
      depth,
      openingZ: d.bodySeamZ,
      nominalFloorZ: d.bodySeamZ + depth,
      floorClipRadius: innerRadius,
      grooveMinimumDepth,
      grooveMaximumDepth,
      floorZRange: { min: d.bodySeamZ + grooveMinimumDepth, max: d.bodySeamZ + grooveMaximumDepth },
      screwHeadFootprintClearance: postRadius - width / 2 - grandadoSpec.screwHeadRadius,
      screwPassageClearance: postRadius - width / 2 - 2,
      sourcePostBoreClearance: postRadius - width / 2 - 2.15,
      sourcePostOutsideMargin: 4.8 - (postRadius + width / 2),
      sourceStraightContactWidth: Math.min(sourceSideContactWidth, sourceEndContactWidth),
      sourceSideContactWidth,
      sourceEndContactWidth,
      fullFootprintSupported: false,
      raisedBodyRim: {
        height: d.bodyRimHeight,
        topZ: d.bodyRimTopZ,
        wall: grandadoRimSpec.wall,
        railX: grandadoRimSpec.railX,
        railY: grandadoRimSpec.railY,
        endClearance: Math.min(
          grandadoRimSpec.railX - grandadoRimSpec.wall / 2 - endInnerFlankX,
          endOuterFlankX - grandadoRimSpec.railX - grandadoRimSpec.wall / 2,
        ),
        sideClearance: width / 2 - grandadoRimSpec.wall / 2 - Math.abs(railY - grandadoRimSpec.railY),
        cornerClearance: Math.min(
          postRadius + width / 2 - (grandadoRimSpec.postRadius + grandadoRimSpec.wall / 2),
          grandadoRimSpec.postRadius - grandadoRimSpec.wall / 2 - (postRadius - width / 2),
        ),
        floorClearance: grooveMinimumDepth - d.bodyRimHeight,
      },
      measuredBodyRim: {
        ...measuredBodyRim,
        uniformWall: true,
        inferredWallX: (measuredBodyRim.outerLength - measuredBodyRim.innerLength) / 2,
        inferredWallY: (measuredBodyRim.outerWidth - measuredBodyRim.innerWidth) / 2,
        centerlineX: (measuredBodyRim.outerLength + measuredBodyRim.innerLength) / 4,
        centerlineY: (measuredBodyRim.outerWidth + measuredBodyRim.innerWidth) / 4,
        clearanceX: Math.min(
          endOuterFlankX - measuredBodyRim.outerLength / 2,
          measuredBodyRim.innerLength / 2 - endInnerFlankX,
        ),
        innerClearanceX: measuredBodyRim.innerLength / 2 - endInnerFlankX,
        outerClearanceX: endOuterFlankX - measuredBodyRim.outerLength / 2,
        clearanceY: Math.min(
          railY + width / 2 - measuredBodyRim.outerWidth / 2,
          measuredBodyRim.innerWidth / 2 - (railY - width / 2),
        ),
        height: d.bodyRimHeight,
        source: 'Delivered-body user measurements. The rim is approximately uniform 1 mm, 1.8 mm high above the measured 22 mm hard body. The small inferred X/Y thickness difference reflects measurement uncertainty, not a nonuniform wall. Precise common thickness, corner profile and centring tolerances remain unmeasured.',
      },
      estimatedBodyInnerLength: 78.6,
      estimatedBodyInnerWidth: 53.6,
      estimatedBodyOuterLength: 83,
      estimatedBodyOuterWidth: 58,
      qualification:
        'The user measured the original lid outer wall 1.6 mm, groove width 1.8 mm, inner wall 1 mm and approximate depth 2 mm, and corrected the delivered rim spans to outside 78.7 × 53.7 mm and inside 76.8 × 51.6 mm. The source library includes the measured 22 mm hard body, 1.8 mm raised rim and 6 mm ears. Uniform rim wall is modeled as approximately 1 mm; precise molded corners and the 2 mm support ledge remain estimates. A subsequent print barely closed along X while Y fitted easily. The kit-local total axial fit allowance relieves only the inner straight end flanks, preserving the outer flanks, Y fit, post turns, screw axes, full default 2 mm depth and nominal 0.2 mm rigid-rim floor headroom. Repeat physical closure and actual gasket compression remain unqualified.',
      referenceEnvelope:
        'The optional reference shows only the actual channel occupied volume. It is not an actual rubber solid, free or deformed gasket model, squeeze calculation or procurement identity.',
    },
    windowLength: d.windowLength,
    windowWidth: d.windowWidth,
    coverLength: 102,
    coverWidth: 76,
    coverCornerRadius: 10,
    bossCoreRadius: 6.5,
    screwOffsetZ,
    screwTipTrim,
    originalScrewUnderHeadLength: grandadoSpec.screwUnderHeadZ - grandadoSpec.screwTipZ,
    modifiedScrewUnderHeadLength:
      grandadoSpec.screwUnderHeadZ - grandadoSpec.screwTipZ - screwTipTrim,
    screwBlindBottomZ: factoryBlindBottomZ,
    screwTipClearance: factoryScrewTipZ - factoryBlindBottomZ,
    minimumBearingWeb: screwUnderHeadZ - d.bodySeamZ,
    insertBottomZ: d.boxTranslation + grandadoSpec.insertBottomZ,
    insertTopZ: d.boxTranslation + grandadoSpec.insertTopZ,
    screwHeadDiameter: 2 * grandadoSpec.screwHeadRadius,
    screwUnderHeadZ,
    screwHeadTopZ,
    screwThroughDiameter: 4,
    screwCounterboreDiameter: 6.8,
    bearingCoreRadialWall: (13 - 6.8) / 2,
    screwSeats: grandadoSpec.screwCenters.map(([x, y]) => ({
      x,
      y,
      bodyPostTopZ: d.bodySeamZ,
      bearingZ: screwUnderHeadZ,
      screwHeadTopZ,
      counterboreTopZ: Math.sqrt(d.lidOuterRadius ** 2 - (Math.abs(y) + 3.4) ** 2),
      factoryScrewTipZ,
      blindBottomZ: factoryBlindBottomZ,
      headRecess:
        Math.sqrt(d.lidOuterRadius ** 2 - (Math.abs(y) + grandadoSpec.screwHeadRadius) ** 2) -
        screwHeadTopZ,
      bearingWeb: screwUnderHeadZ - d.bodySeamZ,
    })),
    supportsRequired: true,
    printOrientation:
      'Aerodynamic exterior upward. Support the open underside and curved peripheral lip; remove supports from the accessible cavity and preserve the seating face and screw bearings.',
    thicknessScope:
      'The structural roof is 3 mm radially. The channel retains the measured 1.8 mm side groove and 1 mm inner wall. The total axial print-fit allowance expands only the inner straight end flanks by half that allowance per end; the inner opening shortens by the same total amount to preserve the end wall. Outer flanks and post turns stay fixed. The floor is clipped to the inside roof cylinder. Internal screw columns retain a 3 mm bearing web below each head; the upper recess rim is clipped to the cylindrical outside and is not claimed to have 3 mm sidewall at every height. The supported peripheral wrap outside the window is the intentional 1 mm radial lip.',
    closureScope:
      'One continuous lid face-gasket groove follows the upper body rim and turns inboard around all four screw posts, leaving the screw passages outside the sealed cavity. The body rim compresses the actual gasket into the lid groove while the existing hard seating faces stop closure. No locating lip projects into the body. The measured groove section is retained with a roof-preserving floor; gasket cross-section, compression and airtight or waterproof performance are not established.',
  };
}

type LidSpec = ReturnType<typeof replacementLidSpec>;

const axialCylinder = (radius: number, length: number): Shape => ({
  kind: 'cylinder',
  radius,
  height: length,
  origin: [-length / 2, 0, 0],
  axis: 'x',
  previewSegments: 192,
});

function roof(s: LidSpec): Shape {
  return intersect(
    subtract(
      axialCylinder(s.outerRadius, s.coverLength + 2),
      axialCylinder(s.innerRadius, s.coverLength + 4),
    ),
    roundedRect(s.coverLength, s.coverWidth, s.coverCornerRadius, 0, s.outerRadius + 2),
  );
}

function seatingSkirt(s: LidSpec): Shape {
  return intersect(
    subtract(
      roundedRect(s.bodyLength, s.bodyWidth, s.bodyCornerRadius, s.bodySeamZ, s.outerRadius),
      roundedRect(
        s.skirtInnerLength,
        s.skirtInnerWidth,
        s.skirtInnerCornerRadius,
        s.bodySeamZ - 0.2,
        s.outerRadius + 0.4,
      ),
    ),
    axialCylinder(s.outerRadius, s.coverLength + 2),
  );
}

export function replacementLidSeatingSkirt(p: Parameters): Shape {
  return seatingSkirt(replacementLidSpec(p));
}

/** Constant-width stroke built from native boxes, cylinders and quarter annuli. */
function grooveBand(s: LidSpec, width: number, z: number, height: number): Shape {
  const half = width / 2;
  const children: Shape[] = [];
  for (const segment of s.gasketGroove.path) {
    const a = segment.points[0],
      b = segment.points.at(-1)!;
    if (segment.kind === 'line') {
      const horizontal = Math.abs(a[1] - b[1]) < 1e-9;
      children.push(
        horizontal
          ? box([Math.abs(b[0] - a[0]), width, height], [Math.min(a[0], b[0]), a[1] - half, z])
          : box([width, Math.abs(b[1] - a[1]), height], [a[0] - half, Math.min(a[1], b[1]), z]),
      );
    } else {
      const [cx, cy] = segment.center;
      const outer = segment.radius + half;
      const mid = segment.points[1];
      children.push(
        intersect(
          subtract(
            { ...cylinder(outer, height, [cx, cy, z]), previewSegments: 128 } as Shape,
            {
              ...cylinder(segment.radius - half, height + 0.2, [cx, cy, z - 0.1]),
              previewSegments: 128,
            } as Shape,
          ),
          box(
            [outer, outer, height + 0.2],
            [cx + (mid[0] < cx ? -outer : 0), cy + (mid[1] < cy ? -outer : 0), z - 0.1],
          ),
        ),
      );
    }
    // Round every join at full width. This also gives the tangent pieces a
    // positive overlap for a robust native union instead of a pinched corner.
    children.push({ ...cylinder(half, height, [a[0], a[1], z]), previewSegments: 64 } as Shape);
  }
  return { kind: 'union', nativeBatch: true, children };
}

/** The lid-side cutter opens on the unchanged body hard-stop plane. */
export function replacementLidGroove(p: Parameters): Shape {
  const s = replacementLidSpec(p);
  return grooveSpace(s, 0.05);
}

function grooveSpace(s: LidSpec, openingAllowance: number): Shape {
  const g = s.gasketGroove;
  const z = s.bodySeamZ - openingAllowance;
  const height = g.depth + openingAllowance;
  // Shorten only the inner mating contour. Each strip meets the existing
  // horizontal dogleg channel; the post arcs and outside flank remain fixed.
  const endReliefs: Shape[] = g.endRelief > 0 ? [-1, 1].map((sign) =>
    box(
      [g.endWidth, 2 * g.endReliefHalfSpanY, height],
      [sign > 0 ? g.endInnerFlankX : -g.endOuterFlankX, -g.endReliefHalfSpanY, z],
    ),
  ) : [];
  return intersect(
    union(grooveBand(s, g.width, z, height), ...endReliefs),
    axialCylinder(s.innerRadius, s.coverLength + 2),
  );
}

/** Actual channel-space witness only; no gasket section or deformation is assumed. */
export function replacementLidGasketReference(p: Parameters): Shape {
  return grooveSpace(replacementLidSpec(p), 0);
}

function lidShape(s: LidSpec): Shape {
  const cores = s.screwSeats.map(
    ({ x, y }) =>
      ({
        ...cylinder(s.bossCoreRadius, s.outerRadius - s.bodySeamZ, [x, y, s.bodySeamZ]),
        previewSegments: 96,
      }) as Shape,
  );
  // Removing the complete solid pipe outside its window also prevents hidden
  // undercuts below the pipe wall, so this cover can be installed from above.
  const pipeOutsideWindow = subtract(
    axialCylinder(s.tubeRadius, s.coverLength + 4),
    box(
      [s.windowLength, s.windowWidth, 2 * s.outerRadius],
      [-s.windowLength / 2, -s.windowWidth / 2, 0],
    ),
  );
  const holes = s.screwSeats.flatMap(({ x, y, bearingZ }) => [
    cylinder(s.screwThroughDiameter / 2, s.outerRadius + 3, [x, y, s.bodySeamZ - 1]),
    cylinder(s.screwCounterboreDiameter / 2, s.outerRadius + 3, [x, y, bearingZ]),
  ]);
  return subtract(
    intersect(
      union(roof(s), seatingSkirt(s), ...cores),
      axialCylinder(s.outerRadius, s.coverLength + 2),
    ),
    pipeOutsideWindow,
    ...holes,
    grooveSpace(s, 0.05),
  );
}

export function replacementLidPieces(p: Parameters): PrintedPiece[] {
  const s = replacementLidSpec(p);
  const shape = lidShape(s);
  return [
    {
      id: 'grandado-curved-replacement-lid',
      label: 'Smooth curved Grandado lid · internal screw columns and continuous gasket groove',
      shape,
      printShape: shape,
      color: 0xdce2e3,
      role: 'cassette',
      // Merge redundant Boolean splitters: the raw gland has four STL seam gaps.
      // Native symmetric differences are empty; refinement gives a closed mesh.
      nativeRefine: true,
      preserveAuthoredFrame: true,
    },
  ];
}

/** Source factory screws, lowered to the internal seats and shortened only at the tips. */
export function replacementLidFactoryScrews(p: Parameters) {
  const s = replacementLidSpec(p);
  return grandadoPieces('assembled')
    .slice(6)
    .map((piece, index) => ({
      ...piece,
      label: `Original Grandado lid screw ${index + 1} · tip shortened 2 mm`,
      shape: move(
        intersect(
          piece.shape,
          box([200, 200, 50], [-100, -100, grandadoSpec.screwTipZ + s.screwTipTrim]),
        ),
        [0, 0, s.bodyTranslation + s.screwOffsetZ],
      ),
    }));
}
