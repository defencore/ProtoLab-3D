import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import axis, { ballScrewAxisLayout } from '../src/parts/ball-screw-axis/part';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';
import guide from '../src/parts/linear-guide/part';
import { withGeometryMode } from '../src/core/geometry-mode';

test('axis presets preserve their screw lead and keep table travel clear of the supports', () => {
  for (const preset of axis.presets) {
    assert.equal(
      preset.catalog,
      undefined,
      'A prototype assembly must not claim catalog verification.',
    );
    for (const position of [0, 50, 100]) {
      const p = { ...preset.parameters, position };
      assert.deepEqual(validateParameters(axis, p, 'assembled'), [], preset.id);
      const v = ballScrewAxisLayout(p);
      assert.ok(v.travel > 10);
      assert.ok(v.center - v.tableLength / 2 > v.v.start);
      assert.ok(v.center + v.tableLength / 2 < v.v.end);
      const carriageCenter =
        (Number(v.rail.position) / 100 - 0.5) *
        (Number(v.rail.length) - Number(v.rail.blockLength));
      assert.ok(Math.abs(carriageCenter - v.v.center) < 1e-8);
    }
  }
});

test('axis preview exports closed components and matches configured assembly bounds', () => {
  for (const preset of [axis.presets[0], axis.presets[2]]) {
    const model = axis.buildGeometry(preset.parameters, 'assembled');
    try {
      const dimensions = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      axis
        .dimensions(preset.parameters, 'assembled')
        .forEach((value, i) => assert.ok(Math.abs(value - dimensions[i]) < 0.01));
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const vertices = child.geometry.getAttribute('position'),
          index = child.geometry.index;
        const edges = new Map<string, number>();
        for (let i = 0; i < (index?.count ?? vertices.count); i += 3) {
          const keys = [0, 1, 2].map((offset) => {
            const j = index ? index.getX(i + offset) : i + offset;
            return [vertices.getX(j), vertices.getY(j), vertices.getZ(j)]
              .map((value) => Math.round(value * 1e4))
              .join(',');
          });
          for (let k = 0; k < 3; k++) {
            if (keys[k] === keys[(k + 1) % 3]) continue;
            const key = [keys[k], keys[(k + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.equal(
          [...edges.values()].filter((count) => count !== 2).length,
          0,
          `${preset.id}: ${child.name || child.parent?.name}`,
        );
      });
      assert.ok(model.getObjectByName('Moving mounting table'));
      assert.ok(model.getObjectByName('Fixed support bearing'));
      assert.ok(model.getObjectByName('Nut flange bolt 1'));
    } finally {
      disposeModel(model);
    }
  }
});

test('axis macros isolate sub-generators and expose independently movable components', () => {
  const script = generateScript(axis, axis.defaults, 'assembled');
  assert.match(script, /def axis_screw\(\):/);
  assert.match(script, /def axis_guide_left\(\):/);
  assert.match(script, /def axis_guide_right\(\):/);
  assert.match(script, /component_labels = axis_labels/);
  assert.match(script, /doc.addObject\("App::Part"/);
});

test(
  'complete axis macros retain supplier and manufactured metadata on every native child in both modes',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const cases = (['simple', 'full'] as const).flatMap((mode) =>
        axis.states!.map(({ id: state }) => ({
          mode,
          state,
          source: generateScript(axis, axis.defaults, state, undefined, undefined, mode),
        })),
      ),
      customCount = axis.composition!(axis.defaults).components.length - 3;
    const layout = ballScrewAxisLayout(axis.defaults);
    const guideSource = withGeometryMode('simple', () => guide.python(layout.rail, 'assembled'));
    const guideMetadata = JSON.parse(
      guideSource
        .split('\n')
        .find((line) => line.startsWith('component_metadata = '))!
        .slice('component_metadata = '.length),
    );
    const guideFeatures = JSON.parse(guideMetadata[1].ThreadFeaturesJSON);
    const expectedGuideFrames = [-1, 1].map((side) =>
      guideFeatures.map((feature: { origin: [number, number, number]; axis: number[] }) => ({
        origin: [
          feature.origin[0],
          feature.origin[1] + (side * layout.spacing) / 2,
          feature.origin[2] + layout.base,
        ],
        axis: feature.axis,
      })),
    );
    const code = `import FreeCAD as App, json
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
expected_guide_frames = json.loads(${JSON.stringify(JSON.stringify(expectedGuideFrames))})
custom_volumes = {}
for case in cases:
    doc = App.newDocument("AxisMetadataRegression")
    try:
        exec(compile(case["source"], "axis-metadata-regression", "exec"), {})
        assert len(doc.RootObjects) == 1
        root = doc.RootObjects[0]
        assert root.GeometryMode == case["mode"]
        assert root.ModelState == case["state"]
        children = root.Group
        libraries = [child.LibraryId for child in children]
        assert libraries.count("manufactured-detail") == ${customCount}, libraries
        assert libraries.count("ball-screw") > 1, libraries
        assert libraries.count("linear-guide") > 2, libraries
        threaded_guides = [child for child in children if child.LibraryId == 'linear-guide' and hasattr(child,'ThreadFeaturesJSON')]
        assert len(threaded_guides) == 2
        for child,expected_features in zip(threaded_guides,expected_guide_frames):
            features = json.loads(child.ThreadFeaturesJSON)
            assert len(features) == 4
            for actual,expected in zip(features,expected_features):
                assert (App.Vector(*actual['origin'])-App.Vector(*expected['origin'])).Length < 1e-8
                assert (App.Vector(*actual['axis'])-App.Vector(*expected['axis'])).Length < 1e-8
        custom_volumes[(case["state"], case["mode"])] = sum(child.Shape.Volume for child in children if child.LibraryId == "manufactured-detail")
        for child in children:
            assert child.Shape.isValid() and child.Shape.isClosed() and child.Shape.Volume > 0
            assert json.loads(child.ConfigurationJSON)
            assert child.Supply == ("manufactured" if child.LibraryId == "manufactured-detail" else "purchased")
    finally:
        App.closeDocument(doc.Name)
for state in set(case["state"] for case in cases):
    assert custom_volumes[(state, "full")] < custom_volumes[(state, "simple")], "Full must machine the declared custom-fastener threads."
print("PASS complete axis metadata in Simple and Full")
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS complete axis metadata/);
  },
);
