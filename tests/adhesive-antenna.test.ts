import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import antenna from '../src/parts/adhesive-antenna/part';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { modelEvidence } from '../src/core/model-evidence';
import { libraryArea } from '../src/core/library-navigation';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { resolveLibraryEntry } from '../src/core/library-identity';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
} from '../src/core/preset-search';
import {
  addProduct,
  createProject,
  parseProject,
  projectReadiness,
  serializeProject,
  specificationRows,
} from '../src/core/design-project';
import { eskdIdentity } from '../src/core/eskd';
import { exportOpenEskd } from '../src/core/open-eskd';
import { generateScript } from '../src/core/freecad';
import type { Parameters } from '../src/core/types';

test('JCG108 fixed configurations retain the documented lead alternatives without invented connector codes', () => {
  assert.equal(antenna.catalogSelectionOnly, true);
  assert.deepEqual(
    antenna.parameters.map((field) => field.key),
    ['model'],
  );
  assert.deepEqual(antenna.presetMatchKeys, ['model']);
  assert.equal(antenna.states, undefined);
  assert.equal(
    antenna.composition,
    undefined,
    'a housing display must not create procurement children',
  );
  assert.equal(libraryArea(antenna.category), 'electronics');
  assert.equal(antenna.subgroup, 'RADIO MODULES');
  assert.deepEqual(
    antenna.presets.map((preset) => [
      preset.id,
      preset.catalog!.designation,
      preset.catalog!.attributes!.leadLength,
    ]),
    [
      ['jcg108-3m', 'JCG108', 3000],
      ['jcg108-5m', 'JCG108', 5000],
    ],
  );
  for (const preset of antenna.presets) {
    const catalog = preset.catalog!;
    assert.deepEqual(validateParameters(antenna, preset.parameters, 'default'), []);
    assert.deepEqual(catalog.verifiedParameters, ['model']);
    assert.deepEqual(catalog.productCodes, ['JCG108']);
    assert.equal(catalog.attributes!.connector, 'SMA or others — execution unspecified');
    assert.equal(catalog.attributes!.cableType, 'RG174');
    assert.equal(catalog.attributes!.frequencyBands, '824–960 / 1710–2170 MHz');
    assert.equal(catalog.attributes!.gain, 2.5);
    assert.equal(catalog.attributes!.impedance, 50);
    assert.equal(catalog.attributes!.radomeMaterial, 'PVC');
    assert.equal(catalog.attributes!.mounting, 'Adhesive');
    assert.equal(
      catalog.attributes!.frequencyMin,
      undefined,
      'disjoint bands must not become continuous coverage',
    );
    assert.match(
      catalog.attributeConditions!.leadLength,
      /lower central housing datum to connector tip/,
    );
    assert.match(catalog.attributeConditions!.connector, /Gender, polarity.*unknown/);
    assert.ok(antenna.catalogFilterFields!.every((field) => !(field.key in preset.parameters)));
  }
  const filters = emptyPresetFilters(antenna);
  const length = antenna.catalogFilterFields!.find((field) => field.key === 'leadLength')!;
  filters.parameters[fieldId(length)] = { min: '4900', max: '5100' };
  assert.deepEqual(
    filterPresets(buildPresetIndex([antenna]), filters).items.map((entry) => entry.preset.id),
    ['jcg108-5m'],
  );
});

test('JCG108 source evidence retains drawing integrity and separate PCB dimensions from the housing', () => {
  const drawing = readFileSync(
    new URL('../public/references/antennas/jinchang-jcg108.png', import.meta.url),
  );
  const hash = (input: Buffer) => createHash('sha256').update(input).digest('hex');
  assert.equal(hash(drawing), '95294ea110af143ee015e42f81d1a6b11137d8eb866ba58ebd2f185bdc5ec7b9');
  for (const preset of antenna.presets) {
    const catalog = preset.catalog!;
    assert.equal(
      catalog.geometryEvidence!.sourceSha256,
      '71e07e7e341c0bd8baa98326bab27011891bca7b70d7c0f7dd1bdfd1d31f0cff',
    );
    assert.equal(catalog.attributes!.bodyLength, 126);
    assert.equal(catalog.attributes!.bodyHeight, 15.5);
    assert.equal(catalog.attributes!.overallHeight, 16.2);
    assert.equal(catalog.attributes!.bodyDepth, 8.6);
    assert.equal(catalog.attributes!.pcbLength, 115);
    assert.equal(catalog.attributes!.pcbWidth, 9);
    assert.equal(catalog.attributes!.pcbThickness, 0.8);
    assert.match(catalog.attributeConditions!.bodyLength, /±2 mm/);
    for (const key of ['bodyHeight', 'overallHeight', 'bodyDepth'])
      assert.match(catalog.attributeConditions![key], /±1 mm/);
    assert.match(catalog.attributeConditions!.overallHeight, /Excludes strain relief and cable/);
  }
});

test('JCG108 preview and reported dimensions preserve nominal housing extrema and reference scope', () => {
  assert.equal(antenna.product.kind, 'reference');
  assert.equal(antenna.product.supply, 'reference');
  assert.match(
    antenna.validationNotice!,
    /contour details, cable and connector geometry remain unverified/,
  );
  for (const preset of antenna.presets) {
    const evidence = modelEvidence(antenna, preset.parameters, preset.id);
    assert.equal(evidence.kind, 'envelope');
    assert.match(evidence.limitations, /Not manufacturer CAD or a complete accurate antenna/);
    assert.match(evidence.limitations, /Cable, connector, strain relief, adhesive.*omitted/);
    assert.deepEqual(antenna.dimensions(preset.parameters, 'default'), [126, 16.2, 8.6]);
    const group = antenna.buildGeometry(preset.parameters, 'default');
    try {
      const meshes: Mesh[] = [];
      group.traverse((object) => {
        if (object instanceof Mesh) meshes.push(object);
      });
      assert.equal(meshes.length, 1, 'only the fused nominal housing reference is represented');
      assert.match(meshes[0].name, /nominal housing reference/);
      const bounds = new Box3().setFromObject(group, true);
      bounds
        .getSize(new Vector3())
        .toArray()
        .forEach((value, index) => assert.ok(Math.abs(value - [126, 16.2, 8.6][index]) < 0.01));
      bounds.min
        .toArray()
        .forEach((value, index) => assert.ok(Math.abs(value - [-63, -8.1, 0][index]) < 0.01));
      const native = antenna.python(preset.parameters, 'default');
      assert.match(native, /Part\.Arc\(/);
      assert.match(native, /Part\.makeCylinder\(/);
      assert.doesNotMatch(native, /makePolygon|makeShell|makeSolid/);
    } finally {
      disposeModel(group);
    }
  }
});

test('JCG108 rejects invented dimensions, unsupported executions and inspection states', () => {
  const invalidConfigurations: Parameters[] = [
    {},
    { model: 'missing' },
    { ...antenna.defaults, width: 120 },
    { ...antenna.defaults, leadLength: 4000 },
    { ...antenna.defaults, connector: 'RP-SMA male' },
  ];
  for (const parameters of invalidConfigurations) {
    assert.ok(validateParameters(antenna, parameters, 'default').length);
    assert.throws(() => generateScript(antenna, parameters, 'default'));
  }
  for (const state of ['assembled', 'exploded', 'cutaway'])
    assert.ok(validateParameters(antenna, antenna.defaults, state).length);
});

test('exact antenna model IDs select their lead execution independently of display names', () => {
  const index = buildLibrarySearchIndex(groupBrowseFamilies([antenna]));
  for (const preset of antenna.presets) {
    const id = `${antenna.id}:${preset.id}`;
    const resolved = resolveLibraryEntry([antenna], id)!;
    assert.strictEqual(resolved.part, antenna);
    assert.strictEqual(resolved.preset, preset);
    assert.deepEqual(
      searchLibrary(index, id).map((match) => [match.family.id, match.articleQuery]),
      [[antenna.id, id]],
    );
    const filtered = filterPresets(buildPresetIndex([antenna]), {
      ...emptyPresetFilters(antenna),
      query: id,
    });
    assert.deepEqual(
      filtered.items.map((entry) => entry.preset.id),
      [preset.id],
    );
    const renamed = { ...antenna, name: 'Different family label', category: 'Renamed category' };
    assert.strictEqual(resolveLibraryEntry([renamed], id)!.preset, preset);
  }
  assert.deepEqual(searchLibrary(index, 'adhesive-antenna:missing'), []);
});

test('JCG108 project round trips retain separate configurations while production export remains blocked', () => {
  let project = createProject();
  for (const preset of antenna.presets) {
    const selection = {
      part: antenna,
      parameters: preset.parameters,
      state: 'default',
      presetId: preset.id,
    };
    project = addProduct(project, [antenna], selection).project;
    project = addProduct(project, [antenna], selection).project;
  }
  const restored = parseProject(serializeProject(project, [antenna]), [antenna]);
  assert.equal(restored.configurations.length, 2);
  assert.equal(restored.occurrences.length, 4);
  assert.ok(
    restored.occurrences.every(
      (occurrence) => occurrence.quantity === 1 && occurrence.parentId === null,
    ),
  );
  for (const preset of antenna.presets) {
    const configuration = restored.configurations.find((item) => item.presetId === preset.id)!;
    assert.equal(configuration.libraryId, antenna.id);
    assert.deepEqual(configuration.parameters, preset.parameters);
    assert.equal(configuration.supply, 'reference');
    const identity = eskdIdentity(
      antenna,
      configuration.parameters,
      configuration.state,
      configuration.presetId,
      configuration,
    );
    assert.equal(identity.libraryEntryId, `${antenna.id}:${preset.id}`);
    assert.equal(
      identity.configurationKey,
      eskdIdentity(antenna, preset.parameters, 'default', preset.id).configurationKey,
    );
    const macro = generateScript(antenna, preset.parameters, 'default', preset.id, configuration);
    assert.ok(macro.includes(`${antenna.id}:${preset.id}`));
    assert.ok(macro.includes('JCG108'));
  }
  assert.ok(
    projectReadiness(restored, [antenna]).issues.some((issue) =>
      /reference geometry cannot be released/.test(issue),
    ),
  );
  assert.equal(specificationRows(restored, [antenna]).length, 0);
  assert.throws(() => exportOpenEskd(restored, [antenna]), /resolve reference geometry/);
});
