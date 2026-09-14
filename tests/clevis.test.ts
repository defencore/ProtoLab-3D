import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part, { values } from '../src/parts/clevis/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

function checkMesh(mesh: Mesh, label: string) {
  const p = mesh.geometry.getAttribute('position'),
    idx = mesh.geometry.index;
  const edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
    const vertices = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(p, idx ? idx.getX(i + j) : i + j),
    );
    assert.ok(
      vertices.every((v) => v.toArray().every(Number.isFinite)),
      label,
    );
    const cross = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
    assert.ok(cross.lengthSq() > 1e-18, `${label}: degenerate face`);
    volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
    const keys = vertices.map((v) =>
      v
        .toArray()
        .map((n) => Math.round(n * 1e5))
        .join(','),
    );
    for (let j = 0; j < 3; j++) {
      const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(volume > 0, `${label}: outward volume`);
  for (const [edge, count] of edges) assert.equal(count, 2, `${label}: ${edge}`);
}

test('clevis references contain only established dimensions and all presets validate', () => {
  assert.equal(part.presets.length, 24);
  for (const preset of part.presets)
    for (const state of part.states!)
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), [], preset.id);
  const pushrod = part.presets[0];
  assert.deepEqual(pushrod.catalog!.verifiedParameters, [
    'length',
    'bodyDiameter',
    'forkGap',
    'rodDiameter',
    'pinDiameter',
    'setScrewDiameter',
    'setScrewCount',
  ]);
  const cable = part.presets.filter((p) => p.parameters.variant === 'cable');
  assert.deepEqual(
    cable.map((p) => p.parameters.rodDiameter),
    [1.5, 2, 3, 4, 5, 6, 8, 10, 12],
  );
  for (const p of cable) assert.deepEqual(p.catalog!.verifiedParameters, ['rodDiameter']);
  assert.ok(
    part.presets
      .filter((p) => String(p.parameters.variant).includes('threaded'))
      .every((p) => !p.catalog),
  );
});

test('clevis states keep closed separate components and exact assembly dimensions', () => {
  for (const state of part.states!) {
    const model = part.buildGeometry(part.defaults, state.id);
    try {
      assert.equal(model.children.length, state.id === 'body' ? 1 : 5);
      model.traverse((child) => {
        if (child instanceof Mesh) checkMesh(child, state.id);
      });
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      part
        .dimensions(part.defaults, state.id)
        .forEach((d, i) =>
          assert.ok(Math.abs(d - actual[i]) < 0.01, `${state.id}: axis ${i}, ${d}/${actual[i]}`),
        );
      const python = part.python(part.defaults, state.id);
      assert.ok(python.includes('shape = Part.makeCompound(components)'));
      assert.equal((python.match(/component_labels.append/g) ?? []).length, model.children.length);
    } finally {
      disposeModel(model);
    }
  }
});

test('fork slot, rod bore and transverse holes are physically open', () => {
  const p = part.defaults,
    v = values(p),
    model = part.buildGeometry(p, 'body');
  model.updateMatrixWorld(true);
  try {
    const axis = new Raycaster(new Vector3(0, 0, -1), new Vector3(0, 0, 1));
    assert.equal(
      axis.intersectObject(model, true).length,
      0,
      'Rod bore must communicate with the open fork.',
    );
    const pin = new Raycaster(new Vector3(0, -20, v.pinZ), new Vector3(0, 1, 0));
    assert.equal(
      pin.intersectObject(model, true).length,
      0,
      'Pin bore must pass through both cheeks.',
    );
    const screw = new Raycaster(new Vector3(0, 20, v.screwZ[0]), new Vector3(0, -1, 0));
    const hits = screw.intersectObject(model, true);
    assert.ok(
      hits.length > 0 && hits[0].distance > 20,
      'Set screw hole must open into the rod bore.',
    );
  } finally {
    disposeModel(model);
  }
});

test('male and female helical connections build valid dimensions and preserve requested hand', () => {
  for (const variant of ['female-threaded', 'male-threaded']) {
    const p: Parameters = {
      ...part.defaults,
      variant,
      bodyDiameter: 8,
      rodDiameter: 3,
      rodDepth: 6,
      maleLength: 6,
      threadPitch: 0.5,
      handedness: 'left',
    };
    assert.deepEqual(validateParameters(part, p, 'body'), []);
    const model = part.buildGeometry(p, 'body');
    try {
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      part.dimensions(p, 'body').forEach((d, i) => assert.ok(Math.abs(actual[i] - d) < 0.02));
      assert.ok(part.python(p, 'body').includes(',0.5,True,'));
      model.traverse((child) => {
        if (child instanceof Mesh) checkMesh(child, variant);
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('clevis rejects broken forks, clashing screws and invalid thread cores', () => {
  const changes: Parameters[] = [
    { forkGap: 7 },
    { pinOffset: 1 },
    { rodDiameter: 7 },
    { rodDepth: 20 },
    { setScrewSpacing: 2 },
    { setScrewCount: 1.5 },
    { setScrewOffset: 1 },
    { variant: 'female-threaded', rodDiameter: 1, threadPitch: 4 },
  ];
  for (const change of changes)
    assert.ok(
      validateParameters(part, { ...part.defaults, ...change }, 'assembled').length > 0,
      JSON.stringify(change),
    );
  const body = part.buildGeometry({ ...part.defaults, includeHardware: false }, 'exploded');
  try {
    assert.equal(body.children.length, 1);
  } finally {
    disposeModel(body);
  }
});
