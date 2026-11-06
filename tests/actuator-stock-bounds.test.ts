import assert from 'node:assert/strict';
import test from 'node:test';
import { stockBounds, type StockAabb } from '../scripts/actuator-stock-bounds';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../src/core/assembly/boundary/shapes';

const closeBounds = (actual: StockAabb | undefined, expected: StockAabb) => {
  assert.ok(actual);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-10));
};

test('positive stock bounds enclose boxes and all three cylinder axes, including thread allowance', () => {
  assert.deepEqual(stockBounds(box([4, 5, 6], [-1, -2, -3])), [[-1, -2, -3, 3, 3, 3]]);
  assert.deepEqual(stockBounds(cylinder(2, 7, [1, 2, 3], 'x')), [[1, 0, 1, 8, 4, 5]]);
  assert.deepEqual(stockBounds(cylinder(2, 7, [1, 2, 3], 'y')), [[-1, 2, 1, 3, 9, 5]]);
  assert.deepEqual(stockBounds(cylinder(2, 7, [1, 2, 3], 'z')), [[-1, 0, 3, 3, 4, 10]]);
  const threaded: Shape = {
    kind: 'cylinder',
    radius: 2,
    height: 7,
    origin: [1, 2, 3],
    axis: 'z',
    thread: { pitch: 0.5, radialClearance: 0.2 },
  };
  closeBounds(stockBounds(threaded)?.[0], [-1.2, -0.2, 3, 3.2, 4.2, 10]);
});

test('subtraction retains all positive union stock and never promotes cutters into material', () => {
  const stock = union(
    box([2, 3, 4], [0, 0, 0]),
    union(cylinder(2, 5, [10, 0, 0], 'y'), box([3, 4, 5], [-10, -20, -30])),
  );
  const before = structuredClone(stock);
  const unknownCutter: Shape = { kind: 'sphere', radius: 100, origin: [0, 0, 0] };
  assert.deepEqual(stockBounds(subtract(stock, unknownCutter)), [
    [0, 0, 0, 2, 3, 4],
    [8, 0, -2, 12, 5, 2],
    [-10, -20, -30, -7, -16, -25],
  ]);
  assert.deepEqual(stock, before);
});

test('transforms retain separate stock proxies and apply CAD ZYX rotation to all eight corners', () => {
  const transformed: Shape = {
    kind: 'transform',
    child: box([2, 4, 6], [1, 2, 3]),
    translation: [10, 20, 30],
    rotation: [90, 90, 0],
  };
  // Rx then Ry maps (x,y,z) to (y,-z,-x), before this translation.
  closeBounds(stockBounds(transformed)?.[0], [12, 11, 27, 16, 17, 29]);
  const rotatedUnion: Shape = {
    kind: 'transform',
    child: union(box([2, 4, 6], [1, 2, 3]), cylinder(1, 5, [10, 0, 0], 'x')),
    translation: [7, -11, 19],
    rotation: [17, 23, 31],
  };
  const bounds = stockBounds(rotatedUnion)!;
  assert.equal(bounds.length, 2);
  const transformPoint = ([x, y, z]: Vec): Vec => {
    const [rx, ry, rz] = [17, 23, 31].map((degrees) => (degrees * Math.PI) / 180);
    const a = y * Math.cos(rx) - z * Math.sin(rx);
    const b = y * Math.sin(rx) + z * Math.cos(rx);
    const c = x * Math.cos(ry) + b * Math.sin(ry);
    return [
      7 + c * Math.cos(rz) - a * Math.sin(rz),
      -11 + c * Math.sin(rz) + a * Math.cos(rz),
      19 - x * Math.sin(ry) + b * Math.cos(ry),
    ];
  };
  // Sample the actual cylindrical surface, not just its rectangular proxy.
  for (let degrees = 0; degrees < 360; degrees++) {
    const radians = (degrees * Math.PI) / 180;
    for (const x of [10, 15]) {
      const point = transformPoint([x, Math.cos(radians), Math.sin(radians)]);
      point.forEach((value, axis) =>
        assert.ok(value >= bounds[1][axis] - 1e-10 && value <= bounds[1][axis + 3] + 1e-10),
      );
    }
  }
});

test('unsupported positive recipes and invalid dimensions retain the whole native fallback', () => {
  const unknown: Shape[] = [
    { kind: 'sphere', radius: 4, origin: [0, 0, 0] },
    { kind: 'intersect', children: [box([1, 1, 1], [0, 0, 0]), cylinder(1, 1, [0, 0, 0])] },
    {
      kind: 'prism',
      points: [
        [0, 0],
        [2, 0],
        [1, 1],
      ],
      depth: 1,
      origin: 0,
      axis: 'z',
    },
    {
      kind: 'revolve',
      profile: [
        [0, 0],
        [2, 0],
        [2, 1],
      ],
    },
    { kind: 'union', children: [] },
    { kind: 'subtract', children: [] },
    box([-1, 2, 3], [0, 0, 0]),
    cylinder(1, Infinity, [0, 0, 0]),
  ];
  for (const shape of unknown) {
    assert.equal(stockBounds(shape), undefined);
    assert.equal(stockBounds(union(box([1, 1, 1], [0, 0, 0]), shape)), undefined);
    assert.equal(stockBounds(subtract(shape, box([1, 1, 1], [0, 0, 0]))), undefined);
    assert.equal(
      stockBounds({ kind: 'transform', child: shape, translation: [1, 2, 3], rotation: [0, 0, 0] }),
      undefined,
    );
  }
});
