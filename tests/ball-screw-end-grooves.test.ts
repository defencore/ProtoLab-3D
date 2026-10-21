import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Mesh, Raycaster, Vector3 } from 'three';
import screw from '../src/parts/ball-screw/part';
import { ballScrewLayout } from '../src/parts/ball-screw/lib/parts/ball-screw-geometry';
import { withGeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';
import { matchingPresetId } from '../src/core/part-selection';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

const stock = screw.presets.find((preset) => preset.id === 'sfk0601-100')!;
const parameters = (extra: Parameters = {}): Parameters => ({
  ...stock.parameters,
  length: 85,
  endMachining: 'custom',
  driveJournalDiameter: 4,
  driveJournalLength: 8,
  fixedJournalDiameter: 4,
  fixedJournalLength: 12,
  supportJournalDiameter: 4,
  supportJournalLength: 6,
  fixedGrooveDiameter: 3.2,
  fixedGrooveWidth: 0.64,
  fixedGrooveOffset: 2.86,
  supportGrooveDiameter: 3.2,
  supportGrooveWidth: 0.64,
  supportGrooveOffset: 4.3,
  ...extra,
});
const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);

function assertClosed(mesh: Mesh) {
  const position = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index;
  const edges = new Map<string, number>();
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const keys = [0, 1, 2].map((offset) => {
      const j = index ? index.getX(i + offset) : i + offset;
      return [position.getX(j), position.getY(j), position.getZ(j)]
        .map((value) => Math.round(value * 1e5))
        .join(',');
    });
    for (let j = 0; j < 3; j++) {
      assert.notEqual(keys[j], keys[(j + 1) % 3], 'The journal has no collapsed triangle edge.');
      const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(
    [...edges.values()].every((count) => count === 2),
    'Every journal edge has two faces.',
  );
}

test('stock screw presets keep complete disabled retaining-groove definitions', () => {
  for (const preset of screw.presets) {
    for (const end of ['fixed', 'support']) {
      assert.equal(preset.parameters[end + 'GrooveDiameter'], 0, preset.id);
      assert.equal(preset.parameters[end + 'GrooveWidth'], 0.64, preset.id);
      assert.equal(preset.parameters[end + 'GrooveOffset'], 0, preset.id);
    }
    assert.deepEqual(validateParameters(screw, preset.parameters, 'screw'), [], preset.id);
  }
  const changed = parameters();
  assert.equal(matchingPresetId(screw, changed), 'custom');
  for (const key of [
    'fixedGrooveDiameter',
    'fixedGrooveWidth',
    'fixedGrooveOffset',
    'supportGrooveDiameter',
    'supportGrooveWidth',
    'supportGrooveOffset',
  ]) {
    const field = screw.parameters.find((candidate) => candidate.key === key)!;
    assert.equal(field.visibleWhen!(changed, 'nut'), false, key);
  }
});

test('disabled grooves preserve stock cylindrical geometry and native recipes in both detail modes', () => {
  const plain = parameters({ fixedGrooveDiameter: 0, supportGrooveDiameter: 0 });
  const unused = {
    ...plain,
    fixedGrooveWidth: 0.8,
    fixedGrooveOffset: 1,
    supportGrooveWidth: 1,
    supportGrooveOffset: 2,
  };
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      assert.equal(screw.python(plain, 'screw'), screw.python(unused, 'screw'));
      assert.doesNotMatch(
        screw.python(plain, 'screw'),
        /Custom (?:fixed|support) retaining-ring groove/,
      );
      const before = screw.buildGeometry(plain, 'screw'),
        after = screw.buildGeometry(unused, 'screw');
      try {
        assert.equal(before.children.length, after.children.length);
        for (let i = 0; i < before.children.length; i++) {
          const a = before.children[i] as Mesh,
            b = after.children[i] as Mesh;
          assert.deepEqual(
            a.geometry.getAttribute('position').array,
            b.geometry.getAttribute('position').array,
          );
          assert.deepEqual(a.position.toArray(), b.position.toArray());
        }
      } finally {
        disposeModel(before);
        disposeModel(after);
      }
    });
});

test('enabled journal grooves are closed physical recesses at the same shaft positions in Simple and Full', () => {
  const p = parameters(),
    v = ballScrewLayout(p);
  assert.deepEqual(validateParameters(screw, p, 'screw'), []);
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const model = screw.buildGeometry(p, 'screw');
      try {
        model.updateMatrixWorld(true);
        const journals = model.children.filter(
          (child): child is Mesh => child instanceof Mesh && child.name === 'Bearing journal',
        );
        assert.equal(journals.length, 2);
        journals.sort((a, b) => a.position.z - b.position.z);
        for (const [i, end] of ['fixed', 'support'].entries()) {
          const journal = journals[i],
            low = end === 'fixed' ? v.start - Number(p.fixedJournalLength) : v.end;
          const start = low + Number(p[end + 'GrooveOffset']),
            width = Number(p[end + 'GrooveWidth']);
          assertClosed(journal);
          const ray = new Raycaster(new Vector3(10, 0, start + width / 2), new Vector3(-1, 0, 0));
          near(ray.intersectObject(journal)[0].point.x, 1.6);
          const landRay = new Raycaster(new Vector3(10, 0, low + 0.5), new Vector3(-1, 0, 0));
          near(landRay.intersectObject(journal)[0].point.x, 2);
        }
        // With the MPR occurrence origin at Z54.5, these are the two actual metal groove intervals.
        near(v.start - Number(p.fixedJournalLength) + Number(p.fixedGrooveOffset) + 54.5, 22.86);
        near(v.end + Number(p.supportGrooveOffset) + 54.5, 95.3);
        const native = screw.python(p, 'screw');
        assert.match(native, /screw = screw\.cut\(annulus\(2\.1,1\.6,0\.64,-31\.64\)\)/);
        assert.match(native, /screw = screw\.cut\(annulus\(2\.1,1\.6,0\.64,40\.8\)\)/);
      } finally {
        disposeModel(model);
      }
    });
});

test('grooves at either journal boundary remain closed and invalid dimensions are rejected', () => {
  for (const changes of [
    { fixedGrooveOffset: 0 },
    { fixedGrooveOffset: 11.36 },
    { fixedGrooveOffset: 0, fixedGrooveWidth: 12 },
  ] as Parameters[]) {
    const p = parameters(changes),
      model = withGeometryMode('simple', () => screw.buildGeometry(p, 'screw'));
    try {
      assert.deepEqual(validateParameters(screw, p, 'screw'), []);
      model.children
        .filter((child): child is Mesh => child instanceof Mesh && child.name === 'Bearing journal')
        .forEach(assertClosed);
    } finally {
      disposeModel(model);
    }
  }
  for (const changes of [
    { fixedGrooveDiameter: 4 },
    { supportGrooveDiameter: 4.1 },
    { fixedGrooveWidth: 0 },
    { fixedGrooveOffset: -0.01 },
    { supportGrooveOffset: 5.5 },
    { fixedGrooveDiameter: Number.NaN },
    { supportGrooveWidth: Number.POSITIVE_INFINITY },
    { endMachining: 'none' },
  ] as Parameters[])
    assert.ok(
      validateParameters(screw, parameters(changes), 'screw').length > 0,
      JSON.stringify(changes),
    );
});

test(
  'native journal grooves remove the specified annular metal volume without splitting the shaft',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const p = parameters(),
      plain = { ...p, fixedGrooveDiameter: 0, supportGrooveDiameter: 0 };
    const cases = (['simple', 'full'] as const).map((mode) => ({
      mode,
      source: withGeometryMode(mode, () => screw.python(p, 'screw')),
      plain: withGeometryMode(mode, () => screw.python(plain, 'screw')),
    }));
    const code = `import FreeCAD as App, Part, math, json
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
for case in cases:
    volumes=[]
    for source in [case['plain'],case['source']]:
        scope={'App':App,'Part':Part,'math':math}
        exec(compile(source,'journal-grooves','exec'),scope)
        shape=scope['shape']
        assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1
        volumes.append(shape.Volume)
    expected=2*math.pi*(2**2-1.6**2)*0.64
    assert abs(volumes[0]-volumes[1]-expected)<1e-6,(case['mode'],volumes,expected)
print('PASS native journal retaining grooves')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS native journal retaining grooves/);
  },
);
