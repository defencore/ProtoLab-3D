import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerPartModules, type PartModule } from '../../src/core/part-modules';
import { validateParameters } from '../../src/core/validation';
import { inspectPackage, type PackageInspection } from './library';

/** Explicit developer checks execute only after package-boundary preflight succeeds. */
export async function checkPackageDefinitions(packages: PackageInspection[]) {
  const modules: PartModule[] = [];
  const selected = new Set(packages.map((entry) => entry.id));
  const closure = new Map(packages.map((entry) => [entry.id, entry]));
  for (const entry of closure.values()) {
    for (const dependency of entry.dependencies) {
      if (closure.has(dependency)) continue;
      const root = path.dirname(path.dirname(path.dirname(entry.directory)));
      closure.set(dependency, await inspectPackage(path.join(root, 'src/parts', dependency), root));
    }
  }
  for (const entry of closure.values()) {
    const loaded = await import(pathToFileURL(path.join(entry.directory, 'index.ts')).href);
    if (loaded.default?.part?.id !== entry.id)
      throw new Error(`Runtime ID differs from the package ID: ${entry.id}.`);
    modules.push(loaded.default);
  }
  const parts = registerPartModules(modules).filter((part) => selected.has(part.id));
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
