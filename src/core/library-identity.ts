import type { PartDefinition, Preset } from './types';

/** Local source IDs retain their spelling; ':' separates the physical package from its model. */
export function isValidPresetId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    value !== 'custom' &&
    !/[:\p{Cc}]/u.test(value)
  );
}

export function libraryEntryId(partId: string, presetId?: string): string {
  return presetId === undefined ? partId : `${partId}:${presetId}`;
}

/** Resolve physical definitions directly, independently of names and navigation groups. */
export function resolveLibraryEntry(
  parts: readonly PartDefinition[],
  id: string,
): { part: PartDefinition; preset?: Preset } | undefined {
  const reference = id.trim();
  const separator = reference.indexOf(':');
  const partId = separator < 0 ? reference : reference.slice(0, separator);
  const part = parts.find((item) => item.id === partId);
  if (!part) return undefined;
  if (separator < 0) return { part };
  const preset = part.presets.find((item) => item.id === reference.slice(separator + 1));
  return preset ? { part, preset } : undefined;
}

/** Recognize qualified references before interpreting supplier text or dimensions. */
export function isQualifiedLibraryEntryId(id: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*:/.test(id.trim());
}
