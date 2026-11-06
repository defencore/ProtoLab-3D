import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, Raycaster, Vector3 } from 'three';
import screw from '../src/parts/ball-screw/part';
import nut from '../src/parts/ball-nut/part';
import { kaiyadeSfkReferences, sfkReferences } from '../src/catalog/ball-screw-reference';
import { miniatureShaftLengths } from '../src/catalog/ball-screws';
import { ballScrewLayout } from '../src/parts/ball-screw/lib/parts/ball-screw-geometry';
import { validateParameters } from '../src/core/validation';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';

test('the complete KAIYADE SFK table remains distinct from Wangong dimensions and ratings', () => {
  assert.equal(kaiyadeSfkReferences.length, 15);
  assert.equal(new Set(kaiyadeSfkReferences.map((reference) => reference.id)).size, 15);
  const first = kaiyadeSfkReferences[0];
  assert.equal(first.catalog!.sourceKind, 'attachment');
  assert.equal(first.catalog!.sourceName, 'KAIYADE · supplied SFK table, p17');
  assert.equal(first.catalog!.sourceUrl, '');
  assert.equal(
    first.catalog!.specifications!.find((row) => row.label.includes('dynamic'))!.value,
    '40 kgf',
  );
  assert.equal(
    sfkReferences[0].catalog!.specifications!.find((row) => row.label.includes('dynamic'))!.value,
    '64 kgf',
  );
  const model = kaiyadeSfkReferences.find((row) => row.designation === 'SFK1205')!;
  assert.deepEqual(
    ['shaftDiameter', 'lead', 'nutDiameter', 'flangeDiameter', 'flangeThickness', 'nutLength'].map(
      (key) => model.parameters[key],
    ),
    [12, 5, 22, 37, 8, 39],
  );
  const large = kaiyadeSfkReferences.at(-1)!;
  assert.deepEqual(
    ['shaftDiameter', 'lead', 'mountCounterboreDiameter', 'mountCounterboreDepth'].map(
      (key) => large.parameters[key],
    ),
    [25, 3, 9.5, 5.5],
  );
  const nuts = nut.presets.filter((preset) => preset.id.startsWith('kaiyade-'));
  assert.equal(nuts.length, 15);
  for (const preset of nuts)
    assert.deepEqual(validateParameters(nut, preset.parameters, 'assembled'), [], preset.id);
});

test('KAIYADE size, length and end selections preserve SFK08025 listing aliases and drawing scope', () => {
  const kaiyade = screw.presets.filter((preset) => preset.id.startsWith('kaiyade-'));
  assert.equal(kaiyade.length, 180);
  for (const reference of kaiyadeSfkReferences) {
    const plain = kaiyade.filter(
      (preset) =>
        preset.id.startsWith(reference.id + '-') && preset.parameters.endMachining === 'none',
    );
    assert.deepEqual(
      plain.map((preset) => preset.parameters.length),
      miniatureShaftLengths,
    );
  }
  const index = buildPresetIndex([screw]);
  const results = filterPresets(index, {
    ...emptyPresetFilters(screw),
    query: 'SFK08025',
    kind: 'catalog',
  });
  const aliases = results.items.filter(
    (item) => item.preset.parameters.shaftDiameter === 8 && item.preset.parameters.lead === 2.5,
  );
  assert.equal(aliases.length, 30);
  assert.ok(aliases.some((item) => item.preset.parameters.endMachining === 'ek6-ef6'));
  for (const preset of kaiyade) {
    assert.deepEqual(validateParameters(screw, preset.parameters, 'assembled'), [], preset.id);
    const verified = preset.catalog!.verifiedParameters;
    const exact =
      preset.id.startsWith('kaiyade-sfk0802-') && preset.parameters.endMachining === 'ek6-ef6';
    assert.equal(verified.includes('supportGrooveDiameter'), exact, preset.id);
    if (preset.parameters.endMachining === 'ek6-ef6' && !exact)
      assert.match(preset.description, /not a verified supplier execution/);
  }
});

test('named EK6/EF6 machining builds physical nominal journals and retaining groove in both detail modes', () => {
  const preset = screw.presets.find((item) => item.id === 'kaiyade-sfk0802-100-end-machine')!;
  const p = preset.parameters;
  const layout = ballScrewLayout(p);
  assert.equal(layout.start, -12);
  assert.equal(layout.end, 41);
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const model = screw.buildGeometry(p, 'screw');
      try {
        model.updateMatrixWorld(true);
        const support = model.children.find(
          (child) =>
            child instanceof Mesh && child.name === 'Bearing journal' && child.position.z > 0,
        )!;
        const grooveRay = new Raycaster(new Vector3(10, 0, 48.2), new Vector3(-1, 0, 0));
        assert.ok(Math.abs(grooveRay.intersectObject(support)[0].point.x - 2.85) < 1e-6);
        const landRay = new Raycaster(new Vector3(10, 0, 49.5), new Vector3(-1, 0, 0));
        assert.ok(Math.abs(landRay.intersectObject(support)[0].point.x - 3) < 1e-6);
        assert.ok(Math.abs(screw.dimensions(p, 'screw')[2] - 100) < 1e-6);
        const native = screw.python(p, 'screw');
        assert.match(native, /M6x0.75 thread over 10 mm/);
        assert.match(native, /screw = screw\.cut\(annulus\(3\.1,2\.85,0\.8,47\.8\)\)/);
        assert.equal(
          screw.python({ ...p, fixedJournalLength: 99, supportGrooveDiameter: 1 }, 'screw'),
          native,
        );
      } finally {
        disposeModel(model);
      }
    });
  const plain = screw.updateParameters!({ ...p, endMachining: 'none' }, 'endMachining');
  assert.deepEqual(validateParameters(screw, plain, 'assembled'), []);
  assert.ok(!ballScrewLayout(plain).machined);
  assert.ok(
    validateParameters(screw, { ...p, shaftDiameter: 10 }, 'assembled').some((error) =>
      error.includes('8 mm SFK'),
    ),
  );
});
