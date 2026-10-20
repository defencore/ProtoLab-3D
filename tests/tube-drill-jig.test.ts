import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/tube-drill-jig/part';
import {
  layout,
  selectGuide,
  spacerStack,
  spacerSizes,
} from '../src/parts/tube-drill-jig/lib/selection';
import { jigPieces, configuredPieces } from '../src/parts/tube-drill-jig/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

test('all tube jig presets and both inspection states are valid', () => {
  assert.equal(part.presets.length, 66);
  for (const preset of part.presets) {
    for (const state of ['assembled', 'exploded']) {
      assert.deepEqual(
        validateParameters(part, preset.parameters, state),
        [],
        `${preset.id}/${state}`,
      );
    }
  }
});

test('the bearing selector matches the actual drill bore and never rounds up', () => {
  assert.deepEqual(selectGuide(part.defaults).bearing, {
    id: '692XZZ',
    bore: 2.5,
    outer: 7,
    width: 3.5,
  });
  for (const [thread, drill] of [
    ['M4', 3.3],
    ['M5', 4.2],
    ['M8', 6.8],
  ] as const) {
    const p = { ...part.defaults, thread, endOffset: 15 };
    assert.equal(selectGuide(p).kind, 'bushing');
    assert.equal(selectGuide(p).drill, drill);
    assert.equal(selectGuide(p).bearing, undefined);
    assert.match(
      validateParameters(part, { ...p, guide: 'bearing' }, 'assembled').join(' '),
      /No exact bearing bore/,
    );
  }
  assert.equal(selectGuide({ ...part.defaults, thread: 'M6' }).bearing?.id, 'MR105ZZ');
  assert.equal(
    selectGuide({ ...part.defaults, holeMode: 'through', holeDiameter: 4 }).bearing?.id,
    'MR84ZZ',
  );
});

test('4, 8 and 12 independent radial stations use the tube end datum, even when bottom thickness changes', () => {
  for (const count of [4, 8, 12]) {
    const p = { ...part.defaults, holeCount: String(count), endOffset: 14.5, phase: 17 };
    for (const bottom of [2, 4, 12]) {
      const d = layout({ ...p, stopThickness: bottom });
      assert.equal(d.stations.length, count);
      for (const [i, station] of d.stations.entries()) {
        assert.equal(station.z, 30);
        assert.equal(station.z - d.spacerHeight, 14.5);
        assert.equal(station.angle, 17 + (360 * i) / count);
        assert.ok(Math.abs(Math.hypot(...station.direction) - 1) < 1e-12);
      }
      const collar = jigPieces({ ...p, stopThickness: bottom })[0].shape;
      assert.equal(collar.kind, 'subtract');
      if (collar.kind !== 'subtract') throw new Error('Expected collar with bores.');
      const sleeveBore = collar.children[1];
      assert.equal(sleeveBore.kind, 'cylinder');
      if (sleeveBore.kind === 'cylinder') assert.equal(sleeveBore.origin[2], 0);
    }
  }
});

test('small dense patterns and holes too close to the stop are rejected', () => {
  assert.match(
    validateParameters(part, { ...part.defaults, tubeOD: 25, holeCount: '12' }, 'assembled').join(
      ' ',
    ),
    /Adjacent guide stations/,
  );
  assert.deepEqual(
    validateParameters(
      part,
      { ...part.defaults, tubeOD: 25, holeCount: '12', guide: 'plain' },
      'assembled',
    ),
    [],
  );
  assert.match(
    validateParameters(part, { ...part.defaults, endOffset: 2 }, 'assembled').join(' '),
    /Tube end to hole axis/,
  );
  assert.match(
    validateParameters(part, { ...part.defaults, tubeOD: 12, tubeWall: 6 }, 'assembled').join(' '),
    /Tube wall/,
  );
  assert.match(
    validateParameters(part, { ...part.defaults, holeCount: '5' }, 'assembled').join(' '),
    /Choose a valid/,
  );
  assert.match(
    validateParameters(part, { ...part.defaults, tubeOD: NaN }, 'assembled').join(' '),
    /finite/,
  );
});

test('bill of materials identifies purchased guides and stays independent of inspection pose', () => {
  for (const count of [4, 8, 12]) {
    const p = { ...part.defaults, holeCount: String(count) };
    const components = part.composition!(p).components;
    assert.equal(
      components.filter((c) => c.supply === 'manufactured').length,
      1 + 2 * count + layout(p).stack.length,
    );
    const bearings = components.filter((c) => c.procurement?.designation.startsWith('692XZZ'));
    assert.equal(bearings.length, 2 * count);
    assert.ok(
      bearings.every((c) => c.libraryId === 'purchased-component' && c.supply === 'purchased'),
    );
    assert.deepEqual(
      configuredPieces(p, 'assembled').map((c) => c.component),
      configuredPieces(p, 'exploded').map((c) => c.component),
    );
  }
  const bushing = part.composition!({ ...part.defaults, thread: 'M4', endOffset: 12 }).components;
  assert.equal(
    bushing.filter((c) => c.procurement?.designation.startsWith('Custom hardened')).length,
    4,
  );
  assert.equal(bushing.filter((c) => c.procurement?.designation.startsWith('692XZZ')).length, 0);
  assert.equal(
    part.composition!({ ...part.defaults, guide: 'plain' }).components.length,
    1 + layout(part.defaults).stack.length,
  );
});

test('the same collar and guide hardware covers different offsets using only reusable spacer rings', () => {
  const fixed = jigPieces(part.defaults).filter((piece) => !piece.id.startsWith('spacer-'));
  for (let offset = 3; offset <= 30; offset += 0.5) {
    const p = { ...part.defaults, endOffset: offset };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    assert.deepEqual(
      jigPieces(p).filter((piece) => !piece.id.startsWith('spacer-')),
      fixed,
    );
    const stack = spacerStack(p);
    assert.ok(stack.every((size) => (spacerSizes as readonly number[]).includes(size)));
    assert.equal(
      stack.reduce((sum, size) => sum + size, 0),
      30 - offset,
    );
  }
  assert.deepEqual(spacerStack({ ...part.defaults, endOffset: 10 }), [20]);
  assert.deepEqual(spacerStack({ ...part.defaults, endOffset: 20 }), [10]);
  assert.deepEqual(spacerStack({ ...part.defaults, endOffset: 30 }), []);
  assert.match(
    validateParameters(part, { ...part.defaults, endOffset: 31 }, 'assembled').join(' '),
    /body capacity/,
  );
  assert.match(
    validateParameters(part, { ...part.defaults, endOffset: 10.2 }, 'assembled').join(' '),
    /0.5 mm increments/,
  );
});

test('each drilling station has an opposite coplanar support flat, including a rotated pattern', () => {
  for (const count of [4, 8, 12]) {
    for (const phase of [0, 17]) {
      const p = { ...part.defaults, holeCount: String(count), phase },
        d = layout(p);
      assert.equal(d.flatCount, Math.max(8, count));
      const body = jigPieces(p)[0].shape;
      assert.ok(body.kind === 'subtract' && body.children[0].kind === 'prism');
      for (const station of d.stations) {
        for (const sign of [-1, 1]) {
          const support = d.outline.map(
            ([x, y]) => sign * (x * station.direction[0] + y * station.direction[1]),
          );
          assert.ok(Math.abs(Math.max(...support) - d.radius) < 1e-9);
          assert.equal(support.filter((value) => Math.abs(value - d.radius) < 1e-9).length, 2);
        }
        assert.ok(d.capEnd + 3.1 < d.radius, 'screw heads must sit behind the support flat');
      }
    }
  }
});

test('preview produces finite geometry with the reported dimensions for all three guide constructions', () => {
  for (const parameters of [
    part.defaults,
    { ...part.defaults, thread: 'M4', endOffset: 12 },
    { ...part.defaults, guide: 'plain', tubeOD: 25, holeCount: '12' },
  ]) {
    const model = part.buildGeometry(parameters, 'assembled');
    try {
      assert.equal(model.children.length, part.composition!(parameters).components.length);
      let count = 0;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        count++;
        assert.ok(object.geometry.getAttribute('position').count > 0);
        assert.ok(
          Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite),
        );
      });
      assert.ok(count > 0);
      model.updateMatrixWorld(true);
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      const expected = part.dimensions(parameters, 'assembled');
      assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < 0.001));
    } finally {
      disposeModel(model);
    }
  }
});
