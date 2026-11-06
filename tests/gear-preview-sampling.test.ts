import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Mesh, Triangle, Vector3, type Group } from 'three';
import { gearShape, gearOutline } from '../src/parts/tr8-geared-rocker-actuator/lib/shapes';
import { pythonShape, type Shape } from '../src/core/assembly/boundary/shapes';
import { detailComponent, parseDetailRecipe } from '../src/core/component-recipes';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import detail from '../src/parts/manufactured-detail/part';
import { eskdIdentity } from '../src/core/eskd';
import { disposeModel } from '../src/core/mechanical';

const previewKeys = new Set(['previewSamples', 'previewBoreSegments', 'previewSegments']);
function dense(shape: Shape): Shape {
  return parseDetailRecipe(
    JSON.stringify(shape, (key, value: unknown) => (previewKeys.has(key) ? undefined : value)),
  );
}
function audit(model: Group) {
  model.updateMatrixWorld(true);
  let count = 0,
    volume = 0;
  const walls: Triangle[] = [];
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const p = object.geometry.getAttribute('position'),
      index = object.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const v = [0, 1, 2].map((j) =>
        new Vector3()
          .fromBufferAttribute(p, index ? index.getX(i + j) : i + j)
          .applyMatrix4(object.matrixWorld),
      );
      count++;
      volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
      const triangle = new Triangle(v[0], v[1], v[2]);
      if (
        Math.abs(triangle.getNormal(new Vector3()).x) < 0.99 &&
        v.every((p) => Math.hypot(p.y, p.z) > 10)
      )
        walls.push(triangle);
    }
  });
  return { count, volume, walls };
}

test('gear preview sampling removes over 60 percent of triangles while retaining exact native geometry and identity', (t) => {
  const nativeHashes = [
    '52dd110be0b5aec9355b9463928e4923255d4e44b28b201fe19c496edc087919',
    'e2cdabc0697f01dd9db66cd893b949ca7544ee6d53b1dc9bdf06ab1e7955ac99',
  ];
  for (const pinion of [false, true]) {
    const coarseShape = gearShape(pinion),
      denseShape = dense(coarseShape);
    const native = pythonShape(coarseShape);
    assert.equal(
      native,
      pythonShape(denseShape),
      'sampling never changes the native analytic constructor',
    );
    assert.equal(createHash('sha256').update(native).digest('hex'), nativeHashes[Number(pinion)]);
    const configured = [coarseShape, denseShape].map((shape) =>
      detailComponent('gear', 'Gear', shape, { edgeTolerance: 1e-6, meshConform: true }),
    );
    assert.deepEqual(
      detail.identityParameters!(configured[0].parameters),
      detail.identityParameters!(configured[1].parameters),
    );
    assert.equal(
      eskdIdentity(detail, configured[0].parameters, 'default').configurationKey,
      eskdIdentity(detail, configured[1].parameters, 'default').configurationKey,
    );
    const models = configured.map((component) =>
      componentGeometry([detail], [{ component, label: 'Gear', color: 0xd8a04c }]),
    );
    try {
      const low = audit(models[0]),
        high = audit(models[1]);
      assert.ok(low.count < high.count * 0.4, `${low.count} versus ${high.count} triangles`);
      assert.ok(
        Math.abs(low.volume - high.volume) / high.volume < 0.005,
        'viewport volume stays within 0.5 percent of the dense mesh',
      );
      assert.ok(low.walls.length > 0);
      let maximumError = 0;
      for (const [x, y] of gearOutline()) {
        const point = new Vector3(-8.5, y, -x),
          closest = new Vector3();
        const distance = Math.min(
          ...low.walls.map((triangle) =>
            triangle.closestPointToPoint(point, closest).distanceTo(point),
          ),
        );
        maximumError = Math.max(maximumError, distance);
      }
      assert.ok(maximumError < 0.05, `sampled involute deviation ${maximumError} mm`);
      t.diagnostic(
        `${pinion ? 'Pinion' : 'Driven gear'}: ${high.count} → ${low.count} triangles; maximum profile deviation ${maximumError.toFixed(5)} mm.`,
      );
    } finally {
      models.forEach(disposeModel);
    }
  }
});

test('preview sampling rejects invalid budgets without admitting arbitrary recipe metadata', () => {
  const shape = gearShape();
  const change = (key: string, value: unknown) =>
    JSON.stringify(shape, (name, item: unknown) => (name === key ? value : item));
  for (const value of [0, 2, 3.5, NaN, 2049])
    assert.throws(() => parseDetailRecipe(change('previewSamples', value)));
  assert.throws(() => parseDetailRecipe(JSON.stringify({ ...shape, arbitraryPreview: true })));
});
