import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Mesh, MeshStandardMaterial } from 'three';
import { currentGeometryMode, withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import bolt from '../src/parts/bolt-screw/part';
import nut from '../src/parts/hex-nut/part';
import wingScrew from '../src/parts/wing-screw/part';
import swingEyeBolt from '../src/parts/swing-eye-bolt/part';
import liftingEyeBolt from '../src/parts/lifting-eye-bolt/part';
import couplingNut from '../src/parts/coupling-nut/part';
import highNut from '../src/parts/high-nut/part';
import metalLockNut from '../src/parts/metal-lock-nut/part';
import thinNut from '../src/parts/thin-nut/part';
import squareNut from '../src/parts/square-nut/part';
import flangeNut from '../src/parts/flange-nut/part';
import nylocNut from '../src/parts/nyloc-nut/part';
import capNut from '../src/parts/cap-nut/part';
import wingNut from '../src/parts/wing-nut/part';
import liftingEyeNut from '../src/parts/lifting-eye-nut/part';
import threadTool from '../src/parts/thread-tool/part';
import detail from '../src/parts/manufactured-detail/part';
import eccentricFollower from '../src/parts/eccentric-cam-follower/part';
import { detailComponent } from '../src/core/component-recipes';
import { componentPython } from '../src/core/assembly/detail-instances';
import { threadGeometry } from '../src/core/assembly/recovery/thread';
import { threadFeatures } from '../src/core/assembly/recovery/thread-features';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import type { PartDefinition, Parameters } from '../src/core/types';

test('geometry mode is nested, synchronous, validated and restored after failures', () => {
  assert.equal(currentGeometryMode(), 'simple');
  withGeometryMode('full', () => {
    assert.equal(currentGeometryMode(), 'full');
    withGeometryMode('simple', () => assert.equal(currentGeometryMode(), 'simple'));
    assert.equal(currentGeometryMode(), 'full');
    assert.throws(
      () =>
        withGeometryMode('simple', () => {
          throw new Error('stop');
        }),
      /stop/,
    );
    assert.equal(currentGeometryMode(), 'full');
  });
  assert.equal(currentGeometryMode(), 'simple');
  assert.throws(() => withGeometryMode('unknown' as 'simple', () => 0), /Simple or Full/);
  assert.throws(() => withGeometryMode('full', () => Promise.resolve(1)), /synchronous/);
  assert.equal(currentGeometryMode(), 'simple');
});

test('Simple avoids shader setup and printed helix sampling; Full preserves detail without changing configuration', () => {
  const parameters = { ...bolt.defaults, handedness: 'left' };
  const serialized = JSON.stringify(parameters);
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const model = bolt.buildGeometry(parameters, 'default');
      let marked = 0;
      model.traverse((object) => {
        if (
          object instanceof Mesh &&
          (object.material as MeshStandardMaterial).userData.visualThreads
        )
          marked++;
      });
      assert.equal(marked > 0, mode === 'full');
      disposeModel(model);
    });
  assert.equal(JSON.stringify(parameters), serialized);
  const thread = {
    diameter: 8,
    pitch: 1,
    length: 12,
    clearance: 0.2,
    internal: true,
    process: 'printed' as const,
  };
  const simple = withGeometryMode('simple', () => threadGeometry(thread));
  const full = withGeometryMode('full', () => threadGeometry(thread));
  assert.ok(full.getAttribute('position').count > 100 * simple.getAttribute('position').count);
  assert.equal(simple.boundingBox, null);
  simple.computeBoundingBox();
  full.computeBoundingBox();
  assert.ok(
    Math.abs(simple.boundingBox!.max.x - full.boundingBox!.max.x) < 1e-5,
    'fit allowance survives simplification',
  );
  simple.dispose();
  full.dispose();
  assert.equal(
    withGeometryMode(
      'simple',
      () => threadFeatures({ kind: 'thread', ...thread })[0].representation,
    ),
    'nominal-cylinder',
  );
  assert.equal(
    withGeometryMode('full', () => threadFeatures({ kind: 'thread', ...thread })[0].representation),
    'printed-helix',
  );
});

test('FreeCAD detail mode is explicit, recorded, restored and independent of product parameters', () => {
  for (const part of [
    bolt,
    nut,
    threadTool,
    wingScrew,
    swingEyeBolt,
    liftingEyeBolt,
    eccentricFollower,
  ]) {
    const state = part === threadTool ? 'external' : (part.states?.[0]?.id ?? 'default');
    const p = part === threadTool ? { ...part.defaults, manufacturing: 'machined' } : part.defaults;
    const parameters = JSON.stringify(p);
    const simple = generateScript(part, p, state, undefined, undefined, 'simple');
    const full = generateScript(part, p, state, undefined, undefined, 'full');
    assert.doesNotMatch(simple, /makeLongHelix|makePipeShell/);
    assert.match(full, /makeLongHelix/);
    assert.match(simple, /GeometryMode = "simple"/);
    assert.match(full, /GeometryMode = "full"/);
    assert.match(simple, /ThreadCallouts/);
    assert.match(full, /machined-helix/);
    assert.equal(JSON.stringify(p), parameters);
    assert.equal(currentGeometryMode(), 'simple');
  }
});

const threadedPlate: Shape = {
  kind: 'subtract',
  children: [
    { kind: 'box', size: [20, 20, 8], origin: [-10, -10, 0] },
    {
      kind: 'cylinder',
      radius: 3,
      height: 10,
      origin: [0, 0, -1],
      axis: 'z',
      thread: { pitch: 1, internal: true, left: true },
    },
  ],
};

test('configured library details preserve mode and child thread callouts through native assembly scopes', () => {
  const configured = detailComponent('plate', 'Tapped plate', threadedPlate);
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const code = componentPython(
        [detail],
        [
          {
            component: configured,
            label: 'Tapped plate',
            color: 0xaaaaaa,
            requireSingleSolid: true,
          },
        ],
      );
      assert.match(code, /ThreadFeaturesJSON/);
      assert.match(code, /local_metadata/);
      assert.match(code, mode === 'full' ? /machined-helix/ : /nominal-cylinder/);
      assert.equal(code.includes('makeLongHelix'), mode === 'full');
    });
});

test(
  'native Simple and Full maintain valid female bores and solids; Simple projects lightweight TechDraw views',
  { skip: !process.env.FREECAD_PYTHON, timeout: 240000 },
  () => {
    const configuration = detailComponent('plate', 'Tapped plate', threadedPlate);
    const cases = [bolt, nut, threadTool, detail].flatMap((part) =>
      ['simple', 'full'].map((mode) => ({
        id: part.id,
        mode,
        code: generateScript(
          part,
          part === detail
            ? configuration.parameters
            : part === threadTool
              ? { ...part.defaults, manufacturing: 'machined' }
              : part.defaults,
          part === threadTool ? 'external' : 'default',
          undefined,
          undefined,
          mode as 'simple' | 'full',
        ),
      })),
    );
    const code = `import FreeCAD as App, Part, TechDraw, json, math
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
volumes = {}
for case in cases:
    doc = App.newDocument('ThreadModes')
    exec(case['code'], {})
    obj = doc.RootObjects[0]
    shape = obj.Shape
    assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1 and shape.Volume > 0, (case['id'],case['mode'])
    assert obj.GeometryMode == case['mode']
    features = json.loads(obj.ThreadFeaturesJSON)
    assert features and all(feature['representation'] == ('machined-helix' if case['mode'] == 'full' else 'nominal-cylinder') for feature in features)
    sweeps = [face for face in shape.Faces if type(face.Surface).__name__ == 'BSplineSurface']
    if case['mode'] == 'full':
        assert sweeps, case['id']
    else:
        assert not sweeps, case['id']
        projection = TechDraw.projectToSVG(shape, App.Vector(0,1,0))
        assert 10 < len(projection) < 60000, (case['id'],len(projection))
    volumes[(case['id'],case['mode'])] = shape.Volume
    if case['id'] == 'manufactured-detail':
        assert shape.common(Part.makeCylinder(2.4,8,App.Vector(10,10,0))).Volume < 1e-6, 'female bore remains open'
    App.closeDocument(doc.Name)
assert volumes[('bolt-screw','full')] < volumes[('bolt-screw','simple')]
assert volumes[('hex-nut','full')] > volumes[('hex-nut','simple')]
assert volumes[('manufactured-detail','full')] > volumes[('manufactured-detail','simple')]
print('PASS native Simple / Full threads and TechDraw')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 230000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS native Simple/);
  },
);

test(
  'every nut family keeps closed solids and real female flanks at its minimum supported diameter',
  { skip: !process.env.FREECAD_PYTHON, timeout: 180000 },
  () => {
    const families: PartDefinition[] = [
      thinNut,
      couplingNut,
      highNut,
      squareNut,
      flangeNut,
      nylocNut,
      capNut,
      metalLockNut,
      nut,
      wingNut,
      liftingEyeNut,
    ];
    const cases = families.map((part) => {
      const key = Object.hasOwn(part.defaults, 'bore') ? 'bore' : 'diameter';
      const field = part.parameters.find((field) => field.key === key)!;
      assert.equal(field.type, 'number');
      if (field.type !== 'number') throw new Error('Nut diameter must be numeric.');
      assert.equal(typeof field.min, 'number');
      let parameters: Parameters = { ...part.defaults, [key]: field.min! };
      parameters = part.updateParameters?.(parameters, key) ?? parameters;
      assert.deepEqual(part.validate(parameters, 'default'), [], part.id);
      return {
        id: part.id,
        code: generateScript(part, parameters, 'default', undefined, undefined, 'full'),
      };
    });
    const code = `import FreeCAD as App, Part, math, json
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
for case in cases:
    doc = App.newDocument('NutMinimum')
    exec(case['code'], {})
    root = doc.RootObjects[0]
    assert root.GeometryMode == 'full', case['id']
    parts = [obj for obj in doc.Objects if hasattr(obj,'Shape') and obj.Shape.Solids]
    assert parts, case['id']
    for obj in parts:
        shape = obj.Shape
        assert shape.isValid() and shape.isClosed() and shape.Volume > 0, (case['id'],obj.Label)
        assert all(solid.isClosed() for solid in shape.Solids), (case['id'],obj.Label)
    threaded = [obj for obj in parts if hasattr(obj,'ThreadFeaturesJSON')]
    assert threaded, case['id']
    features = [feature for obj in threaded for feature in json.loads(obj.ThreadFeaturesJSON)]
    assert features and all(f['internal'] and f['representation']=='machined-helix' for f in features), case['id']
    assert any(type(face.Surface).__name__ == 'BSplineSurface' for obj in threaded for face in obj.Shape.Faces), case['id']
    App.closeDocument(doc.Name)
print('PASS all 11 nut families at minimum diameter')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 170000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS all 11 nut families/);
  },
);

test(
  'Full special fasteners and long M1 female threads remain closed native solids',
  { skip: !process.env.FREECAD_PYTHON, timeout: 240000 },
  () => {
    const cases = [wingScrew, swingEyeBolt, liftingEyeBolt].flatMap((part) =>
      (['simple', 'full'] as const).map((mode) => ({
        id: part.id,
        mode,
        code: generateScript(part, part.defaults, 'default', undefined, undefined, mode),
      })),
    );
    cases.push({
      id: 'long-bolt',
      mode: 'full',
      code: generateScript(
        bolt,
        { ...bolt.defaults, length: 150, pitch: 1 },
        'default',
        undefined,
        undefined,
        'full',
      ),
    });
    for (const part of [couplingNut, highNut, metalLockNut])
      cases.push({
        id: part.id,
        mode: 'full',
        code: generateScript(
          part,
          { ...part.defaults, bore: 1, pitch: 0.25 },
          'default',
          undefined,
          undefined,
          'full',
        ),
      });
    const code = `import FreeCAD as App, Part, math, json
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
volumes = {}
for case in cases:
    doc = App.newDocument('ThreadExtremes')
    exec(case['code'], {})
    obj = doc.RootObjects[0]
    shape = obj.Shape
    assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0, (case['id'], case['mode'], [(s.isClosed(),len(s.Faces)) for s in shape.Shells])
    features = json.loads(obj.ThreadFeaturesJSON)
    assert features and all(f['representation']==('machined-helix' if case['mode']=='full' else 'nominal-cylinder') for f in features)
    volumes[(case['id'], case['mode'])] = shape.Volume
    if 'nut' in case['id']:
        assert shape.common(Part.makeCylinder(0.35,shape.BoundBox.ZLength)).Volume < 1e-6, 'long female bore remains open'
    App.closeDocument(doc.Name)
for family in ['wing-screw','swing-eye-bolt','lifting-eye-bolt']:
    assert volumes[(family,'full')] < volumes[(family,'simple')] - 0.01, (family,volumes)
print('PASS Full special fasteners and long M1 female threads')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 230000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS Full special fasteners/);
  },
);

test('cam-follower stud pitch comes from each source specification and remains physical in both modes', () => {
  for (const preset of eccentricFollower.presets) {
    const specification = preset.catalog!.specifications!.find(
      (row) => row.label === 'Stud thread',
    )!.value;
    assert.equal(Number(preset.parameters.threadPitch), Number(specification.split('×')[1].trim()));
    assert.ok(preset.catalog!.verifiedParameters!.includes('threadPitch'));
    const parameters = { ...eccentricFollower.defaults, ...preset.parameters };
    for (const mode of ['simple', 'full'] as const) {
      assert.deepEqual(
        withGeometryMode(mode, () => eccentricFollower.validate(parameters, 'assembled')),
        [],
      );
      const model = withGeometryMode(mode, () =>
        eccentricFollower.buildGeometry(parameters, 'assembled'),
      );
      let marks = 0;
      model.traverse((object) => {
        if (
          object instanceof Mesh &&
          (object.material as MeshStandardMaterial).userData.visualThreads
        )
          marks++;
      });
      assert.equal(marks > 0, mode === 'full');
      disposeModel(model);
    }
  }
});
