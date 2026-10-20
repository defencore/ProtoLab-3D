import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import encoder, {
  encoderSpec,
  encoderParameters,
  encoderPieces,
} from '../src/parts/cnc-linear-encoder/part';
import { validateParameters } from '../src/core/validation';
import { withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

test('exact LS477 executions preserve source grade, interpolation, normal/short end blocks and separately ordered MSL41 identity', () => {
  const expected = [
    ['ls477-605365-86', 920, 1058, 1, '09A', 'msl41-770902-17'],
    ['ls477-605363-30', 1640, 1745, 1, '10A', 'msl41-770902-24'],
    ['ls477-605363-27', 270, 375, 0.5, '10A', 'msl41-770902-05'],
  ];
  assert.equal(encoder.presets.length, 6);
  for (const [id, travel, length, step, block, spar] of expected) {
    const s = encoderSpec(String(id)),
      preset = encoder.presets.find((row) => row.id === id)!;
    assert.deepEqual(
      [s.measuringLength, s.length, s.evaluatedStepMicrons, s.endBlock, s.pairedModel],
      [travel, length, step, block, spar],
    );
    assert.equal(s.accuracyMicrons, 3);
    assert.equal(s.supplyVolts, 5);
    assert.equal(s.maxNoLoadCurrentMilliamp, 140);
    assert.match(s.output, /Complementary TTL/);
    assert.equal(encoderSpec(String(spar)).pairedModel, id);
    assert.equal(encoderSpec(String(spar)).scaleLength, s.length);
    assert.equal(encoderSpec(String(spar)).scaleEndBlock, s.endBlock);
    assert.equal(preset.catalog!.sourceUrl, s.source);
    assert.match(preset.catalog!.geometryEvidence!.sourceSha256!, /^[0-9a-f]{64}$/);
    assert.match(preset.catalog!.geometryEvidence!.limitations, /recessed screw-seat depth/);
  }
  for (const row of encoder.presets)
    assert.deepEqual(validateParameters(encoder, row.parameters, 'default'), [], row.id);
});

test('manufacturer mounting datums retain asymmetric readhead holes and distinct spar/direct mounting planes', () => {
  const s = encoderSpec('ls477-605365-86');
  assert.deepEqual(
    s.readheadMounts.map((hole) => hole.position),
    [
      [-40.5, -0.25, -4],
      [15.5, -0.25, -4],
    ],
  );
  assert.equal(s.readheadMounts[1].position[0] - s.readheadMounts[0].position[0], 56);
  assert.equal(s.readheadRearY - s.sparBackY, 10);
  assert.equal(s.readheadDirectMountRearY, 0.25);
  assert.equal(s.sparBottomZ, -1);
  assert.equal(s.sparHeight - (s.readheadBottomZ - s.sparBottomZ), 48.1);
  assert.deepEqual(
    s.sparMounts.map((hole) => hole.position[0]),
    [-475, 475, 0],
  );
  assert.ok(s.sparMounts.every((hole) => hole.bolt === 'M6' && hole.seatVerified === false));
  assert.match(s.sparMounts[0].note, /not M8/);
  assert.equal(encoderSpec('msl41-770902-05').sparMounts.length, 2);
  assert.deepEqual(encoder.validate!(encoderParameters(s.id, 'readhead', 460), 'default'), []);
  assert.ok(
    encoder.validate!(encoderParameters(s.id, 'readhead', 461), 'default').some((error) =>
      /inside/.test(error),
    ),
  );
  assert.ok(
    encoder.validate!(encoderParameters(s.pairedModel, 'readhead'), 'default').some((error) =>
      /complete/.test(error),
    ),
  );
});

test('inspection split moves only the supplied readhead and retains finite supplier meshes in both modes', () => {
  const s = encoderSpec('ls477-605363-30');
  for (const mode of ['simple', 'full'] as const) {
    const fixed = encoderPieces(encoderParameters(s.id, 'scale', 0));
    assert.deepEqual(encoderPieces(encoderParameters(s.id, 'scale', 750)), fixed);
    const models = [0, 750].map((position) =>
      withGeometryMode(mode, () =>
        encoder.buildGeometry(encoderParameters(s.id, 'readhead', position), 'default'),
      ),
    );
    try {
      const boxes = models.map((model) => new Box3().setFromObject(model, true));
      assert.ok(Math.abs(boxes[1].min.x - boxes[0].min.x - 750) < 0.001);
      assert.ok(Math.abs(boxes[0].getSize(new Vector3()).x - 115) < 0.001);
      for (const model of models)
        model.traverse((object) => {
          if (object instanceof Mesh)
            assert.ok(
              Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite),
            );
        });
    } finally {
      models.forEach(disposeModel);
    }
    const script = generateScript(
      encoder,
      encoderParameters(s.id),
      'default',
      s.id,
      undefined,
      mode,
    );
    assert.ok(script.includes('CatalogDefinition') && script.includes('605363-30'));
    assert.ok(script.includes('IncludedInspectionRole'));
    assert.ok(script.includes('unpublished threads'));
  }
});

test(
  'optional native LS477 scale/readhead and separately ordered spars are closed positive purchased components in both modes',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const cases = encoder.presets.flatMap((preset) => {
      const s = encoderSpec(preset.parameters);
      return (s.kind === 'encoder' ? ['assembly', 'scale', 'readhead'] : ['assembly']).flatMap(
        (component) =>
          ['simple', 'full'].map((mode) => ({
            id: preset.id,
            component,
            mode,
            length: s.length,
            travel: s.measuringLength,
            source: generateScript(
              encoder,
              encoderParameters(preset.id, component),
              'default',
              preset.id,
              undefined,
              mode as 'simple' | 'full',
            ),
          })),
      );
    });
    const script = `import FreeCAD as App, Part, json\ncases=json.loads(${JSON.stringify(JSON.stringify(cases))})\nfor case in cases:\n    doc=App.newDocument('LinearEncoder')\n    try:\n        exec(compile(case['source'],case['id'],'exec'),{})\n        root=doc.RootObjects[0]\n        assert root.GeometryMode==case['mode']\n        assert case['id'].split('-')[-1] in json.loads(root.CatalogDefinition)['designation']\n        physical=root.Group if hasattr(root,'Group') else [root]\n        for item in physical:\n            s=item.Shape\n            assert not s.isNull() and s.isValid() and s.isClosed() and len(s.Solids)==1 and s.Volume>0,(case['id'],item.Label)\n            assert item.PurchasedUnit\n        bound=Part.makeCompound([item.Shape for item in physical]).BoundBox\n        expected=115 if case['component']=='readhead' else case['length']\n        assert abs(bound.XLength-expected)<0.001,(case,bound.XLength)\n    finally:\n        App.closeDocument(doc.Name)\nprint('LINEAR_ENCODER_NATIVE='+str(len(cases)))\n`;
    const r = spawnSync(process.env.FREECAD_PYTHON!, ['-c', script], {
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 2000000,
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(r.stdout.includes('LINEAR_ENCODER_NATIVE=24'));
  },
);
