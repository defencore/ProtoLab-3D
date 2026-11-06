import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import pin from '../src/parts/printed-pin-joint/part';
import { components, layout, pieces } from '../src/parts/printed-pin-joint/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

test('pin coupons preserve physical recipes and print on two separate flat bases', () => {
  for (const preset of pin.presets) {
    const p = preset.parameters,
      canonical = components(p),
      d = layout(p);
    assert.equal(canonical.length, 2);
    assert.ok(Math.abs(d.boreRadius - d.r - d.clearance / 2) < 1e-12);
    for (const state of ['assembled', 'exploded', 'print']) {
      assert.deepEqual(validateParameters(pin, p, state), []);
      assert.deepEqual(
        pieces(p, state).map((piece) => piece.component.parameters),
        canonical.map((c) => c.parameters),
      );
      const model = pin.buildGeometry(p, state);
      try {
        model.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(model, true);
        const actual = bounds.getSize(new Vector3()).toArray();
        assert.ok(actual.every((v, axis) => Math.abs(v - pin.dimensions(p, state)[axis]) < 1e-5));
        if (state === 'print') {
          const boxes = model.children.map((child) => new Box3().setFromObject(child, true));
          for (const box of boxes) assert.ok(Math.abs(box.min.z) < 0.001);
          assert.ok(boxes[1].min.x - boxes[0].max.x >= 7.999);
        } else if (state === 'assembled') {
          assert.ok(Math.abs(bounds.max.z - d.socketTop) < 0.001);
        }
      } finally {
        disposeModel(model);
      }
    }
  }
});

test('pin geometry rejects missing side wall, erased chamfer tip and inadequate engagement', () => {
  const patches: Parameters[] = [
    { width: 10, pinDiameter: 8, wall: 3 },
    { pinDiameter: 3, tipChamfer: 1.5 },
    { engagement: 4, faceGap: 2, tipChamfer: 1, pinDiameter: 6 },
  ];
  for (const patch of patches)
    assert.ok(validateParameters(pin, { ...pin.defaults, ...patch }, 'assembled').length);
  assert.ok(pin.validate(pin.defaults, 'cutaway').length);
});

test('pin native recipe keeps circular surfaces independent of preview tessellation', () => {
  const code = pin.python(pin.defaults, 'assembled');
  assert.match(code, /makeCylinder/);
  assert.match(code, /revolve/);
  assert.doesNotMatch(code, /makeShell/);
});
