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
import { starterFiles, workbenchFiles } from '../scripts/part-modules/templates';
import { checkPackageDefinitions } from '../scripts/part-modules/check';
import { availableModelState } from '../src/core/part-selection';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('workbench waits for geometry initialization and discards superseded configurations', async () => {
  const ts = (await import('typescript')).default;
  const main = workbenchFiles('async-fixture')['src/main.ts'];
  const source = ts.createSourceFile('main.ts', main, ts.ScriptTarget.Latest, true);
  const stateNames = new Set(['rebuildRevision', 'readyRevision', 'geometryPreparation']);
  const state = source.statements
    .filter(
      (statement) =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) && stateNames.has(declaration.name.text),
        ),
    )
    .map((statement) => statement.getText(source))
    .join('\n');
  const functions = source.statements
    .filter(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        ['rebuild', 'prepareScript'].includes(statement.name?.text ?? ''),
    )
    .map((statement) => statement.getText(source))
    .join('\n');
  const pending: {
    parameters: { length: number };
    resolve(): void;
    reject(error: Error): void;
  }[] = [];
  const builds: { length: number; state: string }[] = [];
  const modes: string[] = [];
  const host = {
    copy: { disabled: false },
    download: { disabled: false },
    textarea: { value: '' },
    status: { textContent: '', classList: { remove() {}, toggle() {} } },
    part: {
      initializeGeometry: (parameters: { length: number }) =>
        new Promise<void>((resolve, reject) => {
          pending.push({ parameters, resolve, reject });
        }),
      buildGeometry: (parameters: { length: number }, state: string) => {
        builds.push({ ...parameters, state });
        return {};
      },
    },
    modes,
  };
  const program = ts.transpileModule(
    `const api = (() => {
      const { part, copy, download, textarea, status } = host;
      const dependency = { id: 'fixture-dependency' };
      const parts = [part, dependency];
      let parameters = { length: 1 }, state = 'default', geometryMode = 'simple';
      let model, script = '';
      const scene = { add() {}, remove() {} };
      const validateParameters = () => [];
      const withGeometryMode = (mode, build) => { host.modes.push(mode); return build(); };
      const release = () => {}, fit = () => {};
      const generateScript = (_part, values, pose, _a, _b, mode, definitions) => {
        if (!definitions?.includes(dependency)) throw new Error('The registered workbench dependency is missing.');
        return JSON.stringify({ ...values, pose, mode });
      };
      const consoleCommand = (value) => value;
      ${state}
      ${functions}
      return {
        rebuild, prepareScript,
        configure(values, pose = 'default', mode = 'simple') {
          parameters = values; state = pose; geometryMode = mode;
          return rebuild(true);
        },
        get script() { return script; }
      };
    })();`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  );
  const flow = new Function('host', program.outputText + '\nreturn api;')(host);
  const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
  const initial = flow.rebuild(true);
  await turn();
  assert.deepEqual(
    pending.map((request) => request.parameters.length),
    [1],
  );
  assert.equal(host.copy.disabled, true);
  assert.equal(host.download.disabled, true);
  assert.equal(flow.prepareScript(), false);
  const obsolete = flow.configure({ length: 2 });
  const latest = flow.configure({ length: 3 }, 'print-layout', 'full');
  pending[0].resolve();
  await turn();
  assert.deepEqual(
    pending.map((request) => request.parameters.length),
    [1, 3],
  );
  assert.equal(builds.length, 0, 'Neither an uninitialized nor a superseded model is built.');
  assert.equal(modes.length, 0, 'Initialization runs outside the synchronous geometry mode.');
  pending[1].resolve();
  await Promise.all([initial, obsolete, latest]);
  assert.deepEqual(builds, [{ length: 3, state: 'print-layout' }]);
  assert.deepEqual(modes, ['full']);
  assert.equal(host.copy.disabled, false);
  assert.equal(host.download.disabled, false);
  assert.equal(flow.prepareScript(), true);
  assert.deepEqual(JSON.parse(flow.script), { length: 3, pose: 'print-layout', mode: 'full' });
  const failed = flow.configure({ length: 4 });
  await turn();
  pending[2].reject(new Error('Geometry initialization failed.'));
  await failed;
  assert.match(host.status.textContent, /Geometry initialization failed/);
  assert.equal(host.copy.disabled, true);
  assert.equal(flow.prepareScript(), false);
  const retry = flow.configure({ length: 5 });
  await turn();
  pending[3].resolve();
  await retry;
  assert.deepEqual(
    builds.map((build) => build.length),
    [3, 5],
  );
  assert.equal(host.copy.disabled, false);
  assert.equal(flow.prepareScript(), true);
});

test('workbench model switching reconciles conditional states and refreshes their options', async () => {
  const ts = (await import('typescript')).default;
  const { default: part } = await import('../src/parts/pwm-switch/part');
  const main = workbenchFiles(part.id)['src/main.ts'];
  const source = ts.createSourceFile('main.ts', main, ts.ScriptTarget.Latest, true);
  const renderFields = source.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'renderFields',
  )!;
  const program = ts.transpileModule(
    `
    let parameters = { ...part.defaults }, state = 'exploded', presetSelect;
    const stateSelect = {
      options: [], value: '',
      replaceChildren() { this.options = []; },
      append(option) { this.options.push(option); }
    };
    ${renderFields.getText(source)}
    const api = {
      render() { renderFields(); return { state, options: stateSelect.options }; },
      configure(values, requested = state) { parameters = values; state = requested; return this.render(); }
    };
  `,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  );
  const element = () => ({ append() {}, replaceChildren() {}, addEventListener() {} });
  const document = { querySelector: element, createElement: element };
  const Option = class {
    constructor(
      public label: string,
      public value: string,
    ) {}
  };
  const api = new Function(
    'part',
    'availableModelState',
    'document',
    'Option',
    program.outputText + '\nreturn api;',
  )(part, availableModelState, document, Option);
  assert.deepEqual(api.render(), {
    state: 'exploded',
    options: [new Option('Assembled', 'assembled'), new Option('Exploded', 'exploded')],
  });
  assert.deepEqual(api.configure({ model: 'user-mosfet-26x16' }), {
    state: 'assembled',
    options: [new Option('Assembled', 'assembled')],
  });
  assert.equal(api.configure(part.defaults).state, 'assembled');
  assert.equal(api.configure(part.defaults, 'exploded').state, 'exploded');
});

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
  for (const dependencies of ['undefined', 'unresolvedDependencies', 'null']) {
    await fs.writeFile(
      index,
      original.replace('apiVersion: 2', `apiVersion: 2, dependencies: ${dependencies}`),
    );
    await assert.rejects(inspectPackage(folder, root), /Dependencies must be a literal array/);
  }
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
  await fs.writeFile(
    path.join(folder, 'presets.json'),
    JSON.stringify([{ ...presets[0], parameters: [] }]),
  );
  await assert.rejects(inspectPackage(folder, root), /parameters object/);
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

test('package discovery inspects shared dependency trees once and revalidates later changes', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [id, order] of [
    ['branch-a', 30],
    ['branch-b', 40],
    ['shared-leaf', 50],
  ] as const)
    await addStarter(root, id, order);
  for (const [id, dependencies] of [
    ['first-spacer', ['branch-a', 'branch-b']],
    ['branch-a', ['shared-leaf']],
    ['branch-b', ['shared-leaf']],
  ] as const) {
    const file = path.join(root, 'src/parts', id, 'index.ts');
    await fs.writeFile(
      file,
      (await fs.readFile(file, 'utf8')).replace(
        'apiVersion: 2',
        `apiVersion: 2, dependencies: ${JSON.stringify(dependencies)}`,
      ),
    );
  }
  const visits = new Map<string, number>();
  const readDirectory = fs.readdir;
  const observed = context.mock.method(fs, 'readdir', (async (
    ...args: Parameters<typeof fs.readdir>
  ) => {
    const file = String(args[0]);
    visits.set(file, (visits.get(file) ?? 0) + 1);
    return readDirectory(...args);
  }) as typeof fs.readdir);
  assert.equal((await discoverPackages(root)).length, 4);
  for (const id of ['first-spacer', 'branch-a', 'branch-b', 'shared-leaf'])
    assert.equal(visits.get(path.join(root, 'src/parts', id)), 1, id);
  observed.mock.restore();
  await fs.writeFile(path.join(root, 'src/parts/shared-leaf/presets.json'), '{invalid');
  await assert.rejects(discoverPackages(root), /Invalid JSON/);
});

test('static preflight reserves unambiguous preset IDs without renaming supplier IDs', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, 'src/parts/first-spacer');
  const file = path.join(folder, 'presets.json');
  const preset = { name: 'Supplier execution', parameters: { length: 5 } };
  for (const id of [
    undefined,
    null,
    12,
    '',
    ' ',
    ' model',
    'model ',
    'model:execution',
    'model\nexecution',
    'model\u0085execution',
    'custom',
  ]) {
    await fs.writeFile(file, JSON.stringify([{ ...preset, id }]));
    await assert.rejects(inspectPackage(folder, root), /unique id/, String(id));
  }
  const id = 'SFK602 / SFK0602 · unverified listing';
  await fs.writeFile(file, JSON.stringify([{ ...preset, id }]));
  assert.equal((await inspectPackage(folder, root)).id, 'first-spacer');
  const other = await addStarter(root, 'other-spacer', 30);
  await fs.writeFile(path.join(other, 'presets.json'), JSON.stringify([{ ...preset, id }]));
  assert.equal(
    (await discoverPackages(root)).length,
    2,
    'Local preset IDs are scoped to their package.',
  );
});

test('starter creates an isolated configurator and never overwrites an existing package', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = await createPackage(root, 'camera-mount', 'Camera Mount');
  assert.equal((await inspectPackage(folder, root)).id, 'camera-mount');
  assert.match(await fs.readFile(path.join(folder, 'part.ts'), 'utf8'), /Camera Mount/);
  const existingPackage = (
    await fs.readdir(path.join(repository, 'src/parts'), { withFileTypes: true })
  ).find((entry) => entry.isDirectory())!;
  assert.equal(
    await fs.readFile(path.join(folder, 'README.md'), 'utf8'),
    await fs.readFile(
      path.join(repository, 'src/parts', existingPackage.name, 'README.md'),
      'utf8',
    ),
    'New packages must retain the same universal README as existing packages.',
  );
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
  const externalEvidence = "\nconst evidence = 'https://supplier.example/drawing.pdf';\n";
  await fs.writeFile(partPath, original + externalEvidence);
  const handoff = await exportPackage(root, 'first-spacer', path.join(root, 'handoff'));
  assert.match(await fs.readFile(path.join(handoff, 'src/main.ts'), 'utf8'), /generateScript/);
  await assert.rejects(fs.access(path.join(handoff, 'public/references')), { code: 'ENOENT' });
  const manifest = JSON.parse(await fs.readFile(path.join(handoff, 'part-module.json'), 'utf8'));
  assert.equal(manifest.references, undefined);
  const editedPart = path.join(handoff, 'src/parts/first-spacer/part.ts');
  assert.equal(await fs.readFile(editedPart, 'utf8'), original + externalEvidence);
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
  assert.equal(
    path.relative(root, result.backup!).split(path.sep).slice(0, 4).join('/'),
    'test-results/backups/part-modules/first-spacer',
  );
  assert.deepEqual(await fs.readdir(path.join(root, 'test-results/.staging')), []);
  const imported = await fs.readFile(partPath, 'utf8');
  assert.match(imported, /Static import must never execute/);
  assert.ok(imported.includes(externalEvidence));
  assert.equal(
    await fs.readFile(path.join(result.backup!, 'part.ts'), 'utf8'),
    original + externalEvidence,
  );
  assert.equal(await fs.readFile(path.join(other, 'part.ts'), 'utf8'), unrelatedBefore);
  assert.equal(await fs.readFile(path.join(root, 'src/core/geometry.ts'), 'utf8'), sdkBefore);
  assert.equal((await discoverPackages(root)).length, 2);
});

test('invalid imports, local reference paths and bundled media leave the current package intact', async (context) => {
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
  const importedPart = path.join(handoff, 'src/parts/first-spacer/part.ts');
  await fs.appendFile(importedPart, "\nconst evidence = 'references/local-drawing.png';\n");
  await assert.rejects(importPackage(root, handoff, true), /Local reference paths/);
  await fs.writeFile(importedPart, original);
  const presetPath = path.join(path.dirname(importedPart), 'presets.json');
  const originalPresets = await fs.readFile(presetPath, 'utf8');
  const presets = JSON.parse(originalPresets);
  presets[0].catalog = { sourceUrl: 'file:///tmp/drawing.png' };
  await fs.writeFile(presetPath, JSON.stringify(presets));
  await assert.rejects(importPackage(root, handoff, true), /source links must be external/);
  await fs.writeFile(presetPath, originalPresets);
  await fs.writeFile(path.join(path.dirname(importedPart), 'drawing.PDF'), 'attachment');
  await assert.rejects(importPackage(root, handoff, true), /keep reference attachments/);
  assert.equal(await fs.readFile(partPath, 'utf8'), original);
  await assert.rejects(fs.access(path.join(root, 'public/references')), { code: 'ENOENT' });
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
  for (const id of [
    undefined,
    null,
    12,
    '',
    ' ',
    ' model',
    'model ',
    'model:execution',
    'model\nexecution',
    'model\u0085execution',
    'custom',
  ]) {
    assert.throws(
      () =>
        registerPartModules([
          {
            ...module,
            part: {
              ...definition,
              presets: [{ id, name: 'Invalid ID', parameters: { length: 5 } }],
            },
          } as unknown as PartModule,
        ]),
      /Invalid preset ID/,
      String(id),
    );
  }
  const supplierPreset = {
    id: 'SFK602 / SFK0602 · unverified listing',
    name: 'Supplier execution',
    description: 'A supplier identity fixture with its original spelling.',
    parameters: { length: 5 },
  };
  const supplierModule = { ...module, part: { ...definition, presets: [supplierPreset] } };
  assert.equal(registerPartModules([supplierModule])[0].presets[0].id, supplierPreset.id);
  assert.throws(
    () =>
      registerPartModules([
        {
          ...supplierModule,
          part: { ...supplierModule.part, presets: [supplierPreset, supplierPreset] },
        },
      ]),
    /Duplicate preset ID/,
  );
  assert.equal(
    registerPartModules([
      supplierModule,
      { ...supplierModule, part: { ...supplierModule.part, id: 'other-test-part' } },
    ]).length,
    2,
    'The same local preset ID is valid in distinct physical packages.',
  );
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

test('batch checks resolve shared transitive dependencies and count only selected packages', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.symlink(path.join(repository, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const first = path.join(root, 'src/parts/first-spacer');
  const intermediate = await addStarter(root, 'intermediate-spacer', 30);
  await addStarter(root, 'leaf-spacer', 40);
  const sibling = await addStarter(root, 'other-spacer', 50);
  for (const [folder, dependency] of [
    [first, 'intermediate-spacer'],
    [intermediate, 'leaf-spacer'],
    [sibling, 'intermediate-spacer'],
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
  assert.deepEqual(await checkPackageDefinitions(root, ['first-spacer']), { parts: 1, presets: 1 });
  assert.deepEqual(await checkPackageDefinitions(root, ['first-spacer', 'other-spacer']), {
    parts: 2,
    presets: 2,
  });
  await assert.rejects(checkPackageDefinitions(root, ['first-spacer', 'first-spacer']), /Duplicate/);
});

test('package checks cover every available state per configuration and reject an empty state set', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.symlink(path.join(repository, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const state = (id: string, condition = 'true') =>
    `{ id: '${id}', label: '${id}', description: 'Fixture state.', availableWhen: (p) => ${condition} }`;
  async function configured(id: string, states: string[], validation = '') {
    const folder = await addStarter(root, id, 30);
    const file = path.join(folder, 'part.ts');
    await fs.writeFile(
      file,
      (await fs.readFile(file, 'utf8'))
        .replace(
          '  presets: presets as Preset[],',
          `  presets: presets as Preset[],\n  states: [${states.join(',')}],`,
        )
        .replace('  validate(p) {', `  validate(p, state) {\n    ${validation}`),
    );
    return folder;
  }
  const conditional = await configured(
    'conditional-states',
    [state('long', 'Number(p.length) > 20'), state('short', 'Number(p.length) <= 20')],
    "if (state !== (Number(p.length) > 20 ? 'long' : 'short')) return ['Unavailable fixture state.'];",
  );
  const presetFile = path.join(conditional, 'presets.json');
  const [preset] = JSON.parse(await fs.readFile(presetFile, 'utf8'));
  await fs.writeFile(
    presetFile,
    JSON.stringify([
      preset,
      {
        ...preset,
        id: 'long',
        parameters: { ...preset.parameters, length: 30 },
      },
    ]),
  );
  assert.deepEqual(await checkPackageDefinitions(root, ['conditional-states']), {
    parts: 1,
    presets: 2,
  });
  await configured(
    'invalid-inspection',
    [state('assembled'), state('exploded')],
    "if (state === 'exploded') return ['Broken inspection state.'];",
  );
  await assert.rejects(
    checkPackageDefinitions(root, ['invalid-inspection']),
    /invalid-inspection \/ defaults \/ exploded: Broken inspection state/,
  );
  await configured('unavailable-states', [state('long', 'Number(p.length) > 20')]);
  await assert.rejects(
    checkPackageDefinitions(root, ['unavailable-states']),
    /unavailable-states \/ defaults: a configuration must have an available model state/,
  );
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

test('an exported asynchronous geometry workbench bundles its pinned Manifold runtime and WASM', async (context) => {
  const root = await fixture();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const partPath = path.join(root, 'src/parts/first-spacer/part.ts');
  const source = await fs.readFile(partPath, 'utf8');
  await fs.writeFile(
    partPath,
    "import { initializeManifoldGeometry } from '../../core/assembly/manifold-boundary';\n" +
      source.replace(
        '  presets: presets as Preset[],',
        '  presets: presets as Preset[],\n  initializeGeometry: initializeManifoldGeometry,',
      ),
  );
  const handoff = await exportPackage(root, 'first-spacer', path.join(root, 'handoff'));
  const manifest = JSON.parse(await fs.readFile(path.join(handoff, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies['manifold-3d'], '3.5.4');
  assert.match(
    await fs.readFile(path.join(handoff, 'README.md'), 'utf8'),
    /initializeGeometry\(parameters, state\)/,
  );
  assert.deepEqual(
    await fs.readFile(path.join(handoff, 'src/core/assembly/manifold-boundary.ts')),
    await fs.readFile(path.join(repository, 'src/core/assembly/manifold-boundary.ts')),
  );
  await fs.symlink(path.join(repository, 'node_modules'), path.join(handoff, 'node_modules'));
  const built = spawnSync(
    process.execPath,
    [path.join(repository, 'node_modules/vite/bin/vite.js'), 'build'],
    { cwd: handoff, encoding: 'utf8' },
  );
  assert.equal(built.status, 0, built.stdout + built.stderr);
  const checked = spawnSync(
    process.execPath,
    [path.join(repository, 'node_modules/typescript/bin/tsc'), '--noEmit'],
    { cwd: handoff, encoding: 'utf8' },
  );
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  const assets = await fs.readdir(path.join(handoff, 'dist/assets'));
  assert.ok(
    assets.some((name) => /^manifold-.*\.wasm$/.test(name)),
    assets.join(', '),
  );
});
