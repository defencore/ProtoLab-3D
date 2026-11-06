import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import part from '../src/parts/jcg108-tube-fairing/part';
import { defaults } from '../src/parts/jcg108-tube-fairing/configurator';
import { fairingSpec, fairingStations } from '../src/parts/jcg108-tube-fairing/lib/fairing';
import {
  antennaOccurrence,
  anchorOccurrences,
  libraries,
} from '../src/parts/jcg108-tube-fairing/lib/model';
import { addProduct, createProject, supplyRows } from '../src/core/design-project';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';

test('the preserved fairing is an independent reference, without fabrication or procurement rows', () => {
  assert.equal(part.id, 'jcg108-tube-fairing');
  assert.equal(part.product.kind, 'reference');
  assert.equal(part.product.supply, 'reference');
  assert.ok(!libraries.some((v) => v.id === 'grandado-tube-mount'));
  const parts = [part, ...libraries];
  for (const state of part.states!) {
    const project = addProduct(createProject('Future fairing'), parts, {
      part,
      parameters: defaults,
      state: state.id,
      presetId: part.presets[0].id,
    }).project;
    assert.equal(project.configurations.length, 1);
    assert.equal(project.configurations[0].state, 'assembled');
    assert.equal(project.configurations[0].supply, 'reference');
    assert.deepEqual(supplyRows(project, parts, 'purchased'), []);
    assert.deepEqual(supplyRows(project, parts, 'manufactured'), []);
  }
});

test('fit controls never resize or reidentify either published JCG108 source execution', () => {
  for (const antennaModel of ['jcg108-3m', 'jcg108-5m']) {
    const source = libraries.find((v) => v.id === 'adhesive-antenna')!;
    for (const antennaDepth of [7.6, 8.6, 9.6]) {
      const p = { ...defaults, antennaModel, antennaDepth };
      const occurrence = antennaOccurrence(p);
      assert.equal(occurrence.component.libraryId, 'adhesive-antenna');
      assert.equal(occurrence.component.presetId, antennaModel);
      assert.deepEqual(occurrence.component.parameters, { model: antennaModel });
      assert.deepEqual(source.validate(occurrence.component.parameters, 'default'), []);
      assert.deepEqual(
        source.dimensions(occurrence.component.parameters, 'default'),
        [126, 16.2, 8.6],
      );
      assert.equal(fairingSpec(p).contactPlaneRadius, 45.3 + antennaDepth);
    }
  }
});

test('flow reverses the retained design while preserving printable backed edges and crown height', () => {
  const forward = fairingStations(defaults);
  const reverse = fairingStations({ ...defaults, airflowDirection: 'negative-x' });
  assert.equal(forward.at(-1)![0][0] - forward[0][0][0], 314.8);
  assert.equal(fairingSpec(defaults).apexAbovePipe, 12.5);
  for (let i = 0; i < forward.length; i++) {
    const a = forward[i],
      b = reverse[reverse.length - 1 - i];
    for (let j = 0; j < a.length; j++) {
      assert.ok(Math.abs(a[j][0] + b[j][0]) < 1e-9);
      assert.deepEqual(a[j].slice(1), b[j].slice(1));
      assert.ok(Math.hypot(a[j][1], a[j][2]) >= 46 - 1e-9);
    }
  }
  assert.equal(Math.max(...forward.flat().map((v) => -v[2])), 57.5);
});

test('reference interfaces remain source-valid and obsolete kit-only settings fail closed', () => {
  for (const preset of part.presets) {
    for (const state of part.states!)
      assert.deepEqual(part.validate(preset.parameters, state.id), []);
    for (const occurrence of anchorOccurrences(preset.parameters)) {
      const source = libraries.find((v) => v.id === occurrence.component.libraryId)!;
      assert.deepEqual(
        source.validate(occurrence.component.parameters, occurrence.component.state),
        [],
      );
      assert.equal(occurrence.component.parameters.length, 25);
    }
  }
  assert.ok(
    part.validate({ ...defaults, mountPitch: 99 }, 'assembled').some((v) => /unsupported/.test(v)),
  );
  assert.ok(
    part
      .validate({ ...defaults, antennaY: -14, antennaHole: 16 }, 'assembled')
      .some((v) => /beside/.test(v)),
  );
  assert.ok(part.validate(defaults, 'antenna-print').length);
});

test('the actual reference printing pose fits a 256 mm bed with five-millimetre margins', () => {
  const model = part.buildExportGeometry!(defaults, 'print-only');
  try {
    const box = new Box3().setFromObject(model, true),
      size = box.getSize(new Vector3());
    assert.ok(size.x <= 246 && size.y <= 246 && size.z <= 246, size.toArray().join(' × '));
    assert.ok(Math.abs(box.min.z) < 0.03, `bed Z ${box.min.z}`);
    assert.equal(model.children.length, 1);
  } finally {
    disposeModel(model);
  }
  const source = componentGeometry(libraries, [antennaOccurrence(defaults)]);
  try {
    assert.deepEqual(
      new Box3()
        .setFromObject(source, true)
        .getSize(new Vector3())
        .toArray()
        .map((v) => Math.round(v * 10) / 10),
      [126, 16.2, 8.6],
    );
  } finally {
    disposeModel(source);
  }
});
