import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import test from 'node:test';
import { addProduct, createProject } from '../src/core/design-project';
import { generateScript } from '../src/core/freecad';
import { generateProjectScript } from '../src/core/project-freecad';
import type { Preset } from '../src/core/types';
import standoff from '../src/parts/pcb-standoff/part';
import insert from '../src/parts/pcb-standoff-insert/part';
import sleeve from '../src/parts/dremec-spacer-sleeve/part';

function standaloneRecord(script: string, property: string): unknown {
  const match = script.match(new RegExp(`^        obj\\.${property} = (.*)$`, 'm'));
  assert.ok(match, `${property} must survive standalone export`);
  return JSON.parse(JSON.parse(match[1]));
}

function projectRecords(
  script: string,
): Record<
  string,
  { catalog?: Preset['catalog']; geometryEvidence: { kind: string; sourceSha256?: string } }
> {
  const match = script.match(/^_provenance = json\.loads\((.*)\)$/m);
  assert.ok(match, 'The occurrence metadata must retain its configuration source records');
  return JSON.parse(JSON.parse(match[1]));
}

function findModel(name: string) {
  const preset = standoff.presets.find((item) => item.name === name);
  assert.ok(preset, `Missing supplier model ${name}`);
  return preset;
}

test('standalone catalog records preserve every source link, hash, specification and unresolved dimension in both modes', () => {
  const kosmodrom = findModel('TFM-M3X8');
  const dremec = standoff.presets.find(
    (item) => item.name.startsWith('213x') && item.name.endsWith('k'),
  )!;
  const composite = insert.presets[0];
  assert.ok(dremec);
  assert.ok(kosmodrom.catalog!.alternateSourceUrls!.some((url) => /KLS8-DBL\.pdf$/.test(url)));
  assert.ok(dremec.catalog!.alternateSourceUrls!.some((url) => /#page=4$/.test(url)));
  for (const [part, preset] of [
    [standoff, kosmodrom],
    [standoff, dremec],
    [insert, composite],
  ] as const) {
    for (const mode of ['simple', 'full'] as const) {
      const script = generateScript(part, preset.parameters, 'default', preset.id, undefined, mode);
      assert.deepEqual(standaloneRecord(script, 'CatalogDefinition'), preset.catalog);
      assert.deepEqual(
        standaloneRecord(script, 'CatalogDimensions'),
        Object.fromEntries(
          preset.catalog!.verifiedParameters.map((key) => [key, preset.parameters[key]]),
        ),
      );
      assert.ok(
        !Object.hasOwn(standaloneRecord(script, 'CatalogDimensions') as object, 'threadPitchA'),
      );
      assert.match(script, new RegExp(`obj\\.GeometryMode = "${mode}"`));
    }
  }
});

test('project occurrences preserve exact supplier evidence independently of editable procurement instructions', () => {
  const parts = [standoff, insert, sleeve];
  const disputed = findModel('TFM-M3X25');
  const composite = insert.presets[0];
  let project = createProject('Supplier provenance');
  for (const [part, preset] of [
    [standoff, disputed],
    [insert, composite],
  ] as const)
    project = addProduct(project, parts, {
      part,
      parameters: preset.parameters,
      state: 'default',
      presetId: preset.id,
    }).project;
  project.configurations[0].procurement!.source = 'Buyer delivery instruction';
  for (const mode of ['simple', 'full'] as const) {
    const script = generateProjectScript(project, parts, mode);
    const records = projectRecords(script);
    assert.match(script, /obj\.CatalogDefinition = json\.dumps\(provenance\["catalog"\]\)/);
    assert.match(script, /obj\.GeometryEvidence = json\.dumps\(provenance\["geometryEvidence"\]\)/);
    assert.ok(script.includes('Buyer delivery instruction'));
    for (const configuration of project.configurations) {
      const preset = parts
        .find((part) => part.id === configuration.libraryId)!
        .presets.find((item) => item.id === configuration.presetId)!;
      assert.deepEqual(records[configuration.id].catalog, preset.catalog);
      assert.equal(
        records[configuration.id].geometryEvidence.sourceSha256,
        preset.catalog!.geometryEvidence!.sourceSha256,
      );
    }
    assert.match(
      JSON.stringify(records[project.configurations[0].id].catalog!.specifications),
      /31 mm/,
    );
    assert.ok(
      !records[project.configurations[0].id].catalog!.verifiedParameters.includes('bodyLength'),
    );
    assert.match(script, new RegExp(`"GeometryMode": "${mode}"`));
  }
});

test('edited custom sleeve dimensions never inherit an unmatched stock catalog record', () => {
  const preset = sleeve.presets.find((item) => item.parameters.material === 'steel')!;
  const parameters = { ...preset.parameters, outerDiameter: 8, bore: 3.2, length: 24 };
  const script = generateScript(sleeve, parameters, 'default', preset.id, undefined, 'simple');
  assert.ok(!script.includes('obj.CatalogDefinition'));
  assert.ok(script.includes(preset.catalog!.sourceUrl));
  const project = addProduct(createProject('Custom sleeve'), [sleeve], {
    part: sleeve,
    parameters,
    state: 'default',
    presetId: preset.id,
  }).project;
  const projectScript = generateProjectScript(project, [sleeve], 'simple');
  const record = projectRecords(projectScript)[project.configurations[0].id];
  assert.equal(record.catalog, undefined);
  assert.equal(record.geometryEvidence.kind, 'parametric');
  assert.ok(projectScript.includes(preset.catalog!.sourceUrl));
});

test(
  'native Simple and Full projects retain supplier provenance without inventing purchased internal identities',
  { skip: !process.env.FREECAD_PYTHON, timeout: 180_000 },
  () => {
    const parts = [standoff, insert, sleeve];
    const short = findModel('213x10k');
    const composite = insert.presets.find((preset) => preset.name === '2183x15')!;
    const custom = sleeve.presets.find((preset) => preset.parameters.material === 'steel')!;
    assert.ok(composite);
    const selections = [
      { part: standoff, preset: findModel('TFF-M3X7'), componentCount: 1 },
      { part: standoff, preset: short, componentCount: 1 },
      { part: insert, preset: composite, componentCount: 2 },
      {
        part: sleeve,
        preset: custom,
        parameters: { ...custom.parameters, outerDiameter: 8, bore: 3.2, length: 24 },
        componentCount: 1,
      },
    ];
    let project = createProject('Standoff supplier provenance native fixture');
    project.id = 'project-standoff-native-provenance';
    project.designation = 'SOURCE.001';
    for (const selection of selections)
      project = addProduct(project, parts, {
        part: selection.part,
        parameters: selection.parameters ?? selection.preset.parameters,
        state: 'default',
        presetId: selection.preset.id,
      }).project;
    // Deterministic project identities make macro hashes reproducible.
    const identities = new Map<string, string>();
    project.configurations.forEach((configuration, index) => {
      const id = `configuration-source-${index}`;
      identities.set(configuration.id, id);
      configuration.id = id;
    });
    project.occurrences.forEach((occurrence, index) => {
      occurrence.id = `occurrence-source-${index}`;
      occurrence.configurationId = identities.get(occurrence.configurationId)!;
      occurrence.placement.translation = [index * 40, 0, 0];
    });
    const products = selections.map((selection, index) => ({
      occurrenceId: project.occurrences[index].id,
      configurationId: project.occurrences[index].configurationId,
      presetId: selection.preset.id,
      catalog: selection.parameters ? undefined : selection.preset.catalog,
      supplierUrl: selection.preset.catalog!.sourceUrl,
      custom: !!selection.parameters,
      componentCount: selection.componentCount,
      expectedDimensions: selection.part.dimensions(
        selection.parameters ?? selection.preset.parameters,
        'default',
      ),
    }));
    const cases = (['simple', 'full'] as const).map((mode) => ({
      mode,
      source: generateProjectScript(project, parts, mode),
    }));
    const script = `import FreeCAD as App, Part, json
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
products=json.loads(${JSON.stringify(JSON.stringify(products))})
results=[]
for case in cases:
    doc=App.newDocument('StandoffProjectProvenance')
    try:
        exec(compile(case['source'],'project-'+case['mode'],'exec'),{})
        roots=[obj for obj in doc.Objects if hasattr(obj,'ProjectDefinition')]
        assert len(roots)==1 and roots[0].GeometryMode==case['mode']
        root=roots[0]
        occurrences={obj.OccurrenceId:obj for obj in doc.Objects if hasattr(obj,'OccurrenceId')}
        physical=[obj for obj in doc.Objects if obj.TypeId=='Part::Feature']
        assert len(occurrences)==4 and len(root.Group)==4
        assert len(physical)==5,'supplier internals are geometry, never extra physical BOM identities'
        assert all(not hasattr(obj,'OccurrenceId') and not hasattr(obj,'ConfigurationId') for obj in physical)
        assert len(json.loads(root.ProjectDefinition)['configurations'])==4
        records=[]
        for product in products:
            occurrence=occurrences[product['occurrenceId']]
            assert occurrence.ConfigurationId==product['configurationId']
            assert occurrence.SupplyPolicy=='purchased' and occurrence.BOMQuantity==1
            assert occurrence.GeometryMode==case['mode']
            components=occurrence.Group
            assert len(components)==product['componentCount']
            evidence=json.loads(occurrence.GeometryEvidence)
            if product['custom']:
                assert not hasattr(occurrence,'CatalogDefinition'),'edited dimensions must not inherit a stock catalog record'
                assert evidence['kind']=='parametric' and 'presetId' not in evidence
                assert components[0].SupplierProductSource==product['supplierUrl']
                assert 'no stock SKU' in components[0].OrderStatus
                assert json.loads(components[0].CustomOrderDimensions)=={'outsideDiameter':8,'bore':3.2,'length':24}
                assert not hasattr(components[0],'ThreadFeaturesJSON')
            else:
                catalog=json.loads(occurrence.CatalogDefinition)
                assert catalog==product['catalog'],'supporting links, SHA, limits and specifications remain exact'
                assert evidence['presetId']==product['presetId']
                assert evidence['sourceSha256']==catalog['geometryEvidence']['sourceSha256']
                assert evidence['limitations']==catalog['geometryEvidence']['limitations']
                assert any('.pdf' in url for url in catalog['alternateSourceUrls'])
                assert all(obj.SupplierCatalogItem==product['presetId'] for obj in components)
                if product['presetId'].startswith('kosmodrom-'):
                    assert not hasattr(components[0],'ThreadFeaturesJSON')
                    envelopes=json.loads(components[0].NominalBoreEnvelopeJSON)
                    assert len(envelopes)==2 and all(not row['verified'] for row in envelopes)
                if product['presetId'].endswith('213x10k'):
                    assert any(url.endswith('#page=4') for url in catalog['alternateSourceUrls'])
                    assert json.loads(root.ProjectDefinition)['configurations'][1]['parameters']['maleLengthB']==6
            for index,component in enumerate(components):
                shape=component.Shape
                assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0
                for other in components[index+1:]: assert shape.common(other.Shape).Volume<1e-8
            shape=Part.makeCompound([obj.Shape for obj in components])
            shape.tessellate(0.005)
            bounds=shape.optimalBoundingBox(True,False)
            dimensions=[bounds.XLength,bounds.YLength,bounds.ZLength]
            assert all(abs(actual-expected)<0.03 for actual,expected in zip(dimensions,product['expectedDimensions'])),dimensions
            if product['custom']:
                assert not shape.Solids[0].isInside(App.Vector(0,0,12),1e-7,True),'custom sleeve retains a through bore'
            records.append({'presetId':product['presetId'],'components':len(components),'catalogPresent':not product['custom'],'dimensions':dimensions,'volume':shape.Volume})
        results.append({'mode':case['mode'],'occurrences':len(occurrences),'components':len(physical),'products':records,'freecadVersion':App.Version()})
    finally: App.closeDocument(doc.Name)
print('PASS standoff project provenance: '+json.dumps(results))
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: script,
      encoding: 'utf8',
      timeout: 170_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    const prefix = 'PASS standoff project provenance: ';
    const line = result.stdout.split('\n').find((item) => item.startsWith(prefix));
    assert.ok(line);
    const measured = JSON.parse(line.slice(prefix.length));
    assert.equal(measured.length, 2);
    if (process.env.STANDOFF_PROJECT_NATIVE_PROOF)
      writeFileSync(
        process.env.STANDOFF_PROJECT_NATIVE_PROOF,
        JSON.stringify(
          cases.map((item, index) => ({
            ...measured[index],
            macroSha256: createHash('sha256').update(item.source).digest('hex'),
            sourceRecords: products.map((product) => ({
              presetId: product.presetId,
              catalogSource: product.supplierUrl,
              ...(product.catalog
                ? { sourceSha256: product.catalog.geometryEvidence!.sourceSha256 }
                : {}),
              expectedDimensions: product.expectedDimensions,
            })),
          })),
          null,
          2,
        ) + '\n',
      );
  },
);
