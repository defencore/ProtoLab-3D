import { translateSearchQuery } from './search-query';
import { presetLabels } from './library-labels';
import type { ParameterDefinition, Parameters, PartDefinition, Preset } from './types';
import {
  isPublishedValue,
  presetValue,
  searchableFields,
  fieldFilterErrors,
} from './catalog-models';
import { matchingPreset } from './preset-resolution';
import {
  matchesNumericRange,
  parseNumericRange,
  readNumericInterval,
  type NumericRange,
} from './numeric-range';

export interface PresetEntry {
  id: string;
  part: PartDefinition;
  preset: Preset;
  searchText: string;
  compactName: string;
}

export interface PresetFilterField extends ParameterDefinition {
  id: string;
  primary: boolean;
  partIds: string[];
}

export interface ParameterFilter {
  min?: string;
  max?: string;
  value?: string;
}

export interface PresetFilters {
  query: string;
  category: string;
  /** A physical library ID or a declared browse-family ID; configuration identity stays physical. */
  partId: string;
  manufacturer: string;
  sourceName: string;
  kind: 'all' | 'catalog' | 'examples';
  parameters: Record<string, ParameterFilter>;
}

export interface PresetFilterError {
  fieldId: string;
  message: string;
}

export interface PresetQuery {
  normalizedText: string;
  tokens: string[];
  metricSize?: { diameter: number; length: number };
}

const commonKeys = [
  'bore',
  'outer',
  'width',
  'diameter',
  'length',
  'height',
  'thickness',
  'head',
  'drive',
  'tip',
  'pitch',
  'threadSpan',
  'handedness',
  'module',
  'teeth',
];
const normalized = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .trim();

/** Keep a metric diameter/length phrase coherent instead of satisfying its numbers from SKUs. */
export function compilePresetQuery(query: string): PresetQuery {
  query = translateSearchQuery(query);
  const size =
    /(^|\s)m(\d+(?:[.,]\d+)?)\s*(?:[x×]\s*|\s+)(\d+(?:[.,]\d+)?)(?![\p{L}\p{N}.,])/iu.exec(query);
  const remaining = size
    ? query.slice(0, size.index) + ' ' + query.slice(size.index + size[0].length)
    : query;
  return {
    normalizedText: normalized(query),
    tokens: remaining.split(/\s+/).map(normalized).filter(Boolean),
    ...(size
      ? {
          metricSize: {
            diameter: parseNumericRange({ min: size[2] }).range.min!,
            length: parseNumericRange({ min: size[3] }).range.min!,
          },
        }
      : {}),
  };
}

function matchesMetricSize(
  entry: PresetEntry,
  size: NonNullable<PresetQuery['metricSize']>,
): boolean {
  const { part, preset } = entry;
  const fields = searchableFields(part);
  const designation = `M${size.diameter}`;
  const sourceLabels = [
    preset.catalog?.attributes?.threadLabel,
    preset.catalog?.attributes?.catalogThreadA,
    preset.catalog?.attributes?.catalogThreadB,
  ]
    .filter((value): value is string => typeof value === 'string')
    .flatMap((value) => value.split(/\s*\/\s*/));
  const metricFields =
    part.catalogSelection?.filter((item) => item.format === 'metric-thread') ?? [];
  const threadMatches =
    sourceLabels.some((label) => label.toUpperCase() === designation.toUpperCase()) ||
    metricFields.some(({ key }) => {
      const value = presetValue(preset, key);
      return (
        (!preset.catalog || isPublishedValue(preset, key)) &&
        typeof value === 'number' &&
        matchesNumericRange(value, undefined, { min: size.diameter, max: size.diameter })
      );
    });
  if (!threadMatches) return false;
  const lengthField =
    fields.find((field) => field.key === 'catalogBodyLength') ??
    fields.find((field) => field.key === 'length' && (field.unit ?? 'mm') === 'mm');
  if (!lengthField) return false;
  const range = getPresetParameterRange(preset, lengthField.key);
  if (preset.catalog?.parameterRanges?.[lengthField.key] !== undefined && !range) return false;
  if (preset.catalog && !range && !isPublishedValue(preset, lengthField.key)) return false;
  const value = presetValue(preset, lengthField.key);
  return matchesNumericRange(typeof value === 'number' ? value : undefined, range, {
    min: size.length,
    max: size.length,
  });
}

export function matchesPresetQuery(entry: PresetEntry, query: PresetQuery): boolean {
  // A published identifier remains searchable even when it includes an undocumented size.
  const designation = entry.preset.catalog?.designation;
  if (designation && normalized(designation) === query.normalizedText) return true;
  if (query.metricSize && !matchesMetricSize(entry, query.metricSize)) return false;
  return query.tokens.every((token) => {
    if (
      entry.preset.catalog?.productCodes?.some(
        (code) => normalized(code) === token || normalized(code).replaceAll(' ', '') === token,
      )
    )
      return true;
    if (/^m\d+(?:\.\d+)?$/.test(token))
      return new RegExp(`\\b${token.replace('.', '\\.')}(?=[^\\d.]|$)`).test(entry.searchText);
    return /^\d+(?:\.\d+)?$/.test(token)
      ? entry.searchText.split(/\s+/).includes(token)
      : entry.searchText.includes(token) || entry.compactName.includes(token);
  });
}

export function fieldId(field: ParameterDefinition): string {
  return JSON.stringify([
    field.key,
    field.type,
    field.type === 'number' ? (field.unit ?? 'mm') : '',
  ]);
}

export function emptyPresetFilters(part?: PartDefinition): PresetFilters {
  return {
    query: '',
    category: part?.category ?? '',
    partId: part?.browseFamily?.id ?? part?.id ?? '',
    manufacturer: '',
    sourceName: '',
    kind: 'all',
    parameters: {},
  };
}

export function matchesPresetPartScope(part: PartDefinition, partId: string): boolean {
  return !partId || part.id === partId || part.browseFamily?.id === partId;
}

export function buildPresetIndex(parts: PartDefinition[]): PresetEntry[] {
  return parts.flatMap((part) =>
    part.presets.map((preset) => {
      const catalog = preset.catalog;
      const labels = presetLabels(preset);
      const values = searchableFields(part).flatMap((definition) => {
        const catalogField = part.catalogFilterFields?.some(
          (field) => field.key === definition.key,
        );
        const value = catalogField
          ? catalog?.attributes?.[definition.key]
          : preset.parameters[definition.key];
        if (value === undefined) return [];
        return [
          definition.options?.find((option) => option.value === value)?.label ?? String(value),
        ];
      });
      return {
        id: `${part.id}:${preset.id}`,
        part,
        preset,
        searchText: normalized(
          [
            // Fixed catalog family labels locate navigation entries, not every article.
            // An article must establish its own actuator, interface and supplier terminology.
            ...(part.catalogSelectionOnly
              ? []
              : [
                  part.name,
                  part.category,
                  part.subgroup,
                  ...part.keywords.filter((keyword) => !/\d/.test(keyword)),
                ]),
            labels.name,
            preset.description,
            labels.designation ?? '',
            catalog?.manufacturer ?? '',
            catalog?.standard ?? '',
            catalog?.sourceName ?? '',
            ...(catalog?.productCodes ?? []),
            ...values,
          ].join(' '),
        ),
        compactName: normalized(`${labels.name} ${labels.designation ?? ''}`).replaceAll(' ', ''),
      };
    }),
  );
}

export function getFilterFields(parts: PartDefinition[]): PresetFilterField[] {
  const fields = new Map<string, PresetFilterField>();
  for (const part of parts) {
    const primaryKeys = part.presetMatchKeys ?? commonKeys;
    for (const field of searchableFields(part)) {
      if (field.filterable === false) continue;
      const id = fieldId(field);
      const previous = fields.get(id);
      if (previous) {
        previous.partIds.push(part.id);
        previous.primary ||= primaryKeys.includes(field.key) || field.type !== 'number';
        if (field.options) {
          previous.options = [
            ...new Map(
              [...(previous.options ?? []), ...field.options].map((option) => [
                option.value,
                option,
              ]),
            ).values(),
          ];
        }
      } else {
        fields.set(id, {
          ...field,
          id,
          primary: primaryKeys.includes(field.key) || field.type !== 'number',
          partIds: [part.id],
          options: field.options ? [...field.options] : undefined,
        });
      }
    }
  }
  return [...fields.values()].sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      (commonKeys.indexOf(a.key) < 0 ? 100 : commonKeys.indexOf(a.key)) -
        (commonKeys.indexOf(b.key) < 0 ? 100 : commonKeys.indexOf(b.key)),
  );
}

export function seedCurrentFilters(part: PartDefinition, parameters: Parameters): PresetFilters {
  const filters = emptyPresetFilters(part);
  const catalogPresets = part.presets.filter((preset) => preset.catalog);
  const currentPreset = matchingPreset(
    { ...part, presets: catalogPresets },
    parameters,
    catalogPresets.find((preset) => preset.parameters === parameters)?.id,
  );
  if (part.catalogSelectionOnly && currentPreset)
    filters.query = currentPreset.catalog?.designation ?? currentPreset.name;
  const keys =
    part.presetMatchKeys ??
    part.parameters
      .filter((field) => commonKeys.includes(field.key))
      .slice(0, 4)
      .map((field) => field.key);
  for (const field of searchableFields(part)) {
    if (field.filterable === false) continue;
    if (
      !keys.includes(field.key) ||
      (field.visibleWhen &&
        !part.catalogFilterFields?.some((item) => item.key === field.key) &&
        !field.visibleWhen(parameters))
    )
      continue;
    // An exact catalog configuration also contains editable prototype dimensions.
    // Do not turn those assumptions into automatic catalog requirements.
    if (
      currentPreset?.catalog &&
      !isPublishedValue(currentPreset, field.key) &&
      !getPresetParameterRange(currentPreset, field.key)
    )
      continue;
    const value =
      currentPreset && part.catalogFilterFields?.some((item) => item.key === field.key)
        ? presetValue(currentPreset, field.key)
        : parameters[field.key];
    if (field.type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      filters.parameters[fieldId(field)] = { min: String(value), max: String(value) };
    } else if (field.type === 'select' && typeof value === 'string') {
      filters.parameters[fieldId(field)] = { value };
    } else if (field.type === 'boolean' && typeof value === 'boolean') {
      filters.parameters[fieldId(field)] = { value: String(value) };
    }
  }
  return filters;
}

export function isActiveParameterFilter(filter: ParameterFilter): boolean {
  return [filter.min, filter.max, filter.value].some(
    (value) => value !== undefined && (typeof value !== 'string' || value.trim() !== ''),
  );
}

/** A source interval describes available sizes, independently of the preset's chosen value. */
export function getPresetParameterRange(preset: Preset, key: string) {
  return readNumericInterval(preset.catalog?.parameterRanges?.[key]);
}

export function formatPresetRange(
  field: ParameterDefinition,
  range: { min: number; max: number },
): string {
  return `${range.min}–${range.max}${field.unit === '' ? '' : ` ${field.unit ?? 'mm'}`}`;
}

export function filterPresets(
  index: PresetEntry[],
  filters: PresetFilters,
): {
  items: PresetEntry[];
  errors: PresetFilterError[];
} {
  const errors: PresetFilterError[] = [];
  const scope = [...new Map(index.map((entry) => [entry.part.id, entry.part])).values()].filter(
    (part) =>
      (!filters.category || part.category === filters.category) &&
      matchesPresetPartScope(part, filters.partId),
  );
  const fields = getFilterFields(scope);
  const definitions = new Map(fields.map((field) => [field.id, field]));
  const active = Object.entries(filters.parameters).filter(([, filter]) =>
    isActiveParameterFilter(filter),
  );
  const numeric = new Map<string, NumericRange>();
  for (const [id, filter] of active) {
    const field = definitions.get(id);
    if (!field) {
      errors.push({
        fieldId: id,
        message: 'This parameter is unavailable for the selected library.',
      });
    } else {
      if (field.type === 'number') numeric.set(id, parseNumericRange(filter).range);
      for (const message of fieldFilterErrors(field, filter)) errors.push({ fieldId: id, message });
    }
  }
  if (errors.length) return { items: [], errors };
  // Keep compound designations and supplier codes together instead of matching unrelated fragments.
  const query = compilePresetQuery(filters.query);
  return {
    errors,
    items: index.filter((entry) => {
      const { part, preset } = entry;
      const catalog = preset.catalog;
      if (!matchesPresetPartScope(part, filters.partId)) return false;
      if (filters.category && part.category !== filters.category) return false;
      if (filters.manufacturer && catalog?.manufacturer !== filters.manufacturer) return false;
      if (filters.sourceName && catalog?.sourceName !== filters.sourceName) return false;
      if (filters.kind === 'catalog' && !catalog) return false;
      if (filters.kind === 'examples' && catalog) return false;
      if (!matchesPresetQuery(entry, query)) return false;
      return active.every(([id, filter]) => {
        const field = searchableFields(part).find(
          (candidate) => candidate.filterable !== false && fieldId(candidate) === id,
        );
        if (!field) return false;
        const values = { ...part.defaults, ...preset.parameters };
        if (
          field.visibleWhen &&
          !part.catalogFilterFields?.some((item) => item.key === field.key) &&
          !field.visibleWhen(values)
        )
          return false;
        const value = presetValue(preset, field.key) ?? values[field.key];
        if (field.type === 'number') {
          const range = getPresetParameterRange(preset, field.key);
          if (catalog?.parameterRanges?.[field.key] !== undefined && !range) return false;
          if (catalog && !range && !isPublishedValue(preset, field.key)) return false;
          return matchesNumericRange(
            typeof value === 'number' ? value : undefined,
            range,
            numeric.get(id)!,
          );
        }
        if (!filter.value?.trim()) return true;
        if (catalog && !isPublishedValue(preset, field.key)) return false;
        const selected = filter.value.trim();
        return field.type === 'boolean'
          ? typeof value === 'boolean' && String(value) === selected
          : typeof value === 'string' && value === selected;
      });
    }),
  };
}

/** Counts preserve query/scope/other choices and include a selected unavailable value explicitly. */
export function presetFacetOptions(
  index: readonly PresetEntry[],
  filters: PresetFilters,
  field: PresetFilterField,
): { value: string; label: string; count: number }[] {
  if (field.type === 'number' || field.filterable === false) return [];
  const others = {
    ...filters,
    parameters: Object.fromEntries(
      Object.entries(filters.parameters).filter(([id]) => id !== field.id),
    ),
  };
  const matches = new Set(filterPresets([...index], others).items.map((entry) => entry.id));
  const options = new Map<string, number>();
  for (const entry of index) {
    if (
      (filters.category && entry.part.category !== filters.category) ||
      !matchesPresetPartScope(entry.part, filters.partId)
    )
      continue;
    const definition = searchableFields(entry.part).find((item) => fieldId(item) === field.id);
    if (!definition) continue;
    const catalogField = entry.part.catalogFilterFields?.some(
      (item) => item.key === definition.key,
    );
    if (
      !catalogField &&
      definition.visibleWhen &&
      !definition.visibleWhen({ ...entry.part.defaults, ...entry.preset.parameters })
    )
      continue;
    if (entry.preset.catalog && !isPublishedValue(entry.preset, definition.key)) continue;
    const value = presetValue(entry.preset, definition.key);
    if (
      (field.type === 'boolean' && typeof value !== 'boolean') ||
      (field.type !== 'boolean' && typeof value !== 'string') ||
      value === ''
    )
      continue;
    const text = String(value);
    if (!options.has(text)) options.set(text, 0);
    if (matches.has(entry.id)) options.set(text, options.get(text)! + 1);
  }
  const selected = filters.parameters[field.id]?.value?.trim();
  if (selected && !options.has(selected)) options.set(selected, 0);
  return [...options]
    .map(([value, count]) => ({
      value,
      count,
      label:
        field.options?.find((option) => option.value === value)?.label ??
        (field.type === 'boolean' ? (value === 'true' ? 'Yes' : 'No') : value),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function formatPresetValue(
  field: ParameterDefinition,
  value: number | string | boolean | undefined,
): string {
  if (value === undefined) return 'Not published';
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'select')
    return field.options?.find((option) => option.value === value)?.label ?? String(value);
  return `${value}${field.unit === '' ? '' : ` ${field.unit ?? 'mm'}`}`;
}
