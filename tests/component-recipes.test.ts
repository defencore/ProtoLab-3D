import { withGeometryMode } from '../src/core/geometry-mode';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import {
  detailComponent,
  parseDetailRecipe,
  shapeComposition,
} from '../src/core/component-recipes';
import {
  component,
  boundaryThreadCallouts,
  pythonShape,
  type Shape,
} from '../src/core/assembly/boundary/shapes';
import detail from '../src/parts/manufactured-detail/part';
import { disposeModel } from '../src/core/mechanical';
import { nativeThreadDepth } from '../src/core/thread-native';
import { parseRecoveryRecipe } from '../src/core/recovery-component-recipes';

test('threaded recipes require a positive native core independently of display mode', () => {
  for (const internal of [false, true])
    for (const rounded of [false, true]) {
      const pitch = 1;
      const depth = nativeThreadDepth(pitch, internal, rounded);
      const cylinder = {
        kind: 'cylinder',
        height: 3,
        origin: [0, 0, 0],
        axis: 'z',
        thread: { pitch, internal, rounded },
      };
      for (const mode of ['simple', 'full'] as const)
        withGeometryMode(mode, () => {
          for (const radius of [depth / 2, depth])
            assert.throws(
              () => parseDetailRecipe(JSON.stringify({ ...cylinder, radius })),
              /Invalid cylinder/,
            );
          assert.doesNotThrow(() =>
            parseDetailRecipe(JSON.stringify({ ...cylinder, radius: depth + 0.01 })),
          );
        });
    }
});

test('recovery thread core validation includes only explicit printed fit allowances in both modes', () => {
  for (const internal of [false, true]) {
    const pitch = 1;
    const depth = nativeThreadDepth(pitch, internal);
    const thread = { kind: 'thread', pitch, length: 3, internal, clearance: 0 };
    for (const mode of ['simple', 'full'] as const)
      withGeometryMode(mode, () => {
        for (const feature of [
          { ...thread, diameter: depth },
          { ...thread, diameter: 2 * (depth - 0.05), clearance: 0.1 },
          { ...thread, diameter: 2 * (depth + 0.05), clearance: -0.1, process: 'printed' },
        ])
          assert.throws(() => parseRecoveryRecipe(JSON.stringify(feature)), /Invalid recovery/);
        for (const feature of [
          { ...thread, diameter: 2 * (depth + 0.01) },
          { ...thread, diameter: 2 * (depth - 0.05), clearance: 0.1, process: 'printed' },
        ])
          assert.deepEqual(parseRecoveryRecipe(JSON.stringify(feature)), feature);
      });
  }
});

test('local fabricated definition is reusable at different assembly positions', () => {
  const first: Shape = {
    kind: 'subtract',
    children: [
      { kind: 'box', size: [30, 20, 5], origin: [120, -70, 40] },
      { kind: 'cylinder', radius: 2, height: 7, origin: [125, -65, 39], axis: 'z' },
    ],
  };
  const second: Shape = {
    kind: 'subtract',
    children: [
      { kind: 'box', size: [30, 20, 5], origin: [20, 30, 4] },
      { kind: 'cylinder', radius: 2, height: 7, origin: [25, 35, 3], axis: 'z' },
    ],
  };
  const a = detailComponent('a', 'Mount A', first),
    b = detailComponent('b', 'Mount B', second);
  assert.deepEqual(a.parameters, b.parameters);
  assert.notDeepEqual(a.placement, b.placement);
  assert.deepEqual(a.placement.translation, [120, -70, 40]);
  const original = component(first, 'First', 0xaaaabb),
    restored = detail.buildGeometry(a.parameters, 'default');
  restored.position.set(...a.placement.translation);
  try {
    original.updateMatrixWorld(true);
    restored.updateMatrixWorld(true);
    const x = new Box3().setFromObject(original, true),
      y = new Box3().setFromObject(restored, true);
    assert.ok(x.min.distanceTo(y.min) < 0.001);
    assert.ok(x.max.distanceTo(y.max) < 0.001);
  } finally {
    disposeModel(original);
    disposeModel(restored);
  }
});

test('recipe rejects executable content, malformed transforms and nonfinite or oversized geometry', () => {
  for (const value of [
    { kind: 'native', source: 'exec()' },
    { kind: 'box', size: [1, 2, 3], origin: [0, 0, 0], python: 'exec()' },
    {
      kind: 'transform',
      child: { kind: 'box', size: [1, 2, 3], origin: [0, 0, 0] },
      translation: [1, 2],
      rotation: [0, 0, 0],
    },
    { kind: 'cylinder', radius: 0, height: 3, origin: [0, 0, 0], axis: 'z' },
    {
      kind: 'boundary',
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      faces: [
        [0, 1, 99],
        [0, 1, 2],
        [1, 2, 3],
        [0, 2, 3],
      ],
    },
  ])
    assert.throws(() => parseDetailRecipe(JSON.stringify(value)));
  assert.throws(() => parseDetailRecipe('x'.repeat(4_000_001)));
});

test('authored physical occurrences remain distinct while sharing reusable local definitions', () => {
  const shape: Shape = { kind: 'box', size: [30, 20, 5], origin: [0, 0, 0] };
  const definition = shapeComposition([
    { shape, label: 'First' },
    { shape, label: 'Second' },
  ]);
  assert.equal(definition.components.length, 2);
  assert.notEqual(definition.components[0].id, definition.components[1].id);
  assert.equal(definition.components[0].libraryId, 'manufactured-detail');
  assert.ok(definition.issues.length > 0);
  assert.deepEqual(detail.validate(definition.components[0].parameters, 'default'), []);
  assert.deepEqual(detail.dimensions(detail.defaults, 'default'), [80, 60, 8]);
});

test('rigid mechanism motion changes occurrence placement while retaining the local fabrication recipe', () => {
  const local: Shape = {
    kind: 'subtract',
    children: [
      { kind: 'box', size: [24, 17, 9], origin: [3, -4, 2] },
      { kind: 'cylinder', radius: 2, height: 11, origin: [8, 2, 1], axis: 'z', segments: 64 },
    ],
  };
  const frames: Shape[] = [
    { kind: 'transform', child: local, translation: [100, -20, 35], rotation: [12, 28, 43] },
    {
      kind: 'transform',
      child: { kind: 'transform', child: local, translation: [4, 7, 2], rotation: [0, 45, 0] },
      translation: [-16, 23, 91],
      rotation: [0, 0, 61],
    },
  ];
  const base = detailComponent('base', 'Base', local);
  for (const [i, shape] of frames.entries()) {
    const occurrence = detailComponent(String(i), 'Moved', shape);
    assert.deepEqual(occurrence.parameters, base.parameters);
    const original = component(shape, 'Original', 0xaaaabb),
      restored = detail.buildGeometry(occurrence.parameters, 'default');
    restored.position.set(...occurrence.placement.translation);
    restored.rotation.set(
      ...(occurrence.placement.rotation.map((v) => (v * Math.PI) / 180) as [
        number,
        number,
        number,
      ]),
      'ZYX',
    );
    try {
      original.updateMatrixWorld(true);
      restored.updateMatrixWorld(true);
      const expected = new Box3().setFromObject(original, true),
        actual = new Box3().setFromObject(restored, true);
      assert.ok(expected.min.distanceTo(actual.min) < 0.001);
      assert.ok(expected.max.distanceTo(actual.max) < 0.001);
    } finally {
      disposeModel(original);
      disposeModel(restored);
    }
  }
});

test('thread markings follow internal feature frames and remain absent from nominal export meshes', () => {
  const shape: Shape = {
    kind: 'transform',
    translation: [7, -4, 12],
    rotation: [90, 0, 0],
    child: {
      kind: 'cylinder',
      radius: 3,
      height: 20,
      origin: [0, 0, 2],
      axis: 'z',
      segments: 64,
      thread: { pitch: 1, internal: true, left: true },
    },
  };
  const preview = withGeometryMode('full', () => component(shape, 'Threaded', 0xaaaabb)),
    nominal = component(shape, 'Nominal', 0xaaaabb, [0, 0, 0], 0, { nominal: true });
  let marked = 0,
    exported = 0;
  try {
    preview.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
      const threads = object.material.userData.visualThreads;
      assert.equal(threads.length, 1);
      assert.equal(threads[0].internal, true);
      assert.equal(threads[0].left, true);
      assert.ok(new Vector3(...threads[0].axis).distanceTo(new Vector3(0, -1, 0)) < 1e-8);
      assert.equal(threads[0].pitch, 1);
      assert.equal(threads[0].length, 20);
      marked++;
    });
    nominal.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
      assert.equal(object.material.userData.visualThreads, undefined);
      exported++;
    });
    assert.equal(marked, 1);
    assert.equal(exported, 1);
    preview.updateMatrixWorld(true);
    nominal.updateMatrixWorld(true);
    const p = new Box3().setFromObject(preview, true),
      n = new Box3().setFromObject(nominal, true);
    assert.deepEqual(p.min.toArray(), n.min.toArray());
    assert.deepEqual(p.max.toArray(), n.max.toArray());
  } finally {
    disposeModel(preview);
    disposeModel(nominal);
  }
});

test('authored thread inspection allowance changes the actual cutter envelope while preserving nominal drawing identity', () => {
  const feature: Extract<Shape, { kind: 'cylinder' }> = {
    kind: 'cylinder',
    radius: 3,
    height: 20,
    origin: [0, 0, 0],
    axis: 'z',
    segments: 64,
    thread: { pitch: 1, internal: true, radialClearance: 0.05 },
  };
  assert.deepEqual(parseDetailRecipe(JSON.stringify(feature)), feature);
  for (const invalid of [-0.01, NaN, 0.76, '0.05'])
    assert.throws(() =>
      parseDetailRecipe(
        JSON.stringify({ ...feature, thread: { ...feature.thread, radialClearance: invalid } }),
      ),
    );
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const model = component(feature, 'Inspection tool', 0xffffff);
      try {
        model.updateMatrixWorld(true);
        const envelope = new Box3().setFromObject(model, true).getSize(new Vector3());
        assert.ok(Math.abs(envelope.x - 6.1) < 0.00001);
        assert.ok(Math.abs(envelope.y - 6.1) < 0.00001);
        const callout = boundaryThreadCallouts(feature)[0];
        assert.equal(callout.nominalDiameter, 6);
        assert.equal(callout.pitch, 1);
        model.traverse((o) => {
          if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) {
            if (mode === 'full') assert.equal(o.material.userData.visualThreads[0].diameter, 6.1);
            else assert.equal(o.material.userData.visualThreads, undefined);
          }
        });
        assert.ok(
          pythonShape(feature).includes(
            mode === 'simple'
              ? 'Part.makeCylinder(3.05,20'
              : '_protolab_thread(6,1,20,True,False,0.05,False)',
          ),
        );
      } finally {
        disposeModel(model);
      }
    });
  const legacy = { ...feature, thread: { pitch: 1, internal: true } };
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () =>
      assert.equal(
        pythonShape(legacy),
        pythonShape({ ...legacy, thread: { ...legacy.thread, radialClearance: 0 } }),
      ),
    );
});
