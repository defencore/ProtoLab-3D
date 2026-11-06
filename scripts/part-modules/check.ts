import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerPartModules, type PartModule } from '../../src/core/part-modules';
import { validateParameters } from '../../src/core/validation';
import { discoverPackages, inspectPackageSelection, registrySource } from './library';

/** Explicit developer checks execute only after package-boundary preflight succeeds. */
export async function checkPackageDefinitions(root: string, ids?: readonly string[]) {
  const packages = ids ? await inspectPackageSelection(root, ids) : await discoverPackages(root);
  if (
    !ids &&
    (await readFile(path.join(root, 'src/parts/index.ts'), 'utf8')) !== registrySource(packages)
  )
    throw new Error('Part registry is stale. Run npm run parts:sync.');
  const selected = ids ? new Set(ids) : undefined;
  const modules: PartModule[] = [];
  for (const entry of packages) {
    const loaded = await import(pathToFileURL(path.join(entry.directory, 'index.ts')).href);
    if (loaded.default?.part?.id !== entry.id)
      throw new Error(`Runtime ID differs from the package ID: ${entry.id}.`);
    modules.push(loaded.default);
  }
  const parts = registerPartModules(modules).filter((part) => !selected || selected.has(part.id));
  let presets = 0;
  for (const part of parts) {
    const check = (parameters: typeof part.defaults, label: string) => {
      const states = part.states
        ?.filter((state) => !state.availableWhen || state.availableWhen(parameters))
        .map((state) => state.id) ?? ['default'];
      if (!states.length)
        throw new Error(
          `${part.id} / ${label}: a configuration must have an available model state.`,
        );
      for (const state of states) {
        const errors = validateParameters(part, parameters, state);
        if (errors.length) throw new Error(`${part.id} / ${label} / ${state}: ${errors.join(' ')}`);
      }
    };
    check(part.defaults, 'defaults');
    for (const preset of part.presets) {
      check(preset.parameters, preset.id);
      presets++;
    }
  }
  return { parts: parts.length, presets };
}
