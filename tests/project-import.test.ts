import assert from 'node:assert/strict';
import test from 'node:test';
import { createProject, serializeProject } from '../src/core/design-project';
import { createProjectImporter, mergeImportedProject } from '../src/core/project-import';

function deferredFile() {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { file: { size: 1, text: () => promise }, resolve, reject };
}

test('a delayed project import preserves other projects edited or added during the read', async () => {
  const original = createProject('Existing design');
  const imported = createProject('Imported design');
  const added = createProject('Created while reading');
  let projects = [original];
  const reader = createProjectImporter();
  const delayed = deferredFile();
  const errors: unknown[] = [];
  const pending = reader.read(
    delayed.file,
    [],
    (project) => {
      projects = mergeImportedProject(projects, project);
    },
    (error) => errors.push(error),
  );
  const edited = { ...original, name: 'Updated design', revision: 'B' };
  projects = [edited, added];
  delayed.resolve(serializeProject(imported, []));
  await pending;
  assert.deepEqual(projects, [edited, added, imported]);
  assert.equal(projects[0], edited, 'unrelated in-memory design objects are preserved');
  assert.deepEqual(errors, []);

  const replacement = { ...imported, name: 'Updated imported design' };
  projects = mergeImportedProject(projects, replacement);
  assert.deepEqual(
    projects,
    [edited, added, replacement],
    'an import replaces only its matching ID',
  );
});

test('newer imports win even when earlier files finish or fail later', async () => {
  const reader = createProjectImporter();
  const first = deferredFile();
  const second = deferredFile();
  const latest = createProject('Latest selected file');
  const applied: string[] = [];
  const errors: unknown[] = [];
  const accept = (project: typeof latest) => {
    applied.push(project.name);
  };
  const fail = (error: unknown) => {
    errors.push(error);
  };
  const earlier = reader.read(first.file, [], accept, fail);
  const newer = reader.read(second.file, [], accept, fail);
  second.resolve(serializeProject(latest, []));
  await newer;
  first.resolve('invalid obsolete JSON');
  await earlier;
  assert.deepEqual(applied, [latest.name]);
  assert.deepEqual(errors, []);

  const obsolete = deferredFile();
  const obsoleteRead = reader.read(obsolete.file, [], accept, fail);
  await reader.read({ size: 1, text: async () => serializeProject(latest, []) }, [], accept, fail);
  obsolete.reject(new Error('Superseded read failure'));
  await obsoleteRead;
  assert.deepEqual(applied, [latest.name, latest.name]);
  assert.deepEqual(errors, []);
});

test('closing the workspace cancels pending read results and errors without hiding current errors', async () => {
  const reader = createProjectImporter();
  const applied: string[] = [];
  const errors: unknown[] = [];
  const accept = (project: ReturnType<typeof createProject>) => {
    applied.push(project.name);
  };
  const fail = (error: unknown) => {
    errors.push(error);
  };
  const success = deferredFile();
  const pending = reader.read(success.file, [], accept, fail);
  reader.cancel();
  success.resolve(serializeProject(createProject(), []));
  await pending;
  const failure = deferredFile();
  const rejected = reader.read(failure.file, [], accept, fail);
  reader.cancel();
  failure.reject(new Error('Closed workspace read failure'));
  await rejected;
  assert.deepEqual(applied, []);
  assert.deepEqual(errors, []);

  await reader.read({ size: 1, text: async () => 'invalid current JSON' }, [], accept, fail);
  assert.equal(errors.length, 1, 'the active read still reports invalid input');
  await reader.read(
    {
      size: 10_000_001,
      text: async () => {
        throw new Error('Must not read');
      },
    },
    [],
    accept,
    fail,
  );
  assert.equal(errors.length, 2);
  assert.match(String(errors[1]), /smaller than 10 MB/);
});
