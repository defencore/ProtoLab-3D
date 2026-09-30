// Acceptance-test model of restart behaviour. Implement protection in an
// independently validated safety circuit; this TypeScript is not that circuit.
export interface SafetyInputs {
  estopsReleased: boolean;
  guardsLocked: boolean;
  contactorsHealthy: boolean;
  standstill: boolean;
  liftHeld: boolean;
  pressureHealthy: boolean;
  reset: boolean;
  start: boolean;
  stop: boolean;
  mode: 'manual' | 'assisted' | 'automatic';
  autoModulePresent: boolean;
  manualGuardPresent: boolean;
}
export interface SafetyState {
  phase: 'tripped' | 'armed' | 'running';
  mode: SafetyInputs['mode'];
  lastReset: boolean;
  lastStart: boolean;
}
export function safetyStep(s: SafetyState, f: SafetyInputs): SafetyState {
  const next = { ...s, lastReset: f.reset, lastStart: f.start };
  const valid =
    f.estopsReleased &&
    f.guardsLocked &&
    f.contactorsHealthy &&
    f.pressureHealthy &&
    (f.mode !== 'manual' ? f.autoModulePresent : f.manualGuardPresent);
  if (!valid || f.mode !== s.mode) return { ...next, phase: 'tripped', mode: f.mode };
  if (s.phase === 'tripped')
    return {
      ...next,
      phase: f.reset && !s.lastReset && f.standstill && f.liftHeld ? 'armed' : 'tripped',
    };
  if (f.stop) return { ...next, phase: 'tripped' };
  if (s.phase === 'armed' && f.start && !s.lastStart && !f.reset)
    return { ...next, phase: 'running' };
  return next;
}
