import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PART_ID_PATTERN, PART_MODULE_API_VERSION } from '../../src/core/part-modules';
import {
  assertNewDestination,
  copyPackage,
  discoverPackages,
  inspectPackage,
  SDK_FILES,
  syncRegistry,
} from './library';
import { starterFiles, workbenchFiles } from './templates';

async function writeFiles(root: string, files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
}

export async function createPackage(projectRoot: string, id: string, name?: string) {
  if (!PART_ID_PATTERN.test(id))
    throw new Error('Use a lowercase, hyphen-separated part ID, such as camera-spacer.');
  const destination = path.join(projectRoot, 'src/parts', id);
  await assertNewDestination(destination);
  const packages = await discoverPackages(projectRoot);
  const order = Math.max(...packages.map((module) => module.order), 0) + 10;
  const title =
    name ??
    id
      .split('-')
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  await writeFiles(destination, starterFiles(id, title, order));
  await inspectPackage(destination, projectRoot);
  await syncRegistry(projectRoot);
  return destination;
}

export async function exportPackage(projectRoot: string, id: string, destination: string) {
  if (!PART_ID_PATTERN.test(id)) throw new Error('Invalid part ID.');
  destination = path.resolve(destination);
  const partDirectory = path.join(path.resolve(projectRoot), 'src/parts');
  if (destination === partDirectory || destination.startsWith(`${partDirectory}${path.sep}`))
    throw new Error(
      'Export the handoff outside src/parts to keep workbench files out of the part registry.',
    );
  await assertNewDestination(destination);
  const module = await inspectPackage(path.join(projectRoot, 'src/parts', id), projectRoot);
  const sourceDependencies = JSON.parse(
    await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  );
  const dependencies = Object.fromEntries(
    ['three', '@jscad/modeling'].map((name) => [name, sourceDependencies.dependencies[name]]),
  );
  const devDependencies = Object.fromEntries(
    ['@types/three', 'typescript', 'vite'].map((name) => [
      name,
      sourceDependencies.devDependencies[name],
    ]),
  );
  for (const reference of module.references) {
    const source = path.join(projectRoot, 'public', reference);
    if (!(await fs.lstat(source)).isFile())
      throw new Error(`Reference must be an ordinary file: ${reference}.`);
  }
  try {
    await copyPackage(module, path.join(destination, 'src/parts', id));
    for (const name of [...SDK_FILES, 'freecad.ts', 'validation.ts', 'catalog-models.ts']) {
      await fs.mkdir(path.join(destination, 'src/core'), { recursive: true });
      await fs.copyFile(
        path.join(projectRoot, 'src/core', name),
        path.join(destination, 'src/core', name),
      );
    }
    for (const reference of module.references) {
      const target = path.join(destination, 'public', reference);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(projectRoot, 'public', reference), target);
    }
    await writeFiles(destination, {
      ...workbenchFiles(id),
      'package.json':
        JSON.stringify(
          {
            name: `protolab-part-${id}`,
            private: true,
            version: '1.0.0',
            type: 'module',
            scripts: {
              dev: 'vite --host 127.0.0.1',
              build: 'tsc --noEmit && vite build',
              typecheck: 'tsc --noEmit',
            },
            dependencies,
            devDependencies,
          },
          null,
          2,
        ) + '\n',
      'part-module.json':
        JSON.stringify(
          {
            format: 'protolab-part-handoff',
            apiVersion: PART_MODULE_API_VERSION,
            id,
            packageDirectory: `src/parts/${id}`,
            references: module.references,
          },
          null,
          2,
        ) + '\n',
      '.gitignore': 'node_modules/\ndist/\n',
      'README.md': `# ${id} — isolated ProtoLab part\n\n## Run the workbench\n\n1. Run \`npm install\`.\n2. Run \`npm run dev\` and open the printed local URL.\n3. Edit \`src/parts/${id}/\`. The browser reloads as the module changes.\n4. Run \`npm run build\` before returning the package.\n\nThe workbench shows the configurator, presets, states, Three.js preview and generated FreeCAD macro. The same part code is used by the main application.\n\n## Editing boundary\n\nReturn the complete folder with \`part-module.json\` intact. Keep all part-specific code in \`src/parts/${id}/\`: \`part.ts\` defines geometry/export/validation and the numeric or conditional parameter schema, directly or through a private factory in \`lib/\`. \`configurator.ts\` declares ordered catalog-selection controls; newly scaffolded parts also keep their fields and defaults there. \`presets.json\` stores complete presets, and \`lib/\` contains private helpers. \`index.ts\` declares the stable ID and API version.\n\nThe SDK in \`src/core/\` is supplied for running this workbench. SDK edits are not imported back into ProtoLab. A part may import only package-local files, the documented geometry/type SDK, Three.js, and JSCAD. Copy any new domain helpers into the part's \`lib/\` folder. Keep the existing ID for an update.\n\nLocal source illustrations are included in \`public/references/\`. Existing shared reference files are not overwritten on import; use a new unique filename for an edited illustration.\n\n## Return to ProtoLab\n\nFrom the main ProtoLab project, run:\n\n\`\`\`sh\nnpm run parts:import -- /path/to/this-handoff --replace\nnpm run typecheck\nnpm run build\n\`\`\`\n\nImport validates the package statically before replacing only \`src/parts/${id}/\`, and saves its previous version outside the part registry under \`.part-module-backups/\`. Omit \`--replace\` when importing a new ID. No manual registration is needed.\n\nFreeCAD geometry must remain consistent with the preview and dimension function. Compound children become independent assembly components; provide matching \`component_labels\` and optional \`component_colors\`.\n`,
    });
    await inspectPackage(path.join(destination, 'src/parts', id), destination);
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

export async function importPackage(projectRoot: string, source: string, replace = false) {
  source = path.resolve(source);
  const manifestPath = path.join(source, 'part-module.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (
    manifest.format !== 'protolab-part-handoff' ||
    manifest.apiVersion !== PART_MODULE_API_VERSION ||
    typeof manifest.id !== 'string' ||
    !PART_ID_PATTERN.test(manifest.id)
  )
    throw new Error('Unsupported or invalid part handoff manifest.');
  if (manifest.packageDirectory !== `src/parts/${manifest.id}`)
    throw new Error('Unexpected handoff package directory.');
  const module = await inspectPackage(path.join(source, manifest.packageDirectory), source);
  if (module.id !== manifest.id) throw new Error('The manifest ID does not match the part ID.');
  const destination = path.join(projectRoot, 'src/parts', module.id);
  let current = false;
  try {
    current = (await fs.lstat(destination)).isDirectory();
  } catch {
    /* A new part has no previous package. */
  }
  if (current && !replace)
    throw new Error(
      `Part ${module.id} already exists. Pass --replace to replace only this package and keep a backup.`,
    );
  if (!current) await assertNewDestination(destination);
  const additions: { source: string; target: string }[] = [];
  for (const reference of module.references) {
    const file = path.join(source, 'public', reference);
    if (!(await fs.lstat(file)).isFile())
      throw new Error(`Reference must be an ordinary file: ${reference}.`);
    const target = path.join(projectRoot, 'public', reference);
    try {
      const currentFile = await fs.lstat(target);
      if (!currentFile.isFile() || !(await fs.readFile(file)).equals(await fs.readFile(target)))
        throw new Error(
          `Reference ${reference} already exists with different contents. Give the edited reference a unique filename.`,
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      additions.push({ source: file, target });
    }
  }
  const stagingRoot = await fs.mkdtemp(path.join(projectRoot, '.part-module-staging-'));
  const staging = path.join(stagingRoot, module.id);
  let backup: string | undefined;
  const addedReferences: string[] = [];
  let installed = false;
  try {
    await copyPackage(module, staging);
    if (current) {
      const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
      backup = path.join(projectRoot, '.part-module-backups', module.id, stamp);
      await fs.mkdir(path.dirname(backup), { recursive: true });
      await fs.rename(destination, backup);
    }
    await fs.rename(staging, destination);
    installed = true;
    for (const addition of additions) {
      await fs.mkdir(path.dirname(addition.target), { recursive: true });
      await fs.copyFile(addition.source, addition.target);
      addedReferences.push(addition.target);
    }
    await syncRegistry(projectRoot);
  } catch (error) {
    if (installed) await fs.rm(destination, { recursive: true, force: true });
    if (backup) await fs.rename(backup, destination);
    for (const reference of addedReferences) await fs.rm(reference, { force: true });
    throw error;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
  return { id: module.id, destination, backup };
}
