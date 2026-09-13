import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import bevel, { bevelPairValues } from "../src/parts/bevel-gear-pair/part";
import spur from "../src/parts/spur-gear/part";
import { bevelReferenceRows } from '../src/catalog/reference-gears';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

test('miniature pinions retain the four visible sizes without claiming unspecified dimensions', () => {
  const presets = spur.presets.filter((preset) => preset.id.startsWith('reference-m05'));
  assert.deepEqual(
    presets.map((preset) => preset.parameters.teeth),
    [11, 13, 15, 17],
  );
  for (const preset of presets) {
    assert.equal(preset.parameters.module, 0.5);
    assert.equal(preset.parameters.bore, 2.98);
    assert.equal(preset.parameters.profileMode, 'layout');
    assert.deepEqual(preset.catalog?.verifiedParameters, ['module', 'teeth', 'bore']);
    assert.deepEqual(validateParameters(spur, preset.parameters, 'default'), []);
    assert.ok(spur.validate({ ...preset.parameters, profileMode: 'standard' }, 'default').length);
  }
});

test('bevel presets preserve every row, mounting datum and continuous bore interval', () => {
  assert.equal(bevelReferenceRows.length, 12);
  assert.equal(bevel.presets.length, 6);
  for (const [index, preset] of bevel.presets.entries()) {
    for (const [offset, side] of ['pinion', 'wheel'].entries()) {
      const row = bevelReferenceRows[index * 2 + offset],
        p = preset.parameters;
      for (const key of [
        'outer',
        'largeTip',
        'mounting',
        'overall',
        'face',
        'hub',
        'hubLength',
        'bodyLength',
        'boreMin',
        'boreMax',
      ] as const)
        assert.equal(p[`${side}${key[0].toUpperCase()}${key.slice(1)}`], row[key]);
      for (const bore of [row.boreMin, (row.boreMin + row.boreMax) / 2, row.boreMax])
        assert.deepEqual(
          validateParameters(bevel, { ...p, [`${side}Bore`]: bore }, 'assembled'),
          [],
        );
      assert.ok(bevel.validate({ ...p, [`${side}Bore`]: row.boreMax + 0.01 }, 'assembled').length);
      const { points } = bevelPairValues(p, side as 'pinion' | 'wheel');
      assert.ok(
        Math.abs(Math.max(...points.map(([x, y]) => Math.hypot(x, y))) * 2 - row.outer) < 1e-8,
      );
      assert.ok(Math.abs(Math.max(...points.map((point) => point[2])) - row.overall) < 1e-8);
    }
  }
});

test('bevel dimensions reject inconsistent envelopes before meshing', () => {
  const cases: Parameters[] = [
    { module: 5 },
    { pinionFace: 30 },
    { wheelMounting: 10 },
    { pinionHubLength: 16 },
    { wheelBodyLength: 25 },
    { setScrewDiameter: 10 },
  ];
  for (const changes of cases)
    assert.ok(bevel.validate({ ...bevel.defaults, ...changes }, 'assembled').length > 0);
});

test('all bevel reference assemblies contain closed positive-volume meshes at the mounting datums', () => {
  for (const preset of bevel.presets) {
    const model = bevel.buildGeometry(preset.parameters, 'assembled');
    try {
      assert.equal(model.children.length, 2);
      assert.equal(model.children[0].position.x, preset.parameters.pinionMounting);
      assert.equal(model.children[1].position.z, -Number(preset.parameters.wheelMounting));
      assert.equal(model.children[0].rotation.y, -Math.PI / 2);
      const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      assert.ok(size.every((value) => Number.isFinite(value) && value > 0));
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const position = object.geometry.getAttribute('position'),
          edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < position.count; i += 3) {
          const points = [0, 1, 2].map((offset) =>
            new Vector3().fromBufferAttribute(position, i + offset),
          );
          volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
          const keys = points.map((point) =>
            point
              .toArray()
              .map((value) => Math.round(value * 100000))
              .join(','),
          );
          for (let side = 0; side < 3; side++) {
            const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
            if (keys[side] !== keys[(side + 1) % 3]) edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0);
        for (const [edge, count] of edges) assert.equal(count, 2, `${preset.id}: ${edge}`);
      });
    } finally {
      disposeModel(model);
    }
  }
});
