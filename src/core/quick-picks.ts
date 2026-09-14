import type { ParameterDefinition, Parameters, PartDefinition, Preset } from './types';

export interface QuickPickField extends ParameterDefinition {
  metricThread?: boolean;
}
export type QuickPickFilters = Record<string, string>;

export function quickPickFields(part: PartDefinition): QuickPickField[] {
  const selection: NonNullable<PartDefinition['catalogSelection']> =
    part.catalogSelection ?? part.presetMatchKeys?.slice(0, 4).map((key) => ({ key })) ?? [];
  return selection.flatMap(({ key, label, format }) => {
    const field = part.parameters.find((item) => item.key === key && item.filterable !== false);
    if (!field || !part.presets.some((preset) => preset.catalog?.verifiedParameters.includes(key)))
      return [];
    return [
      {
        ...field,
        label: label ?? field.label,
        metricThread: format === 'metric-thread',
      },
    ];
  });
}
export function quickPickLabel(field: QuickPickField, value: number | string | boolean): string {
  if (field.metricThread) return `M${value}`;
  if (field.type === 'number')
    return `${value}${field.unit === '' ? '' : ` ${field.unit ?? 'mm'}`}`;
  return field.options?.find((option) => option.value === String(value))?.label ?? String(value);
}
export function quickPickMatches(presets: Preset[], filters: QuickPickFilters): Preset[] {
  return presets.filter(
    (preset) =>
      preset.catalog &&
      Object.entries(filters).every(
        ([key, value]) =>
          !value ||
          (preset.catalog!.verifiedParameters.includes(key) &&
            String(preset.parameters[key]) === value),
      ),
  );
}
export function quickPickOptions(
  presets: Preset[],
  fields: QuickPickField[],
  filters: QuickPickFilters,
  index: number,
) {
  const field = fields[index];
  const preceding = Object.fromEntries(
    fields.slice(0, index).map((item) => [item.key, filters[item.key] ?? '']),
  );
  const candidates = quickPickMatches(presets, preceding);
  const options = new Map<string, { value: string; label: string; count: number }>();
  for (const preset of candidates) {
    if (!preset.catalog!.verifiedParameters.includes(field.key)) continue;
    const value = String(preset.parameters[field.key]);
    const entry = options.get(value);
    if (entry) entry.count++;
    else
      options.set(value, {
        value,
        label: quickPickLabel(field, preset.parameters[field.key]),
        count: 1,
      });
  }
  return [...options.values()].sort((a, b) =>
    field.type === 'number' ? Number(a.value) - Number(b.value) : a.label.localeCompare(b.label),
  );
}
export function updateQuickPickFilters(
  fields: QuickPickField[],
  filters: QuickPickFilters,
  index: number,
  value: string,
): QuickPickFilters {
  return Object.fromEntries(
    fields
      .slice(0, index + 1)
      .map((field, i) => [field.key, i === index ? value : (filters[field.key] ?? '')]),
  );
}
export function initialQuickPickFilters(
  part: PartDefinition,
  parameters: Parameters,
): QuickPickFilters {
  const first = quickPickFields(part)[0];
  if (!first) return {};
  const value = String(parameters[first.key]);
  return quickPickMatches(part.presets, { [first.key]: value }).length
    ? { [first.key]: value }
    : {};
}
export function hasCatalogQuickSize(part: PartDefinition, parameters: Parameters): boolean {
  const fields = quickPickFields(part);
  return (
    fields.length > 0 &&
    part.presets.some(
      (preset) =>
        preset.catalog &&
        fields.every((field) => preset.parameters[field.key] === parameters[field.key]),
    )
  );
}
export function reconcileQuickPickFilters(
  part: PartDefinition,
  parameters: Parameters,
  filters: QuickPickFilters,
  presetId: string,
): QuickPickFilters {
  const fields = quickPickFields(part);
  const selected = part.presets.find((preset) => preset.id === presetId && preset.catalog);
  const entries = Object.entries(filters).filter(
    ([key, value]) =>
      fields.some((field) => field.key === key) &&
      (!value || !selected || selected.catalog!.verifiedParameters.includes(key)),
  );
  if (entries.every(([key, value]) => !value || String(parameters[key]) === value))
    return entries.length === Object.keys(filters).length ? filters : Object.fromEntries(entries);
  const matchingPreset =
    selected ??
    part.presets.find(
      (preset) =>
        preset.catalog &&
        fields.every((field) => preset.parameters[field.key] === parameters[field.key]),
    );
  const next = Object.fromEntries(
    fields
      .filter((field) => matchingPreset?.catalog?.verifiedParameters.includes(field.key))
      .map((field) => [field.key, String(parameters[field.key])]),
  );
  return quickPickMatches(part.presets, next).length
    ? next
    : initialQuickPickFilters(part, parameters);
}
export function closestQuickPick(
  presets: Preset[],
  fields: QuickPickField[],
  parameters: Parameters,
): Preset | undefined {
  const score = (preset: Preset) =>
    fields.reduce(
      (total, field, index) =>
        total +
        (preset.parameters[field.key] === parameters[field.key] ? fields.length - index : 0),
      0,
    );
  return presets.reduce<Preset | undefined>(
    (best, preset) => (!best || score(preset) > score(best) ? preset : best),
    undefined,
  );
}
