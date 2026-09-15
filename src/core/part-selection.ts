import type { ParameterDefinition, Parameters, PartDefinition } from './types';
import { validateParameters } from './validation';
import { presetMatchesConfiguration } from './catalog-models';

export interface PartSelection {
  partId: string;
  parameters: Parameters;
  modelState: string;
  presetId: string;
}

function matchesParameters(part: PartDefinition, left: Parameters, right: Parameters): boolean {
  return Object.keys(part.defaults).every((key) => left[key] === right[key]);
}

export function matchingPresetId(part: PartDefinition, parameters: Parameters): string {
  return (
    part.presets.find((preset) => presetMatchesConfiguration(part, preset, parameters))?.id ??
    'custom'
  );
}

export function defaultPartSelection(part: PartDefinition): PartSelection {
  return {
    partId: part.id,
    parameters: { ...part.defaults },
    modelState: part.states?.[0]?.id ?? 'default',
    presetId: matchingPresetId(part, part.defaults),
  };
}

function acceptsValue(field: ParameterDefinition, value: Parameters[string]): boolean {
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (field.type === 'boolean') return typeof value === 'boolean';
  return field.options?.some((option) => option.value === value) ?? false;
}

/** Reconcile a replaced module once, while ordinary parameter editing keeps its own validation. */
export function reconcilePartSelection(
  part: PartDefinition,
  previous: PartDefinition | undefined,
  selection: PartSelection,
): PartSelection {
  const initial = defaultPartSelection(part);
  if (selection.partId !== part.id || previous?.id !== part.id) return initial;

  const previousPreset = previous.presets.find((preset) => preset.id === selection.presetId);
  const replacementPreset = part.presets.find((preset) => preset.id === selection.presetId);
  const followsPreset =
    previousPreset && matchesParameters(previous, selection.parameters, previousPreset.parameters);
  const nextValues = followsPreset && replacementPreset ? replacementPreset.parameters : undefined;
  const parameters = { ...part.defaults };
  for (const field of part.parameters) {
    const value = nextValues
      ? nextValues[field.key]
      : selection.parameters[field.key] === previous.defaults[field.key] && !followsPreset
        ? part.defaults[field.key]
        : selection.parameters[field.key];
    if (acceptsValue(field, value)) parameters[field.key] = value;
  }
  for (const field of part.parameters) {
    if (
      field.type === 'number' &&
      (!field.visibleWhen || field.visibleWhen(parameters)) &&
      ((field.min !== undefined && Number(parameters[field.key]) < field.min) ||
        (field.max !== undefined && Number(parameters[field.key]) > field.max))
    )
      parameters[field.key] = part.defaults[field.key];
  }
  const modelState =
    part.states?.some((state) => state.id === selection.modelState) ||
    (!part.states && selection.modelState === 'default')
      ? selection.modelState
      : initial.modelState;

  let retained = parameters;
  if (validateParameters(part, retained, modelState).length) {
    retained = { ...part.defaults };
    // Recover independent edits after a new constraint invalidates their original combination.
    const pending = part.parameters.filter(
      (field) => parameters[field.key] !== retained[field.key],
    );
    for (let pass = 0; pass < pending.length; pass++) {
      let changed = false;
      for (const field of pending) {
        if (retained[field.key] === parameters[field.key]) continue;
        const candidate = { ...retained, [field.key]: parameters[field.key] };
        if (!validateParameters(part, candidate, modelState).length) {
          retained = candidate;
          changed = true;
        }
      }
      if (!changed) break;
    }
  }
  const state = validateParameters(part, retained, modelState).length
    ? initial.modelState
    : modelState;
  if (validateParameters(part, retained, state).length) retained = initial.parameters;
  return {
    partId: part.id,
    parameters: retained,
    modelState: state,
    presetId: matchingPresetId(part, retained),
  };
}
