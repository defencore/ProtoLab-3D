import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { refreshedPresets, moduleWithPresets } from '../scripts/sync-package-catalogs';
import pcbModule from '../src/parts/pcb-standoff';
import insertModule from '../src/parts/pcb-standoff-insert';
import sleeveModule from '../src/parts/dremec-spacer-sleeve';
import boltModule from '../src/parts/bolt-screw';
import { registerPartModules } from '../src/core/part-modules';
import type { Preset } from '../src/core/types';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = fileURLToPath(new URL('../scripts/sync-package-catalogs.ts', import.meta.url));

test('authoritative catalog sync removes obsolete IDs while existing families retain local examples', () => {
  for (const [module, count] of [
    [pcbModule, 3441],
    [insertModule, 1003],
    [sleeveModule, 4],
  ] as const) {
    const stale: Preset = {
      id: 'obsolete-supplier-id',
      name: 'Removed source identity',
      description: 'This record is absent from the authoritative source.',
      parameters: { ...module.part.defaults },
    };
    const refreshed = refreshedPresets({ ...module.part, presets: [stale] });
    assert.equal(refreshed.length, count, module.part.id);
    assert.ok(!refreshed.some((preset) => preset.id === stale.id));
    assert.equal(new Set(refreshed.map((preset) => preset.id)).size, count);
  }
  const example: Preset = {
    id: 'user-local-example',
    name: 'Local engineering example',
    description: 'Existing generic family keeps a local example without a supplier record.',
    parameters: { ...boltModule.part.defaults },
  };
  assert.equal(
    refreshedPresets({ ...boltModule.part, presets: [example] }).find(
      (preset) => preset.id === example.id,
    ),
    example,
  );
});

test('empty fixed snapshots rebuild their choices/defaults and validation closures against prospective records', () => {
  const prospective = [pcbModule, insertModule].map((module) => {
    const empty = {
      ...module,
      part: {
        ...module.part,
        presets: [],
        catalogFilterFields: [],
        validate: () => ['An obsolete empty-snapshot closure was called.'],
      },
    };
    const presets = refreshedPresets(empty.part);
    const rebuilt = moduleWithPresets(empty, presets);
    assert.deepEqual(rebuilt.part.defaults, presets[0].parameters);
    assert.deepEqual(rebuilt.part.validate(presets.at(-1)!.parameters, 'default'), []);
    assert.ok(
      rebuilt.part.parameters
        .find((field) => field.key === 'catalogItem')!
        .options!.some((option) => option.value === presets.at(-1)!.parameters.catalogItem),
    );
    assert.ok(rebuilt.part.catalogFilterFields!.some((field) => field.key === 'modelFidelity'));
    return rebuilt;
  });
  assert.deepEqual(
    registerPartModules(prospective).map((part) => part.id),
    ['pcb-standoff', 'pcb-standoff-insert'],
  );
});

test('CLI dry runs register real library dependencies without writing snapshots', () => {
  for (const target of ['pcb-standoff-insert', 'ball-screw-axis']) {
    const file = fileURLToPath(new URL(`../src/parts/${target}/presets.json`, import.meta.url));
    const before = readFileSync(file);
    const result = spawnSync(process.execPath, ['--import', 'tsx', script, target, '--check'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Offline supplier snapshots are current/);
    assert.deepEqual(readFileSync(file), before);
  }
});
