import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import spindle, { spindleSpec, spindleSpecs } from '../src/parts/cnc-spindle/part';
import mount, {
  spindleMountLayout,
  spindleMountDefaults,
} from '../src/parts/cnc-spindle-mount/part';
import { spindlePieces, spindleMetadata } from '../src/parts/cnc-spindle/lib/model';
import { mountShape } from '../src/parts/cnc-spindle-mount/lib/model';
import { boundaryThreadCallouts } from '../src/core/assembly/boundary/shapes';
import { withGeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import type { Parameters, PartDefinition } from '../src/core/types';

function checkPreview(part: PartDefinition, p: Parameters) {
  const model = part.buildGeometry(p, 'default');
  try {
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model, true);
    const dimensions = bounds.getSize(new Vector3()).toArray();
    part
      .dimensions(p, 'default')
      .forEach((expected, i) =>
        assert.ok(
          Math.abs(dimensions[i] - expected) < 0.001,
          `${part.id} dimension ${i}: ${dimensions[i]} vs ${expected}`,
        ),
      );
    let meshes = 0;
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshes++;
      const positions = object.geometry.getAttribute('position');
      assert.ok(positions.count > 0);
      for (let i = 0; i < positions.count; i++)
        assert.ok([positions.getX(i), positions.getY(i), positions.getZ(i)].every(Number.isFinite));
    });
    assert.ok(meshes > 0);
    return bounds;
  } finally {
    disposeModel(model);
  }
}

test('authored clamp thread allowance preserves nominal M6 callouts and is separate from a released fit', () => {
  const parameters = { ...spindleMountDefaults, component: 'back', threadFitAllowance: 0.05 };
  assert.deepEqual(validateParameters(mount, parameters, 'default'), []);
  for (const mode of ['simple', 'full'] as const) {
    const callouts = withGeometryMode(mode, () => boundaryThreadCallouts(mountShape(parameters)));
    assert.equal(callouts.length, 6);
    assert.ok(callouts.every((callout) => callout.nominalDiameter === 6 && callout.pitch === 1));
    const code = withGeometryMode(mode, () => mount.python(parameters, 'default'));
    assert.match(code, /ThreadFitAllowance/);
    assert.match(code, /not a released fit or tolerance class/);
    if (mode === 'full') assert.match(code, /_protolab_thread\(6,1,14,True,False,0\.05,False\)/);
    else assert.match(code, /Part.makeCylinder\(3\.05,/);
  }
  assert.ok(
    !mount.python({ ...parameters, component: 'cap' }, 'default').includes('ThreadFitAllowance'),
  );
  for (const value of [-0.01, 0.21, Infinity, NaN])
    assert.ok(mount.validate({ ...parameters, threadFitAllowance: value }, 'default').length);
});

test('five spindle executions retain actual source body/nose datums and distinct purchasing identities', () => {
  assert.equal(spindleSpecs.length, 5);
  assert.equal(spindleSpec('jst-2200-water-80').neckDiameter, 49);
  assert.equal(spindleSpec('jst-2200-water-80').neckLength, 5);
  const expected = [
    [65, 217.5, 27],
    [80, 220, 43.8],
    [80, 255, 44],
    [100, 243, 58],
    [100, 220, 88],
  ];
  spindleSpecs.forEach((s, i) => {
    assert.deepEqual([s.bodyDiameter, s.bodyLength, s.bodyStartZ], expected[i]);
    assert.equal(s.bodyEndZ, s.bodyStartZ + s.bodyLength);
    assert.ok(s.clampEndZ - s.clampStartZ >= 40);
    const preset = spindle.presets.find((row) => row.id === s.id)!;
    assert.deepEqual(validateParameters(spindle, preset.parameters, 'default'), []);
    assert.equal(preset.catalog?.sourceUrl, s.sourceUrl);
    assert.equal(preset.catalog?.geometryEvidence?.sourceUrl, s.drawingUrl);
    assert.match(preset.catalog?.geometryEvidence?.sourceSha256 ?? '', /^[a-f0-9]{64}$/);
    assert.equal(preset.catalog?.designation, s.drawingDesignation);
    assert.match(
      preset.catalog?.geometryEvidence?.limitations ?? '',
      /authored|unpublished|undimensioned/,
    );
  });
  assert.match(spindleSpec('jst-1500-water-65').sourceNotes, /65D.*65C/);
  assert.match(spindleSpec('jst-2200-air-80').sourceNotes, /F80E.*80E/);
  assert.match(spindleSpec('zhj-3000-air-100').threadNotes, /not manufacturer-verified/);
  assert.throws(() => spindleSpec('unknown'));
});

test('spindle previews retain authored external details, exact envelope dimensions and zero nose datum in both modes', () => {
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      for (const p of spindle.presets) {
        const bounds = checkPreview(spindle, p.parameters);
        assert.ok(Math.abs(bounds.min.z) < 0.001);
        const items = spindlePieces(p.parameters);
        assert.ok(items.some((item) => /connector/.test(item.label)));
        assert.ok(items.some((item) => /collet nut/.test(item.label)));
        assert.equal(
          items.filter((item) => /Coolant hose/.test(item.label)).length,
          spindleSpec(p.parameters).cooling === 'water' ? 2 : 0,
        );
        const meta = spindleMetadata(p.parameters);
        const threadOwners = meta.filter((row) => row.ThreadFeaturesJSON);
        assert.equal(threadOwners.length, 2);
        assert.ok(
          threadOwners.every((row) =>
            /inspection|unverified|unpublished/.test(row.ThreadSpanBasis),
          ),
        );
        for (const row of threadOwners)
          for (const feature of JSON.parse(row.ThreadFeaturesJSON)) {
            assert.equal(
              feature.representation,
              mode === 'full' ? 'machined-helix' : 'nominal-cylinder',
            );
            assert.deepEqual(feature.axis, [0, 0, 1]);
            assert.ok(feature.length > 0);
            assert.match(feature.designation, /inspection span unverified/);
          }
        const source = generateScript(spindle, p.parameters, 'default', p.id, undefined, mode);
        assert.equal(source.includes('Part.makeLongHelix'), mode === 'full');
        if (p.id.startsWith('zhj')) assert.match(source, /not manufacturer-verified/);
      }
    });
});

test('clamp back and cap share one bore without overlap and expose exact Y-axis rear/clamp fastener layout', () => {
  const layout = spindleMountLayout(spindleMountDefaults);
  assert.deepEqual(layout.clampBoltCenters, [
    [-49, 0, 0],
    [49, 0, 0],
  ]);
  assert.deepEqual(layout.rearMountHoleCenters, [
    [-49, -58, -12],
    [-49, -58, 12],
    [49, -58, -12],
    [49, -58, 12],
  ]);
  assert.deepEqual([layout.rearFaceY, layout.capFrontY, layout.outerWidth], [-58, 54, 116]);
  assert.equal(layout.clampThreadDepth, 14);
  assert.equal(layout.mountThreadDepth, 12);
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      for (const preset of mount.presets) {
        assert.deepEqual(validateParameters(mount, preset.parameters, 'default'), []);
        const bounds = checkPreview(mount, preset.parameters),
          s = spindleMountLayout(preset.parameters);
        assert.ok(Math.abs(bounds.min.z + s.clampHeight / 2) < 0.001);
        assert.equal(
          boundaryThreadCallouts(mountShape(preset.parameters)).length,
          preset.parameters.component === 'back' ? 6 : 0,
        );
        if (preset.parameters.component === 'back') {
          const features = boundaryThreadCallouts(mountShape(preset.parameters));
          assert.ok(features.every((t) => t.internal && t.pitch === 1 && t.axis?.[1] === 1));
          assert.equal(features.filter((t) => t.length === 14).length, 2);
          assert.equal(features.filter((t) => t.length === 12).length, 4);
        }
        assert.ok(preset.parameters.component === 'back' ? bounds.max.y < 0 : bounds.min.y > 0);
      }
    });
  assert.ok(
    validateParameters(
      mount,
      { ...mount.defaults, clampHeight: 32, clampBoltDiameter: '8', mountBoltDiameter: '8' },
      'default',
    ).length > 0,
  );
  assert.ok(
    validateParameters(mount, { ...mount.defaults, bodyDiameter: NaN }, 'default').length > 0,
  );
});

test(
  'complete native spindle and clamp macros retain positive closed connected external components and source metadata',
  { skip: !process.env.FREECAD_PYTHON, timeout: 300_000 },
  () => {
    const cases = [
      ...spindle.presets.flatMap((preset) =>
        (['simple', 'full'] as const).map((mode) => ({ part: spindle, preset, mode })),
      ),
      ...mount.presets.map((preset) => ({ part: mount, preset, mode: 'full' as const })),
      {
        part: mount,
        preset: mount.presets.find((p) => p.id === 'back-80')!,
        mode: 'simple' as const,
      },
    ].map(({ part, preset, mode }) => ({
      key: part.id + '/' + preset.id + '/' + mode,
      partId: part.id,
      mode,
      dimensions: part.dimensions(preset.parameters, 'default'),
      source: generateScript(part, preset.parameters, 'default', preset.id, undefined, mode),
      catalog: preset.catalog,
    }));
    const script = `import FreeCAD as App, Part, json
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
results=[]
for case in cases:
    doc=App.newDocument('SpindleRegression')
    try:
        exec(compile(case['source'],case['key'],'exec'),{})
        root=doc.RootObjects[0]
        assert root.PartId==case['partId'] and root.GeometryMode==case['mode']
        components=root.Group if root.TypeId=='App::Part' else [root]
        for obj in components:
            s=obj.Shape
            assert not s.isNull() and s.isValid() and s.isClosed() and s.Volume>0,case['key']+' '+obj.Label
            assert len(s.Solids)==1,case['key']+' disconnected component'
        combined=Part.makeCompound([obj.Shape for obj in components])
        vertices,_triangles=combined.tessellate(0.002)
        actual=[max(point[i] for point in vertices)-min(point[i] for point in vertices) for i in range(3)]
        assert all(abs(a-b)<0.01 for a,b in zip(actual,case['dimensions'])),(case['key'],actual,case['dimensions'])
        if case.get('catalog'):
            assert json.loads(root.CatalogDefinition)==case['catalog']
            assert all(hasattr(obj,'ThreadSpanBasis') for obj in components)
            for i,one in enumerate(components):
                for two in components[i+1:]:
                    assert one.Shape.common(two.Shape).Volume<0.001,case['key']+' overlapping exterior pieces'
        results.append({'key':case['key'],'dimensions':actual,'components':len(components),'validClosed':True})
    finally:
        App.closeDocument(doc.Name)
print('CNC_SPINDLE_PROOF='+json.dumps(results))
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-c', script], {
      encoding: 'utf8',
      timeout: 290_000,
      maxBuffer: 20_000_000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const line = result.stdout.split('\n').find((s) => s.startsWith('CNC_SPINDLE_PROOF='));
    assert.ok(line, result.stdout);
    const records = JSON.parse(line.slice('CNC_SPINDLE_PROOF='.length));
    assert.equal(records.length, 17);
    writeFileSync('/tmp/protolab-cnc-spindle-native-proof.json', JSON.stringify(records, null, 2));
  },
);
