import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3, type Group } from 'three';
import { createHash } from 'node:crypto';
import part from '../src/parts/tracked-chassis/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import type { Parameters } from '../src/core/types';
function signature(model: Group, prefix = '') {
  const hash = createHash('sha256');
  model.updateMatrixWorld(true);
  for (const child of model.children.filter((c) => c.name.startsWith(prefix)))
    child.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const a = o.geometry.getAttribute('position');
      for (let i = 0; i < a.count; i++)
        hash.update(
          new Vector3()
            .fromBufferAttribute(a, i)
            .applyMatrix4(o.matrixWorld)
            .toArray()
            .map((v) => v.toFixed(4))
            .join(','),
        );
    });
  return hash.digest('hex');
}
test('tracked chassis presets include complete suspended running gear and a real second deck', () => {
  for (const preset of part.presets) {
    const model = part.buildGeometry(preset.parameters, 'assembled');
    try {
      const names = model.children.map((c) => c.name);
      assert.equal(new Set(names).size, names.length);
      for (const [name, count] of [
        ['Trailing arm', 8],
        ['Tension spring', 8],
        ['Road wheel bearing', 8],
        ['Continuous tread belt', 2],
        ['JGB3865 motor can', 2],
      ] as const)
        assert.equal(names.filter((n) => n.includes(name)).length, count, name);
      assert.equal(
        names.includes('Upper slotted mounting deck'),
        preset.parameters.layers === 'double',
      );
      const bounds = new Box3().setFromObject(model, true).getSize(new Vector3());
      assert.ok(Math.abs(bounds.x - 270) < 0.05);
      assert.ok(Math.abs(bounds.y - 194) < 0.05);
      assert.ok(preset.catalog?.geometryEvidence?.limitations.includes('reconstructed'));
    } finally {
      disposeModel(model);
    }
  }
});
test('every visible chassis control changes geometry; left pose leaves the right suspension fixed', () => {
  const baseline = part.buildGeometry(part.defaults, 'assembled'),
    base = signature(baseline);
  const patches: Parameters[] = [
    { layers: 'double' },
    { length: 300 },
    { width: 210 },
    { deckWidth: 140 },
    { plateThickness: 3 },
    { trackWidth: 22 },
    { driveDiameter: 60 },
    { roadDiameter: 30 },
    { roadCount: 3 },
    { idlerAdjustment: 3 },
    { leftAngle: 8 },
    { rightAngle: -8 },
    { detail: 'lightweight' },
  ];
  try {
    for (const patch of patches) {
      const p = { ...part.defaults, ...patch };
      assert.deepEqual(validateParameters(part, p, 'assembled'), [], JSON.stringify(patch));
      const model = part.buildGeometry(p, 'assembled');
      try {
        assert.notEqual(signature(model), base, JSON.stringify(patch));
        if (patch.leftAngle) {
          assert.equal(signature(model, 'Right ·'), signature(baseline, 'Right ·'));
          for (const prefix of [
            'Left · Trailing arm',
            'Left · Road wheel',
            'Left · Tension spring',
            'Left · Continuous tread',
          ])
            assert.notEqual(signature(model, prefix), signature(baseline, prefix), prefix);
        }
      } finally {
        disposeModel(model);
      }
    }
    const a = part.buildGeometry(
      { ...part.defaults, layers: 'double', upperDeckGap: 25 },
      'assembled',
    );
    const b = part.buildGeometry(
      { ...part.defaults, layers: 'double', upperDeckGap: 55 },
      'assembled',
    );
    try {
      assert.notEqual(signature(a, 'Upper'), signature(b, 'Upper'));
    } finally {
      disposeModel(a);
      disposeModel(b);
    }
  } finally {
    disposeModel(baseline);
  }
});
test('chassis inspection states preserve parts and frame-only controls do not pretend to alter hidden gear', () => {
  const full = part.buildGeometry(part.defaults, 'assembled');
  const bare = part.buildGeometry(part.defaults, 'undercarriage');
  const frame = part.buildGeometry(part.defaults, 'frame');
  const exploded = part.buildGeometry(part.defaults, 'exploded');
  try {
    assert.equal(bare.children.length, full.children.length - 2);
    assert.equal(frame.children.length, 4);
    assert.equal(exploded.children.length, full.children.length);
    assert.ok(new Box3().setFromObject(exploded, true).getSize(new Vector3()).y > 194);
    for (const key of [
      'width',
      'roadCount',
      'leftAngle',
      'rightAngle',
      'idlerAdjustment',
      'detail',
    ])
      assert.equal(
        part.parameters.find((f) => f.key === key)!.visibleWhen!(part.defaults, 'frame'),
        false,
      );
  } finally {
    [full, bare, frame, exploded].forEach(disposeModel);
  }
  for (const patch of [
    { width: 190, trackWidth: 40 },
    { roadCount: 6 },
    { roadCount: 3.5 },
    { roadDiameter: 38 },
    { deckWidth: 230 },
  ] as Parameters[]) {
    assert.ok(
      validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length,
      JSON.stringify(patch),
    );
    assert.throws(() => generateScript(part, { ...part.defaults, ...patch }, 'assembled'));
  }
});
