import type { Parameters } from '../../../../core/types';

/** Nominal journal envelope from the supplied EK6/EF6 drawing marked 0802. */
export const ek6Ef6Ends: Parameters = {
  fixedJournalDiameter: 6,
  fixedJournalLength: 30,
  driveJournalDiameter: 4,
  driveJournalLength: 8,
  supportJournalDiameter: 6,
  supportJournalLength: 9,
  fixedGrooveDiameter: 0,
  fixedGrooveWidth: 0.64,
  fixedGrooveOffset: 0,
  supportGrooveDiameter: 5.7,
  supportGrooveWidth: 0.8,
  supportGrooveOffset: 6.8,
};

/** A named machining execution cannot be changed by stale custom journal fields. */
export function ballScrewEndParameters(p: Parameters): Parameters {
  return p.endMachining === 'ek6-ef6' &&
    Object.entries(ek6Ef6Ends).some(([key, value]) => p[key] !== value)
    ? { ...p, ...ek6Ef6Ends }
    : p;
}
