import type {
  DiscoveryCandidate,
  DiscoveryChoices,
  DiscoveryFilters,
  DiscoveryOption,
  DiscoverySuggestion,
  DiscoveryTrait,
} from './discovery-types';
import type { LibrarySearchEntry, LibrarySearchMatch } from './library-search';
import {
  buildPresetIndex,
  compilePresetQuery,
  matchesPresetQuery,
  type PresetQuery,
} from './preset-search';
import { discoveryTraits } from './discovery-traits';
import { matchesNumericRange, parseNumericRange } from './numeric-range';
import { translateSearchQuery } from './search-query';
import { isQualifiedLibraryEntryId } from './library-identity';

export type {
  DiscoveryCandidate,
  DiscoveryChoices,
  DiscoveryFilters,
  DiscoverySuggestion,
} from './discovery-types';

const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[×\u0445]/g, 'x')
    .replace(/ø/gi, '')
    .replace(/[^\p{L}\p{N}.,]+/gu, ' ')
    .trim();
const decimal = '[0-9]+(?:[.,][0-9]+)?';

export function emptyDiscoveryFilters(): DiscoveryFilters {
  return { power: '', bearing: '', widthKind: '', width: { min: '', max: '' } };
}

export function hasDiscoveryFilters(filters: DiscoveryFilters): boolean {
  return !!(
    filters.power ||
    filters.bearing ||
    filters.widthKind ||
    filters.width.min ||
    filters.width.max
  );
}

/** Parse only explicit units and named dimensions; an unlabelled number remains a text query. */
export function parseDiscoveryQuery(query: string) {
  let text = translateSearchQuery(query).normalize('NFKC');
  const width = { min: '', max: '' };
  const widthPattern = new RegExp(
    `\\bwidth\\s*[:=]?\\s*(?:(from|\\u0432\\u0456\\u0434)\\s*)?(<=|>=|<|>|≤|≥|up to|\\u0434\\u043e)?\\s*(${decimal})(?:\\s*(?:-|–|—|to|\\u0434\\u043e)\\s*(${decimal}))?(?:\\s*(?:mm|\\u043c\\u043c))?`,
    'iu',
  );
  const size = widthPattern.exec(text);
  if (size) {
    const bound = size[2];
    if (size[4]) {
      width.min = size[3];
      width.max = size[4];
    } else if (
      bound === '<=' ||
      bound === '<' ||
      bound === '≤' ||
      bound === 'up to' ||
      bound === '\u0434\u043e'
    )
      width.max = size[3];
    else if (size[1] || bound === '>=' || bound === '>' || bound === '≥') width.min = size[3];
    else width.min = width.max = size[3];
    text = text.slice(0, size.index) + ' ' + text.slice(size.index + size[0].length);
  }
  let power = '';
  const voltage = new RegExp(
    `(?:\\b(?:power|supply|voltage)\\s*[:=]?\\s*)?\\b(${decimal})\\s*(?:v|\\u0432)(?![\\p{L}\\p{N}])`,
    'iu',
  ).exec(text);
  if (voltage) {
    power = `${voltage[1].replace(',', '.')} V`;
    text = text.slice(0, voltage.index) + ' ' + text.slice(voltage.index + voltage[0].length);
  } else {
    const cells = /\b(?:power\s*[:=]?\s*)?(\d+)\s*s\b/iu.exec(text);
    if (cells) {
      power = `${cells[1]}S`;
      text = text.slice(0, cells.index) + ' ' + text.slice(cells.index + cells[0].length);
    }
  }
  let bearing = '';
  const bearingMatch = /\bbearings?\s*[:=]?\s*([a-z]{0,6}\d[a-z0-9-]*(?:\s+pair)?)/iu.exec(text);
  if (bearingMatch) {
    bearing = bearingMatch[1];
    text =
      text.slice(0, bearingMatch.index) +
      ' ' +
      text.slice(bearingMatch.index + bearingMatch[0].length);
  }
  text = text
    .replace(/\b(?:with|and)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    text,
    power,
    bearing,
    width,
    hasConstraints: !!(power || bearing || width.min || width.max),
  };
}

export function buildDiscoveryIndex(index: LibrarySearchEntry[]): DiscoveryCandidate[] {
  return index.flatMap(({ family, presets, standoffs }) =>
    (standoffs ? buildPresetIndex(family.members) : presets).map((original) => {
      const { part, preset } = original;
      const execution = part.mechanismExecution;
      const parameters = { ...part.defaults, ...preset.parameters };
      const screws = execution?.screws.filter(
        (screw) =>
          !screw.when ||
          Object.entries(screw.when).every(([key, value]) => parameters[key] === value),
      );
      const entry = execution
        ? {
            ...original,
            searchText: normalize(
              [
                'rotary actuator mechanism motor',
                preset.name,
                execution.construction,
                ...execution.materials,
                ...execution.processes,
                ...screws!.map(
                  (screw) =>
                    `${screw.designation} ${screw.kind} lead ${screw.lead} pitch ${screw.pitch ?? ''} ${screw.starts ?? ''} starts ${screw.starts === 1 ? 'single' : screw.starts === 2 ? 'two' : screw.starts === 4 ? 'four' : ''} start`,
                ),
              ].join(' '),
            ),
          }
        : original;
      return { id: entry.id, family, part, preset, entry, traits: discoveryTraits(part, preset) };
    }),
  );
}

export function discoveryWidthKind(trait: DiscoveryTrait): string {
  return JSON.stringify([trait.key, trait.label]);
}

export function discoveryPowerValue(trait: DiscoveryTrait): string {
  if (trait.range)
    return `${trait.range.min === trait.range.max ? trait.range.min : `${trait.range.min}–${trait.range.max}`}${trait.unit ? (trait.unit === 'S' ? 'S' : ` ${trait.unit}`) : ''}`;
  if (trait.unit === 'S') return `${trait.value}S`;
  return `${trait.value}${trait.unit ? ` ${trait.unit}` : ''}`;
}

function matchesPower(trait: DiscoveryTrait, requested: string): boolean {
  if (trait.kind !== 'power') return false;
  const voltage = new RegExp(`^(${decimal})\\s*v$`, 'i').exec(requested.trim());
  if (voltage && trait.unit === 'V') {
    const value = Number(voltage[1].replace(',', '.'));
    return matchesNumericRange(
      typeof trait.value === 'number' ? trait.value : undefined,
      trait.range,
      { min: value, max: value },
    );
  }
  const cells = /^(\d+)\s*s$/i.exec(requested.trim());
  if (cells) {
    if (trait.unit === 'S')
      return matchesNumericRange(
        typeof trait.value === 'number' ? trait.value : undefined,
        trait.range,
        { min: Number(cells[1]), max: Number(cells[1]) },
      );
    return new RegExp(`(?:^|[^a-z0-9])${cells[1]}\\s*s(?:$|[^a-z0-9])`, 'i').test(
      String(trait.value),
    );
  }
  return (
    normalize(discoveryPowerValue(trait)) === normalize(requested) ||
    normalize(String(trait.value)).split(/\s+/).includes(normalize(requested))
  );
}

function matchesBearing(trait: DiscoveryTrait, requested: string): boolean {
  if (trait.kind !== 'bearing') return false;
  const value = normalize(String(trait.value));
  const requestedValue = normalize(requested);
  return value === requestedValue || value.split(/\s+/).includes(requestedValue);
}

function matchesTypedBearing(trait: DiscoveryTrait, requested: string): boolean {
  if (trait.kind !== 'bearing') return false;
  const value = normalize(String(trait.value));
  const model = normalize(requested).replaceAll(' ', '');
  const models = [...value.matchAll(/\b[a-z]{0,6}\d[a-z0-9]*(?:\s+(?:\d+[a-z]+|zz|rs|z))?/g)].map(
    ([designation]) => designation.replaceAll(' ', ''),
  );
  return (
    matchesBearing(trait, requested) || models.some((designation) => designation.startsWith(model))
  );
}

function matchesWidth(
  trait: DiscoveryTrait,
  filter: DiscoveryFilters['width'],
  kind = '',
): boolean {
  if (trait.kind !== 'width' || (kind && discoveryWidthKind(trait) !== kind)) return false;
  const parsed = parseNumericRange(filter);
  if (parsed.errors.length) return false;
  if (trait.choices)
    return trait.choices.some((value) => matchesNumericRange(value, undefined, parsed.range));
  return matchesNumericRange(
    typeof trait.value === 'number' ? trait.value : undefined,
    trait.range,
    parsed.range,
  );
}

function matchesFilters(candidate: DiscoveryCandidate, filters: DiscoveryFilters): boolean {
  return (
    (!filters.power || candidate.traits.some((trait) => matchesPower(trait, filters.power))) &&
    (!filters.bearing ||
      candidate.traits.some((trait) => matchesBearing(trait, filters.bearing))) &&
    (!(filters.widthKind || filters.width.min || filters.width.max) ||
      candidate.traits.some((trait) => matchesWidth(trait, filters.width, filters.widthKind)))
  );
}

function matchesText(candidate: DiscoveryCandidate, text: string, query: PresetQuery): boolean {
  if (!text.trim()) return true;
  if (matchesPresetQuery(candidate.entry, query)) return true;
  if (isQualifiedLibraryEntryId(query.libraryId)) return false;
  if (query.metricSize) return false;
  const facts = normalize(
    candidate.traits
      .map((trait) => `${trait.kind} ${trait.label} ${trait.value} ${trait.unit ?? ''}`)
      .join(' '),
  );
  const combined = `${candidate.entry.searchText} ${facts}`;
  return query.tokens.every((token) => {
    const words = normalize(token).split(/\s+/);
    return words.every((word) => {
      if (/^\d+(?:[.,]\d+)?$/.test(word)) return combined.split(/\s+/).includes(word);
      // Completion of a bearing model is useful before its full designation is known.
      if (
        /^[a-z]*\d[a-z0-9]*$/i.test(word) &&
        word.length >= 3 &&
        candidate.traits.some(
          (trait) =>
            trait.kind === 'bearing' &&
            normalize(String(trait.value))
              .split(/\s+/)
              .some((value) => value.startsWith(word)),
        )
      )
        return true;
      return combined.includes(word);
    });
  });
}

export function filterDiscoveryCandidates(
  index: readonly DiscoveryCandidate[],
  query: string,
  filters: DiscoveryFilters,
): DiscoveryCandidate[] {
  const reference = query.trim();
  const exact = index.find(
    (candidate) => candidate.id === reference || candidate.part.id === reference,
  );
  if (exact)
    return index.filter(
      (candidate) =>
        candidate.part.id === exact.part.id &&
        (reference === exact.part.id || candidate.id === reference) &&
        matchesFilters(candidate, filters),
    );
  if (index.some((candidate) => reference.startsWith(`${candidate.part.id}:`))) return [];
  const parsed = parseDiscoveryQuery(query);
  const textQuery = compilePresetQuery(parsed.text);
  const inferred = {
    ...emptyDiscoveryFilters(),
    power: parsed.power,
    bearing: '',
    width: parsed.width,
  };
  const manualWidth = parseNumericRange(filters.width);
  const queryWidth = parseNumericRange(parsed.width);
  if (manualWidth.errors.length || queryWidth.errors.length) return [];
  const lower = Math.max(manualWidth.range.min ?? -Infinity, queryWidth.range.min ?? -Infinity);
  const upper = Math.min(manualWidth.range.max ?? Infinity, queryWidth.range.max ?? Infinity);
  if (lower > upper) return [];
  const width = {
    min: Number.isFinite(lower) ? String(lower) : '',
    max: Number.isFinite(upper) ? String(upper) : '',
  };
  return index.filter(
    (candidate) =>
      matchesFilters(candidate, filters) &&
      matchesFilters(candidate, inferred) &&
      (!parsed.bearing ||
        candidate.traits.some((trait) => matchesTypedBearing(trait, parsed.bearing))) &&
      (!(filters.widthKind || width.min || width.max) ||
        candidate.traits.some((trait) => matchesWidth(trait, width, filters.widthKind))) &&
      matchesText(candidate, parsed.text, textQuery),
  );
}

function sortedOptions(
  values: Map<string, { label: string; count: number }>,
  selected: string,
): DiscoveryOption[] {
  if (selected && !values.has(selected)) values.set(selected, { label: selected, count: 0 });
  return [...values]
    .map(([value, item]) => ({ value, ...item }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en', { numeric: true }));
}

export function discoveryChoices(
  index: readonly DiscoveryCandidate[],
  query: string,
  filters: DiscoveryFilters,
): DiscoveryChoices {
  const power = new Map<string, { label: string; count: number }>();
  const bearing = new Map<string, { label: string; count: number }>();
  const widthKind = new Map<string, { label: string; count: number }>();
  const add = (map: typeof power, value: string, label = value) => {
    if (!map.has(value)) map.set(value, { label, count: 0 });
  };
  for (const candidate of index)
    for (const trait of candidate.traits) {
      if (trait.kind === 'power') add(power, discoveryPowerValue(trait));
      if (trait.kind === 'bearing') add(bearing, String(trait.value));
      if (trait.kind === 'width') add(widthKind, discoveryWidthKind(trait), trait.label);
    }
  const powerCandidates = filterDiscoveryCandidates(index, query, { ...filters, power: '' });
  for (const [value, item] of power)
    item.count = powerCandidates.filter((candidate) =>
      candidate.traits.some((trait) => matchesPower(trait, value)),
    ).length;
  for (const candidate of filterDiscoveryCandidates(index, query, { ...filters, bearing: '' }))
    for (const value of new Set(
      candidate.traits
        .filter((trait) => trait.kind === 'bearing')
        .map((trait) => String(trait.value)),
    ))
      if (bearing.has(value)) bearing.get(value)!.count++;
  for (const candidate of filterDiscoveryCandidates(index, query, { ...filters, widthKind: '' }))
    for (const value of new Set(
      candidate.traits
        .filter((trait) => matchesWidth(trait, filters.width))
        .map(discoveryWidthKind),
    ))
      if (widthKind.has(value)) widthKind.get(value)!.count++;
  return {
    power: sortedOptions(power, filters.power),
    bearing: sortedOptions(bearing, filters.bearing),
    widthKind: sortedOptions(widthKind, filters.widthKind),
  };
}

export function discoveryFamilyMatches(
  candidates: readonly DiscoveryCandidate[],
  query: string,
): LibrarySearchMatch[] {
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (seen.has(candidate.family.id)) return [];
    seen.add(candidate.family.id);
    return [{ family: candidate.family, articleQuery: query }];
  });
}

function relaxationSuggestions(
  index: readonly DiscoveryCandidate[],
  query: string,
  filters: DiscoveryFilters,
): DiscoverySuggestion[] {
  const parsed = parseDiscoveryQuery(query);
  if (
    !(parsed.hasConstraints || hasDiscoveryFilters(filters)) ||
    filterDiscoveryCandidates(index, query, filters).length
  )
    return [];
  return (['power', 'bearing', 'width'] as const).flatMap((kind) => {
    const present =
      kind === 'power'
        ? filters.power || parsed.power
        : kind === 'bearing'
          ? filters.bearing || parsed.bearing
          : filters.widthKind ||
            filters.width.min ||
            filters.width.max ||
            parsed.width.min ||
            parsed.width.max;
    if (!present) return [];
    const patch =
      kind === 'power'
        ? { power: '' }
        : kind === 'bearing'
          ? { bearing: '' }
          : { widthKind: '', width: { min: '', max: '' } };
    const widthQuery =
      parsed.width.min && parsed.width.max
        ? `width ${parsed.width.min}–${parsed.width.max}`
        : parsed.width.min
          ? `width >= ${parsed.width.min}`
          : parsed.width.max
            ? `width <= ${parsed.width.max}`
            : '';
    const remaining = [
      parsed.text,
      kind !== 'power' ? parsed.power : '',
      kind !== 'bearing' && parsed.bearing ? `bearing ${parsed.bearing}` : '',
      kind !== 'width' ? widthQuery : '',
    ]
      .filter(Boolean)
      .join(' ');
    const count = filterDiscoveryCandidates(index, remaining, { ...filters, ...patch }).length;
    return count
      ? [
          {
            id: `relax:${kind}`,
            kind,
            label: `Try without ${kind}`,
            detail: 'Keep the other characteristics',
            count,
            filters: patch,
            query: remaining,
          },
        ]
      : [];
  });
}

/** Complete the unfinished characteristic while retaining every other word and constraint. */
export function discoverySuggestions(
  index: readonly DiscoveryCandidate[],
  query: string,
  filters: DiscoveryFilters,
  limit = 6,
): DiscoverySuggestion[] {
  const raw = query.trim();
  const relaxations = relaxationSuggestions(index, query, filters);
  if (!raw) return relaxations.slice(0, limit);
  const translated = translateSearchQuery(raw);
  const parts = translated.split(/\s+/);
  const fragment = parts.at(-1) ?? '';
  const partialIntent =
    fragment.length >= 3
      ? (
          [
            [
              'power',
              [
                'power',
                'supply',
                'voltage',
                '\u0436\u0438\u0432\u043b\u0435\u043d\u043d\u044f',
                '\u043d\u0430\u043f\u0440\u0443\u0433\u0430',
              ],
            ],
            ['bearing', ['bearing', '\u043f\u0456\u0434\u0448\u0438\u043f\u043d\u0438\u043a']],
            ['width', ['width', '\u0448\u0438\u0440\u0438\u043d\u0430']],
          ] as const
        ).find(([, words]) => words.some((word) => word.startsWith(fragment.toLowerCase())))?.[0]
      : undefined;
  const lastCue = [...translated.matchAll(/\b(power|supply|voltage|bearings?|width)\b/gi)]
    .at(-1)?.[1]
    .toLowerCase();
  let intent =
    partialIntent ??
    (lastCue === 'width'
      ? 'width'
      : lastCue?.startsWith('bearing')
        ? 'bearing'
        : lastCue
          ? 'power'
          : undefined);
  const onlyIntent = /^(?:power|supply|voltage|bearings?|width)$/i.test(fragment);
  const prefix = onlyIntent || partialIntent ? '' : normalize(fragment).replaceAll(' ', '');
  const remaining = parts
    .slice(0, -1)
    .join(' ')
    .replace(/\b(?:power|supply|voltage|bearings?|width)\s*$/i, '')
    .trim();
  const base = filterDiscoveryCandidates(index, remaining, filters);
  if (
    /^[a-z]+\d/i.test(fragment) &&
    base.some((candidate) => candidate.traits.some((trait) => matchesTypedBearing(trait, fragment)))
  )
    intent = 'bearing';
  const suggestions = new Map<string, DiscoverySuggestion>();
  for (const candidate of base) {
    const counted = new Set<string>();
    for (const trait of candidate.traits) {
      if (intent && trait.kind !== intent) continue;
      if (trait.kind === 'width' && typeof trait.value !== 'number' && !trait.choices?.length)
        continue;
      const values = trait.kind === 'width' ? (trait.choices ?? [trait.value]) : [trait.value];
      for (const rawValue of values) {
        const value =
          trait.kind === 'power'
            ? discoveryPowerValue(trait)
            : trait.kind === 'width'
              ? `${rawValue} mm`
              : String(rawValue);
        const normalized = normalize(value).replaceAll(' ', '');
        if (
          prefix &&
          !normalized.startsWith(prefix) &&
          !normalize(value)
            .split(/\s+/)
            .some((word) => word.startsWith(prefix))
        )
          continue;
        const id = `${trait.kind}:${trait.kind === 'width' ? discoveryWidthKind(trait) : ''}:${value}`;
        if (counted.has(id)) continue;
        counted.add(id);
        const previous = suggestions.get(id);
        if (previous) previous.count++;
        else
          suggestions.set(id, {
            id,
            kind: trait.kind,
            label: value,
            detail:
              trait.kind === 'power'
                ? 'Power / input supply'
                : trait.kind === 'bearing'
                  ? 'Bearing'
                  : trait.label,
            count: 1,
            query: remaining,
            filters:
              trait.kind === 'power'
                ? { power: value }
                : trait.kind === 'bearing'
                  ? { bearing: value }
                  : {
                      widthKind: discoveryWidthKind(trait),
                      width: { min: String(rawValue), max: String(rawValue) },
                    },
          });
      }
    }
  }
  const completions = [...suggestions.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en', { numeric: true }))
    .slice(0, limit);
  return completions.length ? completions : relaxations.slice(0, limit);
}
