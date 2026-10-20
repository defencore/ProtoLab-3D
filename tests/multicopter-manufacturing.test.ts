import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import frame from '../src/parts/multicopter-frame/part';
import component from '../src/parts/multicopter-frame-component/part';
import {
  models,
  frames,
  sourceFrame,
  assemblyPlacement,
  sheetFabrication,
} from '../src/parts/multicopter-frame-component/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { composition } from '../src/parts/multicopter-frame/lib/model';
import frameModule from '../src/parts/multicopter-frame';
import componentModule from '../src/parts/multicopter-frame-component';
import { registerPartModules } from '../src/core/part-modules';

test('six pinned real source frames retain distinct physical constructions', () => {
  assert.doesNotThrow(() => registerPartModules([componentModule, frameModule]));
  assert.equal(frame.presets.length, 6);
  assert.equal(models.length, 152);
  assert.equal(new Set(frames.map((f) => f.source.sha256)).size, 6);
  for (const preset of frame.presets) {
    const f = sourceFrame(preset.id);
    assert.equal(preset.catalog?.geometryEvidence?.sourceSha256, f.source.sha256);
    assert.deepEqual(validateParameters(frame, preset.parameters, 'assembled'), [], f.id);
    assert.equal(composition(preset.parameters).components.length, f.parts.length);
  }
  for (const key of [
    'armStyle',
    'plateMaterial',
    'printMaterial',
    'wheelbase',
    'tubeFit',
    'ribHeight',
  ])
    assert.equal(
      frame.parameters.some((f) => f.key === key),
      false,
    );
  assert.match(frame.validationNotice!, /flight checks pending/);
  assert.deepEqual(validateParameters(frame, frame.defaults, 'assembled'), []);
  assert.equal(sourceFrame('source-one-v5').parts.filter((m) => m.route === 'sheet').length, 10);
});
test('source assembly retains both clamping plates, keyed root plate, cheeks and hardware', () => {
  const one = sourceFrame('source-one-v5');
  const assembly = composition(frame.defaults);
  assert.equal(assembly.components.length, 57);
  for (const index of [2, 3, 4, 5, 6, 52, 53, 54, 55, 56]) {
    const m = one.parts.find((m) => m.sourceIndex === index)!;
    const c = assembly.components.find((c) => c.id === m.id)!;
    assert.equal(c.libraryId, 'multicopter-frame-component');
    assert.deepEqual(c.parameters, { component: m.id });
    assert.deepEqual(c.placement.translation, m.placement);
  }
  assert.ok(assembly.issues.some((s) => s.includes('Flight release')));
  assert.ok(assembly.issues.some((s) => s.includes('2.5 mm')));
  assert.equal(one.parts.filter((m) => m.route === 'print').length, 1);
  assert.ok(
    models
      .filter((m) => m.route === 'print' && m.frameId !== 'comet-y6')
      .every((m) => !/arm/i.test(m.label)),
  );
});
test('SOURCE ONE fastener bearing datums match the 2.5 mm lower plate and deck', () => {
  for (const m of sourceFrame('source-one-v5').parts) {
    const offset = assemblyPlacement(m)[2] - m.placement[2];
    const lower = [19, 24, 25, 28, 29, 30, 31, 36, 39, 40, 41, 42].includes(m.sourceIndex);
    assert.ok(Math.abs(offset - (lower ? -0.5 : [23, 35].includes(m.sourceIndex) ? -2 : 0)) < 1e-9);
  }
});
test('all carbon sheets have flat cutting poses including vertical SOURCE V webs', () => {
  assert.equal(Object.keys(sheetFabrication).length, 51);
  for (const m of models.filter((m) => m.route === 'sheet')) {
    const flat = sheetFabrication[m.id];
    assert.ok(flat && flat.size[2] >= 1 && flat.size[2] < 6.01, m.id);
  }
  assert.equal(sheetFabrication['source-v-v1-04'].thickness, 2);
  assert.equal(sheetFabrication['part-02'].thickness, 2.5);
  assert.ok(Math.abs(sheetFabrication['source-v-v1-04'].rotation[1]) > 1);
});
test('Y6 and X8 retain paired physical motor supports and source fabrication routes', () => {
  for (const id of ['comet-y6', 'source-one-x8']) {
    const f = sourceFrame(id);
    assert.equal(f.motorCount, id === 'comet-y6' ? 6 : 8);
    assert.equal(f.motorStations.length * 2, f.motorCount);
    assert.equal(f.arms.length, f.motorStations.length);
    for (const s of f.motorStations) {
      assert.ok(s.upperMountZ > s.lowerMountZ);
      assert.ok(f.parts.find((m) => m.sourceIndex === s.upperPart));
      assert.ok(f.parts.find((m) => m.sourceIndex === s.lowerPart));
    }
    const minimum = Math.min(
      ...f.motorStations.flatMap((a, i) =>
        f.motorStations.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
      ),
    );
    assert.ok(Math.abs(minimum - f.minimumMotorSpacing) < 1e-6);
  }
  const y6 = sourceFrame('comet-y6');
  assert.equal(y6.parts.length, 17);
  assert.ok(y6.parts.every((m) => m.route === 'print' && m.printPose));
  const p = frame.presets.find((p) => p.id === y6.id)!.parameters;
  assert.ok(validateParameters(frame, p, 'cut').length);
  assert.ok(!frame.fabricationFiles!(p).some((f) => f.id === 'source-cut'));
  assert.ok(validateParameters(frame, { ...p, bladeAxialEnvelope: 80 }, 'assembled').length);
  assert.ok(sourceFrame('source-one-x8').changes.some((s) => s.includes('V4')));
});
test('source component meshes match native bounds and retain independent geometry', () => {
  for (const m of models) {
    const g = component.buildGeometry({ component: m.id }, 'default');
    try {
      g.updateMatrixWorld(true);
      const b = new Box3().setFromObject(g, true).getSize(new Vector3()).toArray();
      b.forEach((v, i) => assert.ok(Math.abs(v - m.dimensions[i]) < 0.001, m.label));
      assert.match(component.python({ component: m.id }, 'default'), /importBrepFromString/);
    } finally {
      disposeModel(g);
    }
  }
});
test('inspection and load inputs cannot rescale or substitute the source frame', () => {
  const a = frame.dimensions(frame.defaults, 'assembled'),
    b = frame.dimensions(
      { ...frame.defaults, mass: 1, motorThrust: 20, flexuralModulus: 20 },
      'assembled',
    );
  assert.deepEqual(a, b);
  assert.ok(
    validateParameters(frame, { ...frame.defaults, propDiameter: 150 }, 'assembled').length,
  );
  assert.ok(validateParameters(frame, { ...frame.defaults, rotorHeight: 20 }, 'assembled').length);
  assert.ok(
    validateParameters(frame, { ...frame.defaults, model: 'generic-printed' }, 'assembled').length,
  );
  const files = frame.fabricationFiles!(frame.defaults);
  assert.match(files.find((f) => f.id === 'source-cut')!.content, /\$INSUNITS/);
  const report = JSON.parse(files.find((f) => f.id === 'load-case')!.content);
  assert.equal(report.status, 'unqualified');
  assert.equal(report.assumedStressMargin, null);
});
