import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Box3, Mesh, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/bevel-gearbox-42/part';
import housing from '../src/parts/bevel-gearbox-42/lib/housing.json';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';

function signature(model: ReturnType<typeof part.buildGeometry>, prefix: string) {
  const values: number[] = [];
  model.children
    .filter((c) => c.name.startsWith(prefix))
    .forEach((c) =>
      c.traverse((o) => {
        if (o instanceof Mesh) values.push(...o.geometry.getAttribute('position').array);
      }),
    );
  return values.join(',');
}
test('42 mm gearbox has every photographed bore family and an actual bearing / two rings per gear', () => {
  assert.equal(part.presets.length, 16);
  const signatures = new Set<string>();
  for (const preset of part.presets) {
    const p = { ...part.defaults, ...preset.parameters };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    const model = part.buildGeometry(p, 'assembled');
    try {
      const count = p.layout === 'three' ? 3 : 2;
      assert.equal(model.children.length, count * 4 + 1);
      for (const label of ['Spiral bevel gear', '61802', 'DIN 471', 'DIN 472'])
        assert.equal(model.children.filter((c) => c.name.includes(label)).length, count);
      const size = new Box3().setFromObject(model, true).getSize(new Vector3());
      for (const v of size.toArray()) assert.ok(Math.abs(v - 42) < 1e-5);
      if (p.layout === 'three') signatures.add(signature(model, 'Input X · Spiral'));
      for (const key of ['bore', 'socket'])
        assert.ok(preset.catalog!.verifiedParameters.includes(key));
      assert.match(preset.catalog!.geometryEvidence!.limitations, /reconstruction/);
    } finally {
      disposeModel(model);
    }
  }
  assert.equal(signatures.size, 8, 'All eight shaft interfaces must change the actual gear mesh');
});
test('inspection and explosion preserve individually selectable components; housing controls are hidden', () => {
  for (const [state, count] of [
    ['internals', 12],
    ['exploded', 13],
    ['housing', 1],
  ] as const) {
    const model = part.buildGeometry(part.defaults, state);
    try {
      assert.equal(model.children.length, count);
      if (state === 'exploded') assert.ok(new Box3().setFromObject(model).max.x > 60);
    } finally {
      disposeModel(model);
    }
  }
  for (const field of part.parameters)
    assert.equal(field.visibleWhen?.(part.defaults, 'housing'), false);
  assert.match(generateScript(part, part.defaults, 'housing'), /importBrepFromString/);
});
test('source housing provenance and explicit seat changes remain reproducible without reference archives', () => {
  assert.equal(
    housing.sourceSha256,
    '637fece0c52e1be47b4ecefd9fabba58f63bc605b664d333befdfa44a35099f9',
  );
  assert.equal(housing.retainedSolid, 0);
  assert.deepEqual(
    housing.bounds.map((v) => Math.round(v)),
    [-21, -21, -21, 21, 21, 21],
  );
  assert.ok(housing.volume < housing.originalVolume);
  assert.ok(housing.modifications.some((s) => s.includes('Ø24')));
  assert.ok(housing.modifications.some((s) => s.includes('Ø25.2')));
});
test('rotation and tooth sweep affect gears while the housing remains fixed', () => {
  const base = part.buildGeometry(part.defaults, 'assembled');
  try {
    for (const patch of [{ inputAngle: 37 }, { sweep: 0 }] as Parameters[]) {
      const changed = part.buildGeometry({ ...part.defaults, ...patch }, 'assembled');
      try {
        assert.notEqual(
          signature(base, 'Input X · Spiral'),
          signature(changed, 'Input X · Spiral'),
        );
        assert.equal(signature(base, '42 mm housing'), signature(changed, '42 mm housing'));
      } finally {
        disposeModel(changed);
      }
    }
  } finally {
    disposeModel(base);
  }
  for (const patch of [
    { bore: '9' },
    { socket: 'unknown' },
    { layout: 'unknown' },
    { inputAngle: 361 },
    { sweep: 9 },
    { sweep: 12 },
  ] as Parameters[])
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length);
  assert.throws(() => generateScript(part, { ...part.defaults, sweep: 12 }, 'assembled'));
});

test('every gearbox state pairs its physical pieces with matching metadata, including the source housing', () => {
  for (const mode of ['simple', 'full'] as const)
    for (const layout of ['two', 'three'])
      for (const state of ['assembled', 'internals', 'exploded', 'housing'])
        for (const patch of [{}, { inputAngle: 360 }, { sweep: 0 }] as Parameters[]) {
          const p = { ...part.defaults, ...patch, layout };
          const code = withGeometryMode(mode, () => part.python(p, state));
          const assignment = code
            .split('\n')
            .find((line) => line.startsWith('component_metadata = '));
          assert.ok(assignment, `${mode}/${layout}/${state} must initialize its metadata`);
          const records: Record<string, string>[] = JSON.parse(
            assignment.slice('component_metadata = '.length),
          );
          const append = code
            .split('\n')
            .find((line) => line.startsWith('component_metadata.append('));
          if (append)
            records.push(JSON.parse(append.slice('component_metadata.append('.length, -1)));
          const internalCount = (layout === 'three' ? 3 : 2) * 4;
          const expectedCount =
            state === 'housing' ? 1 : internalCount + (state === 'internals' ? 0 : 1);
          assert.equal(records.length, expectedCount, `${mode}/${layout}/${state}`);
          const imported = records.filter((record) => record.SourceSHA256);
          assert.equal(imported.length, state === 'internals' ? 0 : 1);
          if (imported.length) {
            assert.equal(imported[0].SourceGeometry, housing.sourceName);
            assert.equal(imported[0].SourceSHA256, housing.sourceSha256);
            assert.deepEqual(
              JSON.parse(imported[0].SourceModificationsJSON),
              housing.modifications,
            );
          }
        }
});

test(
  'complete Simple and Full gearbox macros preserve exact component counts and source-housing provenance',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    const cases = (['simple', 'full'] as const).flatMap((mode) =>
      [
        ...part.states!.map(({ id: state }) => ({ state, layout: 'three' })),
        { state: 'assembled', layout: 'two' },
      ].map(({ state, layout }) => ({
        mode,
        state,
        layout,
        source: generateScript(
          part,
          { ...part.defaults, layout },
          state,
          undefined,
          undefined,
          mode,
        ),
      })),
    );
    const code = `import FreeCAD as App, json, math
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
expected_modifications = json.loads(${JSON.stringify(JSON.stringify(housing.modifications))})
for case in cases:
    doc = App.newDocument("BevelGearboxMetadataRegression")
    try:
        exec(compile(case["source"], "bevel-gearbox-metadata-regression", "exec"), {})
        assert len(doc.RootObjects) == 1
        root = doc.RootObjects[0]
        assert root.GeometryMode == case["mode"]
        assert root.ModelState == case["state"]
        components = root.Group if root.TypeId == 'App::Part' else [root]
        internal_count = (3 if case['layout'] == 'three' else 2)*4
        expected_count = 1 if case['state'] == 'housing' else internal_count+(0 if case['state'] == 'internals' else 1)
        assert len(components) == expected_count, (case, len(components))
        for component in components:
            assert component.Shape.isValid() and component.Shape.isClosed()
            assert component.Shape.Solids and component.Shape.Volume > 0
        imported = [component for component in components if hasattr(component,'SourceSHA256')]
        assert len(imported) == (0 if case['state'] == 'internals' else 1)
        if imported:
            source = imported[0]
            assert source.SourceGeometry == ${JSON.stringify(housing.sourceName)}
            assert source.SourceSHA256 == ${JSON.stringify(housing.sourceSha256)}
            assert json.loads(source.SourceModificationsJSON) == expected_modifications
            assert abs(source.Shape.Volume-${housing.volume}) < 1e-6
        if root.TypeId == 'App::Part':
            for label in ['Spiral bevel gear','61802','DIN 471','DIN 472']:
                assert sum(label in component.Label for component in components) == internal_count//4
    finally:
        App.closeDocument(doc.Name)
print('PASS complete gearbox metadata in Simple and Full')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS complete gearbox metadata/);
  },
);
