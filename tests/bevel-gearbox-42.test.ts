import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/bevel-gearbox-42/part';
import housing from '../src/parts/bevel-gearbox-42/lib/housing.json';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';

function signature(model: ReturnType<typeof part.buildGeometry>, prefix: string) {
  const values: number[] = [];
  model.children
    .filter((c) => c.name.startsWith(prefix))
    .forEach((c) =>
      c.traverse((o) => {
        if (o instanceof Mesh) values.push(...o.geometry.getAttribute('position').array);
      }),
    );
  return values.join(',');
}
test('42 mm gearbox has every photographed bore family and an actual bearing / two rings per gear', () => {
  assert.equal(part.presets.length, 16);
  const signatures = new Set<string>();
  for (const preset of part.presets) {
    const p = { ...part.defaults, ...preset.parameters };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    const model = part.buildGeometry(p, 'assembled');
    try {
      const count = p.layout === 'three' ? 3 : 2;
      assert.equal(model.children.length, count * 4 + 1);
      for (const label of ['Spiral bevel gear', '61802', 'DIN 471', 'DIN 472'])
        assert.equal(model.children.filter((c) => c.name.includes(label)).length, count);
      const size = new Box3().setFromObject(model, true).getSize(new Vector3());
      for (const v of size.toArray()) assert.ok(Math.abs(v - 42) < 1e-5);
      if (p.layout === 'three') signatures.add(signature(model, 'Input X · Spiral'));
      for (const key of ['bore', 'socket'])
        assert.ok(preset.catalog!.verifiedParameters.includes(key));
      assert.match(preset.catalog!.geometryEvidence!.limitations, /reconstruction/);
    } finally {
      disposeModel(model);
    }
  }
  assert.equal(signatures.size, 8, 'All eight shaft interfaces must change the actual gear mesh');
});
test('inspection and explosion preserve individually selectable components; housing controls are hidden', () => {
  for (const [state, count] of [
    ['internals', 12],
    ['exploded', 13],
    ['housing', 1],
  ] as const) {
    const model = part.buildGeometry(part.defaults, state);
    try {
      assert.equal(model.children.length, count);
      if (state === 'exploded') assert.ok(new Box3().setFromObject(model).max.x > 60);
    } finally {
      disposeModel(model);
    }
  }
  for (const field of part.parameters)
    assert.equal(field.visibleWhen?.(part.defaults, 'housing'), false);
  assert.match(generateScript(part, part.defaults, 'housing'), /importBrepFromString/);
});
test('source housing provenance and explicit seat changes remain reproducible without reference archives', () => {
  assert.equal(
    housing.sourceSha256,
    '637fece0c52e1be47b4ecefd9fabba58f63bc605b664d333befdfa44a35099f9',
  );
  assert.equal(housing.retainedSolid, 0);
  assert.deepEqual(
    housing.bounds.map((v) => Math.round(v)),
    [-21, -21, -21, 21, 21, 21],
  );
  assert.ok(housing.volume < housing.originalVolume);
  assert.ok(housing.modifications.some((s) => s.includes('Ø24')));
  assert.ok(housing.modifications.some((s) => s.includes('Ø25.2')));
});
test('rotation and tooth sweep affect gears while the housing remains fixed', () => {
  const base = part.buildGeometry(part.defaults, 'assembled');
  try {
    for (const patch of [{ inputAngle: 37 }, { sweep: 0 }] as Parameters[]) {
      const changed = part.buildGeometry({ ...part.defaults, ...patch }, 'assembled');
      try {
        assert.notEqual(
          signature(base, 'Input X · Spiral'),
          signature(changed, 'Input X · Spiral'),
        );
        assert.equal(signature(base, '42 mm housing'), signature(changed, '42 mm housing'));
      } finally {
        disposeModel(changed);
      }
    }
  } finally {
    disposeModel(base);
  }
  for (const patch of [
    { bore: '9' },
    { socket: 'unknown' },
    { layout: 'unknown' },
    { inputAngle: 361 },
    { sweep: 9 },
    { sweep: 12 },
  ] as Parameters[])
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length);
  assert.throws(() => generateScript(part, { ...part.defaults, sweep: 12 }, 'assembled'));
});
