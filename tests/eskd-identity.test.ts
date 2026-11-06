import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureProduct,
  createProject,
  addProduct,
  parseProject,
  serializeProject,
  specificationRows,
  validateProject,
} from '../src/core/design-project';
import { eskdIdentity, eskdFileStem, supplierDesignation } from '../src/core/eskd';
import { exportOpenEskd } from '../src/core/open-eskd';
import type { PartDefinition } from '../src/core/types';
import detail from '../src/parts/manufactured-detail/part';

const plate = { ...detail.defaults, mode: 'plate', holePattern: 'four' };

test('supplier ordering identities retain complete descriptions and disambiguate size-only catalog labels', () => {
  const source = {
    sourceName: 'Supplier',
    sourceUrl: 'https://example.test/product',
    verifiedParameters: [],
  };
  const complete = 'CEL03113 · WS2812B 5050 stick · 8 LEDs';
  assert.equal(
    supplierDesignation({ ...source, designation: complete, productCodes: ['CEL03113'] }),
    complete,
  );
  assert.equal(
    supplierDesignation({
      ...source,
      designation: 'cel03113 · supplied LED module',
      productCodes: ['CEL03113'],
    }),
    'cel03113 · supplied LED module',
  );
  assert.equal(
    supplierDesignation({
      ...source,
      designation: 'M3 × 8',
      standard: 'DIN 912',
      productCodes: ['040-190-004'],
    }),
    '040-190-004',
  );
  assert.equal(
    supplierDesignation({ ...source, designation: 'M3 × 8', standard: 'ISO 7380-1' }),
    'M3 × 8 ISO 7380-1',
  );
});
const supplier: PartDefinition = {
  ...detail,
  id: 'supplier-unit',
  name: 'Power supply',
  identityParameters: undefined,
  product: { ...detail.product, kind: 'assembly', supply: 'purchased', processes: [] },
  parameters: [],
  defaults: {},
  presets: [
    {
      id: 'shop',
      name: 'ACME PSU-12V 5A enclosed switching power supply',
      description: 'Exact shop listing.',
      parameters: { model: 'PSU-12' },
      catalog: {
        name: 'ACME PSU-12V 5A enclosed switching power supply',
        designation: 'PSU-12',
        manufacturer: 'ACME',
        sourceName: 'Shop',
        sourceUrl: 'https://example.test/psu-12',
        verifiedParameters: ['model'],
      },
    },
  ],
  catalogSelectionOnly: true,
  validate: () => [],
};
supplier.defaults = { model: 'PSU-12' };
supplier.parameters = [{ key: 'model', label: 'Model', type: 'text', group: 'Product' }];

test('library model references survive project and ESKD export independently of supplier designations', () => {
  const identity = eskdIdentity(supplier, supplier.defaults, 'default', 'shop');
  assert.equal(identity.libraryId, 'supplier-unit');
  assert.equal(identity.presetId, 'shop');
  assert.equal(identity.libraryEntryId, 'supplier-unit:shop');
  assert.equal(identity.designation, 'PSU-12');
  const added = addProduct(createProject(), [supplier], {
    part: supplier,
    parameters: supplier.defaults,
    state: 'default',
    presetId: 'shop',
  });
  const restored = parseProject(serializeProject(added.project, [supplier]), [supplier]);
  const configured = restored.configurations[0];
  assert.equal(configured.libraryId, identity.libraryId);
  assert.equal(configured.presetId, identity.presetId);
  assert.deepEqual(configured.parameters, supplier.defaults);
  assert.equal(
    eskdIdentity(supplier, configured.parameters, configured.state, configured.presetId, configured)
      .configurationKey,
    identity.configurationKey,
  );
  const exported = JSON.parse(exportOpenEskd(restored, [supplier])).branches.main.working;
  const annotation = exported.components[0].extensions['com.defencore.protolab'].configuration;
  assert.equal(annotation.libraryId, identity.libraryId);
  assert.equal(annotation.presetId, identity.presetId);
  assert.deepEqual(annotation.parameters, supplier.defaults);
  assert.equal(annotation.id, configured.id);
  assert.equal(annotation.procurement.designation, 'PSU-12');
});

test('library metadata does not assign a model ID to missing or stale selections', () => {
  for (const selected of [undefined, 'missing', 'shop']) {
    const parameters = selected === 'shop' ? { model: 'Other model' } : supplier.defaults;
    const identity = eskdIdentity(supplier, parameters, 'default', selected);
    assert.equal(identity.libraryId, supplier.id);
    assert.equal(identity.libraryEntryId, supplier.id);
    assert.equal(identity.presetId, undefined);
  }
  const renamed = eskdIdentity(
    { ...supplier, name: 'Renamed family', category: 'Renamed category' },
    supplier.defaults,
    'default',
    'shop',
  );
  const original = eskdIdentity(supplier, supplier.defaults, 'default', 'shop');
  assert.equal(renamed.libraryEntryId, original.libraryEntryId);
  assert.equal(renamed.configurationKey, original.configurationKey);
});

test('physical configurations have stable executions across representation, property order and project export', () => {
  const configured = configureProduct({ part: detail, parameters: plate, state: 'default' });
  const standalone = eskdIdentity(detail, plate, 'default');
  assert.equal(configured.designation, standalone.designation);
  assert.match(configured.designation, /^PL3D\.MANUFACTURED\.DETAIL-[A-F0-9]{16}$/);
  const reordered = Object.fromEntries(Object.entries(plate).reverse());
  const alternate = eskdIdentity(
    detail,
    { ...reordered, width: 79, recipe: 'ignored', meshBackend: 'manifold', meshConform: false },
    'default',
  );
  assert.notEqual(
    alternate.designation,
    standalone.designation,
    'a changed plate width selects another execution',
  );
  const same = eskdIdentity(
    detail,
    { ...reordered, diameter: 900, recipe: 'ignored', meshBackend: 'manifold' },
    'default',
  );
  assert.equal(
    same.designation,
    standalone.designation,
    'hidden shaft dimensions and presentation do not change the plate',
  );
  const revised = eskdIdentity(detail, plate, 'default', undefined, {
    ...configured,
    revision: 'B',
  });
  assert.equal(revised.designation, standalone.designation);
  assert.match(revised.label, /rev B$/);
  assert.match(eskdFileStem(revised), /_rev-B$/);
});

test('matching fabricated executions are reused and distinct sizes retain independent names and revision records', () => {
  let added = addProduct(createProject(), [detail], {
    part: detail,
    parameters: plate,
    state: 'default',
  });
  added = addProduct(added.project, [detail], {
    part: detail,
    parameters: { ...plate, diameter: 30 },
    state: 'default',
  });
  assert.equal(added.project.configurations.length, 1);
  added = addProduct(added.project, [detail], {
    part: detail,
    parameters: { ...plate, length: 90 },
    state: 'default',
  });
  assert.equal(added.project.configurations.length, 2);
  const [first, second] = added.project.configurations;
  assert.equal(first.baseDesignation, second.baseDesignation);
  assert.notEqual(first.execution, second.execution);
  assert.notEqual(first.designation, second.designation);
  assert.deepEqual(
    parseProject(serializeProject(added.project, [detail]), [detail]),
    added.project,
  );
  assert.deepEqual(validateProject(added.project, [detail]), []);
  assert.equal(specificationRows(added.project, [detail]).length, 3);
});

test('a purchased component keeps its exact listing title throughout hierarchy and specification', () => {
  const assembly: PartDefinition = {
    ...detail,
    id: 'control-box',
    name: 'Control box',
    identityParameters: undefined,
    product: { ...detail.product, kind: 'assembly' },
    parameters: [],
    defaults: {},
    presets: [],
    validate: () => [],
    composition: () => ({
      issues: [],
      components: [
        {
          id: 'psu',
          libraryId: supplier.id,
          parameters: supplier.defaults,
          state: 'default',
          presetId: 'shop',
          name: 'Control power supply installation role',
          supply: 'purchased',
          quantity: 1,
          placement: { translation: [0, 0, 0], rotation: [0, 0, 0] },
        },
      ],
    }),
  };
  const parts = [assembly, supplier];
  const added = addProduct(createProject(), parts, {
    part: assembly,
    parameters: {},
    state: 'default',
  });
  const configured = added.project.configurations.find((item) => item.libraryId === supplier.id)!;
  assert.equal(configured.name, supplier.presets[0].name);
  assert.equal(configured.procurement?.name, supplier.presets[0].name);
  assert.equal(
    eskdIdentity(supplier, supplier.defaults, 'default', 'shop', configured).label,
    supplier.presets[0].name,
  );
  assert.equal(
    specificationRows(added.project, parts, added.occurrenceId)[0].name,
    supplier.presets[0].name,
  );
  const occurrence = added.project.occurrences.find(
    (item) => item.configurationId === configured.id,
  )!;
  assert.throws(
    () =>
      addProduct(
        added.project,
        parts,
        { part: supplier, parameters: supplier.defaults, state: 'default', presetId: 'shop' },
        occurrence.id,
      ),
    /opaque unit/,
  );
});

test('enterprise numbers and revisions remain independent of placement, and conflicting designs are rejected', () => {
  const added = addProduct(createProject(), [detail], {
    part: detail,
    parameters: plate,
    state: 'default',
  });
  const configured = added.project.configurations[0];
  configured.designation = 'MECH.100.001-02';
  configured.baseDesignation = 'MECH.100.001';
  configured.execution = '02';
  configured.revision = '03';
  added.project.occurrences[0].position = '99';
  added.project.occurrences[0].placement.translation = [100, 50, 0];
  const identity = eskdIdentity(
    detail,
    configured.parameters,
    configured.state,
    undefined,
    configured,
  );
  assert.equal(identity.designation, 'MECH.100.001-02');
  assert.equal(identity.revision, '03');
  assert.match(identity.label, /^MECH\.100\.001-02 .+rev 03$/);
  added.project.configurations.push({
    ...structuredClone(configured),
    id: 'conflict',
    parameters: { ...plate, length: 99 },
  });
  assert.match(validateProject(added.project, [detail]).join(' '), /conflicting designs/);
});
