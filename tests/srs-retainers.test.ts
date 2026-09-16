import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/srs-retainer/part';
import native from '../src/parts/srs-retainer/lib/native.json';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';

test('retainer CAD is pinned to three distinct manufacturer source assets', () => {
  const hashes = new Set<string>();
  for (const [id, data] of Object.entries(native)) {
    const preset = part.presets.find((p) => p.id === id)!;
    const evidence = preset.catalog!.geometryEvidence!;
    const sha = createHash('sha256')
      .update(readFileSync(`public${evidence.sourceUrl}`))
      .digest('hex');
    assert.equal(evidence.kind, 'manufacturer-cad');
    assert.equal(sha, data.sourceSha256);
    assert.equal(sha, evidence.sourceSha256);
    assert.equal(data.sourceSolids, 1);
    assert.ok(data.volume > 0);
    hashes.add(sha);
    assert.match(generateScript(part, preset.parameters, 'assembled'), /importBrepFromString/);
  }
  assert.equal(hashes.size, 3);
});

test('all retainer previews have finite geometry and correctly reported overall bounds', () => {
  for (const preset of part.presets) {
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    const model = part.buildGeometry(preset.parameters, 'assembled');
    try {
      const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      size.forEach((v, i) =>
        assert.ok(Math.abs(v - part.dimensions(preset.parameters, 'assembled')[i]) < 0.02),
      );
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        assert.ok(child.geometry.getAttribute('position').count > 0);
        for (const value of child.geometry.getAttribute('position').array)
          assert.ok(Number.isFinite(value));
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('AK-1 reference is distinguished from native AK-2 and invalid configurations fail', () => {
  const aptiv = part.presets.find((p) => p.id === 'aptiv-ak1')!;
  assert.equal(aptiv.catalog!.geometryEvidence!.kind, 'source-dimensions');
  assert.equal(aptiv.catalog!.attributes!.key, 'Dimensional sample');
  assert.equal(
    aptiv.catalog!.productCodes,
    undefined,
    'Do not assign unverified key geometry to an orderable SKU',
  );
  assert.ok(part.validate({ model: 'unknown' }, 'assembled').length);
  assert.ok(part.validate({ model: 'te-akii-1', diameter: 12 }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'mated').length);
  assert.match(part.notes!, /AK-1 and AK-2 are different/);
});
