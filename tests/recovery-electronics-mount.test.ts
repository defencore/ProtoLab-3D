import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import part from '../src/parts/recovery-electronics-mount/part';
import { mountingLayout } from '../src/parts/recovery-electronics-mount/lib/layout';
import { usbMountAxes, platformAxes } from '../src/parts/recovery-electronics-mount/lib/model';
import nativePads from '../src/parts/recovery-electronics-mount/lib/pads-native.json';
import { configureProduct } from '../src/core/design-project';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

test('source mounting details retain fixed independent identities and unresolved pad supply', () => {
  assert.equal(part.presets.length, 5);
  assert.equal(new Set(part.presets.map((preset) => preset.id)).size, 5);
  assert.equal(part.states, undefined, 'single details do not acquire invented inspection states');
  for (const preset of part.presets) {
    assert.deepEqual(validateParameters(part, preset.parameters, 'default'), []);
    assert.ok(part.validate({ ...preset.parameters, scale: 2 }, 'default').length);
    assert.ok(part.validate(preset.parameters, 'exploded').length);
    const product = configureProduct({
      part,
      parameters: preset.parameters,
      state: 'default',
      presetId: preset.id,
    });
    assert.equal(product.libraryId, part.id);
    assert.equal(product.presetId, preset.id);
    assert.equal(product.supply, preset.id.startsWith('gps-pad') ? 'reference' : 'manufactured');
  }
});

test('current source layout keeps integrated supports, open access and distinct retainer placements', () => {
  assert.equal(mountingLayout.upper.translation[2], 13);
  assert.equal(mountingLayout.usb.translation[2], 5);
  assert.equal(mountingLayout.usb.rotation[2], 90);
  assert.equal(mountingLayout.gps.translation[2], 3);
  assert.equal(mountingLayout.buzzer.translation[2], 3);
  assert.equal(mountingLayout.gpsPads.length, 4);
  assert.equal(
    mountingLayout.gpsPads.filter((pad) => pad.model === 'gps-pad-plain-current').length,
    2,
  );
  assert.equal(
    new Set(mountingLayout.gpsPads.map((pad) => JSON.stringify(pad.translation))).size,
    4,
  );
  for (const pad of mountingLayout.gpsPads) assert.equal(pad.translation[2] + 8.7, 13);
  for (const [x, y] of platformAxes) assert.ok(Math.abs(Math.hypot(x, y) - 36) < 1e-10);
  assert.ok(
    Math.abs(
      Math.hypot(usbMountAxes[0][0] - usbMountAxes[1][0], usbMountAxes[0][1] - usbMountAxes[1][1]) -
        16,
    ) < 1e-10,
  );
  assert.equal(mountingLayout.buzzerTies.installedPathModelled, false);
  assert.equal(mountingLayout.interdiscPosts.length, 4);
});

test('source plates and exact native pad variants have consistent preview envelopes', () => {
  for (const preset of part.presets) {
    const model = part.buildGeometry(preset.parameters, 'default');
    try {
      model.updateMatrixWorld(true);
      const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      for (const [i, dimension] of part.dimensions(preset.parameters, 'default').entries())
        assert.ok(Math.abs(size[i] - dimension) < 0.01, preset.id + ': preview/native envelope');
      const code = part.python(preset.parameters, 'default');
      if (preset.id.startsWith('gps-pad')) assert.ok(code.includes('importBrepFromString'));
      else
        assert.ok(
          code.includes('Part.makeCylinder(40.5'),
          'nominal disc remains a native cylinder',
        );
    } finally {
      disposeModel(model);
    }
  }
  assert.equal(nativePads['gps-pad-159-current'].components[0].volume, 26.028);
  assert.ok(Math.abs(nativePads['gps-pad-161-current'].components[0].volume - 26.046) < 1e-10);
  assert.ok(Math.abs(nativePads['gps-pad-plain-current'].components[0].volume - 26.1) < 1e-10);
});
