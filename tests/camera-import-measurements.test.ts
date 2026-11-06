import assert from 'node:assert/strict';
import test from 'node:test';
import { configurationFromDocument, parseConfiguration } from '../src/core/configuration';
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
import { resolveLibraryEntry } from '../src/core/library-identity';
import { selectedMatchingPreset } from '../src/core/preset-resolution';
import type { DesignProject } from '../src/core/product-types';
import type { Parameters } from '../src/core/types';
import { validateParameters } from '../src/core/validation';
import camera from '../src/parts/board-camera-19/part';

const parts = [camera];
const canonicalImx = 'imx577-19x19-rear-mipi-m25';
const oldImx = '19-rear-mipi-m25';
const genericId = 'user-csi-19-12-27';
const profileKeys = ['lensProfile', 'lensCollarDiameter', 'lensCollarHeight'] as const;
const originalImx: Parameters = {
  bodyWidth: 19,
  bodyHeight: 19,
  bodyDepth: 12,
  lensDiameter: 12,
  lensLength: 15,
  rearInterface: 'rear-mipi',
  rearConnectorWidth: 17,
  rearConnectorHeight: 2,
  rearConnectorProjection: 0.5,
  rearConnectorTopInset: 3,
  rearConnectorRightInset: 0,
  sideMount: 'm2.5',
  sideMountOffset: 7.5,
  sideHoleDepth: 2.5,
};
const measured = {
  ...camera.defaults,
  ...camera.presets.find((preset) => preset.id === canonicalImx)!.parameters,
};
const cylindrical = (parameters: Parameters): Parameters => ({
  ...parameters,
  lensProfile: 'cylindrical',
  lensCollarDiameter: parameters.lensDiameter,
  lensCollarHeight: 0,
});
function beforeProfiles(parameters: Parameters): Parameters {
  return Object.fromEntries(
    Object.entries(parameters).filter(
      ([key]) => !profileKeys.includes(key as (typeof profileKeys)[number]),
    ),
  );
}
function document(parameters: Record<string, unknown>, presetId?: string) {
  return {
    version: 1,
    units: 'mm',
    part: camera.id,
    state: 'default',
    parameters,
    ...(presetId === undefined ? {} : { presetId }),
  };
}
function oldProject(parameters: Parameters, presetId?: string): DesignProject {
  const project = addProduct(createProject('Camera import measurements'), parts, {
    part: camera,
    parameters: measured,
    state: 'default',
    presetId: canonicalImx,
  }).project;
  const configuration = project.configurations[0];
  configuration.parameters = structuredClone(parameters);
  if (presetId === undefined) delete configuration.presetId;
  else configuration.presetId = presetId;
  configuration.name = 'Recorded camera role';
  configuration.designation = 'USER.CAMERA.042';
  configuration.revision = 'D';
  project.documents.push(createDocument(configuration));
  project.occurrences[0].quantity = 2;
  project.occurrences[0].placement = {
    translation: [25, -37.5, 106],
    rotation: [0, 15, 90],
  };
  project.occurrences.push({
    ...structuredClone(project.occurrences[0]),
    id: 'second-camera',
    position: '2',
    quantity: 1,
    placement: { translation: [-12, 44, 75], rotation: [90, 0, 180] },
  });
  return project;
}
function importEverywhere(parameters: Parameters, presetId?: string) {
  const text = JSON.stringify(document(parameters, presetId));
  const file = parseConfiguration(text, parts);
  const link = parseConfigurationLink('#configuration=' + encodeURIComponent(text), parts)!;
  const saved = oldProject(parameters, presetId);
  const before = structuredClone(saved);
  const project = parseProject(JSON.stringify(saved), parts);
  assert.deepEqual(saved, before, 'import does not mutate a saved project supplied by the caller');
  return { file, link, project, saved };
}

test('old exact IMX577 camera imports receive the measured objective through files, links and projects', () => {
  for (const presetId of [oldImx, canonicalImx]) {
    const { file, link, project, saved } = importEverywhere(originalImx, presetId);
    assert.deepEqual(file.parameters, measured);
    assert.deepEqual(link.parameters, measured);
    assert.equal(file.presetId, canonicalImx);
    assert.equal(link.presetId, canonicalImx);
    assert.deepEqual(project, {
      ...saved,
      configurations: [
        { ...saved.configurations[0], parameters: measured, presetId: canonicalImx },
      ],
    });
    assert.deepEqual(validateProject(project, parts), []);
    assert.deepEqual(parseProject(serializeProject(project, parts), parts), project);
    assert.equal(project.configurations[0].id, saved.configurations[0].id);
    assert.deepEqual(project.occurrences, saved.occurrences);
    assert.deepEqual(project.documents, saved.documents);
  }
});

test('old generic and custom cameras gain a cylindrical profile without changing existing dimensions', () => {
  const generic = beforeProfiles({
    ...camera.defaults,
    ...camera.presets.find((preset) => preset.id === genericId)!.parameters,
  });
  const custom: Parameters = {
    ...originalImx,
    bodyWidth: 24,
    bodyHeight: 23,
    bodyDepth: 14,
    lensDiameter: 13.2,
    lensLength: 17,
    rearConnectorWidth: 18,
    rearConnectorHeight: 2.5,
    rearConnectorProjection: 0.6,
    rearConnectorTopInset: 3.5,
    rearConnectorRightInset: 0.5,
    sideMountOffset: 8.2,
    sideHoleDepth: 2.7,
  };
  for (const [parameters, presetId] of [
    [generic, genericId],
    [custom, undefined],
    [originalImx, undefined],
  ] as const) {
    const expected = cylindrical(parameters);
    const restored = importEverywhere(parameters, presetId);
    assert.deepEqual(restored.file.parameters, expected);
    assert.deepEqual(restored.link.parameters, expected);
    assert.deepEqual(restored.project.configurations[0].parameters, expected);
    assert.equal(restored.file.presetId, presetId);
    assert.equal(restored.link.presetId, presetId ?? 'custom');
    assert.equal(restored.project.configurations[0].presetId, presetId);
  }
  const selection = parseConfiguration(JSON.stringify(document(custom, 'custom')), parts);
  assert.deepEqual(selection.parameters, cylindrical(custom));
  assert.equal(selection.presetId, 'custom');
});

test('the measured-objective correction requires the complete exact old identified execution', () => {
  for (const key of Object.keys(originalImx)) {
    const value = originalImx[key];
    const mismatched = {
      ...originalImx,
      [key]: typeof value === 'number' ? value + 0.1 : value === 'none' ? 'rear-mipi' : 'none',
    };
    for (const presetId of [oldImx, canonicalImx]) {
      assert.throws(
        () => parseConfiguration(JSON.stringify(document(mismatched, presetId)), parts),
        key,
      );
      assert.throws(
        () => parseProject(JSON.stringify(oldProject(mismatched, presetId)), parts),
        key,
      );
    }
  }
  for (const presetId of [`${oldImx}-unknown`, genericId, 'd90-86']) {
    assert.throws(() => parseConfiguration(JSON.stringify(document(originalImx, presetId)), parts));
    assert.throws(() => parseProject(JSON.stringify(oldProject(originalImx, presetId)), parts));
  }
  for (const key of Object.keys(originalImx)) {
    const incomplete = { ...originalImx };
    delete incomplete[key];
    assert.throws(
      () => parseConfiguration(JSON.stringify(document(incomplete, oldImx)), parts),
      key,
    );
    assert.throws(() => parseProject(JSON.stringify(oldProject(incomplete, oldImx)), parts), key);
  }
});

test('explicit or partial new profile values are never overwritten with import defaults', () => {
  const validCustom = {
    ...measured,
    lensDiameter: 14,
    lensCollarDiameter: 16.5,
    lensCollarHeight: 4.5,
  };
  assert.deepEqual(importEverywhere(validCustom).file.parameters, validCustom);
  for (const key of profileKeys) {
    const partial = { ...originalImx, [key]: measured[key] };
    assert.throws(() => parseConfiguration(JSON.stringify(document(partial, oldImx)), parts));
    assert.throws(() => parseProject(JSON.stringify(oldProject(partial, oldImx)), parts));
  }
  for (const invalid of [
    { ...measured, lensProfile: 'conical' },
    { ...measured, lensProfile: false },
    { ...measured, lensCollarDiameter: 100 },
    { ...measured, lensCollarDiameter: 13 },
    { ...measured, lensCollarHeight: -1 },
    { ...measured, lensCollarHeight: 16 },
  ]) {
    assert.throws(() => parseConfiguration(JSON.stringify(document(invalid, canonicalImx)), parts));
    assert.throws(() => parseProject(JSON.stringify(oldProject(invalid, canonicalImx)), parts));
  }
  const input = document(originalImx, oldImx);
  const before = structuredClone(input);
  configurationFromDocument(input, parts);
  assert.deepEqual(input, before);
});

test('current measured schemas round-trip unchanged and old aliases remain import-only', () => {
  const { file, link, project } = importEverywhere(measured, canonicalImx);
  assert.deepEqual(file.parameters, measured);
  assert.deepEqual(link.parameters, measured);
  const component = {
    id: 'camera',
    libraryId: camera.id,
    parameters: file.parameters,
    state: file.state,
    presetId: file.presetId,
    name: camera.name,
    supply: camera.product.supply,
    quantity: 1,
    placement: {
      translation: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    },
  };
  const serialized = JSON.parse(
    decodeURIComponent(configurationLink(component).slice('#configuration='.length)),
  );
  assert.equal(serialized.presetId, canonicalImx);
  assert.deepEqual(serialized.parameters, measured);
  assert.deepEqual(parseProject(serializeProject(project, parts), parts), project);
  assert.equal(resolveLibraryEntry(parts, `board-camera-19:${oldImx}`), undefined);
  assert.equal(selectedMatchingPreset(camera, measured, oldImx), undefined);
  assert.ok(validateParameters(camera, originalImx, 'default').length > 0);
  assert.throws(() =>
    configureProduct({ part: camera, parameters: originalImx, state: 'default', presetId: oldImx }),
  );
  assert.throws(() =>
    parseConfiguration(JSON.stringify({ ...document(originalImx, oldImx), version: 2 }), parts),
  );
  assert.throws(() =>
    parseProject(JSON.stringify({ ...oldProject(originalImx, oldImx), schemaVersion: 2 }), parts),
  );
});
