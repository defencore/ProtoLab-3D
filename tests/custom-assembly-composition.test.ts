import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Group, Vector3 } from 'three';
import { parts } from '../src/parts';
import { parseDetailRecipe } from '../src/core/component-recipes';
import { pythonShape, type Shape } from '../src/core/assembly/boundary/shapes';
import { disposeModel } from '../src/core/mechanical';
import detail from '../src/parts/manufactured-detail/part';

const ids = [
  'wheel',
  'clevis',
  'piston',
  'connecting-rod',
  'round-linear-guide',
  'worm-drive',
  'bevel-gear-pair',
];
const family = (id: string) => {
  const result = parts.find((part) => part.id === id);
  assert.ok(result, id);
  return result;
};

test('custom mechanism configurations expose physical library definitions and unresolved engineering requirements', () => {
  for (const id of ids) {
    const part = family(id);
    assert.ok(part.composition, id);
    for (const preset of part.presets) {
      const parameters = { ...part.defaults, ...preset.parameters };
      const composition = part.composition(parameters);
      assert.ok(composition.components.length > 0, `${id}/${preset.id}`);
      assert.equal(
        new Set(composition.components.map((item) => item.id)).size,
        composition.components.length,
      );
      assert.ok(
        composition.issues.length > 0,
        `${id}: prototype geometry cannot approve production`,
      );
      for (const item of composition.components) {
        assert.equal(item.libraryId, 'manufactured-detail');
        assert.equal(item.supply, 'manufactured');
        assert.equal(item.quantity, 1);
        assert.deepEqual(detail.validate(item.parameters, item.state), [], `${id}/${item.id}`);
        assert.ok(item.placement.translation.every(Number.isFinite));
        assert.ok(item.placement.rotation.every(Number.isFinite));
      }
      assert.deepEqual(
        part.composition(parameters),
        composition,
        `${id}: composition is repeatable`,
      );
    }
  }
});

test('component recipes preserve assembled mechanism bounds without inspection offsets', () => {
  for (const id of [
    'clevis',
    'piston',
    'connecting-rod',
    'round-linear-guide',
    'worm-drive',
    'bevel-gear-pair',
  ]) {
    const part = family(id),
      composition = part.composition!(part.defaults);
    const original = part.buildGeometry(part.defaults, 'assembled');
    const restored = new Group();
    try {
      for (const item of composition.components) {
        const model = detail.buildGeometry(item.parameters, item.state);
        model.position.set(...item.placement.translation);
        model.rotation.set(
          ...(item.placement.rotation.map((value) => (value * Math.PI) / 180) as [
            number,
            number,
            number,
          ]),
          'ZYX',
        );
        restored.add(model);
      }
      assert.ok(
        original.children.every((item) => item.userData.libraryId === 'manufactured-detail'),
        id,
      );
      original.updateMatrixWorld(true);
      restored.updateMatrixWorld(true);
      const expected = new Box3().setFromObject(original, true),
        actual = new Box3().setFromObject(restored, true);
      assert.ok(expected.min.distanceTo(actual.min) < 0.001, `${id}: lower envelope`);
      assert.ok(expected.max.distanceTo(actual.max) < 0.001, `${id}: upper envelope`);
    } finally {
      disposeModel(original);
      disposeModel(restored);
    }
  }
});

test('wheel preview contains its two actual library occurrences and its configured envelope', () => {
  const part = family('wheel'),
    model = part.buildGeometry(part.defaults, 'default');
  try {
    assert.equal(model.children.length, 2);
    assert.ok(model.children.every((item) => item.userData.libraryId === 'manufactured-detail'));
    model.updateMatrixWorld(true);
    const dimensions = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
    assert.ok(
      dimensions.every(
        (value, i) => Math.abs(value - part.dimensions(part.defaults, 'default')[i]) < 0.001,
      ),
    );
    assert.match(part.python(part.defaults, 'default'), /ConfigurationJSON/);
  } finally {
    disposeModel(model);
  }
});

test('sphere, torus, intersection and hexagonal features retain native CAD semantics', () => {
  const shapes: Shape[] = [
    { kind: 'sphere', radius: 2, origin: [4, 5, 6], segments: 32 },
    { kind: 'torus', major: 10, minor: 2, origin: [4, 5, 6], innerSegments: 16, outerSegments: 64 },
    {
      kind: 'intersect',
      children: [
        { kind: 'box', size: [4, 4, 4], origin: [0, 0, 0] },
        { kind: 'cylinder', radius: 2, height: 4, origin: [0, 0, 0], axis: 'z' },
      ],
    },
    { kind: 'cylinder', radius: 3, height: 2, origin: [4, 5, 6], axis: 'y', segments: 6 },
  ];
  const expected = [/Part\.makeSphere/, /Part\.makeTorus/, /\.common\(/, /Part\.Face.*\.extrude/];
  shapes.forEach((shape, i) => {
    assert.deepEqual(parseDetailRecipe(JSON.stringify(shape)), shape);
    assert.match(pythonShape(shape), expected[i]);
  });
  for (const malformed of [
    { ...shapes[0], radius: 0 },
    { ...shapes[0], segments: 2 },
    { ...shapes[1], minor: 11 },
    { ...shapes[1], innerSegments: 2 },
    { kind: 'intersect', children: [shapes[0]] },
    {
      kind: 'revolve',
      profile: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      segments: 2,
    },
  ])
    assert.throws(() => parseDetailRecipe(JSON.stringify(malformed)));
});

test('gear library recipes retain analytical shaft connections and helical machining features', () => {
  const walk = (shape: Shape): Shape[] => [
    shape,
    ...('children' in shape
      ? shape.children.flatMap(walk)
      : shape.kind === 'transform'
        ? walk(shape.child)
        : shape.kind === 'boundary'
          ? (shape.nativeCuts ?? []).flatMap(walk)
          : []),
  ];
  const worm = family('worm-drive').composition!(family('worm-drive').defaults).components;
  const wheelFeatures = walk(parseDetailRecipe(String(worm[0].parameters.recipe)));
  const loft = wheelFeatures.find((s) => s.kind === 'curve-loft');
  assert.ok(loft?.kind === 'curve-loft' && loft.shaftBore);
  const wheelPython = pythonShape(loft);
  assert.match(wheelPython, /Part\.BSplineCurve/);
  assert.match(wheelPython, /Part\.Arc/);
  assert.match(wheelPython, /Part\.makeLoft/);
  assert.match(wheelPython, /\.cut\(Part\.makeCylinder/);
  const cut = walk(parseDetailRecipe(String(worm[1].parameters.recipe))).find(
    (s) => s.kind === 'helical-worm',
  );
  assert.ok(cut?.kind === 'helical-worm');
  const wormPython = pythonShape(cut);
  assert.match(wormPython, /Part\.makeLongHelix/);
  assert.match(wormPython, /\.makePipeShell/);
  assert.equal((wormPython.match(/\.cut\(/g) ?? []).length, cut.starts);
  const pair = family('bevel-gear-pair');
  for (const item of pair.composition!({ ...pair.defaults, setScrews: true }).components) {
    const recipe = parseDetailRecipe(String(item.parameters.recipe));
    assert.ok(recipe.kind === 'boundary' && recipe.nativeCuts?.length === 2);
    assert.equal(item.parameters.nativeRefine, false);
    assert.match(pythonShape(recipe), /Part\.makeSolid.*\.cut\(/);
    assert.throws(() =>
      parseDetailRecipe(
        JSON.stringify({ ...recipe, nativeCuts: [{ kind: 'native', source: 'exec()' }] }),
      ),
    );
  }
  assert.throws(() =>
    parseDetailRecipe(
      JSON.stringify({ ...loft, shaftBore: { ...loft.shaftBore, shape: 'invented' } }),
    ),
  );
});

test('gear motion reuses each local fabrication definition and changes only its occurrence frame', () => {
  for (const id of ['worm-drive', 'bevel-gear-pair']) {
    const part = family(id),
      rest = part.composition!({ ...part.defaults, rotation: 0 }),
      moved = part.composition!({ ...part.defaults, rotation: 73 });
    assert.equal(rest.components.length, moved.components.length);
    for (let i = 0; i < rest.components.length; i++) {
      assert.deepEqual(
        moved.components[i].parameters,
        rest.components[i].parameters,
        id + '/' + rest.components[i].id,
      );
      assert.notDeepEqual(
        moved.components[i].placement,
        rest.components[i].placement,
        id + '/' + rest.components[i].id,
      );
    }
    const parameters = { ...part.defaults, rotation: 73 },
      model = part.buildGeometry(parameters, 'assembled');
    try {
      model.updateMatrixWorld(true);
      const exact = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      const declared = part.dimensions(parameters, 'assembled');
      assert.ok(
        exact.every((value, i) => Math.abs(value - declared[i]) < 0.001),
        id + ' exact rotated bounds',
      );
    } finally {
      disposeModel(model);
    }
  }
});
