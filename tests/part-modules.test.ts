import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Group } from 'three';
import { registerPartModules, type PartModule } from '../src/core/part-modules';
import {
  discoverPackages,
  inspectPackage,
  registrySource,
  SDK_FILES,
  syncRegistry,
} from '../scripts/part-modules/library';
import { createPackage, exportPackage, importPackage } from '../scripts/part-modules/operations';
import { starterFiles } from '../scripts/part-modules/templates';
import { checkPackageDefinitions } from '../scripts/part-modules/check';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-modules-'));
  await fs.mkdir(path.join(root, 'src/core'), { recursive: true });
  for (const name of [
    ...SDK_FILES,
    'freecad.ts',
    'validation.ts',
    'catalog-models.ts',
    'model-evidence.ts',
  ]) {
    await fs.mkdir(path.dirname(path.join(root, 'src/core', name)), { recursive: true });
    await fs.copyFile(path.join(repository, 'src/core', name), path.join(root, 'src/core', name));
  }
  await fs.copyFile(path.join(repository, 'package.json'), path.join(root, 'package.json'));
  await addStarter(root, 'first-spacer', 20);
  await syncRegistry(root);
  return root;
}

async function addStarter(root: string, id: string, order: number) {
  const folder = path.join(root, 'src/parts', id);
  for (const [name, content] of Object.entries(starterFiles(id, id, order))) {
    await fs.mkdir(path.dirname(path.join(folder, name)), { recursive: true });
    await fs.writeFile(path.join(folder, name), content);
  }
  return folder;
}

test('part registry discovers, orders, adds and removes complete packages without manual registration', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await addStarter(root, 'second-spacer', 10);
  const modules = await syncRegistry(root);
  assert.deepEqual(
    modules.map((module) => module.id),
    ['second-spacer', 'first-spacer'],
  );
  assert.equal(
    await fs.readFile(path.join(root, 'src/parts/index.ts'), 'utf8'),
    registrySource(modules),
  );
  await fs.rm(path.join(root, 'src/parts/second-spacer'), { recursive: true });
  assert.deepEqual(
    (await syncRegistry(root)).map((module) => module.id),
    ['first-spacer'],
  );
});

test('static preflight rejects cross-part imports, missing files, IDs, API versions and duplicate presets', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, 'src/parts/first-spacer');
  const index = path.join(folder, 'index.ts');
  const original = await fs.readFile(index, 'utf8');
  await fs.writeFile(index, original.replace('apiVersion: 2', 'apiVersion: 1'));
  await assert.rejects(inspectPackage(folder, root), /apiVersion: 2/);
  await fs.writeFile(index, original.replace('id: "first-spacer"', "id: 'different-spacer'"));
  await assert.rejects(inspectPackage(folder, root), /does not match part ID/);
  await fs.writeFile(index, original);
  await addStarter(root, 'other-spacer', 30);
  const part = path.join(folder, 'part.ts');
  const body = await fs.readFile(part, 'utf8');
  await fs.writeFile(part, body + "\nimport other from '../other-spacer/part';\n");
  await assert.rejects(inspectPackage(folder, root), /crosses the part boundary/);
  await fs.writeFile(part, body + "\nimport fs from 'node:fs';\n");
  await assert.rejects(inspectPackage(folder, root), /unsupported dependency node:fs/);
  await fs.writeFile(part, body + '\nconst future = (name: string) => import(name);\n');
  await assert.rejects(inspectPackage(folder, root), /Dynamic imports must use literal/);
  await fs.writeFile(part, body);
  const presets = JSON.parse(await fs.readFile(path.join(folder, 'presets.json'), 'utf8'));
  await fs.writeFile(path.join(folder, 'presets.json'), JSON.stringify([...presets, ...presets]));
  await assert.rejects(inspectPackage(folder, root), /unique id/);
  await fs.writeFile(path.join(folder, 'presets.json'), JSON.stringify(presets));
  const productPath = path.join(folder, 'product.json');
  const product = await fs.readFile(productPath, 'utf8');
  await fs.writeFile(
    productPath,
    JSON.stringify({ ...JSON.parse(product), supply: 'unclassified' }),
  );
  await assert.rejects(inspectPackage(folder, root), /Invalid product profile/);
  await fs.writeFile(productPath, product);
  await fs.unlink(path.join(folder, 'configurator.ts'));
  await assert.rejects(
    inspectPackage(folder, root),
    /Missing required package file: configurator.ts/,
  );
});

test('static package boundaries reject symbolic links', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, 'src/parts/first-spacer');
  await fs.symlink(path.join(root, 'src/core/geometry.ts'), path.join(folder, 'shortcut.ts'));
  await assert.rejects(inspectPackage(folder, root), /symlinks are not supported/);
});

test('starter creates an isolated configurator and never overwrites an existing package', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = await createPackage(root, 'camera-mount', 'Camera Mount');
  assert.equal((await inspectPackage(folder, root)).id, 'camera-mount');
  assert.match(await fs.readFile(path.join(folder, 'part.ts'), 'utf8'), /Camera Mount/);
  await assert.rejects(createPackage(root, 'camera-mount'), /already exists/);
  await assert.rejects(createPackage(root, '../escape'), /hyphen-separated part ID/);
  assert.deepEqual(
    (await discoverPackages(root)).map((module) => module.id),
    ['first-spacer', 'camera-mount'],
  );
});

test('export and import round trip only the selected package, preserve SDK and keep a restorable backup', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const other = await addStarter(root, 'unrelated-spacer', 30);
  const unrelatedBefore = await fs.readFile(path.join(other, 'part.ts'), 'utf8');
  const sdkBefore = await fs.readFile(path.join(root, 'src/core/geometry.ts'), 'utf8');
  const partPath = path.join(root, 'src/parts/first-spacer/part.ts');
  const original = await fs.readFile(partPath, 'utf8');
  await fs.writeFile(partPath, original + "\nconst evidence = 'references/local-evidence.png';\n");
  await fs.mkdir(path.join(root, 'public/references'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'public/references/local-evidence.png'),
    Buffer.from([1, 2, 3]),
  );
  const handoff = await exportPackage(root, 'first-spacer', path.join(root, 'handoff'));
  assert.match(await fs.readFile(path.join(handoff, 'src/main.ts'), 'utf8'), /generateScript/);
  assert.deepEqual(
    await fs.readFile(path.join(handoff, 'public/references/local-evidence.png')),
    Buffer.from([1, 2, 3]),
  );
  const editedPart = path.join(handoff, 'src/parts/first-spacer/part.ts');
  await fs.appendFile(
    editedPart,
    '\nthrow new Error("Static import must never execute this code");\n',
  );
  await fs.appendFile(
    path.join(handoff, 'src/core/geometry.ts'),
    '\n// SDK edits must not be imported.\n',
  );
  await assert.rejects(importPackage(root, handoff), /--replace/);
  const result = await importPackage(root, handoff, true);
  assert.ok(result.backup);
  assert.match(await fs.readFile(partPath, 'utf8'), /Static import must never execute/);
  assert.equal(
    await fs.readFile(path.join(result.backup!, 'part.ts'), 'utf8'),
    original + "\nconst evidence = 'references/local-evidence.png';\n",
  );
  assert.equal(await fs.readFile(path.join(other, 'part.ts'), 'utf8'), unrelatedBefore);
  assert.equal(await fs.readFile(path.join(root, 'src/core/geometry.ts'), 'utf8'), sdkBefore);
  assert.equal((await discoverPackages(root)).length, 2);
});

test('invalid imports and conflicting reference assets leave the current package intact', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const partPath = path.join(root, 'src/parts/first-spacer/part.ts');
  const original = await fs.readFile(partPath, 'utf8');
  const handoff = await exportPackage(root, 'first-spacer', path.join(root, 'handoff'));
  const index = path.join(handoff, 'src/parts/first-spacer/index.ts');
  const originalIndex = await fs.readFile(index, 'utf8');
  await fs.writeFile(index, originalIndex.replace('apiVersion: 2', 'apiVersion: 999'));
  await assert.rejects(importPackage(root, handoff, true), /apiVersion/);
  assert.equal(await fs.readFile(partPath, 'utf8'), original);
  await fs.writeFile(index, originalIndex);
  await fs.appendFile(
    path.join(handoff, 'src/parts/first-spacer/part.ts'),
    "\nconst evidence = 'references/collision.png';\n",
  );
  for (const directory of [root, handoff])
    await fs.mkdir(path.join(directory, 'public/references'), { recursive: true });
  await fs.writeFile(path.join(root, 'public/references/collision.png'), 'original');
  await fs.writeFile(path.join(handoff, 'public/references/collision.png'), 'edited');
  await assert.rejects(importPackage(root, handoff, true), /different contents/);
  assert.equal(await fs.readFile(partPath, 'utf8'), original);
  assert.equal(
    await fs.readFile(path.join(root, 'public/references/collision.png'), 'utf8'),
    'original',
  );
});

test('runtime registration reports duplicates and malformed configurators before UI construction', () => {
  const definition = {
    id: 'test-part',
    name: 'Test part',
    category: 'TEST',
    subgroup: 'TEST',
    description: 'A test fixture.',
    product: {
      kind: 'detail' as const,
      supply: 'manufactured' as const,
      description: 'A test fixture.',
      processes: ['milling' as const],
      releaseRequirements: ['Review the configured fixture drawing.'],
    },
    icon: 'bolt' as const,
    complexity: '1 parameter',
    keywords: [],
    parameters: [{ key: 'length', label: 'Length', type: 'number' as const, group: 'Dimensions' }],
    defaults: { length: 5 },
    presets: [],
    validate: () => [],
    buildGeometry: () => new Group(),
    python: () => 'shape = Part.makeBox(1, 1, 5)',
    dimensions: (): [number, number, number] => [1, 1, 5],
  };
  const module: PartModule = { apiVersion: 2, order: 1, part: definition };
  assert.equal(registerPartModules([module])[0], definition);
  assert.throws(() => registerPartModules([module, module]), /Duplicate part module ID/);
  assert.throws(
    () => registerPartModules([{ ...module, part: { ...definition, defaults: {} } }]),
    /Missing default for length/,
  );
  assert.throws(
    () => registerPartModules([{ ...module, apiVersion: 1 } as unknown as PartModule]),
    /Unsupported part module API/,
  );
  assert.throws(
    () =>
      registerPartModules([
        { ...module, part: { ...definition, product: { ...definition.product, processes: [] } } },
      ]),
    /explicit process route/,
  );
  const textPart = {
    ...definition,
    parameters: [{ key: 'recipe', label: 'Recipe', type: 'text' as const, group: 'Definition' }],
    defaults: { recipe: '{}' },
  };
  assert.equal(registerPartModules([{ ...module, part: textPart }])[0], textPart);
  assert.throws(
    () => registerPartModules([{ ...module, part: { ...textPart, defaults: { recipe: true } } }]),
    /must be a string/,
  );
  const conditionalField = {
    key: 'manualState',
    label: 'Manual switch',
    type: 'select' as const,
    group: 'Operation',
    options: [{ label: 'Off', value: 'off' }],
    optionalWhenHidden: true,
    visibleWhen: (values: Record<string, number | string | boolean>) => Number(values.length) > 5,
  };
  const conditionalPart = {
    ...definition,
    parameters: [...definition.parameters, conditionalField],
  };
  assert.equal(registerPartModules([{ ...module, part: conditionalPart }])[0], conditionalPart);
  assert.throws(
    () =>
      registerPartModules([{ ...module, part: { ...conditionalPart, defaults: { length: 10 } } }]),
    /Missing default for manualState/,
    'An active field still requires a default.',
  );
  assert.throws(
    () =>
      registerPartModules([
        {
          ...module,
          part: {
            ...definition,
            parameters: [...definition.parameters, { ...conditionalField, visibleWhen: undefined }],
          },
        },
      ]),
    /requires a visibility condition/,
  );
});

test('API2 authored product structures require physical composition while supplier units remain opaque', () => {
  const module: PartModule = {
    apiVersion: 2,
    order: 1,
    part: {
      id: 'product-unit',
      name: 'Product unit',
      category: 'TEST',
      subgroup: 'TEST',
      description: 'A structural contract fixture.',
      icon: 'box',
      complexity: 'Unit',
      keywords: [],
      parameters: [],
      defaults: {},
      presets: [],
      validate: () => [],
      buildGeometry: () => new Group(),
      python: () => '',
      dimensions: () => [1, 1, 1],
      product: {
        kind: 'assembly',
        supply: 'manufactured',
        description: 'An authored unit.',
        processes: ['assembly'],
        releaseRequirements: ['Identify every physical component.'],
      },
    },
  };
  for (const kind of ['assembly', 'complex', 'kit'] as const) {
    const missing = {
      ...module,
      part: { ...module.part, product: { ...module.part.product, kind } },
    };
    assert.throws(
      () => registerPartModules([missing]),
      /require a physical library composition function/,
    );
    const defined = {
      ...missing,
      part: {
        ...missing.part,
        composition: () => ({ components: [], issues: ['Resolve the fixture components.'] }),
      },
    };
    assert.equal(registerPartModules([defined])[0], defined.part);
  }
  const supplier = {
    ...module,
    part: {
      ...module.part,
      product: { ...module.part.product, supply: 'purchased' as const, processes: [] },
    },
  };
  assert.equal(registerPartModules([supplier])[0], supplier.part);
  for (const invalid of [null, {}, [], true, 42, 'a component list'])
    assert.throws(
      () =>
        registerPartModules([
          {
            ...supplier,
            part: { ...supplier.part, composition: invalid },
          } as unknown as PartModule,
        ]),
      /Composition must be a function/,
    );
});

test('declared library dependencies are portable and cannot silently overwrite shared packages', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const own = path.join(root, 'src/parts/first-spacer'),
    other = await addStarter(root, 'other-spacer', 30);
  const index = path.join(own, 'index.ts');
  await fs.writeFile(
    index,
    (await fs.readFile(index, 'utf8')).replace(
      'apiVersion: 2',
      "apiVersion: 2, dependencies: ['other-spacer']",
    ),
  );
  await fs.appendFile(path.join(own, 'part.ts'), "\nimport other from '../other-spacer/part';\n");
  assert.deepEqual((await inspectPackage(own, root)).dependencies, ['other-spacer']);
  const handoff = await exportPackage(root, 'first-spacer', path.join(root, 'handoff'));
  const dependency = path.join(handoff, 'src/parts/other-spacer/part.ts');
  assert.equal(
    await fs.readFile(dependency, 'utf8'),
    await fs.readFile(path.join(other, 'part.ts'), 'utf8'),
  );
  await importPackage(root, handoff, true);
  await fs.appendFile(dependency, '\n// changed dependency\n');
  await assert.rejects(importPackage(root, handoff, true), /differs|match|changed|different/i);
  assert.doesNotMatch(await fs.readFile(path.join(other, 'part.ts'), 'utf8'), /changed dependency/);
  const otherIndex = path.join(other, 'index.ts');
  await fs.writeFile(
    otherIndex,
    (await fs.readFile(otherIndex, 'utf8')).replace(
      'apiVersion: 2',
      "apiVersion: 2, dependencies: ['first-spacer']",
    ),
  );
  await assert.rejects(inspectPackage(own, root), /Cyclic package dependency/);
});

test('checking one assembly resolves its transitive dependencies while reporting only the selected package', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.symlink(path.join(repository, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const first = path.join(root, 'src/parts/first-spacer');
  const intermediate = await addStarter(root, 'intermediate-spacer', 30);
  await addStarter(root, 'leaf-spacer', 40);
  for (const [folder, dependency] of [
    [first, 'intermediate-spacer'],
    [intermediate, 'leaf-spacer'],
  ]) {
    const index = path.join(folder, 'index.ts');
    await fs.writeFile(
      index,
      (await fs.readFile(index, 'utf8')).replace(
        'apiVersion: 2',
        `apiVersion: 2, dependencies: ['${dependency}']`,
      ),
    );
  }
  const selected = await inspectPackage(first, root);
  assert.deepEqual(await checkPackageDefinitions([selected]), { parts: 1, presets: 1 });
});

test('a dependency assembly handoff compiles the complete shared SDK and registers transitive library packages', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const intermediate = await addStarter(root, 'intermediate-spacer', 30);
  await addStarter(root, 'leaf-spacer', 40);
  for (const [folder, dependency] of [
    [path.join(root, 'src/parts/first-spacer'), 'intermediate-spacer'],
    [intermediate, 'leaf-spacer'],
  ]) {
    const index = path.join(folder, 'index.ts');
    await fs.writeFile(
      index,
      (await fs.readFile(index, 'utf8')).replace(
        'apiVersion: 2',
        `apiVersion: 2, dependencies: ['${dependency}']`,
      ),
    );
  }
  const handoff = await exportPackage(root, 'first-spacer', path.join(root, 'handoff'));
  const main = await fs.readFile(path.join(handoff, 'src/main.ts'), 'utf8');
  const source = await import('typescript');
  const ast = source.default.createSourceFile(
    'main.ts',
    main,
    source.default.ScriptTarget.Latest,
    true,
  );
  const modules = new Map<string, PartModule>();
  for (const statement of ast.statements) {
    if (
      !source.default.isImportDeclaration(statement) ||
      !source.default.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('./parts/')) continue;
    const name = statement.importClause?.name?.text;
    assert.ok(name);
    const id = specifier.split('/')[2];
    modules.set(name, {
      apiVersion: 2,
      order: modules.size + 1,
      part: {
        id,
        name: id,
        category: 'Test',
        subgroup: 'Test',
        description: 'A handoff component.',
        icon: 'box',
        complexity: 'Fixture',
        keywords: [],
        parameters: [],
        defaults: {},
        presets: [],
        product: {
          kind: 'detail',
          supply: 'manufactured',
          description: 'A handoff component.',
          processes: ['milling'],
          releaseRequirements: ['Review the drawing.'],
        },
        validate: () => [],
        buildGeometry: () => new Group(),
        python: () => '',
        dimensions: () => [1, 1, 1],
      },
      dependencies:
        id === 'first-spacer'
          ? ['intermediate-spacer']
          : id === 'intermediate-spacer'
            ? ['leaf-spacer']
            : [],
    });
  }
  let registered: PartModule[] = [];
  const visit = (node: import('typescript').Node) => {
    if (
      source.default.isCallExpression(node) &&
      source.default.isIdentifier(node.expression) &&
      node.expression.text === 'registerPartModules'
    ) {
      const argument = node.arguments[0];
      assert.ok(argument && source.default.isArrayLiteralExpression(argument));
      registered = argument.elements.map((item) => {
        assert.ok(source.default.isIdentifier(item));
        const module = modules.get(item.text);
        assert.ok(module);
        return module;
      });
    }
    source.default.forEachChild(node, visit);
  };
  visit(ast);
  assert.deepEqual(
    registerPartModules(registered)
      .map((part) => part.id)
      .sort(),
    ['first-spacer', 'intermediate-spacer', 'leaf-spacer'],
  );
  await fs.symlink(path.join(repository, 'node_modules'), path.join(handoff, 'node_modules'));
  const checked = spawnSync(
    process.execPath,
    [
      path.join(repository, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '-p',
      path.join(handoff, 'tsconfig.json'),
    ],
    { encoding: 'utf8' },
  );
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
});
