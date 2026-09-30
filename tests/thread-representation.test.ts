import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Raycaster, Vector3 } from 'three';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import bolt from '../src/parts/bolt-screw/part';
import nut from '../src/parts/hex-nut/part';
import nyloc from '../src/parts/nyloc-nut/part';
import square from '../src/parts/square-nut/part';
import flange from '../src/parts/flange-nut/part';
import cap from '../src/parts/cap-nut/part';
import high from '../src/parts/high-nut/part';
import coupling from '../src/parts/coupling-nut/part';
import metalLock from '../src/parts/metal-lock-nut/part';
import thin from '../src/parts/thin-nut/part';
import tool from '../src/parts/thread-tool/part';
import co2 from '../src/parts/rocket-co2-recovery/part';
import { pieces } from '../src/parts/rocket-co2-recovery/lib/model';
import { python as co2Python } from '../src/parts/rocket-co2-recovery/lib/assembly';
import {
  threadFeatures,
  manufacturingMetadata,
} from '../src/parts/rocket-release/lib/manufacturing';
import { pythonShape, component, type Shape } from '../src/parts/rocket-release/lib/shapes';
import nativeServo from '../src/parts/rocket-release/lib/st3215-native.json';
import { barrelShape } from '../src/parts/rocket-release/lib/barrel';
import { radiusAt } from '../src/parts/thread-tool/lib/thread';

test('CO2 helices belong only to printed parts; metal and turned polymer threads retain callouts', () => {
  for (const avionicsLayout of ['wing-2s', 'wing-4s', 'h7-4s']) {
    const assembly = pieces({ ...co2.defaults, avionicsLayout }, 'assembled');
    let printed = 0,
      symbolic = 0;
    for (const p of assembly) {
      if (!p.shape) continue;
      const threads = threadFeatures(p.shape);
      if (!threads.length) continue;
      const isPrinted = threads.some((t) => t.representation === 'printed-helix');
      if (isPrinted) assert.equal(p.process, '3D PRINT', p.label);
      threads.forEach((t) => {
        assert.equal(t.representation, isPrinted ? 'printed-helix' : 'nominal-cylinder', p.label);
        assert.ok(t.pitch > 0 && t.nominalDiameter > 0 && t.length > 0);
        assert.equal(t.axis.length, 3);
      });
      const code = pythonShape(p.shape);
      if (isPrinted) {
        printed++;
        assert.match(code, /_printed_thread\(/);
      } else {
        symbolic++;
        assert.doesNotMatch(code, /_printed_thread\(|makeLongHelix|makePipeShell/);
      }
      assert.ok(manufacturingMetadata({ ...p, shape: p.shape }).ThreadLabels);
    }
    assert.equal(printed, 3);
    assert.ok(symbolic > 30);
  }
});

test('optimized spring-barrel and general meshes use the same cylindrical metal thread envelopes', () => {
  for (const shape of [{ kind: 'springBarrel', travel: 16 } as Shape, barrelShape(16)]) {
    const model = component(shape, 'Barrel', 0xaaaaaa);
    model.updateMatrixWorld(true);
    for (const z of [44.2, 45.1, 46]) {
      const ray = new Raycaster(new Vector3(10, 0, z), new Vector3(-1, 0, 0));
      assert.ok(Math.abs(ray.intersectObject(model, true)[0].point.x - 4) < 1e-5);
    }
    disposeModel(model);
  }
});

test('the thread tool explicitly separates machined nominal envelopes and printable flanks', () => {
  for (const state of ['external', 'internal']) {
    const machined = { ...tool.defaults, manufacturing: 'machined', clearance: 0.2 };
    assert.equal(radiusAt(machined, state, 0.23, 0.47), 3);
    assert.doesNotMatch(tool.python(machined, state), /makeLongHelix|makePipeShell/);
    assert.match(tool.python(machined, state), /ThreadCallouts/);
    const printed = { ...machined, manufacturing: 'printed' };
    assert.notEqual(radiusAt(printed, state, 0, 0), radiusAt(printed, state, 0.5, 0));
    assert.match(tool.python(printed, state), /makeLongHelix/);
  }
});

test(
  'native simplified threads keep names, blind-hole tooling allowances, valid solids and light projections',
  { skip: !process.env.FREECAD_PYTHON, timeout: 240_000 },
  () => {
    const selected = pieces({ ...co2.defaults, avionicsLayout: 'h7-4s' }, 'assembled').filter((p) =>
      /^(Separating bulkhead|Turned spacer 1\.|Printed protective adapter|Flight-controller carrier disk|BUY Leland)/.test(
        p.label,
      ),
    );
    assert.ok(selected.length >= 4, selected.map((p) => p.label).join('\n'));
    const scripts = [bolt, nut, nyloc, square, flange, cap, high, coupling, metalLock, thin].map(
      (p) => generateScript(p, p.defaults, 'default'),
    );
    const code = `import FreeCAD as App, Part, TechDraw, json, tempfile, os, math, hashlib
scripts = json.loads(${JSON.stringify(JSON.stringify(scripts))})
for script in scripts:
    doc = App.newDocument('ThreadRepresentationTest')
    exec(script, {})
    root = doc.RootObjects[0]
    objects = root.Group if root.TypeId == 'App::Part' else [root]
    threaded = [o for o in objects if getattr(o, 'ThreadCallouts', '')]
    assert len(threaded) == 1
    obj = threaded[0]
    assert 'threads: ' in obj.Label and 'M' in obj.Label, obj.Label
    assert obj.Shape.isValid() and obj.Shape.isClosed()
    # The cap retains its 24-facet dome meridian, independent of the thread.
    assert len(obj.Shape.Faces) < (80 if obj.Label.startswith('Cap nut') else 50), (obj.Label, len(obj.Shape.Faces))
    assert all(f['representation'] == 'nominal-cylinder' for f in json.loads(obj.ThreadFeaturesJSON))
    projected = TechDraw.projectToSVG(obj.Shape, App.Vector(0,1,0))
    assert len(projected) > 10 and len(projected) < 50000, len(projected)
    with tempfile.TemporaryDirectory() as directory:
        filename = os.path.join(directory, 'thread.FCStd')
        name = obj.Name
        label = obj.Label
        doc.saveAs(filename)
        App.closeDocument(doc.Name)
        doc = App.openDocument(filename)
        assert doc.getObject(name).Label == label
        assert doc.getObject(name).ThreadCallouts
    App.closeDocument(doc.Name)
${co2Python(selected)}
assert len(component_metadata) == len(components)
printed = 0
for label, shape, meta in zip(component_labels, components, component_metadata):
    assert shape.isValid() and shape.isClosed(), label
    print(label, len(shape.Faces), meta.get('ThreadLabels'))
    features = json.loads(meta.get('ThreadFeaturesJSON', '[]'))
    if label.startswith('Printed protective adapter'):
        assert '3/8-24 UNF RH' in meta['ThreadCallouts']
        assert all(f['representation'] == 'printed-helix' for f in features)
        assert any(type(face.Surface).__name__ == 'BSplineSurface' for face in shape.Faces), (label, [type(f.Surface).__name__ for f in shape.Faces])
        printed += 1
    elif label.startswith('BUY Leland'):
        assert features and '3/8″-24 UNF RH' in meta['ThreadCallouts']
        for f in features:
            assert abs(f['axis'][2]) == 1
            assert shape.BoundBox.ZMin <= f['origin'][2] <= shape.BoundBox.ZMax
    elif features:
        assert meta['ThreadLabels'] and all(f['representation'] == 'nominal-cylinder' for f in features)
        assert len(shape.Faces) < 150, (label, len(shape.Faces))
        assert len(TechDraw.projectToSVG(shape, App.Vector(0,1,0))) < 100000
        if label.startswith('Turned spacer'):
            assert 'chip reserve' in meta['BlindThread']
            assert 'drill' in meta['BlindThread']
assert printed == 1
import base64, zlib
for index, encoded in [(5, ${JSON.stringify(nativeServo.components[5].brep)}), (8, ${JSON.stringify(nativeServo.components[8].brep)})]:
    shape = Part.Shape()
    shape.importBrepFromString(zlib.decompress(base64.b64decode(encoded)).decode())
    assert shape.isValid() and shape.isClosed()
    central_sweeps = [f for f in shape.Faces if type(f.Surface).__name__ == 'BSplineSurface' and f.BoundBox.XMin > -2 and f.BoundBox.XMax < 2 and f.BoundBox.YMin > -2 and f.BoundBox.YMax < 2]
    assert not central_sweeps, index
print('PASS native thread labels, saved metadata, cylindrical metal, printed helices and lightweight projections')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 230_000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS native thread/);
  },
);
