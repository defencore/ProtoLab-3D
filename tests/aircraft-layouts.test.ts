import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/aircraft-airframe/part';
import { pieces } from '../src/parts/aircraft-airframe/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
const preset = (id: string) => part.presets.find((p) => p.id === id)!.parameters;

test('high, mid and low mounting move the wing vertically while preserving fuselage size', () => {
  const heights = ['low', 'mid', 'high'].map((wingMount) => {
    const p: Parameters = { ...part.defaults, wingMount, dihedral: 0 };
    const model = part.buildGeometry(p, 'assembled');
    try {
      const wing = model.children.find((o) => o.name === 'Port wing · fixed panel')!;
      model.updateMatrixWorld(true);
      const tip = new Box3();
      wing.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        const a = o.geometry.getAttribute('position');
        for (let i = 0; i < a.count; i++) {
          const v = new Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
          if (v.y < -Number(p.span) / 2 + 0.01) tip.expandByPoint(v);
        }
      });
      return tip.getCenter(new Vector3()).z;
    } finally {
      disposeModel(model);
    }
  });
  assert.ok(heights[0] < heights[1] && heights[1] < heights[2]);
  assert.ok(Math.abs(heights[2] - heights[0] - Number(part.defaults.bodyHeight) * 0.72) < 0.01);
});

test('flying wing has a centre bay, elevons and optional tip fins, without a fuselage or tailplane', () => {
  const p = preset('custom-wing');
  const names = pieces(p, 'assembled').map((c) => c.label);
  assert.match(names[0], /Wing centre section/);
  assert.equal(names.filter((n) => n.includes('elevon')).length, 2);
  assert.equal(names.filter((n) => n.includes('winglet')).length, 2);
  assert.ok(!names.some((n) => /Fuselage|tailplane|rudder/.test(n)));
  assert.equal(pieces({ ...p, winglets: false }, 'assembled').length, 5);
  assert.deepEqual(
    part.dimensions(p, 'body'),
    part.dimensions({ ...p, length: 4000, bodyHeight: 500 }, 'body'),
  );
});

test('layouts expose distinct structures and appropriate named controls', () => {
  const names = (id: string) =>
    pieces(preset(id), 'assembled')
      .map((c) => c.label)
      .join('\n');
  assert.match(names('custom-twin-boom'), /Port tail boom/);
  assert.match(names('custom-twin-boom'), /Starboard vertical tail/);
  assert.match(names('custom-tandem'), /forward wing/);
  assert.match(names('custom-tandem'), /aft wing/);
  assert.match(names('custom-canard'), /canard · elevator/);
  assert.doesNotMatch(names('ft-viggen-v2'), /canard · elevator/);
  assert.match(names('ft-viggen-v2'), /elevon/);
  assert.match(names('atomrc-dolphin'), /ruddervator/);
  assert.match(names('fms-asw17'), /flap/);
  assert.match(names('fms-asw17'), /aileron/);
  assert.equal(preset('fms-asw17').tail, 'conventional');
  assert.equal(preset('custom-glider').tail, 't-tail');
});

test('invalid topology combinations and overlapping wing stations are rejected', () => {
  const invalid: Parameters[] = [
    { layout: 'flying-wing' },
    { layout: 'twin-boom', tail: 'v-tail' },
    { layout: 'canard', wingStation: 12 },
    { wingStation: 65 },
  ];
  for (const changes of invalid) {
    assert.ok(validateParameters(part, { ...part.defaults, ...changes }, 'assembled').length);
  }
  for (const layout of [
    'conventional',
    'glider',
    'flying-wing',
    'delta',
    'canard',
    'twin-boom',
    'tandem',
  ]) {
    const updated = part.updateParameters!({ ...part.defaults, layout }, 'layout');
    assert.deepEqual(validateParameters(part, updated, 'assembled'), [], layout);
  }
});

test('all hobby references preserve their published span in the assembled geometry', () => {
  for (const reference of part.presets.filter((p) => p.catalog)) {
    assert.ok(
      Math.abs(
        part.dimensions(reference.parameters, 'assembled')[1] - Number(reference.parameters.span),
      ) < 0.01,
      reference.id,
    );
  }
});

test('changing configuration from any shipped preset leaves a valid starting point', () => {
  const layouts = part.parameters.find((p) => p.key === 'layout')!.options!;
  for (const reference of part.presets)
    for (const option of layouts) {
      const updated = part.updateParameters!(
        { ...reference.parameters, layout: option.value },
        'layout',
      );
      assert.deepEqual(
        validateParameters(part, updated, 'assembled'),
        [],
        reference.id + '/' + option.value,
      );
    }
});
