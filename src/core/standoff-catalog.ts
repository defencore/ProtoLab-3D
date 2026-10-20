import type { Parameters, PartDefinition, Preset } from './types';
import { validateParameters } from './validation';
import {
  parseNumericRange,
  numericRangeErrorMessage,
  readNumericInterval,
  matchesNumericRange,
} from './numeric-range';

export const STANDOFF_PART_IDS = [
  'spacer',
  'pcb-standoff',
  'pcb-standoff-insert',
  'dremec-spacer-sleeve',
] as const;
export type StandoffSelectKey =
  | 'connection'
  | 'thread'
  | 'threadA'
  | 'threadB'
  | 'construction'
  | 'bodyForm'
  | 'material'
  | 'coating'
  | 'supplier';
export type StandoffNumericKey = 'bodyLength' | 'bodyWidth' | 'overallLength' | 'bore';
export type StandoffEvidence = 'published' | 'derived' | 'qualified' | 'design' | 'unpublished';
export interface StandoffRange {
  min: number;
  max: number;
}
export interface StandoffRangeInput {
  min?: string | number;
  max?: string | number;
}
export interface StandoffFilters {
  query?: string;
  values?: Partial<Record<StandoffSelectKey, string>>;
  bodyLength?: StandoffRangeInput;
  bodyWidth?: StandoffRangeInput;
  overallLength?: StandoffRangeInput;
  bore?: StandoffRangeInput;
}
export interface StandoffCatalogEntry {
  id: string;
  part: PartDefinition;
  preset: Preset;
  connection: string;
  construction: string;
  threads: string[];
  threadA?: string;
  threadB?: string;
  bodyForm: string;
  material: string;
  coating: string;
  supplier: string;
  bodyLength: number;
  bodyWidth: number;
  overallLength?: number;
  bore?: number;
  ranges: Partial<Record<StandoffNumericKey, StandoffRange>>;
  evidence: Partial<Record<StandoffSelectKey | StandoffNumericKey, StandoffEvidence>>;
  notes: string[];
}
export interface StandoffTemplateChoice {
  id: string;
  partId: string;
  sourceIdentity: string;
  immutableParameters: Readonly<Parameters>;
}

function templateSourceIdentity(entry: StandoffCatalogEntry): string {
  const catalog = entry.preset.catalog;
  return JSON.stringify({
    presetId: entry.preset.id,
    sourceUrl: catalog?.sourceUrl,
    manufacturer: catalog?.manufacturer,
    designation: catalog?.designation,
    productCodes: catalog?.productCodes,
    sourceSha256: catalog?.geometryEvidence?.sourceSha256,
    materialGrade: catalog?.specifications?.find((row) => row.label === 'Material grade')?.value,
    finish: catalog?.specifications?.find((row) => row.label === 'Finish')?.value,
  });
}

/** Capture only an explicit editable-template choice; this does not create a stocked SKU. */
export function captureStandoffTemplate(
  entry: StandoffCatalogEntry,
): StandoffTemplateChoice | undefined {
  if (entry.part.catalogSelectionOnly) return undefined;
  const immutableParameters: Parameters = {};
  for (const key of ['material', 'catalogItem', 'sourceModel'])
    if (entry.preset.parameters[key] !== undefined)
      immutableParameters[key] = entry.preset.parameters[key];
  return {
    id: entry.id,
    partId: entry.part.id,
    sourceIdentity: templateSourceIdentity(entry),
    immutableParameters,
  };
}

/** The app's reserved custom selection retains only an explicitly chosen same-source/material template. */
export function resolveStandoffPreviewEntry(
  entries: StandoffCatalogEntry[],
  currentPartId: string,
  presetId: string,
  currentParameters?: Parameters,
  choice?: StandoffTemplateChoice,
): StandoffCatalogEntry | undefined {
  if (presetId !== 'custom')
    return entries.find((entry) => entry.part.id === currentPartId && entry.preset.id === presetId);
  if (!choice || !currentParameters || choice.partId !== currentPartId) return undefined;
  const entry = entries.find((entry) => entry.id === choice.id && entry.part.id === currentPartId);
  if (
    !entry ||
    entry.part.catalogSelectionOnly ||
    templateSourceIdentity(entry) !== choice.sourceIdentity
  )
    return undefined;
  return Object.entries(choice.immutableParameters).every(
    ([key, value]) => currentParameters[key] === value,
  )
    ? entry
    : undefined;
}
export interface StandoffFilterError {
  field: StandoffSelectKey | StandoffNumericKey;
  message: string;
}
export interface StandoffFacetOption {
  value: string;
  label: string;
  count: number;
}
export interface StandoffBodyLengthOption {
  value: number;
  label: string;
  count: number;
  publishedCount: number;
  qualifiedCount: number;
  evidence: 'published' | 'qualified';
}
export interface StandoffBodyLengthState {
  mode: 'catalog' | 'range';
  catalog?: StandoffRangeInput;
  range?: StandoffRangeInput;
}

export function rememberStandoffBodyLength(
  state: StandoffBodyLengthState,
  value?: StandoffRangeInput,
): StandoffBodyLengthState {
  return { ...state, [state.mode]: value ? { ...value } : undefined };
}

/** Switching editors remembers raw ranges and never chooses a first or invented catalogue size. */
export function changeStandoffBodyLengthMode(
  state: StandoffBodyLengthState,
  mode: StandoffBodyLengthState['mode'],
  options: StandoffBodyLengthOption[],
): StandoffBodyLengthState {
  if (state.mode === mode) return state;
  const next = { ...state, mode };
  if (next[mode] === undefined) {
    const current = state[state.mode];
    if (mode === 'range') next.range = current ? { ...current } : undefined;
    else if (current) {
      const parsed = parseFilters({ bodyLength: current });
      const range = parsed.ranges.bodyLength;
      if (
        !parsed.errors.length &&
        range?.min !== undefined &&
        range.min === range.max &&
        options.some((option) => option.value === range.min)
      )
        next.catalog = { min: range.min, max: range.min };
    }
  }
  return next;
}
export interface StandoffFilterField {
  key: StandoffSelectKey | StandoffNumericKey;
  label: string;
  type: 'select' | 'number';
  unit?: string;
}
export const standoffFilterFields: readonly StandoffFilterField[] = [
  { key: 'connection', label: 'End connection', type: 'select' },
  { key: 'thread', label: 'Thread (either end)', type: 'select' },
  { key: 'bodyLength', label: 'Body length', type: 'number', unit: 'mm' },
  { key: 'bodyForm', label: 'Body form', type: 'select' },
  { key: 'material', label: 'Material', type: 'select' },
  { key: 'coating', label: 'Coating / finish', type: 'select' },
  { key: 'construction', label: 'Construction', type: 'select' },
  { key: 'supplier', label: 'Supplier', type: 'select' },
  { key: 'threadA', label: 'End 1 thread', type: 'select' },
  { key: 'threadB', label: 'End 2 thread', type: 'select' },
  { key: 'overallLength', label: 'Overall length', type: 'number', unit: 'mm' },
  { key: 'bodyWidth', label: 'Body diameter / across flats', type: 'number', unit: 'mm' },
  { key: 'bore', label: 'Plain through bore', type: 'number', unit: 'mm' },
];
const selectKeys = standoffFilterFields
  .filter((field) => field.type === 'select')
  .map((field) => field.key as StandoffSelectKey);
const numericKeys: StandoffNumericKey[] = ['bodyLength', 'bodyWidth', 'overallLength', 'bore'];

export function isStandoffPart(part: Pick<PartDefinition, 'id'>): boolean {
  return (STANDOFF_PART_IDS as readonly string[]).includes(part.id);
}
const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
function sourceEvidence(preset: Preset, parameter: string, attribute?: string): StandoffEvidence {
  if (!preset.catalog) return 'design';
  if (attribute && preset.catalog.attributes?.[attribute] !== undefined) return 'published';
  return preset.catalog.verifiedParameters.includes(parameter) ? 'published' : 'qualified';
}
function sourceRange(preset: Preset, key: string): StandoffRange | undefined {
  const range = readNumericInterval(preset.catalog?.parameterRanges?.[key]);
  return range && range.min >= 0 ? range : undefined;
}

/** A browsing projection never writes inferred values into the supplier record. */
export function buildStandoffCatalog(parts: PartDefinition[]): StandoffCatalogEntry[] {
  return parts.filter(isStandoffPart).flatMap((part) =>
    part.presets.map((preset) => {
      const p = preset.parameters;
      const a = preset.catalog?.attributes ?? {};
      const plain = part.id === 'spacer' || part.id === 'dremec-spacer-sleeve';
      const custom = part.id === 'dremec-spacer-sleeve';
      const bodyLength = number(a.catalogBodyLength) ?? number(p.bodyLength ?? p.length);
      const bodyWidth = number(a.catalogBodyWidth) ?? number(p.bodyWidth ?? p.outerDiameter);
      if (bodyLength === undefined || bodyWidth === undefined)
        throw new Error(`${part.id}/${preset.id}: standoff body dimensions are unavailable.`);
      const endA = plain ? 'plain' : text(p.endA);
      const endB = plain ? 'plain' : text(p.endB);
      const connection = plain ? 'plain' : (text(a.endForm) ?? `${endA}/${endB}`);
      const bodyForm = text(a.bodyForm) ?? (plain ? 'round' : text(p.profile)) ?? 'unspecified';
      const threadA =
        endA === 'plain' ? undefined : (text(a.catalogThreadA) ?? text(p.threadDesignationA));
      const threadB =
        endB === 'plain' ? undefined : (text(a.catalogThreadB) ?? text(p.threadDesignationB));
      const threads = [...new Set([threadA, threadB].filter((value): value is string => !!value))];
      const construction = custom
        ? 'custom-sleeve'
        : plain
          ? 'plain-spacer'
          : part.id === 'pcb-standoff-insert'
            ? 'metal-insert'
            : 'single-piece';
      const material = text(a.material) ?? (custom ? text(p.material) : undefined) ?? 'unspecified';
      const customFinish = custom
        ? text(preset.catalog?.specifications?.find((row) => row.label === 'Finish')?.value)
        : undefined;
      const coating = text(a.coating) ?? customFinish ?? 'unspecified';
      const supplier =
        text(a.supplier) ??
        (custom ? text(preset.catalog?.sourceName) : undefined) ??
        'unspecified';
      const evidence: StandoffCatalogEntry['evidence'] = {
        connection: plain
          ? preset.catalog
            ? 'published'
            : 'design'
          : sourceEvidence(preset, 'endA', 'endForm'),
        construction: preset.catalog ? 'published' : 'design',
        bodyForm: plain
          ? preset.catalog
            ? 'published'
            : 'design'
          : sourceEvidence(preset, 'profile', 'bodyForm'),
        material:
          material === 'unspecified'
            ? 'unpublished'
            : sourceEvidence(preset, 'material', 'material'),
        coating: coating === 'unspecified' ? 'unpublished' : 'published',
        supplier: supplier === 'unspecified' ? 'unpublished' : 'published',
        bodyLength: sourceEvidence(preset, plain ? 'length' : 'bodyLength', 'catalogBodyLength'),
        bodyWidth: sourceEvidence(
          preset,
          plain ? 'outerDiameter' : 'bodyWidth',
          'catalogBodyWidth',
        ),
        threadA: threadA
          ? sourceEvidence(preset, 'threadDesignationA', 'catalogThreadA')
          : 'unpublished',
        threadB: threadB
          ? sourceEvidence(preset, 'threadDesignationB', 'catalogThreadB')
          : 'unpublished',
      };
      if (custom) {
        for (const [field, parameter] of [
          ['bodyLength', 'length'],
          ['bodyWidth', 'outerDiameter'],
        ] as const)
          if (!preset.catalog?.verifiedParameters.includes(parameter)) evidence[field] = 'design';
      }
      if (
        !plain &&
        !a.endForm &&
        preset.catalog &&
        !preset.catalog.verifiedParameters.includes('endB')
      )
        evidence.connection = 'qualified';
      evidence.thread = threads.length
        ? evidence.threadA === 'published' && evidence.threadB === 'published'
          ? 'published'
          : preset.catalog
            ? 'qualified'
            : 'design'
        : 'unpublished';
      const ranges: StandoffCatalogEntry['ranges'] = {};
      const lengthRange = sourceRange(preset, plain ? 'length' : 'bodyLength');
      const widthRange = sourceRange(preset, plain ? 'outerDiameter' : 'bodyWidth');
      if (lengthRange) ranges.bodyLength = lengthRange;
      if (widthRange) ranges.bodyWidth = widthRange;
      const bore = plain ? number(p.bore) : undefined;
      evidence.bore = bore === undefined ? 'unpublished' : sourceEvidence(preset, 'bore');
      let overallLength = number(a.catalogOverallLength);
      if (overallLength !== undefined) evidence.overallLength = 'published';
      else if (plain) {
        overallLength = bodyLength;
        evidence.overallLength = evidence.bodyLength;
        if (lengthRange) ranges.overallLength = lengthRange;
      } else {
        const knownBody =
          !preset.catalog ||
          preset.catalog.verifiedParameters.includes('bodyLength') ||
          a.catalogBodyLength !== undefined;
        const knownStuds = ['A', 'B'].every(
          (side) =>
            p[`end${side}`] !== 'male' ||
            ((number(p[`maleLength${side}`]) ?? 0) > 0 &&
              (number(p[`maleEnvelopeLength${side}`]) ?? 0) === 0 &&
              (!preset.catalog || preset.catalog.verifiedParameters.includes(`maleLength${side}`))),
        );
        if (knownBody && knownStuds) {
          overallLength = bodyLength + (number(p.maleLengthA) ?? 0) + (number(p.maleLengthB) ?? 0);
          evidence.overallLength = preset.catalog ? 'derived' : 'design';
        } else evidence.overallLength = 'unpublished';
      }
      const notes: string[] = [];
      if (!preset.catalog) notes.push('Editable design example; no supplier catalogue identity.');
      if (custom)
        notes.push(
          'Custom-order dimensions within manufacturer ranges; no stock SKU or availability is asserted.',
        );
      if (evidence.bodyLength === 'qualified')
        notes.push(
          `Body length ${bodyLength} mm is a qualified designation envelope, not a resolved supplier dimension.`,
        );
      if (evidence.bodyForm === 'qualified')
        notes.push('Body form is inferred from the commercial designation.');
      if (evidence.connection === 'qualified')
        notes.push('End combination includes a commercial-designation inference.');
      if (overallLength === undefined)
        notes.push(
          'Overall length is unpublished; illustrative stud envelopes are excluded from fit dimensions.',
        );
      if (construction === 'metal-insert')
        notes.push(
          'Polymer body with metal inserts; unpublished hidden insert dimensions are not asserted.',
        );
      if (preset.catalog?.attributeConditions?.material)
        notes.push(preset.catalog.attributeConditions.material);
      return {
        id: `${part.id}:${preset.id}`,
        part,
        preset,
        connection,
        construction,
        threads,
        threadA,
        threadB,
        bodyForm,
        material,
        coating,
        supplier,
        bodyLength,
        bodyWidth,
        overallLength,
        bore,
        ranges,
        evidence,
        notes,
      };
    }),
  );
}

const labels: Record<string, string> = {
  'female/female': 'Female / female',
  'female/male': 'Female / male',
  'male/male': 'Male / male',
  plain: 'Plain through bore',
  round: 'Round',
  hex: 'Hexagonal',
  'single-piece': 'One-piece standoff',
  'metal-insert': 'Polymer with metal insert',
  'plain-spacer': 'Editable plain spacer',
  'custom-sleeve': 'Supplier custom sleeve',
  brass: 'Brass',
  steel: 'Steel',
  aluminium: 'Aluminium',
  'stainless-steel': 'Stainless steel',
  polyamide: 'Polyamide',
  'polyamide-brass': 'Polyamide + brass inserts',
  'nickel-plated': 'Nickel plated',
  'zinc-plated': 'Zinc plated',
  'self-finish': 'Self finish',
  black: 'Black',
  blackened: 'Blackened',
  unspecified: 'Not specified',
};
export function standoffFacetLabel(key: StandoffSelectKey, value: string): string {
  if (['thread', 'threadA', 'threadB'].includes(key) && value === 'UNC4-40') return '#4-40 UNC';
  return labels[value] ?? value;
}
const normalized = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1.')
    .replace(/[×*]/g, 'x');
const compact = (value: string) => normalized(value).replace(/[^\p{L}\p{N}.]/gu, '');
const canonicalThread = (value: string) => compact(value).replace(/^4-?40$/, 'unc440');
function queryTokens(query: string): string[] {
  return normalized(query)
    .replace(/[^\p{L}\p{N}.#-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => !!token && !['x', 'mm', '\u043c\u043c'].includes(token))
    .flatMap((token) => {
      const separatedSize = /^x(\d+(?:\.\d+)?)(?:mm|\u043c\u043c)?$/.exec(token);
      if (separatedSize) return [separatedSize[1]];
      const separatedThread = /^((?:m|st)\d+(?:\.\d+)?|(?:unc|unf)\d+-\d+)x$/.exec(token);
      if (separatedThread) return [separatedThread[1]];
      const size = /^(\d+(?:\.\d+)?)(?:mm|\u043c\u043c)$/.exec(token);
      if (size) return [size[1]];
      const pair =
        /^((?:m|st)\d+(?:\.\d+)?|(?:unc|unf)\d+-\d+)x(\d+(?:\.\d+)?)(?:mm|\u043c\u043c)?$/.exec(
          token,
        );
      return pair ? [pair[1], pair[2]] : [token];
    });
}
interface ParsedFilters {
  ranges: Partial<Record<StandoffNumericKey, { min?: number; max?: number }>>;
  errors: StandoffFilterError[];
  tokens: string[];
}
function parseFilters(filters: StandoffFilters): ParsedFilters {
  const ranges: ParsedFilters['ranges'] = {},
    errors: StandoffFilterError[] = [];
  for (const key of numericKeys) {
    const filter = filters[key];
    if (!filter) continue;
    const parsed = parseNumericRange(filter);
    const label = standoffFilterFields.find((field) => field.key === key)!.label;
    for (const error of parsed.errors)
      errors.push({ field: key, message: `${label}: ${numericRangeErrorMessage(error)}` });
    if ((parsed.range.min ?? 0) < 0 || (parsed.range.max ?? 0) < 0)
      errors.push({ field: key, message: `${label}: enter nonnegative dimensions.` });
    if (parsed.range.min !== undefined || parsed.range.max !== undefined)
      ranges[key] = parsed.range;
  }
  return { ranges, errors, tokens: queryTokens(filters.query ?? '') };
}
function facetValues(entry: StandoffCatalogEntry, key: StandoffSelectKey): string[] {
  return key === 'thread' ? entry.threads : entry[key] === undefined ? [] : [entry[key]!];
}
function matchesQuery(entry: StandoffCatalogEntry, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const words = [
    entry.connection,
    entry.construction,
    entry.bodyForm,
    entry.material,
    entry.supplier,
    ...entry.threads,
    entry.preset.name,
    entry.preset.catalog?.designation ?? '',
    entry.preset.catalog?.manufacturer ?? '',
    ...(entry.preset.catalog?.productCodes ?? []),
    ...selectKeys.flatMap((key) =>
      facetValues(entry, key).map((value) => standoffFacetLabel(key, value)),
    ),
  ];
  const searchable = normalized(words.join(' ')),
    codes = [
      entry.preset.name,
      entry.preset.catalog?.designation ?? '',
      ...(entry.preset.catalog?.productCodes ?? []),
    ].map(compact);
  return tokens.every((token) => {
    if (/^\d+(?:\.\d+)?$/.test(token))
      return matchesNumericRange(entry.bodyLength, entry.ranges.bodyLength, {
        min: Number(token),
        max: Number(token),
      });
    if (/^(?:m|st)\d+(?:\.\d+)?$/.test(token) || /^(?:(?:unc|unf))?#?\d+-\d+$/.test(token))
      return entry.threads.some((thread) => canonicalThread(thread) === canonicalThread(token));
    const alias = token === 'socket' ? 'female' : token === 'stud' ? 'male' : token;
    if (alias === 'female' || alias === 'male') return entry.connection.split('/').includes(alias);
    return searchable.includes(alias) || codes.some((code) => code.includes(compact(token)));
  });
}

/** Fixed supplier items retain every parameter. Editable requests are validated before preview. */
export function suggestedStandoffParameters(
  entry: StandoffCatalogEntry,
  filters: StandoffFilters,
): { parameters: Parameters; errors: string[] } {
  const parsed = parseFilters(filters);
  const parameters = { ...entry.preset.parameters };
  if (parsed.errors.length)
    return { parameters, errors: parsed.errors.map((error) => error.message) };
  const editable =
    entry.construction === 'custom-sleeve' ||
    (entry.construction === 'plain-spacer' && filters.values?.construction === 'plain-spacer');
  if (editable) {
    const requested = { ...parsed.ranges };
    const lengths = parsed.tokens.filter((token) => /^\d+(?:\.\d+)?$/.test(token)).map(Number);
    if (lengths.length) {
      if (!lengths.every((value) => value === lengths[0]))
        return { parameters, errors: ['Search specifies conflicting body lengths.'] };
      if (
        (requested.bodyLength?.min !== undefined && lengths[0] < requested.bodyLength.min) ||
        (requested.bodyLength?.max !== undefined && lengths[0] > requested.bodyLength.max)
      )
        return {
          parameters,
          errors: ['Search body length does not match the requested interval.'],
        };
      requested.bodyLength = { min: lengths[0], max: lengths[0] };
    }
    if (requested.overallLength) {
      const body = requested.bodyLength;
      const min = Math.max(body?.min ?? 0, requested.overallLength.min ?? 0);
      const max = Math.min(body?.max ?? Infinity, requested.overallLength.max ?? Infinity);
      if (min > max)
        return {
          parameters,
          errors: ['Plain sleeve body length and overall length requests do not overlap.'],
        };
      requested.bodyLength = { min, max: Number.isFinite(max) ? max : undefined };
    }
    for (const [key, parameter] of [
      ['bodyLength', 'length'],
      ['bodyWidth', 'outerDiameter'],
      ['bore', 'bore'],
    ] as const) {
      const range = requested[key];
      if (!range) continue;
      const current = number(parameters[parameter])!;
      parameters[parameter] =
        range.min !== undefined && current < range.min
          ? range.min
          : range.max !== undefined && current > range.max
            ? range.max
            : current;
    }
  }
  return { parameters, errors: validateParameters(entry.part, parameters, 'default') };
}

/** A prospective customer-order row is selected only when its real configuration matches the preview. */
export function standoffConfigurationMatches(
  entry: StandoffCatalogEntry,
  candidate: Parameters,
  current: Parameters,
): boolean {
  return Object.keys(entry.preset.parameters).every((key) => candidate[key] === current[key]);
}

export function filterStandoffs(
  entries: StandoffCatalogEntry[],
  filters: StandoffFilters = {},
): { items: StandoffCatalogEntry[]; errors: StandoffFilterError[] } {
  const parsed = parseFilters(filters);
  if (parsed.errors.length) return { items: [], errors: parsed.errors };
  return {
    errors: [],
    items: entries.filter((entry) => {
      if (
        !selectKeys.every(
          (key) => !filters.values?.[key] || facetValues(entry, key).includes(filters.values[key]!),
        )
      )
        return false;
      const custom = entry.construction === 'custom-sleeve';
      const editablePlain =
        entry.construction === 'plain-spacer' && filters.values?.construction === 'plain-spacer';
      const designLength = entry.part.parameters.find((field) => field.key === 'length');
      const designRange =
        editablePlain && designLength?.min !== undefined && designLength.max !== undefined
          ? { min: designLength.min, max: designLength.max }
          : undefined;
      if (
        !matchesQuery(entry, parsed.tokens) &&
        !(
          designRange &&
          matchesQuery({ ...entry, ranges: { bodyLength: designRange } }, parsed.tokens)
        )
      )
        return false;
      for (const key of numericKeys) {
        const range = parsed.ranges[key];
        if (!range) continue;
        if ((key === 'bore' && custom) || editablePlain) continue;
        if (!matchesNumericRange(entry[key], entry.ranges[key], range)) return false;
      }
      return (
        (!custom && !editablePlain) ||
        suggestedStandoffParameters(entry, filters).errors.length === 0
      );
    }),
  };
}

/** Each option is counted with its own selected facet removed; zero-count selections remain visible. */
export function standoffFacetCounts(
  entries: StandoffCatalogEntry[],
  filters: StandoffFilters = {},
): Record<StandoffSelectKey, StandoffFacetOption[]> {
  return Object.fromEntries(
    selectKeys.map((key) => {
      const scoped = filterStandoffs(entries, {
        ...filters,
        values: { ...filters.values, [key]: '' },
      }).items;
      const counts = new Map<string, number>();
      for (const entry of scoped)
        for (const value of facetValues(entry, key))
          counts.set(value, (counts.get(value) ?? 0) + 1);
      const values = new Set(entries.flatMap((entry) => facetValues(entry, key)));
      if (filters.values?.[key]) values.add(filters.values[key]!);
      return [
        key,
        [...values]
          .map((value) => ({
            value,
            label: standoffFacetLabel(key, value),
            count: counts.get(value) ?? 0,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
      ];
    }),
  ) as Record<StandoffSelectKey, StandoffFacetOption[]>;
}

/** Fixed catalogue sizes, counted without their own length filter; customer-order ranges stay ranges. */
export function standoffBodyLengthOptions(
  entries: StandoffCatalogEntry[],
  filters: StandoffFilters = {},
): StandoffBodyLengthOption[] {
  const catalogEntries = entries.filter(
    (entry) =>
      entry.part.catalogSelectionOnly &&
      entry.preset.catalog &&
      entry.construction !== 'custom-sleeve' &&
      !entry.ranges.bodyLength &&
      (entry.evidence.bodyLength === 'published' || entry.evidence.bodyLength === 'qualified'),
  );
  const scoped = filterStandoffs(catalogEntries, { ...filters, bodyLength: undefined }).items;
  const sizes = new Map<
    number,
    { published: boolean; publishedCount: number; qualifiedCount: number }
  >();
  for (const entry of catalogEntries) {
    const size = sizes.get(entry.bodyLength) ?? {
      published: false,
      publishedCount: 0,
      qualifiedCount: 0,
    };
    size.published ||= entry.evidence.bodyLength === 'published';
    sizes.set(entry.bodyLength, size);
  }
  for (const entry of scoped) {
    const size = sizes.get(entry.bodyLength)!;
    if (entry.evidence.bodyLength === 'published') size.publishedCount++;
    else size.qualifiedCount++;
  }
  return [...sizes]
    .sort(([a], [b]) => a - b)
    .map(([value, size]) => {
      const count = size.publishedCount + size.qualifiedCount;
      const evidence = count
        ? size.publishedCount
          ? 'published'
          : 'qualified'
        : size.published
          ? 'published'
          : 'qualified';
      const qualification =
        evidence === 'qualified'
          ? ' (designation; verify)'
          : size.qualifiedCount
            ? ' (includes qualified designations)'
            : '';
      return {
        value,
        label: `${value} mm${qualification}`,
        count,
        publishedCount: size.publishedCount,
        qualifiedCount: size.qualifiedCount,
        evidence,
      };
    });
}
