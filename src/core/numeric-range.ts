export interface NumericRange {
  min?: number;
  max?: number;
}

export interface NumericInterval {
  min: number;
  max: number;
}

export type NumericRangeError = 'invalid-min' | 'invalid-max' | 'reversed';

const blank = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && !value.trim());
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function decimal(value: unknown): number | undefined {
  if (finite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const input = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(input)) return undefined;
  const parsed = Number(input.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** User bounds accept decimal commas and dots; blank bounds stay open. */
export function parseNumericRange(input: { min?: unknown; max?: unknown }): {
  range: NumericRange;
  errors: NumericRangeError[];
} {
  const range: NumericRange = {};
  const errors: NumericRangeError[] = [];
  for (const key of ['min', 'max'] as const) {
    if (blank(input[key])) continue;
    const value = decimal(input[key]);
    if (value === undefined) errors.push(key === 'min' ? 'invalid-min' : 'invalid-max');
    else range[key] = value;
  }
  if (range.min !== undefined && range.max !== undefined && range.min > range.max)
    errors.push('reversed');
  return { range, errors };
}

export function numericRangeErrorMessage(error: NumericRangeError): string {
  return error === 'reversed'
    ? 'Minimum must not exceed maximum.'
    : `Enter a finite decimal ${error === 'invalid-min' ? 'minimum' : 'maximum'}.`;
}

/** Source intervals require two actual finite numbers, without coercing source data. */
export function readNumericInterval(value: unknown): NumericInterval | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const range = value as Record<string, unknown>;
  return finite(range.min) && finite(range.max) && range.min <= range.max
    ? { min: range.min, max: range.max }
    : undefined;
}

/** A scalar or source interval overlaps inclusive requested bounds. Unknown values never match. */
export function matchesNumericRange(
  value: number | undefined,
  interval: NumericInterval | undefined,
  requested: NumericRange,
): boolean {
  if (
    (requested.min !== undefined && !finite(requested.min)) ||
    (requested.max !== undefined && !finite(requested.max)) ||
    (requested.min !== undefined && requested.max !== undefined && requested.min > requested.max)
  )
    return false;
  const actual = interval
    ? readNumericInterval(interval)
    : finite(value)
      ? { min: value, max: value }
      : undefined;
  if (!actual) return false;
  const tolerance = 1e-6;
  return (
    (requested.min === undefined || actual.max >= requested.min - tolerance) &&
    (requested.max === undefined || actual.min <= requested.max + tolerance)
  );
}
