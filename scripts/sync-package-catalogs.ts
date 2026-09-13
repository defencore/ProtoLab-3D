import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withHardwarePresets } from '../src/catalog/hardware';
import { withSupplierPresets } from '../src/catalog/supplier-presets';
import { sourceBoltPresets, sourceSetScrewPresets } from '../src/catalog/fasteners';
import { specialFastenerPresets } from '../src/catalog/special-fastener-catalog';
import { handNutPresets } from '../src/catalog/hand-nuts';
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

function refreshedPresets(part: PartDefinition): Preset[] {
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
  const changes: { id: string; file: string; previous: string; next: string; count: number }[] = [];
  for (const entry of packages) {
    const module = (await import(pathToFileURL(path.join(entry.directory, 'index.ts')).href))
      .default as PartModule;
    const [part] = registerPartModules([module]);
    const presets = refreshedPresets(part);
    registerPartModules([{ ...module, part: { ...part, presets } }]);
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
    const backup = await fs.mkdtemp(path.join(root, `.catalog-snapshot-backup-${stamp}-`));
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
