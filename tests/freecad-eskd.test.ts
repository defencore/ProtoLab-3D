import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Group } from 'three';
import { componentPython } from '../src/core/assembly/detail-instances';
import { addProduct, createProject, removeOccurrence } from '../src/core/design-project';
import { eskdIdentity } from '../src/core/eskd';
import { generateScript } from '../src/core/freecad';
import { generateProjectScript } from '../src/core/project-freecad';
import type { AssemblyComponent } from '../src/core/product-types';
import type { PartDefinition } from '../src/core/types';

const detail: PartDefinition = {
  id: 'eskd-plate',
  name: 'Mounting plate',
  category: 'Tests',
  subgroup: 'Export',
  icon: 'box',
  description: 'FreeCAD document identity fixture.',
  complexity: 'Fixed',
  keywords: [],
  product: {
    kind: 'detail',
    supply: 'manufactured',
    description: 'A machined plate.',
    processes: ['milling'],
    releaseRequirements: ['Verify the drawing.'],
  },
  parameters: [],
  defaults: {},
  presets: [],
  validate: () => [],
  buildGeometry: () => new Group(),
  dimensions: () => [2, 4, 2],
  python: () => 'shape = Part.makeBox(2, 4, 2)',
};
const supplier: PartDefinition = {
  ...detail,
  id: 'eskd-supplier',
  name: 'Supplier motor family',
  product: { ...detail.product, kind: 'assembly', supply: 'purchased', processes: [] },
  defaults: { model: 'M123' },
  parameters: [{ key: 'model', label: 'Model', type: 'text', group: 'Product' }],
  presets: [
    {
      id: 'sku',
      name: 'Shop OEM Motor M123 12V',
      description: 'Exact listing title.',
      parameters: { model: 'M123' },
      catalog: {
        designation: 'M123',
        manufacturer: 'Fixture OEM',
        sourceName: 'Supplier listing',
        sourceUrl: 'https://example.com/m123',
        verifiedParameters: ['model'],
      },
    },
  ],
  python:
    () => `shape = Part.makeCompound([Part.makeBox(2, 4, 1), Part.makeBox(2, 4, 1, App.Vector(0, 0, 1))])
component_labels = ['Motor housing', 'Motor shaft']`,
};
const occurrence = (
  part: PartDefinition,
  id: string,
  supply: AssemblyComponent['supply'],
  x: number,
): AssemblyComponent => ({
  id,
  libraryId: part.id,
  parameters: { ...part.defaults },
  state: 'default',
  ...(part === supplier ? { presetId: 'sku' } : {}),
  name: part === supplier ? 'Installed drive motor' : 'Support plate',
  supply,
  quantity: 1,
  placement: { translation: [x, 0, 0], rotation: [0, 0, 0] },
});
const fabricated = occurrence(detail, 'plate', 'manufactured', 0);
const bought = occurrence(supplier, 'motor', 'purchased', 10);
const mechanism: PartDefinition = {
  ...detail,
  id: 'eskd-mechanism',
  name: 'Mechanism',
  product: { ...detail.product, kind: 'assembly', processes: ['assembly'] },
  dimensions: () => [12, 4, 2],
  python: () =>
    componentPython(
      [detail, supplier],
      [
        { component: fabricated, label: 'Plate installation role', color: 0x999999 },
        { component: bought, label: 'Drive installation role', color: 0x222222 },
      ],
    ) + '\ncomponent_groups = [["Structure"], ["Drives"]]',
};

function projectFixture() {
  return addProduct(createProject('ESKD metadata fixture'), [mechanism], {
    part: mechanism,
    parameters: {},
    state: 'default',
  }).project;
}

function boughtProjectFixture() {
  const parts = [mechanism, detail];
  let added = addProduct(createProject('Bought mechanism fixture'), parts, {
    part: mechanism,
    parameters: {},
    state: 'default',
  });
  const parentId = added.occurrenceId;
  added = addProduct(
    added.project,
    parts,
    {
      part: detail,
      parameters: {},
      state: 'default',
    },
    parentId,
  );
  const configuration = added.project.configurations.find(
    (item) => item.libraryId === mechanism.id,
  )!;
  configuration.supply = 'purchased';
  configuration.name = 'Shop assembled mechanism M200';
  configuration.designation = 'M200';
  configuration.procurement = {
    name: configuration.name,
    designation: 'M200',
    manufacturer: 'Fixture OEM',
    source: 'https://example.com/m200',
  };
  delete configuration.manufacturing;
  return { project: added.project, parts, childId: added.occurrenceId };
}

test('mechanism metadata retains configured part identities and the exact supplier title', () => {
  const source = mechanism.python({}, 'default');
  assert.match(source, /ESKDIdentityJSON/);
  assert.match(source, /Shop OEM Motor M123 12V/);
  assert.match(source, /Support plate/);
  const single = generateScript(detail, {}, 'default');
  assert.match(
    single,
    new RegExp(eskdIdentity(detail, {}, 'default').designation.replaceAll('.', '\\.')),
  );
  assert.match(single, /BaseDesignation/);
  assert.match(single, /Execution/);
  assert.match(single, /ConfigurationKey/);
  const project = generateProjectScript(projectFixture(), [mechanism]);
  assert.match(
    project,
    /return shape, component_labels, component_colors, component_metadata, component_groups/,
  );
  assert.match(project, /Each component group must be a path/);
  assert.match(project, /"purchased", "standard"/);
});

test('standalone and project generated programs remain valid Python', () => {
  const directory = mkdtempSync(join(tmpdir(), 'protolab-eskd-syntax-'));
  try {
    const files = [
      generateScript(mechanism, {}, 'default'),
      generateScript(supplier, supplier.defaults, 'default', 'sku'),
      generateProjectScript(projectFixture(), [mechanism]),
    ].map((source, index) => {
      const path = join(directory, `export-${index}.py`);
      writeFileSync(path, source);
      return path;
    });
    const result = spawnSync(
      'python3',
      ['-c', 'import ast,sys; [ast.parse(open(path).read()) for path in sys.argv[1:]]', ...files],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test(
  'native ESKD properties, supplier opacity and groups survive FCStd save and reopen',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const standalone = generateScript(mechanism, {}, 'default');
    const oneChild = generateScript(
      {
        ...mechanism,
        id: 'eskd-one-child',
        dimensions: () => [2, 4, 2],
        python: () =>
          componentPython([detail], [{ component: fabricated, label: 'Plate', color: 0x999999 }]),
      },
      {},
      'default',
    );
    const opaque = generateScript(supplier, supplier.defaults, 'default', 'sku');
    const project = generateProjectScript(projectFixture(), [mechanism]);
    const boughtProject = boughtProjectFixture();
    assert.throws(
      () => generateProjectScript(boughtProject.project, boughtProject.parts),
      /parent product cannot contain components/,
    );
    const opaqueProject = generateProjectScript(
      removeOccurrence(boughtProject.project, boughtProject.childId),
      boughtProject.parts,
    );
    const code = `import FreeCAD as App, json, tempfile, os
doc = App.newDocument('EskdExportFixture')
exec(${JSON.stringify(standalone)})
root = next(obj for obj in doc.RootObjects)
plate = root.Group[0].Group[0]
motor = root.Group[1].Group[0]
assert plate.SupplyPolicy == 'manufactured' and plate.Designation and plate.Execution
assert plate.ProductName == 'Support plate' and plate.Revision == 'A'
assert plate.Label.startswith(plate.Designation) and 'rev A' in plate.Label
assert motor.SupplyPolicy == 'purchased'
assert motor.Label == 'Shop OEM Motor M123 12V'
assert motor.Designation == 'M123' and motor.Execution == ''
assert root.LibraryId == 'eskd-mechanism' and root.LibraryEntryId == 'eskd-mechanism'
assert root.PresetId == ''
assert plate.LibraryId == 'eskd-plate' and plate.LibraryEntryId == 'eskd-plate'
assert motor.LibraryId == 'eskd-supplier' and motor.PresetId == 'sku'
assert motor.LibraryEntryId == 'eskd-supplier:sku'
plate_name, motor_name = plate.Name, motor.Name
with tempfile.TemporaryDirectory(prefix='protolab-eskd-') as directory:
 path = os.path.join(directory, 'fixture.FCStd')
 doc.saveAs(path)
 App.closeDocument(doc.Name)
 doc = App.openDocument(path)
 plate, motor = doc.getObject(plate_name), doc.getObject(motor_name)
 assert plate.Designation and plate.Execution and plate.Revision == 'A'
 assert motor.Label == 'Shop OEM Motor M123 12V' and motor.Designation == 'M123'
 assert motor.LibraryEntryId == 'eskd-supplier:sku' and motor.PresetId == 'sku'
 assert plate.LibraryId == 'eskd-plate' and plate.PresetId == ''
 App.closeDocument(doc.Name)
doc = App.newDocument('OneChildAssemblyFixture')
exec(${JSON.stringify(oneChild)})
root = next(obj for obj in doc.RootObjects)
assert root.TypeId == 'App::Part' and len(root.Group) == 1
assert root.ProductType == 'assembly' and root.Group[0].ProductType == 'detail'
assert root.Designation != root.Group[0].Designation
exec(${JSON.stringify(oneChild)})
physical = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
assert len(physical) == 2
assert physical[0].Designation == physical[1].Designation
assert '[instance 2]' in physical[1].Label and 'rev A001' not in physical[1].Label
App.closeDocument(doc.Name)
doc = App.newDocument('OpaqueSupplierFixture')
exec(${JSON.stringify(opaque)})
root = next(obj for obj in doc.RootObjects)
assert root.Label == 'Shop OEM Motor M123 12V'
assert root.LibraryId == 'eskd-supplier' and root.PresetId == 'sku'
assert root.LibraryEntryId == 'eskd-supplier:sku'
assert [obj.Label for obj in root.Group] == ['Motor housing', 'Motor shaft']
assert all('Designation' not in obj.PropertiesList for obj in root.Group)
App.closeDocument(doc.Name)
doc = App.newDocument('ProjectEskdFixture')
exec(${JSON.stringify(project)})
root = next(obj for obj in doc.RootObjects)
product = root.Group[0]
assert [obj.Label for obj in product.Group] == ['Structure', 'Drives']
plate, motor = [obj.Group[0] for obj in product.Group]
assert plate.Designation and plate.Execution and plate.ProductName == 'Support plate'
assert motor.Label == 'Shop OEM Motor M123 12V' and motor.SupplyPolicy == 'purchased'
assert motor.LibraryEntryId == 'eskd-supplier:sku' and motor.PresetId == 'sku'
assert product.LibraryId == 'eskd-mechanism' and product.PresetId == ''
App.closeDocument(doc.Name)
doc = App.newDocument('ProjectOpaqueFixture')
exec(${JSON.stringify(opaqueProject)})
occurrences = [obj for obj in doc.Objects if 'OccurrenceId' in obj.PropertiesList]
assert len(occurrences) == 1, 'A bought assembly is one BOM occurrence'
assert occurrences[0].Label == 'Shop assembled mechanism M200'
physical = [obj for obj in doc.Objects if obj.TypeId == 'Part::Feature']
assert len(physical) == 2
assert all('Designation' not in obj.PropertiesList for obj in physical)
App.closeDocument(doc.Name)
print('FREECAD_ESKD_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /FREECAD_ESKD_OK/);
  },
);
