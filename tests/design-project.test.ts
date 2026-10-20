import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import type { PartDefinition } from '../src/core/types';
import type {
  AssemblyComponent,
  DesignProject,
  ProductConfiguration,
} from '../src/core/product-types';
import {
  addProduct,
  configureProduct,
  createDocument,
  createProject,
  forkOccurrenceDesign,
  parseProject,
  projectReadiness,
  removeOccurrence,
  serializeProject,
  specificationCsv,
  specificationRows,
  supplyRows,
  validateProject,
} from '../src/core/design-project';
import { readProjects, storeProjects } from '../src/core/project-storage';

function part(
  id: string,
  kind: 'detail' | 'assembly' | 'reference' = 'detail',
  supply: 'manufactured' | 'purchased' | 'reference' = 'manufactured',
): PartDefinition {
  return {
    id,
    name: id,
    category: 'TEST',
    subgroup: 'TEST',
    description: 'A project contract fixture.',
    keywords: [],
    icon: 'box',
    complexity: '1 parameter',
    product: {
      kind,
      supply,
      description: 'Explicit fixture product.',
      processes: supply === 'manufactured' ? ['milling'] : [],
      releaseRequirements: ['Verify the specified fit.'],
    },
    parameters: [
      { key: 'length', label: 'Length', type: 'number', min: 1, max: 100, group: 'Dimensions' },
    ],
    defaults: { length: 10 },
    presets: [],
    validate: () => [],
    buildGeometry: () => new Group(),
    python: () => 'shape = Part.makeBox(1, 1, 10)',
    dimensions: () => [1, 1, 10],
  };
}
const plate = part('plate');
const fastener = part('fastener', 'detail', 'purchased');
const module = part('module', 'assembly');
const machine = part('machine', 'assembly');
const reference = part('reference', 'reference', 'reference');
const parts = [plate, fastener, module, machine, reference];
const component = (definition: PartDefinition, quantity = 1): AssemblyComponent => ({
  id: definition.id,
  libraryId: definition.id,
  parameters: { ...definition.defaults },
  state: 'default',
  name: definition.name,
  supply: definition.product.supply,
  quantity,
  placement: { translation: [0, 0, 0], rotation: [0, 0, 0] },
});
const selection = (definition: PartDefinition) => ({
  part: definition,
  parameters: { ...definition.defaults },
  state: 'default',
});
function hierarchy() {
  const assembly = {
    ...module,
    composition: () => ({ components: [component(plate, 2), component(fastener, 4)], issues: [] }),
  };
  const parent = {
    ...machine,
    composition: () => ({ components: [component(assembly, 3)], issues: [] }),
  };
  const library = [plate, fastener, assembly, parent, reference];
  const added = addProduct(createProject('Machine project'), library, selection(parent));
  return { project: added.project, library, rootId: added.occurrenceId };
}

test('project composition contains explicit library references and shared configured designs', () => {
  const { project, library, rootId } = hierarchy();
  assert.equal(project.occurrences.length, 4);
  assert.equal(project.configurations.length, 4);
  assert.deepEqual(validateProject(project, library), []);
  assert.equal(specificationRows(project, library, rootId).length, 1);
  assert.equal(specificationRows(project, library, rootId)[0].quantity, 3);
  const duplicated = addProduct(project, library, selection(plate), rootId).project;
  assert.equal(duplicated.configurations.length, 4, 'identical detail configurations are reused');
  assert.equal(duplicated.occurrences.length, 5);
  assert.equal(project.occurrences.length, 4, 'adding a product never mutates the source project');
});

test('supply lists multiply nested quantities and aggregate shared designs', () => {
  const { project, library, rootId } = hierarchy();
  project.occurrences.find((item) => item.id === rootId)!.quantity = 2;
  const fabrication = supplyRows(project, library, 'manufactured');
  assert.equal(fabrication.find((item) => item.name === 'machine')?.quantity, 2);
  assert.equal(fabrication.find((item) => item.name === 'module')?.quantity, 6);
  assert.equal(fabrication.find((item) => item.name === 'plate')?.quantity, 12);
  assert.equal(
    supplyRows(project, library, 'purchased').find((item) => item.name === 'fastener')?.quantity,
    24,
  );
  const bought = project.configurations.find((item) => item.libraryId === 'module')!;
  bought.supply = 'purchased';
  delete bought.manufacturing;
  assert.deepEqual(
    supplyRows(project, library, 'purchased').map((item) => [item.name, item.quantity]),
    [['module', 6]],
    'bought assemblies do not purchase their internal components again',
  );
});

test('project parser round-trips the current schema and rejects malformed, stale or extra data', () => {
  const { project, library } = hierarchy();
  assert.deepEqual(parseProject(serializeProject(project, library), library), project);
  for (const mutate of [
    (value: DesignProject) => {
      value.schemaVersion = 2 as 1;
    },
    (value: DesignProject) => {
      value.configurations[0].libraryId = 'missing';
    },
    (value: DesignProject) => {
      value.configurations[0].parameters.length = '10';
    },
    (value: DesignProject) => {
      value.configurations[0].parameters.unknown = 1;
    },
    (value: DesignProject) => {
      value.occurrences[0].quantity = 0;
    },
    (value: DesignProject) => {
      value.occurrences[0].quantity = Number.MAX_SAFE_INTEGER + 1;
    },
    (value: DesignProject) => {
      value.occurrences[0].placement.translation = [0, null as unknown as number, 0];
    },
    (value: DesignProject) => {
      value.occurrences[0].parentId = 'orphan';
    },
    (value: DesignProject) => {
      value.occurrences[0].parentId = value.occurrences[1].id;
    },
    (value: DesignProject) => {
      value.occurrences.push({ ...value.occurrences[0], id: 'duplicate-position' });
    },
    (value: DesignProject) => {
      (value as DesignProject & { legacy: boolean }).legacy = true;
    },
  ]) {
    const changed = structuredClone(project);
    mutate(changed);
    assert.throws(() => parseProject(JSON.stringify(changed), library));
  }
  assert.throws(() => parseProject('not json', library));
  assert.throws(() => parseProject('null', library));
});

test('project designations cannot identify contradictory designs in the same revision', () => {
  const project = addProduct(createProject(), parts, selection(plate)).project;
  const configuration = project.configurations[0];
  configuration.designation = 'PL.001';
  project.configurations.push({
    ...structuredClone(configuration),
    id: 'other',
    parameters: { length: 20 },
  });
  assert.match(validateProject(project, parts).join(' '), /conflicting designs/);
  project.configurations[1].revision = 'B';
  assert.deepEqual(validateProject(project, parts), []);
});

test('independent assembly designs permit distinct structures without changing reused leaf details', () => {
  const initial = hierarchy();
  const duplicated = addProduct(
    initial.project,
    initial.library,
    selection(initial.library.find((item) => item.id === 'machine')!),
  );
  const secondRoot = duplicated.occurrenceId;
  assert.deepEqual(validateProject(duplicated.project, initial.library), []);
  assert.throws(
    () => addProduct(duplicated.project, initial.library, selection(plate), secondRoot),
    /inconsistent component structures/,
  );
  const secondChild = duplicated.project.occurrences.find((item) => item.parentId === secondRoot)!;
  assert.match(
    validateProject(removeOccurrence(duplicated.project, secondChild.id), initial.library).join(
      ' ',
    ),
    /inconsistent component structures/,
  );
  const independent = forkOccurrenceDesign(duplicated.project, initial.library, secondRoot);
  assert.deepEqual(
    validateProject(removeOccurrence(independent, secondChild.id), initial.library),
    [],
  );
  const firstConfiguration = independent.occurrences.find(
    (item) => item.id === initial.rootId,
  )!.configurationId;
  const secondConfiguration = independent.occurrences.find(
    (item) => item.id === secondRoot,
  )!.configurationId;
  assert.notEqual(firstConfiguration, secondConfiguration);
  assert.equal(independent.configurations.filter((item) => item.libraryId === 'plate').length, 1);
  const changed = addProduct(independent, initial.library, selection(plate), secondRoot).project;
  assert.deepEqual(validateProject(changed, initial.library), []);
  assert.equal(specificationRows(changed, initial.library, initial.rootId).length, 1);
  assert.equal(specificationRows(changed, initial.library, secondRoot).length, 2);
  const conflicting = structuredClone(changed);
  const firstDesign = conflicting.configurations.find((item) => item.id === firstConfiguration)!;
  const secondDesign = conflicting.configurations.find((item) => item.id === secondConfiguration)!;
  firstDesign.designation = secondDesign.designation = 'ASM.001';
  assert.match(
    validateProject(conflicting, initial.library).join(' '),
    /conflicting assembly structures/,
  );
  secondDesign.revision = 'B';
  assert.deepEqual(validateProject(conflicting, initial.library), []);
  assert.throws(
    () => forkOccurrenceDesign(changed, initial.library, 'missing'),
    /no longer exists/,
  );
});

test('configured assembly ancestry and unsafe multiplied quantities cannot produce a specification', () => {
  const { project, library, rootId } = hierarchy();
  const child = project.occurrences.find((item) => item.parentId === rootId)!;
  child.configurationId = project.occurrences[0].configurationId;
  assert.match(validateProject(project, library).join(' '), /cannot contain itself/);
  const fresh = hierarchy();
  fresh.project.occurrences[0].quantity = Number.MAX_SAFE_INTEGER;
  assert.throws(
    () => supplyRows(fresh.project, fresh.library, 'manufactured'),
    /safe integer range/,
  );
});

test('composition fails closed for unknown parts, physical children of a detail and recursive assemblies', () => {
  const missing = {
    ...module,
    composition: () => ({
      components: [{ ...component(plate), libraryId: 'missing' }],
      issues: [],
    }),
  };
  assert.throws(
    () => addProduct(createProject(), [...parts, missing], selection(missing)),
    /Missing library component/,
  );
  const recursion = {
    ...module,
    composition: () => ({ components: [component(module)], issues: [] }),
  };
  assert.throws(
    () => addProduct(createProject(), [recursion], selection(recursion)),
    /Cyclic library composition/,
  );
  const invalid = {
    ...plate,
    composition: () => ({ components: [component(fastener)], issues: [] }),
  };
  assert.throws(
    () => addProduct(createProject(), [invalid, fastener], selection(invalid)),
    /detail cannot contain/,
  );
  const project = addProduct(createProject(), parts, selection(plate));
  assert.throws(
    () => addProduct(project.project, parts, selection(fastener), project.occurrenceId),
    /Only an assembly/,
  );
});

test('documentation completeness requires explicit manufacturing, procurement and document records', () => {
  const project = addProduct(createProject(), parts, selection(plate)).project;
  let readiness = projectReadiness(project, parts);
  assert.equal(readiness.complete, false);
  assert.ok(readiness.issues.some((item) => item.includes('material is missing')));
  project.designation = 'PL';
  const configuration = project.configurations[0];
  configuration.designation = 'PL.001';
  configuration.manufacturing = {
    material: 'EN AW-6082 T6',
    blank: 'Plate 20 × 20 × 10 mm',
    processes: ['milling', 'drilling'],
    requirements: ['Inspect length 10 ±0.1 mm.'],
  };
  project.documents.push({
    ...createDocument(configuration),
    designation: 'PL.001',
    name: 'Plate drawing',
    file: 'drawings/PL.001.pdf',
  });
  readiness = projectReadiness(project, parts);
  assert.equal(readiness.complete, true);
  assert.ok(readiness.reviewRequirements.some((item) => item.includes('Verify the specified fit')));
  const assembled = {
    ...module,
    composition: () => ({ components: [], issues: ['Select an actual supplier cylinder.'] }),
  };
  const unresolved = addProduct(createProject(), [assembled], selection(assembled)).project;
  assert.ok(
    projectReadiness(unresolved, [assembled]).issues.some((item) =>
      item.includes('Select an actual supplier cylinder'),
    ),
  );
});

test('reference geometry remains visible in projects but cannot enter a production specification', () => {
  const project = addProduct(createProject(), parts, selection(reference)).project;
  assert.equal(specificationRows(project, parts).length, 0);
  assert.ok(
    projectReadiness(project, parts).issues.some((item) =>
      item.includes('reference geometry cannot be released'),
    ),
  );
  project.configurations[0].supply = 'manufactured';
  assert.match(validateProject(project, parts).join(' '), /reference geometry cannot become/);
});

test('removing an assembly removes descendants and unused documents while preserving shared designs', () => {
  const { project, library, rootId } = hierarchy();
  const duplicated = addProduct(project, library, selection(plate)).project;
  const plateConfiguration = duplicated.configurations.find((item) => item.libraryId === 'plate')!;
  duplicated.documents.push(createDocument(plateConfiguration));
  const reduced = removeOccurrence(duplicated, rootId);
  assert.equal(reduced.occurrences.length, 1);
  assert.equal(reduced.configurations.length, 1);
  assert.equal(reduced.documents.length, 1);
  assert.equal(reduced.configurations[0].libraryId, 'plate');
});

test('CSV preserves specification columns, quoting and spreadsheet-safe text', () => {
  const csv = specificationCsv([
    {
      section: 'details',
      position: '1',
      designation: '=unsafe',
      name: 'Plate "A", steel',
      revision: 'A',
      quantity: 2,
      format: '',
      notes: 'Line 1\nLine 2',
    },
  ]);
  assert.ok(csv.startsWith('\uFEFF"Section","Format","Position"'));
  assert.ok(csv.includes('"\'=unsafe"'));
  assert.ok(csv.includes('"Plate ""A"", steel"'));
  assert.ok(csv.includes('"Line 1\nLine 2"'));
});

test('catalog procurement is copied only for an exact selected catalog configuration', () => {
  const catalog = {
    ...fastener,
    presets: [
      {
        id: 'supplier-part',
        name: 'Actual bolt',
        description: 'A supplier model.',
        parameters: { length: 10 },
        catalog: {
          designation: 'M6x10',
          manufacturer: 'Supplier',
          sourceName: 'Manufacturer catalog',
          sourceUrl: 'https://example.org/bolt',
          verifiedParameters: ['length'],
        },
      },
    ],
  };
  const exact = configureProduct({ ...selection(catalog), presetId: 'supplier-part' });
  assert.equal(exact.procurement?.designation, 'M6x10');
  const modified = configureProduct({
    ...selection(catalog),
    parameters: { length: 12 },
    presetId: 'supplier-part',
  });
  assert.equal(modified.procurement?.designation, '');
});

test('explicit supplier presets remain opaque units while custom configurations use authored components', () => {
  const purchased: PartDefinition = {
    ...module,
    states: [
      { id: 'assembled', label: 'Assembled', description: 'Complete model.' },
      { id: 'exploded', label: 'Exploded', description: 'Inspection display.' },
    ],
    presets: [
      {
        id: 'oem',
        name: 'Bought chassis',
        description: 'Complete catalog product.',
        parameters: { length: 10 },
        product: { supply: 'purchased' },
        catalog: {
          designation: 'OEM-10',
          manufacturer: 'Supplier',
          sourceName: 'Supplier product',
          sourceUrl: 'https://example.org/chassis',
          verifiedParameters: ['length'],
        },
      },
    ],
    composition: () => ({
      components: [component(plate)],
      issues: ['Custom interfaces require review.'],
    }),
  };
  const library = [purchased, plate];
  const stock = addProduct(createProject(), library, {
    part: purchased,
    parameters: { length: 10 },
    state: 'exploded',
    presetId: 'oem',
  }).project;
  assert.equal(stock.occurrences.length, 1);
  assert.equal(stock.configurations[0].supply, 'purchased');
  assert.equal(stock.configurations[0].state, 'assembled');
  assert.ok(
    !projectReadiness(stock, library).issues.some((item) => item.includes('Custom interfaces')),
  );
  const custom = addProduct(createProject(), library, {
    part: purchased,
    parameters: { length: 12 },
    state: 'exploded',
    presetId: 'oem',
  }).project;
  assert.equal(custom.occurrences.length, 2);
  assert.equal(custom.configurations[0].supply, 'manufactured');
});

test('physical item states distinguish designs while inspection states reuse the canonical assembled design', () => {
  const guide: PartDefinition = {
    ...plate,
    physicalStates: ['rail', 'carriage'],
    states: [
      { id: 'assembled', label: 'Assembly', description: '' },
      { id: 'exploded', label: 'Inspection', description: '' },
      { id: 'rail', label: 'Rail', description: '' },
      { id: 'carriage', label: 'Carriage', description: '' },
    ],
  };
  let project = addProduct(createProject(), [guide], {
    part: guide,
    parameters: guide.defaults,
    state: 'assembled',
  }).project;
  project = addProduct(project, [guide], {
    part: guide,
    parameters: guide.defaults,
    state: 'exploded',
  }).project;
  assert.equal(project.configurations.length, 1);
  project = addProduct(project, [guide], {
    part: guide,
    parameters: guide.defaults,
    state: 'rail',
  }).project;
  project = addProduct(project, [guide], {
    part: guide,
    parameters: guide.defaults,
    state: 'carriage',
  }).project;
  assert.deepEqual(
    project.configurations.map((item) => item.state),
    ['assembled', 'rail', 'carriage'],
  );
  const inspection = structuredClone(project);
  inspection.configurations[0].state = 'exploded';
  assert.match(validateProject(inspection, [guide]).join(' '), /inspection state/);
  assert.throws(() => parseProject(JSON.stringify(inspection), [guide]), /inspection state/);
});

test('enterprise rules travel with projects and control section order, labels, designation checks and documents', () => {
  const project = addProduct(createProject(), parts, selection(plate)).project;
  project.designation = 'PL.0000';
  const configuration = project.configurations[0];
  configuration.designation = 'PL.0001';
  configuration.manufacturing = {
    material: 'Aluminium',
    blank: 'Plate',
    processes: ['milling'],
    requirements: ['Inspect tolerances.'],
  };
  project.documents = [
    {
      ...createDocument(configuration),
      designation: 'PL.0001',
      name: 'Drawing',
      file: 'plate.pdf',
    },
  ];
  project.documentationRules.designationPattern = '^PL\\.[0-9]{4}$';
  project.documentationRules.requiredDocuments = ['model'];
  project.documentationRules.sectionOrder.reverse();
  project.documentationRules.sectionLabels.details = 'Machined details';
  assert.ok(
    projectReadiness(project, parts).issues.some((item) =>
      item.includes('model record is missing'),
    ),
  );
  project.documents.push({
    ...createDocument(configuration),
    kind: 'model',
    designation: 'PL.0001',
    name: 'Model',
    file: 'plate.FCStd',
    format: '3D',
  });
  assert.equal(projectReadiness(project, parts).complete, true);
  assert.ok(
    specificationCsv(specificationRows(project, parts), project.documentationRules).includes(
      'Machined details',
    ),
  );
  assert.deepEqual(
    parseProject(serializeProject(project, parts), parts).documentationRules,
    project.documentationRules,
  );
  configuration.designation = 'invalid';
  assert.ok(
    projectReadiness(project, parts).issues.some((item) =>
      item.includes('enterprise numbering rule'),
    ),
  );
  for (const pattern of ['(a+)+$', '^.*.*$', '^A{1,50}$', '^A\\1$']) {
    project.documentationRules.designationPattern = pattern;
    assert.ok(validateProject(project, parts).length > 0, pattern);
  }
  project.documentationRules.designationPattern = '';
  project.documentationRules.sectionOrder[0] = project.documentationRules.sectionOrder[1];
  assert.match(validateProject(project, parts).join(' '), /each section exactly once/);
});

test('project persistence reports rejected records and never stores invalid project graphs', (context) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  context.after(() =>
    previous
      ? Object.defineProperty(globalThis, 'localStorage', previous)
      : Reflect.deleteProperty(globalThis, 'localStorage'),
  );
  const project = createProject('Persisted project');
  storeProjects([project], parts);
  assert.deepEqual(readProjects(parts), { projects: [project], errors: [] });
  const broken = structuredClone(project);
  broken.configurations.push({
    id: 'missing-library',
    libraryId: 'missing',
    parameters: {},
    state: 'default',
    designation: '',
    name: 'Unknown',
    revision: 'A',
    supply: 'manufactured',
  } satisfies ProductConfiguration);
  assert.throws(() => storeProjects([broken], parts), /Unknown library product/);
  assert.deepEqual(readProjects(parts).projects, [project]);
  values.set('protolab.engineering-projects.v1', JSON.stringify([project, broken]));
  const restored = readProjects(parts);
  assert.deepEqual(restored.projects, [project]);
  assert.equal(restored.errors.length, 1);
});
