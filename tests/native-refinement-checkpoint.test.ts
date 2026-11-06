import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, Vector3 } from 'three';
import { parseDetailRecipe, detailComponent } from '../src/core/component-recipes';
import { disposeModel } from '../src/core/mechanical';
import {
  box,
  subtract,
  union,
  component,
  pythonShape,
  type Shape,
} from '../src/core/assembly/boundary/shapes';

const base = union(box([10, 10, 10], [0, 0, 0]), box([10, 10, 10], [5, 0, 0]));

function previewVolume(shape: Shape): number {
  const model = component(shape, 'Checkpoint preview', 0);
  model.updateMatrixWorld(true);
  let volume = 0;
  try {
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      const indices = object.geometry.index;
      for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
        const [a, b, c] = [0, 1, 2].map((j) =>
          new Vector3()
            .fromBufferAttribute(positions, indices?.getX(i + j) ?? i + j)
            .applyMatrix4(object.matrixWorld),
        );
        volume += a.dot(b.cross(c)) / 6;
      }
    });
    return volume;
  } finally {
    disposeModel(model);
  }
}

test('native refinement checkpoints preserve strict recipe validation and default output', () => {
  for (const nativeRefine of [undefined, false, true]) {
    const shape: Shape = {
      kind: 'union',
      children: [base],
      ...(nativeRefine === undefined ? {} : { nativeRefine }),
    };
    assert.deepEqual(parseDetailRecipe(JSON.stringify(shape)), shape);
  }
  for (const nativeRefine of ['true', 1, null])
    assert.throws(() =>
      parseDetailRecipe(JSON.stringify({ kind: 'union', children: [base], nativeRefine })),
    );
  assert.equal(
    pythonShape({ kind: 'union', children: [base], nativeRefine: false }),
    pythonShape(base),
  );
});

test('a native checkpoint occurs before later cuts without altering preview geometry', () => {
  const refined: Shape = { kind: 'union', children: [base], nativeRefine: true };
  const tool = box([2, 2, 12], [2, 2, -1]);
  const shape = subtract(refined, tool);
  assert.ok(pythonShape(shape).includes('.removeSplitter().cut('));
  const actual = previewVolume(shape);
  const plain = previewVolume(subtract({ ...refined, nativeRefine: false }, tool));
  assert.ok(Math.abs(actual - 1460) < 0.01, `Float32 preview volume: ${actual}`);
  assert.ok(Math.abs(actual - plain) < 1e-5, `Refined ${actual}; plain ${plain}`);
});

test('authored-frame preservation is explicit and leaves default component identity unchanged', () => {
  const shape: Shape = { kind: 'box', size: [3, 4, 5], origin: [100, 20, -5] };
  const regular = detailComponent('sample', 'Sample', shape);
  assert.deepEqual(
    detailComponent('sample', 'Sample', shape, { preserveAuthoredFrame: false }),
    regular,
  );
  const retained = detailComponent('sample', 'Sample', shape, { preserveAuthoredFrame: true });
  assert.deepEqual(retained.placement.translation, [0, 0, 0]);
  assert.deepEqual(JSON.parse(String(retained.parameters.recipe)), shape);
  assert.equal(retained.parameters.preserveAuthoredFrame, undefined);
  const local = JSON.parse(String(regular.parameters.recipe));
  assert.deepEqual(
    local.origin.map((value: number, i: number) => value + regular.placement.translation[i]),
    shape.origin,
  );
  assert.equal(retained.parameters.meshBackend, regular.parameters.meshBackend);
  assert.equal(retained.parameters.meshConform, regular.parameters.meshConform);
});
