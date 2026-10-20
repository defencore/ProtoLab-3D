import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export interface NativeAuditRecord {
  status: string;
  geometrySourceHash: string;
  sourceHash: string;
}

export interface CurrentNativeEvidence {
  geometrySourceHash: string;
  sourcePath: string;
  /** Expected case input from the current model, excluding resumption-only paths. */
  input: Record<string, unknown>;
  cad?: { path: string; fileHash: string };
  /** Direct-geometry runners must contain the current generated geometry verbatim. */
  geometrySource?: string;
}

const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

/** A later failed generation may leave an older CAD checkpoint. Never attach its audit to that CAD. */
export function matchingCheckpointAudit(
  record: NativeAuditRecord | undefined,
  geometrySourceHash: string,
  sourcePath: string,
): { source: string; sourceHash: string; input: Record<string, unknown> } | undefined {
  if (record?.geometrySourceHash !== geometrySourceHash) return undefined;
  try {
    const source = readFileSync(sourcePath, 'utf8');
    if (hash(source) !== record.sourceHash) return undefined;
    const match = /^data\s*=\s*json\.loads\((.+)\)$/m.exec(source);
    if (!match) return undefined;
    const input = JSON.parse(JSON.parse(match[1]));
    return input.geometrySourceHash === geometrySourceHash
      ? { source, sourceHash: record.sourceHash, input }
      : undefined;
  } catch {
    return undefined;
  }
}

/** A passed record alone is insufficient: its executed source and CAD must still exist. */
export function hasCurrentNativeEvidence(
  record: NativeAuditRecord,
  evidence: CurrentNativeEvidence,
): boolean {
  if (record.status !== 'passed' || record.geometrySourceHash !== evidence.geometrySourceHash)
    return false;
  try {
    const source = readFileSync(evidence.sourcePath, 'utf8');
    if (hash(source) !== record.sourceHash) return false;
    const match = /^data\s*=\s*json\.loads\((.+)\)$/m.exec(source);
    if (!match) return false;
    const input = JSON.parse(JSON.parse(match[1]));
    if (
      Object.entries(evidence.input).some(
        ([key, value]) => JSON.stringify(input[key]) !== JSON.stringify(value),
      )
    )
      return false;
    if (evidence.geometrySource && !source.includes(evidence.geometrySource)) return false;
    if (evidence.cad && hash(readFileSync(evidence.cad.path)) !== evidence.cad.fileHash)
      return false;
    return true;
  } catch {
    // Missing/unreadable evidence cannot represent a current accepted result.
    return false;
  }
}

/** Keep only the latest, still-current accepted result for each unselected case. */
export function preserveUnselectedNativeResults<T extends NativeAuditRecord>(
  previous: { runtimeSignature?: string; results?: T[] } | undefined,
  runtimeSignature: string,
  selected: ReadonlySet<string>,
  key: (record: T) => string,
  evidence: (record: T) => CurrentNativeEvidence | undefined,
): T[] {
  if (previous?.runtimeSignature !== runtimeSignature || !Array.isArray(previous.results))
    return [];
  const latest = new Map<string, T>();
  for (const record of previous.results) latest.set(key(record), record);
  return [...latest].flatMap(([id, record]) => {
    if (selected.has(id) || record.status !== 'passed') return [];
    const current = evidence(record);
    return current && hasCurrentNativeEvidence(record, current) ? [record] : [];
  });
}
