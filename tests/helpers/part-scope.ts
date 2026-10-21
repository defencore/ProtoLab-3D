import { parts } from '../../src/parts';

export type TestPartScope = ReadonlySet<string> | undefined;

/** An omitted scope runs the full suite; an explicit empty scope runs no per-part contracts. */
export function parseTestPartScope(
  value: string | undefined,
  currentIds: readonly string[],
): TestPartScope {
  if (value === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('PROTOLAB_TEST_PARTS must be a JSON array of current part IDs.');
  }
  if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string'))
    throw new Error('PROTOLAB_TEST_PARTS must be a JSON array of current part IDs.');
  const known = new Set(currentIds);
  const unknown = parsed.filter((id: string) => !known.has(id));
  if (unknown.length)
    throw new Error(
      `PROTOLAB_TEST_PARTS contains unknown current part IDs: ${unknown.join(', ')}.`,
    );
  if (new Set(parsed).size !== parsed.length)
    throw new Error('PROTOLAB_TEST_PARTS must not contain duplicate part IDs.');
  return new Set(parsed);
}

/** Filter only independent owner loops; callers retain the complete registry for integration checks. */
export function affectedParts<T extends { id: string }>(definitions: readonly T[]): T[] {
  const scope = parseTestPartScope(
    process.env.PROTOLAB_TEST_PARTS,
    parts.map((part) => part.id),
  );
  return scope === undefined ? [...definitions] : definitions.filter((part) => scope.has(part.id));
}

export function partIsAffected(id: string): boolean {
  if (!parts.some((part) => part.id === id))
    throw new Error(`Part-scoped test refers to an unknown current part ID: ${id}.`);
  return affectedParts([{ id }]).length === 1;
}
