// Executable process specification for the PLC integrator, not a DDCS program
// or safety-rated implementation. Millimetres include trim and axial saw kerf.
export interface StockRecipe {
  mode: 'automatic' | 'assisted';
  stockLength: number;
  trim: number;
  advance: number;
  retainedTail: number;
  clearDwellMs: number;
  tolerance: number;
}
export interface StockFeedback {
  safetyHealthy: boolean;
  loaderStopped: boolean;
  sawDown: boolean;
  spindleStopped: boolean;
  gateClosed: boolean;
  gateOpen: boolean;
  queuePresent: boolean;
  tailZoneClear: boolean;
  cuttingZoneClear: boolean;
  receiverClear: boolean;
  loadingCoverLocked: boolean;
}
export interface StockState {
  phase: 'clearing' | 'opening' | 'admitting' | 'facing' | 'active' | 'remnant' | 'fault';
  stockLength: number;
  phaseMs: number;
  barId: number;
  consumed: number;
  cutNumber: number;
  emptyMs: number;
  sawPostGateEdge: boolean;
  removalAcknowledged: boolean;
  reason?: string;
}
export type StockEvent =
  | { type: 'tick'; elapsedMs: number }
  | { type: 'remnant-removed' }
  | { type: 'reject-confirmed'; barId: number; receiverEmpty: boolean; passageSeen: boolean }
  | { type: 'admit' }
  | { type: 'front-at-datum' }
  | { type: 'operator-loaded' }
  | { type: 'faced'; scrapRemoved: boolean }
  | { type: 'physical-tail'; barId: number; measuredLength: number }
  | { type: 'cut-complete'; barId: number; cutNumber: number; measuredAdvance: number }
  | { type: 'unexpected-tail' };
export const initialStock = (): StockState => ({
  phase: 'clearing',
  stockLength: 0,
  phaseMs: 0,
  barId: 0,
  consumed: 0,
  cutNumber: 0,
  emptyMs: 0,
  sawPostGateEdge: false,
  removalAcknowledged: false,
});
const empty = (f: StockFeedback) => f.tailZoneClear && f.cuttingZoneClear && f.receiverClear;
export function stockCanCut(s: StockState, r: StockRecipe) {
  return s.phase === 'active' && s.stockLength - s.consumed - r.retainedTail >= r.advance;
}
export function stockStep(
  s: StockState,
  e: StockEvent,
  f: StockFeedback,
  r: StockRecipe,
): StockState {
  const fault = (reason: string): StockState => ({ ...s, phase: 'fault', reason });
  if (s.phase === 'fault') return s;
  if (
    ![r.stockLength, r.trim, r.advance, r.retainedTail, r.clearDwellMs, r.tolerance].every(
      Number.isFinite,
    ) ||
    !['automatic', 'assisted'].includes(r.mode) ||
    r.advance <= 0 ||
    r.trim < 0 ||
    r.retainedTail <= 0 ||
    r.clearDwellMs < 500 ||
    r.tolerance < 0 ||
    r.stockLength < r.trim + r.retainedTail + r.advance
  )
    return fault('Invalid stock recipe');
  if (!f.safetyHealthy || (f.gateOpen && f.gateClosed))
    return fault('Safety or gate proof fault; stock identity invalidated');
  if (e.type === 'unexpected-tail')
    return fault('Physical tail disagrees with stock ledger; never count across a bar end');
  if (e.type === 'remnant-removed' || e.type === 'reject-confirmed') {
    if (
      e.type === 'reject-confirmed' &&
      (s.phase !== 'remnant' || e.barId !== s.barId || !e.receiverEmpty || !e.passageSeen)
    )
      return fault('Unproven or stale automatic remnant clearance');
    if (
      !['clearing', 'remnant'].includes(s.phase) ||
      !f.loaderStopped ||
      !f.sawDown ||
      !f.spindleStopped ||
      (r.mode === 'automatic' && !f.gateClosed) ||
      !empty(f)
    )
      return fault(
        'Remnant removal requires stopped machinery, closed admission gate and clear downstream zones',
      );
    return {
      ...s,
      phase: 'clearing',
      emptyMs: 0,
      removalAcknowledged: true,
      sawPostGateEdge: false,
    };
  }
  if (e.type === 'tick') {
    if (!Number.isFinite(e.elapsedMs) || e.elapsedMs < 0 || e.elapsedMs > 250)
      return fault('Missing PLC heartbeat');
    if (s.phase === 'clearing')
      return {
        ...s,
        emptyMs:
          s.removalAcknowledged &&
          empty(f) &&
          (r.mode === 'assisted' || f.gateClosed) &&
          f.loaderStopped
            ? Math.min(r.clearDwellMs, s.emptyMs + e.elapsedMs)
            : 0,
      };
    if (s.phase === 'opening') {
      if (!f.loadingCoverLocked || s.phaseMs + e.elapsedMs > 5000)
        return fault('Gate opening timeout or loading cover unlocked');
      return {
        ...s,
        phase: f.gateOpen ? 'admitting' : 'opening',
        phaseMs: f.gateOpen ? 0 : s.phaseMs + e.elapsedMs,
      };
    }
    if (s.phase === 'admitting') {
      if (!f.loadingCoverLocked || !f.gateOpen)
        return fault('Admission drive requires locked loading cover and proven open gate');
      if (s.phaseMs + e.elapsedMs > 120000) return fault('Admission travel timeout');
      return {
        ...s,
        phaseMs: s.phaseMs + e.elapsedMs,
        sawPostGateEdge: s.sawPostGateEdge || !f.tailZoneClear,
      };
    }
    return s;
  }
  if (e.type === 'operator-loaded') {
    if (
      r.mode !== 'assisted' ||
      s.phase !== 'clearing' ||
      !s.removalAcknowledged ||
      s.emptyMs < r.clearDwellMs ||
      !f.loaderStopped ||
      !f.sawDown ||
      !f.spindleStopped ||
      !f.loadingCoverLocked ||
      f.cuttingZoneClear
    )
      return fault(
        'Operator-loaded bar needs cleared prior identity, stopped drives, material and locked access',
      );
    return { ...s, phase: 'facing', stockLength: r.stockLength };
  }
  if (e.type === 'physical-tail') {
    if (
      !['active', 'remnant'].includes(s.phase) ||
      e.barId !== s.barId ||
      !Number.isFinite(e.measuredLength) ||
      Math.abs(e.measuredLength - s.stockLength) > r.tolerance
    )
      return fault('Physical tail disagrees with active bar identity or measured length');
    const next = { ...s, stockLength: e.measuredLength };
    return { ...next, phase: stockCanCut(next, r) ? 'active' : 'remnant' };
  }
  if (e.type === 'admit') {
    if (
      r.mode !== 'automatic' ||
      s.phase !== 'clearing' ||
      !s.removalAcknowledged ||
      s.emptyMs < r.clearDwellMs ||
      !empty(f) ||
      !f.gateClosed ||
      !f.loaderStopped ||
      !f.sawDown ||
      !f.spindleStopped ||
      !f.queuePresent ||
      !f.loadingCoverLocked
    )
      return fault('Next bar blocked until the previous bar is cleared and acknowledged');
    return {
      ...s,
      phase: 'opening',
      phaseMs: 0,
      stockLength: r.stockLength,
      sawPostGateEdge: false,
    };
  }
  if (e.type === 'front-at-datum') {
    if (
      s.phase !== 'admitting' ||
      !s.sawPostGateEdge ||
      f.cuttingZoneClear ||
      !f.loaderStopped ||
      !f.gateOpen
    )
      return fault('New-bar sensor order or datum not confirmed');
    return { ...s, phase: 'facing' };
  }
  if (e.type === 'faced') {
    if (
      !e.scrapRemoved ||
      s.phase !== 'facing' ||
      f.cuttingZoneClear ||
      !f.loaderStopped ||
      !f.sawDown
    )
      return fault('New datum cannot reset an active or unidentified bar');
    return {
      ...s,
      phase: 'active',
      barId: s.barId + 1,
      consumed: r.trim,
      cutNumber: 0,
      emptyMs: 0,
      removalAcknowledged: false,
    };
  }
  if (
    !stockCanCut(s, r) ||
    e.barId !== s.barId ||
    e.cutNumber !== s.cutNumber + 1 ||
    !Number.isFinite(e.measuredAdvance) ||
    Math.abs(e.measuredAdvance - r.advance) > r.tolerance ||
    !f.sawDown ||
    !f.loaderStopped
  )
    return fault('Rejected cut: stale identity, duplicate count, short stock or travel error');
  const next = { ...s, consumed: s.consumed + e.measuredAdvance, cutNumber: e.cutNumber };
  return { ...next, phase: stockCanCut(next, r) ? 'active' : 'remnant' };
}
export function admissionCommands(s: StockState, f: StockFeedback) {
  return {
    openGate: ['opening', 'admitting'].includes(s.phase) && f.safetyHealthy && f.loadingCoverLocked,
    loadForward:
      s.phase === 'admitting' &&
      f.safetyHealthy &&
      f.loadingCoverLocked &&
      f.gateOpen &&
      !f.gateClosed,
    // Closing a stop through an active tube is forbidden; an actual empty tail zone is required.
    closeGate:
      ['clearing', 'remnant', 'active'].includes(s.phase) && f.tailZoneClear && f.loaderStopped,
  };
}
