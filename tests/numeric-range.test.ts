import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchesNumericRange,
  parseNumericRange,
  readNumericInterval,
} from '../src/core/numeric-range';

test('decimal bounds accept comma/dot, whitespace, signs, scientific notation and open zero bounds without altering input', () => {
  const input = { min: '  -0,25  ', max: '2.5e1' };
  assert.deepEqual(parseNumericRange(input), { range: { min: -0.25, max: 25 }, errors: [] });
  assert.deepEqual(input, { min: '  -0,25  ', max: '2.5e1' });
  assert.deepEqual(parseNumericRange({ min: '0', max: ' ' }), { range: { min: 0 }, errors: [] });
  assert.deepEqual(parseNumericRange({ min: '.5', max: '1.' }), {
    range: { min: 0.5, max: 1 },
    errors: [],
  });
});

test('malformed user numbers and reversed ranges stay errors rather than becoming broad matches', () => {
  for (const min of ['Infinity', 'NaN', '0x10', '1,2,3', '1 000', '1e309', '.', false, {}])
    assert.deepEqual(parseNumericRange({ min }).errors, ['invalid-min']);
  assert.deepEqual(parseNumericRange({ min: '2,5', max: '2.4' }).errors, ['reversed']);
  assert.deepEqual(parseNumericRange({ min: 'bad', max: 'worse' }).errors, [
    'invalid-min',
    'invalid-max',
  ]);
});

test('source intervals require two finite numeric bounds and never coerce empty or string source dimensions', () => {
  assert.deepEqual(readNumericInterval({ min: 0, max: 0.3 }), { min: 0, max: 0.3 });
  for (const input of [
    null,
    [],
    { min: '0', max: 1 },
    { min: 0, max: Infinity },
    { min: 2, max: 1 },
    { min: 0 },
    { min: NaN, max: 1 },
  ])
    assert.equal(readNumericInterval(input), undefined);
});

test('inclusive matching covers source intervals without a chosen scalar and preserves zero, negative values and decimal precision', () => {
  assert.equal(matchesNumericRange(undefined, { min: 6, max: 8 }, { min: 8, max: 8 }), true);
  assert.equal(matchesNumericRange(0, undefined, { min: 0, max: 0 }), true);
  assert.equal(matchesNumericRange(-40, undefined, { max: -40 }), true);
  assert.equal(matchesNumericRange(0.1 + 0.2, undefined, { min: 0.3, max: 0.3 }), true);
  assert.equal(matchesNumericRange(0.3001, undefined, { min: 0.3, max: 0.3 }), false);
  assert.equal(matchesNumericRange(undefined, undefined, {}), false);
  assert.equal(matchesNumericRange(7, { min: 8, max: 6 }, { min: 7, max: 7 }), false);
  assert.equal(matchesNumericRange(7, undefined, { min: 8, max: 6 }), false);
});
