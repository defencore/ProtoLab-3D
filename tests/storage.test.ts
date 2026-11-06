import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresetId, readPresets, storePresets, type SavedPreset } from '../src/core/storage';
import servoModule from '../src/parts/servo-motor';

test('preset IDs work with the Web Crypto API available on HTTP origins', (context) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues },
  });
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  });

  assert.equal(crypto.randomUUID, undefined);
  const first = createPresetId();
  const second = createPresetId();
  assert.match(first, /^[0-9a-f]{32}$/);
  assert.match(second, /^[0-9a-f]{32}$/);
  assert.notEqual(first, second);
});

test('saved configurations retain source selection and isolate invalid entries', (context) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  const source = servoModule.part.presets[0];
  const second = { ...source, id: 'same-dimensions-second-source' };
  const part = { ...servoModule.part, presets: [source, second] };
  const saved: SavedPreset = {
    id: 'saved-selection',
    name: 'Selected supplier model',
    partId: part.id,
    parameters: { ...second.parameters, outputAngle: 45 },
    state: 'assembled',
    presetId: second.id,
  };
  const withoutIdentity = { ...saved, id: 'old-version-one-save' };
  delete withoutIdentity.presetId;
  const custom = { ...saved, id: 'custom-selection', presetId: 'custom' };
  storePresets([
    saved,
    { ...saved, id: 'unknown-preset', presetId: 'missing' },
    { ...saved, id: 'stale-preset', parameters: { ...saved.parameters, model: 'kST-x' } },
    { ...saved, id: 'wrong-type', parameters: [] as unknown as SavedPreset['parameters'] },
    withoutIdentity,
    custom,
  ]);
  assert.deepEqual(readPresets([part]), [saved, withoutIdentity, custom]);
});
