// PLC acceptance model. Absolute material encoder counts never reset between cuts.
// Wheel X=-350, datum beam X=-310 and tail beam X=-390; signed positions are calibrated.
export interface MaterialTrack {
  barId: number;
  frontCount?: number;
  lastCount: number;
  tailCount?: number;
  measuredLength?: number;
  positionValid: boolean;
  frontSeen: boolean;
  tailSeen: boolean;
  fault?: string;
}
export const newMaterialTrack = (barId: number, count: number): MaterialTrack => ({
  barId,
  lastCount: count,
  frontSeen: false,
  tailSeen: false,
  positionValid: false,
});
export function trackMaterial(
  s: MaterialTrack,
  f: { count: number; contact: boolean; frontBeam: boolean; tailBeam: boolean; newBar: boolean },
  plannedLength: number,
  tolerance = 5,
): MaterialTrack {
  const fail = (fault: string) => ({ ...s, fault });
  if (s.fault) return s;
  if (
    !Number.isFinite(f.count) ||
    !Number.isFinite(plannedLength) ||
    plannedLength <= 0 ||
    !Number.isFinite(tolerance) ||
    tolerance < 0
  )
    return fail('Invalid encoder or stock length');
  if (f.newBar && s.frontSeen) return fail('New bar attempted before old identity was cleared');
  if (f.count < s.lastCount - 0.05)
    return fail('Reverse material motion invalidates the cut datum');
  if (!s.frontSeen && f.frontBeam) {
    if (!f.contact || !f.tailBeam) return fail('Leading edge without contact or upstream material');
    return {
      ...s,
      frontSeen: true,
      positionValid: true,
      frontCount: f.count,
      lastCount: f.count,
      tailSeen: true,
    };
  }
  if (!s.frontSeen) return { ...s, lastCount: f.count, tailSeen: s.tailSeen || f.tailBeam };
  if (s.tailCount === undefined && !f.contact)
    return fail('Measuring contact lost before known tail');
  if (s.tailCount === undefined && s.tailSeen && !f.tailBeam) {
    const measuredLength = f.count - s.frontCount! + 80;
    if (Math.abs(measuredLength - plannedLength) > tolerance)
      return {
        ...s,
        measuredLength,
        fault: 'Measured physical end disagrees with recipe; quarantine remainder',
      };
    return { ...s, measuredLength, tailCount: f.count, lastCount: f.count };
  }
  if (s.tailCount !== undefined && f.tailBeam)
    return fail('Unexpected material after a known trailing edge');
  return { ...s, lastCount: f.count, positionValid: f.contact };
}
export function remainingAtCut(s: MaterialTrack) {
  if (s.tailCount === undefined || s.fault || !s.positionValid) return undefined;
  return Math.max(0, 390 - (s.lastCount - s.tailCount));
}
