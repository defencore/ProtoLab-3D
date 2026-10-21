import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import carrier from '../src/parts/compute-module-carrier/part';
import { models, pieces } from '../src/parts/compute-module-carrier/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';

test('CM5 carriers are fixed bare purchased boards with separate sourced article identities', () => {
  assert.deepEqual(
    models.map((model) => model.id),
    ['raspberry-pi-cm5-io-rev2', 'waveshare-cm5-io-base-a'],
  );
  assert.equal(carrier.product.supply, 'purchased');
  assert.equal(carrier.catalogSelectionOnly, true);
  assert.equal(carrier.presets.length, 2);
  for (const preset of carrier.presets) {
    assert.deepEqual(validateParameters(carrier, preset.parameters, 'assembled'), []);
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
    assert.match(preset.catalog!.geometryEvidence!.sourceSha256!, /^[a-f0-9]{64}$/);
    assert.match(preset.description, /compute module.*excluded/);
    assert.equal(preset.catalog!.attributes!.module, 'CM5');
    assert.ok(carrier.validate({ ...preset.parameters, width: 100 }, 'assembled').length);
    const authored = pieces(preset.parameters, 'assembled');
    assert.equal(authored.filter((piece) => /100-pin CM5 B2B/.test(piece.label)).length, 2);
    assert.equal(authored.filter((piece) => /contact \d+$/.test(piece.label)).length, 40);
    assert.ok(!authored.some((piece) => /BCM2712|LPDDR|SD card inserted/.test(piece.label)));
  }
  assert.ok(carrier.validate({ model: 'cm4-only-carrier' }, 'assembled').length);
  assert.ok(carrier.validate(carrier.defaults, 'missing').length);
  const filters = emptyPresetFilters(carrier);
  filters.query = 'CM5-IO-BASE-A';
  assert.deepEqual(
    filterPresets(buildPresetIndex([carrier]), filters).items.map((item) => item.preset.id),
    ['waveshare-cm5-io-base-a'],
  );
});

test('board mounting patterns and the rotated IO Board module datum match manufacturer designs', () => {
  const io = models[0],
    base = models[1];
  assert.deepEqual([io.width, io.length, io.board], [160, 90, 1.6]);
  assert.equal(io.holes.length, 8);
  assert.deepEqual(
    io.moduleHoles.map((hole) => hole.slice(0, 2)).sort(),
    [
      [3.5, -6.5],
      [3.5, 41.5],
      [36.5, -6.5],
      [36.5, 41.5],
    ].sort(),
  );
  assert.ok([...io.holes, ...io.moduleHoles].every((hole) => hole[2] === 2.7));
  assert.deepEqual([base.width, base.length, base.board], [85, 56, 1.6]);
  assert.deepEqual(base.holes, [
    [-39, -24.5, 3],
    [19, -24.5, 3],
    [-39, 24.5, 3],
    [19, 24.5, 3],
  ]);
  assert.deepEqual(base.moduleHoles, [
    [-30.95, -15.85, 3],
    [17.05, -15.85, 3],
    [-30.95, 17.15, 3],
    [17.05, 17.15, 3],
  ]);
  assert.match(io.limitations, /1\.51/);
  assert.match(base.limitations, /radius 3\.5 mm is inferred/);
});

for (const model of models)
  test(model.id + ': open bores, distinct components and matching preview/export bounds', () => {
    const parameters = { model: model.id };
    for (const state of ['assembled', 'exploded']) {
      const group = carrier.buildGeometry(parameters, state);
      try {
        const bounds = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
        carrier
          .dimensions(parameters, state)
          .forEach((value, axis) => assert.ok(Math.abs(bounds[axis] - value) < 0.002));
        assert.equal(
          new Set(group.children.map((child) => child.name)).size,
          group.children.length,
        );
        group.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          const position = child.geometry.getAttribute('position');
          assert.ok(position.count > 0 && Array.from(position.array).every(Number.isFinite));
        });
        const pcb = group.children[0];
        pcb.traverse((child) => {
          if (child instanceof Mesh) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
              material.side = DoubleSide;
            });
          }
        });
        group.updateMatrixWorld(true);
        for (const [x, y] of [...model.holes, ...model.moduleHoles]) {
          assert.equal(
            new Raycaster(
              new Vector3(x, y, -1),
              new Vector3(0, 0, 1),
              0,
              model.board + 2,
            ).intersectObject(pcb, true).length,
            0,
          );
        }
        assert.ok(
          new Raycaster(
            new Vector3(0, 0, -1),
            new Vector3(0, 0, 1),
            0,
            model.board + 2,
          ).intersectObject(pcb, true).length > 0,
        );
        const macro = carrier.python(parameters, state);
        assert.ok(macro.includes('component_labels = '));
        assert.ok(macro.includes('Part.makeCompound(components)'));
        assert.equal(
          (macro.match(/components\.append\(component\)/g) ?? []).length,
          group.children.length,
        );
      } finally {
        disposeModel(group);
      }
    }
  });
