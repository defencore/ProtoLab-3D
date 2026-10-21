import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTestPlan, isScopeOnlyContractChange } from '../scripts/ci/test-plan';

const execute = promisify(execFile);
const helper = fileURLToPath(new URL('../scripts/ci/test-plan.ts', import.meta.url));
const loader = fileURLToPath(new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url));

async function fixture(context: { after(callback: () => Promise<void>): void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'protolab-ci-plan-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await execute('git', ['init', '--quiet'], { cwd: root });
  const write = async (file: string, value: string) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), value);
  };
  const commit = async () => {
    await execute('git', ['add', '--all'], { cwd: root });
    await execute(
      'git',
      [
        '-c',
        'user.name=CI fixture',
        '-c',
        'user.email=ci@example.test',
        'commit',
        '--quiet',
        '--allow-empty',
        '-m',
        'fixture',
      ],
      { cwd: root },
    );
    return (await execute('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  };
  const part = async (id: string, dependencies: string[] = [], imports = '') => {
    await write(
      `src/parts/${id}/index.ts`,
      `import definition from './part'; export default {part: {...definition,id:'${id}'}, dependencies:${JSON.stringify(dependencies)}};`,
    );
    await write(`src/parts/${id}/part.ts`, `${imports}\nexport default {id:'${id}'};`);
    await write(`src/parts/${id}/presets.json`, '[]');
  };
  await part('bolt');
  await part('esp32');
  await part('servo-motor');
  await write(
    'src/parts/index.ts',
    "export {default as bolt} from './bolt'; export {default as esp32} from './esp32';",
  );
  await write('tests/bolt.test.ts', "import part from '../src/parts/bolt/part';");
  await write('tests/esp32.test.ts', "import part from '../src/parts/esp32/part';");
  await write('tests/electronics.test.ts', "import {parts} from '../src/parts';");
  await write('tests/servo-motors.test.ts', "import {parts} from '../src/parts';");
  await write('tests/catalog-data.test.ts', "import {parts} from '../src/parts';");
  for (let i = 1; i <= 8; i++)
    await write(`tests/parts-catalog-${i}.test.ts`, "import {parts} from '../src/parts';");
  await write('tests/ci-runner.test.ts', 'export {};');
  await write('tests/ci-test-plan.test.ts', 'export {};');
  await write('tests/test_promtehimport.py', '# importer');
  await write('tests/test_cache_promtehimport_web.py', '# cache');
  await write('tests/dremec-import.test.py', '# dremec');
  await write('tests/kosmodrom-import.test.py', '# kosmodrom');
  await write(
    'package.json',
    '{"type":"module","scripts":{"test":"old"},"devDependencies":{"typescript":"5.8.3"}}',
  );
  await write('tsconfig.json', '{"compilerOptions":{"strict":true,"tsBuildInfoFile":"old.cache"}}');
  await write(
    '.github/workflows/pages.yml',
    'steps:\n  - uses: actions/setup-node@v4\n    with:\n      node-version: 22\n',
  );
  const base = await commit();
  return {
    root,
    write,
    commit,
    part,
    base,
    plan: (options = {}) => createTestPlan({ root, base, ...options }),
  };
}

test('a changed package selects its own tests, registry families and all eight scoped contracts', async (context) => {
  const f = await fixture(context);
  await f.write('src/parts/esp32/presets.json', '[{"id":"new"}]');
  await f.commit();
  const plan = await f.plan();
  assert.equal(plan.mode, 'affected');
  assert.deepEqual(plan.affectedParts, ['esp32']);
  assert.deepEqual(plan.packageIds, ['esp32']);
  assert.ok(plan.tests.includes('tests/esp32.test.ts'));
  assert.ok(plan.tests.includes('tests/electronics.test.ts'));
  assert.ok(plan.tests.includes('tests/catalog-data.test.ts'));
  assert.equal(plan.tests.filter((file) => /parts-catalog-/.test(file)).length, 8);
  assert.ok(!plan.tests.includes('tests/bolt.test.ts'));
  assert.ok(!plan.tests.includes('tests/servo-motors.test.ts'));
});

test('reverse closure includes declared and actual import dependencies from both revisions', async (context) => {
  const f = await fixture(context);
  await f.part('declared-assembly', ['bolt']);
  await f.part('import-assembly', [], "import bolt from '../bolt/part';");
  await f.part('nested-assembly', ['declared-assembly']);
  const baseline = await f.commit();
  await f.part('declared-assembly', []); // Removed edges still belong to the successful baseline.
  await f.write('src/parts/bolt/part.ts', 'export default {changed: true};');
  await f.commit();
  const plan = await f.plan({ base: baseline });
  assert.deepEqual(plan.affectedParts, [
    'bolt',
    'declared-assembly',
    'import-assembly',
    'nested-assembly',
  ]);
});

test('renamed and deleted parts seed old dependencies but never enter the current-ID scope', async (context) => {
  const f = await fixture(context);
  await f.part('assembly', ['bolt']);
  const base = await f.commit();
  await rename(path.join(f.root, 'src/parts/bolt'), path.join(f.root, 'src/parts/screw'));
  await f.write('src/parts/screw/index.ts', "export default {part:{id:'screw'},dependencies:[]};");
  await f.write(
    'src/parts/assembly/index.ts',
    "export default {part:{id:'assembly'},dependencies:['screw']};",
  );
  await f.commit();
  const plan = await f.plan({ base });
  assert.deepEqual(plan.affectedParts, ['assembly', 'screw']);
  assert.ok(plan.changedFiles.includes('src/parts/bolt/part.ts'));
  assert.ok(plan.changedFiles.includes('src/parts/screw/part.ts'));
  await rm(path.join(f.root, 'src/parts/screw'), { recursive: true });
  await f.commit();
  const removed = await f.plan({ base });
  assert.deepEqual(removed.affectedParts, ['assembly']);
});

test('literal and template filesystem fixtures, source macros, helper imports and public references are edges', async (context) => {
  const f = await fixture(context);
  await f.write(
    'tests/helpers/fixture.ts',
    "import {readFileSync} from 'node:fs'; export const x=readFileSync(new URL('../fixtures/shape.json',import.meta.url),'utf8');",
  );
  await f.write('tests/fixtures/shape.json', '{}');
  await f.write('tests/fixture.test.ts', "import {x} from './helpers/fixture';");
  await f.write('docs/recovery/SelectedPartDrawing.FCMacro', 'old');
  await f.write(
    'tests/project-freecad.test.ts',
    "import {readFileSync} from 'node:fs'; readFileSync('docs/recovery/SelectedPartDrawing.FCMacro','utf8');",
  );
  await f.write(
    'tests/asset.test.ts',
    "import {readFileSync} from 'node:fs'; const id = process.env.ID; readFileSync(new URL(`../src/parts/esp32/lib/${id}.json`,import.meta.url));",
  );
  await f.write('src/parts/esp32/lib/native.json', '{}');
  await f.write('src/parts/esp32/product.json', '{"image":"/references/esp32.jpg"}');
  await f.write('public/references/esp32.jpg', 'old');
  const base = await f.commit();
  await f.write('tests/fixtures/shape.json', '{"x":1}');
  await f.write('docs/recovery/SelectedPartDrawing.FCMacro', 'changed');
  await f.write('src/parts/esp32/lib/native.json', '{"changed":true}');
  await f.write('public/references/esp32.jpg', 'changed');
  await f.commit();
  const plan = await f.plan({ base });
  for (const file of [
    'tests/fixture.test.ts',
    'tests/project-freecad.test.ts',
    'tests/asset.test.ts',
  ])
    assert.ok(plan.tests.includes(file), file);
  assert.deepEqual(plan.affectedParts, ['esp32']);
});

test('a changed generated registry does not traverse every family implementation', async (context) => {
  const f = await fixture(context);
  await f.write('src/parts/index.ts', "export {default as bolt} from './bolt'; // order only");
  await f.commit();
  const plan = await f.plan();
  assert.equal(plan.mode, 'affected');
  assert.deepEqual(plan.affectedParts, []);
  assert.ok(plan.tests.includes('tests/catalog-data.test.ts'));
  assert.ok(!plan.tests.includes('tests/electronics.test.ts'));
  assert.ok(!plan.tests.includes('tests/servo-motors.test.ts'));
});

test('scope-helper registry imports do not turn unrelated dedicated tests into global geometry', async (context) => {
  const f = await fixture(context);
  await f.write(
    'tests/helpers/part-scope.ts',
    "import {parts} from '../../src/parts'; export const affectedParts=(p:unknown[])=>p;",
  );
  await f.write(
    'tests/bolt.test.ts',
    "import {affectedParts} from './helpers/part-scope'; import part from '../src/parts/bolt/part';",
  );
  const base = await f.commit();
  await f.write('src/parts/esp32/part.ts', 'export default {changed:true};');
  await f.commit();
  assert.ok(!(await f.plan({ base })).tests.includes('tests/bolt.test.ts'));
});

test('caller-root filesystem utilities retain explicit package scope instead of matching every index', async (context) => {
  const f = await fixture(context);
  await f.part('rover-chassis');
  await f.write(
    'scripts/inspect.ts',
    "import {readFileSync} from 'node:fs'; import path from 'node:path'; export const inspect=(root:string)=>readFileSync(path.join(root,'index.ts'));",
  );
  await f.write(
    'tests/rover-chassis.test.ts',
    "import {inspect} from '../scripts/inspect'; import part from '../src/parts/rover-chassis/part';",
  );
  const base = await f.commit();
  await f.write('src/parts/esp32/part.ts', 'export default {changed:true};');
  await f.commit();
  assert.ok(!(await f.plan({ base })).tests.includes('tests/rover-chassis.test.ts'));
});

test('changed scoped tests and fixtures populate their owners instead of running with an empty filter', async (context) => {
  const f = await fixture(context);
  await f.write(
    'tests/electronics.test.ts',
    "import {parts} from '../src/parts'; // changed assertions",
  );
  await f.commit();
  assert.deepEqual((await f.plan()).affectedParts, ['esp32']);
  const base = await f.commit();
  await f.write(
    'tests/bolt.test.ts',
    "import part from '../src/parts/bolt/part'; // changed assertions",
  );
  await f.commit();
  assert.deepEqual((await f.plan({ base })).affectedParts, ['bolt']);
  const next = await f.commit();
  await f.write(
    'tests/parts-catalog-1.test.ts',
    "import {parts} from '../src/parts'; // changed generic contract",
  );
  await f.commit();
  assert.deepEqual((await f.plan({ base: next })).affectedParts, ['bolt', 'esp32', 'servo-motor']);
});

test('explicit family ownership bounds dynamic asset templates, while manifest ownership uses both revisions', async (context) => {
  const f = await fixture(context);
  await f.part('faulhaber-am');
  await f.write('src/parts/esp32/lib/models.json', '{}');
  await f.write('src/parts/faulhaber-am/lib/models.json', '{}');
  await f.write(
    'tests/faulhaber.test.ts',
    "import {readFileSync} from 'node:fs'; import {parts} from '../src/parts'; const family=process.env.ID; readFileSync(`src/parts/${family}/lib/models.json`);",
  );
  await f.write('data/library-expansion.json', '{"parts":[{"id":"esp32"}]}');
  await f.write(
    'tests/library-expansion.test.ts',
    "import {parts} from '../src/parts'; import manifest from '../data/library-expansion.json';",
  );
  const base = await f.commit();
  await f.write('src/parts/esp32/lib/models.json', '{"changed":true}');
  await f.write('data/library-expansion.json', '{"parts":[]}');
  await f.commit();
  const plan = await f.plan({ base });
  assert.ok(!plan.tests.includes('tests/faulhaber.test.ts'));
  assert.ok(plan.tests.includes('tests/library-expansion.test.ts'));
  await f.write('src/parts/faulhaber-am/lib/models.json', '{"changed":true}');
  await f.commit();
  assert.ok((await f.plan({ base })).tests.includes('tests/faulhaber.test.ts'));
});

test('operational CI/package/cache-path edits run CI regressions without unrelated geometry', async (context) => {
  const f = await fixture(context);
  await f.write('scripts/ci/test-plan.ts', 'export const updated = true;');
  await f.write(
    'package.json',
    '{"type":"module","scripts":{"test":"new","check:artifacts":"check"},"devDependencies":{"typescript":"5.8.3"}}',
  );
  await f.write(
    'tsconfig.json',
    '{"compilerOptions":{"strict":true,"tsBuildInfoFile":"test-results/cache"}}',
  );
  await f.write(
    '.github/workflows/pages.yml',
    'steps:\n  - uses: actions/setup-node@v4\n    with:\n      node-version: 22\n  - run: select affected tests\n',
  );
  await f.commit();
  const plan = await f.plan();
  assert.equal(plan.mode, 'affected');
  assert.deepEqual(plan.affectedParts, []);
  assert.deepEqual(plan.tests, ['tests/ci-runner.test.ts', 'tests/ci-test-plan.test.ts']);
});

test('the exact contract scope adapter is operational but changed assertions and shard expressions are not', async (context) => {
  const before = `import {parts} from '../../src/parts';
export function registerPartContractTests(shard:number) {
 assert.ok(shard>=0);
 for(const part of parts.filter((_,index)=>index%8===shard)) { assert.equal(part.id.length>0,true); }
}`;
  const after = `import {parts} from '../../src/parts'; import {affectedParts} from './part-scope';
export function registerPartContractTests(shard:number, definitions:readonly PartDefinition[]=parts) {
 assert.ok(shard>=0);
 const assigned=definitions.filter((_,index)=>index%8===shard);
 for(const part of affectedParts(assigned)) { assert.equal(part.id.length>0,true); }
}`;
  assert.equal(isScopeOnlyContractChange(before, after), true);
  assert.equal(isScopeOnlyContractChange(before, after.replace('index%8', 'index%7')), false);
  assert.equal(isScopeOnlyContractChange(before, after.replace('length>0', 'length>1')), false);
  const f = await fixture(context);
  await f.write('tests/helpers/part-contract.ts', before);
  await f.write(
    'tests/parts-catalog-1.test.ts',
    "import {registerPartContractTests} from './helpers/part-contract'; registerPartContractTests(0);",
  );
  await f.write('tests/part-scope.test.ts', 'export {};');
  const base = await f.commit();
  await f.write('tests/helpers/part-contract.ts', after);
  await f.commit();
  const selection = await f.plan({ base });
  assert.deepEqual(selection.affectedParts, []);
  assert.ok(selection.tests.includes('tests/part-scope.test.ts'));
  await f.write('tests/helpers/part-contract.ts', after.replace('length>0', 'length>1'));
  await f.commit();
  assert.deepEqual((await f.plan({ base })).affectedParts, ['bolt', 'esp32', 'servo-motor']);
});

test('shared core, compiler semantics, dependencies and Node runtime changes require a full run', async (context) => {
  for (const [file, text] of [
    ['src/core/runtime.ts', 'export const changed = true;'],
    ['tsconfig.json', '{"compilerOptions":{"strict":false}}'],
    ['package.json', '{"devDependencies":{"typescript":"99"}}'],
    ['package-lock.json', '{"changed":true}'],
    ['.github/workflows/pages.yml', 'node-version: 24\n'],
  ]) {
    const f = await fixture(context);
    await f.write(file, text);
    await f.commit();
    const plan = await f.plan();
    assert.equal(plan.mode, 'full', file);
    assert.deepEqual(plan.affectedParts, ['bolt', 'esp32', 'servo-motor']);
    assert.equal(plan.pythonTests.length, 4);
  }
});

test('CI platform/container changes invalidate inherited geometry while identical extra jobs remain operational', async (context) => {
  const f = await fixture(context);
  const job = `    runs-on: ubuntu-latest
    container:
      image: node:22-bookworm
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 22
`;
  const original = `jobs:\n  build:\n${job}`;
  await f.write('.github/workflows/pages.yml', original);
  const base = await f.commit();
  await f.write('.github/workflows/pages.yml', `${original}  plan:\n${job}`);
  await f.commit();
  const addedJob = await f.plan({ base });
  assert.equal(addedJob.mode, 'affected');
  assert.deepEqual(addedJob.affectedParts, []);
  for (const changed of [
    original.replace('ubuntu-latest', 'windows-latest'),
    original.replace('node:22-bookworm', 'node:22-alpine'),
    original.replace('ubuntu-latest', '[self-hosted, Linux, ARM64]'),
  ]) {
    await f.write('.github/workflows/pages.yml', changed);
    await f.commit();
    const plan = await f.plan({ base });
    assert.equal(plan.mode, 'full');
    assert.match(plan.reason, /runtime or platform/);
  }
});

test('missing baselines fail closed, and identical baselines run no tests', async (context) => {
  const f = await fixture(context);
  assert.equal((await createTestPlan({ root: f.root })).mode, 'full');
  assert.equal((await f.plan({ base: 'missing-successful-sha' })).mode, 'full');
  assert.equal((await f.plan({ full: true })).mode, 'full');
  const same = await f.plan();
  assert.deepEqual(same.tests, []);
  assert.deepEqual(same.changedFiles, []);
});

test('incomplete new packages fail closed and the plan ignores uncommitted working files', async (context) => {
  const f = await fixture(context);
  await f.write('src/parts/bolt/part.ts', 'export default {uncommitted:true};');
  assert.deepEqual((await f.plan()).changedFiles, []);
  await f.write('src/parts/missing-descriptor/part.ts', 'export default {};');
  await f.commit();
  assert.equal((await f.plan()).mode, 'full');
});

test('new/deleted tests and dynamically loaded Python importer helpers are selected explicitly', async (context) => {
  const f = await fixture(context);
  await f.write('tests/new.test.ts', 'export {};');
  await rm(path.join(f.root, 'tests/bolt.test.ts'));
  await f.write('scripts/cache-promtehimport-web.py', '# changed');
  await f.commit();
  const plan = await f.plan();
  assert.ok(plan.tests.includes('tests/new.test.ts'));
  assert.ok(!plan.tests.includes('tests/bolt.test.ts'));
  assert.deepEqual(plan.pythonTests, [
    'tests/test_cache_promtehimport_web.py',
    'tests/test_promtehimport.py',
  ]);
});

test('unmapped Python suites are selected for unknown changed fixtures but not purely operational edits', async (context) => {
  const f = await fixture(context);
  await f.write('tests/new-import.test.py', '# deliberately unmapped suite');
  await f.write('data/new-fixture.json', '{}');
  const base = await f.commit();
  await f.write('data/new-fixture.json', '{"changed":true}');
  let next = await f.commit();
  assert.deepEqual((await f.plan({ base })).pythonTests, ['tests/new-import.test.py']);
  await f.write('root-fixture.json', '{"changed":true}');
  await f.commit();
  assert.deepEqual((await f.plan({ base: next })).pythonTests, ['tests/new-import.test.py']);
  next = await f.commit();
  await f.write('scripts/ci/new-operation.mjs', 'export const operational=true;');
  await f.commit();
  assert.deepEqual((await f.plan({ base: next })).pythonTests, []);
});

test('unresolved dynamic inputs select conservatively instead of silently omitting a consumer', async (context) => {
  const f = await fixture(context);
  await f.write(
    'tests/unknown.test.ts',
    "import {readFileSync} from 'node:fs'; readFileSync(process.env.FIXTURE!);",
  );
  const base = await f.commit();
  await f.write('docs/arbitrary-fixture.json', '{}');
  await f.commit();
  const plan = await f.plan({ base });
  assert.ok(plan.tests.includes('tests/unknown.test.ts'));
});

test('CLI writes the selected immutable Git range and rejects unsupported arguments', async (context) => {
  const f = await fixture(context);
  await f.write('src/parts/bolt/part.ts', 'export default {changed: true};');
  await f.commit();
  const output = path.join(f.root, 'test-results/ci/plan.json');
  await execute(
    process.execPath,
    ['--import', loader, helper, '--base', f.base, '--head', 'HEAD', '--output', output],
    { cwd: f.root },
  );
  const plan = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(plan.affectedParts, ['bolt']);
  await assert.rejects(
    execute(process.execPath, ['--import', loader, helper, '--bad'], { cwd: f.root }),
    /Usage/,
  );
});
