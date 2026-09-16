import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/flight-controller/part';
import models from '../src/parts/flight-controller/lib/models.json';
import { mountingHoles } from '../src/parts/flight-controller/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import {
  buildPresetIndex,
  emptyPresetFilters,
  filterPresets,
  fieldId,
} from '../src/core/preset-search';
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
    const keys = points.map((p) =>
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

test('flight controllers: fixed mechanical variants and source-aware filters', () => {
  assert.equal(part.presets.length, 8);
  assert.equal(part.catalogSelectionOnly, true);
  const signatures = models.map((m) =>
    JSON.stringify([m.width, m.length, m.height, m.mount, m.motorConnection, m.hdSocket]),
  );
  assert.equal(new Set(signatures).size, models.length, 'no mechanically identical variants');
  for (const preset of part.presets) {
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), []);
    assert.ok(part.validate({ ...preset.parameters, width: 42 }, 'assembled').length);
    assert.ok(preset.catalog?.sourceUrl.startsWith('https://'));
  }
  assert.ok(part.validate({ model: 'unknown' }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'invalid').length);
  const filters = emptyPresetFilters(part);
  filters.parameters[fieldId(part.catalogFilterFields!.find((f) => f.key === 'height')!)] = {
    min: '0',
    max: '100',
  };
  const matches = filterPresets(buildPresetIndex([part]), filters).items;
  assert.equal(matches.length, 6, 'unknown whoop height excluded');
  const attrs = (id: string) => part.presets.find((p) => p.id === id)!.catalog!.attributes!;
  assert.equal(attrs('speedybee-f405-mini').hdSocket, false);
  assert.equal(attrs('speedybee-f405-v4').hdSocket, true);
  assert.equal(attrs('pixhawk-6c-mini-a').length, 54.3);
  assert.equal(attrs('pixhawk-6c-mini-a').height, 17.5);
  assert.equal(attrs('pixhawk-6c-mini-b').height, 18.2);
  for (const m of models.filter((m) => m.kind === 'Cased autopilot')) {
    assert.equal(attrs(m.id).cellsMax, undefined, 'servo rail is not direct LiPo input');
    assert.equal(attrs(m.id).hole, undefined, 'case screw patterns not guessed mounting bores');
  }
});
for (const m of models)
  test(`${m.id}: closed geometry and measured bounds in both states`, () => {
    for (const state of part.states!) {
      const p = { model: m.id };
      const group = part.buildGeometry(p, state.id);
      try {
        group.updateMatrixWorld(true);
        group.traverse((child) => {
          if (child instanceof Mesh) checkMesh(child, child.name);
        });
        const size = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
        part
          .dimensions(p, state.id)
          .forEach((v, i) =>
            assert.ok(Math.abs(v - size[i]) < 0.001, `${m.id} analytic/preview bounds`),
          );
        assert.ok(group.children.length > 30, 'separate detailed components');
        assert.equal(
          new Set(group.children.map((c) => c.name)).size,
          group.children.length,
          'unique labels',
        );
        if (state.id === 'assembled') {
          [m.width, m.length].forEach((v, i) =>
            assert.ok(Math.abs(v - size[i]) < 0.001, `${m.id}: width/length`),
          );
          if (!m.assumedHeight)
            assert.ok(Math.abs(size[2] - m.height) < 0.001, `${m.id}: published height ${size[2]}`);
          if (m.kind !== 'Cased autopilot') {
            const board = group.children.find((c) => c.name.startsWith('PCB'))!;
            for (const [x, y] of mountingHoles(m)) {
              const ray = new Raycaster(new Vector3(x, y, 50), new Vector3(0, 0, -1));
              assert.equal(
                ray.intersectObject(board, true).length,
                0,
                `${m.id}: mounting bore through PCB`,
              );
            }
          }
        }
      } finally {
        disposeModel(group);
      }
    }
  });
test('motor sockets change only the whoop connection variant', () => {
  for (const m of models.filter((m) => m.layout === 'whoop')) {
    const g = part.buildGeometry({ model: m.id }, 'assembled');
    try {
      assert.equal(
        g.children.filter((c) => /^Motor [1-4] housing$/.test(c.name)).length,
        m.motorSockets,
      );
    } finally {
      disposeModel(g);
    }
  }
});
