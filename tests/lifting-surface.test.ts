import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/lifting-surface/part';
import {
  ordinate,
  profileDefinition,
  sectionProfile,
} from '../src/parts/lifting-surface/lib/profiles';
import { panels, station } from '../src/parts/lifting-surface/lib/geometry';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

const examples = [
  ...part.presets,
  {
    id: 'mixed-profiles',
    parameters: {
      ...part.defaults,
      rootProfile: 'diamond',
      tipProfile: 'naca2412',
      wedgePosition: 37,
      planform: 'cranked',
      kinkPosition: 37,
      trailingEdge: 0.2,
    },
  },
  {
    id: 'custom-thin-camber',
    parameters: {
      ...part.defaults,
      rootProfile: 'naca-custom',
      tipProfile: 'same',
      rootCamber: 9,
      rootCamberPosition: 20,
      rootThickness: 2,
      incidence: 10,
      twist: -20,
    },
  },
];

test('airfoil equations retain thickness, camber, wedge corner and closed edge datums', () => {
  const symmetric = profileDefinition({ ...part.defaults, rootProfile: 'naca0012' }, 'root');
  assert.ok(Math.abs(2 * ordinate(symmetric, 0.3, true)[1] - 0.12) < 0.001);
  assert.deepEqual(ordinate(symmetric, 1, true), [1, 0]);
  const cambered = profileDefinition({ ...part.defaults, rootProfile: 'naca2412' }, 'root');
  assert.ok(
    Math.abs((ordinate(cambered, 0.4, true)[1] + ordinate(cambered, 0.4, false)[1]) / 2 - 0.02) <
      1e-12,
  );
  const wedge = profileDefinition(
    { ...part.defaults, rootProfile: 'diamond', rootThickness: 6, wedgePosition: 37 },
    'root',
  );
  assert.equal(ordinate(wedge, 0.37, true)[1], 0.03);
  const arc = profileDefinition(
    { ...part.defaults, rootProfile: 'biconvex', rootThickness: 6 },
    'root',
  );
  assert.ok(Math.abs(ordinate(arc, 0.5, true)[1] - 0.03) < 1e-12);
  assert.deepEqual(ordinate(arc, 0, true), [0, 0]);
  assert.equal(profileDefinition({ ...part.defaults, tipProfile: 'same' }, 'tip').camber, 0.02);
});

test('all lifting-surface examples and section samples have closed outward meshes and matching bounds', () => {
  for (const example of examples)
    for (const state of part.states!) {
      const p = example.parameters,
        label = `${example.id}/${state.id}`;
      assert.deepEqual(validateParameters(part, p, state.id), [], label);
      const model = part.buildGeometry(p, state.id);
      try {
        const actual = new Box3().setFromObject(model, true).getSize(new Vector3());
        part
          .dimensions(p, state.id)
          .forEach((size, i) => assert.ok(Math.abs(actual.getComponent(i) - size) < 0.001, label));
        for (const child of model.children) {
          assert.ok(child instanceof Mesh);
          const pos = child.geometry.getAttribute('position'),
            idx = child.geometry.index!;
          const edges = new Map<string, { count: number; sum: number }>();
          let volume = 0;
          for (let i = 0; i < idx.count; i += 3) {
            const ids = [0, 1, 2].map((j) => idx.getX(i + j));
            const [a, b, c] = ids.map((j) => new Vector3().fromBufferAttribute(pos, j));
            assert.ok(
              b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18,
              `${label}: collapsed face`,
            );
            volume += a.dot(b.clone().cross(c)) / 6;
            for (let j = 0; j < 3; j++) {
              const x = ids[j],
                y = ids[(j + 1) % 3],
                key = [x, y].sort((a, b) => a - b).join(':');
              const edge = edges.get(key) ?? { count: 0, sum: 0 };
              edge.count++;
              edge.sum += x < y ? 1 : -1;
              edges.set(key, edge);
            }
          }
          assert.ok(volume > 0, `${label}: outward solid`);
          for (const [key, value] of edges)
            assert.deepEqual(value, { count: 2, sum: 0 }, `${label}: boundary ${key}`);
        }
      } finally {
        disposeModel(model);
      }
    }
});

test('planform datums, mirror symmetry, vertical orientation and exact kink station survive loft construction', () => {
  const p: Parameters = {
    ...part.defaults,
    planform: 'cranked',
    kinkPosition: 37,
    layout: 'pair',
    rootGap: 20,
  };
  const kink = station(p, 0.37);
  assert.equal(kink.chord, p.kinkChord);
  const model = panels(p, 'surface');
  assert.equal(model.length, 2);
  assert.ok(
    model[0].rings.some((r) => Math.abs(r[0][1] - (0.37 * Number(p.semiSpan) + 10)) < 1e-9),
  );
  model[0].rings.forEach((ring, j) =>
    ring.forEach((v, i) => {
      const mirrored = model[1].rings[j][i];
      assert.deepEqual(mirrored, [v[0], -v[1], v[2]]);
    }),
  );
  const vertical = panels({ ...p, orientation: 'vertical' }, 'surface');
  assert.deepEqual(vertical[0].rings[0][0], [
    model[0].rings[0][0][0],
    -model[0].rings[0][0][2],
    model[0].rings[0][0][1],
  ]);
  const sample = sectionProfile({ ...part.defaults, trailingEdge: 0.4 }, 0, 160);
  const te = sample.filter(([x]) => Math.abs(x - 1) < 1e-9);
  assert.equal(te.length, 2);
  assert.ok(Math.abs((te[0][1] - te[1][1]) * 160 - 0.4) < 1e-9);
});

test('invalid resolutions, zero tips and oversized trailing edges cannot export', () => {
  const patches: Parameters[] = [
    { spanSegments: 2.5 },
    { profileSegments: 12.1 },
    { tipChord: 0 },
    { trailingEdge: 10 },
    { incidence: 45, twist: 30 },
  ];
  for (const patch of patches)
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'surface').length > 0);
});

test('UIUC sections preserve distinctive ordinates and close finite trailing edges explicitly', () => {
  const eppler = profileDefinition({ ...part.defaults, rootProfile: 'e387' }, 'root');
  const selig = profileDefinition({ ...part.defaults, rootProfile: 's1223' }, 'root');
  const five = profileDefinition({ ...part.defaults, rootProfile: 'naca23012' }, 'root');
  assert.ok(Math.abs(ordinate(eppler, 0.4, true)[1] - 0.0803) < 0.001);
  assert.ok(Math.abs(ordinate(selig, 0.4, true)[1] - 0.1303) < 0.001);
  assert.ok(Math.abs(ordinate(five, 0.3, true)[1] - 0.0752) < 0.001);
  assert.ok(Math.abs(ordinate(five, 0.3, false)[1] + 0.0441) < 0.001);
  for (const profile of [eppler, selig, five])
    for (const upper of [true, false]) {
      assert.deepEqual(ordinate(profile, 0, upper), [0, 0]);
      assert.ok(Math.abs(ordinate(profile, 1, upper)[1]) < 1e-10);
    }
});
