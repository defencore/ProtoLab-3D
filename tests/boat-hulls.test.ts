import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import part from '../src/parts/boat-hull/part';
import { hulls, pieces, sectionProfile, stations } from '../src/parts/boat-hull/lib/model';
const preset = (id: string) => part.presets.find((p) => p.id === id)!.parameters;

test('boat catalog covers six distinct bottom sections and four arrangements', () => {
  assert.deepEqual(
    new Set(part.presets.map((p) => p.parameters.bottom)),
    new Set(['flat', 'v', 'double-chine', 'round', 'arch', 'soft-chine']),
  );
  assert.deepEqual(
    new Set(part.presets.map((p) => p.parameters.layout)),
    new Set(['monohull', 'catamaran', 'trimaran', 'pod-catamaran']),
  );
  assert.equal(part.presets.filter((p) => p.catalog).length, 3);
  for (const p of part.presets.filter((p) => p.catalog))
    assert.deepEqual(p.catalog!.verifiedParameters, ['length', 'beam']);
  const profiles = ['flat', 'v', 'double-chine', 'round', 'arch', 'soft-chine'].map((bottom) =>
    sectionProfile({ ...part.defaults, bottom }, 200, 100),
  );
  assert.equal(new Set(profiles.map((p) => JSON.stringify(p))).size, 6);
  const flat = profiles[0],
    vee = profiles[1];
  assert.equal(flat.filter((p) => p[1] === -100).length, 2);
  assert.equal(vee.filter((p) => p[1] === -100).length, 1);
  const slope = (Math.atan2(vee[1][1] + 100, vee[1][0]) * 180) / Math.PI;
  assert.ok(Math.abs(slope - Number(part.defaults.deadrise)) < 1e-10);
});

test('hull components, covers and crossbeams remain independently selectable', () => {
  for (const [id, count] of [
    ['custom-monohull', 1],
    ['custom-catamaran', 2],
    ['custom-trimaran', 3],
    ['central-pod-catamaran', 3],
  ] as const) {
    const p = preset(id),
      body = pieces(p, 'body'),
      assembled = pieces(p, 'assembled');
    assert.equal(body.length, count);
    assert.ok(body.every((x) => x.label.endsWith('shell')));
    assert.equal(assembled.filter((x) => x.label.includes('cover')).length, count);
    assert.equal(pieces({ ...p, cover: false, bridge: 'none' }, 'assembled').length, count);
    assert.ok(assembled.length <= 8);
    const exploded = pieces(p, 'exploded');
    assert.deepEqual(
      exploded.map((x) => x.shape),
      assembled.map((x) => x.shape),
    );
    assert.ok(exploded.filter((x) => x.label.includes('cover')).every((x) => Number(x.z) > 0));
  }
});

test('trimaran outriggers and central pod have different editable envelopes', () => {
  const p = preset('custom-trimaran'),
    h = hulls(p);
  assert.equal(h[0].length, Number(p.length));
  assert.equal(h[1].length, (Number(p.length) * Number(p.floatLength)) / 100);
  assert.equal(h[1].depth, (Number(p.depth) * Number(p.floatDepth)) / 100);
  const pod = hulls(preset('central-pod-catamaran'));
  assert.ok(pod[0].length < pod[1].length);
  assert.equal(h[1].centre, -h[2].centre);
});

test('asymmetry mirrors the two hulls, moving their keels toward the tunnel', () => {
  const p = preset('asymmetric-catamaran'),
    shells = pieces(p, 'body');
  const h = hulls(p),
    lines = stations(p),
    middle = lines.findIndex((s) => s.width === 1);
  for (let i = 0; i < 2; i++) {
    const s = shells[i].shape;
    assert.equal(s.kind, 'faceted');
    if (s.kind !== 'faceted') continue;
    const stride = sectionProfile(p, Number(p.hullBeam), Number(p.depth)).length;
    const keel = s.points[middle * stride + Math.floor(stride / 2)];
    assert.ok(Math.abs(keel[1]) < Math.abs(h[i].centre));
  }
});

test('length and beam controls set actual outer envelopes for every preset', () => {
  for (const p of part.presets) {
    const model = part.buildGeometry(p.parameters, 'body');
    try {
      const size = new Box3().setFromObject(model, true).getSize(new Vector3());
      assert.ok(Math.abs(size.x - Number(p.parameters.length)) < 0.02, p.id);
      assert.ok(Math.abs(size.y - Number(p.parameters.beam)) < 0.02, p.id);
    } finally {
      disposeModel(model);
    }
  }
});

test('stem, transom, rocker, sheer and chine controls change hull geometry', () => {
  const base = preset('custom-monohull');
  const original = JSON.stringify(pieces(base, 'body'));
  for (const [key, value] of Object.entries({
    bow: 'spoon',
    bowRake: 3,
    sternRake: 7,
    rocker: 28,
    sheer: 20,
    midship: 45,
    sternWidth: 30,
    deadrise: 15,
    chineWidth: 65,
    wall: 3,
  })) {
    assert.notEqual(JSON.stringify(pieces({ ...base, [key]: value }, 'body')), original, key);
  }
  const lines = stations({ ...base, rocker: 30, sheer: 20 });
  assert.ok(lines[0].top > lines[3].top);
  assert.ok(lines[6].depth < lines[3].depth);
});

test('family and arrangement selectors provide valid transitions from the default', () => {
  for (const [key, values] of [
    ['family', ['displacement', 'semi-displacement', 'planing']],
    ['layout', ['monohull', 'catamaran', 'trimaran', 'pod-catamaran']],
  ] as const) {
    for (const value of values) {
      const p = part.updateParameters!({ ...part.defaults, [key]: value }, key);
      assert.deepEqual(validateParameters(part, p, 'assembled'), [], `${key}/${value}`);
    }
  }
});

test('overlapping hulls, extreme deadrise and oversized crossbeams are rejected', () => {
  const cat = preset('custom-catamaran');
  for (const p of [
    { ...cat, beam: 200 },
    { ...part.defaults, beam: 40, wall: 2 },
    { ...part.defaults, deadrise: 45, depth: 20 },
    { ...cat, crossbeam: 80 },
    { ...cat, bridge: 'raised', bridgeCurve: 40 },
  ]) {
    assert.ok(validateParameters(part, p as Parameters, 'assembled').length);
  }
});
