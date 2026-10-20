import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { framePresetSnapshots, syncFramePresets } from '../scripts/sync-frame-presets';
import frame from '../src/parts/multicopter-frame/part';
import component from '../src/parts/multicopter-frame-component/part';

test('frame catalogs are complete local snapshots of the pinned source metadata', () => {
  const snapshots = framePresetSnapshots();
  for (const part of [frame, component])
    assert.deepEqual(part.presets, snapshots[part.id], `${part.id}: refresh its local snapshot`);
});

test('frame snapshot checks never write, and an explicit refresh updates only stale catalogs', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'protolab-frame-snapshots-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const snapshots = framePresetSnapshots();
  const files = new Map<string, string>();
  const before = new Map<string, string>();
  for (const [id, presets] of Object.entries(snapshots)) {
    const file = path.join(root, 'src/parts', id, 'presets.json');
    await fs.mkdir(path.dirname(file), { recursive: true });
    const saved = structuredClone(presets);
    if (id === frame.id) saved[0].name = 'Outdated snapshot';
    const text = JSON.stringify(saved, null, 2) + '\n';
    await fs.writeFile(file, text);
    files.set(id, file);
    before.set(id, text);
  }
  const checked = await syncFramePresets(root, true);
  assert.deepEqual(
    checked.map(({ id, changed }) => ({ id, changed })),
    [
      { id: frame.id, changed: true },
      { id: component.id, changed: false },
    ],
  );
  for (const [id, file] of files) assert.equal(await fs.readFile(file, 'utf8'), before.get(id));

  assert.deepEqual(await syncFramePresets(root), checked);
  for (const [id, file] of files)
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), snapshots[id]);
  assert.equal(await fs.readFile(files.get(component.id)!, 'utf8'), before.get(component.id));
  assert.ok((await syncFramePresets(root, true)).every((row) => !row.changed));
});
