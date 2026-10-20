import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import cooling, { coolingSpec } from '../src/parts/cnc-process-accessory/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

test('active CW-5000TITY preserves exact source ratings and a different physical envelope from passive CW3000', () => {
  const active = coolingSpec('teyu-cw5000-tity'),
    passive = coolingSpec('teyu-cw3000-tgty'),
    preset = cooling.presets.find((row) => row.id === active.id)!;
  assert.deepEqual([active.width, active.length, active.height], [290, 580, 470]);
  assert.deepEqual([passive.width, passive.length, passive.height], [270, 490, 380]);
  assert.equal(active.activeCooling, true);
  assert.equal(active.nominalCoolingWatts, 750);
  assert.equal(active.ratedFlowLitersPerMinute, 10);
  assert.equal(active.pumpMaxPressureBar, 2.5);
  assert.equal(active.massKg, 22);
  assert.match(active.spec, /not a guaranteed installed flow\/capacity/);
  assert.match(passive.spec, /No compressor/);
  assert.equal(preset.catalog!.designation, 'TEYU CW-5000TITY');
  assert.equal(preset.catalog!.sourceUrl, active.source);
  assert.match(
    preset.catalog!.attributeConditions!.ratedFlowLitersPerMinute,
    /not verified installed/,
  );
  assert.match(preset.catalog!.geometryEvidence!.limitations, /Mounting-hole positions/);
  assert.deepEqual(validateParameters(cooling, preset.parameters, 'default'), []);
});

test('both geometry modes retain finite CW5000 source bounds and authentic purchased catalog provenance', () => {
  const preset = cooling.presets.find((row) => row.id === 'teyu-cw5000-tity')!;
  for (const mode of ['simple', 'full'] as const) {
    const model = withGeometryMode(mode, () => cooling.buildGeometry(preset.parameters, 'default'));
    try {
      const bounds = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      // The shared preview CSG kernel can move metre-scale planar vertices by a few microns.
      // Native nominal dimensions are checked independently at the tighter bound below.
      assert.ok(bounds.every((size, i) => Math.abs(size - [290, 580, 470][i]) < 0.01));
      model.traverse((object) => {
        if (object instanceof Mesh) {
          const vertices = object.geometry.getAttribute('position');
          assert.ok(vertices.count > 0);
          assert.ok(Array.from(vertices.array).every(Number.isFinite));
        }
      });
    } finally {
      disposeModel(model);
    }
    const script = generateScript(
      cooling,
      preset.parameters,
      'default',
      preset.id,
      undefined,
      mode,
    );
    assert.ok(script.includes('CW-5000TITY'));
    assert.ok(script.includes('CatalogDefinition'));
    assert.ok(script.includes('750 W'));
    assert.ok(
      !script.includes('def _protolab_thread('),
      'No unpublished supplier thread profile is invented.',
    );
  }
});

test(
  'optional FreeCAD active chiller macro has closed positive components and source bounds in both modes',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const preset = cooling.presets.find((row) => row.id === 'teyu-cw5000-tity')!,
      cases = ['simple', 'full'].map((mode) => ({
        mode,
        source: generateScript(
          cooling,
          preset.parameters,
          'default',
          preset.id,
          undefined,
          mode as 'simple' | 'full',
        ),
      })),
      script = `import FreeCAD as App, Part, json
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
for case in cases:
    doc=App.newDocument('ActiveChiller')
    try:
        exec(compile(case['source'],case['mode'],'exec'),{})
        root=doc.RootObjects[0]
        assert root.GeometryMode==case['mode']
        assert json.loads(root.CatalogDefinition)['designation']=='TEYU CW-5000TITY'
        assert len(root.Group)==9
        for item in root.Group:
            shape=item.Shape
            assert not shape.isNull() and shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0,item.Label
        bound=Part.makeCompound([item.Shape for item in root.Group]).BoundBox
        assert all(abs(actual-expected)<0.001 for actual,expected in zip([bound.XLength,bound.YLength,bound.ZLength],[290,580,470]))
    finally:
        App.closeDocument(doc.Name)
print('ACTIVE_CHILLER_NATIVE=passed')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-c', script], {
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 2000000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(result.stdout.includes('ACTIVE_CHILLER_NATIVE=passed'));
  },
);
