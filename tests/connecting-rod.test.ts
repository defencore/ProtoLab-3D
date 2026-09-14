import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part, { rodValues } from '../src/parts/connecting-rod/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

function closedMesh(mesh: Mesh, label: string) {
  const a = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index,
    edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? a.count); i += 3) {
    const pts = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(a, index ? index.getX(i + j) : i + j),
    );
    assert.ok(
      pts.every((v) => v.toArray().every(Number.isFinite)),
      label,
    );
    assert.ok(
      pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0])).lengthSq() > 1e-18,
      label,
    );
    volume += pts[0].dot(pts[1].clone().cross(pts[2])) / 6;
    const keys = pts.map((v) =>
      v
        .toArray()
        .map((x) => Math.round(x * 1e5))
        .join(','),
    );
    for (let j = 0; j < 3; j++) {
      const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(volume > 0, `${label}: outward orientation`);
  for (const [edge, count] of edges) assert.equal(count, 2, `${label}: ${edge}`);
}

test('connecting rod examples validate without inventing catalog dimensions', () => {
  assert.equal(part.presets.length, 8);
  assert.ok(part.presets.every((p) => !p.catalog));
  for (const p of part.presets)
    for (const s of part.states!)
      assert.deepEqual(validateParameters(part, p.parameters, s.id), [], p.id);
  assert.ok(part.notes!.includes('arrangement only'));
  const v = rodValues(part.defaults);
  assert.ok(v.smallHousing > Number(part.defaults.smallBore));
  assert.ok(v.bigHousing > Number(part.defaults.bigBore));
  const plain = rodValues({ ...part.defaults, smallBushing: false, bigBearing: 'none' });
  assert.equal(plain.smallHousing, part.defaults.smallBore);
  assert.equal(plain.bigHousing, part.defaults.bigBore);
});

test('connecting rod component states have closed meshes and stable labels', () => {
  for (const state of part.states!) {
    const model = part.buildGeometry(part.defaults, state.id);
    try {
      assert.equal(model.children.length, state.id === 'body' ? 1 : 9);
      assert.equal(new Set(model.children.map((c) => c.name)).size, model.children.length);
      model.traverse((c) => {
        if (c instanceof Mesh) closedMesh(c, `${state.id}/${c.parent?.name}`);
      });
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      part
        .dimensions(part.defaults, state.id)
        .forEach((v, i) => assert.ok(Math.abs(v - actual[i]) < 0.005));
      const python = part.python(part.defaults, state.id);
      for (const c of model.children)
        assert.ok(python.includes(`component_labels.append("${c.name}")`));
    } finally {
      disposeModel(model);
    }
  }
});

test('pin and journal working bores pass through the assembled inserts', () => {
  const model = part.buildGeometry(part.defaults, 'assembled');
  model.updateMatrixWorld(true);
  try {
    for (const z of [0, Number(part.defaults.centerDistance)]) {
      const ray = new Raycaster(new Vector3(0, -50, z), new Vector3(0, 1, 0));
      assert.equal(ray.intersectObject(model, true).length, 0, `Bore at ${z} must remain open.`);
    }
  } finally {
    disposeModel(model);
  }
});

test('I-beam and H-beam pockets remove material and retain a continuous web', () => {
  for (const section of ['i-beam', 'h-beam', 'solid']) {
    const p: Parameters = { ...part.defaults, section };
    const v = rodValues(p),
      mid = (v.pocketStart + v.pocketEnd) / 2,
      model = part.buildGeometry(p, 'body');
    model.updateMatrixWorld(true);
    try {
      const from = section === 'h-beam' ? new Vector3(50, 0, mid) : new Vector3(0, 50, mid);
      const direction = section === 'h-beam' ? new Vector3(-1, 0, 0) : new Vector3(0, -1, 0);
      const hit = new Raycaster(from, direction).intersectObject(model, true)[0];
      assert.ok(hit);
      const expected = section === 'solid' ? v.beamT / 2 : Number(p.webThickness) / 2;
      assert.ok(Math.abs(hit.distance - (50 - expected)) < 0.005, section);
      model.traverse((c) => {
        if (c instanceof Mesh) closedMesh(c, section);
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('one-piece variants and hidden hardware preserve physical component counts', () => {
  const cases: [Parameters, number][] = [
    [{ bigEnd: 'one-piece' }, 4],
    [{ bigEnd: 'one-piece', bigBearing: 'none', smallBushing: false }, 1],
    [{ includeHardware: false }, 5],
    [{ includeHardware: false, bigBearing: 'none', smallBushing: false }, 2],
  ];
  for (const [change, count] of cases) {
    const model = part.buildGeometry({ ...part.defaults, ...change }, 'assembled');
    try {
      assert.equal(model.children.length, count);
    } finally {
      disposeModel(model);
    }
  }
  const invalid: Parameters[] = [
    { centerDistance: 30 },
    { shankThickness: 30 },
    { webThickness: 10 },
    { flangeThickness: 7 },
    { boltSpacing: 90 },
    { boltSpacing: 32 },
    { boltGrip: 50 },
    { bigWidth: 10 },
  ];
  for (const change of invalid)
    assert.ok(
      validateParameters(part, { ...part.defaults, ...change }, 'assembled').length > 0,
      JSON.stringify(change),
    );
});

test('switching a compact one-piece rod to a cap adapts its bolt size and seats', () => {
  const compact = part.presets.find((p) => p.id === 'compact-linkage')!.parameters;
  const changed = part.updateParameters!({ ...compact, bigEnd: 'split-cap' }, 'bigEnd');
  assert.deepEqual(validateParameters(part, changed, 'assembled'), []);
  assert.ok(Number(changed.boltDiameter) < Number(compact.boltDiameter));
  const narrow: Parameters = { ...compact, section: 'h-beam', shankThickness: 3 };
  assert.deepEqual(
    validateParameters(part, part.updateParameters!(narrow, 'section'), 'assembled'),
    [],
  );
});
