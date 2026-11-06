import type { ParameterDefinition, Parameters, PartDefinition, Preset } from './types';
import {
  matchesNumericRange,
  numericRangeErrorMessage,
  parseNumericRange,
  readNumericInterval,
  type NumericRange,
} from './numeric-range';

export type CatalogModelFilters = Record<string, { min?: string; max?: string; value?: string }>;
const supplied = (value: unknown) =>
  value !== undefined && (typeof value !== 'string' || !!value.trim());

export function fieldFilterErrors(
  field: ParameterDefinition,
  filter: CatalogModelFilters[string],
): string[] {
  if (![filter.min, filter.max, filter.value].some(supplied)) return [];
  if (field.filterable === false) return ['This catalog characteristic is unavailable.'];
  if (field.type === 'number') {
    if (supplied(filter.value))
      return [`${field.label}: use minimum and maximum bounds for a numeric filter.`];
    return parseNumericRange(filter).errors.map(
      (error) => `${field.label}: ${numericRangeErrorMessage(error)}`,
    );
  }
  if ([filter.min, filter.max].some(supplied))
    return [`${field.label}: choose a value instead of numeric bounds.`];
  if (typeof filter.value !== 'string') return [`${field.label}: choose a text or boolean value.`];
  if (field.type === 'boolean' && !['true', 'false'].includes(filter.value.trim()))
    return [`${field.label}: choose Yes or No.`];
  return [];
}

export function catalogValue(preset: Preset, key: string) {
  return preset.catalog?.attributes?.[key];
}

export function presetValue(preset: Preset, key: string) {
  return catalogValue(preset, key) ?? preset.parameters[key];
}

export function presetChoiceValues(
  preset: Preset,
  key: string,
  defaultValue?: number | string | boolean,
): (number | string | boolean)[] {
  const alternatives = preset.catalog?.attributeOptions?.[key];
  if (alternatives) return alternatives;
  const value = presetValue(preset, key) ?? defaultValue;
  return value === undefined ? [] : [value];
}

export function searchableFields(part: PartDefinition): ParameterDefinition[] {
  const fields = part.catalogSelectionOnly
    ? (part.catalogFilterFields ?? [])
    : [...part.parameters, ...(part.catalogFilterFields ?? [])];
  return fields.filter((field) => field.filterable !== false);
}

export function isPublishedValue(preset: Preset, key: string): boolean {
  return (
    catalogValue(preset, key) !== undefined ||
    !!preset.catalog?.attributeOptions?.[key]?.length ||
    (!!preset.catalog?.verifiedParameters.includes(key) &&
      Object.hasOwn(preset.parameters, key) &&
      preset.parameters[key] !== undefined)
  );
}

/** Discrete source sizes take precedence over a min/max summary of a supplier family. */
export function matchesPresetNumericValue(
  preset: Preset,
  key: string,
  requested: NumericRange,
  defaultValue?: number | string | boolean,
): boolean {
  const choices = preset.catalog?.parameterChoices?.[key];
  if (choices !== undefined)
    return (
      Array.isArray(choices) &&
      choices.length > 0 &&
      choices.every((value) => typeof value === 'number' && Number.isFinite(value)) &&
      choices.some((value) => matchesNumericRange(value, undefined, requested))
    );
  const rawInterval = preset.catalog?.parameterRanges?.[key];
  const interval = readNumericInterval(rawInterval);
  if (rawInterval !== undefined && !interval) return false;
  if (preset.catalog && !interval && !isPublishedValue(preset, key)) return false;
  const value = presetValue(preset, key) ?? defaultValue;
  return matchesNumericRange(typeof value === 'number' ? value : undefined, interval, requested);
}

/** Fixed products keep their identity when only their geometric pose changes. */
export function presetMatchesConfiguration(
  part: PartDefinition,
  preset: Preset,
  parameters: Parameters,
): boolean {
  const identity = part.catalogIdentityParameters?.(parameters, preset) ?? parameters;
  const keys = part.catalogSelectionOnly
    ? (preset.catalog?.verifiedParameters ?? [])
    : [...new Set([...Object.keys(part.defaults), ...Object.keys(preset.parameters)])];
  return (
    keys.length > 0 &&
    keys.every(
      (key) =>
        Object.hasOwn(preset.parameters, key) &&
        Object.hasOwn(identity, key) &&
        preset.parameters[key] === identity[key],
    )
  );
}

export function catalogFilterErrors(
  fields: ParameterDefinition[],
  filters: CatalogModelFilters,
): string[] {
  const errors: string[] = [];
  for (const [key, filter] of Object.entries(filters)) {
    if (![filter.min, filter.max, filter.value].some(supplied)) continue;
    const field = fields.find((field) => field.key === key && field.filterable !== false);
    if (!field) {
      errors.push('This catalog characteristic is unavailable.');
      continue;
    }
    errors.push(...fieldFilterErrors(field, filter));
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
    if (![filter.min, filter.max, filter.value].some(supplied)) return true;
    const field = fields.find((field) => field.key === key && field.filterable !== false)!;
    const value = presetValue(preset, key);
    if (field.type !== 'number')
      return field.type === 'boolean'
        ? isPublishedValue(preset, key) &&
            typeof value === 'boolean' &&
            String(value) === filter.value?.trim()
        : isPublishedValue(preset, key) &&
            presetChoiceValues(preset, key).includes(filter.value?.trim() ?? '');
    return matchesPresetNumericValue(preset, key, parseNumericRange(filter).range);
  });
}

/** Contextual categorical options are actual catalog values plus any unavailable user selection. */
export function catalogFacetOptions(
  presets: readonly Preset[],
  fields: readonly ParameterDefinition[],
  filters: CatalogModelFilters,
  key: string,
  matchesQuery?: (preset: Preset) => boolean,
): { value: string; label: string; count: number }[] {
  const field = fields.find((item) => item.key === key && item.filterable !== false);
  if (!field || field.type === 'number') return [];
  const others = Object.fromEntries(Object.entries(filters).filter(([name]) => name !== key));
  const values = new Map<string, number>();
  for (const preset of presets) {
    if (!isPublishedValue(preset, key)) continue;
    const matches =
      matchesCatalogFilters(preset, [...fields], others) && (!matchesQuery || matchesQuery(preset));
    for (const value of new Set(presetChoiceValues(preset, key))) {
      if (
        (field.type === 'boolean' && typeof value !== 'boolean') ||
        (field.type !== 'boolean' && typeof value !== 'string') ||
        value === ''
      )
        continue;
      const text = String(value);
      if (!values.has(text)) values.set(text, 0);
      if (matches) values.set(text, values.get(text)! + 1);
    }
  }
  const selected = filters[key]?.value?.trim();
  if (selected && !values.has(selected)) values.set(selected, 0);
  return [...values]
    .map(([value, count]) => ({
      value,
      count,
      label:
        field.options?.find((option) => option.value === value)?.label ??
        (field.type === 'boolean' ? (value === 'true' ? 'Yes' : 'No') : value),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
