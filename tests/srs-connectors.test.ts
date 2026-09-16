import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3, Raycaster } from 'three';
import part from '../src/parts/srs-connector/part';
import { pieces } from '../src/parts/srs-connector/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
function checkMesh(mesh: Mesh, label: string) {
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.index;
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
    const points = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
    );
    assert.ok(
      points.every((p) => p.toArray().every(Number.isFinite)),
      `${label}: finite vertices`,
    );
    assert.ok(
      points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq() > 1e-18,
      `${label}: nondegenerate triangles`,
    );
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    const keys =
      mesh.geometry.userData.nativeTopology && indices
        ? [0, 1, 2].map((j) => String(indices.getX(i + j)))
        : points.map((p) =>
            p
              .toArray()
              .map((v) => Math.round(v * 1e5))
              .join(','),
          );
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3],
        key = [a, b].sort().join('|');
      const edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, `${label}: positive outward volume`);
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, `${label}: closed oriented boundary`);
}

test('SRS catalog preserves evidence limits and fixed hardware', () => {
  assert.equal(part.presets.length, 7);
  for (const preset of part.presets) {
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), []);
    assert.equal(preset.catalog?.geometryEvidence?.kind, 'source-dimensions');
    assert.deepEqual(preset.catalog?.verifiedParameters, ['model']);
    assert.ok(part.validate({ ...preset.parameters, width: 40 }, 'assembled').length);
  }
  for (const leadLength of [NaN, -1, 151])
    assert.ok(part.validate({ ...part.defaults, leadLength }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, wireDiameter: 2 }, 'assembled').length);
  const keys = part.presets
    .slice(0, 3)
    .map((p) => JSON.stringify(pieces(p.parameters, 'assembled')[0].shape));
  assert.equal(new Set(keys).size, 3, 'keys differ geometrically, not just by color');
});
for (const preset of part.presets)
  for (const state of part.states!)
    test(`${preset.id}/${state.id}: closed solids and preview bounds`, () => {
      const model = part.buildGeometry(preset.parameters, state.id);
      try {
        model.updateMatrixWorld(true);
        model.traverse((o) => {
          if (o instanceof Mesh) checkMesh(o, o.name);
        });
        const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
        part
          .dimensions(preset.parameters, state.id)
          .forEach((v, i) =>
            assert.ok(
              Math.abs(actual[i] - v) < 0.02,
              `${actual} vs expected ${part.dimensions(preset.parameters, state.id)}`,
            ),
          );
        if (state.id === 'assembled') {
          const housing = model.children[0];
          const locations =
            preset.id === 'te-akii-3way'
              ? [
                  [-2, -1],
                  [2, -1],
                  [0, 2],
                ]
              : [
                  [-2, 0],
                  [2, 0],
                ];
          for (const [x, y] of locations) {
            const straight = preset.id === 'amphenol-ca282b';
            const ray = new Raycaster(
              straight ? new Vector3(x, 30, 8.3) : new Vector3(x, y, 30),
              straight ? new Vector3(0, -1, 0) : new Vector3(0, 0, -1),
            );
            const hits = ray.intersectObject(housing, true);
            const front = straight
              ? 6.7
              : preset.id.startsWith('jst')
                ? 10.55
                : preset.id === 'te-akii-2way'
                  ? 14.9
                  : preset.id === 'te-akii-3way'
                    ? 15.4
                    : 13.2;
            assert.ok(
              hits.length === 0 || hits[0].distance > 30 - front + 4,
              'contact socket has a real opening',
            );
          }
        }
      } finally {
        disposeModel(model);
      }
    });
test('published Amphenol envelopes exclude optional leads; zero and maximum lead lengths work', () => {
  for (const [id, expected] of [
    ['amphenol-ca281a', [12.8, 27.5, 13.2]],
    ['amphenol-ca282b', [14.9, 24.2, 16.3]],
  ] as const) {
    const parameters = { ...part.defaults, model: id, leadLength: 0 };
    assert.deepEqual(part.dimensions(parameters, 'assembled'), expected);
    assert.ok(
      pieces({ ...parameters, leadLength: 150 }, 'assembled').some(
        (p) => p.label === 'Illustrative lead 1',
      ),
    );
    assert.ok(
      !pieces(parameters, 'assembled').some((p) => p.label.startsWith('Illustrative lead')),
    );
  }
});

test('JST component envelopes retain published housing, CPA, terminal and ferrite dimensions', () => {
  const model = part.buildGeometry({ ...part.defaults, leadLength: 0 }, 'assembled');
  try {
    const expected = [
      [13, 26.05, 10.55],
      [13, 26.05, 6],
      [12, 8, 11.5],
      [1.9, 10, 8.9],
      [1.9, 10, 8.9],
      [8.4, 8, 4.4],
    ];
    model.children.forEach((child, i) => {
      const size = new Box3().setFromObject(child, true).getSize(new Vector3()).toArray();
      size.forEach((v, a) =>
        assert.ok(Math.abs(v - expected[i][a]) < 0.02, `${child.name}: ${size}`),
      );
    });
  } finally {
    disposeModel(model);
  }
});

// The source front/side views show free spring gaps and OUTWARD retaining hooks.
// Test occupied/empty space on the finished housing, independent of shape construction.
for (const [id, gap, hook, direction] of [
  ['jst-sqxw-i', [5.35, -20, 7.8], [6.1, -20, 8.8], [0, 1, 0]],
  ['amphenol-ca281a', [4.85, -20, 9.2], [5.95, -20, 10.6], [0, 1, 0]],
  ['amphenol-ca282b', [4.7, 3, 30], [6.2, 4, 30], [0, 0, -1]],
] as const)
  test(`${id}: mirrored outward hooks and clear spring gaps`, () => {
    const model = part.buildGeometry({ ...part.defaults, model: id }, 'assembled');
    try {
      model.updateMatrixWorld(true);
      for (const side of [-1, 1]) {
        const ray = (point: readonly [number, number, number]) =>
          new Raycaster(
            new Vector3(side * point[0], point[1], point[2]),
            new Vector3(...direction),
          ).intersectObject(model.children[0], true);
        assert.equal(ray(gap).length, 0, 'spring beam is separated from the nozzle');
        assert.ok(ray(hook).length > 0, 'outward barb exists on each side');
      }
    } finally {
      disposeModel(model);
    }
  });

test('SQXW CPA has a central guide in addition to two outer fingers', () => {
  const model = part.buildGeometry(part.defaults, 'assembled');
  try {
    model.updateMatrixWorld(true);
    const hit = (x: number, y: number) =>
      new Raycaster(new Vector3(x, y, 30), new Vector3(0, 0, -1)).intersectObject(
        model.children[2],
        true,
      )[0];
    assert.ok(
      Math.abs(hit(0, -3).point.z - 9) < 0.01,
      'central guide reaches the documented 11.5 mm envelope',
    );
    for (const x of [-4.5, 4.5])
      assert.ok(hit(x, 0).point.z > 8, 'two separate outer guide fingers');
  } finally {
    disposeModel(model);
  }
});

test('TE AK II variants retain published envelopes and the correct lead/contact counts', () => {
  for (const [model, expected, count] of [
    ['te-akii-2way', [13, 21, 14.9], 2],
    ['te-akii-3way', [15, 21.5, 15.4], 3],
  ] as const) {
    const p = { ...part.defaults, model, leadLength: 0 };
    part.dimensions(p, 'assembled').forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-9));
    assert.equal(
      pieces(p, 'assembled').filter((c) => c.label.startsWith('Socket contact')).length,
      count,
    );
    assert.equal(
      pieces({ ...p, leadLength: 25 }, 'assembled').filter((c) =>
        c.label.startsWith('Illustrative lead'),
      ).length,
      count,
    );
    assert.equal(
      pieces(p, 'assembled').filter((c) => c.label.startsWith('Illustrative lead')).length,
      0,
    );
    const preset = part.presets.find((r) => r.id === model)!;
    assert.equal(preset.catalog!.sourceKind, 'attachment');
    assert.ok(!preset.catalog!.productCodes?.includes('1-1773944-9'));
  }
});
