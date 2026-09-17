import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { modelEvidence } from '../src/core/model-evidence';
import type { SupplierAsset, SupplierPlacement } from '../src/core/manufacturer-cad';

type Model = {
  model: string;
  series: string;
  assets: SupplierPlacement[];
  attributes: Record<string, string | number>;
};
const counts = { planetary: [623, 35], 'linear-actuator': [255, 13], 'linear-motor': [32, 4] };
for (const [family, [presets, series]] of Object.entries(counts)) {
  const id = `faulhaber-${family}`;
  test(`FAULHABER ${family}: complete catalog, valid geometry and source traceability`, () => {
    const part = parts.find((p) => p.id === id)!;
    assert.equal(part.presets.length, presets);
    const rows = JSON.parse(readFileSync(`src/parts/${id}/lib/models.json`, 'utf8')) as Model[];
    assert.equal(new Set(rows.map((r) => r.series)).size, series);
    const checked = new Set<string>();
    for (const preset of part.presets) {
      assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), [], preset.name);
      const row = rows.find((r) => r.model === preset.parameters.model)!;
      assert.ok(row);
      assert.equal(modelEvidence(part, preset.parameters).kind, 'manufacturer-cad');
      const assets = row.assets.map(
        (a) =>
          JSON.parse(
            readFileSync(`src/parts/${id}/lib/native-${a.key}.json`, 'utf8'),
          ) as SupplierAsset,
      );
      assert.equal(preset.catalog!.geometryEvidence!.sourceSha256, assets[0].sourceSha256);
      const key = row.assets.map((a) => a.key).join('/');
      if (checked.has(key)) continue;
      checked.add(key);
      const model = part.buildGeometry(preset.parameters, 'assembled');
      try {
        model.updateMatrixWorld(true);
        const actual = new Box3().setFromObject(model, true).getSize(new Vector3());
        part
          .dimensions(preset.parameters, 'assembled')
          .forEach((v, i) =>
            assert.ok(Math.abs(v - actual.toArray()[i]) < 0.045, `${key}: dimension ${i}`),
          );
        let expectedVolume = 0,
          volume = 0;
        for (const asset of assets)
          for (const solid of asset.components) {
            expectedVolume += solid.volume;
            assert.match(asset.sourceSha256, /^[0-9a-f]{64}$/);
          }
        model.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          const positions = mesh.geometry.getAttribute('position'),
            indices = mesh.geometry.index!;
          for (let i = 0; i < indices.count; i += 3) {
            const [a, b, c] = [0, 1, 2].map((j) =>
              new Vector3()
                .fromBufferAttribute(positions, indices.getX(i + j))
                .applyMatrix4(mesh.matrixWorld),
            );
            volume += a.dot(b.cross(c)) / 6;
          }
        });
        assert.ok(
          Math.abs(volume - expectedVolume) / expectedVolume < 0.01,
          `${key}: closed mesh volume`,
        );
      } finally {
        disposeModel(model);
      }
    }
    assert.ok(part.validate!({ ...part.defaults, bodyLength: 123 }, 'assembled').length);
    assert.ok(part.validate!({ ...part.defaults, model: 'unknown' }, 'assembled').length);
  });
}

test('FAULHABER reduction stages select different physical bodies and preserve torque units', () => {
  const gear = parts.find((p) => p.id === 'faulhaber-planetary')!;
  const first = gear.presets.find((p) => p.name === '06/1 4:1')!;
  const last = gear.presets.find((p) => p.name === '06/1 4096:1')!;
  assert.equal(first.catalog!.attributes!.stages, 1);
  assert.equal(last.catalog!.attributes!.stages, 6);
  assert.ok(
    gear.dimensions(last.parameters, 'assembled')[2] >
      gear.dimensions(first.parameters, 'assembled')[2] + 10,
  );
  assert.equal(
    gear.presets.find((p) => p.name === '06/1 256:1')!.catalog!.attributes!.continuousTorque,
    0.025,
  );
  for (const p of gear.presets.filter((p) => p.name.startsWith('22GPT HT ')))
    assert.equal(
      p.catalog!.attributes!.bodyLength,
      p.catalog!.attributes!.stages === 3 ? 37.3 : 43.6,
    );
  const actuator = parts.find((p) => p.id === 'faulhaber-linear-actuator')!;
  assert.equal(
    actuator.presets.find((p) => p.name === '22L...SB 9:1')!.catalog!.attributes!.stages,
    2,
  );
  assert.equal(
    actuator.presets.find((p) => p.name === '32L...SB 3,6:1')!.catalog!.attributes!.stages,
    1,
  );
  const screws = new Set(actuator.presets.map((p) => p.catalog!.attributes!.screwType));
  for (const screw of ['M6 × 1', 'M10 × 1', 'Tr10 × 2', '6 × 2 IT1', '6 × 2 IT3'])
    assert.ok(screws.has(screw));
});

test('FAULHABER LM motion is bounded by stroke, preserves the housing, and survives preset identity', () => {
  const part = parts.find((p) => p.id === 'faulhaber-linear-motor')!;
  for (const preset of part.presets) {
    const stroke = Number(preset.catalog!.attributes!.stroke);
    const models = [0, 100].map((position) =>
      part.buildGeometry({ ...preset.parameters, position }, 'assembled'),
    );
    try {
      const a = models[0].children,
        b = models[1].children;
      assert.equal(a.length, b.length);
      for (let i = 0; i < a.length - 1; i++)
        assert.deepEqual(a[i].position.toArray(), b[i].position.toArray());
      assert.ok(Math.abs(b.at(-1)!.position.z - a.at(-1)!.position.z - stroke) < 1e-10);
      assert.equal(
        modelEvidence(part, { ...preset.parameters, position: 100 }).kind,
        'manufacturer-cad',
      );
    } finally {
      models.forEach(disposeModel);
    }
  }
  for (const position of [-1, 101, NaN, Infinity]) {
    assert.ok(part.validate!({ ...part.defaults, position }, 'assembled').length);
    assert.throws(() => part.buildGeometry({ ...part.defaults, position }, 'assembled'));
  }
});
