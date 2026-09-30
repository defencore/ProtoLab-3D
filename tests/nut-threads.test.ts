import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Raycaster, Vector3 } from 'three';
import { parts } from '../src/parts';
import type { Parameters } from '../src/core/types';
import { disposeModel } from '../src/core/mechanical';
import {
  nominalThreadDiameter,
  nutCoarsePitch,
} from '../src/parts/hex-nut/lib/core/internal-thread';
import { validateParameters } from '../src/core/validation';

// Lifting eye nuts live with lifting hardware; UI taxonomy must not exclude
// their internal threads from the geometry regression suite.
const nuts = parts.filter(
  (p) => (p.subgroup === 'NUTS' && p.id !== 't-slot-nut') || p.id === 'lifting-eye-nut',
);
function assertClosed(model: ReturnType<(typeof nuts)[number]['buildGeometry']>) {
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const p = child.geometry.getAttribute('position');
    const ix = child.geometry.index?.array ?? Array.from({ length: p.count }, (_, i) => i);
    const edges = new Map<string, number>();
    let volume = 0;
    for (let i = 0; i < ix.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(p, ix[i + j]));
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18);
      volume += a.dot(b.clone().cross(c)) / 6;
      const keys = [a, b, c].map((v) =>
        v
          .toArray()
          .map((x) => Math.round(x * 1e5))
          .join(','),
      );
      for (let j = 0; j < 3; j++) {
        const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0);
    for (const count of edges.values()) assert.equal(count, 2);
  });
}

test('all nut families and stock presets use smooth named bores with valid size-specific pitches', () => {
  assert.equal(nuts.length, 11);
  for (const part of nuts) {
    assert.ok(!part.parameters.some((p) => p.key === 'threadMode'), part.id);
    for (const preset of part.presets) {
      assert.equal(preset.parameters.threadMode, undefined, preset.id);
      assert.deepEqual(validateParameters(part, preset.parameters, 'default'), [], preset.id);
    }
  }
  for (const [d, pitch] of [
    [2, 0.4],
    [3, 0.5],
    [4, 0.7],
    [8, 1.25],
    [24, 3],
    [36, 4],
    [42, 4.5],
  ])
    assert.equal(nutCoarsePitch(d), pitch);
  const hex = nuts.find((p) => p.id === 'hex-nut')!;
  assert.equal(hex.presets.find((p) => Number(p.parameters.bore) === 2)!.parameters.pitch, 0.4);
});

test('hex nut bore stays cylindrical at every height and angle; handedness is metadata', () => {
  const part = nuts.find((p) => p.id === 'hex-nut')!;
  for (const handedness of ['right', 'left']) {
    const p: Parameters = { ...part.defaults, handedness };
    const model = part.buildGeometry(p, 'default');
    model.updateMatrixWorld(true);
    for (const z of [1, 2, 2.25, 2.5, 3])
      for (const angle of [0, Math.PI / 2, Math.PI]) {
        const ray = new Raycaster(
          new Vector3(0, 0, z),
          new Vector3(Math.cos(angle), Math.sin(angle), 0),
        );
        assert.ok(
          Math.abs(ray.intersectObject(model, true)[0].distance - Number(p.bore) / 2) < 1e-5,
        );
      }
    assert.equal(nominalThreadDiameter(p, Number(p.bore)), Number(p.bore));
    assert.match(
      part.python(p, 'default'),
      new RegExp(`M6×1 ${handedness === 'left' ? 'LH' : 'RH'}`),
    );
    assertClosed(model);
    disposeModel(model);
  }
});

test('hand nut Boolean previews retain closed shells with internal threads', () => {
  for (const id of ['wing-nut', 'lifting-eye-nut']) {
    const part = nuts.find((p) => p.id === id)!;
    const stock = [...part.presets].sort(
      (a, b) => Number(a.parameters.diameter) - Number(b.parameters.diameter),
    );
    for (const p of [
      part.defaults,
      stock[0].parameters,
      stock.at(-1)!.parameters,
      { ...part.defaults, pitch: 0.75, handedness: 'left' },
    ]) {
      const model = part.buildGeometry(p, 'default');
      assert.doesNotThrow(
        () => assertClosed(model),
        `${id} d=${p.diameter} pitch=${p.pitch} hand=${p.handedness}`,
      );
      disposeModel(model);
    }
  }
});

test('nut exports preserve thread callouts without helices and separate the nylon insert', () => {
  for (const part of nuts) {
    const python = part.python(part.defaults, 'default');
    assert.doesNotMatch(python, /makeLongHelix|makePipeShell|nut_groove/);
    assert.match(python, /ThreadCallouts/);
    assert.match(python, /nominal-cylinder/);
    assert.equal(
      python.includes("component_labels = ['Nut body', 'Nylon insert']"),
      part.id === 'nyloc-nut',
    );
    assert.doesNotMatch(
      part.python({ ...part.defaults, threadMode: 'envelope' }, 'default'),
      /makeLongHelix/,
    );
  }
});
