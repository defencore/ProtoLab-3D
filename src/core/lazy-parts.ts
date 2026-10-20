import { registerPartModules, type PartModule } from './part-modules';

export type PartModuleImport = () => Promise<{ default: PartModule }>;

/** Workers load only requested products and their declared library dependencies. */
export function createPartLoader(imports: Readonly<Record<string, PartModuleImport>>) {
  const pending = new Map<string, Promise<PartModule>>();
  function load(id: string): Promise<PartModule> {
    const existing = pending.get(id);
    if (existing) return existing;
    if (!Object.hasOwn(imports, id))
      return Promise.reject(new Error(`Unknown library product: ${id}.`));
    const promise = Promise.resolve()
      .then(() => imports[id]())
      .then(({ default: module }) => {
        if (module?.part?.id !== id)
          throw new Error(`The loaded library product does not match ${id}.`);
        return module;
      })
      .catch((error: unknown) => {
        pending.delete(id);
        throw error;
      });
    pending.set(id, promise);
    return promise;
  }
  return async function loadParts(ids: readonly string[]) {
    const modules = new Map<string, PartModule>();
    async function visit(id: string, ancestors: readonly string[] = []): Promise<void> {
      if (ancestors.includes(id))
        throw new Error(`Cyclic part dependency: ${[...ancestors, id].join(' -> ')}`);
      if (modules.has(id)) return;
      const module = await load(id);
      if (module.dependencies !== undefined && !Array.isArray(module.dependencies))
        throw new Error(`Invalid dependencies in ${id}.`);
      await Promise.all(
        (module.dependencies ?? []).map((dependency) => visit(dependency, [...ancestors, id])),
      );
      modules.set(id, module);
    }
    await Promise.all([...new Set(ids)].map((id) => visit(id)));
    return registerPartModules([...modules.values()]);
  };
}
