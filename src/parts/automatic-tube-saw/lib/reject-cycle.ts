// Process acceptance model: the scrap route needs ordered occupancy/clear edges.
// A qualified PLC owns timeouts and debouncing; no elapsed time substitutes for a beam.
export type RejectPhase =
  | 'idle'
  | 'prepare'
  | 'purging'
  | 'positioning'
  | 'diverting'
  | 'dumping'
  | 'returning'
  | 'complete'
  | 'fault';
export interface RejectFeedback {
  safety: boolean;
  guards: boolean;
  sawDown: boolean;
  spindleStopped: boolean;
  gateClosed: boolean;
  clampsOpen: boolean;
  feedJawOpen: boolean;
  receiverLevel: boolean;
  receiverEntry: boolean;
  cutExitClear: boolean;
  receiverEntryClear: boolean;
  receiverPark: boolean;
  receiverEmpty: boolean;
  scrapSelected: boolean;
  scrapPassage: boolean;
  scrapBinPresent: boolean;
  timedOut: boolean;
}
export interface RejectState {
  phase: RejectPhase;
  entered: boolean;
  exitWasOccupied: boolean;
  passageSeen: boolean;
}
export const initialReject = (): RejectState => ({
  phase: 'idle',
  entered: false,
  exitWasOccupied: false,
  passageSeen: false,
});
export function rejectStep(s: RejectState, f: RejectFeedback, start = false): RejectState {
  const fault = (): RejectState => ({ ...s, phase: 'fault' });
  if (s.phase === 'fault') return s;
  if (
    !f.safety ||
    !f.guards ||
    !f.sawDown ||
    !f.spindleStopped ||
    !f.gateClosed ||
    !f.scrapBinPresent ||
    f.timedOut ||
    f.receiverEntry === f.receiverEntryClear
  )
    return fault();
  if (
    ['purging', 'positioning', 'diverting', 'dumping', 'returning'].includes(s.phase) &&
    (!f.feedJawOpen || !f.clampsOpen)
  )
    return fault();
  switch (s.phase) {
    case 'idle':
      return start ? { ...initialReject(), phase: 'prepare' } : s;
    case 'prepare':
      if (f.scrapPassage || f.receiverEntry || f.receiverPark || !f.receiverEmpty) return fault();
      return f.receiverLevel && f.feedJawOpen && f.clampsOpen ? { ...s, phase: 'purging' } : s;
    case 'purging':
      if (!f.receiverLevel || f.scrapPassage) return fault();
      return {
        ...s,
        phase: f.receiverEntry ? 'positioning' : 'purging',
        entered: s.entered || f.receiverEntry,
        exitWasOccupied: s.exitWasOccupied || !f.cutExitClear,
      };
    case 'positioning': {
      if (!f.receiverLevel || f.scrapPassage || f.receiverEmpty) return fault();
      const exitWasOccupied = s.exitWasOccupied || !f.cutExitClear;
      // Reaching the end with a tail still in the saw/entry means an oversized or jammed remnant.
      if (f.receiverPark && (!f.cutExitClear || !f.receiverEntryClear)) return fault();
      return {
        ...s,
        exitWasOccupied,
        phase:
          s.entered && exitWasOccupied && f.cutExitClear && f.receiverEntryClear && f.receiverPark
            ? 'diverting'
            : 'positioning',
      };
    }
    case 'diverting':
      if (
        !f.receiverLevel ||
        !f.receiverPark ||
        !f.cutExitClear ||
        !f.receiverEntryClear ||
        f.scrapPassage
      )
        return fault();
      return f.scrapSelected ? { ...s, phase: 'dumping' } : s;
    case 'dumping': {
      if (!f.scrapSelected || !f.cutExitClear) return fault();
      const passageSeen = s.passageSeen || f.scrapPassage;
      return {
        ...s,
        passageSeen,
        phase: passageSeen && !f.scrapPassage && f.receiverEmpty ? 'returning' : 'dumping',
      };
    }
    case 'returning':
      if (!f.scrapSelected || f.scrapPassage || !f.receiverEmpty) return fault();
      return f.receiverLevel ? { ...s, phase: 'complete' } : s;
    case 'complete':
      return s;
  }
}
export function rejectCommands(s: RejectState) {
  return {
    nipDrive: ['purging', 'positioning'].includes(s.phase),
    takeAway: ['purging', 'positioning'].includes(s.phase),
    receiverDrive: ['purging', 'positioning'].includes(s.phase),
    selectScrap: ['diverting', 'dumping', 'returning'].includes(s.phase),
    tilt: s.phase === 'dumping',
    releaseClamps: [
      'prepare',
      'purging',
      'positioning',
      'diverting',
      'dumping',
      'returning',
    ].includes(s.phase),
    // This is an acknowledgement request; stockStep still requires clear zones and dwell.
    newBarPermitted: s.phase === 'complete',
  };
}
