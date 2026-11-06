import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import rim from '../src/parts/printed-rim-enclosure/part';
import guided from '../src/parts/printed-self-centering-enclosure/part';
import {
  layout as rimLayout,
  pieces as rimPieces,
  shapes as rimShapes,
} from '../src/parts/printed-rim-enclosure/lib/model';
import {
  layout as guidedLayout,
  pieces as guidedPieces,
} from '../src/parts/printed-self-centering-enclosure/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

for (const [part, pieces] of [
  [rim, rimPieces],
  [guided, guidedPieces],
] as const) {
  test(`${part.id}: every example preserves two physical recipes in three actual poses`, () => {
    for (const preset of part.presets) {
      const p = preset.parameters,
        canonical = part.composition!(p);
      assert.equal(canonical.components.length, 2);
      assert.deepEqual(
        canonical.components.map((c) => c.id),
        ['base', 'lid'],
      );
      for (const state of ['assembled', 'exploded', 'print']) {
        assert.deepEqual(validateParameters(part, p, state), [], `${preset.id}/${state}`);
        assert.deepEqual(
          pieces(p, state).map((x) => x.component.parameters),
          canonical.components.map((x) => x.parameters),
        );
        assert.ok(
          canonical.components.every(
            (x) =>
              x.libraryId === 'manufactured-detail' &&
              x.supply === 'manufactured' &&
              x.quantity === 1,
          ),
        );
        const model = part.buildGeometry(p, state);
        try {
          model.updateMatrixWorld(true);
          const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
          const reported = part.dimensions(p, state);
          assert.ok(actual.every((value, axis) => Math.abs(value - reported[axis]) < 0.001));
          if (state === 'print') {
            const boxes = model.children.map((x) => new Box3().setFromObject(x, true));
            assert.ok(boxes.every((x) => Math.abs(x.min.z) < 0.001));
            assert.ok(boxes[1].min.x - boxes[0].max.x >= 7.999);
          }
        } finally {
          disposeModel(model);
        }
      }
    }
  });
}

test('rim enclosure implements three distinct seam sections and protects groove walls', () => {
  const forms = ['stepped', 'groove', 'labyrinth'];
  assert.equal(
    new Set(forms.map((model) => JSON.stringify(rimShapes({ ...rim.defaults, model })))).size,
    3,
  );
  const d = rimLayout({ ...rim.defaults, model: 'groove' });
  assert.ok(d.skirtWall >= 1.2);
  const switched = rim.updateParameters!({ ...rim.defaults, model: 'groove', wall: 3.5 }, 'model');
  assert.deepEqual(validateParameters(rim, switched, 'assembled'), []);
  assert.ok(Number(switched.wall) > 3.5);
  for (const patch of [
    { model: 'groove', wall: 3.5, rimThickness: 2 },
    { model: 'labyrinth', depth: 30, wall: 8, rimThickness: 4 },
    { height: 12, wall: 8, rimDepth: 6 },
  ] as Parameters[]) {
    assert.ok(validateParameters(rim, { ...rim.defaults, ...patch }, 'assembled').length);
  }
});

test('taper-guided enclosure separates capture reach, residual play and insertion stop', () => {
  for (const preset of guided.presets) {
    const d = guidedLayout(preset.parameters);
    assert.equal(d.capture, d.c + d.a);
    assert.ok(d.straight >= 1);
    assert.ok(d.H - d.t - d.e > 1);
    assert.ok(d.relief < d.r / 2);
    assert.ok(d.tipW < d.pilotW && d.tipD < d.pilotD);
    assert.ok(Math.abs((d.W - 2 * d.t - d.pilotW) / 2 - d.c) < 1e-10);
    assert.ok(Math.abs((d.W - 2 * d.t - d.tipW) / 2 - d.capture) < 1e-10);
  }
  for (const patch of [
    { rimDepth: 3, leadIn: 3 },
    { rimThickness: 1.6, cornerRelief: 1 },
    { height: 12, wall: 8, rimDepth: 6 },
  ] as Parameters[]) {
    assert.ok(validateParameters(guided, { ...guided.defaults, ...patch }, 'assembled').length);
  }
});
