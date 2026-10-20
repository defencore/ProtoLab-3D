import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  hasCurrentNativeEvidence,
  matchingCheckpointAudit,
  preserveUnselectedNativeResults,
  type CurrentNativeEvidence,
  type NativeAuditRecord,
} from '../scripts/cnc-native-report';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
interface Record extends NativeAuditRecord {
  mode: string;
  spindle?: string;
}

function fixture(t: test.TestContext, key: string, mode: string, spindle?: string) {
  const directory = mkdtempSync(join(tmpdir(), 'cnc-native-report-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const geometry = 'shape = exact_current_component_geometry()\n';
  const input = {
    ids: ['frame', 'carriage'],
    configuration: { spindle, mode },
    geometrySourceHash: sha(geometry),
  };
  const source = geometry + `data = json.loads(${JSON.stringify(JSON.stringify(input))})\n`;
  const sourcePath = join(directory, key + '.py'),
    cadPath = join(directory, key + '.FCStd');
  writeFileSync(sourcePath, source);
  writeFileSync(cadPath, 'exact saved CAD fixture');
  const record: Record = {
    mode,
    ...(spindle ? { spindle } : {}),
    status: 'passed',
    geometrySourceHash: sha(geometry),
    sourceHash: sha(source),
  };
  const evidence: CurrentNativeEvidence = {
    geometrySourceHash: sha(geometry),
    sourcePath,
    input,
    cad: { path: cadPath, fileHash: sha('exact saved CAD fixture') },
  };
  return { record, evidence, geometry, sourcePath, cadPath };
}

test('a failed newer generation cannot be attached to an older retained CAD checkpoint', (t) => {
  const older = fixture(t, 'older-full', 'full');
  assert.ok(
    matchingCheckpointAudit(older.record, older.record.geometrySourceHash, older.sourcePath),
  );
  const failedGeneration = {
    ...older.record,
    status: 'failed',
    geometrySourceHash: sha('new invalid shaft'),
  };
  assert.equal(
    matchingCheckpointAudit(failedGeneration, older.record.geometrySourceHash, older.sourcePath),
    undefined,
  );
  writeFileSync(older.sourcePath, 'overwritten by a later attempted audit');
  assert.equal(
    matchingCheckpointAudit(older.record, older.record.geometrySourceHash, older.sourcePath),
    undefined,
  );
});

test('scoped Full publication preserves the unchanged accepted Simple evidence only', (t) => {
  const simple = fixture(t, 'simple', 'simple'),
    full = fixture(t, 'full', 'full');
  const byMode = new Map([
    ['simple', simple.evidence],
    ['full', full.evidence],
  ]);
  const result = preserveUnselectedNativeResults(
    { runtimeSignature: 'runtime-A', results: [simple.record, full.record] },
    'runtime-A',
    new Set(['full']),
    (r) => r.mode,
    (r) => byMode.get(r.mode),
  );
  assert.deepEqual(result, [simple.record]);
  const newFull = { ...full.record, status: 'failed' };
  assert.deepEqual(
    [...result, newFull].map((r) => [r.mode, r.status]),
    [
      ['simple', 'passed'],
      ['full', 'failed'],
    ],
  );
  assert.deepEqual(
    preserveUnselectedNativeResults(
      { runtimeSignature: 'runtime-A', results: [simple.record, full.record] },
      'runtime-A',
      new Set(['simple', 'full']),
      (r) => r.mode,
      (r) => byMode.get(r.mode),
    ),
    [],
  );
});

test('retained evidence is invalidated when current raw geometry or runtime changes', (t) => {
  const one = fixture(t, 'simple', 'simple');
  const previous = { runtimeSignature: 'runtime-A', results: [one.record] };
  assert.deepEqual(
    preserveUnselectedNativeResults(
      previous,
      'runtime-B',
      new Set(['full']),
      (r) => r.mode,
      () => one.evidence,
    ),
    [],
  );
  assert.equal(
    hasCurrentNativeEvidence(one.record, {
      ...one.evidence,
      geometrySourceHash: sha('changed geometry'),
    }),
    false,
  );
});

test('exact stored audit-source bytes are required even if reported hashes and CAD agree', (t) => {
  const one = fixture(t, 'simple', 'simple');
  assert.equal(hasCurrentNativeEvidence(one.record, one.evidence), true);
  writeFileSync(one.sourcePath, 'changed executable Python');
  assert.equal(hasCurrentNativeEvidence(one.record, one.evidence), false);
  rmSync(one.sourcePath);
  assert.equal(hasCurrentNativeEvidence(one.record, one.evidence), false);
});

test('CAD checksum changes or missing saved CAD invalidate an accepted record', (t) => {
  const one = fixture(t, 'simple', 'simple');
  writeFileSync(one.cadPath, 'modified CAD fixture');
  assert.equal(hasCurrentNativeEvidence(one.record, one.evidence), false);
  rmSync(one.cadPath);
  assert.equal(hasCurrentNativeEvidence(one.record, one.evidence), false);
});

test('executed audit input must match the current occurrence identities and configuration', (t) => {
  const one = fixture(t, 'simple', 'simple');
  assert.equal(
    hasCurrentNativeEvidence(one.record, {
      ...one.evidence,
      input: { ...one.evidence.input, ids: ['frame', 'different carriage'] },
    }),
    false,
  );
  assert.equal(
    hasCurrentNativeEvidence(one.record, {
      ...one.evidence,
      input: { ...one.evidence.input, configuration: { mode: 'simple', toolProjection: 50 } },
    }),
    false,
  );
});

test('latest failed evidence supersedes an older passed record rather than resurrecting it', (t) => {
  const one = fixture(t, 'simple', 'simple');
  assert.deepEqual(
    preserveUnselectedNativeResults(
      { runtimeSignature: 'runtime-A', results: [one.record, { ...one.record, status: 'failed' }] },
      'runtime-A',
      new Set(['full']),
      (r) => r.mode,
      () => one.evidence,
    ),
    [],
  );
});

test('workspace case keys retain other spindle/mode results and verify direct generated geometry', (t) => {
  const a = fixture(t, 'default-simple', 'simple', 'default'),
    b = fixture(t, 'other-simple', 'simple', 'other'),
    full = fixture(t, 'default-full', 'full', 'default');
  const key = (r: Record) => `${r.spindle}:${r.mode}`;
  const direct = { ...b.evidence, cad: undefined, geometrySource: b.geometry };
  const evidence = new Map([
    [key(a.record), a.evidence],
    [key(b.record), direct],
    [key(full.record), full.evidence],
  ]);
  assert.deepEqual(
    preserveUnselectedNativeResults(
      { runtimeSignature: 'runtime-A', results: [a.record, b.record, full.record] },
      'runtime-A',
      new Set(['default:full']),
      key,
      (r) => evidence.get(key(r)),
    ),
    [a.record, b.record],
  );
  assert.equal(
    hasCurrentNativeEvidence(b.record, { ...direct, geometrySource: 'different native geometry' }),
    false,
  );
});
