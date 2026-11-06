import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3 } from 'three';
import part from '../src/parts/printed-screw-enclosure/part';
import {
  components,
  layout,
  pieces,
  screwPresets,
  nutPreset,
} from '../src/parts/printed-screw-enclosure/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

test('screw enclosure uses exact purchased executions and a viable nut/head stack', () => {
  for (const preset of part.presets) {
    const p = preset.parameters,
      d = layout(p),
      all = components(p);
    assert.equal(all.length, 10);
    assert.equal(all.filter((c) => c.supply === 'manufactured').length, 2);
    assert.equal(all.filter((c) => c.libraryId === 'bolt-screw').length, 4);
    assert.equal(all.filter((c) => c.libraryId === 'hex-nut').length, 4);
    assert.ok(d.roof >= d.wall && d.lidSeatWeb >= d.wall);
    assert.ok(Math.abs(d.nutBottom - d.tip - 2 * d.pitch) < 1e-10);
    assert.equal(d.nutPocketTop, d.nutTop);
    assert.ok(d.pocketAF < (2 * d.nutAF) / Math.sqrt(3));
    for (const c of all.filter((c) => c.libraryId === 'bolt-screw')) {
      assert.equal(c.presetId, d.selected.id);
      assert.deepEqual(c.parameters, d.selected.parameters);
    }
    for (const c of all.filter((c) => c.libraryId === 'hex-nut')) {
      assert.equal(c.presetId, nutPreset.id);
      assert.deepEqual(c.parameters, nutPreset.parameters);
    }
  }
  assert.equal(screwPresets.socket.parameters.length, 12);
  assert.equal(screwPresets.countersunk.parameters.length, 12);
  assert.equal(screwPresets.socket.catalog!.standard, 'DIN 912');
  assert.equal(screwPresets.countersunk.catalog!.standard, 'DIN 7991');
});

test('screw enclosure inspection keeps canonical recipes and fabrication excludes all metal', () => {
  for (const preset of part.presets) {
    const p = preset.parameters,
      canonical = components(p);
    for (const state of ['assembled', 'exploded', 'print']) {
      assert.deepEqual(validateParameters(part, p, state), []);
      const shown = pieces(p, state);
      assert.equal(shown.length, state === 'print' ? 2 : 10);
      for (const shownPart of shown) {
        const original = canonical.find((c) => c.id === shownPart.component.id)!;
        assert.deepEqual(shownPart.component.parameters, original.parameters);
        assert.equal(shownPart.component.presetId, original.presetId);
      }
      const model = part.buildGeometry(p, state);
      const exported = part.buildExportGeometry!(p, state);
      try {
        model.updateMatrixWorld(true);
        assert.equal(
          exported.children.length,
          2,
          'STL fabrication must not contain bought hardware',
        );
        if (state === 'print') {
          const boxes = model.children.map((child) => new Box3().setFromObject(child, true));
          assert.ok(boxes.every((b) => Math.abs(b.min.z) < 0.001));
          assert.ok(boxes[1].min.y - boxes[0].max.y >= 7.999);
        } else if (state === 'assembled') {
          const d = layout(p);
          for (const index of [3, 5, 7, 9]) {
            const bounds = new Box3().setFromObject(model.children[index], true);
            assert.ok(
              bounds.max.y - bounds.min.y < d.pocketAF,
              'The actual clocked source nut must present across flats to the side-entry slot',
            );
          }
        }
      } finally {
        disposeModel(model);
        disposeModel(exported);
      }
    }
  }
});

test('screw enclosure rejects weakened roof and head seats and impossible boss clearances', () => {
  const patches: Parameters[] = [
    { headStyle: 'socket', lidThickness: 5.5, headRecess: 1 },
    { headStyle: 'countersunk', lidThickness: 9 },
    { bossWidth: 12, wall: 4 },
    { width: 54, depth: 48, bossWidth: 22 },
  ];
  for (const patch of patches)
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length);
});

test('screw head switching reconciles the sourced stack and hides impossible head executions', () => {
  const thick = { ...part.defaults, lidThickness: 8 };
  assert.deepEqual(validateParameters(part, thick, 'assembled'), []);
  const countersunk = part.updateParameters!({ ...thick, headStyle: 'countersunk' }, 'headStyle');
  assert.equal(countersunk.lidThickness, 6.5);
  assert.deepEqual(validateParameters(part, countersunk, 'assembled'), []);
  const thickerWall = part.updateParameters!({ ...countersunk, wall: 4, bossWidth: 16 }, 'wall');
  assert.equal(thickerWall.headStyle, 'socket');
  assert.deepEqual(validateParameters(part, thickerWall, 'assembled'), []);
  const option = part.parameters
    .find((f) => f.key === 'headStyle')!
    .options!.find((o) => o.value === 'countersunk')!;
  assert.equal(option.availableWhen!(thickerWall), false);
});
