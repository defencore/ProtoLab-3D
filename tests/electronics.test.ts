import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import {
  buildPresetIndex,
  emptyPresetFilters,
  filterPresets,
  fieldId,
} from '../src/core/preset-search';
const ids = [
  'bec',
  'esc',
  'dc-dc-converter',
  'raspberry-pi',
  'nanopi',
  'esp32',
  'nrf52840',
  'lora-module',
  'rp-microcontroller',
  'arduino',
];
const selections = parts.filter((p) => ids.includes(p.id));
function checkMesh(mesh: Mesh, label: string) {
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.index;
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
    const points = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
    );
    assert.ok(
      points.every((p) => p.toArray().every(Number.isFinite)),
      `${label}: finite vertices`,
    );
    assert.ok(
      points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq() > 1e-18,
      `${label}: nondegenerate triangles`,
    );
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    const keys =
      mesh.geometry.userData.nativeTopology && indices
        ? [0, 1, 2].map((j) => String(indices.getX(i + j)))
        : points.map((p) =>
            p
              .toArray()
              .map((v) => Math.round(v * 1e5))
              .join(','),
          );
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3],
        key = [a, b].sort().join('|');
      const edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, `${label}: positive outward volume`);
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, `${label}: closed oriented boundary`);
}

test('electronics: families, fixed variants, sourced ratings and missing values', () => {
  assert.equal(selections.length, 10);
  assert.equal(
    selections.reduce((n, p) => n + p.presets.length, 0),
    27,
  );
  for (const part of selections) {
    assert.equal(part.catalogSelectionOnly, true);
    assert.ok(part.presets.length >= 2);
    assert.ok(part.validate({ ...part.defaults, width: 100 }, 'assembled').length);
    assert.ok(part.validate({ model: 'missing' }, 'assembled').length);
    assert.ok(part.validate(part.defaults, 'missing').length);
    for (const preset of part.presets) {
      assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), []);
      assert.ok(preset.catalog?.sourceUrl.startsWith('https://'));
    }
  }
  const dc = selections.find((p) => p.id === 'dc-dc-converter')!;
  const boost = dc.presets.find((p) => p.id === 'pololu-u3v50f5')!;
  assert.equal(boost.catalog!.attributes!.inputCurrent, 5);
  assert.equal(
    boost.catalog!.attributes!.outputCurrent,
    undefined,
    'input rating is never an output rating',
  );
  const f = emptyPresetFilters(dc);
  f.parameters[fieldId(dc.catalogFilterFields!.find((f) => f.key === 'outputCurrent')!)] = {
    min: '0',
    max: '10',
  };
  assert.equal(
    filterPresets(buildPresetIndex([dc]), f).items.length,
    2,
    'unknown output current excluded',
  );
  const pi = selections.find((p) => p.id === 'raspberry-pi')!;
  assert.ok(
    pi.presets.every((p) => p.catalog!.attributes!.height === undefined),
    'unverified component heights not used as exact filters',
  );
});
for (const part of selections)
  for (const preset of part.presets)
    test(`${preset.id}: closed preview and bounds in both states`, () => {
      for (const state of part.states!) {
        const group = part.buildGeometry(preset.parameters, state.id);
        try {
          group.updateMatrixWorld(true);
          group.traverse((o) => {
            if (o instanceof Mesh) checkMesh(o, `${preset.id}/${o.name}`);
          });
          assert.ok(group.children.length >= 2);
          assert.equal(new Set(group.children.map((c) => c.name)).size, group.children.length);
          const size = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
          part
            .dimensions(preset.parameters, state.id)
            .forEach((v, i) =>
              assert.ok(Math.abs(v - size[i]) < 0.002, `${preset.id}: reported/preview bounds`),
            );
          if (state.id === 'assembled') {
            if (['esp32-devkitc-v4', 'arduino-nano-classic'].includes(preset.id)) {
              const pins = group.children.filter((child) => /^GPIO .* pin /.test(child.name));
              assert.ok(pins.length >= 30, 'both breadboard header rows are present');
              for (const pin of pins) {
                const bounds = new Box3().setFromObject(pin, true);
                assert.ok(bounds.min.z < -6 && bounds.max.z > 0, 'header enters PCB from below');
              }
            }
            const attrs = preset.catalog!.attributes!;
            assert.ok(
              size[0] >= Number(attrs.width) - 0.002 && size[1] >= Number(attrs.length) - 0.002,
              'PCB/body fits reported dimensions',
            );
            if (attrs.height !== undefined)
              assert.ok(
                Math.abs(size[2] - Number(attrs.height)) < 0.002,
                `${preset.id}: published height ${size[2]}`,
              );
          }
        } finally {
          disposeModel(group);
        }
      }
    });
