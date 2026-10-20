import assert from 'node:assert/strict';
import test from 'node:test';
import machine, { millingLibraries } from '../src/parts/cnc-milling-machine/part';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
  validateProject,
} from '../src/core/design-project';

test('the authored precision machine has its own name and stable physical identity in the CNC browse family', () => {
  assert.equal(machine.id, 'cnc-milling-machine');
  assert.equal(machine.name, 'ProtoLab CNC / 800x1500x200');
  assert.deepEqual(machine.browseFamily, {
    id: 'cnc-milling-machines',
    label: 'CNC milling machines',
  });
  assert.ok(!machine.keywords.some((word) => /yastreb/i.test(word)));
  assert.ok(
    machine.presets.every((preset) => !/yastreb/i.test(preset.name + ' ' + preset.description)),
  );
  assert.ok(machine.sources!.some((source) => source.url.includes('cncmachines.com.ua')));
});

test('projects saved under the former machine label round trip without changing physical IDs, configurations or placements', () => {
  const original = { ...machine, name: 'CNC mill / Yastreb 8015-200 DIY' };
  const previousDefinitions = [original, ...millingLibraries];
  const { project, occurrenceId } = addProduct(
    createProject('Existing authored machine'),
    previousDefinitions,
    {
      part: original,
      parameters: machine.defaults,
      state: 'assembled',
    },
  );
  project.name = 'Operator-owned design name';
  const rootOccurrence = project.occurrences.find((item) => item.id === occurrenceId)!;
  rootOccurrence.placement.translation = [125, -300, 20];
  rootOccurrence.placement.rotation = [0, 0, 90];
  rootOccurrence.notes = 'Preserve the existing installation.';
  const rootConfiguration = project.configurations.find(
    (item) => item.id === rootOccurrence.configurationId,
  )!;
  rootConfiguration.designation = 'OWN-CNC-001';
  rootConfiguration.revision = 'B';
  assert.equal(rootConfiguration.name, original.name);
  assert.equal(rootConfiguration.libraryId, 'cnc-milling-machine');
  const saved = serializeProject(project, previousDefinitions);
  const expected = JSON.parse(saved);
  const currentDefinitions = [machine, ...millingLibraries];
  const restored = parseProject(saved, currentDefinitions);
  assert.deepEqual(validateProject(restored, currentDefinitions), []);
  assert.deepEqual(restored, expected);
  assert.equal(restored.occurrences.length, project.occurrences.length);
  assert.equal(restored.configurations.length, project.configurations.length);
  assert.ok(
    restored.occurrences.length > 1000,
    'The full physical assembly, including nested purchased kits, is retained.',
  );
  assert.deepEqual(
    restored.configurations.find((item) => item.id === rootConfiguration.id)!.parameters,
    machine.defaults,
  );
  assert.deepEqual(JSON.parse(serializeProject(restored, currentDefinitions)), expected);
});
