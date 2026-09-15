import type { ParameterDefinition, Parameters, PartDefinition, Preset } from './types';

export type CatalogModelFilters = Record<string, { min?: string; max?: string; value?: string }>;

export function catalogValue(preset: Preset, key: string) {
  return preset.catalog?.attributes?.[key];
}

export function presetValue(preset: Preset, key: string) {
  return catalogValue(preset, key) ?? preset.parameters[key];
}

export function searchableFields(part: PartDefinition): ParameterDefinition[] {
  return [...part.parameters, ...(part.catalogFilterFields ?? [])];
}

export function isPublishedValue(preset: Preset, key: string): boolean {
  return (
    catalogValue(preset, key) !== undefined || !!preset.catalog?.verifiedParameters.includes(key)
  );
}

/** Fixed products keep their identity when only their geometric pose changes. */
export function presetMatchesConfiguration(
  part: PartDefinition,
  preset: Preset,
  parameters: Parameters,
): boolean {
  const keys = part.catalogSelectionOnly
    ? (preset.catalog?.verifiedParameters ?? [])
    : Object.keys(part.defaults);
  return keys.length > 0 && keys.every((key) => preset.parameters[key] === parameters[key]);
}

export function catalogFilterErrors(
  fields: ParameterDefinition[],
  filters: CatalogModelFilters,
): string[] {
  const errors: string[] = [];
  for (const [key, filter] of Object.entries(filters)) {
    if (![filter.min, filter.max, filter.value].some((value) => value?.trim())) continue;
    const field = fields.find((field) => field.key === key);
    if (!field) {
      errors.push('This catalog characteristic is unavailable.');
      continue;
    }
    if (field.type !== 'number') continue;
    const min = filter.min?.trim() ? Number(filter.min) : undefined;
    const max = filter.max?.trim() ? Number(filter.max) : undefined;
    if (
      (min !== undefined && !Number.isFinite(min)) ||
      (max !== undefined && !Number.isFinite(max))
    )
      errors.push(`${field.label}: enter finite numbers.`);
    else if (min !== undefined && max !== undefined && min > max)
      errors.push(`${field.label}: minimum must not exceed maximum.`);
  }
  return errors;
}

export function matchesCatalogFilters(
  preset: Preset,
  fields: ParameterDefinition[],
  filters: CatalogModelFilters,
): boolean {
  if (!preset.catalog || catalogFilterErrors(fields, filters).length) return false;
  return Object.entries(filters).every(([key, filter]) => {
    if (![filter.min, filter.max, filter.value].some((value) => value?.trim())) return true;
    const field = fields.find((field) => field.key === key)!;
    const value = catalogValue(preset, key);
    if (field.type !== 'number') return value !== undefined && String(value) === filter.value;
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    const min = filter.min?.trim() ? Number(filter.min) : undefined;
    const max = filter.max?.trim() ? Number(filter.max) : undefined;
    return (min === undefined || value >= min - 1e-6) && (max === undefined || value <= max + 1e-6);
  });
}
