import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/clamp-band-release/part';
import { pieces, motion } from '../src/parts/clamp-band-release/lib/model';
import { disposeModel } from '../src/core/mechanical';

test('all clamp concepts produce finite, independently named components in every inspection state', () => {
  for (const preset of part.presets)
    for (const state of part.states!) {
      assert.deepEqual(part.validate(preset.parameters, state.id), []);
      const model = part.buildGeometry(preset.parameters, state.id);
      try {
        assert.equal(model.children.length, pieces(preset.parameters, state.id).length);
        assert.equal(new Set(model.children.map((o) => o.name)).size, model.children.length);
        model.traverse((o) => {
          if (o instanceof Mesh)
            for (const v of o.geometry.getAttribute('position').array)
              assert.ok(Number.isFinite(v));
        });
        const b = new Box3().setFromObject(model);
        assert.ok(b.min.z < b.max.z && b.min.x < b.max.x);
      } finally {
        disposeModel(model);
      }
    }
});

test('release completes unclamping before upper flange moves', () => {
  for (const q of [0, 20, 55])
    assert.equal(motion({ ...part.defaults, release: q }, 'assembled').lift, 0);
  assert.equal(motion({ ...part.defaults, release: 55 }, 'assembled').opening, 1);
  assert.equal(motion(part.defaults, 'released').lift, part.defaults.separation);
  assert.ok(motion({ ...part.defaults, release: 70 }, 'assembled').lift > 0);
});

test('V-band leaves the central bore open and separated upper interface clears the band', () => {
  const p = { ...part.defaults, springs: false };
  const model = part.buildGeometry(p, 'released');
  try {
    model.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0, 0, -100), new Vector3(0, 0, 1), 0, 200);
    assert.equal(ray.intersectObject(model, true).length, 0);
    const upper = model.children.find((o) => o.name.startsWith('CB-02'))!;
    const upperBox = new Box3().setFromObject(upper);
    for (const o of model.children.filter(
      (o) => o.name.startsWith('CB-03') || o.name.startsWith('CB-04'),
    )) {
      assert.ok(new Box3().setFromObject(o).max.z < upperBox.min.z);
    }
  } finally {
    disposeModel(model);
  }
});

test('invalid interface walls, segment counts, states and non-finite inputs are rejected', () => {
  for (const values of [
    { bore: 89 },
    { segments: 15 },
    { diameter: NaN },
    { layout: 'other' },
  ] as Parameters[])
    assert.ok(part.validate({ ...part.defaults, ...values }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'unknown').length);
});

test('latch clears before either type of clamp moves', () => {
  for (const layout of ['band', 'pivot']) {
    const latchEnd = layout === 'band' ? 15 : 25;
    assert.equal(motion({ ...part.defaults, layout, release: latchEnd }, 'assembled').pin, 1);
    assert.equal(motion({ ...part.defaults, layout, release: latchEnd }, 'assembled').opening, 0);
    assert.ok(motion({ ...part.defaults, layout, release: latchEnd + 1 }, 'assembled').opening > 0);
  }
});

test('springs stay between their seat faces and cannot overtravel the captive stop', () => {
  for (const preset of part.presets)
    for (const release of [0, 25, 55, 70, 100]) {
      const p: Parameters = { ...preset.parameters, release };
      const k = +p.diameter / 90;
      const list = pieces(p, 'assembled');
      const coils = list.filter(
        (piece) => piece.label.startsWith('Spring ') && piece.shape.kind === 'spring',
      );
      assert.equal(coils.length, 6);
      for (const coil of coils) {
        if (coil.shape.kind !== 'spring') throw new Error('Expected coil');
        const bottom = coil.position![2] - coil.shape.wire;
        const top = coil.position![2] + coil.shape.height + coil.shape.wire;
        const floor = -(p.layout === 'pivot' ? 28.5 : 16.5) * k;
        const ceiling = 6.5 * k + Math.min(motion(p, 'assembled').lift, 8 * k);
        assert.ok(bottom >= floor - 1e-8);
        assert.ok(top <= ceiling + 1e-8);
        assert.ok(top <= 14.5 * k + 1e-8);
        assert.ok(coil.shape.radius + coil.shape.wire < 3.1 * k);
        assert.ok(coil.shape.radius - coil.shape.wire > 1.2 * k);
      }
    }
});

test(
  'native solids have no interpenetrations at latch, opening and separation checkpoints',
  { skip: !process.env.FREECAD_PYTHON, timeout: 900_000 },
  async () => {
    const { spawnSync } = await import('node:child_process');
    const jobs = [];
    for (const layout of ['band', 'pivot'])
      for (const release of [0, 15, 25, 35, 40, 55, 70, 100])
        jobs.push({
          id: `${layout}/${release}`,
          code: part.python({ ...part.defaults, layout, release }, 'assembled'),
        });
    for (const preset of part.presets.filter((p) => p.id === 'band-160'))
      jobs.push({ id: preset.id, code: part.python(preset.parameters, 'assembled') });
    for (const segments of [12, 24])
      jobs.push({
        id: `pivot/segments-${segments}`,
        code: part.python(
          { ...part.defaults, layout: 'pivot', segments, release: 55 },
          'assembled',
        ),
      });
    const script = `
import FreeCAD as App, Part, math, json, sys
jobs=json.loads(sys.stdin.read())
for job in jobs:
    env=dict(App=App,Part=Part,math=math)
    exec(job['code'],env)
    shapes=env['components']; labels=env['component_labels']
    for i,a in enumerate(shapes):
        assert a.isValid() and len(a.Solids)==1, (job['id'],labels[i],'invalid or disconnected component')
        for j in range(i+1,len(shapes)):
            b=shapes[j]; aa=a.BoundBox; bb=b.BoundBox
            if any(min(getattr(aa,d+'Max'),getattr(bb,d+'Max'))-max(getattr(aa,d+'Min'),getattr(bb,d+'Min')) < 1e-6 for d in 'XYZ'): continue
            overlap=a.common(b).Volume
            assert overlap<1e-3,(job['id'],labels[i],labels[j],overlap)
    print(job['id']+': clear',flush=True)
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-c', script], {
      input: JSON.stringify(jobs),
      encoding: 'utf8',
      timeout: 890_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(
      result.status,
      0,
      result.stdout + '\n' + result.stderr + '\n' + String(result.error ?? ''),
    );
  },
);
