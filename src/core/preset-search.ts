import type { ParameterDefinition, Parameters, PartDefinition, Preset } from './types';

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
    partId: part?.id ?? '',
    manufacturer: '',
    sourceName: '',
    kind: 'all',
    parameters: {},
  };
}

export function buildPresetIndex(parts: PartDefinition[]): PresetEntry[] {
  return parts.flatMap((part) =>
    part.presets.map((preset) => {
      const catalog = preset.catalog;
      const values = Object.entries(preset.parameters).flatMap(([key, value]) => {
        const definition = part.parameters.find((field) => field.key === key);
        if (definition?.filterable === false) return [];
        return [
          definition?.options?.find((option) => option.value === value)?.label ?? String(value),
        ];
      });
      return {
        id: `${part.id}:${preset.id}`,
        part,
        preset,
        searchText: normalized(
          [
            part.name,
            part.category,
            part.subgroup,
            ...part.keywords.filter((keyword) => !/\d/.test(keyword)),
            preset.name,
            preset.description,
            catalog?.designation ?? '',
            catalog?.manufacturer ?? '',
            catalog?.standard ?? '',
            catalog?.sourceName ?? '',
            ...(catalog?.productCodes ?? []),
            ...values,
          ].join(' '),
        ),
        compactName: normalized(`${preset.name} ${catalog?.designation ?? ''}`).replaceAll(' ', ''),
      };
    }),
  );
}

export function getFilterFields(parts: PartDefinition[]): PresetFilterField[] {
  const fields = new Map<string, PresetFilterField>();
  for (const part of parts) {
    const primaryKeys = part.presetMatchKeys ?? commonKeys;
    for (const field of part.parameters) {
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
  const currentPreset =
    part.presets.find((preset) => preset.catalog && preset.parameters === parameters) ??
    part.presets.find(
      (preset) =>
        preset.catalog &&
        part.parameters.every((field) => preset.parameters[field.key] === parameters[field.key]),
    );
  const keys =
    part.presetMatchKeys ??
    part.parameters
      .filter((field) => commonKeys.includes(field.key))
      .slice(0, 4)
      .map((field) => field.key);
  for (const field of part.parameters) {
    if (field.filterable === false) continue;
    if (!keys.includes(field.key) || (field.visibleWhen && !field.visibleWhen(parameters)))
      continue;
    // An exact catalog configuration also contains editable prototype dimensions.
    // Do not turn those assumptions into automatic catalog requirements.
    if (
      currentPreset?.catalog &&
      field.type === 'number' &&
      !currentPreset.catalog.verifiedParameters.includes(field.key) &&
      !getPresetParameterRange(currentPreset, field.key)
    )
      continue;
    const value = parameters[field.key];
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
    (value) => value !== undefined && value.trim() !== '',
  );
}

/** A source interval describes available sizes, independently of the preset's chosen value. */
export function getPresetParameterRange(preset: Preset, key: string) {
  const range = preset.catalog?.parameterRanges?.[key];
  return range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max
    ? range
    : undefined;
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
  const fields = getFilterFields([
    ...new Map(index.map((entry) => [entry.part.id, entry.part])).values(),
  ]);
  const definitions = new Map(fields.map((field) => [field.id, field]));
  const active = Object.entries(filters.parameters).filter(([, filter]) =>
    isActiveParameterFilter(filter),
  );
  for (const [id, filter] of active) {
    const field = definitions.get(id);
    if (!field) {
      errors.push({
        fieldId: id,
        message: 'This parameter is unavailable for the selected library.',
      });
    } else if (field.type === 'number') {
      const min = filter.min?.trim() ? Number(filter.min) : undefined;
      const max = filter.max?.trim() ? Number(filter.max) : undefined;
      if (
        (min !== undefined && !Number.isFinite(min)) ||
        (max !== undefined && !Number.isFinite(max))
      ) {
        errors.push({ fieldId: id, message: `${field.label}: enter finite numbers.` });
      } else if (min !== undefined && max !== undefined && min > max) {
        errors.push({
          fieldId: id,
          message: `${field.label}: From must be less than or equal to To.`,
        });
      }
    }
  }
  if (errors.length) return { items: [], errors };
  // Keep compound designations and supplier codes together instead of matching unrelated fragments.
  const queryTokens = filters.query.split(/\s+/).map(normalized).filter(Boolean);
  return {
    errors,
    items: index.filter((entry) => {
      const { part, preset } = entry;
      const catalog = preset.catalog;
      if (filters.partId && part.id !== filters.partId) return false;
      if (filters.category && part.category !== filters.category) return false;
      if (filters.manufacturer && catalog?.manufacturer !== filters.manufacturer) return false;
      if (filters.sourceName && catalog?.sourceName !== filters.sourceName) return false;
      if (filters.kind === 'catalog' && !catalog) return false;
      if (filters.kind === 'examples' && catalog) return false;
      if (
        !queryTokens.every(
          (token) => entry.searchText.includes(token) || entry.compactName.includes(token),
        )
      )
        return false;
      return active.every(([id, filter]) => {
        const field = part.parameters.find(
          (candidate) => candidate.filterable !== false && fieldId(candidate) === id,
        );
        if (!field) return false;
        const values = { ...part.defaults, ...preset.parameters };
        if (field.visibleWhen && !field.visibleWhen(values)) return false;
        const value = values[field.key];
        if (field.type === 'number') {
          if (typeof value !== 'number' || !Number.isFinite(value)) return false;
          const range = getPresetParameterRange(preset, field.key);
          if (catalog?.parameterRanges?.[field.key] && !range) return false;
          if (catalog && !range && !catalog.verifiedParameters.includes(field.key)) return false;
          const min = filter.min?.trim() ? Number(filter.min) : undefined;
          const max = filter.max?.trim() ? Number(filter.max) : undefined;
          const tolerance = 1e-6;
          // A requested value or interval matches any overlapping source size interval.
          return (
            (min === undefined || (range?.max ?? value) >= min - tolerance) &&
            (max === undefined || (range?.min ?? value) <= max + tolerance)
          );
        }
        if (!filter.value?.trim()) return true;
        return field.type === 'boolean'
          ? typeof value === 'boolean' && String(value) === filter.value
          : typeof value === 'string' && value === filter.value;
      });
    }),
  };
}

export function formatPresetValue(
  field: ParameterDefinition,
  value: number | string | boolean,
): string {
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'select')
    return field.options?.find((option) => option.value === value)?.label ?? String(value);
  return `${value}${field.unit === '' ? '' : ` ${field.unit ?? 'mm'}`}`;
}
