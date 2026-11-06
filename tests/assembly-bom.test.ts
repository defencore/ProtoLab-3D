import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { assemblyBomRows } from '../src/core/assembly-bom';
import type { AssemblyComponent, SupplyKind } from '../src/core/product-types';
import type { PartDefinition, Preset } from '../src/core/types';

function definition(id: string, supply: SupplyKind = 'manufactured'): PartDefinition {
  return {
    id,
    name: id,
    category: 'TEST',
    subgroup: 'TEST',
    description: 'BOM identity fixture.',
    keywords: [],
    icon: 'box',
    complexity: 'Fixture',
    product: {
      kind: supply === 'reference' ? 'reference' : 'detail',
      supply,
      description: 'Explicit fixture classification.',
      processes: supply === 'manufactured' ? ['milling'] : [],
      releaseRequirements: ['Verify fixture interfaces.'],
    },
    parameters: [
      { key: 'length', label: 'Length', type: 'number', min: 1, group: 'Dimensions' },
      {
        key: 'detail',
        label: 'Preview detail',
        type: 'select',
        group: 'Inspection',
        options: ['simple', 'full'].map((value) => ({ value, label: value })),
      },
    ],
    defaults: { length: 10, detail: 'simple' },
    presets: [],
    states: [
      { id: 'assembled', label: 'Assembled', description: 'Installed product.' },
      { id: 'exploded', label: 'Exploded', description: 'Inspection only.' },
    ],
    validate: () => [],
    buildGeometry: () => new Group(),
    python: () => 'shape = Part.makeBox(1, 1, 1)',
    dimensions: () => [1, 1, 1],
  };
}

function occurrence(
  part: PartDefinition,
  id: string,
  quantity = 1,
  patch: Partial<AssemblyComponent> = {},
): AssemblyComponent {
  return {
    id,
    libraryId: part.id,
    parameters: { ...part.defaults },
    state: 'assembled',
    quantity,
    placement: { translation: [0, 0, 0], rotation: [0, 0, 0] },
    name: 'Same installation name',
    supply: part.product.supply,
    ...patch,
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

test('BOM groups physical configurations independently of occurrence IDs, labels, placement and inspection state without mutating inputs', () => {
  const plate = definition('plate');
  const first = occurrence(plate, 'left-plate', 2, { name: 'Left plate' });
  const second = occurrence(plate, 'right-plate', 3, {
    name: 'Right plate',
    parameters: { detail: 'full', length: 10 },
    state: 'exploded',
    placement: { translation: [100, -20, 5], rotation: [0, 90, 0] },
    notes: 'A different installation role.',
  });
  const input = freeze([first, second]);
  const before = structuredClone(input);
  const rows = assemblyBomRows(input, freeze([plate]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 5);
  assert.strictEqual(rows[0].component, first);
  assert.equal(rows[0].component.quantity, 2, 'aggregate quantity belongs to the row');
  assert.equal(rows[0].libraryEntryId, 'plate');
  assert.deepEqual(input, before);
  assert.deepEqual(assemblyBomRows(input, [plate]), rows, 'stable rows on repeated reads');
});

test('same names never merge different dimensions, physical states, library products or manufacturing definitions', () => {
  const plate = definition('plate');
  const alternate = definition('other-plate');
  const splitProduct = {
    ...definition('screw-nut'),
    states: ['assembled', 'screw-only', 'nut-only'].map((id) => ({
      id,
      label: id,
      description: id,
    })),
    physicalStates: ['screw-only', 'nut-only'],
  };
  const manufacturing = {
    material: 'Steel',
    blank: 'Plate',
    processes: ['milling'] as const,
    requirements: ['Deburr.'],
  };
  const source = [
    occurrence(plate, 'short'),
    occurrence(plate, 'long', 1, { parameters: { ...plate.defaults, length: 20 } }),
    occurrence(alternate, 'other-library'),
    occurrence(splitProduct, 'screw', 1, { state: 'screw-only' }),
    occurrence(splitProduct, 'nut', 1, { state: 'nut-only' }),
    occurrence(plate, 'steel', 1, {
      manufacturing: { ...manufacturing, processes: [...manufacturing.processes] },
    }),
    occurrence(plate, 'aluminium', 1, {
      manufacturing: {
        ...manufacturing,
        material: 'Aluminium',
        processes: [...manufacturing.processes],
      },
    }),
  ];
  const rows = assemblyBomRows(source, [plate, alternate, splitProduct]);
  assert.equal(rows.length, source.length);
  assert.equal(new Set(rows.map((row) => row.key)).size, source.length);
  assert.ok(rows.every((row) => row.quantity === 1));
});

test('physical parameter hooks and structured recipe property order define identity, while prototype preset labels do not', () => {
  const body = definition('posed-body');
  body.identityParameters = (parameters) => ({ length: parameters.length });
  const rows = assemblyBomRows(
    [
      occurrence(body, 'first', 2, { parameters: { ...body.defaults, angle: 0 } }),
      occurrence(body, 'second', 4, { parameters: { ...body.defaults, angle: 40 } }),
    ],
    [body],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 6);

  const recipe = definition('recipe-detail');
  const recipes = [
    occurrence(recipe, 'first', 1, {
      parameters: { ...recipe.defaults, recipe: '{"kind":"box","width":3,"height":4}' },
    }),
    occurrence(recipe, 'second', 2, {
      parameters: { recipe: '{"height":4,"width":3,"kind":"box"}', detail: 'full', length: 10 },
    }),
  ];
  assert.deepEqual(
    assemblyBomRows(recipes, [recipe]).map((row) => row.quantity),
    [3],
  );

  const prototype = definition('prototype');
  prototype.presets = ['prototype-a', 'prototype-b'].map((id) => ({
    id,
    name: id,
    description: id,
    parameters: { ...prototype.defaults },
  }));
  const prototypes = assemblyBomRows(
    [
      occurrence(prototype, 'a', 2, { presetId: 'prototype-a' }),
      occurrence(prototype, 'b', 3, { presetId: 'prototype-b' }),
    ],
    [prototype],
  );
  assert.equal(prototypes.length, 1);
  assert.equal(prototypes[0].quantity, 5);
  assert.equal(prototypes[0].libraryEntryId, 'prototype:prototype-a');
});

test('fixed purchased models ignore installation poses only for an explicitly matching catalog identity', () => {
  const motor = definition('motor', 'purchased');
  motor.catalogSelectionOnly = true;
  motor.defaults = { model: 'alpha', angle: 0, detail: 'simple' };
  motor.presets = ['alpha', 'beta'].map((model): Preset => ({
    id: model,
    name: model,
    description: model,
    parameters: { model, angle: 0, detail: 'simple' },
    catalog: {
      designation: 'SKU-' + model,
      manufacturer: 'Acme',
      sourceName: 'Catalog',
      sourceUrl: 'https://example.com/motors',
      verifiedParameters: ['model'],
    },
  }));
  const procurement = {
    designation: 'SKU-alpha',
    manufacturer: 'Acme',
    source: 'https://example.com/motors',
  };
  const components = [
    occurrence(motor, 'motor-left', 2, { presetId: 'alpha', procurement }),
    occurrence(motor, 'motor-right', 3, {
      presetId: 'alpha',
      procurement: { ...procurement },
      parameters: { detail: 'full', angle: 90, model: 'alpha' },
      state: 'exploded',
    }),
    occurrence(motor, 'other-model', 1, {
      presetId: 'beta',
      parameters: { ...motor.defaults, model: 'beta' },
    }),
    occurrence(motor, 'other-supplier', 1, {
      presetId: 'alpha',
      procurement: { ...procurement, manufacturer: 'Other maker' },
    }),
    occurrence(motor, 'other-source', 1, {
      presetId: 'alpha',
      procurement: { ...procurement, source: 'https://example.com/other-source' },
    }),
    occurrence(motor, 'stale-source', 1, {
      presetId: 'alpha',
      parameters: { ...motor.defaults, model: 'beta' },
    }),
    occurrence(motor, 'stale-source-posed', 1, {
      presetId: 'alpha',
      parameters: { ...motor.defaults, model: 'beta', angle: 90 },
    }),
  ];
  const rows = assemblyBomRows(components, [motor]);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].quantity, 5);
  assert.equal(rows[0].libraryEntryId, 'motor:alpha');
  assert.equal(rows[1].libraryEntryId, 'motor:beta');
  assert.equal(rows[4].libraryEntryId, 'motor', 'stale preset does not assert a catalog source');
  assert.equal(rows[5].libraryEntryId, 'motor');
});

test('nested quantities multiply at every level and aggregate subassemblies and descendants in first-source order', () => {
  const module = {
    ...definition('module'),
    product: { ...definition('module').product, kind: 'assembly' as const },
  };
  const plate = definition('plate');
  const bolt = definition('bolt', 'standard');
  const host = definition('host');
  const children = () => [
    occurrence(plate, 'plate', 3),
    occurrence(module, 'submodule', 4, {
      parameters: { ...module.defaults, length: 20 },
      children: [occurrence(bolt, 'bolt', 5)],
    }),
  ];
  const rows = assemblyBomRows(
    [
      occurrence(module, 'module-left', 2, { children: children() }),
      occurrence(module, 'module-right', 3, { children: children() }),
      occurrence(plate, 'spare-plate', 4),
    ],
    [module, plate, bolt, host],
  );
  assert.deepEqual(
    rows.map((row) => [row.component.libraryId, row.component.parameters.length, row.quantity]),
    [
      ['module', 10, 5],
      ['plate', 10, 19],
      ['module', 20, 20],
      ['bolt', 10, 100],
    ],
  );
  assert.ok(!rows.some((row) => row.component.libraryId === 'host'));
});

test('purchased and standard units are opaque even when their source has display children or a composition function', () => {
  const purchased = definition('board', 'purchased');
  const standard = definition('standard-unit', 'standard');
  for (const part of [purchased, standard])
    part.composition = () => assert.fail('Supplier internals are not separately procured.');
  const hidden = occurrence(definition('missing-internal'), 'internal', 0);
  const rows = assemblyBomRows(
    [
      occurrence(purchased, 'board', 2, { children: [hidden] }),
      occurrence(standard, 'standard', 3),
    ],
    [purchased, standard],
  );
  assert.deepEqual(
    rows.map((row) => [row.component.libraryId, row.quantity]),
    [
      ['board', 2],
      ['standard-unit', 3],
    ],
  );
});

test('reference rows are omitted but declared physical descendants keep their quantity multipliers', () => {
  const reference = definition('reference-group', 'reference');
  const plate = definition('plate');
  const rows = assemblyBomRows(
    [occurrence(reference, 'reference', 4, { children: [occurrence(plate, 'physical-plate', 3)] })],
    [reference, plate],
  );
  assert.deepEqual(
    rows.map((row) => [row.component.libraryId, row.quantity]),
    [['plate', 12]],
  );
});

test('undefined children expand the library definition while explicit empty children remain authoritative', () => {
  const plate = definition('plate');
  const module = definition('module');
  let expanded = 0;
  module.composition = () => {
    expanded++;
    return { components: [occurrence(plate, 'plate', 2)], issues: [] };
  };
  const rows = assemblyBomRows(
    [occurrence(module, 'implicit', 3), occurrence(module, 'explicit-empty', 4, { children: [] })],
    [module, plate],
  );
  assert.equal(expanded, 1);
  assert.deepEqual(
    rows.map((row) => [row.component.libraryId, row.quantity]),
    [
      ['module', 7],
      ['plate', 6],
    ],
  );
});

test('unresolved IDs, invalid quantities and unsafe multiplied or summed quantities fail instead of returning a misleading BOM', () => {
  const plate = definition('plate');
  const module = definition('module');
  assert.throws(
    () => assemblyBomRows([occurrence(plate, 'missing', 1, { libraryId: 'missing' })], [plate]),
    /Missing library/,
  );
  for (const quantity of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(
      () => assemblyBomRows([occurrence(plate, 'bad', quantity)], [plate]),
      /quantity.*positive safe integer/i,
    );
  assert.throws(
    () =>
      assemblyBomRows(
        [
          occurrence(module, 'large', Number.MAX_SAFE_INTEGER, {
            children: [occurrence(plate, 'child', 2)],
          }),
        ],
        [module, plate],
      ),
    /quantity.*safe integer/i,
  );
  assert.throws(
    () =>
      assemblyBomRows(
        [occurrence(plate, 'large', Number.MAX_SAFE_INTEGER), occurrence(plate, 'extra', 1)],
        [plate],
      ),
    /quantity.*safe integer/i,
  );
});

test('implicit library cycles and excessive nesting fail, while finite explicit repeated assembly IDs remain valid', () => {
  const a = definition('assembly-a'),
    b = definition('assembly-b');
  a.composition = () => ({ components: [occurrence(b, 'b')], issues: [] });
  b.composition = () => ({ components: [occurrence(a, 'a')], issues: [] });
  assert.throws(
    () => assemblyBomRows([occurrence(a, 'root')], [a, b]),
    /Cyclic library composition/,
  );
  assert.deepEqual(
    assemblyBomRows(
      [occurrence(a, 'outer', 2, { children: [occurrence(a, 'inner', 3, { children: [] })] })],
      [a],
    ).map((row) => row.quantity),
    [8],
  );
  let deep = occurrence(a, 'end', 1, { children: [] });
  for (let i = 0; i < 129; i++) deep = occurrence(a, 'level-' + i, 1, { children: [deep] });
  assert.throws(() => assemblyBomRows([deep], [a]), /128 assembly levels/);
});
