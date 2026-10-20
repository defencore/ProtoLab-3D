import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import type { Group, Material } from 'three';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/addressable-led/part';
import { models, pieces } from '../src/parts/addressable-led/lib/model';
import { configureProduct } from '../src/core/design-project';
import { matchingPresetId } from '../src/core/part-selection';
import { matchesCatalogFilters } from '../src/core/catalog-models';

function meshes(group: Group) {
  const out: Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof Mesh) out.push(object);
  });
  return out;
}
function dispose(group: Group) {
  for (const mesh of meshes(group)) {
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material: Material) =>
      material.dispose(),
    );
  }
}
function volumeAndClosed(mesh: Mesh) {
  const p = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index,
    edges = new Map<string, number>(),
    count = index?.count ?? p.count;
  const key = (i: number) =>
    [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e5)).join(',');
  let volume = 0;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j)),
      keys = ids.map(key);
    const v = ids.map((n) => new Vector3(p.getX(n), p.getY(n), p.getZ(n)));
    assert.ok(
      v.every((point) => point.toArray().every(Number.isFinite)),
      mesh.name,
    );
    volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
    if (new Set(keys).size < 3) continue;
    for (let edge = 0; edge < 3; edge++) {
      const k = [keys[edge], keys[(edge + 1) % 3]].sort().join('/');
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  assert.ok(volume > 0, mesh.name + ': positive volume');
  assert.ok(
    edges.size > 0 && [...edges.values()].every((count) => count === 2),
    mesh.name + ': closed preview mesh',
  );
  return volume;
}

test('seven fixed purchased WS2812 modules retain explicit supplier execution and source evidence', () => {
  assert.equal(part.category, 'ELECTRONICS & VISION');
  assert.equal(part.subgroup, 'LED MODULES');
  assert.equal(part.product.supply, 'purchased');
  assert.equal(part.catalogSelectionOnly, true);
  assert.deepEqual(part.defaults, { model: 'ws2812-8-stick' });
  assert.deepEqual(
    part.parameters.map((p) => p.key),
    ['model'],
  );
  assert.deepEqual(
    part.catalogSelection?.map((p) => p.key),
    ['model'],
  );
  assert.deepEqual(
    models.map((m) => [m.id, m.length, m.width, m.height, m.leds]),
    [
      ['ws2812-8-stick', 54, 10, 3.19, 8],
      ['ws2812b-4-matrix', 15, 15, 3.19, 4],
      ['ws2812b-8-ring', 32, 32, 3.19, 8],
      ['ws2812b-12-ring', 50, 50, 3.19, 12],
      ['ws2812b-16-ring', 67, 67, 3.19, 16],
      ['ws2812b-24-ring', 86, 86, 3.19, 24],
      ['ws2812b-16-matrix', 30, 30, 3.19, 16],
    ],
  );
  assert.equal(part.presets.length, 7);
  for (const model of models) {
    const preset = part.presets.find((p) => p.id === model.id)!;
    assert.deepEqual(preset.parameters, { model: model.id });
    assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
    assert.equal(preset.catalog!.manufacturer, 'Generic');
    assert.match(preset.catalog!.designation, /CEL031(?:09|10|11|12|13)|LCD0302[12]/);
    assert.equal(preset.catalog!.sourceUrl, model.source);
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
    assert.match(preset.catalog!.geometryEvidence!.limitations, /hole.*photo-derived/i);
    if (model.outline === 'ring') {
      assert.equal(
        preset.catalog!.attributes!.height,
        undefined,
        'Unpublished ring thickness must not become a verified filter fact',
      );
      assert.equal(preset.catalog!.attributes!.innerDiameter, undefined);
      assert.equal(preset.catalog!.attributes!.outerDiameter, model.length);
      assert.match(preset.catalog!.geometryEvidence!.limitations, /height.*authored assumptions/i);
      assert.match(preset.catalog!.geometryEvidence!.sourceSha256!, /^[a-f0-9]{64}$/);
      assert.match(part.assessment!({ model: model.id }).join(' '), /height.*approximate/);
    } else {
      assert.equal(preset.catalog!.attributes!.height, model.height);
    }
    assert.match(preset.catalog!.geometryEvidence!.limitations, /not manufacturer CAD/);
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    for (const state of ['assembled', 'exploded']) {
      assert.equal(matchingPresetId(part, preset.parameters), preset.id);
      const product = configureProduct({
        part,
        parameters: preset.parameters,
        presetId: preset.id,
        state,
      });
      assert.equal(product.state, 'assembled');
      assert.equal(product.supply, 'purchased');
      assert.equal(product.procurement!.designation, preset.catalog!.designation);
    }
  }
  for (const extra of [
    { model: 'unknown' },
    { leds: 16 },
    { length: 100 },
    { wire: true },
    { animation: 'rainbow' },
  ] as Parameters[])
    assert.ok(part.validate({ ...part.defaults, ...extra }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'cutaway').length);
  assert.match(models[1].sourceNotes, /bullet.*eight.*copy\/paste/i);
  assert.match(part.notes!, /no Adafruit origin/);
});

test('populated boards include the requested count of discrete 5050 packages without wires', () => {
  for (const model of models)
    for (const state of ['assembled', 'exploded']) {
      const components = pieces({ model: model.id }, state),
        labels = components.map((component) => component.label);
      assert.equal(new Set(labels).size, labels.length);
      assert.equal(labels.filter((name) => name.endsWith('5050 package')).length, model.leds);
      assert.equal(labels.filter((name) => name.endsWith('optical window')).length, model.leds);
      assert.equal(labels.filter((name) => name.includes('solder pad')).length, model.pads.length);
      assert.equal(
        labels.filter((name) => name.includes('ceramic body')).length,
        model.capacitors.length,
      );
      assert.equal(labels.filter((name) => name.startsWith('PCB')).length, 1);
      assert.ok(labels.every((name) => !/wire|lead|header/i.test(name)));
      const group = part.buildGeometry({ model: model.id }, state);
      try {
        group.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(group).getSize(new Vector3()),
          expected = part.dimensions({ model: model.id }, state);
        for (let axis = 0; axis < 3; axis++)
          assert.ok(Math.abs(bounds.getComponent(axis) - expected[axis]) < 5e-4);
        assert.ok(Math.abs(bounds.x - model.length) < 5e-4);
        assert.ok(Math.abs(bounds.y - model.width) < 5e-4);
        assert.ok(Math.abs(bounds.z - (model.height + (state === 'exploded' ? 5 : 0))) < 5e-4);
        for (const mesh of meshes(group)) volumeAndClosed(mesh);
      } finally {
        dispose(group);
      }
    }
});

test('mounting bores stay clear through PCB, LED packages, solder lands and passives', () => {
  for (const model of models)
    for (const state of ['assembled', 'exploded']) {
      const group = part.buildGeometry({ model: model.id }, state);
      try {
        group.updateMatrixWorld(true);
        for (const mesh of meshes(group))
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            material.side = DoubleSide;
        for (const [x, y, diameter] of model.holes)
          for (const [dx, dy] of [
            [0, 0],
            [diameter * 0.45, 0],
            [-diameter * 0.45, 0],
            [0, diameter * 0.45],
            [0, -diameter * 0.45],
          ]) {
            const hits = new Raycaster(
              new Vector3(x + dx, y + dy, -1),
              new Vector3(0, 0, 1),
            ).intersectObject(group, true);
            assert.equal(
              hits.length,
              0,
              `${model.id}/${state} mounting hole must remain open at ${x + dx},${y + dy}`,
            );
          }
        if (model.innerDiameter > 0) {
          const radius = model.innerDiameter / 2;
          for (const [x, y] of [
            [0, 0],
            [radius * 0.95, 0],
            [-radius * 0.95, 0],
            [0, radius * 0.95],
            [0, -radius * 0.95],
          ]) {
            const hits = new Raycaster(new Vector3(x, y, -1), new Vector3(0, 0, 1)).intersectObject(
              group,
              true,
            );
            assert.equal(
              hits.length,
              0,
              model.id + ': central opening must be clear through every represented component',
            );
          }
          const r = model.length / 2;
          const outside = new Raycaster(
            new Vector3(r * 0.8, r * 0.8, -1),
            new Vector3(0, 0, 1),
          ).intersectObject(group, true);
          assert.equal(
            outside.length,
            0,
            model.id + ': annular outline has no rectangular board corners',
          );
        }
        if (model.leds === 4) {
          const hits = new Raycaster(new Vector3(0, 3, -1), new Vector3(0, 0, 1)).intersectObject(
            group,
            true,
          );
          assert.ok(hits.length > 0, 'PCB remains present beside its central bore');
        }
      } finally {
        dispose(group);
      }
    }
});

test('arrangement filters distinguish equal LED counts and omit unpublished ring thickness', () => {
  const fields = part.catalogFilterFields!;
  const matching = (filters: Parameters) =>
    part.presets
      .filter((preset) =>
        matchesCatalogFilters(
          preset,
          fields,
          Object.fromEntries(
            Object.entries(filters).map(([key, value]) => [
              key,
              typeof value === 'number'
                ? { min: String(value), max: String(value) }
                : { value: String(value) },
            ]),
          ),
        ),
      )
      .map((preset) => preset.id);
  assert.deepEqual(matching({ leds: 16, layout: 'Ring 16' }), ['ws2812b-16-ring']);
  assert.deepEqual(matching({ leds: 16, layout: '4×4' }), ['ws2812b-16-matrix']);
  assert.deepEqual(matching({ outerDiameter: 86 }), ['ws2812b-24-ring']);
  assert.deepEqual(matching({ height: 3.19 }), [
    'ws2812-8-stick',
    'ws2812b-4-matrix',
    'ws2812b-16-matrix',
  ]);
});
