import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Catalog from '../src/components/Catalog';
import { familyId, familyMembers, groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import {
  emptyMechanismFilters,
  filterMechanismExecutions,
  mechanismExecutionChoices,
  mechanismExecutionSelection,
} from '../src/core/mechanism-catalog';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
} from '../src/core/design-project';
import { eskdIdentity } from '../src/core/eskd';
import { registerPartModules, type PartModule } from '../src/core/part-modules';
import { defaultPartSelection, type PartSelection } from '../src/core/part-selection';
import { readProjects, storeProjects } from '../src/core/project-storage';
import { readPresets, storePresets, type SavedPreset } from '../src/core/storage';
import type { PartDefinition } from '../src/core/types';
import { validateParameters } from '../src/core/validation';
import { parts } from '../src/parts';
import historical from './fixtures/tr8-sfk-before-laser-source-sha256.json';
import previousQuad from './fixtures/tr8-previous-library-sha256.json';
import { preservedStudySource } from './helpers/study-source-baselines';

const ids = [
  'sfk-rotary-actuator',
  'sfk-disc-actuator',
  'sfk-slotted-actuator',
  'tr8-compact-actuator',
  'tr8-quad-actuator',
  'tr8-quad-mini-actuator',
  'tr8-quad-cnc-actuator',
  'tr8-quad-staggered-actuator',
  'tr8-quad-guided-actuator',
  'tr8-quad-guided-staggered-actuator',
  'tr8-quad-laser-guided-actuator',
  'tr8-quad-twin-pin-actuator',
  'tr8-quad-twin-pin-mini-actuator',
  'tr8-quad-faulhaber-actuator',
  'tr8-quad-surpass-actuator',
  'tr8-geared-rocker-actuator',
  'tr8-quad-geared-rocker-actuator',
];
const family = 'screw-rotary-actuators';
const label = 'Screw-driven rotary mechanisms';
const primaryId = 'tr8-compact-actuator';
const members = parts.filter((part) => part.browseFamily?.id === family);
const primary = members.find((part) => part.id === primaryId)!;
const physicalDefinitions = new Map<string, PartDefinition>(
  await Promise.all(
    ids.map(
      async (id) =>
        [id, (await import(`../src/parts/${id}/part`)).default as PartDefinition] as const,
    ),
  ),
);
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

test('one mechanism family retains every finished definition and one explicit primary', () => {
  assert.deepEqual(members.map((part) => part.id).sort(), [...ids].sort());
  assert.equal(
    parts.filter((part) => part.id === family).length,
    0,
    'navigation is not a synthetic product',
  );
  assert.deepEqual(
    members.filter((part) => part.browseFamily?.primary).map((part) => part.id),
    [primaryId],
  );
  const entries = groupBrowseFamilies(members);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, family);
  assert.equal(entries[0].label, label);
  assert.equal(entries[0].primary, primary);
  for (const part of members) {
    assert.equal(familyId(part), family);
    assert.equal(part.browseFamily?.label, label);
    assert.deepEqual(familyMembers(members, part), entries[0].members);
    assert.deepEqual(
      part.mechanismExecution?.screws.map((screw) => screw.designation),
      ['tr8-geared-rocker-actuator', 'tr8-quad-geared-rocker-actuator'].includes(part.id)
        ? ['TR8×4(P2)']
        : part.id === 'tr8-quad-surpass-actuator'
          ? ['TR8×2(P2)', 'TR8×8(P2)']
          : part.id.startsWith('sfk-')
            ? ['SFK0825']
            : ['TR8×8(P2)'],
    );
    assert.equal(
      part.mechanismExecution?.outputs,
      part.id.startsWith('sfk-') ||
        part.id === primaryId ||
        part.id === 'tr8-geared-rocker-actuator'
        ? 1
        : 4,
    );
  }
});

test('execution navigation leaves physical names, parameters, factories and ESKD identities unchanged', () => {
  for (const part of members) {
    const definition = physicalDefinitions.get(part.id)!;
    assert.equal(part.id, definition.id);
    assert.equal(part.name, definition.name);
    for (const key of [
      'defaults',
      'parameters',
      'presets',
      'states',
      'product',
      'buildGeometry',
      'python',
      'composition',
      'dimensions',
      'fabricationFiles',
      'identityParameters',
    ] as const)
      assert.equal(part[key], definition[key], `${part.id}: ${key}`);
    assert.deepEqual(
      eskdIdentity(part, part.defaults, 'assembled'),
      eskdIdentity(definition, definition.defaults, 'assembled'),
      part.id,
    );
  }
  assert.equal(new Set(members.map((part) => part.id)).size, ids.length);
  assert.equal(new Set(members.map((part) => part.name)).size, ids.length);
});

function catalogHtml(selected: PartDefinition, query = ''): string {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'engineering' },
  });
  try {
    return renderToStaticMarkup(
      React.createElement(Catalog, {
        parts: members,
        selected,
        query,
        onQueryChange: () => {},
        onSelect: () => {},
        onClose: () => {},
      }),
    );
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('the sidebar exposes one family and keeps its selected marker for every execution', () => {
  for (const part of members) {
    const html = catalogHtml(part);
    assert.equal((html.match(new RegExp(`<span>${label}</span>`, 'g')) ?? []).length, 1, part.id);
    assert.equal((html.match(/class="part-button selected"/g) ?? []).length, 1, part.id);
    assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1, part.id);
    assert.match(html, /class="count-label">1<\/span>/);
    for (const member of members) assert.ok(!html.includes(`>${member.name}<`), member.id);
  }
  for (const query of ['TR8x8', 'TR8x4', 'SFK0825', 'twin pin']) {
    const html = catalogHtml(primary, query);
    assert.equal((html.match(new RegExp(`<span>${label}</span>`, 'g')) ?? []).length, 1, query);
    assert.match(html, /1 result found/);
  }
  assert.match(catalogHtml(primary, 'missing-mechanism-999999'), /No matching parts/);
});

test('the execution catalog filters real mechanisms by drive, output count and construction', () => {
  const before = members.map((part) => part.id);
  const choices = mechanismExecutionChoices(members);
  assert.deepEqual([...choices.drives].sort(), ['SFK0825', 'TR8×2(P2)', 'TR8×4(P2)', 'TR8×8(P2)']);
  assert.deepEqual(choices.outputs, [1, 4]);
  const all = emptyMechanismFilters();
  assert.deepEqual(filterMechanismExecutions(members, all), members);
  assert.equal(
    filterMechanismExecutions(parts, all).length,
    ids.length,
    'unrelated products are excluded',
  );
  assert.equal(filterMechanismExecutions(members, { ...all, drive: 'SFK0825' }).length, 3);
  assert.equal(filterMechanismExecutions(members, { ...all, drive: 'TR8×8(P2)' }).length, 12);
  assert.equal(filterMechanismExecutions(members, { ...all, outputs: '1' }).length, 5);
  assert.equal(filterMechanismExecutions(members, { ...all, outputs: '4' }).length, 12);
  assert.deepEqual(
    filterMechanismExecutions(members, { ...all, drive: 'TR8×4(P2)', outputs: '1' }).map(
      (part) => part.id,
    ),
    ['tr8-geared-rocker-actuator'],
  );
  assert.deepEqual(
    filterMechanismExecutions(members, { ...all, drive: 'TR8×4(P2)', outputs: '4' }).map(
      (part) => part.id,
    ),
    ['tr8-quad-geared-rocker-actuator'],
  );
  assert.deepEqual(
    filterMechanismExecutions(members, { ...all, drive: 'SFK0825', outputs: '4' }),
    [],
  );
  for (const query of ['TR8x8', 'TR8\u00d78', 'TR8\u04458'])
    assert.equal(filterMechanismExecutions(members, { ...all, query }).length, 12, query);
  assert.deepEqual(
    filterMechanismExecutions(members, { ...all, outputs: '4', query: 'twin pin 54' }).map(
      (part) => part.id,
    ),
    ['tr8-quad-twin-pin-mini-actuator'],
  );
  assert.deepEqual(
    filterMechanismExecutions(members, { ...all, query: 'central guide 56' }).map(
      (part) => part.id,
    ),
    ['tr8-quad-guided-staggered-actuator'],
  );
  assert.deepEqual(
    filterMechanismExecutions(members, { ...all, query: 'missing-mechanism-999999' }),
    [],
  );
  assert.deepEqual(
    members.map((part) => part.id),
    before,
    'filters do not reorder or mutate definitions',
  );
});

test('library search forwards exact execution queries and cannot combine facts from different members', () => {
  const index = buildLibrarySearchIndex(groupBrowseFamilies(members));
  for (const query of [
    'TR8x8',
    'TR8\u00d78',
    'TR8x4',
    'SFK0825',
    'twin pin 54',
    'central guide 56',
  ]) {
    const matches = searchLibrary(index, query);
    assert.equal(matches.length, 1, query);
    assert.equal(matches[0].family.id, family);
    assert.equal(matches[0].articleQuery, query);
    assert.ok(
      filterMechanismExecutions(matches[0].family.members, {
        drive: '',
        outputs: '',
        query: matches[0].articleQuery,
      }).length > 0,
    );
  }
  for (const query of ['SFK0825 54', 'TR8x8 SFK0825', 'TR8x2 TR8x8'])
    assert.deepEqual(searchLibrary(index, query), [], query);
  const navigation = searchLibrary(index, label);
  assert.equal(navigation.length, 1);
  assert.equal(
    navigation[0].articleQuery,
    '',
    'the family label does not become an execution constraint',
  );
});

function editedSelection(part: PartDefinition): PartSelection {
  const preset = part.presets.at(-1)!;
  const parameters = { ...preset.parameters };
  for (const key of ['outputAngle', 'angleA', 'angleB', 'angleC', 'angleD'])
    if (key in parameters) parameters[key] = 12;
  const modelState = part.states?.find((state) => state.id === 'exploded')?.id ?? 'assembled';
  assert.deepEqual(validateParameters(part, parameters, modelState), []);
  return { partId: part.id, parameters, modelState, presetId: preset.id };
}

test('switching executions restores each own motor, angle, state and preset without leaking edits', () => {
  const selections = new Map(members.map((part) => [part.id, editedSelection(part)]));
  for (const part of members) {
    const saved = selections.get(part.id)!;
    const snapshot = structuredClone(saved);
    const restored = mechanismExecutionSelection(part, saved);
    assert.deepEqual(restored, snapshot, part.id);
    assert.notEqual(restored, saved);
    assert.notEqual(restored.parameters, saved.parameters);
    restored.parameters.motorModel = 'edited after selection';
    assert.deepEqual(
      saved,
      snapshot,
      'the session snapshot cannot be edited through a restored selection',
    );
    assert.deepEqual(mechanismExecutionSelection(part), defaultPartSelection(part));
    const unrelated = selections.get(members.find((member) => member.id !== part.id)!.id)!;
    assert.deepEqual(mechanismExecutionSelection(part, unrelated), defaultPartSelection(part));
    assert.deepEqual(
      mechanismExecutionSelection(part, saved),
      snapshot,
      'returning restores the original own settings',
    );
  }
});

test('all execution identities and settings survive saved-preset and engineering-project roundtrips', (context) => {
  const storage = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  const saved: SavedPreset[] = members.map((part) => {
    const selection = editedSelection(part);
    return {
      id: `saved-${part.id}`,
      name: part.name,
      partId: part.id,
      parameters: selection.parameters,
      state: selection.modelState,
    };
  });
  storePresets(saved);
  assert.deepEqual(readPresets(parts), saved);
  const projects = members.map((part) => {
    const preset = part.presets[0];
    const project = addProduct(createProject(), parts, {
      part,
      parameters: preset.parameters,
      state: 'assembled',
      presetId: preset.id,
    }).project;
    const root = project.configurations.find((item) => item.libraryId === part.id)!;
    assert.equal(root.name, part.name);
    assert.equal(root.presetId, preset.id);
    assert.deepEqual(root.parameters, preset.parameters);
    const encoded = serializeProject(project, parts);
    const decoded = parseProject(encoded, parts);
    // JSON represents both signed zero values as 0 in rigid placements.
    assert.equal(serializeProject(decoded, parts), encoded);
    return decoded;
  });
  storeProjects(projects, parts);
  const restored = readProjects(parts);
  assert.deepEqual(restored.errors, []);
  assert.deepEqual(restored.projects, projects);
});

test('module validation rejects malformed execution data and non-assembly mechanisms', () => {
  const module = (changes: Partial<PartDefinition>): PartModule => ({
    apiVersion: 2,
    order: 1,
    part: { ...primary, id: 'mechanism-fixture', presets: [], ...changes },
  });
  assert.equal(registerPartModules([module({})]).length, 1);
  for (const bad of [
    null,
    [],
    { ...primary.mechanismExecution, screws: [] },
    { ...primary.mechanismExecution, screws: [{ designation: 'TR8', kind: 'unknown', lead: 8 }] },
    {
      ...primary.mechanismExecution,
      screws: [{ designation: 'TR8', kind: 'lead-screw', lead: -8 }],
    },
    { ...primary.mechanismExecution, screws: [{ designation: '', kind: 'lead-screw', lead: 8 }] },
    {
      ...primary.mechanismExecution,
      screws: [
        { designation: 'TR8', kind: 'lead-screw', lead: 8, when: { missingParameter: 'bad' } },
      ],
    },
    { ...primary.mechanismExecution, motors: [] },
    { ...primary.mechanismExecution, materials: [''] },
    { ...primary.mechanismExecution, processes: [] },
    { ...primary.mechanismExecution, travelDegrees: 0 },
    { ...primary.mechanismExecution, outputs: 0 },
    { ...primary.mechanismExecution, outputs: 1.5 },
    { ...primary.mechanismExecution, construction: '' },
    { ...primary.mechanismExecution, description: '' },
  ])
    assert.throws(
      () =>
        registerPartModules([
          module({ mechanismExecution: bad as PartDefinition['mechanismExecution'] }),
        ]),
      /Mechanism execution/,
    );
  assert.throws(
    () => registerPartModules([module({ browseFamily: undefined })]),
    /Mechanism execution/,
  );
  assert.throws(
    () => registerPartModules([module({ product: { ...primary.product, kind: 'detail' } })]),
    /physical assembly product type/,
  );
});

test('historical mechanism hashes retain all bytes outside exact reviewed source deltas', () => {
  for (const fixtures of [historical, previousQuad])
    for (const [id, files] of Object.entries(fixtures))
      for (const [file, checksum] of Object.entries(files)) {
        const content = readFileSync(new URL(`../src/parts/${id}/${file}`, import.meta.url));
        assert.equal(
          digest(preservedStudySource(`${id}/${file}`, content)),
          checksum,
          `${id}/${file}`,
        );
      }
});

test('selectable lead projection rejects changed thread definitions and retains unrelated geometry bytes', () => {
  const file = 'tr8-compact-actuator/lib/drive.ts';
  const source = readFileSync(new URL(`../src/parts/${file}`, import.meta.url), 'utf8');
  const original = preservedStudySource(file, Buffer.from(source));
  for (const changed of [
    source.replace('lead: Tr8Lead = 8', 'lead: Tr8Lead = 2'),
    source.replace(
      'const flankSteps = 4 * 8 / thread.lead;',
      'const flankSteps = 5 * 8 / thread.lead;',
    ),
  ]) {
    assert.notEqual(changed, source);
    assert.throws(
      () => preservedStudySource(file, Buffer.from(changed)),
      /reviewed selectable lead delta/,
    );
  }
  const changedGeometry = source.replace('rootDiameter: 5.5,', 'rootDiameter: 5.4,');
  assert.notEqual(changedGeometry, source);
  assert.notEqual(
    digest(preservedStudySource(file, Buffer.from(changedGeometry))),
    digest(original),
  );
  assert.throws(
    () => preservedStudySource(file, Buffer.from(source + source)),
    /ambiguous selectable lead delta/,
  );
});

test('reviewed name projection cannot hide changed titles, physical identifiers or preset parameters', () => {
  const file = 'tr8-quad-actuator/part.ts';
  const source = readFileSync(new URL(`../src/parts/${file}`, import.meta.url), 'utf8');
  const part = members.find((member) => member.id === 'tr8-quad-actuator')!;
  assert.throws(
    () => preservedStudySource(file, Buffer.from(source.replace(part.name, 'Unreviewed title'))),
    /component title delta/,
  );
  const original = preservedStudySource(file, Buffer.from(source));
  const changedIdentifier = source.replace(
    "id: 'tr8-quad-actuator'",
    "id: 'another-physical-assembly'",
  );
  assert.notEqual(
    digest(preservedStudySource(file, Buffer.from(changedIdentifier))),
    digest(original),
  );
  const presetFile = 'tr8-quad-actuator/presets.json';
  const presetSource = readFileSync(new URL(`../src/parts/${presetFile}`, import.meta.url), 'utf8');
  const changedParameter = presetSource.replace('"angleA": 0', '"angleA": 1');
  assert.notEqual(
    digest(preservedStudySource(presetFile, Buffer.from(changedParameter))),
    digest(preservedStudySource(presetFile, Buffer.from(presetSource))),
  );
});

const beforeMetadata =
  "const part = { ...definition, id: 'tr8-quad-actuator' };\nexport default { part };\n";
const validBlock = `// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  outputs: 4, construction: 'Laser frame', description: 'Existing assembly',
  motors: [{ model: 'GMP16T-TEC1636' }], materials: ['Steel'], processes: ['Laser cutting'], travelDegrees: 20
};
// End execution catalog metadata.
`;
const withBlock = (block = validBlock) =>
  beforeMetadata.replace('export default', block + 'export default');
const projectIndex = (source: string, file = 'tr8-quad-actuator/index.ts') =>
  preservedStudySource(file, Buffer.from(source)).toString('utf8');

test('source projection removes literal navigation metadata and preserves every unrelated source byte', () => {
  assert.equal(projectIndex(withBlock()), beforeMetadata);
  const changed = withBlock().replace("id: 'tr8-quad-actuator'", "id: 'altered-physical-id'");
  assert.notEqual(digest(projectIndex(changed)), digest(beforeMetadata));
  const extraCode = withBlock() + '\npart.python = replacementGeometry;\n';
  assert.notEqual(digest(projectIndex(extraCode)), digest(beforeMetadata));
});

test('source projection rejects expressions, extra assignments, schema changes and ambiguous markers', () => {
  for (const block of [
    validBlock.replace("description: 'Existing assembly'", 'description: makeDescription()'),
    validBlock.replace('outputs: 4', 'outputs: 2 + 2'),
    validBlock.replace('part.browseFamily', 'part.id'),
    validBlock.replace('travelDegrees: 20', "travelDegrees: 20, python: 'changed geometry'"),
    validBlock.replace("id: 'screw-rotary-actuators'", "['id']: 'screw-rotary-actuators'"),
    validBlock.replace("label: 'Screw-driven rotary mechanisms'", '...otherMetadata'),
    validBlock.replace(
      '// End execution catalog metadata.',
      'part.python = replacementGeometry;\n// End execution catalog metadata.',
    ),
    validBlock.replace('// End execution catalog metadata.\n', ''),
    validBlock + validBlock,
  ])
    assert.throws(() => projectIndex(withBlock(block)), block);
  assert.throws(
    () => projectIndex(withBlock(), 'unreviewed-mechanism/index.ts'),
    /outside the reviewed/,
  );
});
