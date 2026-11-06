import { box, subtract, union, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';

type Bounds = { min: Vec; max: Vec };
const bounds = (min: Vec, max: Vec): Bounds => ({ min, max });

export function casePwmTies() {
  return [173, 189].map((x, i) => ({
    id: `pwm-wall-retention-${i + 1}`,
    frame: { at: [0, 0, 0] as Vec, rotation: [0, 0, 0] as Vec },
    segments: [
      bounds([x - 1.25, 27.5, -28.1], [x + 1.25, 28.5, -9.8]),
      bounds([x - 1.25, 38.5, -28.1], [x + 1.25, 39.5, -9.8]),
      bounds([x - 1.25, 28.5, -28.1], [x + 1.25, 38.5, -27.1]),
      bounds([x - 1.25, 28.5, -10.8], [x + 1.25, 38.5, -9.8]),
    ],
  }));
}

const tieClearanceCuts = (includeBottomBand = true): Shape[] =>
  casePwmTies().flatMap((tie) =>
    tie.segments.flatMap(({ min, max }, index) =>
      !includeBottomBand && index === 2
        ? []
        : [box(max.map((v, i) => v - min[i] + 0.6) as Vec, min.map((v) => v - 0.3) as Vec)],
    ),
  );

/** Flat separate plate; its shoulder and keyed tongue register to the carrier. */
export function casePwmBacking(): Shape {
  return subtract(
    union(box([25.6, 2.5, 15.1], [168.2, 28.5, -27.1]), box([10, 2.5, 2.3], [176, 28.5, -12.2])),
    // The lower face bears directly on the bands; a clearance cut here would add hidden withdrawal slack.
    ...tieClearanceCuts(false),
  );
}

export function casePwmCarrierCuts(): Shape[] {
  return [
    box([26.4, 8.4, 1.3], [167.8, 30.8, -12.1]),
    ...[159.8, 193.8].map((x) => box([8.4, 6.4, 1.3], [x, 30.8, -12.1])),
    box([10.4, 2.9, 2.3], [175.8, 28.3, -12.1]),
    ...tieClearanceCuts(),
  ];
}

export function casePwmKeeper(): Shape {
  return subtract(
    box([25.6, 1.5, 16.3], [168.2, 37, -27.1]),
    box([22, 1.7, 12], [170, 36.9, -24.8]),
  );
}

export function casePwmStructure() {
  return {
    componentId: 'case-pwm-backing',
    carrierId: 'case-test-clip-carrier',
    hostId: 'case-pwm-mosfet',
    keeperId: 'case-pwm-keeper',
    wallProbes: [bounds([168.4, 28.9, -26.6], [193.6, 30.7, -12.3])],
    rootProbes: [bounds([176.2, 28.9, -12.2], [185.8, 30.5, -11.7])],
    joint: {
      carrierId: 'case-test-clip-carrier',
      backingId: 'case-pwm-backing',
      shoulderZ: -12,
      tongue: bounds([176, 28.5, -12], [186, 31, -9.9]),
      receiver: bounds([175.8, 28.3, -12.1], [186.2, 31.2, -9.8]),
      nominalEngagementMm: 2.1,
      nominalWallToLowerBandGapMm: 0,
      maximumTieDownwardChannelTravelMm: 0.3,
      maximumTiedWallWithdrawalMm: 0.3,
      upperBandSegmentIndex: 3,
      lowerBandSegmentIndex: 2,
      nominalLowerBandTopZ: -27.1,
      tieChannelClearanceMm: 0.3,
      minimumRetainedEngagementMm: 1.8,
      minimumRoofThicknessMm: 2.8,
      roofBottomZ: -9.8,
      roofTopZ: -7,
      roofProbes: [bounds([176.2, 28.6, -9.79], [185.8, 30.6, -7.01])],
      shoulderProbes: [
        bounds([168.5, 28.9, -12.02], [171, 30.6, -11.98]),
        bounds([191, 28.9, -12.02], [193.5, 30.6, -11.98]),
      ],
      shoulderBearingShift: [0, 0, 0.01] as Vec,
      minimumShoulderBearingAreaMm2: 30,
      transverseBlockingTranslations: [
        [0.5, 0, 0],
        [-0.5, 0, 0],
        [0, 0.5, 0],
        [0, -0.5, 0],
      ] as Vec[],
      tiedWithdrawalTrial: [0, 0, -0.5] as Vec,
      worstTieTranslation: [0, 0, -0.3] as Vec,
      tieTravelBlockingTranslation: [0, 0, -0.31] as Vec,
      retainedTieIds: ['pwm-wall-retention-1', 'pwm-wall-retention-2'],
      printRotation: [-90, 0, 0] as Vec,
    },
    supportSeats: [
      {
        id: 'pwm-backing-face',
        componentId: 'case-pwm-backing',
        contactBox: bounds([169, 30.98, -26], [193, 31.02, -12.2]),
        normal: [0, -1, 0] as Vec,
        minimumAreaMm2: 300,
      },
      {
        id: 'pwm-perimeter-keeper',
        componentId: 'case-pwm-keeper',
        contactBox: bounds([168.2, 36.98, -26.8], [193.8, 37.02, -10.8]),
        normal: [0, 1, 0] as Vec,
        minimumAreaMm2: 100,
      },
    ],
    ties: casePwmTies(),
    wireReserves: [
      {
        id: 'pwm-left-power-and-control-edge',
        ...bounds([160, 31.05, -26.7], [168, 36.95, -10.9]),
      },
      {
        id: 'pwm-right-power-and-control-edge',
        ...bounds([194, 31.05, -26.7], [202, 36.95, -10.9]),
      },
    ],
    keeperPath: {
      componentId: 'case-pwm-keeper',
      assemblyStage: 'populated-carrier-detached-on-bench',
      carrierReleasePathId: 'pwm-carrier-bench-release',
      retainedTargetIds: [
        'case-test-clip-carrier',
        'case-pwm-backing',
        'case-test-clip-red',
        'case-test-clip-black',
        'case-pwm-mosfet',
      ],
      segments: [
        { startTranslation: [0, 0, 0] as Vec, translation: [0, 0.5, 0] as Vec },
        { startTranslation: [0, 0.5, 0] as Vec, translation: [0, 0, -15] as Vec },
        { startTranslation: [0, 0.5, -15] as Vec, translation: [45, 0, 0] as Vec },
      ],
      sourceBoxes: [
        bounds([168.2, 37, -27.1], [170, 38.5, -10.8]),
        bounds([192, 37, -27.1], [193.8, 38.5, -10.8]),
        bounds([170, 37, -27.1], [192, 38.5, -24.8]),
        bounds([170, 37, -12.8], [192, 38.5, -10.8]),
      ],
      prerequisites:
        'First detach the populated carrier from the lower body using the declared 60 mm upward carrier release. On the separate bench release both PWM ties and disconnect its leads; move the keeper outward 0.5 mm, down 15 mm, then 45 mm right. Both actual clips and the PWM body remain fitted during that keeper route. Qualify the delivered module and wiring; no PCB construction or component-free bearing lands are inferred.',
    },
    backingPath: {
      componentId: 'case-pwm-backing',
      assemblyStage: 'populated-carrier-detached-on-bench',
      carrierReleasePathId: 'pwm-carrier-bench-release',
      retainedTargetIds: ['case-test-clip-carrier', 'case-test-clip-red', 'case-test-clip-black'],
      sourceBoxes: [
        bounds([168.2, 28.5, -27.1], [193.8, 31, -12]),
        bounds([176, 28.5, -12.2], [186, 31, -9.9]),
      ],
      segments: [
        { startTranslation: [0, 0, 0] as Vec, translation: [0, 0, -3] as Vec },
        { startTranslation: [0, 0, -3] as Vec, translation: [0, -15, 0] as Vec },
      ],
      prerequisites:
        'Detach the populated carrier on the bench first. Release both PWM ties, disconnect its leads and support/remove the PWM module and perimeter keeper. Lower the separate backing 3 mm to disengage its tongue, then move it 15 mm away from the module side. Both clips remain fitted; do not withdraw the wall inside the populated lower body.',
    },
    carrierPath: {
      id: 'pwm-carrier-bench-release',
      assemblyStage: 'detached-lower-body-on-bench',
      movedComponentIds: [
        'case-test-clip-carrier',
        'case-pwm-backing',
        'case-test-clip-red',
        'case-test-clip-black',
        'case-pwm-mosfet',
        'case-pwm-keeper',
      ],
      translation: [0, 0, 60] as Vec,
      releasedTieIds: ['clip-carrier-retention-1', 'clip-carrier-retention-2'],
      retainedTieIds: [
        'clip-housing-retention-1',
        'clip-housing-retention-2',
        'pwm-wall-retention-1',
        'pwm-wall-retention-2',
      ],
      prerequisites:
        'Lift the complete insert out of the case, disconnect leads, remove both packs and detach the populated lower body from the supported upper assembly first. Release only the two carrier-retaining ties, then lift carrier/clips/PWM/backing/keeper 60 mm vertically off the four FF40 brass seats; all clip and PWM ties stay installed.',
    },
  };
}
