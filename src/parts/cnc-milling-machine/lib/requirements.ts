/** User requirement and proposed acceptance limits, never measured machine performance. */
export const millingDesignRequirement = {
  purpose: 'Metal prototypes / aerospace MVP development',
  primaryMaterials: ['D16T duralumin', 'other aluminium alloys', 'brass', 'bronze'],
  secondaryMaterials: ['steel: qualify each light-cut process separately'],
  fullToleranceFieldMm: 0.05,
  maximumAbsoluteFinishedDimensionErrorMm: 0.025,
  referenceTemperatureC: 20,
  provisionalFinishingForceN: 100,
  sensitivityForceN: 300,
  status: 'design-target-unverified',
} as const;

/** Conservative allocation; satisfying individual rows does not prove contour/part accuracy. */
export const millingAccuracyAllocation = [
  {
    id: 'structure',
    allowanceMm: 0.008,
    requirement:
      'Measured complete tool-to-fixture deflection at the qualified finishing load, including guides, joints and supports.',
  },
  {
    id: 'position',
    allowanceMm: 0.005,
    requirement:
      'Bidirectional calibrated positioning and reversal error with linear feedback, throughout the accepted workspace.',
  },
  {
    id: 'thermal',
    allowanceMm: 0.005,
    requirement:
      'Combined machine, spindle, fixture and workpiece thermal error during the accepted finishing cycle.',
  },
  {
    id: 'tool',
    allowanceMm: 0.004,
    requirement:
      'Actual cutter runout, cutting deflection, wear and radius compensation at the accepted gauge length.',
  },
  {
    id: 'fixture',
    allowanceMm: 0.001,
    requirement: 'Fixture, datum and workpiece movement during the accepted finishing cut.',
  },
  {
    id: 'inspection',
    allowanceMm: 0.002,
    requirement:
      'Expanded measurement uncertainty used to guard-band the finished-part acceptance decision.',
  },
] as const;

function finite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new Error(name + ' must be finite.');
}

/** Linear thermal sensitivity only; use the certified coefficient for the delivered alloy. */
export function workpieceThermalErrorMm(
  lengthMm: number,
  deltaTemperatureC: number,
  coefficientPerK: number,
) {
  finite(lengthMm, 'Length');
  finite(deltaTemperatureC, 'Temperature difference');
  finite(coefficientPerK, 'Expansion coefficient');
  if (lengthMm <= 0 || coefficientPerK <= 0)
    throw new Error('Length and expansion coefficient must be positive.');
  return Math.abs(lengthMm * deltaTemperatureC * coefficientPerK);
}

/** Uniform round cantilever sensitivity; flute, holder and spindle compliance are excluded. */
export function roundToolDeflectionMm(
  forceN: number,
  freeLengthMm: number,
  diameterMm: number,
  modulusNPerMm2: number,
) {
  for (const [name, value] of Object.entries({ forceN, freeLengthMm, diameterMm, modulusNPerMm2 }))
    finite(value, name);
  if (forceN < 0 || freeLengthMm <= 0 || diameterMm <= 0 || modulusNPerMm2 <= 0)
    throw new Error('Use a nonnegative load and positive tool dimensions/modulus.');
  const secondMomentMm4 = (Math.PI * diameterMm ** 4) / 64;
  return (forceN * freeLengthMm ** 3) / (3 * modulusNPerMm2 * secondMomentMm4);
}

/** Explicit decision on one inspected dimension, with uncertainty inside the tolerance field. */
export function finishedDimensionAcceptance(
  nominalMm: number,
  measuredMm: number,
  expandedUncertaintyMm: number,
) {
  finite(nominalMm, 'Nominal dimension');
  finite(measuredMm, 'Measured dimension');
  finite(expandedUncertaintyMm, 'Expanded uncertainty');
  if (nominalMm <= 0 || measuredMm <= 0 || expandedUncertaintyMm < 0)
    throw new Error('Dimensions must be positive and uncertainty must be nonnegative.');
  const deviationMm = measuredMm - nominalMm;
  const guardedErrorMm = Math.abs(deviationMm) + expandedUncertaintyMm;
  return {
    deviationMm,
    guardedErrorMm,
    limitMm: millingDesignRequirement.maximumAbsoluteFinishedDimensionErrorMm,
    accepted:
      guardedErrorMm <= millingDesignRequirement.maximumAbsoluteFinishedDimensionErrorMm + 1e-12,
  };
}

export const millingAcceptanceRequirements = [
  'Finished-part target is the complete 0.05 mm tolerance field (±0.025 mm), referenced to the drawing datum and 20 °C. Encoder resolution is not finished-part accuracy.',
  'D16T and nonferrous metals are primary targets. Steel is conditional on actual spindle torque, tool engagement, measured cutting load and a separately accepted coupon; simply lowering feed does not qualify it.',
  'The 100 N finishing force is a provisional design case. Determine actual cutter/material forces and qualify depth, radial engagement, feed per tooth, speed, fixture and tool projection before cutting.',
  'Calibrate bidirectional position, reversal, axis straightness, squareness and contouring over the accepted travel. Record warm/cold and loaded results; tune the linear-feedback servo loops before use.',
  'Measure complete tool-to-fixture stiffness at the accepted poses and loads. Member-only beam estimates cannot release the full machine.',
  'Measure delivered spindle/cutter runout and thermal drift at the actual gauge length. Qualify short, stiff finishing tools; the selected tool projection is a clearance envelope, not an approved precision cutting tool.',
  'Inspect repeated D16T coupons at centre and workspace extremes after warm-up and a representative machining cycle. Each drawing-critical dimension must satisfy absolute deviation plus expanded uncertainty ≤0.025 mm.',
  'Release drawings, datum machining, ordered screw/guide executions, alignment, lubrication, brake sequencing, coolant alarms, protective bonding and guarded-machine commissioning before powered operation.',
] as const;
