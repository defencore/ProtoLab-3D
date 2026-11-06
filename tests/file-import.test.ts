import assert from 'node:assert/strict';
import test from 'node:test';
import { createFileImporter } from '../src/core/file-import';

function delayedFile() {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const text = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { file: { size: 1, text: () => text }, resolve, reject };
}

function importTarget() {
  const values: unknown[] = [];
  const errors: unknown[] = [];
  const options = {
    maxBytes: 100_000,
    sizeMessage: 'Choose a parameters file smaller than 100 KB.',
    parse: (text: string): unknown => JSON.parse(text),
    apply: (value: unknown) => {
      values.push(value);
    },
    reportError: (error: unknown) => {
      errors.push(error);
    },
  };
  return { options, values, errors };
}

test('a later parameter file wins over older successes and failures', async () => {
  const importer = createFileImporter();
  const target = importTarget();
  const first = delayedFile();
  const second = delayedFile();
  const older = importer.read(first.file, target.options);
  const newer = importer.read(second.file, target.options);
  second.resolve('{"part":"latest"}');
  await newer;
  first.resolve('{"part":"obsolete"}');
  await older;
  assert.deepEqual(target.values, [{ part: 'latest' }]);

  const failing = delayedFile();
  const obsoleteFailure = importer.read(failing.file, target.options);
  await importer.read({ size: 1, text: async () => '{"part":"newer"}' }, target.options);
  failing.reject(new Error('An obsolete file could not be read.'));
  await obsoleteFailure;
  assert.deepEqual(target.values, [{ part: 'latest' }, { part: 'newer' }]);
  assert.deepEqual(target.errors, []);
});

test('selection changes or unmounts cancel pending imports and allow the next read', async () => {
  const importer = createFileImporter();
  const target = importTarget();
  const success = delayedFile();
  const pending = importer.read(success.file, target.options);
  importer.cancel();
  success.resolve('{"part":"old-selection"}');
  await pending;
  const failure = delayedFile();
  const rejected = importer.read(failure.file, target.options);
  importer.cancel();
  failure.reject(new Error('Closed import failure.'));
  await rejected;
  assert.deepEqual(target.values, []);
  assert.deepEqual(target.errors, []);

  await importer.read({ size: 1, text: async () => '{"part":"current"}' }, target.options);
  assert.deepEqual(target.values, [{ part: 'current' }]);
});

test('current import errors are reported and oversized files are rejected before reading', async () => {
  const importer = createFileImporter();
  const target = importTarget();
  await importer.read({ size: 1, text: async () => 'invalid JSON' }, target.options);
  let reads = 0;
  await importer.read(
    {
      size: 100_001,
      text: async () => {
        reads++;
        return '{}';
      },
    },
    target.options,
  );
  assert.equal(reads, 0);
  assert.equal(target.errors.length, 2);
  assert.match(String(target.errors[1]), /smaller than 100 KB/);
  assert.deepEqual(target.values, []);
});
