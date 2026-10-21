import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withHardwarePresets } from '../src/catalog/hardware';
import { withSupplierPresets } from '../src/catalog/supplier-presets';
import { sourceBoltPresets, sourceSetScrewPresets } from '../src/catalog/fasteners';
import { specialFastenerPresets } from '../src/catalog/special-fastener-catalog';
import { handNutPresets } from '../src/catalog/hand-nuts';
import { dremecPresets } from '../src/catalog/dremec-presets';
import { kosmodromPresets } from '../src/catalog/kosmodrom-presets';
import { dremecSleevePresets } from '../src/catalog/dremec-sleeve-presets';
import { parameterSchema, catalogFields } from '../src/parts/pcb-standoff/lib/schema';
import { validateStandoff } from '../src/parts/pcb-standoff/lib/model';
import cotterPresets from '../src/catalog/generated/gvyntok-cotter-presets.json';
import { PART_ID_PATTERN, registerPartModules, type PartModule } from '../src/core/part-modules';
import type { PartDefinition, Preset } from '../src/core/types';
import { validateParameters } from '../src/core/validation';
import { discoverPackages, inspectPackage } from './part-modules/library';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Refresh portable preset snapshots from the existing offline supplier data:
  node --import tsx scripts/sync-package-catalogs.ts part-id [--check]
  node --import tsx scripts/sync-package-catalogs.ts --all [--check]

No catalog pages are fetched. --check reports pending changes without writing files.
Without --check, changed presets.json files are backed up and replaced after validation.`;

const adapterPresets: Record<string, (part: PartDefinition) => Preset[]> = {
  'bolt-screw': (part) => sourceBoltPresets(part.defaults),
  'set-screw': (part) => sourceSetScrewPresets(part.defaults),
  'wing-screw': (part) => specialFastenerPresets('wing', part.defaults),
  'swing-eye-bolt': (part) => specialFastenerPresets('swing-eye', part.defaults),
  'lifting-eye-bolt': (part) => specialFastenerPresets('lifting-eye', part.defaults),
  'wing-nut': (part) => handNutPresets('wing', part.defaults),
  'lifting-eye-nut': (part) => handNutPresets('eye', part.defaults),
  'cotter-pin': () => cotterPresets as Preset[],
};

let dremec: ReturnType<typeof dremecPresets> | undefined;
const authoritativePresets: Record<string, () => Preset[]> = {
  'pcb-standoff': () => [...(dremec ??= dremecPresets()).detail, ...kosmodromPresets()],
  'pcb-standoff-insert': () => (dremec ??= dremecPresets()).insert,
  'dremec-spacer-sleeve': dremecSleevePresets,
};

export function refreshedPresets(part: PartDefinition): Preset[] {
  const replace = authoritativePresets[part.id];
  if (replace) return replace();
  const imported = [
    ...withHardwarePresets({ ...part, presets: [] }).presets,
    ...(adapterPresets[part.id]?.(part) ?? []),
  ];
  const byId = new Map(imported.map((preset) => [preset.id, preset]));
  const supplierUpdated = withSupplierPresets(part).presets;
  const updated = supplierUpdated.map((preset) => {
    const replacement = byId.get(preset.id);
    byId.delete(preset.id);
    return replacement ?? preset;
  });
  return [...updated, ...byId.values()];
}

/** Fixed identity choices and validation must refer to the prospective snapshot. */
export function moduleWithPresets(module: PartModule, presets: Preset[]): PartModule {
  const part = { ...module.part, presets };
  if (part.id !== 'pcb-standoff' && part.id !== 'pcb-standoff-insert') return { ...module, part };
  if (!presets.length) throw new Error(`${part.id}: the authoritative supplier catalog is empty.`);
  const composite = part.id === 'pcb-standoff-insert';
  return {
    ...module,
    part: {
      ...part,
      defaults: { ...presets[0].parameters },
      parameters: parameterSchema(presets, composite),
      catalogFilterFields: catalogFields(presets),
      validate: (parameters) => validateStandoff(parameters, presets, composite),
    },
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

async function main(): Promise<void> {
  try {
    const [target, ...options] = process.argv.slice(2);
    if (
      !target ||
      (target !== '--all' && !PART_ID_PATTERN.test(target)) ||
      options.some((option) => option !== '--check') ||
      options.length > 1
    )
      throw new Error(usage);
    const checkOnly = options.includes('--check');
    const packages =
      target === '--all'
        ? await discoverPackages(root)
        : [await inspectPackage(path.join(root, 'src/parts', target), root)];
    const modules = new Map<string, PartModule>();
    async function loadModule(id: string): Promise<void> {
      if (modules.has(id)) return;
      if (!PART_ID_PATTERN.test(id)) throw new Error(`Invalid library dependency: ${id}.`);
      const entry =
        packages.find((entry) => entry.id === id) ??
        (await inspectPackage(path.join(root, 'src/parts', id), root));
      const module = (await import(pathToFileURL(path.join(entry.directory, 'index.ts')).href))
        .default as PartModule;
      if (module?.part?.id !== id)
        throw new Error(`${id}: package module declares a different or missing part identity.`);
      modules.set(id, module);
      if (module.dependencies !== undefined && !Array.isArray(module.dependencies))
        throw new Error(`${id}: library dependencies must be an array.`);
      for (const dependency of module.dependencies ?? []) await loadModule(dependency);
    }
    for (const entry of packages) await loadModule(entry.id);
    const targets = new Set(packages.map((entry) => entry.id));
    const prospectiveModules = [...modules.values()].map((module) => {
      // An empty initial fixed snapshot cannot be registered. Its authoritative
      // prospective definition also validates a dependent package's bootstrap;
      // only explicitly requested packages are considered for snapshot writes.
      const refresh = targets.has(module.part.id) || authoritativePresets[module.part.id];
      return refresh ? moduleWithPresets(module, refreshedPresets(module.part)) : module;
    });
    const registered = new Map(
      registerPartModules(prospectiveModules).map((part) => [part.id, part]),
    );
    const changes: { id: string; file: string; previous: string; next: string; count: number }[] =
      [];
    for (const entry of packages) {
      const part = registered.get(entry.id)!;
      const presets = part.presets;
      const state = part.states?.[0]?.id ?? 'default';
      for (const preset of presets) {
        const errors = validateParameters(part, preset.parameters, state);
        if (errors.length)
          throw new Error(
            `${part.id} / ${preset.id}: ${errors.join(' ')} No snapshots were changed.`,
          );
      }
      const file = path.join(entry.directory, 'presets.json');
      const previous = await fs.readFile(file, 'utf8');
      if (JSON.stringify(canonical(JSON.parse(previous))) === JSON.stringify(canonical(presets)))
        continue;
      changes.push({
        id: part.id,
        file,
        previous,
        next: JSON.stringify(presets) + '\n',
        count: presets.length,
      });
    }
    if (!changes.length)
      console.log(`Checked ${packages.length} packages. Offline supplier snapshots are current.`);
    else if (checkOnly) {
      for (const change of changes)
        console.log(`${change.id}: pending snapshot update (${change.count} presets).`);
      console.log('Run the same command without --check to apply these updates.');
      process.exitCode = 1;
    } else {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupParent = path.join(root, 'test-results', 'backups', 'catalog-snapshots');
      await fs.mkdir(backupParent, { recursive: true });
      const backup = await fs.mkdtemp(path.join(backupParent, `${stamp}-`));
      const written: typeof changes = [];
      try {
        for (const change of changes) {
          await fs.writeFile(path.join(backup, `${change.id}.presets.json`), change.previous);
          written.push(change);
          await fs.writeFile(change.file, change.next);
        }
      } catch (error) {
        for (const change of written) await fs.writeFile(change.file, change.previous);
        throw error;
      }
      for (const change of changes) console.log(`Updated ${change.id}: ${change.count} presets.`);
      console.log(`Previous snapshots saved in ${backup}.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await main();
