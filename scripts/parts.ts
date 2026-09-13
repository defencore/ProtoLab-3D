import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  discoverPackages,
  inspectPackage,
  registrySource,
  syncRegistry,
} from './part-modules/library';
import { createPackage, exportPackage, importPackage } from './part-modules/operations';
import { checkPackageDefinitions } from './part-modules/check';
import { PART_ID_PATTERN } from '../src/core/part-modules';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);
const usage = `Part package tools:
  npm run parts:sync
  npm run parts:check -- [part-id]
  npm run parts:create -- part-id [--name "Display name"]
  npm run parts:export -- part-id /path/to/new-handoff
  npm run parts:import -- /path/to/handoff [--replace]`;

try {
  if (command === 'sync' && !args.length) {
    const packages = await syncRegistry(root);
    console.log(`Registered ${packages.length} independent part packages.`);
  } else if (command === 'check' && args.length <= 1) {
    if (args[0] && !PART_ID_PATTERN.test(args[0])) throw new Error('Invalid part ID.');
    const packages = args[0]
      ? [await inspectPackage(path.join(root, 'src/parts', args[0]), root)]
      : await discoverPackages(root);
    if (
      !args.length &&
      (await fs.readFile(path.join(root, 'src/parts/index.ts'), 'utf8')) !==
        registrySource(packages)
    )
      throw new Error('Part registry is stale. Run npm run parts:sync.');
    const result = await checkPackageDefinitions(packages);
    console.log(
      `Validated ${result.parts} part package${result.parts === 1 ? '' : 's'} and ${result.presets} presets: package boundaries, IDs, API, configurator and default/preset parameters.`,
    );
  } else if (
    command === 'create' &&
    (args.length === 1 || (args.length === 3 && args[1] === '--name'))
  ) {
    console.log(`Created ${await createPackage(root, args[0], args[2])}`);
  } else if (command === 'export' && args.length === 2) {
    console.log(`Exported isolated workbench: ${await exportPackage(root, args[0], args[1])}`);
  } else if (
    command === 'import' &&
    (args.length === 1 || (args.length === 2 && args[1] === '--replace'))
  ) {
    const result = await importPackage(root, args[0], args.includes('--replace'));
    console.log(`Imported ${result.id}. The part registry is up to date.`);
    if (result.backup) console.log(`Previous package saved at ${result.backup}`);
  } else throw new Error(usage);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
