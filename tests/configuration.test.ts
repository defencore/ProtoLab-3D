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

test('configuration import preserves the absence of optional hidden mechanism controls', () => {
  const actuator = parts.find((item) => item.id === 'servo-toggle-actuator')!;
  for (const mechanism of ['rocker', 'parallel-dual']) {
    const preset = actuator.presets.find((item) => item.parameters.mechanism === mechanism)!;
    const restored = parseConfiguration(
      JSON.stringify({
        version: 1,
        units: 'mm',
        part: actuator.id,
        state: 'assembled',
        parameters: preset.parameters,
      }),
      parts,
    );
    assert.deepEqual(restored.parameters, preset.parameters);
    assert.equal(Object.hasOwn(restored.parameters, 'manualState'), mechanism === 'parallel-dual');
  }
});

test('every catalog preset round-trips all conditional parameters without losing configuration', () => {
  for (const item of parts) {
    for (const values of [item.defaults, ...item.presets.map((preset) => preset.parameters)]) {
      const states = item.states
        ?.filter((option) => !option.availableWhen || option.availableWhen(values))
        .map((option) => option.id) ?? ['default'];
      assert.ok(
        states.length > 0,
        `${item.id}: a configuration must have an available model state`,
      );
      for (const state of states) {
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
