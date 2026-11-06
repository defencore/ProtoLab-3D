import assert from 'node:assert/strict';
import test from 'node:test';
import { box, pythonShape, type Shape } from '../src/core/assembly/boundary/shapes';
import { parseDetailRecipe } from '../src/core/component-recipes';

const a = box([10, 10, 10], [0, 0, 0]);
const b = box([10, 10, 10], [5, 0, 0]);
const c = box([10, 10, 10], [10, 0, 0]);

test('native batch unions flatten their whole marked route into one exact operation', () => {
  const shape: Shape = { kind: 'union', nativeBatch: true, children: [
    { kind: 'union', nativeBatch: true, children: [a, b] }, c,
  ] };
  assert.deepEqual(parseDetailRecipe(JSON.stringify(shape)), shape);
  const code = pythonShape(shape);
  assert.equal((code.match(/\.multiFuse\(/g) ?? []).length, 1);
  assert.equal(code, `${pythonShape(a)}.multiFuse([${pythonShape(b)},${pythonShape(c)}])`);
});

test('ordinary unions and explicit refinement checkpoints retain their authored order', () => {
  const plain: Shape = { kind: 'union', children: [a, b] };
  assert.equal(pythonShape(plain), `${pythonShape(a)}.fuse(${pythonShape(b)})`);
  assert.equal(pythonShape({ ...plain, nativeBatch: false }), pythonShape(plain));
  const checkpoint: Shape = { kind: 'union', children: [a, b], nativeBatch: true, nativeRefine: true };
  assert.ok(pythonShape({ kind: 'union', nativeBatch: true, children: [checkpoint, c] })
    .includes('.removeSplitter().multiFuse(['));
});

test('batch flags are boolean and accepted only on unions', () => {
  for (const nativeBatch of [null, 1, 'true'])
    assert.throws(() => parseDetailRecipe(JSON.stringify({ kind: 'union', children: [a, b], nativeBatch })));
  for (const kind of ['subtract', 'intersect'])
    assert.throws(() => parseDetailRecipe(JSON.stringify({ kind, children: [a, b], nativeBatch: true })));
});
