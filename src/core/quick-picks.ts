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
  searched: Preset[] = presets,
) {
  const field = fields[index];
  const otherFilters = Object.fromEntries(
    Object.entries(filters).filter(([key]) => key !== field.key),
  );
  const candidates = new Set(quickPickMatches(searched, otherFilters));
  const options = new Map<string, { value: string; label: string; count: number }>();
  for (const preset of presets) {
    if (!preset.catalog?.verifiedParameters.includes(field.key)) continue;
    const value = String(preset.parameters[field.key]);
    const entry = options.get(value);
    if (entry) entry.count += Number(candidates.has(preset));
    else
      options.set(value, {
        value,
        label: quickPickLabel(field, preset.parameters[field.key]),
        count: Number(candidates.has(preset)),
      });
  }
  const selected = filters[field.key];
  if (selected && !options.has(selected))
    options.set(selected, { value: selected, label: quickPickLabel(field, selected), count: 0 });
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
  const next = { ...filters };
  if (value) next[fields[index].key] = value;
  else delete next[fields[index].key];
  return next;
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
