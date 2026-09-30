import {
  FACE_LENGTH,
  SHUTTLE_TRAVEL,
  TAIL_RESERVE,
  SHUTTLE_HOME,
  SENSOR_OFFSET,
  LOAD_NOSE_MIN,
  LOAD_NOSE_MAX,
} from './layout';
// Acceptance contract: axis is mm from referenced shuttle home. The initial scan
// moves an OPEN carriage past stock retained by the FIXED vise. No stock encoder.
export type Phase =
  | 'idle'
  | 'securing'
  | 'scanning'
  | 'scan-return'
  | 'gripping'
  | 'opening'
  | 'feeding'
  | 'clamping'
  | 'starting'
  | 'cutting'
  | 'stopping'
  | 'dropping'
  | 'restoring'
  | 'raising'
  | 'ungripping'
  | 'returning'
  | 'complete'
  | 'fault';
export interface Recipe {
  length: number;
  kerf: number;
  stockLength: number;
  stopWindow: number;
  axisDrift: number;
}
export interface Feedback {
  safety: boolean;
  guardsLocked: boolean;
  pressureOk: boolean;
  driveHealthy: boolean;
  headUp: boolean;
  headDown: boolean;
  lowerNC: boolean;
  headHeld: boolean;
  bandStopped: boolean;
  bandAtSpeed: boolean;
  contactorOff: boolean;
  gripperClosed: boolean;
  gripperOpen: boolean;
  sideClosed: boolean;
  topClosed: boolean;
  viseOpen: boolean;
  axisHome: boolean;
  axisStopped: boolean;
  axisReferenced: boolean;
  axis: number;
  shelfLevel: boolean;
  shelfTipped: boolean;
  partOnShelf: boolean;
  shelfEmpty: boolean;
  boxPresent: boolean;
  passage: boolean;
  stockDetected: boolean;
  edgeAxis: number | null;
  // Calibrated beam X with axis at zero; includes sensor latency at the qualified scan speed.
  datumCalibrated: boolean;
  sensorHomeX: number;
  start: boolean;
  newBarConfirmed: boolean;
  timedOut: boolean;
  toolingConfirmed: boolean;
}
export interface Cycle {
  phase: Phase;
  fault?: string;
  facing: boolean;
  datumKnown: boolean;
  noseX: number | null;
  target: number;
  heldAxis: number;
  consumed: number;
  count: number;
  passageSeen: boolean;
}
export const initialCycle = (): Cycle => ({
  phase: 'idle',
  facing: true,
  datumKnown: false,
  noseX: null,
  target: 0,
  heldAxis: 0,
  consumed: 0,
  count: 0,
  passageSeen: false,
});
export function nextCycle(s: Cycle, f: Feedback, r: Recipe): Cycle {
  const fault = (reason: string): Cycle => ({ ...s, phase: 'fault', fault: reason });
  const go = (phase: Phase, patch: Partial<Cycle> = {}): Cycle => ({ ...s, ...patch, phase });
  if (s.phase === 'fault') return s;
  if (
    ![r.length, r.kerf, r.stockLength, r.stopWindow, r.axisDrift].every(Number.isFinite) ||
    r.length < 30 ||
    r.length > 100 ||
    r.kerf < 1.1 ||
    r.kerf > 2.5 ||
    r.stockLength < 1000 ||
    r.stockLength > 2000 ||
    r.stopWindow <= 0 ||
    r.stopWindow > 0.15 ||
    r.axisDrift <= 0 ||
    r.axisDrift > 0.15
  )
    return fault('Invalid recipe');
  if (
    !f.safety ||
    !f.guardsLocked ||
    !f.pressureOk ||
    !f.driveHealthy ||
    !f.boxPresent ||
    f.timedOut
  )
    return fault('Interlock or timeout');
  if (
    (f.headUp && f.headDown) ||
    f.headDown === f.lowerNC ||
    (f.shelfLevel && f.shelfTipped) ||
    (f.gripperOpen && f.gripperClosed) ||
    (f.viseOpen && (f.sideClosed || f.topClosed)) ||
    (f.shelfEmpty && f.partOnShelf) ||
    (f.bandStopped && f.bandAtSpeed)
  )
    return fault('Contradictory feedback');
  if (
    !f.toolingConfirmed ||
    !f.datumCalibrated ||
    !f.axisReferenced ||
    ![f.axis, f.sensorHomeX].every(Number.isFinite) ||
    Math.abs(f.sensorHomeX - (SHUTTLE_HOME + SENSOR_OFFSET)) > 2
  )
    return fault('Calibrated axis and optical datum required');
  if (
    f.axis < -r.stopWindow ||
    f.axis > SHUTTLE_TRAVEL + r.stopWindow ||
    (f.axisHome && Math.abs(f.axis) > r.stopWindow)
  )
    return fault('Axis outside referenced travel');
  if (s.phase === 'idle') {
    if (!f.start) return s;
    if (
      !f.newBarConfirmed ||
      !f.headUp ||
      !f.headHeld ||
      !f.bandStopped ||
      !f.contactorOff ||
      !f.axisHome ||
      !f.axisStopped ||
      !f.shelfLevel ||
      !f.shelfEmpty ||
      f.passage ||
      !f.stockDetected
    )
      return fault('Load nose in X -30 to -15 and start at referenced home with stock detected');
    return go('securing');
  }
  if (s.phase === 'complete') return s;
  const scanning = ['securing', 'scanning', 'scan-return'].includes(s.phase);
  if (
    [
      'securing',
      'scanning',
      'scan-return',
      'gripping',
      'opening',
      'feeding',
      'ungripping',
      'returning',
    ].includes(s.phase) &&
    (!f.headUp || !f.headHeld || !f.bandStopped || !f.contactorOff || !f.shelfLevel)
  )
    return fault('Indexing requires raised retained head, standstill and level shelf');
  if (!['dropping', 'restoring'].includes(s.phase) && !f.shelfLevel)
    return fault('Support shelf not level');
  if (s.datumKnown && !scanning && f.axisHome && !f.stockDetected)
    return fault('Unexpected tail or missing stock at carriage beam');
  if (
    [
      'scanning',
      'scan-return',
      'starting',
      'cutting',
      'stopping',
      'dropping',
      'restoring',
      'raising',
      'ungripping',
      'returning',
    ].includes(s.phase) &&
    (!f.sideClosed || !f.topClosed)
  )
    return fault('Fixed workholding lost');
  if (['scanning', 'scan-return', 'returning'].includes(s.phase) && !f.gripperOpen)
    return fault('Scan or return requires open shuttle');
  if (
    [
      'opening',
      'feeding',
      'clamping',
      'starting',
      'cutting',
      'stopping',
      'dropping',
      'restoring',
      'raising',
    ].includes(s.phase) &&
    !f.gripperClosed
  )
    return fault('Shuttle grip lost');
  if (
    [
      'clamping',
      'starting',
      'cutting',
      'stopping',
      'dropping',
      'restoring',
      'raising',
      'ungripping',
    ].includes(s.phase) &&
    (!f.axisStopped || Math.abs(f.axis - s.heldAxis) > r.axisDrift)
  )
    return fault('Feed axis moved during hold');
  switch (s.phase) {
    case 'securing':
      if (!f.axisHome || !f.axisStopped) return fault('Scan must start at home');
      if (!f.sideClosed || !f.topClosed || !f.gripperOpen) return s;
      if (!f.stockDetected || f.edgeAxis !== null)
        return fault('Arm a fresh detected-to-clear scan latch');
      return go('scanning');
    case 'scanning': {
      if (f.stockDetected)
        return f.axis >= SHUTTLE_TRAVEL ? fault('Nose not found inside scan stroke') : s;
      if (
        f.edgeAxis === null ||
        !Number.isFinite(f.edgeAxis) ||
        f.edgeAxis < 0 ||
        f.edgeAxis > f.axis
      )
        return fault('Missing fresh hardware-latched nose edge');
      const noseX = f.sensorHomeX + f.edgeAxis;
      if (noseX < LOAD_NOSE_MIN || noseX > LOAD_NOSE_MAX)
        return fault('Reload nose in marked loading window');
      return go('scan-return', {
        noseX,
        datumKnown: true,
        target: FACE_LENGTH + r.kerf / 2 - noseX,
      });
    }
    case 'scan-return':
      if (!f.axisHome || !f.axisStopped) return s;
      return f.stockDetected ? go('gripping') : fault('Stock missing after scan');
    case 'gripping':
      if (!f.axisHome || !f.axisStopped || !f.sideClosed || !f.topClosed || !s.datumKnown)
        return fault('Regrip requires fixed stock and referenced home');
      return f.gripperClosed
        ? go('opening', { target: s.facing ? s.target : r.length + r.kerf })
        : s;
    case 'opening':
      return f.viseOpen ? go('feeding') : s;
    case 'feeding':
      if (!f.viseOpen || f.axis > s.target + r.stopWindow)
        return fault('Feed clamp state or overshoot');
      return f.axisStopped && Math.abs(f.axis - s.target) <= r.stopWindow
        ? go('clamping', { heldAxis: f.axis })
        : s;
    case 'clamping':
      if (!f.headUp || !f.headHeld || !f.bandStopped || !f.contactorOff)
        return fault('Clamp verification requires standstill');
      return f.sideClosed && f.topClosed && f.partOnShelf ? go('starting') : s;
    case 'starting':
      if (!f.headUp || !f.headHeld || !f.lowerNC || !f.partOnShelf)
        return fault('Start permissive lost');
      return f.bandAtSpeed && !f.contactorOff ? go('cutting') : s;
    case 'cutting':
      if (f.headDown) return go('stopping');
      return f.bandAtSpeed && !f.contactorOff && f.partOnShelf
        ? s
        : fault('Band speed or support lost');
    case 'stopping':
      if (!f.headDown) return fault('Bottom position lost');
      if (f.passage) return fault('Chute beam already occupied before release');
      return f.bandStopped && f.contactorOff && f.headHeld
        ? go('dropping', { passageSeen: false })
        : s;
    case 'dropping': {
      if (!f.headDown || !f.headHeld || !f.bandStopped || !f.contactorOff)
        return fault('Drop permissive lost');
      const passageSeen = s.passageSeen || f.passage;
      return f.shelfTipped && passageSeen && !f.passage && f.shelfEmpty
        ? go('restoring', {
            passageSeen,
            consumed: s.consumed + (s.facing ? FACE_LENGTH : r.length) + r.kerf,
            count: s.count + (s.facing ? 0 : 1),
          })
        : { ...s, passageSeen };
    }
    case 'restoring':
      if (
        !f.headDown ||
        !f.headHeld ||
        !f.bandStopped ||
        !f.contactorOff ||
        f.passage ||
        !f.shelfEmpty
      )
        return fault('Shelf reset not clear');
      return f.shelfLevel ? go('raising') : s;
    case 'raising':
      if (!f.bandStopped || !f.contactorOff || !f.shelfEmpty) return fault('Raise permissive lost');
      return f.headUp && f.headHeld ? go('ungripping', { facing: false }) : s;
    case 'ungripping':
      return f.gripperOpen ? go('returning') : s;
    case 'returning':
      if (!f.gripperOpen) return fault('Returning shuttle is not open');
      if (!f.axisHome || !f.axisStopped) return s;
      return go(
        r.stockLength - s.consumed < TAIL_RESERVE + r.length + r.kerf ? 'complete' : 'gripping',
      );
  }
}
export function commands(s: Cycle, f: Feedback, _r: Recipe) {
  const disabled = ['fault', 'complete', 'idle'].includes(s.phase);
  return {
    bandContactor:
      !disabled && ['starting', 'cutting'].includes(s.phase) && f.lowerNC && !f.headDown,
    headRaise: !disabled && s.phase === 'raising' && !f.headUp,
    headDescend: !disabled && s.phase === 'cutting' && !f.headDown,
    headHold:
      disabled ||
      !['raising', 'cutting'].includes(s.phase) ||
      f.headDown ||
      (s.phase === 'raising' && f.headUp),
    feedForward:
      !disabled && (s.phase === 'scanning' || (s.phase === 'feeding' && f.axis < s.target)),
    feedSlowScan: !disabled && s.phase === 'scanning',
    latchNoseEdge: !disabled && s.phase === 'scanning',
    feedReturn: !disabled && ['scan-return', 'returning'].includes(s.phase) && !f.axisHome,
    axisTarget:
      s.phase === 'scanning'
        ? SHUTTLE_TRAVEL
        : ['scan-return', 'returning'].includes(s.phase)
          ? 0
          : s.target,
    gripperClose:
      disabled ||
      !['securing', 'scanning', 'scan-return', 'ungripping', 'returning'].includes(s.phase),
    fixedClampsClose: disabled || !['opening', 'feeding'].includes(s.phase),
    shelfOpen: !disabled && s.phase === 'dropping',
    shelfClose: !disabled && s.phase === 'restoring',
  };
}
export function step(s: Cycle, f: Feedback, r: Recipe) {
  const next = nextCycle(s, f, r);
  return { state: next, outputs: commands(next, f, r) };
}
