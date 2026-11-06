import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import shell from '../src/parts/printed-threaded-shell/part';
import enclosure from '../src/parts/printed-threaded-enclosure/part';
import { layout, threadRadius } from '../src/parts/printed-threaded-shell/lib/model';
import { configured } from '../src/parts/printed-threaded-enclosure/lib/model';
import { validateParameters } from '../src/core/validation';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';

test('printed threaded shell exports a closed physical helix in both Simple and Full', () => {
  for (const preset of shell.presets) {
    const p = preset.parameters,
      d = layout(p);
    assert.deepEqual(validateParameters(shell, p, 'default'), []);
    for (const mode of ['simple', 'full'] as const)
      withGeometryMode(mode, () => {
        const model = shell.buildExportGeometry!(p, 'default');
        try {
          const mesh = model.children[0] as Mesh,
            g = mesh.geometry,
            positions = g.getAttribute('position');
          const index = g.getIndex(),
            triangles = (index?.count ?? positions.count) / 3;
          assert.ok(triangles > 30_000, 'real helical geometry must survive Simple STL');
          const edges = new Map<string, number>();
          let volume = 0;
          const at = (i: number) =>
            new Vector3().fromBufferAttribute(positions, index ? index.getX(i) : i);
          const key = (v: Vector3) =>
            v
              .toArray()
              .map((x) => x.toFixed(5))
              .join(',');
          for (let i = 0; i < triangles * 3; i += 3) {
            const a = at(i),
              b = at(i + 1),
              c = at(i + 2);
            volume += a.dot(b.clone().cross(c)) / 6;
            for (const [u, v] of [
              [a, b],
              [b, c],
              [c, a],
            ]) {
              const e = [key(u), key(v)].sort().join('/');
              edges.set(e, (edges.get(e) ?? 0) + 1);
            }
          }
          assert.ok(volume > 0);
          assert.ok(
            [...edges.values()].every((count) => count === 2),
            'closed two-face edge incidence',
          );
          const bounds = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
          assert.ok(bounds.every((v, i) => Math.abs(v - shell.dimensions(p, 'default')[i]) < 1e-4));
          assert.match(shell.python(p, 'default'), /makeLongHelix/);
          assert.ok(threadRadius(p, d.pitch / 2, 0, d.cap) < threadRadius(p, 0, 0, d.cap) - 0.5);
        } finally {
          disposeModel(model);
        }
      });
  }
});

test('thread phase and positive radial allowance are preserved along screw motion', () => {
  for (const preset of enclosure.presets) {
    const p = { ...preset.parameters, model: 'body' },
      d = layout(p);
    for (let turn = 0; turn <= 4; turn += 0.125) {
      const theta = 2 * Math.PI * turn,
        lift = d.pitch * turn;
      for (let z = 0; z <= d.length; z += d.pitch / 12)
        for (let a = 0; a < 2 * Math.PI; a += Math.PI / 12) {
          const male = threadRadius(p, z, a, false),
            female = threadRadius(p, z - lift, a - theta, true);
          assert.ok(female - male >= d.clearance - 1e-10);
        }
    }
  }
});

test('threaded enclosure inspection poses preserve two physical library configurations', () => {
  for (const preset of enclosure.presets) {
    const p = preset.parameters,
      canonical = configured(p, 'assembled');
    assert.equal(canonical.length, 2);
    for (const item of canonical) {
      assert.equal(item.component.libraryId, 'printed-threaded-shell');
      assert.ok(item.component.presetId);
    }
    for (const state of ['assembled', 'exploded', 'print']) {
      assert.deepEqual(validateParameters(enclosure, p, state), []);
      assert.deepEqual(
        configured(p, state).map((x) => x.component.parameters),
        canonical.map((x) => x.component.parameters),
      );
    }
    const model = enclosure.buildExportGeometry!(p, 'print');
    try {
      model.updateMatrixWorld(true);
      const bounds = model.children.map((child) => new Box3().setFromObject(child, true));
      assert.ok(bounds.every((box) => Math.abs(box.min.z) < 1e-5));
      assert.ok(bounds[1].min.x - bounds[0].max.x >= 7.999);
    } finally {
      disposeModel(model);
    }
  }
});

test('threaded shells reject lost root wall, insufficient engagement and missing body cavity', () => {
  assert.ok(
    shell.validate({ ...shell.defaults, diameter: 28, pitch: 5, wall: 6 }, 'default').length,
  );
  assert.ok(shell.validate({ ...shell.defaults, threadLength: 6, pitch: 4 }, 'default').length);
  assert.ok(shell.validate({ ...shell.defaults, height: 20, threadLength: 15 }, 'default').length);
});

test('cap validation and identity do not depend on hidden body-only dimensions', () => {
  const cap = {
    ...shell.defaults,
    model: 'cap',
    diameter: 28,
    pitch: 5,
    wall: 6,
    threadLength: 10,
  };
  const changed = { ...cap, height: 20, floor: 8 };
  assert.deepEqual(validateParameters(shell, cap, 'default'), []);
  assert.deepEqual(validateParameters(shell, changed, 'default'), []);
  assert.deepEqual(shell.dimensions(cap, 'default'), shell.dimensions(changed, 'default'));
  assert.deepEqual(shell.identityParameters!(cap), shell.identityParameters!(changed));
  assert.ok(shell.validate({ ...changed, model: 'body' }, 'default').length);
});

test('switching a custom cap to a body reconciles only incompatible body dimensions', () => {
  const cap = {
    ...shell.defaults,
    model: 'cap',
    diameter: 28,
    pitch: 5,
    wall: 6,
    threadLength: 10,
    height: 20,
    floor: 8,
  };
  const body = shell.updateParameters!({ ...cap, model: 'body' }, 'model');
  assert.deepEqual(validateParameters(shell, body, 'default'), []);
  assert.equal(body.wall, 5.75);
  assert.equal(body.height, 23);
  const { model: _model, wall: _wall, height: _height, ...unchanged } = body;
  const { model: _oldModel, wall: _oldWall, height: _oldHeight, ...original } = cap;
  assert.deepEqual(unchanged, original);
  assert.deepEqual(shell.updateParameters!(cap, 'clearance'), cap);
  assert.deepEqual(shell.updateParameters!(shell.defaults, 'model'), shell.defaults);
});
