import type { Parameters } from '../../../core/types';
import { beam, sourceFrame } from '../../multicopter-frame-component/lib/model';
/** Euler-Bernoulli single-arm screen. The clamped boundary excludes joint/body compliance. */
export function integrateArm(
  sections: { x: number; inertia: number }[],
  length: number,
  force: number,
  modulus: number,
  thickness: number,
  multiplier: number,
) {
  let compliance = 0,
    maxStress = 0;
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    maxStress = Math.max(
      maxStress,
      ((force * (length - s.x) * thickness) / (2 * s.inertia)) * multiplier,
    );
    if (i) {
      const a = sections[i - 1];
      compliance +=
        ((s.x - a.x) * ((length - a.x) ** 2 / a.inertia + (length - s.x) ** 2 / s.inertia)) / 2;
    }
  }
  return { deflection: (force * compliance) / modulus, maxStress };
}
export function engineering(p: Parameters) {
  const frame = sourceFrame(p.model),
    models = frame.parts;
  const mass = Number(p.mass),
    motorThrust = Number(p.motorThrust),
    weight = mass * 9.80665;
  const load =
    Math.max(motorThrust, (weight * Number(p.loadFactor)) / frame.motorCount) *
    Number(p.dynamicFactor);
  const screen =
    frame.id === 'source-one-v5'
      ? integrateArm(
          beam.sections,
          beam.length,
          load,
          Number(p.flexuralModulus) * 1000,
          beam.thickness,
          Number(p.stressConcentration),
        )
      : null;
  const allowable = Number(p.allowableStress);
  const density = (m: (typeof models)[number]) =>
    m.route === 'sheet'
      ? 1.55
      : m.route === 'print'
        ? 1.2
        : m.route === 'soft'
          ? 1.1
          : /standoff|spacer/i.test(m.label)
            ? 2.7
            : 7.85;
  const estimatedFrameMass = models.reduce((sum, m) => sum + (m.volume * density(m)) / 1000, 0);
  return {
    status: 'unqualified' as const,
    scope: screen
      ? 'SOURCE ONE arm, ideal rigid clamp, vertical tip force. Joint/whole-frame/torsion/impact/fatigue not qualified.'
      : 'Load demand and native-component mass only. No validated structural model for this frame topology.',
    loadN: load,
    weightN: weight,
    thrustToWeight: (frame.motorCount * motorThrust) / weight,
    motorCount: frame.motorCount,
    armCount: frame.arms.length,
    topology: frame.topology,
    stationLoadN: load * frame.motorsPerArm,
    coaxialClearance:
      frame.motorsPerArm === 2
        ? frame.motorStations.map((s) => ({
            x: s.x,
            y: s.y,
            upperPropellerZ: s.upperMountZ + Number(p.rotorHeight),
            lowerPropellerZ: s.lowerMountZ - Number(p.rotorHeight),
            bladeGapMm:
              s.upperMountZ -
              s.lowerMountZ +
              2 * Number(p.rotorHeight) -
              Number(p.bladeAxialEnvelope),
          }))
        : [],
    armLengthMm: screen ? beam.length : null,
    deflectionMm: screen?.deflection ?? null,
    localStressMPa: screen?.maxStress ?? null,
    assumedStressMargin: screen && allowable > 0 ? allowable / screen.maxStress : null,
    rootCoupleN: screen ? (load * beam.length) / beam.rootBoltPitch : null,
    estimatedFrameMassG: estimatedFrameMass,
    assumptions: {
      modulusGPa: screen ? Number(p.flexuralModulus) : null,
      stressAllowableMPa: screen ? allowable || null : null,
      localMultiplier: screen ? Number(p.stressConcentration) : null,
      densities:
        'CFRP 1.55, aluminium 2.7, steel 7.85, polymer 1.2, pad 1.1 g/cm3; assumed, not measured.',
    },
    frame: frame.name,
    source: frame.source,
    assemblyNotes: frame.changes,
    hardware: frame.hardware,
    sourceFitInterferences: frame.knownSourceInterferences,
    unresolved: [
      ...(frame.motorsPerArm === 2
        ? [
            'Installed coaxial thrust, wake interaction, blade flex and motor-out control; isolated motor thrust cannot establish these.',
          ]
        : []),
      'Laminate layup/direction and measured flexural/bearing/pull-through allowables.',
      'Fastener grade, preload retention, insert pull-through and arm-root slip.',
      'Main-plate bending and torsion, motor reaction torque, vibration modes and fatigue.',
      'Actual all-up build, motor/prop performance, landing/crash load cases and physical proof tests.',
    ],
  };
}
