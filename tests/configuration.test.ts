import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConfiguration } from '../src/core/configuration';
import { parts } from '../src/parts';

const part = parts[0];
const configuration = {
  version: 1,
  units: 'mm',
  part: part.id,
  state: 'assembled',
  parameters: part.defaults,
};

test('downloaded configurations restore the correct part, state and dimensions', () => {
  const restored = parseConfiguration(JSON.stringify(configuration), parts);
  assert.equal(restored.part, part);
  assert.equal(restored.state, 'assembled');
  assert.deepEqual(restored.parameters, part.defaults);
});

test('configuration import rejects unknown formats, parts and invalid dimensions', () => {
  for (const config of [
    null,
    [],
    { ...configuration, version: 2 },
    { ...configuration, units: 'inch' },
    { ...configuration, part: 'missing' },
    { ...configuration, state: 'missing' },
    { ...configuration, parameters: { ...part.defaults, bore: 999 } },
    { ...configuration, parameters: { ...part.defaults, bore: '__import__("os")' } },
  ]) {
    assert.throws(() => parseConfiguration(JSON.stringify(config), parts));
  }
  assert.throws(() => parseConfiguration('not JSON', parts));
});

test('configuration import discards fields outside the part schema', () => {
  const restored = parseConfiguration(
    JSON.stringify({ ...configuration, parameters: { ...part.defaults, unexpected: 'ignored' } }),
    parts,
  );
  assert.deepEqual(restored.parameters, part.defaults);
});

test('every catalog preset round-trips all conditional parameters without losing configuration', () => {
  for (const item of parts) {
    for (const values of [item.defaults, ...item.presets.map((preset) => preset.parameters)]) {
      for (const state of item.states?.map((option) => option.id) ?? ['default']) {
        const restored = parseConfiguration(
          JSON.stringify({ version: 1, units: 'mm', part: item.id, state, parameters: values }),
          parts,
        );
        assert.deepEqual(restored.parameters, values, item.id);
        assert.equal(restored.state, state);
      }
    }
  }
});

test('hidden fields still require finite primitive values on import', () => {
  const item = parts.find((entry) => entry.id === 'bolt-screw')!;
  for (const value of [undefined, null, '3', '__import__("os")']) {
    assert.throws(() =>
      parseConfiguration(
        JSON.stringify({
          version: 1,
          units: 'mm',
          part: item.id,
          state: 'default',
          parameters: { ...item.defaults, driveWidth: value },
        }),
        parts,
      ),
    );
  }
});
