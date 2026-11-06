import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { component, pythonShape, type Shape, type Vec } from '../src/core/assembly/boundary/shapes';
import { detailComponent, parseDetailRecipe } from '../src/core/component-recipes';
import detail from '../src/parts/manufactured-detail/part';
import { disposeModel } from '../src/core/mechanical';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';

type SmoothLoft = Extract<Shape, { kind: 'smooth-loft' }>;

test('Manifold evaluates authored smooth lofts and their Boolean cuts without changing native recipes', async () => {
  await initializeManifoldGeometry();
  const shape = fixture();
  const originalNative = pythonShape(shape);
  for (const candidate of [
    shape,
    {
      kind: 'subtract',
      children: [{ kind: 'box', origin: [-1, -5, -2], size: [22, 10, 7] }, shape],
    } as Shape,
  ]) {
    const model = manifoldBoundaryComponent(candidate, 'Smooth loft Boolean', 0xaaaaaa);
    try {
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model, true);
      assert.ok(!bounds.isEmpty());
      let vertices = 0;
      model.traverse((object) => {
        if (object instanceof Mesh) vertices += object.geometry.getAttribute('position').count;
      });
      assert.ok(vertices > 100, 'The actual Manifold surface is present and validated.');
    } finally {
      disposeModel(model);
    }
  }
  assert.equal(pythonShape(shape), originalNative);
});

function fixture(): SmoothLoft {
  return {
    kind: 'smooth-loft',
    sections: [0, 4, 11, 20].map((x, i) => {
      const width = [2, 3.2, 3.8, 2.4][i];
      const height = [1, 2.5, 3.1, 1.3][i];
      const points: Vec[] = Array.from({ length: 33 }, (_, j) => {
        const t = j / 32;
        return [x, width * (2 * t - 1), height * Math.sin(Math.PI * t)];
      });
      const inner: Vec = [x, 0, -1];
      return {
        segments: [
          { kind: 'spline', points },
          { kind: 'line', points: [points.at(-1)!, inner] },
          { kind: 'line', points: [inner, points[0]] },
        ],
      };
    }),
  };
}

function bounds(shape: Shape) {
  const model = component(shape, 'Smooth loft', 0xaaaaaa);
  try {
    model.updateMatrixWorld(true);
    return new Box3().setFromObject(model, true);
  } finally {
    disposeModel(model);
  }
}

test('variable three-dimensional curved sections round-trip through the strict recipe boundary', () => {
  const shape = fixture();
  assert.deepEqual(parseDetailRecipe(JSON.stringify(shape)), shape);
  const box = bounds(shape);
  assert.ok(box.min.distanceTo(new Vector3(0, -3.8, -1)) < 0.001);
  assert.ok(box.max.distanceTo(new Vector3(20, 3.8, 3.1)) < 0.001);
});

test('native smooth loft keeps its source curves independently of preview tessellation', () => {
  const shape = fixture(),
    native = pythonShape(shape);
  assert.match(native, /^Part\.makeLoft\(/);
  assert.match(native, /Part\.BSplineCurve\(\)/);
  assert.match(native, /curve\.interpolate\(pts\)/);
  assert.match(native, /Part\.makeLine\(pts\[0\],pts\[-1\]\)/);
  assert.match(native, /,True,False,False,5\)$/);
  assert.doesNotMatch(native, /makePolygon|makeShell|makeSolid/);
  assert.equal(pythonShape({ ...shape, previewSamples: 9 }), native);
  assert.equal(pythonShape({ ...shape, previewSamples: 65 }), native);
});

test('spatial arc sections use real native arcs and curved preview sampling', () => {
  const shape: SmoothLoft = {
    kind: 'smooth-loft',
    previewSamples: 65,
    sections: [0, 10].map((x) => ({
      segments: [
        {
          kind: 'arc',
          points: [
            [x, -3, 0],
            [x, 0, 3],
            [x, 3, 0],
          ],
        },
        {
          kind: 'line',
          points: [
            [x, 3, 0],
            [x, -3, 0],
          ],
        },
      ],
    })),
  };
  assert.deepEqual(parseDetailRecipe(JSON.stringify(shape)), shape);
  assert.match(pythonShape(shape), /Part\.Arc\(pts\[0\],pts\[1\],pts\[2\]\)/);
  const box = bounds(shape);
  assert.ok(box.min.distanceTo(new Vector3(0, -3, 0)) < 0.001);
  assert.ok(box.max.distanceTo(new Vector3(10, 3, 3)) < 0.001);
  const model = component(shape, 'Arc loft', 0xaaaaaa);
  try {
    let triangles = 0;
    model.traverse((object) => {
      if (object instanceof Mesh) triangles += object.geometry.getAttribute('position').count / 3;
    });
    assert.ok(triangles > 100, 'an arc is not reduced to its three construction points');
  } finally {
    disposeModel(model);
  }
});

test('closed concave sections triangulate their preview caps in the actual section plane', () => {
  const shape: SmoothLoft = {
    kind: 'smooth-loft',
    sections: [0, 10].map((x) => ({
      segments: [
        {
          kind: 'spline',
          points: [
            [x, -3, 0],
            [x, -2, 2],
            [x, 0, 0.3],
            [x, 2, 2],
            [x, 3, 0],
          ],
        },
        {
          kind: 'line',
          points: [
            [x, 3, 0],
            [x, 0, -1],
          ],
        },
        {
          kind: 'line',
          points: [
            [x, 0, -1],
            [x, -3, 0],
          ],
        },
      ],
    })),
  };
  assert.doesNotThrow(() => bounds(shape));
  assert.ok(
    bounds(shape)
      .getSize(new Vector3())
      .distanceTo(new Vector3(10, 6, 3)) < 0.001,
  );
});

test('authored smooth sections retain world placement through manufactured-detail normalization', () => {
  const source: Shape = {
    kind: 'transform',
    child: fixture(),
    translation: [42, -17, 8],
    rotation: [15, 20, 35],
  };
  const instance = detailComponent('curved-fairing', 'Curved fairing', source);
  assert.equal(parseDetailRecipe(String(instance.parameters.recipe)).kind, 'smooth-loft');
  assert.deepEqual(detail.validate(instance.parameters, 'default'), []);
  const original = component(source, 'Source', 0xaaaaaa),
    restored = detail.buildGeometry(instance.parameters, 'default');
  restored.position.set(...instance.placement!.translation);
  const [rx, ry, rz] = instance.placement!.rotation.map((v) => (v * Math.PI) / 180);
  restored.rotation.set(rx, ry, rz, 'ZYX');
  try {
    original.updateMatrixWorld(true);
    restored.updateMatrixWorld(true);
    const a = new Box3().setFromObject(original, true),
      b = new Box3().setFromObject(restored, true);
    assert.ok(a.min.distanceTo(b.min) < 0.001);
    assert.ok(a.max.distanceTo(b.max) < 0.001);
    assert.match(detail.python(instance.parameters, 'default'), /Part\.makeLoft/);
  } finally {
    disposeModel(original);
    disposeModel(restored);
  }
});

test('smooth recipes reject malformed, disconnected, nonplanar and incompatible sections', () => {
  const mutations: ((shape: SmoothLoft) => unknown)[] = [
    (shape) => ({ ...shape, sections: shape.sections.slice(0, 1) }),
    (shape) => ({ ...shape, previewSamples: 2 }),
    (shape) => ({ ...shape, ruled: true }),
    (shape) => {
      shape.sections[0].segments[0].points[1] = [0, 1] as unknown as Vec;
      return shape;
    },
    (shape) => {
      shape.sections[0].segments[0].points[1][1] = Infinity;
      return shape;
    },
    (shape) => {
      shape.sections[0].segments[1].points = [
        [0, 3, 0],
        [0, 4, 0],
        [0, 0, -1],
      ];
      return shape;
    },
    (shape) => {
      shape.sections[0].segments[1].points[0] = [0, 4, 0];
      return shape;
    },
    (shape) => {
      shape.sections[0].segments[0].points[1][0] = 0.1;
      return shape;
    },
    (shape) => {
      shape.sections[1].segments.reverse();
      for (const edge of shape.sections[1].segments) edge.points.reverse();
      return shape;
    },
    (shape) => {
      shape.sections = [shape.sections[0], structuredClone(shape.sections[0])];
      return shape;
    },
    (shape) => {
      shape.sections[1].segments[1].kind = 'spline';
      shape.sections[1].segments[1].points.splice(1, 0, [4, 1, -0.5]);
      return shape;
    },
    (shape) => {
      shape.sections[0].segments[0].points[1] = shape.sections[0].segments[0].points[0];
      return shape;
    },
  ];
  for (const mutate of mutations)
    assert.throws(
      () => parseDetailRecipe(JSON.stringify(mutate(fixture()))),
      /Invalid smooth-loft/,
    );
});

test('ordinary lofts keep their explicit polyhedral native semantics', () => {
  const shape: Shape = {
    kind: 'loft',
    rings: [
      [
        [0, 0, 0],
        [0, 2, 0],
        [0, 0, 2],
      ],
      [
        [5, 0, 0],
        [5, 2, 0],
        [5, 0, 2],
      ],
    ],
  };
  assert.match(pythonShape(shape), /Part\.makeSolid\(Part\.makeShell/);
  assert.doesNotMatch(pythonShape(shape), /makeLoft/);
});
