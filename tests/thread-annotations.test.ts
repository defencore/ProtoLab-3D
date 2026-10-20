import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Euler, Matrix4, Vector3 } from 'three';
import { componentPython } from '../src/core/assembly/detail-instances';
import { boundaryThreadCallouts } from '../src/core/assembly/boundary/shapes';
import { parseDetailRecipe } from '../src/core/component-recipes';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';
import type { AssemblyComponent } from '../src/core/product-types';
import guide from '../src/parts/linear-guide/part';
import compact from '../src/parts/compact-pneumatic-cylinder/part';
import axis, { ballScrewAxisLayout } from '../src/parts/ball-screw-axis/part';
import { cylinderPieces, cylinderSpec } from '../src/parts/compact-pneumatic-cylinder/lib/model';

function metadata(source: string): Record<string, string>[] {
  const line = source.split('\n').find((item) => item.startsWith('component_metadata = '));
  assert.ok(line);
  return JSON.parse(line.slice('component_metadata = '.length));
}

test('all guide inspection states retain the four declared female mounting thread callouts in either mode', () => {
  for (const mode of ['simple', 'full'] as const)
    for (const state of ['rail', 'carriage', 'assembled', 'cutaway'])
      withGeometryMode(mode, () => {
        const source = guide.python(guide.defaults, state);
        const records = metadata(source);
        const features = records.flatMap((record) => JSON.parse(record.ThreadFeaturesJSON ?? '[]'));
        assert.equal(features.length, state === 'rail' ? 0 : 4);
        for (const feature of features) {
          assert.equal(feature.internal, true);
          assert.equal(feature.nominalDiameter, guide.defaults.blockHole);
          assert.equal(feature.length, guide.defaults.holeDepth);
          assert.equal(
            feature.representation,
            mode === 'simple' ? 'nominal-cylinder' : 'machined-helix',
          );
          assert.deepEqual(feature.axis, [0, 0, 1]);
        }
        if (state !== 'rail')
          assert.match(records[state === 'carriage' ? 0 : 1].ThreadCallouts, /4× internal M/);
      });
});

test('compact cylinder uses declared female metric major diameters and annotates each approximate G port once', () => {
  for (const bore of ['32', '50'])
    for (const mode of ['simple', 'full'] as const)
      withGeometryMode(mode, () => {
        const p = { ...compact.defaults, bore };
        const spec = cylinderSpec(p);
        const pieces = cylinderPieces(p);
        const rod = pieces.at(-1)!.shape;
        assert.equal(rod.kind, 'subtract');
        if (rod.kind !== 'subtract') throw new Error('Missing rod socket.');
        const socket = rod.children[1];
        assert.equal(socket.kind, 'cylinder');
        if (socket.kind !== 'cylinder') throw new Error('Missing rod socket cylinder.');
        assert.equal(socket.radius, bore === '50' ? 5 : 4);
        assert.notEqual(
          socket.radius,
          spec.tapRadius,
          'tap-drill radius is not the native nominal major radius',
        );
        assert.equal(socket.thread?.internal, true);
        const records = metadata(compact.python(p, 'default'));
        assert.equal(records.length, pieces.length);
        const features = records.flatMap((record) => JSON.parse(record.ThreadFeaturesJSON ?? '[]'));
        assert.equal(features.length, 3, 'two physical ports and one rod socket');
        const ports = features.filter((feature) => feature.designation.startsWith('G1/8'));
        assert.equal(ports.length, 2);
        assert.ok(
          ports.every((feature) => feature.designation.includes('approximate port profile')),
        );
        const metric = features.find((feature) => feature.designation.startsWith('M'));
        assert.equal(metric.nominalDiameter, bore === '50' ? 10 : 8);
        assert.equal(metric.pitch, bore === '50' ? 1.5 : 1.25);
        assert.equal(metric.length, spec.tapDepth);
        assert.equal(metric.internal, true);
      });
});

test('configured recipes preserve explicit source callouts and validate duplicate-cutter annotation policy', () => {
  const shape = {
    kind: 'cylinder',
    radius: 4.25,
    height: 9,
    origin: [0, 0, 0],
    axis: 'x',
    thread: { pitch: 0.907, internal: true, designation: 'G1/8 RH (approximate port profile)' },
  };
  const restored = parseDetailRecipe(JSON.stringify(shape));
  assert.equal(boundaryThreadCallouts(restored)[0].designation, shape.thread.designation);
  assert.equal(
    boundaryThreadCallouts(
      parseDetailRecipe(JSON.stringify({ ...shape, thread: { ...shape.thread, callout: false } })),
    ).length,
    0,
  );
  for (const invalid of [true, '', 'x'.repeat(513)])
    assert.throws(() =>
      parseDetailRecipe(
        JSON.stringify({ ...shape, thread: { ...shape.thread, designation: invalid } }),
      ),
    );
  assert.throws(() =>
    parseDetailRecipe(JSON.stringify({ ...shape, thread: { ...shape.thread, callout: 'no' } })),
  );
});

test(
  'native compound occurrences retain child identities, transform thread frames, and reject mismatched records',
  { skip: !process.env.FREECAD_PYTHON, timeout: 120000 },
  () => {
    const configured: AssemblyComponent = {
      id: 'guide',
      name: 'Installed guide',
      libraryId: guide.id,
      parameters: { ...guide.defaults },
      state: 'assembled',
      quantity: 1,
      supply: 'purchased',
      placement: { translation: [30, 40, 50], rotation: [90, 0, 90] },
    };
    const original = withGeometryMode('simple', () =>
      metadata(guide.python(guide.defaults, 'assembled')),
    );
    const originalFeatures = JSON.parse(original[1].ThreadFeaturesJSON);
    const frame = new Matrix4()
      .makeRotationZ(Math.PI / 2)
      .setPosition(7, 8, 9)
      .multiply(
        new Matrix4()
          .makeRotationFromEuler(new Euler(Math.PI / 2, 0, Math.PI / 2, 'ZYX'))
          .setPosition(30, 40, 50),
      );
    const expected = originalFeatures.map(
      (feature: { origin: [number, number, number]; axis: [number, number, number] }) => ({
        origin: new Vector3(...feature.origin).applyMatrix4(frame).toArray(),
        axis: new Vector3(...feature.axis).transformDirection(frame).toArray(),
      }),
    );
    const sources = ['simple', 'full'].map((mode) =>
      withGeometryMode(mode as 'simple' | 'full', () =>
        componentPython(
          [guide],
          [
            {
              component: configured,
              label: 'Installed guide',
              color: 0xaaaaaa,
              angle: 90,
              position: [7, 8, 9],
            },
          ],
        ),
      ),
    );
    const code = `import FreeCAD as App, Part, math, json
expected = json.loads(${JSON.stringify(JSON.stringify(expected))})
for mode,source in zip(['simple','full'], json.loads(${JSON.stringify(JSON.stringify(sources))})):
 scope = {'App':App,'Part':Part,'math':math}
 exec(source,scope)
 shape = scope['shape']
 assert shape.isValid() and shape.isClosed() and shape.Volume > 0
 assert len(shape.childShapes()) == 1, 'a configured supplier occurrence remains one physical assembly'
 record = scope['component_metadata'][0]
 assert record['LibraryId'] == 'linear-guide' and record['Supply'] == 'purchased'
 children = json.loads(record['LibraryComponentMetadataJSON'])
 assert len(children) == len(shape.childShapes()[0].childShapes())
 assert children[0]['label'] == 'Guide rail' and children[1]['label'] == 'Carriage'
 assert children[0]['index'] == 1 and children[1]['index'] == 2
 features = json.loads(record['ThreadFeaturesJSON'])
 assert len(features) == 4 and all(feature['componentIndex'] == 2 and feature['componentLabel'] == 'Carriage' for feature in features)
 assert features == [dict(feature,componentIndex=2,componentLabel='Carriage') for feature in json.loads(children[1]['metadata']['ThreadFeaturesJSON'])]
 for actual,wanted in zip(features,expected):
  assert (App.Vector(*actual['origin'])-App.Vector(*wanted['origin'])).Length < 1e-8
  assert (App.Vector(*actual['axis'])-App.Vector(*wanted['axis'])).Length < 1e-8
  assert actual['representation'] == ('nominal-cylinder' if mode == 'simple' else 'machined-helix')
 assert '4× internal M' in record['ThreadCallouts']
 try:
  scope['_pl_component']("shape=Part.makeCompound([Part.makeBox(1,1,1),Part.makeBox(1,1,1,App.Vector(2,0,0))]); component_metadata=[{},{},{}]")
  raise AssertionError('mismatched nested records accepted')
 except ValueError as error:
  assert 'records do not match' in str(error)
print('COMPOUND_THREAD_METADATA_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 110000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /COMPOUND_THREAD_METADATA_OK/);
  },
);

test(
  'native axis Simple thread coordinates coincide with its installed guide bores',
  { skip: !process.env.FREECAD_PYTHON, timeout: 120000 },
  () => {
    const layout = ballScrewAxisLayout(axis.defaults);
    const local = withGeometryMode('simple', () =>
      metadata(guide.python(layout.rail, 'assembled')),
    );
    const features = JSON.parse(local[1].ThreadFeaturesJSON);
    const expected = [-1, 1].map((side) =>
      features.map((feature: { origin: [number, number, number]; axis: number[] }) => ({
        origin: [
          feature.origin[0],
          feature.origin[1] + (side * layout.spacing) / 2,
          feature.origin[2] + layout.base,
        ],
        axis: feature.axis,
      })),
    );
    const code = `import FreeCAD as App, Part, json
doc = App.newDocument('AxisThreadFrames')
exec(${JSON.stringify(generateScript(axis, axis.defaults, 'assembled', undefined, undefined, 'simple'))},{})
root = doc.RootObjects[0]
guides = [child for child in root.Group if child.LibraryId == 'linear-guide' and hasattr(child,'ThreadFeaturesJSON')]
assert len(guides) == 2
expected = json.loads(${JSON.stringify(JSON.stringify(expected))})
for child,wanted in zip(guides,expected):
 assert child.Shape.isValid() and child.Shape.isClosed() and child.Shape.Volume > 0
 assert 'Carriage' in child.Label and child.Supply == 'purchased'
 actual = json.loads(child.ThreadFeaturesJSON)
 assert len(actual) == 4
 for feature,reference in zip(actual,wanted):
  assert (App.Vector(*feature['origin'])-App.Vector(*reference['origin'])).Length < 1e-8
  assert (App.Vector(*feature['axis'])-App.Vector(*reference['axis'])).Length < 1e-8
  assert not child.Shape.isInside(App.Vector(*feature['origin'])+App.Vector(*feature['axis'])*(feature['length']/2),1e-7,True)
App.closeDocument(doc.Name)
print('AXIS_THREAD_FRAMES_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 110000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /AXIS_THREAD_FRAMES_OK/);
  },
);

test(
  'complete native compact-cylinder macros retain closed female rod bores and accessible Simple/Full callouts',
  { skip: !process.env.FREECAD_PYTHON, timeout: 120000 },
  () => {
    const cases = ['32', '50'].flatMap((bore) =>
      ['simple', 'full'].map((mode) => {
        const p = { ...compact.defaults, bore };
        return {
          bore: Number(bore),
          mode,
          script: generateScript(
            compact,
            p,
            'default',
            undefined,
            undefined,
            mode as 'simple' | 'full',
          ),
        };
      }),
    );
    const code = `import FreeCAD as App, Part, json
volumes = {}
for case in json.loads(${JSON.stringify(JSON.stringify(cases))}):
 doc = App.newDocument('CompactThreadCallouts')
 exec(case['script'],{})
 components = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
 assert len(components) == 5
 assert all(obj.Shape.isValid() and obj.Shape.isClosed() and obj.Shape.Volume > 0 for obj in components)
 threaded = [obj for obj in components if hasattr(obj,'ThreadFeaturesJSON')]
 features = [feature for obj in threaded for feature in json.loads(obj.ThreadFeaturesJSON)]
 assert len(features) == 3
 ports = [feature for feature in features if feature['designation'].startswith('G1/8')]
 assert len(ports) == 2 and all('approximate' in feature['designation'] for feature in ports)
 rod = next(obj for obj in threaded if json.loads(obj.ThreadFeaturesJSON)[0]['designation'].startswith('M'))
 feature = json.loads(rod.ThreadFeaturesJSON)[0]
 assert feature['internal'] and feature['nominalDiameter'] == (10 if case['bore'] == 50 else 8)
 origin = App.Vector(*feature['origin'])
 axis = App.Vector(*feature['axis'])
 assert not rod.Shape.isInside(origin+axis*(feature['length']/2),1e-7,True)
 assert len(rod.Shape.Solids) == 1
 if case['mode'] == 'full':
  assert any(type(face.Surface).__name__ == 'BSplineSurface' for face in rod.Shape.Faces)
 volumes[(case['bore'],case['mode'])] = rod.Shape.Volume
 App.closeDocument(doc.Name)
for bore in [32,50]:
 assert volumes[(bore,'full')] > volumes[(bore,'simple')], 'female flanks retain material inside the symbolic major-diameter bore'
print('COMPACT_THREAD_CALLOUTS_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 110000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /COMPACT_THREAD_CALLOUTS_OK/);
  },
);
