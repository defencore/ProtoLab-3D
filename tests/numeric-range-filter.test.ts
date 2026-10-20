import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NumericRangeFilter from '../src/components/NumericRangeFilter';

test('shared range fields preserve comma decimals and malformed text while linking local errors', () => {
  const html = renderToStaticMarkup(
    createElement(NumericRangeFilter, {
      id: 'size',
      label: 'Body length',
      value: { min: '5,5', max: 'bad-value' },
      error: 'Enter a decimal number.',
      onChange: () => {},
    }),
  );
  assert.match(html, /type="text"/);
  assert.match(html, /inputMode="decimal"/);
  assert.match(html, /value="5,5"/);
  assert.match(html, /value="bad-value"/);
  assert.equal((html.match(/aria-invalid="true"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-describedby="size-error"/g) ?? []).length, 2);
  assert.match(html, /id="size-error"/);
  assert.match(html, /Minimum body length/);
  assert.match(html, /Maximum body length/);
});

test('independent range instances have unique accessible descriptions and open ends stay blank', () => {
  const html = renderToStaticMarkup(
    createElement(
      'div',
      {},
      createElement(NumericRangeFilter, {
        label: 'Width',
        value: { min: 0 },
        onChange: () => {},
        error: 'Width issue',
      }),
      createElement(NumericRangeFilter, {
        label: 'Length',
        value: { max: '10' },
        onChange: () => {},
        error: 'Length issue',
      }),
    ),
  );
  const ids = [...html.matchAll(/id="([^"]+-error)"/g)].map((row) => row[1]);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  assert.match(html, /value="0"/);
  assert.match(html, /value=""/);
  assert.match(html, /value="10"/);
});
