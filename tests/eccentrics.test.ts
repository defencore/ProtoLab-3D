import test from 'node:test';
import assert from 'node:assert/strict';
import { parts } from '../src/parts';
import { validateParameters } from '../src/core/validation';
import { Box3, Vector3 } from 'three';
import { disposeModel } from '../src/core/mechanical';
const selected = parts.filter((p) => p.id.startsWith('eccentric-'));
test('eccentric catalog keeps documented miniature seats, widths and mounting offsets', () => {
  assert.equal(selected.length, 3);
  assert.equal(
    selected.reduce((n, p) => n + p.presets.length, 0),
    23,
  );
  const b = selected.find((p) => p.id === 'eccentric-bushing')!;
  const tiny = b.presets.find((p) => p.id === 'eccb6-5')!.parameters;
  assert.deepEqual(
    [tiny.seat, tiny.bore, tiny.length, tiny.head, tiny.eccentricity],
    [6, 3, 5, 3, 0.3],
  );
  const follower = selected.find((p) => p.id === 'eccentric-cam-follower')!;
  for (const preset of follower.presets) {
    const p = preset.parameters;
    assert.equal(
      +p.width + 2 * +p.lip + +p.studLength,
      preset.id.includes('6b') ? 28.2 : preset.id.includes('8b') ? 32.2 : 36.2,
    );
    assert.equal(p.eccentricity, 0.4);
  }
  const mochu = selected.find((p) => p.id === 'eccentric-bearing')!.presets[0];
  assert.deepEqual(mochu.catalog!.verifiedParameters, [
    'bore',
    'outer',
    'outerWidth',
    'innerWidth',
  ]);
});
test('all exposed eccentric controls change the exported solid recipe', () => {
  for (const part of selected)
    for (const field of part.parameters) {
      const p = { ...part.defaults };
      if (field.type === 'number')
        p[field.key] = +p[field.key] + (field.key === 'angle' ? 90 : field.step!);
      else p[field.key] = field.options!.find((o) => o.value !== p[field.key])!.value;
      assert.deepEqual(validateParameters(part, p, 'assembled'), [], `${part.id}/${field.key}`);
      assert.notEqual(
        part.python(p, 'assembled'),
        part.python(part.defaults, 'assembled'),
        `${part.id}/${field.key}`,
      );
    }
});
test('eccentric orientation moves the outer bearing or follower axis by the catalog offset', () => {
  for (const part of selected.filter((p) => p.id !== 'eccentric-bushing')) {
    const centres = [];
    for (const angle of [0, 90]) {
      const model = part.buildGeometry({ ...part.defaults, angle }, 'assembled');
      try {
        const roller = model.children.find((c) => /Outer ring|outer roller/.test(c.name))!;
        model.updateMatrixWorld(true);
        centres.push(new Box3().setFromObject(roller, true).getCenter(new Vector3()));
      } finally {
        disposeModel(model);
      }
    }
    const e = +part.defaults.eccentricity;
    assert.ok(Math.abs(centres[0].x - e) < 0.01 && Math.abs(centres[0].y) < 0.01);
    assert.ok(Math.abs(centres[1].x) < 0.01 && Math.abs(centres[1].y - e) < 0.01);
  }
});
test('eccentric validation rejects bore breakthrough, trapped collars and oversized sockets', () => {
  for (const [id, patch] of [
    ['eccentric-bushing', { eccentricity: 2 }],
    ['eccentric-bearing', { eccentricity: 15 }],
    ['eccentric-bearing', { keyDepth: 10, eccentricity: 0.05 }],
    ['eccentric-bearing', { outerWidth: 4 }],
    ['eccentric-cam-follower', { eccentricity: 2 }],
    ['eccentric-cam-follower', { collarLength: 20 }],
    ['eccentric-cam-follower', { hex: 14 }],
  ] as const) {
    const part = selected.find((p) => p.id === id)!;
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length, id);
  }
});
