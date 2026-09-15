import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresetId } from '../src/core/storage';

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
