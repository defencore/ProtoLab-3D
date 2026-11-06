import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { box, cylinder, subtract, union, type Shape } from '../src/core/assembly/boundary/shapes';

function measure(shape: Shape) {
  const model = manifoldBoundaryComponent(shape, 'Boundary test', 0x345678);
  model.updateMatrixWorld(true);
  try {
    const bounds = new Box3().setFromObject(model),
      edges = new Map<string, { uses: number; balance: number }>();
    let volume = 0;
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const position = object.geometry.getAttribute('position');
      assert.ok(position.array instanceof Float32Array);
      for (let i = 0; i < position.count; i += 3) {
        const points = [0, 1, 2].map((j) =>
            new Vector3().fromBufferAttribute(position, i + j).applyMatrix4(object.matrixWorld),
          ),
          [a, b, c] = points,
          keys = points.map((point) => point.toArray().join(','));
        assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 0);
        volume += a.dot(b.clone().cross(c)) / 6;
        for (let j = 0; j < 3; j++) {
          const a = keys[j],
            b = keys[(j + 1) % 3],
            key = [a, b].sort().join('/'),
            edge = edges.get(key) ?? { uses: 0, balance: 0 };
          edge.uses++;
          edge.balance += a < b ? 1 : -1;
          edges.set(key, edge);
        }
      }
    });
    assert.ok([...edges.values()].every(({ uses, balance }) => uses === 2 && balance === 0));
    return { bounds, volume };
  } finally {
    disposeModel(model);
  }
}

const close = (actual: number, expected: number, tolerance = 1e-5) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('Manifold initializes explicitly and retains synchronous closed boundary construction', async (t) => {
  assert.throws(
    () => manifoldBoundaryComponent(box([1, 1, 1], [0, 0, 0]), 'Before initialization', 0),
    /Initialize Manifold geometry/,
  );
  const first = initializeManifoldGeometry(),
    second = initializeManifoldGeometry();
  assert.equal(first, second);
  await first;

  await t.test('Boolean union and intrinsic ZYX placement retain independent dimensions', () => {
    const solid = measure({
      kind: 'transform',
      child: union(box([6, 4, 3], [1, 2, 3]), box([3, 4, 3], [5, 2, 3])),
      translation: [10, -2, 8],
      rotation: [0, 0, 90],
    });
    close(solid.volume, 84);
    solid.bounds.min.toArray().forEach((value, i) => close(value, [4, -1, 11][i]));
    solid.bounds.max.toArray().forEach((value, i) => close(value, [8, 6, 14][i]));
  });

  await t.test('The authored radial resolution determines the through-hole volume', () => {
    const solid = measure(subtract(box([10, 10, 4], [0, 0, 0]), cylinder(1, 6, [5, 5, -1]))),
      polygonArea = 24 * Math.sin((2 * Math.PI) / 48);
    close(solid.volume, 400 - 4 * polygonArea, 1e-4);
  });

  await t.test('Concave loft caps retain the complete L profile', () => {
    const outline: [number, number][] = [
        [0, 0],
        [6, 0],
        [6, 2],
        [2, 2],
        [2, 6],
        [0, 6],
      ],
      solid = measure({
        kind: 'loft',
        rings: [0, 5].map((z) => outline.map(([x, y]) => [x, y, z])),
      });
    close(solid.volume, 100);
  });

  await t.test('Analytic arc loft previews retain curved walls and a through bore', () => {
    const shape: Shape = {
      kind: 'curve-loft',
      segments: [
        {
          kind: 'arc',
          points: [
            [2, 0],
            [0, 2],
            [-2, 0],
          ],
        },
        {
          kind: 'arc',
          points: [
            [-2, 0],
            [0, -2],
            [2, 0],
          ],
        },
      ],
      layers: [
        { scale: 1, angle: 0, z: -1 },
        { scale: 1.5, angle: 0, z: 4 },
      ],
      previewSamples: 65,
      shaftBore: {
        shape: 'round',
        radius: 0.5,
        angle: 0,
        flatDepth: 0,
        sides: 6,
        keyWidth: 0,
        keyDepth: 0,
      },
      previewBoreSegments: 48,
    };
    const solid = measure(shape),
      exactVolume = (Math.PI * 5 * (4 + 6 + 9)) / 3 - Math.PI * 0.5 ** 2 * 5;
    close(solid.volume, exactVolume, 0.05);
    solid.bounds.min.toArray().forEach((value, i) => close(value, [-3, -3, -1][i]));
    solid.bounds.max.toArray().forEach((value, i) => close(value, [3, 3, 4][i]));
  });

  await t.test(
    'Revolved annuli retain their bore, axial datum and authored radial resolution',
    () => {
      const shape: Shape = {
          kind: 'revolve',
          segments: 24,
          profile: [
            [1, -2],
            [3, -2],
            [3, 3],
            [1, 3],
          ],
        },
        full = measure(shape),
        quarter = measure({ ...shape, sweep: 90 }),
        polygonArea = 12 * Math.sin((2 * Math.PI) / 24) * (3 ** 2 - 1 ** 2);
      close(full.volume, polygonArea * 5, 1e-4);
      close(measure({ ...shape, profile: [...shape.profile].reverse() }).volume, full.volume, 1e-4);
      close(measure({ ...shape, sweep: 10 }).volume, 60 * Math.sin(Math.PI / 54), 1e-4);
      full.bounds.min.toArray().forEach((value, i) => close(value, [-3, -3, -2][i]));
      full.bounds.max.toArray().forEach((value, i) => close(value, [3, 3, 3][i]));
      close(quarter.volume, full.volume / 4, 1e-4);
      quarter.bounds.min.toArray().forEach((value, i) => close(value, [0, 0, -2][i]));
      quarter.bounds.max.toArray().forEach((value, i) => close(value, [3, 3, 3][i]));
    },
  );

  await t.test('Cached geometry remains isolated from caller edits, pose and disposal', () => {
    const shape = box([3, 4, 5], [-1, 2, -3]),
      first = manifoldBoundaryComponent(shape, 'First instance', 0x123456),
      second = manifoldBoundaryComponent(
        JSON.parse(JSON.stringify(shape)),
        'Second instance',
        0xabcdef,
      ),
      a = first.children[0] as Mesh,
      b = second.children[0] as Mesh;
    assert.notEqual(a.geometry, b.geometry);
    assert.notEqual(a.material, b.material);
    a.geometry.getAttribute('position').setXYZ(0, 100, 200, 300);
    (a.material as MeshStandardMaterial).color.setHex(0);
    first.position.set(10, 20, 30);
    disposeModel(first);
    const third = manifoldBoundaryComponent(shape, 'Third instance', 0x654321),
      c = third.children[0] as Mesh,
      expected = new Box3(new Vector3(-1, 2, -3), new Vector3(2, 6, 2));
    try {
      assert.ok(new Box3().setFromObject(second).equals(expected));
      assert.ok(new Box3().setFromObject(third).equals(expected));
      assert.equal((b.material as MeshStandardMaterial).color.getHex(), 0xabcdef);
      assert.equal((c.material as MeshStandardMaterial).color.getHex(), 0x654321);
      assert.equal(third.name, 'Third instance');
    } finally {
      disposeModel(second);
      disposeModel(third);
    }
  });

  await t.test('A transient real WASM initialization failure permits a later retry', () => {
    const moduleURL = new URL('../src/core/assembly/manifold-boundary.ts', import.meta.url).href,
      child = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          `import assert from 'node:assert/strict';
           // Warm the TypeScript import hook and Manifold JavaScript before targeting its WASM.
           const { initializeManifoldGeometry, manifoldBoundaryComponent } = await import(${JSON.stringify(moduleURL)});
           await import('manifold-3d');
           const original = WebAssembly.instantiate;
           let failures = 0;
           WebAssembly.instantiate = async (...args) => {
             failures++;
             throw new Error('Transient WASM initialization failure');
           };
           await assert.rejects(initializeManifoldGeometry());
           assert.ok(failures > 0);
           WebAssembly.instantiate = original;
           await initializeManifoldGeometry();
           const model = manifoldBoundaryComponent({ kind: 'box', size: [1, 1, 1], origin: [0, 0, 0] }, 'Retry', 0);
           assert.ok(model.children.length > 0);`,
        ],
        { encoding: 'utf8', timeout: 30000 },
      );
    assert.equal(child.status, 0, child.stderr || child.error?.message);
  });

  await t.test('Unsupported shapes fail and subsequent builds remain usable', () => {
    assert.throws(
      () =>
        manifoldBoundaryComponent(
          { kind: 'sphere', radius: 1, origin: [0, 0, 0] },
          'Unsupported',
          0,
        ),
      /does not support sphere/,
    );
    close(measure(box([1, 1, 1], [0, 0, 0])).volume, 1);
  });
});
