import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Raycaster, Vector3 } from 'three';
import connector from '../src/parts/electrical-connector/part';
import models from '../src/parts/electrical-connector/lib/models.json';
import hardware from '../src/parts/machine-hardware/part';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

test('every AMASS series has separate pins and bored sockets within published bounds', () => {
  for (const m of models) {
    const p = { model: m.id, detail: 'envelope' };
    assert.deepEqual(validateParameters(connector, p, 'assembled'), []);
    const model = connector.buildGeometry(p, 'assembled');
    try {
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model).getSize(new Vector3());
      [m.width, m.height, m.length].forEach((v, i) =>
        assert.ok(Math.abs(bounds.toArray()[i] - v) < 0.02, m.id),
      );
      const metal = model.children.find((c) => c.name.includes('1 · solder cup'));
      assert.ok(metal);
      const tail = m.cover ? m.length * 0.27 : m.family === 'XT30U' ? 2.5 : 4;
      const L = m.length - tail;
      const ray = new Raycaster(
        new Vector3((-(m.pins - 1) * m.pitch) / 2, 0, L + 5),
        new Vector3(0, 0, -1),
      );
      const hit = ray.intersectObject(metal, true)[0];
      assert.ok(hit);
      assert.ok(m.sex === 'M' ? hit.point.z > L * 0.9 : hit.point.z < L * 0.4, m.id);
      assert.equal(model.children.length, m.pins + 1 + Number(m.cover));
    } finally {
      disposeModel(model);
    }
  }
});
test('catalog selects real paired AMASS models and rejects arbitrary dimensions', () => {
  for (const family of ['XT30U', 'XT60', 'XT60U', 'XT60H', 'XT90H', 'MR60']) {
    assert.deepEqual(
      models
        .filter((m) => m.family === family)
        .map((m) => m.sex)
        .sort(),
      ['F', 'M'],
    );
  }
  assert.ok(
    validateParameters(connector, { ...connector.defaults, width: 99 }, 'assembled').length,
  );
  assert.ok(
    validateParameters(connector, { ...connector.defaults, model: 'XT-style' }, 'assembled').length,
  );
  assert.equal(connector.catalogSelectionOnly, true);
});
test('hinge leaf rotates around the retained pin, while the fixed leaf stays put', () => {
  const closed = hardware.buildGeometry(hardware.defaults, 'assembled');
  const open = hardware.buildGeometry({ ...hardware.defaults, hingeAngle: 90 }, 'assembled');
  try {
    const bounds = (m: typeof closed, i: number) => new Box3().setFromObject(m.children[i]);
    for (const index of [0, 2, 3, 4]) assert.ok(bounds(closed, index).equals(bounds(open, index)));
    assert.ok(bounds(open, 1).max.z > bounds(closed, 1).max.z + 10);
  } finally {
    disposeModel(closed);
    disposeModel(open);
  }
});
test('latch retraction moves only the bolt and clears the keeper', () => {
  const closed = hardware.buildGeometry({ ...hardware.defaults, form: 'latch' }, 'assembled');
  const open = hardware.buildGeometry(
    { ...hardware.defaults, form: 'latch', latchTravel: 14.4 },
    'assembled',
  );
  try {
    const bounds = (m: typeof closed, i: number) => new Box3().setFromObject(m.children[i]);
    for (const i of [0, 1]) assert.ok(bounds(closed, i).equals(bounds(open, i)));
    assert.ok(Math.abs(bounds(closed, 2).max.x - bounds(open, 2).max.x - 14.4) < 0.001);
    assert.ok(bounds(open, 2).max.x < bounds(open, 1).min.x);
  } finally {
    disposeModel(closed);
    disposeModel(open);
  }
});
test('hardware exposes only controls relevant to its selected family', () => {
  for (const form of ['hinge', 'handle', 'latch', 'foot', 'cap']) {
    const p = { ...hardware.defaults, form };
    const fields = hardware.parameters
      .filter((f) => !f.visibleWhen || f.visibleWhen(p))
      .map((f) => f.key);
    assert.ok(
      fields.includes(
        form === 'hinge'
          ? 'hingeAngle'
          : form === 'latch'
            ? 'latchTravel'
            : form === 'handle'
              ? 'handlePitch'
              : form === 'foot'
                ? 'stemDiameter'
                : 'capInsertion',
      ),
    );
    assert.equal(fields.includes('hingeAngle'), form === 'hinge');
    assert.equal(fields.includes('latchTravel'), form === 'latch');
    assert.deepEqual(validateParameters(hardware, p, 'assembled'), []);
  }
  assert.deepEqual(
    validateParameters(
      hardware,
      { ...hardware.defaults, form: 'latch', latchTravel: 14.4 },
      'assembled',
    ),
    [],
  );
  assert.ok(
    validateParameters(
      hardware,
      { ...hardware.defaults, form: 'handle', handleThickness: 4 },
      'assembled',
    ).length,
  );
});
