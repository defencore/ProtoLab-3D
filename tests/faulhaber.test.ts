import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';
import { parts } from '../src/parts';
import { Box3, Mesh, Vector3 } from 'three';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

/** Digests of the original uncompressed supplier preview bytes and untouched metadata. */
const previewDigests = JSON.parse(
  readFileSync(new URL('./fixtures/faulhaber-preview-digests.json', import.meta.url), 'utf8'),
) as Record<
  string,
  {
    positions: string;
    indices: string;
    metadata: string;
    originalEncodedLengths: { positions: number; indices: number };
  }
>;
function digest(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
function arrayBytes(array: Float32Array | Uint32Array): Uint8Array {
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

test('FAULHABER preview compression preserves every original byte and all native metadata', () => {
  let originalEncodedBytes = 0;
  let compressedEncodedBytes = 0;
  for (const [selection, expected] of Object.entries(previewDigests)) {
    const [family, filename] = selection.split('/');
    const data = JSON.parse(readFileSync(`src/parts/${family}/lib/${filename}`, 'utf8'));
    const { positions, indices, ...metadata } = data;
    assert.equal(
      digest(JSON.stringify(metadata)),
      expected.metadata,
      `${selection}: native metadata`,
    );
    for (const field of ['positions', 'indices'] as const) {
      const encoded = data[field] as string;
      const decoded = unzlibSync(Buffer.from(encoded, 'base64'));
      assert.equal(digest(decoded), expected[field], `${selection}/${field}: original bytes`);
      assert.equal(decoded.byteLength % 4, 0, `${selection}/${field}: aligned typed array`);
      assert.ok(
        encoded.length < expected.originalEncodedLengths[field],
        `${selection}/${field}: smaller asset`,
      );
      originalEncodedBytes += expected.originalEncodedLengths[field];
      compressedEncodedBytes += encoded.length;
    }
  }
  assert.equal(Object.keys(previewDigests).length, 10);
  assert.ok(
    compressedEncodedBytes < originalEncodedBytes * 0.4,
    'Preview payload remains substantially smaller',
  );
});

for (const family of ['am', 'bx4']) {
  const id = `faulhaber-${family}`,
    part = parts.find((p) => p.id === id)!;
  test(`FAULHABER ${family}: stock models, all windings and CAD provenance`, () => {
    assert.equal(part.presets.length, 20);
    assert.equal(part.catalogSelectionOnly, true);
    assert.deepEqual(
      part.parameters.map((p) => p.key),
      ['model'],
    );
    const models = JSON.parse(readFileSync(`src/parts/${id}/lib/models.json`, 'utf8')) as {
      model: string;
      series: string;
    }[];
    const checked = new Set<string>();
    for (const preset of part.presets) {
      assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), []);
      const series = models.find((m) => m.model === preset.parameters.model)!.series;
      const native = JSON.parse(readFileSync(`src/parts/${id}/lib/native-${series}.json`, 'utf8'));
      assert.equal(preset.catalog!.geometryEvidence!.sourceSha256, native.sourceSha256);
      assert.equal(preset.catalog!.geometryEvidence!.kind, 'manufacturer-cad');
      if (checked.has(series)) continue;
      checked.add(series);
      const expectedPreview = previewDigests[`${id}/native-${series}.json`];
      const model = part.buildGeometry(preset.parameters, 'assembled');
      try {
        const b = new Box3().setFromObject(model, true);
        [...b.min.toArray(), ...b.max.toArray()].forEach((v, i) =>
          assert.ok(Math.abs(v - native.bounds[i]) < 0.025, `${series} bound ${i}`),
        );
        let volume = 0;
        model.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          const a = mesh.geometry.getAttribute('position'),
            indices = mesh.geometry.index!;
          assert.equal(digest(arrayBytes(a.array as Float32Array)), expectedPreview.positions);
          assert.equal(digest(arrayBytes(indices.array as Uint32Array)), expectedPreview.indices);
          for (let i = 0; i < indices.count; i += 3) {
            const [x, y, z] = [0, 1, 2].map((k) =>
              new Vector3().fromBufferAttribute(a, indices.getX(i + k)),
            );
            volume += x.dot(y.clone().cross(z)) / 6;
          }
        });
        assert.ok(
          Math.abs(volume - native.volume) / native.volume < 0.005,
          `${series}: oriented closed preview`,
        );
      } finally {
        disposeModel(model);
      }
    }
    assert.equal(checked.size, family === 'am' ? 6 : 4);
    assert.ok(part.validate!({ ...part.defaults, bodyLength: 100 }, 'assembled').length);
    assert.ok(part.validate!({ model: 'invented' }, 'assembled').length);
  });
}
test('FAULHABER ratings distinguish nominal, boosted and winding variants', () => {
  const am = parts.find((p) => p.id === 'faulhaber-am')!;
  const small = am.presets.find((p) => p.name === 'AM08202R015001')!.catalog!.attributes!;
  assert.equal(small.phaseCurrent, 0.15);
  assert.equal(small.phaseVoltage, 3);
  assert.equal(small.holdingTorque, 0.65);
  assert.equal(small.boostedTorque, 1);
  const large = am.presets.find((p) => p.name === 'AM32482R070000')!.catalog!.attributes!;
  assert.equal(large.stepAngle, 7.5);
  assert.equal(large.holdingTorque, 85);
  assert.equal(large.phaseVoltage, undefined);
  const bx4 = parts.find((p) => p.id === 'faulhaber-bx4')!;
  const winding = bx4.presets.find((p) => p.name === '2232S012BX4')!.catalog!.attributes!;
  assert.equal(winding.voltage, 12);
  assert.equal(winding.noLoadSpeed, 6700);
  assert.equal(winding.ratedTorque, 14.7);
});
