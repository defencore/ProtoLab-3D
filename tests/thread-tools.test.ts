import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/thread-tool/part';
import { values, radiusAt } from '../src/parts/thread-tool/lib/thread';
import { updateParameters } from '../src/parts/thread-tool/configurator';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';
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
    const keys = indices
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

for (const preset of part.presets)
  for (const state of part.states!)
    test(`${preset.id}/${state.id}: valid closed Boolean tool`, () => {
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
      const model = part.buildGeometry(preset.parameters, state.id);
      try {
        assert.equal(model.children.length, 1);
        model.traverse((o) => {
          if (o instanceof Mesh) checkMesh(o, o.name);
        });
        const bounds = new Box3().setFromObject(model, true);
        const expected = part.dimensions(preset.parameters, state.id);
        bounds
          .getSize(new Vector3())
          .toArray()
          .forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 0.03));
        assert.equal(bounds.min.z, 0);
      } finally {
        disposeModel(model);
      }
    });
test('3/8-24 UNF preserves exact inch conversion in preview and macro', () => {
  const p = part.presets.find(
    (p) => p.parameters.family === 'unf' && p.parameters.diameter === 9.525,
  )!.parameters;
  assert.equal(p.tpi, 24);
  assert.equal(values(p, 'external').pitch, 25.4 / 24);
  assert.ok(generateScript(part, p, 'external').includes(`thread_pitch = ${25.4 / 24}`));
  assert.equal(part.presets.length, 79);
  assert.ok(part.presets.some((p) => p.parameters.diameter === 1 && p.parameters.pitch === 0.25));
  assert.ok(part.presets.some((p) => p.parameters.diameter === 2 && p.parameters.pitch === 0.4));
});
test('handedness, axial pitch and multi-start lead are consistent', () => {
  for (const state of ['external', 'internal'])
    for (const starts of [1, 2, 4]) {
      const p = { ...part.defaults, starts };
      const left = { ...p, handedness: 'left' };
      for (const angle of [0.37, 1.21, 2.68]) {
        const r = radiusAt(p, state, 0.43, angle);
        assert.ok(Math.abs(r - radiusAt(left, state, 0.43, -angle)) < 1e-12);
        assert.ok(Math.abs(r - radiusAt(p, state, 1.43, angle)) < 1e-12);
        assert.ok(Math.abs(r - radiusAt(p, state, 0.43, angle + (2 * Math.PI) / starts)) < 1e-12);
        assert.ok(
          Math.abs(r - radiusAt(p, state, 0.43 + starts * 0.2, angle + 2 * Math.PI * 0.2)) < 1e-12,
        );
      }
    }
});
test('internal cutter contains external thread; allowance is applied per radius', () => {
  for (let i = 0; i < 100; i++) {
    const angle = i * 0.1,
      z = i * 0.173;
    const external = radiusAt(part.defaults, 'external', z, angle);
    const internal = radiusAt(part.defaults, 'internal', z, angle);
    assert.ok(internal >= external - 1e-12);
    assert.ok(
      Math.abs(
        radiusAt({ ...part.defaults, clearance: 0.1 }, 'internal', z, angle) - internal - 0.1,
      ) < 1e-12,
    );
    assert.ok(
      Math.abs(
        radiusAt({ ...part.defaults, clearance: 0.1 }, 'external', z, angle) - external + 0.1,
      ) < 1e-12,
    );
  }
});
test('invalid cores, overlapping flanks and unsupported workloads cannot export', () => {
  for (const change of [
    { diameter: 0.5, pitch: 2 },
    { starts: 1.5 },
    { starts: 5 },
    { length: 0.1 },
    { length: 81 },
    { pitch: NaN },
    { family: 'custom', angle: 90, depth: 1 },
    { clearance: 3 },
  ] as Parameters[]) {
    const p = { ...part.defaults, ...change };
    assert.ok(validateParameters(part, p, 'external').length, JSON.stringify(change));
    assert.throws(() => generateScript(part, p, 'external'));
  }
});
test('switching pitch units preserves physical geometry', () => {
  const tpi = updateParameters({ ...part.defaults, pitch: 0.8, pitchUnit: 'tpi' }, 'pitchUnit');
  assert.equal(tpi.tpi, 31.749999999999996);
  const mm = updateParameters({ ...tpi, pitchUnit: 'mm' }, 'pitchUnit');
  assert.ok(Math.abs(Number(mm.pitch) - 0.8) < 1e-12);
  const custom = updateParameters({ ...tpi, tpi: 24 }, 'tpi');
  assert.equal(custom.pitch, 25.4 / 24);
});

for (const form of ['tool', 'round-cap', 'hex-cap'])
  for (const state of ['external', 'internal'])
    for (const boreEnabled of [false, true])
      test(`${form}/${state}/hole=${boreEnabled}: closed material boundary and actual cap envelope`, () => {
        const p = { ...part.defaults, form, boreEnabled, length: 4 };
        assert.deepEqual(validateParameters(part, p, state), []);
        const model = part.buildGeometry(p, state);
        try {
          model.traverse((o) => {
            if (o instanceof Mesh) checkMesh(o, `${form}/${state}`);
          });
          const bounds = new Box3().setFromObject(model, true);
          bounds
            .getSize(new Vector3())
            .toArray()
            .forEach((n, i) => assert.ok(Math.abs(n - part.dimensions(p, state)[i]) < 0.03));
          assert.equal(bounds.min.z, 0);
          const mesh = model.children[0] as Mesh;
          const positions = mesh.geometry.getAttribute('position');
          let minRadius = Infinity;
          for (let i = 0; i < positions.count; i++)
            minRadius = Math.min(minRadius, Math.hypot(positions.getX(i), positions.getY(i)));
          assert.ok(Math.abs(minRadius - (boreEnabled ? 1 : 0)) < 1e-6);
        } finally {
          disposeModel(model);
        }
      });

test('holes cannot break through thread roots and cap walls cannot vanish', () => {
  for (const state of ['external', 'internal'])
    for (const delta of [
      { boreEnabled: true, boreDiameter: 5 },
      { form: 'round-cap', capSize: 6 },
      { form: 'hex-cap', capSize: 6.2 },
      { form: 'round-cap', capThickness: 0 },
      { form: 'hex-cap', clearance: 0.2, capSize: 6.3 },
    ] as Parameters[]) {
      const p = { ...part.defaults, ...delta };
      // External fit adjustment shrinks a plug; the same cap remains thick enough there.
      if (state === 'external' && delta.clearance) continue;
      assert.ok(validateParameters(part, p, state).length, JSON.stringify({ state, delta }));
      assert.throws(() => generateScript(part, p, state));
    }
});

test(
  'native caps and hollow tools preserve cavities, roofs, holes and preview volume',
  { skip: !process.env.FREECAD_PYTHON, timeout: 180_000 },
  async () => {
    const { spawnSync } = await import('node:child_process');
    const cases = [];
    for (const form of ['tool', 'round-cap', 'hex-cap'])
      for (const state of ['external', 'internal'])
        for (const boreEnabled of [false, true]) {
          const p = { ...part.defaults, form, boreEnabled, length: 4 };
          const model = part.buildGeometry(p, state);
          let volume = 0;
          model.traverse((o) => {
            if (!(o instanceof Mesh)) return;
            const g = o.geometry,
              a = g.getAttribute('position'),
              ix = g.index;
            for (let i = 0; i < (ix?.count ?? a.count); i += 3) {
              const [x, y, z] = [0, 1, 2].map((j) =>
                new Vector3().fromBufferAttribute(a, ix ? ix.getX(i + j) : i + j),
              );
              volume += x.dot(y.cross(z)) / 6;
            }
          });
          disposeModel(model);
          cases.push({
            form,
            state,
            hole: boreEnabled,
            code: part.python(p, state),
            volume,
            dimensions: part.dimensions(p, state),
          });
        }
    const result = spawnSync(
      process.env.FREECAD_PYTHON!,
      [
        '-c',
        `
import FreeCAD as App, Part, math, json, sys
for c in json.load(sys.stdin):
    e=dict(App=App, Part=Part, math=math)
    exec(c['code'],e)
    s=e['shape']; tag=(c['form'],c['state'],c['hole'])
    assert s.isValid() and s.isClosed() and len(s.Solids)==1,tag
    assert abs(s.Volume/c['volume']-1)<.015,(tag,s.Volume,c['volume'])
    b=s.optimalBoundingBox(False,False)
    assert all(abs(a-v)<.03 for a,v in zip([b.XLength,b.YLength,b.ZLength],c['dimensions'])),(tag,[b.XLength,b.YLength,b.ZLength],c['dimensions'])
    inside=lambda x,z: s.isInside(App.Vector(x,0,z),1e-7,False)
    cap=c['form']!='tool'
    assert inside(0,2)==(not c['hole'] and not(cap and c['state']=='internal')),tag
    if cap:
        assert inside(0,5)==(not c['hole']),tag
        assert inside(2,5),tag
        assert inside(4,2)==(c['state']=='internal'),tag
    if c['hole']:
        assert s.common(Part.makeCylinder(.95,c['dimensions'][2]+2,App.Vector(0,0,-1))).Volume<1e-8,tag
    print(tag,'valid',flush=True)
`,
      ],
      { input: JSON.stringify(cases), encoding: 'utf8', timeout: 170_000 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr + String(result.error ?? ''));
  },
);
