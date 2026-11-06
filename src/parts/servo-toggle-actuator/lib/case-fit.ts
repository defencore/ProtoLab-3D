import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { roundedPlate } from './parallel-installation';
import { screw, hexNut } from './hardware';
import type { DetailSpec } from './types';

/** Countersunk from the open interior; all coordinates are operator XYZ. */
function ringWallMounting() {
  const frontExtension = 1,
    z = 16,
    padThickness = 5;
  const depth = 18.5 - z;
  const outerX = (214 - (6 * depth) / 75 - 0.6) / 2;
  const outerY = (150 - (8 * depth) / 75 - 0.6) / 2;
  const definitions = [
    ['left', 15],
    ['left', 134],
    ['right', 107.75],
    ['right', 64],
    ['front', 145],
    ['front', 17],
    ['rear', 20],
    ['rear', 107],
    ['rear', 194],
  ] as const;
  return {
    hostId: 'case-fit-seat-ring',
    screw:
      'User-selected nominal3mm self-tapper, approximately6mm90degree countersunk head; length and drive remain unselected',
    boreDiameterMm: 3.4,
    countersinkDiameterMm: 6.2,
    countersinkAngleDegrees: 90,
    countersinkDepthMm: 1.4,
    padThicknessMm: padThickness,
    padWidthMm: 10,
    minimumSideEdgeLandMm: 1.9,
    padBottomZ: 7.5,
    padTopZ: 20.3,
    minimumCylindricalWebMm: 3.4,
    minimumTopEdgeLandMm: 1.2,
    installation: {
      stage:
        'insert fitted in open case, both batteries removed, other purchased controls and connectors fitted; ARM1 guard closed',
      removedComponentIds: ['case-battery-pack-1', 'case-battery-pack-2'],
      shaftDiameterMm: 6,
      shaftLengthMm: 20,
      handleDiameterMm: 8,
      handleLengthMm: 20,
      engagementTravelMm: 5,
      scope:
        'Straight compact screwdriver envelope; head drive, hand/finger access and arbitrary longer or wider tools are not inferred.',
    },
    holes: definitions.map(([side, along], i) => {
      const outward: Vec =
        side === 'left'
          ? [-1, 0, 0]
          : side === 'right'
            ? [1, 0, 0]
            : side === 'front'
              ? [0, -1, 0]
              : [0, 1, 0];
      const wallPoint: Vec =
        side === 'left'
          ? [107 - outerX, along, z]
          : side === 'right'
            ? [107 + outerX, along, z]
            : side === 'front'
              ? [along, 75 - outerY - frontExtension, z]
              : [along, 75 + outerY, z];
      return {
        id: `ring-wall-${side}-${i + 1}`,
        side,
        alongMm: along,
        wallPoint,
        headFace: wallPoint.map((v, axis) => v - outward[axis] * padThickness) as Vec,
        outward,
        rotation: (side === 'left'
          ? [0, -90, 0]
          : side === 'right'
            ? [0, 90, 0]
            : side === 'front'
              ? [90, 0, 0]
              : [-90, 0, 0]) as Vec,
      };
    }),
  };
}

/** Measured case datums govern this fit; the supplier does not dimension its internal mounting seat. */
export function caseFitLayout(_p: Parameters) {
  return {
    caseModel: 'INTERTOOL BX-0151',
    centre: [107, 75] as const,
    outerSize: [232, 192, 111] as const,
    topOpening: [214, 150] as const,
    bottomOpening: [208, 142] as const,
    grooveSize: [218, 154, 2] as const,
    bodyDepth: 75,
    grooveFloorZ: 18.5,
    rimZ: 20.5,
    innerFloorZ: -56.5,
    lidCeilingZ: 38.5,
    closedCoverTopZ: 37.3,
    cornerRadius: 6,
    cornerRadiusApproximate: true,
    panelSize: [214, 150.6] as const,
    panelCornerRadius: 4,
    panelBottomZ: 1.5,
    panelTopZ: 7.5,
    workingPanelFit: {
      componentId: 'parallel-base',
      status: 'provisional-physical-fit-prototype',
      centre: [107, 75] as const,
      minZ: 1.5,
      maxZ: 7.5,
      outerSize: [214, 150.6] as const,
      cornerRadius: 4,
      trialPrintedOverallSize: [212.39967, 147.99944] as const,
      previousOuterSize: [216, 151.6] as const,
      edgeTrimPerSideMm: [1, 0.5] as const,
      testedAt: 'assembled-height-below-shelf',
      cornerRadiusMeasured: false,
      fullTaperReMeasured: false,
      basis:
        'After testing the 216 × 151.6 mm working plate below the shelf at assembled height, the user requested 1 mm removed from each side and 0.5–1 mm from its total height. The selected 214 × 150.6 mm outline removes 0.5 mm from the front and rear edges. All component centres, mating features and seven wall-mount axes stay fixed. R4 corners, the full taper and actual boss gaps remain provisional; the former nominal cavity and wall axes remain reference data, not a re-measured global case.',
      reporting:
        'Report previousNominalOutsideVolume and residualOutsideWorkingRegion separately. The finite Z1.5..7.5 working-band prototype region applies only to parallel-base. Nominal wall-coupon intersections of that plate inside this band are previous-reference mismatches, not evidence that real wall material was removed. All other parts and all regions outside this band retain the former nominal containment checks; no full-case-fit claim is made.',
    },
    ringId: 'case-fit-seat-ring',
    gasketId: 'case-panel-gasket',
    ringOuterSize: [217.4, 154.4] as const,
    ringCentre: [107, 74.5] as const,
    ringFrontExtensionMm: 1,
    referenceRingOuterSize: [217.4, 153.4] as const,
    workingRingFit: {
      componentIds: ['case-fit-seat-ring', 'case-panel-gasket'] as const,
      status: 'provisional-user-requested-front-edge-extension',
      direction: [0, -1, 0] as const,
      extensionMm: 1,
      fixedMountingAxes: [
        [7, 7],
        [7, 143],
        [207, 7],
        [207, 143],
      ] as const,
      referenceCentre: [107, 75] as const,
      referenceOuterSize: [217.4, 153.4] as const,
      extendedCentre: [107, 74.5] as const,
      extendedOuterSize: [217.4, 154.4] as const,
      basis:
        'The user observed a front-side fit gap and requested only the handle-side edge extended by1mm. Existing M3 axes, seats and rear/side edges stay fixed. The matching thin TPU cushion follows that front edge. This is a finite fit prototype; the earlier groove and taper dimensions remain reference data, not a newly measured case envelope.',
    },
    ringInnerOpening: [210, 146] as const,
    gasketInnerOpening: [214, 151] as const,
    gasketInnerCentre: [107, 74.5] as const,
    ringCornerRadius: 6,
    ringFlangeBottomZ: 18.9,
    ringFlangeTopZ: 20.3,
    ringFlangeThickness: 1.4,
    gasketBottomZ: 18.5,
    gasketTopZ: 18.9,
    gasketThickness: 0.4,
    grooveSideClearance: 0.3,
    grooveHeightClearance: 0.2,
    skirtBottomZ: 7.5,
    skirtTopZ: 18.9,
    skirtWallThickness: 2,
    cavitySideClearance: 0.3,
    postRadius: 4.2,
    postBottomZ: 7.5,
    postTopZ: 20.3,
    tongueDiameter: 4.2,
    tongueBottomZ: 1.5,
    tongueTopZ: 7.5,
    mountingBore: 3.4,
    screwLength: 30,
    screwUnderHeadZ: 17.1,
    headRecessDiameter: 6.2,
    headRecessDepth: 3.2,
    headTopZ: 20.1,
    mountingAxes: [
      [7, 7],
      [7, 143],
      [207, 7],
      [207, 143],
    ] as const,
    washerCentreZ: 1.25,
    nutBottomZ: -1.4,
    ringWallMounting: ringWallMounting(),
    postReinforcement: {
      architecture: 'two-wall-full-height-T-roots',
      ribWidthMm: 4,
      reachMm: 12,
      bottomZ: 7.5,
      topZ: 20.3,
      minimumPostLapMm: 4.2,
    },
    source:
      'https://intertool.ua/catalog/yashchiki-sumki-poyasa-dlya-instrumentov/yashchiki-dlya-instrumentov/intertool-bx-0151.html',
    measurementScope:
      'Earlier user measurements retained as reference: free panel-seat recess 218 × 154 × 2 mm, cavity 214 × 150 mm at its floor tapering to 208 × 142 mm over 75 mm, and 18 mm lid clearance above the rim. R6 corners are an approximate user inference, not supplier CAD. This nominal taper is not a verified containment model for the latest corrected working perimeter; see workingPanelFit. The panel-seat recess is separate from the factory lid seal.',
  };
}

const canonical = ([x, y, z]: readonly number[]): Vec => [-y, x, z];
const operator = (child: Shape): Shape => ({
  kind: 'transform',
  child,
  translation: [0, 0, 0],
  rotation: [0, 0, 90],
});
const intersection = (a: Shape, b: Shape): Shape => ({ kind: 'intersect', children: [a, b] });

/** Ruled corner polygons follow the measured linear wall taper with an explicit fit allowance. */
function skirtEnvelope(p: Parameters, inset: number, extraZ = 0, frontExtension = 0): Shape {
  const m = caseFitLayout(p);
  const ring = (z: number): Vec[] => {
    const depth = m.grooveFloorZ - z,
      width =
        m.topOpening[0] -
        ((m.topOpening[0] - m.bottomOpening[0]) * depth) / m.bodyDepth -
        2 * inset,
      height =
        m.topOpening[1] -
        ((m.topOpening[1] - m.bottomOpening[1]) * depth) / m.bodyDepth -
        2 * inset +
        frontExtension,
      radius = m.cornerRadius - inset;
    return [
      [1, 1, 0],
      [-1, 1, 90],
      [-1, -1, 180],
      [1, -1, 270],
    ].flatMap(([sx, sy, start]) =>
      Array.from({ length: 17 }, (_, i): Vec => {
        const angle = ((start + (i * 90) / 16) * Math.PI) / 180;
        return [
          m.centre[0] + sx * (width / 2 - radius) + radius * Math.cos(angle),
          m.centre[1] - frontExtension / 2 + sy * (height / 2 - radius) + radius * Math.sin(angle),
          z,
        ];
      }),
    );
  };
  return {
    kind: 'loft',
    rings: [ring(m.skirtBottomZ - extraZ), ring(m.skirtTopZ + extraZ)],
  };
}

export function caseFitDetails(p: Parameters): DetailSpec[] {
  const m = caseFitLayout(p),
    flange = subtract(
      roundedPlate(
        ...m.ringOuterSize,
        m.ringCornerRadius,
        m.ringCentre,
        m.ringFlangeBottomZ,
        m.ringFlangeThickness,
      ),
      roundedPlate(...m.ringInnerOpening, 4, m.centre, m.ringFlangeBottomZ - 0.1, 1.6),
    );
  const ears = (bottom: number, height: number): Shape[] =>
    m.mountingAxes.map(([x, y]) => box([6, 7, height], [x < m.centre[0] ? 1 : x, y - 3.5, bottom]));
  const lowerOuter = skirtEnvelope(p, m.cavitySideClearance, 0, m.ringFrontExtensionMm),
    lowerInner = skirtEnvelope(p, m.cavitySideClearance + m.skirtWallThickness, 0.1),
    lower = union(
      subtract(lowerOuter, lowerInner),
      intersection(
        union(
          ...ears(m.postBottomZ, m.skirtTopZ - m.postBottomZ),
          ...m.mountingAxes.map(([x, y]) =>
            cylinder(m.postRadius, m.skirtTopZ - m.postBottomZ, [x, y, m.postBottomZ]),
          ),
        ),
        lowerOuter,
      ),
    );
  const rootStock = union(
    lowerOuter,
    roundedPlate(
      ...m.ringOuterSize,
      m.ringCornerRadius,
      m.ringCentre,
      m.ringFlangeBottomZ,
      m.ringFlangeThickness,
    ),
  );
  const postRoots = m.mountingAxes.flatMap(([x, y]) => {
    const { ribWidthMm: w, reachMm: reach, bottomZ, topZ } = m.postReinforcement;
    return [
      intersection(
        box(
          [reach + m.postRadius, w, topZ - bottomZ],
          [x < m.centre[0] ? x - reach : x - m.postRadius, y - w / 2, bottomZ],
        ),
        rootStock,
      ),
      intersection(
        box(
          [w, reach + m.postRadius, topZ - bottomZ],
          [x - w / 2, y < m.centre[1] ? y - reach : y - m.postRadius, bottomZ],
        ),
        rootStock,
      ),
    ];
  });
  const wallMounts = m.ringWallMounting;
  const wallPads = wallMounts.holes.map(({ headFace, outward }) => {
    const w = wallMounts.padWidthMm,
      t = wallMounts.padThicknessMm;
    const origin: Vec = [
      headFace[0] - (outward[0] < 0 ? t : outward[0] === 0 ? w / 2 : 0),
      headFace[1] - (outward[1] < 0 ? t : outward[1] === 0 ? w / 2 : 0),
      wallMounts.padBottomZ,
    ];
    return intersection(
      box(
        [
          outward[0] === 0 ? w : t,
          outward[1] === 0 ? w : t,
          wallMounts.padTopZ - wallMounts.padBottomZ,
        ],
        origin,
      ),
      rootStock,
    );
  });
  const wallHoles = wallMounts.holes.map(({ headFace, rotation }): Shape => ({
    kind: 'transform',
    translation: headFace,
    rotation,
    child: union(
      cylinder(wallMounts.boreDiameterMm / 2, wallMounts.padThicknessMm + 2, [0, 0, -0.1]),
      {
        kind: 'revolve',
        profile: [
          [0, -0.1],
          [3.2, -0.1],
          [3.1, 0],
          [1.7, 1.4],
          [0, 1.4],
        ],
      },
    ),
  }));
  const ring = subtract(
    union(
      flange,
      lower,
      ...postRoots,
      ...wallPads,
      ...ears(m.ringFlangeBottomZ, m.ringFlangeThickness),
      ...m.mountingAxes.map(([x, y]) =>
        union(
          cylinder(m.postRadius, m.postTopZ - m.postBottomZ, [x, y, m.postBottomZ]),
          cylinder(m.tongueDiameter / 2, m.tongueTopZ - m.tongueBottomZ, [x, y, m.tongueBottomZ]),
        ),
      ),
    ),
    ...m.mountingAxes.flatMap(([x, y]) => [
      cylinder(m.mountingBore / 2, 20, [x, y, 1.4]),
      cylinder(m.headRecessDiameter / 2, m.headRecessDepth + 0.1, [x, y, m.screwUnderHeadZ]),
    ]),
    ...wallHoles,
  );
  const gasket = subtract(
    roundedPlate(
      ...m.ringOuterSize,
      m.ringCornerRadius,
      m.ringCentre,
      m.gasketBottomZ,
      m.gasketThickness,
    ),
    roundedPlate(
      ...m.gasketInnerOpening,
      m.cornerRadius,
      m.gasketInnerCentre,
      m.gasketBottomZ - 0.1,
      0.6,
    ),
    ...m.mountingAxes.map(([x, y]) =>
      cylinder(m.postRadius + 0.3, 1, [x, y, m.gasketBottomZ - 0.1]),
    ),
  );
  return [
    {
      id: m.ringId,
      label: 'Printed BX-0151 groove-seat ring with integral posts',
      shape: operator(ring),
      color: 0x62778a,
      material: 'PETG; fit to the measured INTERTOOL BX-0151 panel seat',
      blank:
        '217.4 × 154.4 mm front-extended flange;1.4mm face; nine reinforced radial countersinks and four two-wall post roots',
      processes: ['printing'],
      explode: [0, 0, 35],
      requirements: [
        'Print the complete upper flange face at Z20.3 on the bed, flipped 180 degrees. The four posts, ears and skirt then grow upward from this continuous face. Preserve the 3.4 mm through bores, diameter 6.2 mm head recesses and thin locating tongues; the annular recess floors require only a 1.4 mm radial bridge. Qualify printed fit before tightening.',
        'The earlier recess reference is218×154×2mm. Only the handle-side edge grows1mm: the ring is217.4×154.4 centred[107,74.5], with unchanged rear/side edges and all four M3 axes fixed. The matching0.4mm TPU cushion follows the same front change. The flange staysZ18.9..20.3. Quantify the finite front-edge mismatch against the earlier reference; this user-requested fit prototype does not remeasure the entire groove or establish full case fit.',
        'Four integral diameter 8.4 mm posts reach the faceplate top at Z7.5. Their diameter 4.2 mm tongues locate through matching diameter 4.5 mm plate holes down to Z1.5. Four available M3 × 30 socket screws clamp the adapter and faceplate. Separate rear-side faceplate bosses provide the requested through-case-wall retention; these four corner screws do not enter the case. Diameter 6.2 × 3.2 mm recesses place their under-head seats at Z17.1 and nominal head tops at Z20.1, 0.2 mm below the flange top. The 9.6 mm post depth below each seat supports the head load. Tips reach Z−12.9, approximately 11.5 mm past the nuts; no extra spacer or lid-side height is added.',
        'Four4mm-wide full-height T roots connect each corner post to BOTH adjacent skirt walls and the flat flange. Fixed M3 axes, tongues, head seats and washers stay unchanged. The nominal2mm skirt retains its old rear/side profile; its front wall extends outward1mm. Nine5mm radial pads carry3.4mm clearance holes and6.2mm90degree countersinks1.4mm deep, leaving at least3.4mm cylindrical material behind them. Use a compact driver with at most6mm shaft20mm long and8mm handle20mm long; a5mm axial engagement sweep is checked with the batteries removed, controls and connectors fitted, ARM1 guard closed. Self-tapper length and drive are unselected; check the actual screw against the printed grip and delivered wall before installation.',
        'Use the user-measured 75 mm depth from groove floor to case floor and 18 mm lid clearance above the rim. The inferred R6 corners, real taper, local ribs, compression, retention and handling loads need a physical fit check. This geometry is an installation study, not supplier enclosure CAD or a fit/sealing qualification.',
      ],
    },
    {
      id: m.gasketId,
      label: 'TPU BX-0151 panel-seat cushion',
      shape: operator(gasket),
      color: 0x3e565c,
      material: 'TPU; nominal 0.4 mm seat cushion, measured compression',
      blank: '217.4 × 154.4 ×0.4mm front-extended seat cushion; fixed corner clearances',
      processes: ['printing'],
      explode: [0, 0, 35],
      requirements: [
        'Print flat as a continuous0.4mm sheet. Both outer and inner front edges extend1mm toward the handle: outer217.4×154.4 and inner214×151 R6, centred[107,74.5]. The rear/side bands and four9mm corner clearances keep their original positions. This matches the modified skirt while preserving a continuous cushion band. Actual support at the requested new front edge is a physical fit check against the case, not a confirmed new ledge dimension.',
        'The cushion supports and takes up measured fit at the panel seat. It does not replace the original neoprene lid seal or establish a new ingress rating. Fit the user-measured recess and approximate R6 corners before assembly.',
      ],
    },
  ];
}

export function caseFitHardware(p: Parameters): ConfiguredPiece[] {
  const m = caseFitLayout(p);
  return m.mountingAxes.flatMap(([x, y], index): ConfiguredPiece[] => [
    screw(`case-fit-screw-${index + 1}`, 3, m.screwLength, canonical([x, y, m.screwUnderHeadZ])),
    hexNut(`case-fit-nut-${index + 1}`, 3, 5.5, 2.4, canonical([x, y, m.nutBottomZ]), [0, 0, 90]),
    {
      label: 'Flat washer M3 · Ø3.2/7 × 0.5',
      color: 0xa6afb8,
      component: {
        id: `case-fit-washer-${index + 1}`,
        name: 'Flat washer M3 · Ø3.2/7 × 0.5',
        libraryId: 'washer',
        parameters: { bore: 3.2, outerDiameter: 7, thickness: 0.5 },
        state: 'default',
        quantity: 1,
        supply: 'standard',
        placement: { translation: canonical([x, y, m.washerCentreZ]), rotation: [0, 0, 90] },
        notes:
          'Washer top at Z1.5 bears against the faceplate underside; the nut top at Z1 meets its lower face. The available M3 × 30 screw seats in its supported recess at Z17.1, with the nominal head top at Z20.1 below the flange top. Its tip reaches Z−12.9, approximately 11.5 mm past the nut. No extra spacer or lid-side height is added. Check the delivered screw and washer stack before tightening.',
      },
    },
  ]);
}
