import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/laboratory-terminal/part';
import module from '../src/parts/laboratory-terminal';
import { models, pieces, selected } from '../src/parts/laboratory-terminal/lib/model';

function hits(
  model: string,
  origin: number[],
  direction: number[],
  distance: number,
  label?: RegExp,
) {
  const g = part.buildGeometry({ model }, 'assembled');
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (o instanceof Mesh) {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => (m.side = DoubleSide));
    }
  });
  const ray = new Raycaster(
    new Vector3(...(origin as [number, number, number])),
    new Vector3(...(direction as [number, number, number])),
    0,
    distance,
  );
  return ray.intersectObject(g, true).filter((h) => !label || label.test(h.object.name));
}
const supported = [
  'banana-plug',
  'banana-jack',
  'binding-post',
  'spring-post',
  'recessed-jack',
  'speaker-spring',
  'spring-banana',
  'lever-splice',
  'screw-plug',
];
test('laboratory catalog contains 19 identified fixed purchased supplier executions', () => {
  assert.equal(module.apiVersion, 2);
  assert.equal(part.name, 'Laboratory terminal');
  assert.equal(part.presets!.length, 19);
  assert.equal(new Set(models.map((m) => m.id)).size, 19);
  assert.deepEqual(new Set(models.map((m) => m.kind)), new Set(supported));
  assert.equal(part.catalogSelectionOnly, true);
  for (const preset of part.presets!) {
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    assert.ok(preset.catalog?.sourceUrl.startsWith('https://'));
    assert.equal(preset.catalog?.geometryEvidence?.kind, 'source-dimensions');
    assert.deepEqual(preset.catalog?.verifiedParameters, ['model']);
    for (const k of Object.keys(preset.catalog!.attributes!))
      assert.ok(
        part.catalogFilterFields!.some((f) => f.key === k),
        k,
      );
  }
});
test('unknown IDs, source dimension overrides and unknown states are rejected', () => {
  assert.ok(part.validate({ model: 'fake' }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, width: 100 }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'closed').length);
  assert.throws(() => selected({ model: 'fake' }));
});
test('every assembly and exploded pose has finite positive preview geometry and consistent dimensions', () => {
  for (const m of models)
    for (const state of ['assembled', 'exploded']) {
      const p = { model: m.id },
        g = part.buildGeometry(p, state);
      g.updateMatrixWorld(true);
      const b = new Box3().setFromObject(g, true),
        size = b.getSize(new Vector3()).toArray();
      assert.ok(
        size.every((v) => Number.isFinite(v) && v > 0),
        m.id,
      );
      assert.deepEqual(
        part.dimensions(p, state).map((v) => +v.toFixed(4)),
        size.map((v) => +v.toFixed(4)),
      );
      let triangles = 0;
      g.traverse((o) => {
        if (o instanceof Mesh) {
          const attr = o.geometry.getAttribute('position');
          triangles += attr.count / 3;
          assert.ok(Array.from(attr.array).every(Number.isFinite));
        }
      });
      assert.ok(triangles > 50, m.id);
      assert.equal(g.children.length, pieces(p, state).length);
      assert.equal(
        g.children.length,
        new Set(g.children.map((c) => c.name)).size,
        m.id + ' labels',
      );
    }
});
test('published banana and terminal envelopes are respected', () => {
  for (const m of models) {
    const dims = part.dimensions({ model: m.id }, 'assembled');
    for (const [key, index] of [
      ['bodyWidth', 0],
      ['bodyDepth', 1],
      ['length', 2],
    ] as const) {
      if (m.verified.includes(key))
        assert.ok(
          Math.abs(dims[index] - m[key]) < 0.012,
          `${m.id} ${key}: ${dims[index]} vs ${m[key]}`,
        );
    }
  }
});
test('banana and binding post female openings remain empty, with a visible contact rim', () => {
  for (const id of [
    'pomona-1325-2',
    'pomona-1330-2',
    'pomona-1581-2',
    'pomona-5935-0',
    'pomona-3760-2',
    'pomona-4243-0',
    'pomona-72913-2',
    'cliff-spt1',
    'cliff-spt2',
    'cliff-spt3',
  ]) {
    const m = models.find((m) => m.id === id)!,
      top = m.kind === 'banana-plug' ? m.length - m.pinLength! : m.front!;
    const x = m.poles === 2 ? -m.pitch! / 2 : 0;
    assert.equal(hits(id, [x, 0, top + 1], [0, 0, -1], 2).length, 0, id + ' open mouth');
    const rim = (m.bore! + 0.4) / 2;
    if (m.kind !== 'recessed-jack')
      assert.ok(hits(id, [x + rim, 0, top + 1], [0, 0, -1], 3).length > 0, id + ' contact rim');
  }
});
test('4 mm and 2 mm banana families remain distinct and double banana pitch is 19.05 mm', () => {
  assert.equal(selected({ model: 'pomona-5935-0' }).contactDiameter, 2);
  assert.equal(selected({ model: 'pomona-5936-2' }).contactDiameter, 2);
  for (const id of ['pomona-1330-2', 'pomona-4243-0']) {
    const m = selected({ model: id });
    assert.equal(m.pitch, 19.05);
    const p = pieces({ model: id }, 'assembled');
    assert.equal(p.filter((c) => /Banana contact|open banana socket/.test(c.label)).length, 2);
  }
});
test('speaker spring terminals preserve independently accessible contacts and actual mounting holes', () => {
  for (const id of ['cliff-fe6935', 'cliff-fe6930']) {
    const m = selected({ model: id }),
      count = m.poles;
    assert.equal(
      pieces({ model: id }, 'assembled').filter((c) => /Spring contact/.test(c.label)).length,
      count,
    );
    for (const sign of [-1, 1])
      assert.equal(
        hits(id, [(sign * m.mountPitch!) / 2, 0, 1], [0, 0, -1], 3, /moulded housing/).length,
        0,
        id + ' mounting ear hole',
      );
    assert.equal(m.mountHole, 2.5);
    assert.equal(m.pitch, 13);
  }
});
test('WAGO wire cavities open from the front and internal common bus is separate from the levers', () => {
  for (const id of ['wago-221-412', 'wago-221-413', 'wago-221-415']) {
    const m = selected({ model: id }),
      xs = Array.from({ length: m.poles }, (_, i) => (i - (m.poles - 1) / 2) * m.pitch!);
    for (const x of xs)
      assert.equal(
        hits(id, [x, -m.bodyDepth / 2 - 1, 2.65], [0, 1, 0], 3, /insulating shell/).length,
        0,
        id + ' wire entry',
      );
    const p = pieces({ model: id }, 'assembled');
    assert.equal(p.filter((c) => /Operating lever/.test(c.label)).length, m.poles);
    assert.equal(p.filter((c) => /Common bus/.test(c.label)).length, 1);
    assert.ok(
      !part.presets!.find((p) => p.id === id)!.catalog!.attributes!.terminalPitch,
      'unverified reconstructed pitch is not searchable source data',
    );
  }
});
test('pluggable screw terminals have the verified 5.08 mm pitch and female contact channels', () => {
  for (const id of ['phoenix-1757019', 'phoenix-1757022']) {
    const m = selected({ model: id }),
      p = pieces({ model: id }, 'assembled');
    assert.equal(m.pitch, 5.08);
    assert.equal(p.filter((c) => /Female mating contact/.test(c.label)).length, m.poles);
    for (let i = 0; i < m.poles; i++) {
      const x = (i - (m.poles - 1) / 2) * 5.08;
      assert.equal(
        hits(id, [x, m.bodyDepth / 2 + 1, 3.2], [0, -1, 0], 4, /Female mating contact/).length,
        0,
        id + ' female mating cavity',
      );
    }
  }
});
test('explosion moves existing solids rigidly without creating procurement components', () => {
  for (const m of models) {
    const a = pieces({ model: m.id }, 'assembled'),
      b = pieces({ model: m.id }, 'exploded');
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      assert.deepEqual(a[i].shape, b[i].shape);
      assert.equal(a[i].label, b[i].label);
      assert.ok(Number.isFinite(b[i].z));
    }
    const script = part.python({ model: m.id }, 'exploded');
    assert.ok(script.includes('component_labels'));
    assert.ok(script.includes('Part.makeCompound'));
  }
});
