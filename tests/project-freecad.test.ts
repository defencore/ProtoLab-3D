import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Group } from 'three';
import { addProduct, createProject } from '../src/core/design-project';
import { generateProjectScript } from '../src/core/project-freecad';
import type { PartDefinition } from '../src/core/types';
import bolt from '../src/parts/bolt-screw/part';

function fixture() {
  const detail: PartDefinition = {
    id: 'fixture-detail',
    name: 'Machined plate',
    category: 'TEST',
    subgroup: 'TEST',
    description: 'Project export fixture.',
    keywords: [],
    icon: 'box',
    complexity: 'Fixed',
    product: {
      kind: 'detail',
      supply: 'manufactured',
      description: 'A machined plate.',
      processes: ['milling'],
      releaseRequirements: ['Verify the drawing and material.'],
    },
    parameters: [],
    defaults: {},
    presets: [],
    validate: () => [],
    buildGeometry: () => new Group(),
    dimensions: () => [10, 4, 2],
    python: () => 'shape = Part.makeBox(10, 4, 2)',
  };
  const supplier: PartDefinition = {
    ...detail,
    id: 'fixture-supplier',
    name: 'Supplier assembly',
    product: { ...detail.product, kind: 'assembly', supply: 'purchased', processes: [] },
    python:
      () => `shape = Part.makeCompound([Part.makeCylinder(2, 5), Part.makeCylinder(1, 3, App.Vector(0, 0, 5))])
component_labels = ['Supplier housing', 'Supplier shaft']
component_colors = [(0.2, 0.3, 0.4), (0.6, 0.7, 0.8)]
component_metadata = [{'Role': 'housing'}, {'Role': 'shaft'}]`,
  };
  const assembly: PartDefinition = {
    ...detail,
    id: 'fixture-assembly',
    name: 'Bolted assembly',
    product: { ...detail.product, kind: 'assembly', processes: ['assembly'] },
    python: () => 'raise AssertionError("Parent envelope must not duplicate its children")',
  };
  const parts = [detail, supplier, assembly];
  const project = createProject('Occurrence placement fixture');
  project.designation = 'TEST.001';
  const selection = (part: PartDefinition) => ({ part, parameters: {}, state: 'default' });
  let added = addProduct(project, parts, selection(assembly));
  const rootId = added.occurrenceId;
  const root = added.project.occurrences[0];
  root.placement = { translation: [100, 200, 300], rotation: [30, 20, 10] };
  added = addProduct(added.project, parts, selection(detail), rootId);
  const first = added.project.occurrences.find((item) => item.id === added.occurrenceId)!;
  first.quantity = 3;
  first.placement = { translation: [12, 5, 7], rotation: [0, 0, 90] };
  added = addProduct(added.project, parts, selection(detail), rootId);
  added.project.occurrences.find((item) => item.id === added.occurrenceId)!.placement.translation =
    [40, 0, 0];
  added = addProduct(added.project, parts, selection(supplier), rootId);
  const bought = added.project.occurrences.find((item) => item.id === added.occurrenceId)!;
  bought.quantity = 2;
  const boughtConfiguration = added.project.configurations.find(
    (item) => item.id === bought.configurationId,
  )!;
  boughtConfiguration.procurement = {
    designation: 'OEM.123',
    manufacturer: 'Fixture OEM',
    source: 'Supplier drawing',
  };
  return { project: added.project, parts, firstId: first.id, supplierId: bought.id };
}

test('project macro rejects invalid hierarchy and reuses library definitions without changing its source project', () => {
  const { project, parts } = fixture();
  const before = structuredClone(project);
  const macro = generateProjectScript(project, parts);
  assert.deepEqual(project, before);
  assert.equal((macro.match(/shape = Part.makeBox/g) ?? []).length, 1);
  assert.doesNotMatch(macro, /Parent envelope must not duplicate its children/);
  assert.match(macro, /EngineeringReviewRequirements/);
  assert.match(macro, /BOMQuantity/);
  assert.match(macro, /abortTransaction/);
  const bad = structuredClone(project);
  bad.occurrences[1].parentId = 'missing-parent';
  assert.throws(() => generateProjectScript(bad, parts), /parent|orphan/i);
});

test(
  'project native CAD retains nested placements, opaque supplier identity and quantity metadata',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const { project, parts, firstId, supplierId } = fixture();
    const script = `${generateProjectScript(project, parts)}
doc = App.ActiveDocument
occurrences = {obj.OccurrenceId: obj for obj in doc.Objects if hasattr(obj, 'OccurrenceId')}
assert len(occurrences) == 4
physical = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
assert len(physical) == 4, 'BOM quantities must not invent additional spatial placements'
assert all(obj.Shape.isValid() and obj.Shape.isClosed() and obj.Shape.Volume > 0 for obj in physical)
plate = occurrences[${JSON.stringify(firstId)}]
assert plate.BOMQuantity == 3 and len(plate.Group) == 1
rotation = App.Rotation(App.Vector(0,0,1),10).multiply(App.Rotation(App.Vector(0,1,0),20)).multiply(App.Rotation(App.Vector(1,0,0),30))
expected = App.Placement(App.Vector(100,200,300), rotation).multiply(App.Placement(App.Vector(12,5,7), App.Rotation(App.Vector(0,0,1),90)))
actual = plate.getGlobalPlacement()
for point in [App.Vector(), App.Vector(10,0,0), App.Vector(0,4,2)]:
 assert (actual.multVec(point) - expected.multVec(point)).Length < 1e-8
bought = occurrences[${JSON.stringify(supplierId)}]
assert bought.SupplyPolicy == 'purchased' and bought.BOMQuantity == 2
assert len(bought.Group) == 2 and json.loads(bought.ProcurementDefinition)['designation'] == 'OEM.123'
assert [obj.Label for obj in bought.Group] == ['Supplier housing', 'Supplier shaft']
assert json.loads(bought.Group[0].ManufacturingMetadata)['Role'] == 'housing'
roots = [obj for obj in doc.Objects if hasattr(obj, 'ProjectDefinition')]
assert len(roots) == 1 and len(roots[0].Group) == 1
assert json.loads(roots[0].ProjectDefinition)['documentationPolicy'] == 'enterprise-eskd'
assert roots[0].EngineeringReviewRequirements
print('PROJECT_CAD_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: script,
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PROJECT_CAD_OK/);
  },
);

test(
  'project native export removes partial objects when a supplier component is invalid',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const { project, parts } = fixture();
    const broken = parts.map((part) =>
      part.id === 'fixture-supplier'
        ? {
            ...part,
            python: () => 'shape = Part.Shape()',
          }
        : part,
    );
    const script = `import FreeCAD as App
doc = App.newDocument('RollbackFixture')
sentinel = doc.addObject('App::Part', 'ExistingProject')
before = set(obj.Name for obj in doc.Objects)
try:
 exec(${JSON.stringify(generateProjectScript(project, broken))})
except ValueError as error:
 assert 'Invalid configured library product' in str(error)
else:
 raise AssertionError('Invalid geometry must fail export')
assert set(obj.Name for obj in doc.Objects) == before
print('PROJECT_ROLLBACK_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: script,
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PROJECT_ROLLBACK_OK/);
  },
);

test('project thread detail belongs to the export, preserving project identity and specification data', () => {
  const added = addProduct(createProject('Thread detail fixture'), [bolt], {
    part: bolt,
    parameters: { ...bolt.defaults },
    state: 'default',
  });
  const before = structuredClone(added.project);
  const simple = generateProjectScript(added.project, [bolt], 'simple');
  const full = generateProjectScript(added.project, [bolt], 'full');
  assert.doesNotMatch(simple, /Part\.makeLongHelix/);
  assert.match(full, /Part\.makeLongHelix/);
  assert.match(simple, /root.GeometryMode = "simple"/);
  assert.match(full, /root.GeometryMode = "full"/);
  assert.deepEqual(added.project, before);
});

test(
  'native project thread modes preserve closed solids, callouts and independently placed reused details',
  { skip: !process.env.FREECAD_PYTHON, timeout: 120000 },
  () => {
    let added = addProduct(createProject('Thread detail fixture'), [bolt], {
      part: bolt,
      parameters: { ...bolt.defaults },
      state: 'default',
    });
    added = addProduct(added.project, [bolt], {
      part: bolt,
      parameters: { ...bolt.defaults },
      state: 'default',
    });
    added.project.occurrences[1].placement.translation = [40, 0, 0];
    const scripts = ['simple', 'full'].map((mode) =>
      generateProjectScript(added.project, [bolt], mode as 'simple' | 'full'),
    );
    const drawingMacro = readFileSync('docs/recovery/SelectedPartDrawing.FCMacro', 'utf8');
    const code = `import FreeCAD as App, Part, json
records = []
for mode, source in zip(['simple','full'], json.loads(${JSON.stringify(JSON.stringify(scripts))})):
 doc = App.newDocument('ProjectThreadMode')
 exec(source, {})
 root = next(obj for obj in doc.Objects if hasattr(obj,'ProjectDefinition'))
 assert root.GeometryMode == mode
 physical = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
 assert len(physical) == 2
 assert all(obj.Shape.isValid() and obj.Shape.isClosed() and len(obj.Shape.Solids) == 1 for obj in physical)
 assert abs(physical[0].Shape.Volume-physical[1].Shape.Volume) < 1e-8
 assert abs((physical[1].getGlobalPlacement().Base-physical[0].getGlobalPlacement().Base).Length-40) < 1e-8
 for obj in physical:
  meta = json.loads(obj.ManufacturingMetadata)
  assert 'M6' in meta['ThreadCallouts']
  assert obj.ThreadCallouts == meta['ThreadCallouts']
  assert obj.ThreadFeaturesJSON == meta['ThreadFeaturesJSON']
  assert obj.ThreadModel == meta['ThreadModel']
  assert 'threads: external M6' in obj.Label
 if mode == 'simple':
  drawing_scope = {'_drawing_source':physical[0]}
  exec(${JSON.stringify(drawingMacro)}, drawing_scope)
  drawing = drawing_scope['obj']
  assert drawing.ThreadCallouts == physical[0].ThreadCallouts
  assert 'M6' in drawing.ThreadCallouts
  assert drawing_scope['page'].Template
  assert len(drawing_scope['page'].Views) == 4
  App.closeDocument(drawing_scope['doc'].Name)
  assert json.loads(meta['ThreadFeaturesJSON'])[0]['representation'] == ('machined-helix' if mode == 'full' else 'nominal-cylinder')
 records.append((physical[0].Shape.Volume, len(physical[0].Shape.Faces)))
 App.closeDocument(doc.Name)
assert records[1][0] < records[0][0]
assert records[1][1] > records[0][1]
print('PROJECT_THREAD_MODES_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 110000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PROJECT_THREAD_MODES_OK/);
  },
);
