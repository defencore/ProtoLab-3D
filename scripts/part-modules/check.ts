import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerPartModules, type PartModule } from '../../src/core/part-modules';
import { validateParameters } from '../../src/core/validation';
import type { PackageInspection } from './library';

/** Explicit developer checks execute only after package-boundary preflight succeeds. */
export async function checkPackageDefinitions(packages: PackageInspection[]) {
  const modules: PartModule[] = [];
  for (const entry of packages) {
    const loaded = await import(pathToFileURL(path.join(entry.directory, 'index.ts')).href);
    if (loaded.default?.part?.id !== entry.id)
      throw new Error(`Runtime ID differs from the package ID: ${entry.id}.`);
    modules.push(loaded.default);
  }
  const parts = registerPartModules(modules);
  let presets = 0;
  for (const part of parts) {
    const state = part.states?.[0]?.id ?? 'default';
    const check = (parameters: typeof part.defaults, label: string) => {
      const errors = validateParameters(part, parameters, state);
      if (errors.length) throw new Error(`${part.id} / ${label}: ${errors.join(' ')}`);
    };
    check(part.defaults, 'defaults');
    for (const preset of part.presets) {
      check(preset.parameters, preset.id);
      presets++;
    }
  }
  return { parts: parts.length, presets };
}
