import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, Raycaster, Vector3 } from 'three';
import spur from "../src/parts/spur-gear/part";
import helical from "../src/parts/helical-gear/part";
import bevel from "../src/parts/bevel-gear/part";
import pair from "../src/parts/bevel-gear-pair/part";
import worm from "../src/parts/worm-drive/part";
import { shaftBoreOutline, shaftBoreShapes, shaftBoreValues } from "../src/parts/spur-gear/lib/core/shaft-bore";
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

const variants = shaftBoreShapes.map(([boreShape]) => ({
  boreShape,
  bore: 6,
  boreAngle: 17,
  boreFlatDepth: 0.8,
  boreKeyWidth: 2,
  boreKeyDepth: 0.8,
  boreSides: 5,
}));

function inspectMesh(object: Mesh) {
  const position = object.geometry.getAttribute('position');
  const index = object.geometry.getIndex();
  const edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const points = [0, 1, 2].map((offset) =>
      new Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset),
    );
    assert.ok(points.every((point) => point.toArray().every(Number.isFinite)));
    assert.ok(
      points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length() > 1e-9,
    );
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    const keys = points.map((point) =>
      point
        .toArray()
        .map((value) => Math.round(value * 100000))
        .join(','),
    );
    for (let side = 0; side < 3; side++) {
      const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(volume > 0);
  for (const [edge, uses] of edges) assert.equal(uses, 2, `Closed edge ${edge}`);
}

for (const part of [spur, helical, bevel, worm]) {
  test(`${part.id}: all seven rotated bore profiles have closed outward shells`, () => {
    for (const changes of variants) {
      const p = { ...part.defaults, ...changes };
      const state = part === worm ? 'wheel' : 'default';
      assert.deepEqual(validateParameters(part, p, state), []);
      const model = part.buildGeometry(p, state);
      try {
        model.traverse((object) => {
          if (object instanceof Mesh) inspectMesh(object);
        });
      } finally {
        disposeModel(model);
      }
    }
  });
}

test('both bevel-pair bores independently support every shaft profile with closed meshes', () => {
  for (let i = 0; i < variants.length * 2; i++) {
    const p: Parameters = { ...pair.defaults, setScrews: i >= variants.length, rotation: 37 };
    for (const [side, variant] of [
      ['pinion', variants[i % variants.length]],
      ['wheel', variants[(i + 1) % variants.length]],
    ] as const) {
      for (const [key, value] of Object.entries(variant))
        p[`${side}${key[0].toUpperCase()}${key.slice(1)}`] = value;
      p[`${side}Bore`] = side === 'pinion' ? 6 : 8;
    }
    assert.deepEqual(validateParameters(pair, p, 'assembled'), []);
    const model = pair.buildGeometry(p, 'assembled');
    try {
      model.traverse((object) => {
        if (object instanceof Mesh) inspectMesh(object);
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('bore cross sections visibly remove only the selected shaft shape', () => {
  const samples: [string, number, number, boolean][] = [
    ['round', 2.7, 0, true],
    ['d', 2.7, 0, false],
    ['d', -2.7, 0, true],
    ['double-d', -2.7, 0, false],
    ['double-d', 0, 2.7, true],
    ['hex', 0, 3.2, true],
    ['round', 0, 3.2, false],
    ['square', 2.8, 2.8, true],
    ['keyway', 3.4, 0, true],
    ['keyway', 3.4, 1.4, false],
  ];
  for (const [boreShape, x, y, empty] of samples) {
    const p = {
      ...spur.defaults,
      bore: 6,
      boreShape,
      boreAngle: 0,
      boreFlatDepth: 0.8,
      boreKeyWidth: 2,
      boreKeyDepth: 0.8,
    };
    const model = spur.buildGeometry(p, 'default');
    try {
      model.updateMatrixWorld(true);
      const intersections = new Raycaster(
        new Vector3(x, y, 30),
        new Vector3(0, 0, -1),
      ).intersectObject(model, true);
      assert.equal(intersections.length === 0, empty, `${boreShape}: (${x}, ${y})`);
    } finally {
      disposeModel(model);
    }
  }
});

test('polygon size means across flats, and key corners and polygon corners participate in wall checks', () => {
  const outline = shaftBoreOutline(
    shaftBoreValues({ ...spur.defaults, boreShape: 'hex', bore: 6 }),
  );
  assert.ok(Math.abs(Math.max(...outline.map((point) => point.x)) - 3) < 1e-10);
  const cases: Parameters[] = [
    { boreShape: 'square', bore: 12, hubDiameter: 14 },
    { boreShape: 'keyway', bore: 12, boreKeyWidth: 3, boreKeyDepth: 3, hubDiameter: 16 },
    { boreShape: 'd', boreFlatDepth: 3, bore: 6 },
    { boreShape: 'polygon', boreSides: 5.5 },
    { boreShape: 'keyway', boreKeyWidth: 6, bore: 6 },
  ];
  for (const changes of cases)
    assert.ok(validateParameters(spur, { ...spur.defaults, ...changes }, 'default').length > 0);
});

test('sourced gear presets retain round bores except explicitly listed stock wheel keyways', () => {
  for (const part of [spur, pair])
    for (const preset of part.presets.filter((preset) => preset.catalog)) {
      const keys = part === pair ? ['pinionBoreShape', 'wheelBoreShape'] : ['boreShape'];
      for (const key of keys) {
        const stockKeyway =
          part === pair &&
          preset.id.startsWith('reference-bevel-m2-15-30-bore-') &&
          key === 'wheelBoreShape';
        assert.equal(preset.parameters[key], stockKeyway ? 'keyway' : 'round', preset.id);
        if (stockKeyway) {
          assert.ok(preset.catalog!.verifiedParameters.includes(key));
          assert.ok(preset.catalog!.verifiedParameters.includes('wheelBoreKeyWidth'));
          assert.ok(!preset.catalog!.verifiedParameters.includes('wheelBoreKeyDepth'));
        }
      }
    }
});
