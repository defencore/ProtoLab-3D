export type Phase =
  | 'ready'
  | 'manual-loading'
  | 'unclamping'
  | 'feeding'
  | 'manual-clamping'
  | 'stopping'
  | 'clamping'
  | 'cutting'
  | 'retracting'
  | 'releasing'
  | 'transferring'
  | 'sorting'
  | 'resetting'
  | 'ungripping'
  | 'returning'
  | 'fault';
export interface Recipe {
  feedMode: 'manual' | 'assisted' | 'automatic';
  destination: 'good' | 'scrap';
  advance: number;
  shortPart: boolean;
  measurementTolerance: number;
  slipLimit: number;
}
export interface Feedback {
  stockAuthorized: boolean;
  autoModulePresent: boolean;
  manualGuardPresent: boolean;
  spindleStopped: boolean;
  manualLengthConfirmed: boolean;
  guardLocked: boolean;
  safetyHealthy: boolean;
  pressureOk: boolean;
  bladeDown: boolean;
  bladeUp: boolean;
  spindleAtSpeed: boolean;
  gripperClosed: boolean;
  stockClosed: boolean;
  offcutClosed: boolean;
  gripperOpen: boolean;
  clampsOpen: boolean;
  feedHome: boolean;
  partClear: boolean;
  driveHealthy: boolean;
  start: boolean;
  measurementValid: boolean;
  materialPresent: boolean;
  materialTravel: number;
  axisTravel: number;
  sideReleased: boolean;
  receiverHome: boolean;
  receiverLoaded: boolean;
  receiverEntryClear: boolean;
  transferPressureOk: boolean;
  chutePassage: boolean;
  boxPresent: boolean;
  goodRouteSelected: boolean;
  scrapRouteSelected: boolean;
}
export interface Commands {
  feedForward: boolean;
  feedReturn: boolean;
  grip: boolean;
  stockClamp: boolean;
  offcutClamp: boolean;
  offcutTop: boolean;
  transferPressure: boolean;
  sawUp: boolean;
  sawDown: boolean;
  requestSpindle: boolean;
  takeAway: boolean;
  receiverDrive: boolean;
  outletDrive: boolean;
  tiltReceiver: boolean;
  resetTravel: boolean;
  selectScrap: boolean;
}
export function commands(phase: Phase, recipe: Recipe): Commands {
  return {
    resetTravel: false,
    selectScrap:
      recipe.feedMode !== 'manual' && recipe.destination === 'scrap' && phase !== 'fault',
    feedForward: phase === 'feeding' && recipe.feedMode !== 'manual',
    feedReturn: phase === 'returning' && recipe.feedMode !== 'manual',
    grip:
      recipe.feedMode !== 'manual' &&
      ['ready', 'unclamping', 'feeding', 'clamping', 'fault'].includes(phase),
    stockClamp: !['manual-loading', 'unclamping', 'feeding'].includes(phase),
    offcutClamp: [
      'manual-clamping',
      'clamping',
      'cutting',
      'retracting',
      'stopping',
      'fault',
    ].includes(phase),
    offcutTop: [
      'manual-clamping',
      'clamping',
      'cutting',
      'retracting',
      'stopping',
      'releasing',
      'transferring',
      'fault',
    ].includes(phase),
    transferPressure: ['releasing', 'transferring'].includes(phase),
    sawUp: phase === 'cutting',
    sawDown: phase === 'retracting',
    requestSpindle: ['clamping', 'cutting', 'retracting'].includes(phase),
    takeAway: recipe.feedMode !== 'manual' && phase === 'transferring',
    receiverDrive: recipe.feedMode !== 'manual' && phase === 'transferring',
    outletDrive: recipe.feedMode !== 'manual' && phase === 'transferring' && !recipe.shortPart,
    tiltReceiver: recipe.feedMode !== 'manual' && phase === 'sorting' && recipe.shortPart,
  };
}
// Design-level sequence only. Safety relays, monitored braking and pneumatic holding
// remain independent of these ordinary process inputs. Travel is reset at the faced datum.
export function nextPhase(phase: Phase, f: Feedback, r: Recipe, timedOut = false): Phase {
  if (phase === 'fault') return 'fault';
  if (
    timedOut ||
    (!f.guardLocked &&
      !(
        r.feedMode === 'manual' &&
        ['manual-loading', 'manual-clamping'].includes(phase) &&
        f.spindleStopped &&
        f.bladeDown
      )) ||
    !f.safetyHealthy ||
    !f.pressureOk ||
    !f.driveHealthy ||
    (r.feedMode !== 'manual' && !f.stockAuthorized) ||
    (r.feedMode !== 'manual' ? !f.autoModulePresent : !f.manualGuardPresent) ||
    (f.bladeDown && f.bladeUp)
  )
    return 'fault';
  const routeSelected = r.destination === 'scrap' ? f.scrapRouteSelected : f.goodRouteSelected;
  if (
    r.feedMode !== 'manual' &&
    ((f.goodRouteSelected && f.scrapRouteSelected) ||
      (['transferring', 'sorting'].includes(phase) && !routeSelected))
  )
    return 'fault';
  if (r.destination === 'scrap' && !r.shortPart) return 'fault';
  if (r.feedMode !== 'manual' && r.shortPart && !f.boxPresent) return 'fault';
  switch (phase) {
    case 'ready':
      if (r.feedMode === 'manual')
        return f.start && f.bladeDown && f.spindleStopped ? 'manual-loading' : phase;
      return f.start &&
        f.bladeDown &&
        f.feedHome &&
        f.gripperClosed &&
        f.receiverHome &&
        f.materialPresent
        ? 'unclamping'
        : phase;
    case 'manual-loading':
      if (r.feedMode !== 'manual' || !f.bladeDown || !f.spindleStopped) return 'fault';
      return f.manualLengthConfirmed && f.start && f.materialPresent ? 'manual-clamping' : phase;
    case 'manual-clamping':
      if (r.feedMode !== 'manual' || !f.bladeDown || !f.spindleStopped) return 'fault';
      return f.stockClosed && f.offcutClosed && f.guardLocked && f.start ? 'clamping' : phase;
    case 'stopping':
      if (!f.bladeDown || !f.stockClosed || !f.offcutClosed) return 'fault';
      return f.spindleStopped ? 'ready' : phase;
    case 'unclamping':
      if (r.feedMode === 'manual') return 'fault';
      if (!f.bladeDown || !f.gripperClosed || !f.receiverHome) return 'fault';
      return f.clampsOpen ? 'feeding' : phase;
    case 'feeding':
      if (r.feedMode === 'manual') return 'fault';
      if (
        !f.bladeDown ||
        !f.gripperClosed ||
        !f.clampsOpen ||
        !f.receiverHome ||
        !f.materialPresent ||
        !f.measurementValid ||
        ![f.materialTravel, f.axisTravel].every(Number.isFinite)
      )
        return 'fault';
      if (
        Math.abs(f.axisTravel - f.materialTravel) > r.slipLimit ||
        f.materialTravel > r.advance + r.measurementTolerance
      )
        return 'fault';
      return Math.abs(f.materialTravel - r.advance) <= r.measurementTolerance ? 'clamping' : phase;
    case 'clamping':
      if (!f.bladeDown || (r.feedMode !== 'manual' && !f.gripperClosed)) return 'fault';
      return f.stockClosed && f.offcutClosed && f.spindleAtSpeed ? 'cutting' : phase;
    case 'cutting':
      if (!f.stockClosed || !f.offcutClosed || !f.spindleAtSpeed) return 'fault';
      return f.bladeUp ? 'retracting' : phase;
    case 'retracting':
      if (!f.stockClosed || !f.offcutClosed) return 'fault';
      return f.bladeDown ? (r.feedMode === 'manual' ? 'stopping' : 'releasing') : phase;
    case 'releasing':
      if (!f.bladeDown || !f.stockClosed || !f.receiverHome) return 'fault';
      return f.sideReleased && f.transferPressureOk && routeSelected ? 'transferring' : phase;
    case 'transferring':
      if (
        !f.bladeDown ||
        !f.stockClosed ||
        !f.sideReleased ||
        !f.transferPressureOk ||
        !f.receiverHome
      )
        return 'fault';
      return r.shortPart
        ? f.receiverLoaded && f.receiverEntryClear
          ? 'sorting'
          : phase
        : f.partClear
          ? 'ungripping'
          : phase;
    case 'sorting':
      if (!r.shortPart || !f.bladeDown || !f.stockClosed) return 'fault';
      return f.chutePassage ? 'resetting' : phase;
    case 'resetting':
      if (!f.bladeDown || !f.stockClosed) return 'fault';
      return f.receiverHome && !f.receiverLoaded ? 'ungripping' : phase;
    case 'ungripping':
      if (r.feedMode === 'manual') return f.bladeDown && f.receiverHome ? 'ready' : 'fault';
      if (!f.bladeDown || !f.stockClosed || !f.receiverHome) return 'fault';
      return f.gripperOpen ? 'returning' : phase;
    case 'returning':
      if (!f.bladeDown || !f.stockClosed || !f.gripperOpen || !f.receiverHome) return 'fault';
      return f.feedHome ? 'ready' : phase;
  }
}
export function step(phase: Phase, f: Feedback, r: Recipe, timedOut = false) {
  const next = nextPhase(phase, f, r, timedOut);
  const outputs = commands(next, r);
  outputs.resetTravel = next !== phase && ['unclamping', 'manual-loading'].includes(next);
  return { phase: next, outputs };
}
