import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part, { states } from '../src/parts/grandado-tube-mount/part';
import { layout, connectorReliefs } from '../src/parts/grandado-tube-mount/lib/spec';
import {
  composition,
  configuredPieces,
  printedPieces,
  payload,
  hardware,
  libraries,
} from '../src/parts/grandado-tube-mount/lib/model';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { availableModelState } from '../src/core/part-selection';
import { addProduct, createProject, validateProject, supplyRows } from '../src/core/design-project';

test('tube kit uses the existing Grandado and 3S holder and keeps exact apex protrusion', () => {
  const d = layout(part.defaults);
  assert.equal(d.boxTop, 46);
  assert.equal(d.boxBottom, 9.2);
  assert.equal(d.bodyHardHeight, 22);
  assert.equal(d.bodyIncludingRimHeight, 23.8);
  assert.equal(d.bodyRimHeight, 1.8);
  assert.equal(d.bodySeamZ, 31.2);
  assert.equal(d.bodyRimTopZ, 33);
  assert.equal(d.earThickness, 6);
  assert.ok(Math.abs(d.earPocketTop - d.boxBottom - 6.2) < 1e-9);
  assert.ok(Math.abs(d.holderTop + 0.8) < 1e-9);
  assert.equal(d.boxTop - d.radius, 1);
  assert.deepEqual([d.holderLength, d.holderWidth, d.holderHeight], [77.7, 59.69, 21.54]);
  assert.deepEqual(
    payload(part.defaults).slice(0, 2).map((v) => [v.component.libraryId, v.component.parameters.model]),
    [
      ['catalog-enclosure', 'grandado-83-58-35-clear'],
      ['li-ion-battery-holder', 'beilamoo-3s'],
    ],
  );
  const grandado = componentGeometry(libraries, payload(part.defaults).slice(0, 1));
  try {
    assert.equal(payload(part.defaults)[0].component.state, 'body-only');
    let meshCount = 0;
    grandado.traverse((object) => { if (object instanceof Mesh) meshCount++; });
    assert.equal(meshCount, 5, 'body and four inserts; source screws use lowered lid seats');
    assert.ok(new Box3().setFromObject(grandado, true).max.z < d.boxTop);
  } finally {
    disposeModel(grandado);
  }
});

test('both window presets are explicit and every installation or printing state validates', () => {
  for (const preset of part.presets)
    for (const state of states)
      assert.deepEqual(
        validateParameters(part, preset.parameters, state.id),
        [],
        `${preset.id}/${state.id}`,
      );
  assert.deepEqual(
    part.presets.map((p) => layout(p.parameters).windowWidth),
    [58.6, 58],
  );
  const d = layout(part.defaults);
  assert.ok(2 * d.radius * Math.asin(d.windowWidth / d.od) > d.windowWidth + 5);
});

test('end-disc hardware retains valid physical configurations through inspection views', () => {
  for (const preset of part.presets) {
    const physical = hardware(preset.parameters).map((piece) => piece.component);
    assert.equal(physical.length, 16);
    for (const component of physical) {
      const target = libraries.find((library) => library.id === component.libraryId)!;
      assert.equal(component.state, 'default', component.name);
      assert.deepEqual(validateParameters(target, component.parameters, component.state), [], component.name);
      assert.deepEqual(composition(preset.parameters).components.find((item) => item.id === component.id), component);
      for (const state of ['assembled', 'cutaway', 'cassette', 'exploded'])
        assert.deepEqual(
          configuredPieces(preset.parameters, state).find((piece) => piece.component.id === component.id)!.component,
          component,
          `${preset.id}/${state}/${component.id} retains its physical definition and installed placement`,
        );
    }
  }
});

test('holder envelope, impossible bore and stale parameters fail explicitly', () => {
  assert.ok(
    part.validate({ ...part.defaults, powerCableDiameter: 4.8, connectorClearance: 1 }, 'assembled')
      .some((message) => /6 mm passages/.test(message)),
  );
  assert.deepEqual(part.validate({ ...part.defaults, powerCableDiameter: 4.8, connectorClearance: 0.6 }, 'assembled'), []);
  assert.ok(part.validate({ ...part.defaults, powerCableDiameter: 3, connectorClearance: 0.5 }, 'assembled')
    .some((message) => /rounded wire bends/.test(message)));
  assert.ok(
    part
      .validate({ ...part.defaults, screwLength: 38, protrusion: 0.5 }, 'assembled')
      .some((v) => /Unsupported/.test(v)),
  );
  assert.ok(
    part
      .validate({ ...part.defaults, holderWidth: 58 }, 'assembled')
      .some((v) => /library 3S holder/.test(v)),
  );
  assert.ok(
    part
      .validate({ ...part.defaults, oldClamp: true }, 'assembled')
      .some((v) => /Unsupported/.test(v)),
  );
  assert.ok(part.validate({ ...part.defaults, tubeID: 90 }, 'assembled').length);
});

test('connector reserves use the supplied face positions and adjustable clearances', () => {
  const d = layout(part.defaults);
  const [sma, power] = connectorReliefs({ ...d, connectorClearance: 0 });
  assert.equal(sma.kind, 'box');
  assert.equal(power.kind, 'cylinder');
  if (sma.kind !== 'box' || power.kind !== 'cylinder') return;
  assert.deepEqual(sma.origin, [41.5, -19, d.boxBottom + 0.9]);
  assert.deepEqual(sma.size, [14, 11, 19.1]);
  assert.deepEqual(power.origin, [0, -29, d.boxBottom + 12]);
  assert.equal(power.radius, 9.5);
  assert.equal(power.height, 12);
  assert.equal(power.axis, 'y', 'power connector extends into the enclosure');
  assert.equal(connectorReliefs(d).length, 2, 'wire geometry comes only from the authoritative routed-lead definition');
});

test('manufacturing exports omit electronics, tube references and steel hardware', () => {
  const exportPieces = configuredPieces(part.defaults, 'assembled', true);
  assert.ok(exportPieces.length >= 6);
  assert.ok(
    exportPieces.every(
      (v) =>
        v.component.libraryId === 'manufactured-detail' && v.component.supply === 'manufactured',
    ),
  );
  const preview = configuredPieces(part.defaults, 'cutaway');
  assert.ok(preview.some((v) => v.component.id === 'reference-tube'));
  assert.ok(preview.some((v) => v.component.id === 'holder-3s'));
  assert.equal(preview.filter((v) => v.component.supply === 'standard').length, 16);
  assert.ok(preview.filter((v) => v.component.supply === 'standard').every((v) => v.component.id.startsWith('disc-')));
  const bom = composition(part.defaults);
  assert.ok(bom.components.some((v) => v.libraryId === 'catalog-enclosure'));
  assert.ok(bom.components.some((v) => v.libraryId === 'li-ion-battery-holder'));
  assert.equal(bom.components.filter(v => v.supply === 'manufactured' && v.id.startsWith('grandado-lid-screw-')).length, 4);
  assert.equal(new Set(printedPieces(part.defaults).map((v) => v.id)).size, 18);
  assert.ok(exportPieces.some((v) => v.component.id === 'upper-cylinder-shell'));
  for (const id of ['lower-cylinder-negative', 'lower-cylinder-positive', 'cell-keeper-bridge', 'end-disc-negative', 'end-disc-positive', 'grandado-curved-replacement-lid'])
    assert.ok(exportPieces.some((v) => v.component.id === id), id);
  const cover = configuredPieces(part.defaults, 'cover-only', true);
  assert.equal(cover.length, 1);
  assert.equal(cover[0].component.id, 'grandado-curved-replacement-lid');
  assert.ok(!exportPieces.some(v => /jcg108|shroud|antenna-cover/.test(v.component.id)));
});

test('all eight pipe screws retain their original lengths and source lid screws keep their parent enclosure', () => {
  const screws = hardware(part.defaults).filter(v => v.component.id.endsWith('-screw'));
  assert.equal(screws.length, 8);
  assert.ok(screws.every(v => v.component.parameters.length === 12));
  assert.deepEqual(hardware(part.defaults), hardware({ ...part.defaults, antenna: false }));
  assert.equal(availableModelState(part, part.defaults, 'antenna-print'), 'assembled');
  const factory = payload(part.defaults).filter(v => v.component.id.startsWith('grandado-lid-screw-'));
  assert.equal(factory.length, 4);
  assert.ok(factory.every(v => v.component.supply === 'manufactured' && v.component.manufacturing?.processes.includes('cutting')));
  assert.equal(composition(part.defaults).components.filter(v => v.libraryId === 'catalog-enclosure').length, 1);
  for (const state of ['assembled', 'cutaway', 'cassette', 'exploded']) {
    for (const source of factory) {
      const item = configuredPieces(part.defaults, state).find(v => v.component.id === source.component.id)!;
      assert.deepEqual(item.component, source.component, `${state} preserves source screw identity`);
    }
  }
});

test('each cassette part lies on the print bed in the supplied layout', () => {
  const model = part.buildExportGeometry!(part.defaults, 'cassette-print');
  try {
    for (const child of model.children) {
      const bounds = new Box3().setFromObject(child, true);
      assert.ok(Math.abs(bounds.min.z) < 1e-4, `${child.name} bed contact ${bounds.min.z}`);
      const size = bounds.getSize(new Vector3());
      assert.ok(size.x > 0 && size.y > 0 && size.z > 0);
    }
  } finally {
    disposeModel(model);
  }
});

test('project round trips retain four modified supplied screws as one cutting definition without extra procurement', () => {
  const parts = [part, ...libraries];
  const added = addProduct(createProject(), parts, {
    part, parameters: part.defaults, state: 'assembled', presetId: 'd90-86-fit',
  });
  const project = JSON.parse(JSON.stringify(added.project));
  assert.deepEqual(validateProject(project, parts), []);
  const modified = project.configurations.filter((v: { name: string }) => v.name.includes('tip shortened'));
  assert.equal(modified.length, 1, 'all four original screws share the same source-derived physical definition');
  const installed = project.occurrences.filter((v: { configurationId: string }) => v.configurationId === modified[0].id);
  assert.equal(installed.length, 4);
  assert.equal(supplyRows(project, parts, 'manufactured').find(v => v.configurationId === modified[0].id)?.quantity, 4);
  const buys = supplyRows(project, parts, 'purchased');
  assert.deepEqual(buys.map(v => Number(v.quantity)).sort((a, b) => a-b), [1, 1, 8, 8]);
  assert.ok(!buys.some(v => /tip shortened/.test(v.name)), 'factory-supplied screws are not purchased again');
  const grandado = project.configurations.find((v: { libraryId: string }) => v.libraryId === 'catalog-enclosure');
  assert.equal(grandado.presetId, 'grandado-83-58-35-clear');
  assert.match(grandado.procurement.source, /grandado/);
});

test('shared trimmed factory screw recipes preserve the four actual installed head and tip positions', () => {
  const screws = payload(part.defaults).filter(v => v.component.id.startsWith('grandado-lid-screw-'));
  for (const screw of screws) {
    const model = componentGeometry(libraries, [screw]);
    try {
      const bounds = new Box3().setFromObject(model, true);
      const placement = screw.component.placement.translation;
      assert.ok(Math.abs((bounds.min.x + bounds.max.x) / 2 - placement[0]) < .001);
      assert.ok(Math.abs((bounds.min.y + bounds.max.y) / 2 - placement[1]) < .001);
      assert.ok(Math.abs(bounds.min.z - 21.9) < .001);
      assert.ok(Math.abs(bounds.max.z - 35.5) < .001);
    } finally { disposeModel(model); }
  }
});


test('gasket inspection exports retain the same non-procured envelope as their preview and native recipe', () => {
  const p = part.defaults;
  const preview = part.buildGeometry(p, 'seal-interface');
  const exported = part.buildExportGeometry!(p, 'seal-interface');
  try {
    assert.equal(preview.children.length, 2);
    assert.equal(exported.children.length, 2);
    assert.deepEqual(part.dimensions(p, 'seal-interface'), part.exportDimensions!(p, 'seal-interface'));
    assert.match(part.python(p, 'seal-interface'), /Gasket channel occupied-space reference/);
    assert.ok(!composition(p).components.some(v => v.id === 'lid-gasket-envelope-reference'));
  } finally { disposeModel(preview); disposeModel(exported); }
});
