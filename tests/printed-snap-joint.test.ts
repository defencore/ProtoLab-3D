import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import part from '../src/parts/printed-snap-joint/part';
import { configured, layout } from '../src/parts/printed-snap-joint/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { eskdIdentity } from '../src/core/eskd';

test('snap examples have positive engagement and bounded nominal beam strain', () => {
  for (const preset of part.presets) {
    const p = preset.parameters,
      d = layout(p);
    for (const state of ['assembled', 'exploded', 'print'])
      assert.deepEqual(validateParameters(part, p, state), [], preset.id + ':' + state);
    assert.ok(d.e > d.c);
    assert.ok(d.tabLiftEstimate > d.e, 'extended tab lift exceeds hook lift');
    assert.ok(d.strainPercent < Number(p.strainLimit));
  }
  assert.ok(Math.abs(layout(part.defaults).strainPercent - 5 / 12) < 1e-10);
  assert.match(
    part.validate({ ...part.defaults, rootRadius: 0.4 }, 'assembled').join(' '),
    /Root radius/,
  );
  assert.match(
    part.validate({ ...part.defaults, hook: 0.3 }, 'assembled').join(' '),
    /positive catch/,
  );
  assert.match(
    part.validate({ ...part.defaults, length: 12 }, 'assembled').join(' '),
    /screening|strain/,
  );
});

test('snap inspection poses retain fabrication identity and put separate parts on the bed', () => {
  for (const preset of part.presets) {
    const p = preset.parameters,
      canonical = configured(p);
    for (const state of ['exploded', 'print']) {
      const shown = configured(p, state);
      assert.equal(shown.length, 2);
      assert.deepEqual(
        shown.map((x) => [x.component.id, x.component.libraryId, x.component.parameters]),
        canonical.map((x) => [x.component.id, x.component.libraryId, x.component.parameters]),
      );
    }
    const model = part.buildGeometry(p, 'print');
    try {
      model.updateMatrixWorld(true);
      const boxes = model.children.map((child) => new Box3().setFromObject(child, true));
      assert.equal(boxes.length, 2);
      for (const box of boxes) {
        assert.ok(
          Math.abs(box.min.z) < 1e-4,
          'each printable component touches Z=0 within preview tolerance',
        );
        assert.ok(
          box
            .getSize(new Vector3())
            .toArray()
            .every((size) => Number.isFinite(size) && size > 0),
        );
      }
      assert.ok(!boxes[0].intersectsBox(boxes[1]), 'bed layout separates the components');
    } finally {
      disposeModel(model);
    }
  }
});

test('snap strain screening assumptions do not create a different physical product', () => {
  const p = part.defaults;
  const changed = { ...p, strainLimit: 2 };
  assert.deepEqual(part.identityParameters!(p), part.identityParameters!(changed));
  assert.equal(
    eskdIdentity(part, p, 'assembled').configurationKey,
    eskdIdentity(part, changed, 'assembled').configurationKey,
  );
  assert.deepEqual(part.composition!(p), part.composition!(changed));
  assert.match(part.validate({ ...p, strainLimit: 0.1 }, 'assembled').join(' '), /strain/);
});
