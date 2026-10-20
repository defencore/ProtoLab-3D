import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import machine, { millingLibraries, millingPieces } from '../src/parts/cnc-milling-machine/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import type { ManufacturingDefinition, ProcurementDefinition } from '../src/core/product-types';
import {
  addProduct,
  createProject,
  projectReadiness,
  supplyRows,
} from '../src/core/design-project';

type Metadata = Record<string, string>;

function generatedHandoff(source: string) {
  const start = source.lastIndexOf('\n_pl_handoff = json.loads(');
  assert.ok(start > 0, 'the real native generator includes its handoff application');
  const code = source.slice(start + 1);
  const encoded = code.split('\n', 1)[0].match(/^_pl_handoff = json\.loads\((.+)\)$/);
  assert.ok(encoded);
  const records = JSON.parse(JSON.parse(encoded[1])) as Metadata[];
  const identities = source
    .slice(0, start)
    .split('\n')
    .flatMap((line) => {
      const match = line.match(
        /^component_metadata\.append\(dict\(local_metadata, \*\*(\{.+\})\)\)$/,
      );
      return match ? [JSON.parse(match[1]) as Metadata] : [];
    });
  return { code, records, identities };
}

/** Execute only the generated metadata application, without constructing any CAD geometry. */
function applyHandoff(code: string, metadata: Metadata[]) {
  return spawnSync(
    'python3',
    [
      '-c',
      [
        'import json,sys',
        'payload=json.load(sys.stdin)',
        'scope={"json":json,"component_metadata":payload["metadata"]}',
        'exec(payload["code"],scope)',
        'json.dump(scope["component_metadata"],sys.stdout)',
      ].join('\n'),
    ],
    { input: JSON.stringify({ code, metadata }), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
}

test('actual native CAD leaves retain exact handoff routes and intrinsic metadata in both modes and partial inspections', () => {
  for (const state of ['assembled', 'mechanism', 'z-head', 'bed']) {
    const pieces = millingPieces(machine.defaults, state);
    for (const mode of ['simple', 'full'] as const) {
      const source = withGeometryMode(mode, () => machine.python(machine.defaults, state));
      const { code, records, identities } = generatedHandoff(source);
      assert.equal(records.length, pieces.length, `${state}/${mode}: route count`);
      assert.equal(identities.length, pieces.length, `${state}/${mode}: physical metadata count`);
      const input = identities.map((identity, index) => ({
        ...identity,
        ExistingSupplierMetadata: `unchanged-${index}`,
        ThreadFeaturesJSON: JSON.stringify([{ designation: 'M3', length: 6, origin: [1, 2, 3] }]),
      }));
      const result = applyHandoff(code, input);
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      const actual = JSON.parse(result.stdout) as Metadata[];
      for (const [index, piece] of pieces.entries()) {
        const component = piece.component;
        assert.deepEqual(identities[index], {
          LibraryId: component.libraryId,
          ConfigurationJSON: JSON.stringify(component.parameters),
          Supply: component.supply,
        });
        const expected = {
          ...(component.manufacturing
            ? { ManufacturingJSON: JSON.stringify(component.manufacturing) }
            : {}),
          ...(component.procurement
            ? { ProcurementJSON: JSON.stringify(component.procurement) }
            : {}),
        };
        assert.deepEqual(records[index], expected, component.id);
        assert.deepEqual(actual[index], { ...input[index], ...expected }, component.id);
      }
    }
  }
});

test('native M10 cut ties are manufactured inputs rather than fictitious finished supplier orders', () => {
  const pieces = millingPieces(machine.defaults, 'assembled');
  const source = withGeometryMode('full', () => machine.python(machine.defaults, 'assembled'));
  const { records } = generatedHandoff(source);
  const ties = pieces.flatMap((piece, index) =>
    piece.component.libraryId === 'threaded-rod' ? [{ component: piece.component, index }] : [],
  );
  assert.equal(ties.length, 8);
  for (const { component, index } of ties) {
    assert.equal(component.supply, 'manufactured');
    assert.equal(component.presetId, undefined);
    assert.equal(component.procurement, undefined);
    assert.equal(component.parameters.diameter, 10);
    assert.equal(component.parameters.pitch, 1.5);
    assert.equal(component.parameters.length, 287.2);
    assert.equal(records[index].ProcurementJSON, undefined);
    const manufacturing = JSON.parse(records[index].ManufacturingJSON) as ManufacturingDefinition;
    assert.deepEqual(manufacturing, component.manufacturing);
    assert.deepEqual(manufacturing.processes, ['cutting']);
    assert.match(manufacturing.material, /class8\.8.*certificate required/);
    assert.match(manufacturing.blank, /Three published M10 x 1000.*eight finished ties to287\.2/);
    assert.ok(manufacturing.requirements.some((line) => line.includes('kl-pr-8-8-m10h1000')));
    assert.ok(
      manufacturing.requirements.some((line) => line.includes('not a287.2 mm supplier SKU')),
    );
    assert.ok(
      3 * Number(component.parameters.length) < 1000,
      'three cuts leave kerf/end allowance',
    );
    for (const [suffix, library, sourceClass] of [
      ['-nut', 'hex-nut', 'kl-pr-8-0-din-934-m10'],
      ['-washer', 'washer', 'hv-200-tsink-belyj-m10h20h2'],
    ]) {
      const siblingIndex = pieces.findIndex(
        (piece) => piece.component.id === component.id + suffix,
      );
      assert.notEqual(siblingIndex, -1);
      assert.equal(pieces[siblingIndex].component.libraryId, library);
      const procurement = JSON.parse(
        records[siblingIndex].ProcurementJSON,
      ) as ProcurementDefinition;
      assert.deepEqual(procurement, pieces[siblingIndex].component.procurement);
      assert.ok(procurement.source.includes(sourceClass));
      assert.equal(procurement.manufacturer, '', 'an unidentified maker remains unresolved');
      assert.equal(procurement.standard, library === 'washer' ? 'DIN 125' : 'DIN 934');
      assert.equal(records[siblingIndex].ManufacturingJSON, undefined);
    }
  }
});

test('the generated metadata application rejects a missing CAD leaf before zip could truncate the handoff', () => {
  const source = withGeometryMode('simple', () => machine.python(machine.defaults, 'bed'));
  const { code, identities } = generatedHandoff(source);
  assert.ok(identities.length > 1);
  const result = applyHandoff(code, identities.slice(0, -1));
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /ValueError: CAD handoff does not match the physical component count\./,
  );
  assert.equal(result.stdout, '');
});

test('source-qualified hardware retains missing-maker readiness issues and raw stock is not a false finished order', () => {
  const parts = [machine, ...millingLibraries];
  const { project } = addProduct(createProject('Native handoff maker check'), parts, {
    part: machine,
    parameters: machine.defaults,
    state: 'assembled',
  });
  const readiness = projectReadiness(project, parts);
  const hardware = project.configurations.filter(
    (configuration) =>
      configuration.procurement?.designation.includes('HV200') ||
      configuration.procurement?.designation.includes('DIN934 M10 class8 nut'),
  );
  assert.equal(hardware.length, 3, 'M8/M10 hardened washers and M10 class-8 nuts');
  for (const configuration of hardware) {
    assert.equal(configuration.procurement!.manufacturer, '');
    assert.equal(
      configuration.procurement!.standard,
      configuration.libraryId === 'washer' ? 'DIN 125' : 'DIN 934',
    );
    assert.ok(configuration.procurement!.source.startsWith('https://gvyntok.com/'));
    const label = configuration.designation || configuration.name;
    assert.ok(readiness.issues.includes(`${label}: manufacturer is missing.`), label);
    assert.ok(!readiness.issues.includes(`${label}: product standard is missing.`), label);
  }
  const ties = project.configurations.filter(
    (configuration) => configuration.libraryId === 'threaded-rod',
  );
  assert.equal(ties.length, 1);
  assert.equal(ties[0].supply, 'manufactured');
  assert.equal(ties[0].procurement, undefined);
  assert.equal(ties[0].presetId, undefined);
  assert.ok(
    !supplyRows(project, parts, 'purchased').some((row) => row.configurationId === ties[0].id),
  );
  assert.equal(
    supplyRows(project, parts, 'manufactured').find((row) => row.configurationId === ties[0].id)!
      .quantity,
    8,
  );
  assert.equal(readiness.complete, false);
});
