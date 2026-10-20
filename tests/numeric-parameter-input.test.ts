import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NumericParameterInput from '../src/components/NumericParameterInput';

test('custom dimensions expose a decimal text field without losing comma values or physical bounds', () => {
  const html = renderToStaticMarkup(
    React.createElement(NumericParameterInput, {
      id: 'dimension',
      value: '3,2',
      min: 1,
      max: 4,
      onChange: () => {},
    }),
  );
  assert.match(html, /type="text"/);
  assert.match(html, /inputMode="decimal"/);
  assert.match(html, /value="3,2"/);
  assert.ok(!html.includes('aria-invalid'));
  for (const value of ['', 'not-a-number', 'Infinity', '0,5', '4,1']) {
    const invalid = renderToStaticMarkup(
      React.createElement(NumericParameterInput, {
        id: 'dimension',
        value,
        min: 1,
        max: 4,
        onChange: () => {},
      }),
    );
    assert.match(invalid, /aria-invalid="true"/, value);
  }
});
