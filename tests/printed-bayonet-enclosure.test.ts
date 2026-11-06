import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3 } from 'three';
import part from '../src/parts/printed-bayonet-enclosure/part';
import { layout, components, pieces } from '../src/parts/printed-bayonet-enclosure/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

test('bayonet enclosure has complementary channel clearances and invariant physical recipes', () => {
  for (const preset of part.presets) {
    const p = preset.parameters,
      d = layout(p),
      canonical = components(p);
    assert.ok(d.projection - d.c > 0.5);
    assert.ok(d.turn + d.span + 2 * d.angleGap < 360 / d.count);
    for (const state of part.states!) {
      assert.deepEqual(validateParameters(part, p, state.id), [], preset.id + '/' + state.id);
      assert.deepEqual(
        pieces(p, state.id).map((x) => x.component.parameters),
        canonical.map((x) => x.parameters),
      );
    }
    assert.deepEqual(pieces(p, 'unlocked')[1].component.placement.rotation, [0, 0, 0]);
    assert.equal(canonical[1].placement.rotation[2], d.turn);
    assert.match(part.python(p, 'assembled'), /Part\.Arc/);
    assert.doesNotMatch(part.python(p, 'assembled'), /makeShell/);
  }
});

test('bayonet print layouts have two disjoint bed-contacting parts', () => {
  for (const preset of part.presets) {
    const model = part.buildGeometry(preset.parameters, 'print');
    try {
      model.updateMatrixWorld(true);
      const boxes = model.children.map((child) => new Box3().setFromObject(child, true));
      assert.equal(boxes.length, 2);
      for (const box of boxes) assert.ok(Math.abs(box.min.z) < 0.002);
      assert.ok(boxes[1].min.x - boxes[0].max.x > 7.99);
    } finally {
      disposeModel(model);
    }
  }
});

test('bayonet rejects intersecting channels, erased capture and missing neck material', () => {
  const patches: Parameters[] = [
    { lugs: 4, turnAngle: 90 },
    { lugs: 2.5 },
    { lugProjection: 1, clearance: 0.7 },
    { neckHeight: 7, lugThickness: 5 },
    { diameter: 32, wall: 6 },
  ];
  for (const patch of patches)
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length);
});
