import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/prototyping-board/part';
import {
  copperThickness,
  holeCenters,
  models,
  mountingCenters,
} from '../src/parts/prototyping-board/lib/model';
import assets from '../src/parts/prototyping-board/lib/native';
import py100 from '../src/parts/prototyping-board/lib/native/py-10x10cm.json';
import py79 from '../src/parts/prototyping-board/lib/native/py-7x9cm.json';
import py37 from '../src/parts/prototyping-board/lib/native/py-3x7cm.json';
import py46 from '../src/parts/prototyping-board/lib/native/py-4x6cm.json';
import py57 from '../src/parts/prototyping-board/lib/native/py-5x7cm.json';
import py68 from '../src/parts/prototyping-board/lib/native/py-6x8cm.json';
import type { Parameters } from '../src/core/types';
import { generateScript } from '../src/core/freecad';

const records = {
  'py-10x10cm': py100,
  'py-7x9cm': py79,
  'py-3x7cm': py37,
  'py-4x6cm': py46,
  'py-5x7cm': py57,
  'py-6x8cm': py68,
};
const params = (model: string): Parameters => ({ model });

test('PY boards are fixed purchased supplier executions with explicit evidence limits', () => {
  assert.equal(part.id, 'prototyping-board');
  assert.equal(part.name, 'Prototyping board');
  assert.equal(part.category, 'ELECTRONICS & VISION');
  assert.equal(part.subgroup, 'PROTOTYPING BOARDS');
  assert.equal(part.product.supply, 'purchased');
  assert.equal(part.catalogSelectionOnly, true);
  assert.deepEqual(
    part.parameters.map((field) => field.key),
    ['model'],
  );
  assert.deepEqual(part.presetMatchKeys, ['model']);
  assert.equal(part.presets.length, 6);
  for (const model of models) {
    const preset = part.presets.find((preset) => preset.id === model.id)!;
    assert.deepEqual(preset.parameters, params(model.id));
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
    assert.match(preset.catalog!.geometryEvidence!.limitations, /not manufacturer CAD/i);
    assert.match(preset.catalog!.sourceUrl, /nikom\.biz/);
    assert.equal(preset.catalog!.attributes!.length, model.length);
    assert.equal(preset.catalog!.attributes!.width, model.width);
    assert.equal(preset.catalog!.attributes!.pitch, 2.54);
    assert.equal(preset.catalog!.attributes!.holes, model.rows * model.columns);
    if (model.thicknessVerified) {
      assert.equal(preset.catalog!.attributes!.thickness, model.thickness);
      assert.equal(preset.catalog!.attributes!.holeDiameter, model.holeDiameter);
      assert.equal(preset.catalog!.attributes!.mountDiameter, model.mountDiameter);
      assert.ok(
        part.assessment!(params(model.id)).some(
          (line) =>
            line.includes(`Published thickness: ${model.thickness} mm`) &&
            line.includes(`mounting hole diameter: ${model.mountDiameter} mm`),
        ),
      );
    } else {
      assert.equal(preset.catalog!.attributes!.thickness, undefined);
      assert.equal(preset.catalog!.attributes!.holeDiameter, undefined);
      assert.match(preset.catalog!.geometryEvidence!.limitations, /installation assumptions/i);
    }
  }
  assert.ok(part.validate({ model: 'unknown' }, 'assembled').length);
  assert.ok(part.validate({ model: models[0].id, thickness: 3 }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'exploded').length);
});

test('hole grids retain supplier counts, 2.54 pitch and mounting clearance', () => {
  assert.deepEqual(
    models.map((model) => [model.id, model.columns, model.rows]),
    [
      ['py-10x10cm', 35, 37],
      ['py-7x9cm', 30, 24],
      ['py-3x7cm', 24, 10],
      ['py-4x6cm', 20, 14],
      ['py-5x7cm', 24, 18],
      ['py-6x8cm', 27, 22],
    ],
  );
  for (const model of models) {
    const p = params(model.id),
      holes = holeCenters(p),
      mounts = mountingCenters(p);
    assert.equal(holes.length, model.columns * model.rows);
    assert.equal(new Set(holes.map((point) => point.join(','))).size, holes.length);
    assert.ok(Math.abs(holes[1][0] - holes[0][0] - 2.54) < 1e-10);
    assert.ok(Math.abs(holes[model.columns][1] - holes[0][1] - 2.54) < 1e-10);
    assert.equal(mounts.length, 4);
    for (const [x, y] of holes) {
      assert.ok(Math.abs(x) + model.padDiameter / 2 < model.length / 2);
      assert.ok(Math.abs(y) + model.padDiameter / 2 < model.width / 2);
      for (const [mx, my] of mounts)
        assert.ok(Math.hypot(x - mx, y - my) > model.padDiameter / 2 + model.mountDiameter / 2);
    }
  }
});

test('existing PY board selections and native assets remain unchanged', () => {
  assert.deepEqual(part.defaults, { model: 'py-10x10cm' });
  for (const [id, expected] of [
    ['py-10x10cm', '044ebb95cb3ec484baec7a68f329b9d33afb30dfd6e298db29d0cfadb541623e'],
    ['py-7x9cm', '8c2cda15afc08382d4115b4c33ad33ac6ec993ea9ab8eec84a2c175220b15606'],
  ]) {
    const bytes = readFileSync(
      new URL(`../src/parts/prototyping-board/lib/native/${id}.json`, import.meta.url),
    );
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
    assert.deepEqual(part.presets.find((preset) => preset.id === id)!.parameters, { model: id });
  }
  assert.equal(models.find((model) => model.id === 'py-6x8cm')!.thickness, 1.6);
  assert.equal(models.find((model) => model.id === 'py-3x7cm')!.mountDiameter, 1.2);
  const py57 = models.find((model) => model.id === 'py-5x7cm')!;
  assert.equal(
    py57.sidePadPitch,
    4,
    'Preserve the photographed edge layout instead of scaling the grid pitch',
  );
  assert.equal(py57.padSides, 8, 'The selected supplier execution has octagonal pads');
});

test(
  'production macros retain grouped board components through STEP and FCStd',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 },
  () => {
    const additions = models.filter((model) => !['py-10x10cm', 'py-7x9cm'].includes(model.id));
    const cases = additions.flatMap((model) =>
      (['simple', 'full'] as const).map((mode) => ({
        model: model.id,
        designation: model.designation,
        mode,
        dimensions: [model.length, model.width, model.thickness],
        holes: [...holeCenters(params(model.id)), ...mountingCenters(params(model.id))],
        gridHoles: model.columns * model.rows,
        drillRadius: model.holeDiameter / 2,
        mountRadius: model.mountDiameter / 2,
        substrateTop: model.thickness - (model.sides === 2 ? copperThickness : 0),
        count: model.sides + 1,
        solidCounts: records[model.id as keyof typeof records].components.map(
          (component) => component.solidCount,
        ),
        source: generateScript(part, params(model.id), 'assembled', model.id, undefined, mode),
      })),
    );
    const code = `import sys, os
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App, Part, json, tempfile, time
from pathlib import Path
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
reports = []
report_path = Path(${JSON.stringify(resolve('test-results/prototyping-board-macro-audit.json'))})
def check_bores(substrate, case):
    # Full-height inward cylindrical faces witness every bore without repeatedly
    # classifying thousands of points against the same many-wire planar faces.
    seen = {}
    for face in substrate.Faces:
        surface = face.Surface
        if not isinstance(surface, Part.Cylinder) or abs(surface.Axis.z) < .999999:
            continue
        u0,u1,v0,v1 = face.ParameterRange
        u,v = (u0+u1)/2,(v0+v1)/2
        point = face.valueAt(u,v)
        radial = App.Vector(point.x-surface.Center.x,point.y-surface.Center.y,0)
        if face.normalAt(u,v).dot(radial) >= 0:
            continue
        seen[(round(surface.Center.x,5),round(surface.Center.y,5))] = (surface.Radius,face.BoundBox.ZMin,face.BoundBox.ZMax)
    for i,(x,y) in enumerate(case['holes']):
        radius,zmin,zmax = seen[(round(x,5),round(y,5))]
        expected_radius = case['drillRadius'] if i < case['gridHoles'] else case['mountRadius']
        assert abs(radius-expected_radius)<1e-6
        assert abs(zmin-${copperThickness})<1e-6 and abs(zmax-case['substrateTop'])<1e-6
    # Independent point classification samples supplement the complete bore map.
    for i in [0,case['gridHoles']//2,case['gridHoles']-1,len(case['holes'])-1]:
        x,y = case['holes'][i]
        assert not substrate.isInside(App.Vector(x,y,case['dimensions'][2]/2),1e-8,True)
for case in cases:
    started = time.monotonic()
    doc = App.newDocument('PYBoardMacroAudit')
    exec(compile(case['source'], 'PY-board-production-macro', 'exec'), {})
    assert len(doc.RootObjects) == 1
    root = doc.RootObjects[0]
    assert root.PartId == 'prototyping-board'
    assert root.CatalogDesignation == case['designation']
    assert root.GeometryMode == case['mode']
    objects = list(root.Group)
    assert len(objects) == case['count']
    assert [len(obj.Shape.Solids) for obj in objects] == case['solidCounts']
    assert all(obj.Shape.isValid() and obj.Shape.isClosed() and obj.Shape.Volume > 0 for obj in objects)
    labels = [obj.Label for obj in objects]
    assert labels == ['Perforated FR4 substrate', 'Bottom copper pads', 'Top copper pads'][:case['count']]
    substrate = objects[0].Shape
    z = case['dimensions'][2] / 2
    check_bores(substrate,case)
    expected_volume = sum(obj.Shape.Volume for obj in objects)
    with tempfile.TemporaryDirectory(prefix='protolab-py-board-') as folder:
        step = str(Path(folder)/'board.step')
        Part.export(objects, step)
        restored = Part.read(step)
        assert restored.isValid() and restored.isClosed()
        assert len(restored.Solids) == sum(case['solidCounts'])
        assert abs(restored.Volume-expected_volume) < .001
        b = restored.BoundBox
        assert all(abs(a-e)<1e-6 for a,e in zip([b.XLength,b.YLength,b.ZLength],case['dimensions']))
        restored_substrate = max(restored.Solids,key=lambda shape: shape.Volume)
        check_bores(restored_substrate,case)
        fcstd = str(Path(folder)/'board.FCStd')
        doc.saveAs(fcstd)
        App.closeDocument(doc.Name)
        doc = App.openDocument(fcstd)
        reopened = doc.RootObjects[0]
        assert reopened.CatalogDesignation == case['designation']
        assert [obj.Label for obj in reopened.Group] == labels
        assert [len(obj.Shape.Solids) for obj in reopened.Group] == case['solidCounts']
        assert all(obj.Shape.isValid() and obj.Shape.isClosed() for obj in reopened.Group)
    reports.append(dict(model=case['model'],mode=case['mode'],components=case['count'],solids=sum(case['solidCounts']),allHolesOpen=True,stepRoundTrip=True,fcstdGrouping=True,seconds=round(time.monotonic()-started,3)))
    App.closeDocument(doc.Name)
    report_path.write_text(json.dumps(reports,indent=2)+'\\n')
    print('PASS',case['model'],case['mode'],flush=True)
print('PASS all PY production macros',flush=True)
sys.stdout.flush()
sys.stderr.flush()
os._exit(0)
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS all PY production macros/);
  },
);

test('baked geometry is analytic, perforated and grouped into a small component tree', () => {
  for (const model of models) {
    const asset = records[model.id as keyof typeof records],
      p = params(model.id);
    assert.equal(asset.geometryEvidence, 'source-dimensions');
    assert.equal(asset.factoryGeometryUnmodified, false);
    assert.match(asset.geometryOrigin, /not manufacturer CAD/i);
    assert.equal(asset.sourceSha256, model.sourceSha256);
    assert.deepEqual(asset.gridHoles, holeCenters(p));
    assert.equal(asset.components.length, model.sides + 1);
    assert.equal(asset.components[0].solidCount, 1);
    assert.equal(
      asset.components[1].solidCount,
      model.columns * model.rows + 2 * model.sidePadCount,
    );
    const substrateThickness = model.thickness - model.sides * copperThickness,
      voidArea =
        model.rows * model.columns * Math.PI * (model.holeDiameter / 2) ** 2 +
        4 * Math.PI * (model.mountDiameter / 2) ** 2,
      expectedVolume = (model.length * model.width - voidArea) * substrateThickness;
    assert.ok(Math.abs(asset.components[0].volume - expectedVolume) < 0.0001);
    for (const component of asset.components) {
      assert.equal(component.meshProof.closed, true);
      assert.equal(component.meshProof.edgeIncidence, 2);
      assert.ok(component.meshProof.volumeRelativeError < 0.01);
      const brep = inflateSync(Buffer.from(component.brep, 'base64'));
      assert.equal(createHash('sha256').update(brep).digest('hex'), component.brepSha256);
      assert.match(brep.toString(), /CASCADE Topology/);
    }
    assert.equal(assets[model.id].components.length, model.sides + 1);
  }
});

test('preview dimensions and genuinely open grid holes match native board geometry', () => {
  for (const model of models) {
    const p = params(model.id),
      group = part.buildGeometry(p, 'assembled'),
      size = new Box3().setFromObject(group).getSize(new Vector3()).toArray();
    assert.equal(group.children.length, model.sides + 1);
    for (const [i, expected] of [model.length, model.width, model.thickness].entries())
      assert.ok(Math.abs(size[i] - expected) < 0.00001);
    assert.deepEqual(part.dimensions(p, 'assembled'), [model.length, model.width, model.thickness]);
    group.updateMatrixWorld(true);
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
    const holes = holeCenters(p);
    for (const index of [0, 1, Math.floor(holes.length / 2), holes.length - 1]) {
      const [x, y] = holes[index];
      const hits = new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObject(
        group,
        true,
      );
      assert.equal(hits.length, 0, `${model.id} grid hole ${index} is open`);
    }
    for (const [x, y] of mountingCenters(p))
      assert.equal(
        new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObject(group, true)
          .length,
        0,
      );
    const [x, y] = holes[0];
    assert.ok(
      new Raycaster(
        new Vector3(x + model.padDiameter / 2 + 0.1, y, 10),
        new Vector3(0, 0, -1),
      ).intersectObject(group, true).length > 0,
    );
    const script = part.python(p, 'assembled');
    assert.match(script, /importBrepFromString/);
    assert.match(script, /not original manufacturer CAD/);
    assert.doesNotMatch(script, /Part\.makeBox|wireLoft|makePipeShell/);
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    });
  }
});
