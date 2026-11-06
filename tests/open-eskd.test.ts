import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { createProject, serializeProject } from '../src/core/design-project';
import { exportOpenEskd } from '../src/core/open-eskd';
import type {
  DesignProject,
  ProductConfiguration,
  ProductOccurrence,
} from '../src/core/product-types';
import type { PartDefinition } from '../src/core/types';
import { auditEskdProjects } from '../scripts/audit-eskd-projects';

const namespace = 'com.defencore.protolab';
function part(id: string, kind: PartDefinition['product']['kind'] = 'detail'): PartDefinition {
  return {
    id,
    name: id,
    category: 'TEST',
    subgroup: 'TEST',
    description: 'Open ESKD contract fixture.',
    keywords: [],
    icon: 'box',
    complexity: 'Fixed model',
    product: {
      kind,
      supply: kind === 'reference' ? 'reference' : 'manufactured',
      description: 'Fixture.',
      processes: ['milling'],
      releaseRequirements: ['Check dimensions.'],
    },
    parameters: [],
    defaults: {},
    presets: [],
    validate: () => [],
    python: () => 'shape = Part.makeBox(1, 1, 1)',
    buildGeometry: () => new Group(),
    dimensions: () => [1, 1, 1],
  };
}
const parts = [part('assembly', 'assembly'), part('plate'), part('reference', 'reference')];
function configuration(id: string, libraryId: string, designation: string): ProductConfiguration {
  return {
    id,
    libraryId,
    designation,
    name: libraryId === 'plate' ? 'Mounting plate' : 'Actuator assembly',
    revision: 'B',
    parameters: {},
    state: 'default',
    supply: 'manufactured',
    manufacturing: {
      material: 'EN AW-6061-T6',
      blank: 'Plate 3 mm',
      processes: ['cutting', 'milling'],
      requirements: ['Inspect mounting holes.'],
    },
  };
}
function occurrence(
  id: string,
  configurationId: string,
  parentId: string | null,
  position: string,
  quantity = 1,
): ProductOccurrence {
  return {
    id,
    configurationId,
    parentId,
    position,
    quantity,
    placement: { translation: [0, 0, 0], rotation: [0, 0, 0] },
    notes: '',
  };
}
function fixture(): DesignProject {
  return {
    ...createProject('Actuator project'),
    id: 'project-test',
    designation: 'ACT.001.000',
    revision: '2',
    configurations: [
      configuration('assembly-design', 'assembly', 'ACT.001.000'),
      configuration('plate-design', 'plate', 'ACT.001.001-02'),
    ],
    occurrences: [
      occurrence('root', 'assembly-design', null, '1', 2),
      occurrence('plate-a', 'plate-design', 'root', '1', 3),
      occurrence('plate-b', 'plate-design', 'root', '2', 4),
    ],
    documents: [
      {
        id: 'plate-drawing',
        configurationId: 'plate-design',
        designation: 'ACT.001.001-02',
        name: 'Plate drawing',
        kind: 'drawing',
        revision: 'B',
        format: 'A4',
        file: 'components/ACT.001.001-02/rev-B/ACT.001.001-02_drawing.pdf',
      },
    ],
  };
}

test('Open ESKD export has a schema-6 draft baseline and preserves exact product identities', () => {
  const project = fixture();
  const before = structuredClone(project);
  const result = JSON.parse(exportOpenEskd(project, parts));
  assert.equal(result.schema, 'open-eskd');
  assert.equal(result.schemaVersion, 6);
  assert.equal(result.kind, 'project');
  assert.equal(result.id, project.id);
  assert.equal(new Date(result.createdAt).toISOString(), result.createdAt);
  assert.equal(result.updatedAt, result.createdAt);
  assert.deepEqual(result.catalog, {});
  assert.deepEqual(result.production, []);
  assert.equal(result.fileCheck, null);
  const branch = result.branches[result.activeBranch];
  const commit = result.commits[branch.head];
  assert.equal(commit.status, 'draft');
  assert.equal(commit.version, project.revision);
  assert.deepEqual(commit.parents, []);
  assert.deepEqual(commit.snapshot, branch.working);
  assert.equal(branch.working.components[1].designation, 'ACT.001.001-02');
  assert.equal(branch.working.components[1].name, 'Mounting plate');
  assert.equal(branch.working.components[1].revision, 'B');
  assert.equal(branch.working.components[1].owner, '');
  assert.equal(branch.working.components[1].status, 'draft');
  assert.equal(result.extensions[namespace].version, 1);
  assert.deepEqual(project, before, 'export does not mutate the design project');
});

test('repeated occurrences share a definition while relative quantities, placements and documents remain explicit', () => {
  const project = fixture();
  project.occurrences[2].placement.translation = [30, 0, 0];
  const snapshot = JSON.parse(exportOpenEskd(project, parts)).branches.main.working;
  const [root, first, second] = snapshot.components;
  assert.deepEqual([root.quantity, first.quantity, second.quantity], [2, 3, 4]);
  assert.equal(first.definitionId, second.definitionId);
  assert.notEqual(first.id, second.id);
  assert.equal(first.parentId, root.id);
  assert.equal(second.parentId, root.id);
  assert.deepEqual(second.extensions[namespace].placement.translation, [30, 0, 0]);
  assert.deepEqual(first.extensions[namespace].configuration, project.configurations[1]);
  assert.deepEqual(
    snapshot.documents.map((document: { componentId: string }) => document.componentId),
    ['plate-a', 'plate-b'],
  );
  assert.equal(new Set(snapshot.documents.map((document: { id: string }) => document.id)).size, 2);
  assert.equal(snapshot.documents[0].path, project.documents[0].file);
  assert.equal(snapshot.documents[0].sha256, null);
  assert.equal(snapshot.documents[0].required, true);
  assert.deepEqual(
    first.manufacturing.steps.map((step: { operation: string }) => step.operation),
    ['cutStock', 'milling'],
  );
  assert.equal(first.manufacturing.steps[1].check, 'Inspect mounting holes.');
});

test('purchased assemblies retain supplier naming and hide opaque internal geometry', () => {
  const project = fixture();
  const bought = project.configurations[0];
  bought.supply = 'purchased';
  bought.name = 'Waveshare Exact Shop Product Title';
  bought.designation = 'SKU-240';
  bought.procurement = {
    designation: 'SKU-240',
    manufacturer: 'Waveshare',
    source: 'https://example.com/shop/SKU-240',
  };
  delete bought.manufacturing;
  assert.throws(() => exportOpenEskd(project, parts), /parent product cannot contain components/);
  const suppliedAssembly = {
    ...parts[0],
    composition: () => ({
      components: project.occurrences
        .filter((item) => item.parentId === 'root')
        .map((item) => ({
          id: item.id,
          libraryId: 'plate',
          parameters: {},
          state: 'default',
          name: 'Mounting plate',
          supply: 'manufactured' as const,
          quantity: item.quantity,
          placement: item.placement,
        })),
      issues: [],
    }),
  };
  const snapshot = JSON.parse(exportOpenEskd(project, [suppliedAssembly, ...parts.slice(1)]))
    .branches.main.working;
  assert.equal(snapshot.components.length, 1);
  assert.equal(snapshot.components[0].type, 'purchased');
  assert.equal(snapshot.components[0].name, bought.name);
  assert.equal(snapshot.components[0].designation, 'SKU-240');
  assert.equal(snapshot.components[0].manufacturer, 'Waveshare');
  assert.deepEqual(
    snapshot.components[0].extensions[namespace].configuration.procurement,
    bought.procurement,
  );
  assert.equal(snapshot.components[0].manufacturing.technology, 'purchase');
  assert.deepEqual(
    snapshot.documents,
    [],
    'internal fabrication documents are not attached to the opaque purchased unit',
  );
});

test('unresolved reference products and missing definitions fail before writing a misleading manifest', () => {
  const project = fixture();
  project.configurations[1] = {
    ...project.configurations[1],
    libraryId: 'reference',
    supply: 'reference',
    manufacturing: undefined,
  };
  assert.throws(() => exportOpenEskd(project, parts), /resolve reference geometry/);
  project.configurations[1].libraryId = 'unknown';
  assert.throws(() => exportOpenEskd(project, parts), /Unknown library product/);
  const missing = fixture();
  missing.documents[0].configurationId = 'missing';
  assert.throws(() => exportOpenEskd(missing, parts), /unknown configuration/);
});

test('export rejects unsafe paths and filesystem collisions', () => {
  for (const path of [
    '../drawing.pdf',
    '/drawing.pdf',
    'C:/drawing.pdf',
    'drawings/CON.pdf',
    'drawings/file.eskd-placeholder',
    'report.html',
  ]) {
    const project = fixture();
    project.documents[0].file = path;
    assert.throws(() => exportOpenEskd(project, parts), /portable relative Open ESKD path/);
  }
  const collision = fixture();
  collision.documents.push({
    ...collision.documents[0],
    id: 'case-conflict',
    file: collision.documents[0].file.toLowerCase(),
  });
  assert.throws(() => exportOpenEskd(collision, parts), /case-insensitive filesystem/);
  const directory = fixture();
  directory.documents[0].file = 'components/ACT.001.001-02/rev-B';
  assert.throws(() => exportOpenEskd(directory, parts), /also a directory/);
  const quantity = fixture();
  quantity.occurrences[0].quantity = 1000001;
  assert.throws(() => exportOpenEskd(quantity, parts), /1,000,000/);
});

test('missing ordering designations remain explicit draft labels without inventing supplier identities', () => {
  const project = fixture();
  project.configurations[1].designation = '';
  project.configurations[1].supply = 'purchased';
  delete project.configurations[1].manufacturing;
  project.configurations[1].procurement = { designation: '', manufacturer: '', source: '' };
  const before = structuredClone(project);
  const component = JSON.parse(exportOpenEskd(project, parts)).branches.main.working.components[1];
  assert.match(component.designation, /^Draft: Mounting plate /);
  assert.equal(component.status, 'draft');
  assert.equal(component.extensions[namespace].designationIsDraft, true);
  assert.equal(component.extensions[namespace].originalDesignation, '');
  assert.equal(component.extensions[namespace].configuration.procurement.designation, '');
  assert.ok(
    component.extensions[namespace].unresolved.some((issue: string) =>
      issue.includes('not a supplier SKU'),
    ),
  );
  assert.match(component.notes, /Supplier ordering designation is unresolved/);
  assert.deepEqual(project, before);
});

test('oversized geometry parameters use bounded annotations while the source backup remains complete', () => {
  const project = fixture();
  const recipe = JSON.stringify({
    points: Array.from({ length: 20000 }, (_, index) => [index, index / 2, index / 3]),
  });
  project.configurations[1].parameters = { recipe };
  const library = [
    parts[0],
    {
      ...parts[1],
      parameters: [{ key: 'recipe', type: 'text' as const, label: 'Recipe', group: 'Geometry' }],
    },
  ];
  const component = JSON.parse(exportOpenEskd(project, library)).branches.main.working
    .components[1];
  const metadata = component.extensions[namespace];
  assert.equal(metadata.parametersOmitted, true);
  assert.equal(metadata.configuration.parameters, undefined);
  assert.match(metadata.configurationKey, /^[A-F0-9]{16}$/);
  assert.ok(metadata.parameterBytes > 65536);
  assert.match(
    metadata.parametersOmittedReason,
    /complete configuration remains in the ProtoLab Project JSON backup/,
  );
  assert.ok(new TextEncoder().encode(JSON.stringify(component.extensions)).length <= 65536);
  assert.equal(
    JSON.parse(serializeProject(project, library)).configurations[1].parameters.recipe,
    recipe,
  );
});

test('overlong authored labels retain their full source text and visibly identify draft abbreviations', () => {
  const project = fixture();
  project.configurations[1].name = 'Original supplier listing title '.repeat(12);
  project.configurations[1].designation = 'ORIGINAL-ORDERING-RECORD-'.repeat(12);
  const component = JSON.parse(exportOpenEskd(project, parts)).branches.main.working.components[1];
  assert.ok([...component.name].length <= 200);
  assert.ok([...component.designation].length <= 200);
  assert.match(component.designation, /^Draft: /);
  assert.equal(component.extensions[namespace].originalName, project.configurations[1].name);
  assert.equal(
    component.extensions[namespace].originalDesignation,
    project.configurations[1].designation,
  );
  assert.equal(component.extensions[namespace].nameIsAbbreviated, true);
  assert.match(component.notes, /full original remains in ProtoLab annotations/);
});

test('long inspection requirements remain complete in annotations with an explicit operation check reference', () => {
  const project = fixture();
  const requirements = Array.from(
    { length: 60 },
    (_, index) =>
      `Inspect feature ${index}: verify the specified bore, fit and finish against the drawing.`,
  );
  project.configurations[1].manufacturing!.requirements = requirements;
  const component = JSON.parse(exportOpenEskd(project, parts)).branches.main.working.components[1];
  assert.equal(component.extensions[namespace].manufacturingRequirementsInAnnotations, true);
  assert.deepEqual(
    component.extensions[namespace].configuration.manufacturing.requirements,
    requirements,
  );
  assert.match(
    component.manufacturing.steps.at(-1).check,
    /complete manufacturing and inspection requirements/,
  );
  assert.ok(
    component.manufacturing.steps.every(
      (step: { check: string }) => [...step.check].length <= 2000,
    ),
  );
  assert.match(
    component.notes,
    /read the full requirements in ProtoLab annotations before manufacture/,
  );
});

test('Open ESKD distinguishes standard products, materials, sets and assembly drawings', () => {
  const project = fixture();
  project.configurations[1].supply = 'standard';
  delete project.configurations[1].manufacturing;
  project.configurations[1].procurement = {
    designation: 'ISO 7089-6',
    manufacturer: '',
    source: 'https://example.com/washer',
    standard: 'ISO 7089',
  };
  project.documents[0].kind = 'assembly-drawing';
  const snapshot = JSON.parse(exportOpenEskd(project, parts)).branches.main.working;
  assert.equal(snapshot.components[1].type, 'standard');
  assert.equal(snapshot.documents[0].kind, 'assemblyDrawing');
  const setLibrary = [part('assembly', 'kit'), parts[1]];
  assert.equal(
    JSON.parse(exportOpenEskd(fixture(), setLibrary)).branches.main.working.components[0].type,
    'set',
  );
  const materialLibrary = [parts[0], part('plate', 'material')];
  assert.equal(
    JSON.parse(exportOpenEskd(fixture(), materialLibrary)).branches.main.working.components[1].type,
    'material',
  );
});

test('different revisions cannot create recursive definitions and source IDs cannot collide during document expansion', () => {
  const recursive = fixture();
  recursive.configurations[1].designation = recursive.configurations[0].designation;
  recursive.configurations[1].revision = 'C';
  assert.throws(() => exportOpenEskd(recursive, parts), /another revision of itself/);
  const project = fixture();
  project.occurrences[1].id = 'b';
  project.occurrences[2].id = 'a/b';
  project.documents[0].id = 'draw/a';
  project.documents.push({ ...project.documents[0], id: 'draw' });
  const documents = JSON.parse(exportOpenEskd(project, parts)).branches.main.working.documents;
  assert.equal(documents.length, 4);
  assert.equal(new Set(documents.map((document: { id: string }) => document.id)).size, 4);
});

test('export enforces the Open ESKD depth ceiling independently of the source project limit', () => {
  const project = fixture();
  project.configurations = [];
  project.occurrences = [];
  project.documents = [];
  for (let index = 0; index < 65; index++) {
    project.configurations.push(configuration(`design-${index}`, 'assembly', `DEPTH.${index}`));
    project.occurrences.push(
      occurrence(`level-${index}`, `design-${index}`, index ? `level-${index - 1}` : null, '1'),
    );
  }
  assert.throws(() => exportOpenEskd(project, parts), /at most 64 product levels/);
});

test('reusable project audits report failed assemblies while excluding bought products and avoiding CAD generation', () => {
  const assembly = {
    ...parts[0],
    buildGeometry: () => {
      throw new Error('CAD generation must not run in a metadata audit.');
    },
  };
  const broken = {
    ...assembly,
    id: 'broken-assembly',
    validate: () => ['The configured mounting interface is invalid.'],
  };
  const purchased = {
    ...assembly,
    id: 'purchased-assembly',
    product: { ...assembly.product, supply: 'purchased' as const },
  };
  const completion: boolean[] = [];
  const report = auditEskdProjects([assembly, broken, purchased, parts[1]], (progress) =>
    completion.push(progress.finished),
  );
  assert.equal(report.mechanisms, 2);
  assert.equal(report.projectPass, 1);
  assert.equal(report.exportPass, 1);
  assert.equal(report.finished, true);
  assert.equal(report.records[0].stage, 'complete');
  assert.equal(report.records[1].stage, 'addProduct');
  assert.match(report.records[1].error ?? '', /mounting interface is invalid/);
  assert.equal(report.verification.geometryValidated, false);
  assert.equal(report.verification.engineeringApproval, false);
  assert.ok(completion.includes(false));
  assert.equal(completion.at(-1), true);
});
