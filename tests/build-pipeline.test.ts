import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { OutputAsset, OutputBundle, OutputChunk, RollupOutput } from 'rollup';
import { build, type ResolvedConfig } from 'vite';
import { bundleReportPlugin, createBundleReport } from '../scripts/build/bundle-report';
import { isNativeCadData, nativeCadDataPlugin } from '../scripts/build/native-cad-data';

test('CAD asset policy covers the actual native formats and excludes catalog/configuration JSON', () => {
  for (const file of [
    'parts/rover-chassis/lib/native/ugv-rover.json',
    'parts/panel-switch/lib/native/asw-07d.json',
    'parts/srs-retainer/lib/native.json',
    'parts/faulhaber-bx4/lib/native-2232.json',
    'parts/raspberry-pi/lib/pi5/native.json',
    'parts/nrf52840/lib/feather/native.json',
    'parts/multicopter-frame/lib/cutting-native.json',
    'parts/multicopter-frame-component/lib/source.json',
    'parts/multicopter-frame-component/lib/additional.json',
    'parts/multicopter-frame-component/lib/multirotors.json',
    'parts/bevel-gearbox-42/lib/housing.json',
    'core/assembly/recovery/hat-native.json',
    'core/assembly/recovery/st3215-native.json',
  ])
    assert.equal(isNativeCadData(file), true, file);
  for (const file of [
    'parts/rover-chassis/presets.json',
    'parts/panel-switch/product.json',
    'parts/raspberry-pi/lib/models.json',
    'parts/multicopter-frame-component/lib/fabrication.json',
    'parts/multicopter-frame-component/lib/source-v-fit-checks.json',
    'parts/tbi-ball-screw/lib/source-evidence.json',
    'catalog/data/native.json',
    '../outside/native.json',
  ])
    assert.equal(isNativeCadData(file), false, file);
});

test('native modules preserve data, track changes, deduplicate emission and reset between builds', async (context) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-cad-assets-')));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'src/parts/example/lib/native.json');
  const importer = path.join(root, 'src/parts/example/lib/model.ts');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const values = {
    brep: 'quoted "value"\nline \\  ',
    positions: [0, 1.25, -2],
    metadata: { exact: true },
  };
  await fs.writeFile(file, '\uFEFF' + JSON.stringify(values));
  const plugin = nativeCadDataPlugin();
  const configure = plugin.configResolved as (config: ResolvedConfig) => void;
  configure({ root, base: '/workbench/', build: { assetsDir: 'assets' } } as ResolvedConfig);
  const start = plugin.buildStart as () => void;
  const resolve = plugin.resolveId as (
    source: string,
    importer?: string,
  ) => string | { id: string; external: boolean } | undefined;
  const load = plugin.load as (
    this: { addWatchFile(file: string): void; emitFile(asset: unknown): void },
    id: string,
  ) => string | undefined;
  const watched: string[] = [];
  const assets: { fileName: string; source: string }[] = [];
  const pluginContext = {
    addWatchFile: (value: string) => watched.push(value),
    emitFile: (asset: unknown) => assets.push(asset as (typeof assets)[number]),
  };
  start();
  const id = resolve('./native.json', importer);
  assert.equal(typeof id, 'string');
  const source = load.call(pluginContext, id as string)!;
  assert.match(source, /^export \{ default \} from "\/workbench\/assets\/native-/);
  assert.deepEqual(watched, [file]);
  assert.equal(assets.length, 1);
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(assets[0].source).toString('base64')}`
  );
  assert.deepEqual(module.default, values);
  const url = JSON.parse(source.match(/from (".*");$/)![1]) as string;
  assert.deepEqual(resolve(url), { id: url, external: true });
  load.call(pluginContext, id as string);
  assert.equal(assets.length, 1);
  assert.equal(resolve('./models.json', importer), undefined);
  assert.equal(load.call(pluginContext, 'unrelated-module'), undefined);
  const firstName = assets[0].fileName;
  await fs.writeFile(file, JSON.stringify({ ...values, positions: [4, 5, 6] }));
  start();
  assert.equal(resolve(url), undefined);
  load.call(pluginContext, id as string);
  assert.equal(assets.length, 2);
  assert.notEqual(assets[1].fileName, firstName);
  start();
  load.call(pluginContext, id as string);
  assert.equal(assets.length, 3, 'A new build must re-emit unchanged assets.');
  assert.equal(assets[1].fileName, assets[2].fileName);
});

test('Vite emits nested CAD and source mesh payloads separately while retaining normal JSON', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-cad-vite-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = [
    'src/parts/example/lib/native/body.json',
    'src/parts/example/lib/native.json',
    'src/parts/example/lib/nested/native.json',
    'src/core/assembly/recovery/hat-native.json',
    'src/parts/multicopter-frame-component/lib/source.json',
  ];
  for (const [index, file] of files.entries()) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), JSON.stringify({ brep: `retained-cad-${index}` }));
  }
  await fs.writeFile(
    path.join(root, 'catalog.json'),
    JSON.stringify({ title: 'catalog-remains-inline' }),
  );
  await fs.writeFile(
    path.join(root, 'entry.ts'),
    [
      ...files.map((file, index) => `import cad${index} from './${file}';`),
      "import catalog from './catalog.json';",
      `console.log(catalog, ${files.map((_, index) => `cad${index}`).join(', ')});`,
    ].join('\n'),
  );
  const result = (await build({
    configFile: false,
    root,
    base: '/fixture/',
    logLevel: 'silent',
    plugins: [nativeCadDataPlugin()],
    build: { write: false, minify: false, rollupOptions: { input: path.join(root, 'entry.ts') } },
  })) as RollupOutput;
  const assets = result.output.filter((output): output is OutputAsset => output.type === 'asset');
  const entry = result.output.find(
    (output): output is OutputChunk => output.type === 'chunk' && output.isEntry,
  )!;
  assert.equal(assets.length, files.length);
  assert.equal(new Set(assets.map((asset) => asset.fileName)).size, files.length);
  assert.equal(entry.imports.length, files.length);
  assert.match(entry.code, /catalog-remains-inline/);
  assert.doesNotMatch(entry.code, /retained-cad-/);
  for (const asset of assets) {
    assert.ok(entry.imports.includes('/fixture/' + asset.fileName));
    assert.match(String(asset.source), /retained-cad-/);
  }
});

test('malformed native JSON fails the build before an invalid runtime asset is emitted', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-cad-invalid-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'src/parts/example/lib');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'native.json'), '{"brep":');
  await fs.writeFile(
    path.join(root, 'entry.ts'),
    "import cad from './src/parts/example/lib/native.json'; console.log(cad);",
  );
  await assert.rejects(
    build({
      configFile: false,
      root,
      logLevel: 'silent',
      plugins: [nativeCadDataPlugin()],
      build: { write: false, rollupOptions: { input: path.join(root, 'entry.ts') } },
    }),
    /Invalid native CAD JSON.*native\.json/,
  );
});

test('relative-base application and worker chunks resolve CAD assets from nested output directories', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-cad-relative-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const id of ['startup', 'worker-only']) {
    const directory = path.join(root, `src/parts/${id}/lib`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'native.json'), JSON.stringify({ brep: id }));
  }
  await fs.writeFile(
    path.join(root, 'src/App.ts'),
    "import cad from './parts/startup/lib/native.json'; export default cad;",
  );
  await fs.writeFile(
    path.join(root, 'src/worker.ts'),
    "import cad from './parts/worker-only/lib/native.json'; self.onmessage = () => self.postMessage(cad);",
  );
  await fs.writeFile(
    path.join(root, 'src/main.ts'),
    "void import('./App').then(console.log); window.startWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });",
  );
  for (const base of ['./', '']) {
    const result = (await build({
      configFile: false,
      root,
      base,
      logLevel: 'silent',
      plugins: [nativeCadDataPlugin(), bundleReportPlugin({ startupModules: ['src/App.ts'] })],
      worker: {
        format: 'es',
        plugins: () => [nativeCadDataPlugin()],
        rollupOptions: { output: { entryFileNames: 'assets/workers/nested/[name]-[hash].js' } },
      },
      build: {
        write: false,
        minify: false,
        sourcemap: true,
        rollupOptions: {
          input: path.join(root, 'src/main.ts'),
          output: {
            entryFileNames: 'assets/entries/[name]-[hash].js',
            chunkFileNames: 'assets/views/nested/[name]-[hash].js',
          },
        },
      },
    })) as RollupOutput;
    const mount = new URL('https://example.test/tools/viewer/');
    const nativeAssets = result.output.filter(
      (output) => output.type === 'asset' && /\/native-.*\.js$/.test(output.fileName),
    );
    assert.equal(nativeAssets.length, 2);
    const checkedFiles: string[] = [];
    for (const output of result.output) {
      if (!output.fileName.endsWith('.js') || nativeAssets.includes(output)) continue;
      const code = output.type === 'chunk' ? output.code : String(output.source);
      const imports = [...code.matchAll(/(?:from\s*|import\s*)(["'])([^"']*native-[^"']+)\1/g)];
      for (const match of imports) {
        const reference = match[2];
        assert.match(reference, /^\.\.?\//, output.fileName);
        const asset = nativeAssets.find(
          (candidate) => path.posix.basename(candidate.fileName) === path.posix.basename(reference),
        );
        assert.ok(asset, reference);
        const actual = new URL(reference, new URL(output.fileName, mount));
        const expected = new URL(asset.fileName, mount);
        assert.equal(
          actual.href,
          expected.href,
          `${base}: ${output.fileName} imports ${reference}`,
        );
        if (output.type === 'chunk') {
          assert.ok(output.imports.includes(reference));
          assert.ok(output.map?.mappings.length);
        }
        checkedFiles.push(output.fileName);
      }
    }
    assert.ok(
      checkedFiles.some((file) => file.includes('/views/')),
      'The app imports CAD.',
    );
    assert.ok(
      checkedFiles.some((file) => file.includes('/workers/')),
      'The worker imports CAD.',
    );
    const reportAsset = result.output.find(
      (output): output is OutputAsset =>
        output.type === 'asset' && output.fileName === 'bundle-report.json',
    )!;
    const report = JSON.parse(String(reportAsset.source)) as ReturnType<typeof createBundleReport>;
    assert.deepEqual(report.startupDependencies.unresolvedImports, []);
    assert.equal(
      report.startupDependencies.files.filter((file) => file.kind === 'native-cad-module').length,
      1,
    );
    assert.ok(
      !report.startupDependencies.files.some((file) => file.fileName.includes('worker-only')),
    );
  }
});

test('production report includes worker assets in total output and excludes them from startup dependencies', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-bundle-report-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const id of ['startup', 'worker-only']) {
    const directory = path.join(root, `src/parts/${id}/lib`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'native.json'), JSON.stringify({ brep: id }));
  }
  await fs.writeFile(
    path.join(root, 'src/App.ts'),
    "import cad from './parts/startup/lib/native.json'; export default cad;",
  );
  await fs.writeFile(
    path.join(root, 'src/worker.ts'),
    "import cad from './parts/worker-only/lib/native.json'; self.onmessage = () => self.postMessage(cad);",
  );
  await fs.writeFile(
    path.join(root, 'src/main.ts'),
    "void import('./App').then(console.log); window.startWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });",
  );
  const result = (await build({
    configFile: false,
    root,
    base: '/fixture/',
    logLevel: 'silent',
    plugins: [nativeCadDataPlugin(), bundleReportPlugin({ startupModules: ['src/App.ts'] })],
    worker: { format: 'es', plugins: () => [nativeCadDataPlugin()] },
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: path.join(root, 'src/main.ts') },
    },
  })) as RollupOutput;
  const reportAsset = result.output.find(
    (output): output is OutputAsset =>
      output.type === 'asset' && output.fileName === 'bundle-report.json',
  )!;
  const report = JSON.parse(String(reportAsset.source)) as ReturnType<typeof createBundleReport>;
  assert.deepEqual(report.startupDependencies.unresolvedImports, []);
  assert.ok(
    report.startupDependencies.files.some((file) => file.fileName.includes('native-parts-startup')),
  );
  assert.ok(!report.startupDependencies.files.some((file) => file.fileName.includes('worker')));
  assert.ok(
    report.allJavaScript.largestFiles.some((file) =>
      file.fileName.includes('native-parts-worker-only'),
    ),
  );
  const actualJavaScript = result.output.filter(
    (output) => output.type === 'chunk' || output.fileName.endsWith('.js'),
  );
  assert.equal(report.allJavaScript.fileCount, actualJavaScript.length);
  assert.equal(
    report.allJavaScript.bytes,
    actualJavaScript.reduce(
      (total, output) =>
        total +
        (output.type === 'chunk'
          ? Buffer.byteLength(output.code)
          : Buffer.byteLength(output.source)),
      0,
    ),
  );
});

function chunk(fileName: string, imports: string[], extra: Partial<OutputChunk> = {}): OutputChunk {
  return {
    type: 'chunk',
    fileName,
    code: `// ${fileName}\n`,
    imports,
    moduleIds: [],
    ...extra,
  } as OutputChunk;
}

test('bundle report counts static native dependencies once and includes the immediate App import', () => {
  const bundle: OutputBundle = {
    'assets/entry.js': chunk('assets/entry.js', ['assets/shared.js'], { isEntry: true }),
    'assets/App.js': chunk(
      'assets/App.js',
      ['assets/shared.js', '/viewer/assets/native-example.js'],
      { moduleIds: ['/repo/src/App.tsx'], dynamicImports: ['assets/future-product.js'] },
    ),
    'assets/shared.js': chunk('assets/shared.js', ['assets/cycle.js']),
    'assets/cycle.js': chunk('assets/cycle.js', ['assets/shared.js']),
    'assets/native-example.js': {
      type: 'asset',
      fileName: 'assets/native-example.js',
      source: 'export default { native: true };',
    } as OutputAsset,
    'assets/future-product.js': chunk('assets/future-product.js', []),
    'assets/worker.js': {
      type: 'asset',
      fileName: 'assets/worker.js',
      source: 'self.onmessage = () => {};',
    } as OutputAsset,
  };
  const report = createBundleReport(bundle, {
    base: '/viewer/',
    startupModuleIds: ['/repo/src/App.tsx'],
  });
  assert.deepEqual(report.entries, ['assets/entry.js']);
  assert.deepEqual(report.immediateDynamicImports, ['assets/App.js']);
  assert.equal(report.entryStaticDependencies.files.length, 3);
  assert.equal(report.startupDependencies.files.length, 5);
  assert.equal(
    report.startupDependencies.nativeCadBytes,
    Buffer.byteLength('export default { native: true };'),
  );
  assert.equal(
    report.startupDependencies.bytes,
    report.startupDependencies.chunkBytes + report.startupDependencies.nativeCadBytes,
  );
  assert.deepEqual(report.startupDependencies.unresolvedImports, []);
  assert.equal(report.allJavaScript.fileCount, 7);
  assert.ok(report.allJavaScript.bytes > report.startupDependencies.bytes);
  assert.ok(
    !report.startupDependencies.files.some((file) => /future-product|worker/.test(file.fileName)),
  );
  assert.throws(
    () => createBundleReport(bundle, { base: '/', startupModuleIds: ['/repo/missing.ts'] }),
    /Startup module is missing/,
  );
});

test('bundle report exposes unresolved externals and resolves relative native module paths', () => {
  const bundle: OutputBundle = {
    'assets/entry.js': chunk('assets/entry.js', ['./native-example.js', 'external-service'], {
      isEntry: true,
    }),
    'assets/native-example.js': {
      type: 'asset',
      fileName: 'assets/native-example.js',
      source: new Uint8Array([1, 2, 3]),
    } as OutputAsset,
  };
  const report = createBundleReport(bundle, { base: '/', startupModuleIds: [] });
  assert.equal(report.startupDependencies.files.length, 2);
  assert.equal(report.startupDependencies.nativeCadBytes, 3);
  assert.deepEqual(report.startupDependencies.unresolvedImports, ['external-service']);
});

test('relative-base report does not count an assets/assets path as a valid root asset', () => {
  const bundle: OutputBundle = {
    'assets/entry.js': chunk('assets/entry.js', ['./assets/native-example.js'], { isEntry: true }),
    'assets/native-example.js': {
      type: 'asset',
      fileName: 'assets/native-example.js',
      source: 'export default {};',
    } as OutputAsset,
  };
  const report = createBundleReport(bundle, { base: './', startupModuleIds: [] });
  assert.equal(report.startupDependencies.nativeCadBytes, 0);
  assert.deepEqual(report.startupDependencies.unresolvedImports, ['./assets/native-example.js']);
});
