import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { dremecPresets } from '../src/catalog/dremec-presets';
import { kosmodromPresets } from '../src/catalog/kosmodrom-presets';
import { dremecSleevePresets } from '../src/catalog/dremec-sleeve-presets';
import detail from '../src/parts/pcb-standoff/part';
import insert from '../src/parts/pcb-standoff-insert/part';
import sleeve from '../src/parts/dremec-spacer-sleeve/part';
import { parameterSchema, catalogFields } from '../src/parts/pcb-standoff/lib/schema';
import { validateStandoff, pieces } from '../src/parts/pcb-standoff/lib/model';
import { validateParameters } from '../src/core/validation';
import { modelEvidence } from '../src/core/model-evidence';
import { withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import type { PartDefinition, Preset } from '../src/core/types';

const dremec = dremecPresets();
const kosmodrom = kosmodromPresets();
const sleeves = dremecSleevePresets();
const details = [...dremec.detail, ...kosmodrom];
interface Selection {
  part: PartDefinition;
  preset: Preset;
  composite?: boolean;
  custom?: boolean;
}
function selected(
  name: string,
  composite = false,
  vendor: 'dremec' | 'kosmodrom' = 'dremec',
): Selection {
  const presets = composite ? dremec.insert : details;
  const preset = presets.find(
    (row) =>
      row.name === name &&
      (vendor === 'dremec' ? row.id.startsWith('dremec-') : row.id.startsWith('kosmodrom-')),
  );
  assert.ok(preset, name);
  return {
    composite,
    preset,
    part: {
      ...(composite ? insert : detail),
      presets,
      defaults: preset.parameters,
      parameters: parameterSchema(presets, composite),
      catalogFilterFields: catalogFields(presets),
      validate: (parameters) => validateStandoff(parameters, presets, composite),
    },
  };
}
const nativeRepresentatives = [
  selected('113x5'), // source-confirmed continuous through thread
  selected('113x18'), // separate, exactly meeting source spans
  selected('2103x5/4'), // UNC female and metric male
  selected('214ST2.9x8'), // external ST d1/d2, unspecified pitch
  selected('2183x15', true), // unknown hidden insert; actual visible brass stud
  selected('432x5'), // missing source male span, qualified envelope
  selected('TFF-M3X10', false, 'kosmodrom'), // actual KLS AF5 / H5.5 envelope
  selected('TFM-M3X25', false, 'kosmodrom'), // disputed body, unknown stud span
];
const customSelections: Selection[] = sleeves.map((preset) => ({
  preset,
  custom: true,
  part: { ...sleeve, presets: sleeves },
}));
const previews = [
  ...nativeRepresentatives,
  selected('181x5'),
  selected('185rdx60'),
  selected('426x100'),
  selected('1413x100'),
  selected('1181510x100', true),
  selected('214x70k'),
  selected('2130x6/8'),
  ...customSelections,
];

function previewVolume(mesh: Mesh): number {
  const p = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.getIndex();
  let result = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const points = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j),
    );
    assert.ok(points.every((point) => point.toArray().every(Number.isFinite)));
    assert.ok(
      points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length() > 1e-9,
      'no collapsed source-preview triangle',
    );
    result += points[0].dot(points[1].clone().cross(points[2])) / 6;
  }
  return result;
}

test('actual source presets select their own supplier evidence and preserve material/form/extreme preview dimensions', () => {
  for (const selection of previews) {
    const { part, preset } = selection;
    assert.deepEqual(validateParameters(part, preset.parameters, 'default'), [], preset.id);
    const evidence = modelEvidence(part, preset.parameters, preset.id);
    assert.equal(evidence.presetId, preset.id);
    assert.equal(evidence.source, preset.catalog!.geometryEvidence!.sourceUrl);
    assert.equal(evidence.sourceSha256, preset.catalog!.geometryEvidence!.sourceSha256);
    for (const mode of ['simple', 'full'] as const)
      withGeometryMode(mode, () => {
        const model = part.buildGeometry(preset.parameters, 'default');
        try {
          const measured = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
          part
            .dimensions(preset.parameters, 'default')
            .forEach((expected, axis) =>
              assert.ok(
                Math.abs(measured[axis] - expected) < 0.002,
                preset.id + '/' + mode + ' bbox ' + axis,
              ),
            );
          model.traverse((object) => {
            if (object instanceof Mesh)
              assert.ok(previewVolume(object) > 0, preset.id + ' outward volume');
          });
          if (preset.name === 'TFF-M3X10')
            assert.ok(Math.abs(measured[0] - 5.5) < 1e-5 && Math.abs(measured[1] - 5) < 1e-5);
        } finally {
          disposeModel(model);
        }
      });
  }
});

test('actual unresolved and mixed supplier interfaces retain their published identity without invented manufacturing features', () => {
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const mixed = pieces(selected('2103x5/4').preset.parameters)[0].metadata;
      assert.deepEqual(
        new Set(
          JSON.parse(mixed.ThreadFeaturesJSON).map(
            (feature: { designation: string }) => feature.designation,
          ),
        ),
        new Set(['M3', 'UNC4-40']),
      );
      const st = pieces(selected('214ST2.9x8').preset.parameters)[0].metadata;
      assert.equal(JSON.parse(st.ThreadFeaturesJSON).length, 1);
      assert.equal(st.SupplierThreadDesignationB, 'ST2.9');
      assert.deepEqual(JSON.parse(st.SourceThreadRootDiametersJSON), { B: 2.1 });
      const missing = pieces(selected('432x5').preset.parameters)[0].metadata;
      assert.equal(missing.ThreadFeaturesJSON, undefined);
      assert.equal(JSON.parse(missing.NominalStudEnvelopeJSON).length, 2);
      assert.ok(
        JSON.parse(missing.NominalStudEnvelopeJSON).every(
          (row: { verified: boolean }) => row.verified === false,
        ),
      );
      const clipped = pieces(selected('TFF-M3X10', false, 'kosmodrom').preset.parameters)[0]
        .metadata;
      assert.equal(clipped.ThreadFeaturesJSON, undefined);
      assert.equal(JSON.parse(clipped.NominalBoreEnvelopeJSON).length, 2);
      const disputed = selected('TFM-M3X25', false, 'kosmodrom').preset;
      assert.ok(!disputed.catalog!.verifiedParameters.includes('bodyLength'));
      assert.ok(!disputed.catalog!.verifiedParameters.includes('maleLengthB'));
      assert.equal(pieces(disputed.parameters)[0].metadata.ThreadFeaturesJSON, undefined);
      const exposed = pieces(selected('2183x15', true).preset.parameters, true);
      assert.equal(exposed.length, 2);
      assert.equal(exposed[1].appearance, 'brass');
      assert.equal(JSON.parse(exposed[1].metadata.ThreadFeaturesJSON)[0].length, 8);
    });
});

test('four custom sleeve materials keep customer-order status and do not turn a range into stocked SKUs', () => {
  assert.equal(sleeves.length, 4);
  assert.equal(new Set(sleeves.map((preset) => preset.parameters.material)).size, 4);
  for (const preset of sleeves) {
    assert.match(
      JSON.stringify(preset.catalog!.specifications),
      /not a generated stock combination/,
    );
    if (preset.parameters.material === 'steel') {
      assert.equal(preset.catalog!.designation, '324/2.1x10');
      assert.equal(preset.catalog!.geometryEvidence!.kind, 'source-dimensions');
    } else {
      assert.equal(preset.catalog!.geometryEvidence!.kind, 'envelope');
      assert.deepEqual(preset.catalog!.verifiedParameters, ['material']);
    }
  }
  const extreme = { ...sleeve.defaults, outerDiameter: 36, bore: 35, length: 60 };
  assert.deepEqual(validateParameters(sleeve, extreme, 'default'), []);
  const model = sleeve.buildGeometry(extreme, 'default');
  try {
    const dimensions = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
    [36, 36, 60].forEach((expected, axis) =>
      assert.ok(Math.abs(dimensions[axis] - expected) < 0.002, 'thin-wall sleeve envelope'),
    );
  } finally {
    disposeModel(model);
  }
});

test(
  'twenty source-associated native macros preserve actual suppliers, dimensions, thread qualification and custom material orders',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    const cases = [
      ...nativeRepresentatives.flatMap((selection) =>
        (['simple', 'full'] as const).map((mode) => ({ ...selection, mode })),
      ),
      ...customSelections.map((selection, index) => ({
        ...selection,
        mode: (index % 2 ? 'full' : 'simple') as 'simple' | 'full',
      })),
    ].map(({ part, preset, mode, composite, custom }) => ({
      partId: part.id,
      presetId: preset.id,
      name: preset.name,
      mode,
      custom: !!custom,
      parameters: preset.parameters,
      catalogSource: preset.catalog!.sourceUrl,
      catalog: preset.catalog,
      designation: preset.catalog!.designation,
      sourceSha256: preset.catalog!.geometryEvidence!.sourceSha256,
      evidenceSource: preset.catalog!.geometryEvidence!.sourceUrl,
      evidenceKind: preset.catalog!.geometryEvidence!.kind,
      verified: preset.catalog!.verifiedParameters,
      materialGrade: preset.catalog!.specifications?.find((row) => row.label === 'Material grade')
        ?.value,
      expectedDimensions: part.dimensions(preset.parameters, 'default'),
      componentMetadata: custom
        ? undefined
        : withGeometryMode(mode, () =>
            pieces(preset.parameters, !!composite).map((piece) => piece.metadata),
          ),
      source: generateScript(part, preset.parameters, 'default', preset.id, undefined, mode),
    }));
    assert.equal(cases.length, 20);
    const script = `import FreeCAD as App, Part, json, ast
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
results=[]
for case in cases:
    doc=App.newDocument('SourceCatalogRegression')
    try:
        exec(compile(case['source'],case['presetId']+'/'+case['mode'],'exec'),{})
        assert len(doc.RootObjects)==1
        root=doc.RootObjects[0]
        assert root.PartId==case['partId'] and root.GeometryMode==case['mode']
        assert json.loads(root.Configuration)==case['parameters']
        assert root.CatalogDesignation==case['designation']
        assert root.CatalogSource==case['catalogSource']
        assert json.loads(root.CatalogDefinition)==case['catalog'],'complete source provenance is retained'
        evidence=json.loads(root.GeometryEvidence)
        assert evidence['presetId']==case['presetId'] and evidence['sourceSha256']==case['sourceSha256']
        assert evidence['source']==case['evidenceSource'] and evidence['kind']==case['evidenceKind']
        published=json.loads(root.CatalogDimensions)
        assert set(published)==set(case['verified'])
        components=root.Group if root.TypeId=='App::Part' else [root]
        for index,component in enumerate(components):
            shape=component.Shape
            assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0
            if case['custom']:
                assert component.SupplierProductSource==case['catalogSource']
                assert component.SupplierMaterialGrade==case['materialGrade']
                assert 'no stock SKU' in component.OrderStatus
                assert not hasattr(component,'ThreadFeaturesJSON')
            else:
                assert component.SupplierCatalogItem==case['parameters']['catalogItem']
                expected=case['componentMetadata'][index]
                for property_name in ['ThreadFeaturesJSON','ThreadCallouts','NominalBoreEnvelopeJSON','NominalStudEnvelopeJSON']:
                    assert getattr(component,property_name,None)==expected.get(property_name),case['name']+'/'+property_name
            for other in components[index+1:]:assert shape.common(other.Shape).Volume<1e-8
        shape=Part.makeCompound([component.Shape for component in components])
        shape.tessellate(0.005)
        bounds=shape.optimalBoundingBox(True,False)
        dimensions=[bounds.XLength,bounds.YLength,bounds.ZLength]
        assert all(abs(actual-expected)<0.03 for actual,expected in zip(dimensions,case['expectedDimensions'])),(case['name'],dimensions)
        if case['name']=='TFF-M3X10':
            assert abs(dimensions[0]-5.5)<0.003 and abs(dimensions[1]-5)<0.003
            assert shape.Solids[0].isInside(App.Vector(0,0,5),1e-7,True),'source blind topology retains web'
            assert not hasattr(components[0],'ThreadFeaturesJSON')
        if case['name']=='TFM-M3X25':
            assert 'bodyLength' not in published and 'maleLengthB' not in published
            assert not hasattr(components[0],'ThreadFeaturesJSON')
        if case['name']=='2183x15':
            assert len(components)==2
            assert components[1].Label.startswith('Exposed brass stud')
            colors=ast.literal_eval(next(line.strip()[len('component_colors = '):] for line in case['source'].splitlines() if line.strip().startswith('component_colors = [')))
            assert colors[1][0]>colors[1][2]+0.05
        if case['custom']:
            assert not shape.Solids[0].isInside(App.Vector(0,0,case['parameters']['length']/2),1e-7,True),'plain sleeve is through bored'
        results.append({'item':case['presetId'],'mode':case['mode'],'components':len(components),'dimensions':dimensions,'volume':shape.Volume})
    finally:App.closeDocument(doc.Name)
print('PASS source catalog native macros: '+json.dumps(results))
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: script,
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    const line = result.stdout
      .split('\n')
      .find((line) => line.startsWith('PASS source catalog native macros: '));
    assert.ok(line);
    const measured = JSON.parse(line.slice('PASS source catalog native macros: '.length));
    assert.equal(measured.length, 20);
    if (process.env.STANDOFF_NATIVE_PROOF)
      writeFileSync(
        process.env.STANDOFF_NATIVE_PROOF,
        JSON.stringify(
          cases.map((row, index) => ({
            ...measured[index],
            sourceSha256: row.sourceSha256,
            catalogSource: row.catalogSource,
            macroSha256: createHash('sha256').update(row.source).digest('hex'),
            expectedDimensions: row.expectedDimensions,
            maximumDimensionError: Math.max(
              ...row.expectedDimensions.map((expected, axis) =>
                Math.abs(measured[index].dimensions[axis] - expected),
              ),
            ),
            verifiedParameters: row.verified,
          })),
          null,
          2,
        ) + '\n',
      );
  },
);
