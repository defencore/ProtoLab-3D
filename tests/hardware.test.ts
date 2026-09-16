import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { geometrySamples } from './catalog-samples';

const ids = [
  'hex-nut',
  'cap-nut',
  'nyloc-nut',
  'flange-nut',
  'square-nut',
  'thin-nut',
  'coupling-nut',
  'high-nut',
  'metal-lock-nut',
  'conical-washer',
  'toothed-washer',
  'square-washer',
  'retaining-ring',
];
for (const part of parts.filter((p) => ids.includes(p.id))) {
  test(`${part.id}: stock boundaries have closed outward shells with no degenerate faces`, () => {
    for (const preset of geometrySamples(part)) {
      const model = part.buildGeometry(preset.parameters, 'default');
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const p = child.geometry.getAttribute('position'),
          ix = child.geometry.index?.array ?? Array.from({ length: p.count }, (_, i) => i);
        const edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < ix.length; i += 3) {
          const vertices = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(p, ix[i + j]));
          const [a, b, c] = vertices;
          assert.ok(
            b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18,
            `${preset.id}: degenerate face`,
          );
          volume += a.dot(b.clone().cross(c)) / 6;
          const ids = vertices.map((v) =>
            v
              .toArray()
              .map((x) => Math.round(x * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const edge = [ids[j], ids[(j + 1) % 3]].sort().join('|');
            edges.set(edge, (edges.get(edge) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, `${preset.id}: outward volume`);
        for (const count of edges.values()) assert.equal(count, 2, `${preset.id}: closed shell`);
        child.geometry.dispose();
        (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) =>
          m.dispose(),
        );
      });
    }
  });
}

test('duplicate supplier finishes remain searchable by their original SKU', () => {
  const part = parts.find((p) => p.id === 'hex-nut')!;
  const preset = part.presets.find((p) => (p.catalog?.productCodes?.length ?? 0) > 1)!;
  assert.ok(preset);
  const result = filterPresets(buildPresetIndex([part]), {
    ...emptyPresetFilters(part),
    query: preset.catalog!.productCodes!.at(-1)!,
  });
  assert.ok(result.items.some((p) => p.preset.id === preset.id));
});

test('supplier washer clearance is not mistaken for the nominal screw diameter', () => {
  const part = parts.find((p) => p.id === 'washer')!;
  const preset = part.presets.find((p) => p.catalog?.designation === 'DIN 125 M6')!;
  assert.deepEqual(preset.parameters, { bore: 6.4, outerDiameter: 12, thickness: 1.6 });
});

test('fine-pitch stock rods keep the 1000 mm length and the actual pitch', () => {
  const part = parts.find((p) => p.id === 'threaded-rod')!;
  const preset = part.presets.find((p) => p.catalog?.productCodes?.includes('070-110-001'))!;
  assert.equal(preset.parameters.length, 1000);
  assert.equal(preset.parameters.pitch, 1.25);
});

test('ordinary internal circlips do not inherit the thicker table variant', () => {
  const part = parts.find((p) => p.id === 'retaining-ring')!;
  const ring40 = part.presets.find((p) => p.catalog?.designation === 'DIN 472 M40')!;
  const ring50 = part.presets.find((p) => p.catalog?.designation === 'DIN 472 M50')!;
  assert.equal(ring40.parameters.thickness, 1.75);
  assert.equal(ring40.parameters.outerDiameter, 43.5);
  assert.equal(ring50.parameters.thickness, 2);
  assert.equal(ring50.parameters.outerDiameter, 54.2);
});
