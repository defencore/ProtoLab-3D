import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import dovetail from '../src/parts/printed-dovetail-joint/part';
import tongue from '../src/parts/printed-tongue-groove-joint/part';
import {
  layout as dovetailLayout,
  pieces as dovetailPieces,
} from '../src/parts/printed-dovetail-joint/lib/model';
import {
  layout as tongueLayout,
  pieces as tonguePieces,
} from '../src/parts/printed-tongue-groove-joint/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

for (const [part, layout, pieces] of [
  [dovetail, dovetailLayout, dovetailPieces],
  [tongue, tongueLayout, tonguePieces],
] as const) {
  test(`${part.id}: calibration presets preserve physical identity in all inspection poses`, () => {
    for (const preset of part.presets) {
      const physical = part.composition!(preset.parameters);
      assert.equal(physical.components.length, 2);
      assert.deepEqual(
        physical.components.map((item) => item.id),
        ['male', 'female'],
      );
      for (const state of part.states!) {
        assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
        const displayed = pieces(preset.parameters, state.id);
        for (let i = 0; i < 2; i++) {
          assert.equal(displayed[i].component.libraryId, 'manufactured-detail');
          assert.deepEqual(displayed[i].component.parameters, physical.components[i].parameters);
          assert.equal(displayed[i].component.quantity, 1);
        }
        assert.deepEqual(part.composition!(preset.parameters), physical);
      }
    }
  });

  test(`${part.id}: rendered envelopes and print bed poses match actual separate coupons`, () => {
    for (const preset of part.presets) {
      const d = layout(preset.parameters);
      for (const state of part.states!) {
        const geometry = part.buildGeometry(preset.parameters, state.id);
        try {
          geometry.updateMatrixWorld(true);
          const bounds = new Box3().setFromObject(geometry, true);
          const size = bounds.getSize(new Vector3()).toArray();
          const declared = part.dimensions(preset.parameters, state.id);
          size.forEach((v, i) => assert.ok(Math.abs(v - declared[i]) < 1e-5));
          assert.ok(Math.abs(size[0] - d.width) < 1e-5);
          assert.ok(
            Math.abs(size[1] - (state.id === 'assembled' ? d.length : 2 * d.length + 8)) < 1e-5,
          );
          assert.ok(
            Math.abs(
              size[2] -
                (state.id === 'print' ? d.base + d.height : 2 * d.base + d.height + d.clearance),
            ) < 1e-5,
          );
          if (state.id === 'print') {
            const boxes = geometry.children.map((child) => new Box3().setFromObject(child, true));
            assert.equal(boxes.length, 2);
            boxes.forEach((box) => assert.ok(Math.abs(box.min.z) < 1e-5));
            assert.ok(Math.abs(boxes[1].min.y - boxes[0].max.y - 8) < 1e-5);
          }
        } finally {
          disposeModel(geometry);
        }
      }
    }
  });
}

test('dovetail maintains normal flank clearance and real vertical capture throughout open-ended insertion', () => {
  for (const preset of dovetail.presets) {
    const d = dovetailLayout(preset.parameters);
    assert.ok(d.head / 2 > d.slotBottom, 'head cannot withdraw vertically through receiver throat');
    assert.ok(d.width / 2 - d.slotTop >= d.base, 'receiver side material');
    for (let i = 0; i <= 10; i++) {
      const z = d.clearance + ((d.height - d.clearance) * i) / 10;
      const maleX = d.neck / 2 + d.slope * z;
      const femaleX = d.slotBottom + d.slope * (z - d.clearance);
      const gap = (femaleX - maleX) / Math.sqrt(1 + d.slope * d.slope);
      assert.ok(Math.abs(gap - d.clearance) < 1e-12);
    }
  }
});

test('rigid joints reject lost capture, inadequate receiver material and invalid saved configurations', () => {
  assert.ok(
    validateParameters(
      dovetail,
      { ...dovetail.defaults, headWidth: dovetail.defaults.tongueWidth },
      'assembled',
    ).some((e) => /head width/.test(e)),
  );
  assert.ok(
    validateParameters(dovetail, { ...dovetail.defaults, headWidth: 10.2 }, 'assembled').some((e) =>
      /capture/.test(e),
    ),
  );
  for (const part of [dovetail, tongue]) {
    assert.ok(
      validateParameters(part, { ...part.defaults, width: 12 }, 'assembled').some((e) =>
        /coupon width/.test(e),
      ),
    );
    assert.ok(validateParameters(part, { ...part.defaults, clearance: -0.1 }, 'assembled').length);
    assert.ok(
      validateParameters(part, { ...part.defaults, tongueHeight: NaN }, 'assembled').length,
    );
    assert.ok(validateParameters(part, part.defaults, 'closed').length);
  }
});
