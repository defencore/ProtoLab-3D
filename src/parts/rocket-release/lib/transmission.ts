import type { Parameters } from '../../../core/types';
import { layout } from './motion';

/** Angles are relative to the carrier/servo case, before the nose frame transform. */
export function transmission(p: Parameters) {
  const m = layout(p);
  const inputTeeth = m.centralServo ? 20 : m.pinionTeeth;
  const ratio = m.ringTeeth / inputTeeth;
  return {
    ringTeeth: m.ringTeeth,
    idlerTeeth: m.centralServo ? m.pinionTeeth : 0,
    inputTeeth,
    ratio,
    module: m.module,
    pressureAngleDeg: 20,
    ringPitchDiameterMm: m.module * m.ringTeeth,
    ringClearBoreMm: 2 * (m.pitchRadius - m.module),
    lockWebMm: m.lockRadius - 3.05 - (m.pitchRadius + 1.25 * m.module),
    idlerPitchDiameterMm: m.centralServo ? m.module * m.pinionTeeth : 0,
    inputPitchDiameterMm: m.module * inputTeeth,
    axisRadiusMm: m.driveRadius,
    ringUnlockDeg: +p.unlockAngle,
    inputUnlockDeg: (m.centralServo ? -1 : 1) * ratio * +p.unlockAngle,
    idlerUnlockDeg: m.centralServo ? (+p.unlockAngle * m.ringTeeth) / m.pinionTeeth : 0,
    currentRingDeg: m.angle,
    currentInputDeg: m.angle === 0 ? 0 : (m.centralServo ? -1 : 1) * ratio * m.angle,
    axialTravelMm: m.lift,
  };
}
export function transmissionReport(p: Parameters): string[] {
  const t = transmission(p),
    servo = p.drive !== 'four-motors';
  return [
    `Transmission: ${servo ? `sun ${t.inputTeeth}T → 4 × ${t.idlerTeeth}T idlers → internal ring ${t.ringTeeth}T` : `4 × ${t.inputTeeth}T motor pinions → internal ring ${t.ringTeeth}T`}; input:ring travel ${t.ratio}:1; module ${t.module.toFixed(4)} mm; pressure angle ${t.pressureAngleDeg}°.`,
    `Full unlock: ring/carrier relative turn ${t.ringUnlockDeg}°, ${servo ? 'servo' : 'motor pinion'} travel ${Math.abs(t.inputUnlockDeg)}° ${servo ? 'opposite' : 'in the same'} direction. ${servo ? `Each idler turns ${t.idlerUnlockDeg}° relative to the carrier. ` : ''}Angles are viewed along the local +Z axis; physical servo direction must be calibrated after mounting.`,
    `Pitch diameters: input Ø${t.inputPitchDiameterMm.toFixed(3)}${servo ? ` / idler Ø${t.idlerPitchDiameterMm.toFixed(3)}` : ''} / ring Ø${t.ringPitchDiameterMm.toFixed(3)} mm; pinion-axis radius ${t.axisRadiusMm.toFixed(3)} mm. Gear face width 3 mm. Module follows the tube size; this is not a selected stock gear set.`,
    ...(['st3215-nose', 'wing-mini-nose'].includes(String(p.drive))
      ? [
          `Ring tooth-tip passage Ø${t.ringClearBoreMm.toFixed(2)} mm after the nose and gear carrier clear the body; minimum radial material to the retaining-slot envelope ${t.lockWebMm.toFixed(2)} mm. This geometric web is not a strength rating. Tooth edges remain exposed to the extraction path; confirm clearance with the packed parachute and deployment bag.`,
        ]
      : []),
    `Release control is a positional preview: 0–60% rotates to the unlock angle; 60–100% translates axially to ${p.separation} mm. Current relative ring turn ${t.currentRingDeg.toFixed(2)}°, input ${t.currentInputDeg.toFixed(2)}°, separation ${t.axialTravelMm.toFixed(2)} mm. It is not a time law or proof of loaded disengagement.`,
  ];
}
export function transmissionMetadata(p: Parameters): Record<string, string> {
  const t = transmission(p);
  return {
    TransmissionJSON: JSON.stringify(t),
    TransmissionRatio: `${t.ratio}:1 input to relative ring/carrier travel`,
    UnlockAngle: `${t.ringUnlockDeg} deg ring/carrier; ${t.inputUnlockDeg} deg input relative to carrier`,
    GearSpecification: `ring z${t.ringTeeth}; input z${t.inputTeeth}; idlers ${t.idlerTeeth ? `4 x z${t.idlerTeeth}` : 'none'}; m${t.module.toFixed(6)} mm; pressure angle 20 deg; face 3 mm`,
    ReleasePassage: `tooth-tip bore D${t.ringClearBoreMm.toFixed(3)} mm after separation; minimum radial lock web ${t.lockWebMm.toFixed(3)} mm; nominal geometry, strength and snag clearance unverified`,
    MotionConvention:
      'Local +Z view before nose inversion; calibrate physical servo direction and endpoints. Positional preview only.',
  };
}
