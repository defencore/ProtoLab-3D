import { sectionArea } from './profiles';
import { profile } from './layout';
import type { Parameters } from '../../../core/types';
export const DESIGN = {
  bladeDiameter: 500,
  kerf: 4,
  tableHeight: 900,
  bladeHome: 570,
  bladeCut: 780,
  feedTravel: 600,
  lead: 5,
  cylinderBore: 50,
  efficiency: 0.9,
  airEfficiency: 0.8,
  feedSpeed: 20,
  feedAcceleration: 50,
  clampAxialWidth: 12,
  remainingStock: 1150,
};
export function engineering(p: Parameters) {
  const section = profile(p);
  const n = (k: string) => Number(p[k]),
    a = (Math.abs(n('angle')) * Math.PI) / 180;
  const kerfAxial = DESIGN.kerf / Math.cos(a),
    advance = n('cutLength') + kerfAxial;
  // The short-part tooling is confined to 12 mm in the feed direction at zero mitre.
  // A mitre moves its support beyond the full blade sweep at the guide posts.
  const offcutClamp = 16 + (section.width / 2 + 45) * Math.tan(a),
    minimumLength = a < 1e-9 ? 20 : Math.ceil(20 + 2 * (section.width / 2 + 45) * Math.tan(a));
  const clampForce =
    ((n('airPressure') * 0.1 * Math.PI * DESIGN.cylinderBore ** 2) / 4) * DESIGN.airEfficiency;
  const sideForce = (clampForce * n('sidePressure')) / n('airPressure');
  const holding = Math.min(clampForce, sideForce) * n('friction');
  const feedForce = (2 * Math.PI * n('runningTorque') * DESIGN.efficiency) / (DESIGN.lead / 1000);
  const area=sectionArea(String(p.profile),section.width,section.height,n('wall'));
  const stockMass = area * n('stockLength') * 2.7e-6;
  const accuracy = n('axisError') + n('gripError') + n('bladeError') + n('datumError');
  return {
    kerfAxial,
    advance,
    offcutClamp,
    minimumLength,
    clampForce,
    sideForce,
    transferForce: (clampForce * n('transferPressure')) / n('airPressure'),
    beltStart: 8 + 70 * Math.tan(a),
    outfeedOffset: 70 * Math.tan(a),
    facingAdvance: Math.max(n('firstTrim'), minimumLength + kerfAxial),
    shortPart:
      p.discharge === 'box' || (p.discharge === 'auto' && n('cutLength') <= n('shortPartLimit')),
    encoderResolution: 200 / (1000 * 4),
    holding,
    gripMargin: holding / n('cuttingForce'),
    feedGripMargin: holding / n('feedResistance'),
    feedForce,
    driveMargin: feedForce / n('feedResistance'),
    stockMass,
    accuracy,
    rimSpeed: (Math.PI * 0.5 * n('spindleRpm')) / 60,
    motorHz: (n('spindleRpm') / (2890 * 0.8)) * 50,
    pulseDistance: DESIGN.lead / 2000,
    cycleLowerBound:
      (2 * advance) / DESIGN.feedSpeed + (2 * (DESIGN.bladeCut - DESIGN.bladeHome)) / n('sawFeed'),
    endRemainder: p.feedMode === 'manual' ? 650 : DESIGN.remainingStock,
    usableStock:
      n('stockLength') -
      Math.max(n('firstTrim'), minimumLength + kerfAxial) -
      n('consumedLength') -
      (p.feedMode === 'manual' ? 650 : DESIGN.remainingStock),
    partsRemaining: Math.max(
      0,
      Math.floor(
        (n('stockLength') -
          Math.max(n('firstTrim'), minimumLength + kerfAxial) -
          n('consumedLength') -
          (p.feedMode === 'manual' ? 650 : DESIGN.remainingStock)) /
          advance,
      ),
    ),
  };
}
export function issues(p: Parameters): string[] {
  const e = engineering(p),
    errors: string[] = [];
  if (!Object.values(p).every((v) => typeof v !== 'number' || Number.isFinite(v)))
    errors.push('All dimensions and calculation inputs must be finite.');
  if (!['manual', 'assisted', 'automatic'].includes(String(p.feedMode)))
    errors.push('Choose a supported machine mode.');
  if (Number(p.wall) * 2 >= Math.min(profile(p).width, profile(p).height))
    errors.push('Tube wall must leave an open bore.');
  const section = profile(p);
  const projectedHalfWidth =
    section.width / (2 * Math.cos((Math.abs(Number(p.angle)) * Math.PI) / 180));
  const edgeCutHeight =
    DESIGN.bladeCut +
    Math.sqrt((DESIGN.bladeDiameter / 2) ** 2 - projectedHalfWidth ** 2) -
    DESIGN.tableHeight;
  if (!section.round && section.height + 2 > edgeCutHeight)
    errors.push(
      `This rectangular envelope exceeds the blade sweep at the selected mitre. Maximum height with 2 mm clearance is ${Math.floor(edgeCutHeight - 2)} mm.`,
    );
  if (Number(p.cutLength) < e.minimumLength)
    errors.push(
      `This mitre requires a cut length of at least ${e.minimumLength} mm for the offcut fixture. Use 0 degrees for 20 mm rings.`,
    );
  if (e.advance > DESIGN.feedTravel - 20)
    errors.push('Required feed exceeds usable carriage travel.');
  if (p.feedMode !== 'manual' && e.usableStock < e.advance)
    errors.push('Insufficient stock after retaining the final gripper remnant.');
  if (p.feedMode !== 'manual' && e.shortPart && Number(p.cutLength) > 200)
    errors.push(
      'The tilt receiver accepts parts up to 200 mm. Use the roller outlet for longer parts.',
    );
  if (p.feedMode !== 'manual' && !e.shortPart && Number(p.cutLength) < 150)
    errors.push(
      'The powered roller outlet requires a part of at least 150 mm to bridge its drive spacing. Use the box route for shorter parts.',
    );
  return errors;
}
