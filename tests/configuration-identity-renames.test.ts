import assert from 'node:assert/strict';
import test from 'node:test';
import { configurationLink, parseConfigurationLink } from '../src/core/configuration-link';
import {
  addProduct,
  configureProduct,
  createDocument,
  createProject,
  parseProject,
  serializeProject,
  validateProject,
} from '../src/core/design-project';
import { eskdIdentity, type EskdIdentity } from '../src/core/eskd';
import { libraryEntryId, resolveLibraryEntry } from '../src/core/library-identity';
import { selectedMatchingPreset } from '../src/core/preset-resolution';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { generateProjectScript } from '../src/core/project-freecad';
import type { AssemblyComponent, DesignProject } from '../src/core/product-types';
import type { PartDefinition } from '../src/core/types';
import camera from '../src/parts/board-camera-19/part';
import avionics from '../src/parts/modular-tube-avionics/part';

const parts = [avionics, camera];
const originalAvionicsParameters = {
  tubeProfile: 'd90-86',
  cameraSetup: 'ov9281',
  module: 'all',
  keyClearance: 0.3,
  showTube: true,
  showElectronics: true,
};
const renames = [
  {
    part: avionics,
    previous: 'd90-86',
    current: 'd90-86-ov9281',
    parameters: originalAvionicsParameters,
  },
  {
    part: avionics,
    previous: 'd90-86-camera-19',
    current: 'd90-86-imx577-19x19',
    parameters: { ...originalAvionicsParameters, cameraSetup: 'camera-19' },
  },
  {
    part: camera,
    previous: '19-rear-mipi-m25',
    current: 'imx577-19x19-rear-mipi-m25',
    parameters: {
      bodyWidth: 19,
      bodyHeight: 19,
      bodyDepth: 12,
      lensDiameter: 14.8,
      lensLength: 15,
      lensProfile: 'stepped',
      lensCollarDiameter: 16,
      lensCollarHeight: 5,
      rearInterface: 'rear-mipi',
      rearConnectorWidth: 17,
      rearConnectorHeight: 2,
      rearConnectorProjection: 0.5,
      rearConnectorTopInset: 3,
      rearConnectorRightInset: 0,
      sideMount: 'm2.5',
      sideMountOffset: 7.5,
      sideHoleDepth: 2.5,
    },
  },
];

function selection(part: PartDefinition, presetId: string) {
  const preset = part.presets.find((candidate) => candidate.id === presetId);
  assert.ok(preset, `Missing canonical preset ${part.id}:${presetId}`);
  const parameters = { ...part.defaults, ...preset.parameters };
  const original = renames.find((rename) => rename.part === part && rename.current === presetId);
  if (original)
    assert.deepEqual(
      parameters,
      original.parameters,
      'a name change preserves the original dimensions and controls',
    );
  return {
    part,
    parameters,
    state: part.states?.[0]?.id ?? 'default',
    presetId,
  };
}

function component(part: PartDefinition, presetId: string): AssemblyComponent {
  const configured = selection(part, presetId);
  return {
    id: 'installed-camera-configuration',
    libraryId: part.id,
    name: 'Custom installation role',
    parameters: configured.parameters,
    state: configured.state,
    presetId,
    supply: part.product.supply,
    quantity: 2,
    placement: { translation: [120, -34, 56], rotation: [15, 0, 90] },
  };
}

function projectFixture(): DesignProject {
  const project = addProduct(
    createProject('Saved camera and avionics identities'),
    parts,
    selection(camera, renames[2].current),
  ).project;
  // Explicit root occurrences exercise real avionics configurations without expanding
  // the assembly's unrelated purchased and manufactured component inventory.
  for (const rename of renames.slice(0, 2)) {
    const configured = configureProduct(selection(rename.part, rename.current));
    project.configurations.push(configured);
    project.occurrences.push({
      id: `installed-${rename.current}`,
      parentId: null,
      configurationId: configured.id,
      position: String(project.occurrences.length + 1),
      quantity: 1,
      placement: {
        translation: [37, -18, project.occurrences.length * 125],
        rotation: [0, 20, 90],
      },
      notes: 'Retain the installed datum.',
    });
  }
  project.occurrences[0].quantity = 3;
  project.occurrences[0].placement = {
    translation: [102, -38, 72.5],
    rotation: [10, -20, 90],
  };
  project.occurrences.push({
    ...structuredClone(project.occurrences[0]),
    id: 'second-installed-camera',
    position: '4',
    quantity: 1,
    placement: { translation: [-41, 22, 100], rotation: [0, 0, -90] },
  });
  for (const [index, configuration] of project.configurations.entries()) {
    configuration.name = `Custom product name ${index + 1}`;
    configuration.designation = `USER.CAMERA.${index + 1}`;
    configuration.revision = 'C';
    if (configuration.procurement) {
      configuration.procurement.name = configuration.name;
      configuration.procurement.designation = configuration.designation;
      configuration.procurement.manufacturer = 'User-recorded supplier';
      configuration.procurement.source = 'User inspection record';
    }
    project.documents.push(createDocument(configuration));
  }
  assert.deepEqual(validateProject(project, parts), []);
  return project;
}

function savedBeforeRenaming(project: DesignProject): DesignProject {
  const saved = structuredClone(project);
  for (const configuration of saved.configurations) {
    const rename = renames.find(
      (candidate) =>
        candidate.part.id === configuration.libraryId &&
        candidate.current === configuration.presetId,
    );
    assert.ok(rename);
    configuration.presetId = rename.previous;
  }
  return saved;
}

function identity(project: DesignProject, index: number): EskdIdentity {
  const configuration = project.configurations[index];
  const part = parts.find((candidate) => candidate.id === configuration.libraryId);
  assert.ok(part);
  return eskdIdentity(
    part,
    configuration.parameters,
    configuration.state,
    configuration.presetId,
    configuration,
  );
}

function macroRecord<T>(script: string, name: string): T {
  const prefix = `${name} = json.loads(`;
  const line = script.split('\n').find((candidate) => candidate.startsWith(prefix));
  assert.ok(line, `Missing serialized native export record ${name}`);
  return JSON.parse(JSON.parse(line.slice(prefix.length, -1))) as T;
}

test('old and current camera links import the same complete configuration and serialize only canonical IDs', () => {
  for (const rename of renames) {
    const source = component(rename.part, rename.current);
    if (rename.part === avionics) source.state = 'service';
    const before = structuredClone(source);
    for (const presetId of [rename.previous, rename.current]) {
      const restored = parseConfigurationLink(configurationLink({ ...source, presetId }), parts);
      assert.ok(restored);
      assert.strictEqual(restored.part, rename.part);
      assert.equal(restored.presetId, rename.current);
      assert.deepEqual(restored.parameters, source.parameters);
      assert.equal(restored.state, source.state);
      const canonical = configurationLink({ ...source, ...restored });
      const saved = JSON.parse(decodeURIComponent(canonical.slice('#configuration='.length)));
      assert.equal(saved.presetId, rename.current);
      assert.deepEqual(saved.parameters, source.parameters);
      assert.deepEqual(parseConfigurationLink(canonical, parts), restored);
    }
    assert.deepEqual(source, before, 'importing a link does not rewrite its source occurrence');
  }

  const source = component(avionics, renames[0].current);
  const parameters = { ...source.parameters };
  delete parameters.tubeProfile;
  assert.deepEqual(
    parseConfigurationLink(
      configurationLink({ ...source, presetId: renames[0].previous, parameters }),
      parts,
    )?.parameters,
    source.parameters,
    'the model rename composes with the existing implicit tube-profile import upgrade',
  );
});

test('link migration rejects unknown, cross-family and parameter-mismatched selections', () => {
  for (const rename of renames) {
    const source = component(rename.part, rename.current);
    const foreign = rename.part === camera ? renames[0].previous : renames[2].previous;
    for (const presetId of [`${rename.previous}-unknown`, foreign])
      assert.throws(() =>
        parseConfigurationLink(configurationLink({ ...source, presetId }), parts),
      );

    const parameters =
      rename.part === camera
        ? { ...source.parameters, sideMount: 'none' }
        : {
            ...source.parameters,
            cameraSetup: source.parameters.cameraSetup === 'ov9281' ? 'camera-19' : 'ov9281',
          };
    for (const presetId of [rename.previous, rename.current])
      assert.throws(() =>
        parseConfigurationLink(configurationLink({ ...source, parameters, presetId }), parts),
      );
  }

  const generic = component(camera, 'user-csi-19-12-27');
  assert.equal(
    parseConfigurationLink(configurationLink(generic), parts)?.presetId,
    generic.presetId,
  );
  for (const presetId of [undefined, 'custom'])
    assert.equal(
      parseConfigurationLink(configurationLink({ ...generic, presetId }), parts)?.presetId,
      'custom',
      'an omitted source selection remains custom',
    );
});

test('runtime model lookup and exact catalog search expose canonical IDs without old aliases', () => {
  const index = buildPresetIndex(parts);
  for (const rename of renames) {
    const configured = selection(rename.part, rename.current);
    const current = libraryEntryId(rename.part.id, rename.current);
    const previous = libraryEntryId(rename.part.id, rename.previous);
    const resolved = resolveLibraryEntry(parts, current);
    assert.strictEqual(resolved?.part, rename.part);
    assert.equal(resolved?.preset?.id, rename.current);
    assert.equal(resolveLibraryEntry(parts, previous), undefined);
    assert.equal(
      selectedMatchingPreset(rename.part, configured.parameters, rename.previous),
      undefined,
      'old IDs are accepted only at the import boundary',
    );
    assert.deepEqual(
      filterPresets(index, { ...emptyPresetFilters(), query: current }).items.map(
        (entry) => entry.id,
      ),
      [current],
    );
    assert.deepEqual(filterPresets(index, { ...emptyPresetFilters(), query: previous }).items, []);
  }
});

test('saved projects migrate all three IDs while retaining product records, repeated occurrences and physical identity', () => {
  const expected = projectFixture();
  const saved = savedBeforeRenaming(expected);
  const text = JSON.stringify(saved);
  assert.throws(() => serializeProject(saved, parts), /unknown catalog preset/);
  const restored = parseProject(text, parts);
  assert.deepEqual(restored, expected);
  assert.equal(JSON.stringify(saved), text, 'the parsed project is independent of the old save');
  assert.deepEqual(parseProject(serializeProject(restored, parts), parts), expected);

  for (const [index, configuration] of restored.configurations.entries()) {
    const migratedIdentity = identity(restored, index);
    assert.equal(migratedIdentity.presetId, configuration.presetId);
    assert.equal(
      migratedIdentity.libraryEntryId,
      libraryEntryId(configuration.libraryId, configuration.presetId),
    );
    assert.equal(migratedIdentity.configurationKey, identity(saved, index).configurationKey);
    assert.deepEqual(migratedIdentity, identity(expected, index));
  }
});

test('project imports reject unknown, cross-family and mismatched old identities instead of relabeling them', () => {
  const project = projectFixture();
  for (const rename of renames) {
    const index = project.configurations.findIndex(
      (configuration) =>
        configuration.libraryId === rename.part.id && configuration.presetId === rename.current,
    );
    assert.ok(index >= 0);
    const foreign = rename.part === camera ? renames[0].previous : renames[2].previous;
    for (const presetId of [`${rename.previous}-unknown`, foreign]) {
      const invalid = structuredClone(project);
      invalid.configurations[index].presetId = presetId;
      assert.throws(() => parseProject(JSON.stringify(invalid), parts));
    }
    const invalid = savedBeforeRenaming(project);
    const parameters = invalid.configurations[index].parameters;
    if (rename.part === camera) parameters.sideMount = 'none';
    else parameters.cameraSetup = parameters.cameraSetup === 'ov9281' ? 'camera-19' : 'ov9281';
    assert.throws(() => parseProject(JSON.stringify(invalid), parts), /preset|match/i);
  }
});

test('native project export carries the canonical camera identity with unchanged parameters and placements', () => {
  const restored = parseProject(JSON.stringify(savedBeforeRenaming(projectFixture())), parts);
  const configured = restored.configurations.find(
    (configuration) => configuration.libraryId === camera.id,
  )!;
  const project: DesignProject = {
    ...restored,
    configurations: [configured],
    occurrences: restored.occurrences.filter(
      (occurrence) => occurrence.configurationId === configured.id,
    ),
    documents: restored.documents.filter((document) => document.configurationId === configured.id),
  };
  const before = structuredClone(project);
  const script = generateProjectScript(project, parts);
  const exported = macroRecord<DesignProject>(script, '_project');
  const identities = macroRecord<Record<string, EskdIdentity>>(script, '_identities');
  assert.deepEqual(exported, project);
  assert.equal(exported.configurations[0].presetId, renames[2].current);
  assert.deepEqual(identities[configured.id], identity(project, 0));
  assert.equal(identities[configured.id].presetId, renames[2].current);
  assert.match(script, /Part\.makeCylinder/);
  assert.deepEqual(project, before);
});
