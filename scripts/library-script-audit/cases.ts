import type { GeometryMode } from '../../src/core/geometry-mode';
import type { Parameters, PartDefinition } from '../../src/core/types';
import { validateParameters } from '../../src/core/validation';

export type AuditPhase = 'syntax' | 'native';
export interface AuditCase {
  key: string;
  partId: string;
  state: string;
  mode: GeometryMode;
  phase: AuditPhase;
  presetId?: string;
  patch?: Parameters;
  variant: string;
}
export interface CaseOptions {
  phases: AuditPhase[];
  modes: GeometryMode[];
  presets: boolean;
  states: 'all' | 'first';
  extrema: number;
}

export function caseParameters(part: PartDefinition, item: AuditCase): Parameters {
  const preset = item.presetId
    ? part.presets.find((candidate) => candidate.id === item.presetId)
    : undefined;
  if (item.presetId && !preset) throw new Error('Unknown audit preset: ' + item.presetId);
  return { ...part.defaults, ...preset?.parameters, ...item.patch };
}

/** Cover every authored state and catalog macro; native extrema remain an explicit finite sample. */
export function planCases(parts: readonly PartDefinition[], options: CaseOptions): AuditCase[] {
  const cases: AuditCase[] = [];
  for (const part of parts) {
    const states = part.states?.map((state) => state.id) ?? ['default'];
    const selectedStates = options.states === 'first' ? states.slice(0, 1) : states;
    const variants: { variant: string; patch: Parameters }[] = [];
    if (!part.catalogSelectionOnly && options.extrema > 0) {
      for (const field of part.parameters) {
        if (field.type !== 'number' || field.visibleWhen?.(part.defaults, states[0]) === false)
          continue;
        for (const boundary of ['min', 'max'] as const) {
          const value = field[boundary];
          if (value === undefined || value === part.defaults[field.key]) continue;
          let candidate = { ...part.defaults, [field.key]: value };
          try {
            if (part.updateParameters) candidate = part.updateParameters(candidate, field.key);
            if (validateParameters(part, candidate, states[0]).length) continue;
          } catch {
            continue;
          }
          variants.push({
            variant: `${field.key}-${boundary}`,
            patch: Object.fromEntries(
              Object.entries(candidate).filter(([key, setting]) => setting !== part.defaults[key]),
            ),
          });
          if (variants.length >= options.extrema) break;
        }
        if (variants.length >= options.extrema) break;
      }
    }
    for (const phase of options.phases)
      for (const mode of options.modes) {
        const add = (state: string, variant: string, presetId?: string, patch?: Parameters) =>
          cases.push({
            key: [phase, part.id, variant, state, mode].join('/'),
            partId: part.id,
            state,
            mode,
            phase,
            variant,
            ...(presetId ? { presetId } : {}),
            ...(patch ? { patch } : {}),
          });
        for (const state of selectedStates) add(state, 'default');
        if (phase === 'native')
          for (const variant of variants.slice(0, options.extrema))
            add(states[0], variant.variant, undefined, variant.patch);
        if (phase === 'syntax' && options.presets)
          for (const preset of part.presets) add(states[0], 'preset-' + preset.id, preset.id);
      }
  }
  return cases;
}

export type AuditStatus = 'passed' | 'failed' | 'timeout';
export interface AuditResult {
  key: string;
  partId: string;
  phase: AuditPhase;
  mode: GeometryMode;
  state: string;
  variant: string;
  status: AuditStatus;
  presetId?: string;
  patch?: Parameters;
  stage: 'generation' | 'syntax' | 'native';
  sourceHash?: string;
  elapsedMs: number;
  generationMs?: number;
  nativeMs?: number;
  checkedAt: string;
  reused?: boolean;
  components?: number;
  solids?: number;
  volume?: number;
  dimensions?: number[];
  error?: string;
  parameters?: Parameters;
}
