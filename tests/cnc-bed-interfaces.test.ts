import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import mill, {
  millingComponents,
  millingLibraries,
  millingLayout,
} from '../src/parts/cnc-milling-machine/part';
import worktable, {
  worktableRibPassages,
  worktableParameters,
} from '../src/parts/cnc-worktable/part';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';

const pieces = () => millingComponents(mill.defaults);
test('shallow formed drip tray stays below ribs and underside fasteners without rib passages', () => {
  const all = pieces(),
    v = millingLayout(mill.defaults);
  for (const side of [-1, 1]) {
    const wall = all.find((p) => p.component.id === 'coolant-pan-side-' + side)!.component;
    const ports = worktableRibPassages(wall.parameters);
    assert.deepEqual(ports, []);
    assert.deepEqual(worktable.validate(wall.parameters, 'default'), []);
    const top = wall.placement.translation[2] + Number(wall.parameters.width);
    const foot = all.find((p) => p.component.id === 'gantry-foot-' + side)!.component;
    const footBottom = foot.placement.translation[2] - Number(foot.parameters.sizeZ) / 2;
    assert.equal(top, v.tableBottom - v.tableRibHeight - 25);
    assert.ok(top < v.tableBottom - v.tableRibHeight - 13.2);
    assert.ok(footBottom - top >= 6);
  }
  for (const bolt of all.filter((p) => /^pan-hanger-bolt-/.test(p.component.id)))
    assert.equal(bolt.component.parameters.length, 70);
  for (const preset of worktable.presets)
    assert.deepEqual(worktable.validate(preset.parameters, 'default'), []);
});

test('fixed-rib passage validation preserves bend, end and continuous wall stock', () => {
  // The generic library feature is independently valid; this machine no longer needs it.
  const p = worktableParameters('pan-side', {
    width: 178,
    length: 1860,
    thickness: 2,
    ribPassages: JSON.stringify([
      { y: 0, width: 100.4, height: 100.4, cornerRadius: 20.2, bottomZ: 37.8 },
    ]),
  });
  const ports = worktableRibPassages(p);
  for (const patch of [{ bottomZ: 0 }, { y: Number(p.length) / 2 }, { cornerRadius: 1000 }]) {
    const changed = [{ ...ports[0], ...patch }];
    assert.ok(worktable.validate({ ...p, ribPassages: JSON.stringify(changed) }, 'default').length);
  }
  assert.ok(worktable.validate({ ...p, component: 'pan-end' }, 'default').length);
  assert.ok(
    worktable.validate({ ...p, ribPassages: JSON.stringify([ports[0], ports[0]]) }, 'default')
      .length,
  );
  assert.ok(
    worktable.validate({ ...p, ribPassages: '[{"y":0,"hiddenMesh":true}]' }, 'default').length,
  );
});

test('roof taps reach through the real rounded wall and end crossmember clears structural washer edges', () => {
  const all = pieces(),
    v = millingLayout(mill.defaults);
  for (const side of [-1, 1]) {
    const bed = all.find((p) => p.component.id === 'fixed-bed-side-' + side)!.component;
    const taps = JSON.parse(String(bed.parameters.holes)).filter(
      (h: { axis: string; diameter: number; at: number[] }) =>
        h.axis === 'z' && h.diameter === 5 && Math.abs(h.at[0]) === 25,
    );
    assert.equal(taps.length, 14);
    for (const tap of taps) {
      assert.equal(tap.depth, 12);
      assert.equal(tap.at[2] + tap.depth, v.bedTubeDepth / 2);
    }
  }
  const cross = all.find((p) => p.component.id === 'drive-end-crossmember-0')!.component;
  const rear = cross.placement.translation[1] - Number(cross.parameters.sizeY) / 2;
  for (const row of all.filter((p) => /^bed-flange-.*-clamp-0-.*-washer$/.test(p.component.id))) {
    const edge =
      row.component.placement.translation[1] + Number(row.component.parameters.outerDiameter) / 2;
    assert.ok(rear - edge >= 2);
  }
});

test(
  'native bed, shallow drip tray and moving feet have no physical intersections',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const all = pieces(),
      ids = new Set<string>(),
      pairs: [string, string][] = [];
    for (const p of all) {
      const id = p.component.id;
      if (id.startsWith('rail-pad-') && id.endsWith('--25'))
        pairs.push([id, id.startsWith('rail-pad--1') ? 'fixed-bed-side--1' : 'fixed-bed-side-1']);
      if (id.startsWith('rib-') && id.includes('end-insert'))
        pairs.push([id, id.endsWith('--1') ? 'coolant-pan-side--1' : 'coolant-pan-side-1']);
      if (/^table-rib-\d+$/.test(id))
        for (const side of [-1, 1]) pairs.push([id, 'coolant-pan-side-' + side]);
      if (/^bed-flange-.*-clamp-0-.*-washer$/.test(id)) pairs.push(['drive-end-crossmember-0', id]);
    }
    for (const foot of ['gantry-foot--1', 'gantry-foot-1'])
      for (const pan of [
        'coolant-pan-side--1',
        'coolant-pan-side-1',
        'coolant-pan-end--1',
        'coolant-pan-end-1',
      ])
        pairs.push([foot, pan]);
    for (const [a, b] of pairs) {
      ids.add(a);
      ids.add(b);
    }
    const selected = all.filter((p) => ids.has(p.component.id));
    assert.equal(selected.length, ids.size);
    const source = [
      'import FreeCAD as App,Part,math,json\nrows=[]',
      withGeometryMode('simple', () => componentPython(millingLibraries, selected)),
      `mapped={id:shape for id,shape in zip(${JSON.stringify(selected.map((p) => p.component.id))},components)}\nfor child in mapped.values():\n assert child.isValid() and child.isClosed() and math.isfinite(child.Volume) and child.Volume>0\nfor a,b in ${JSON.stringify(pairs)}:\n c=mapped[a].common(mapped[b])\n assert math.isfinite(c.Volume) and abs(c.Volume)<1e-6,(a,b,c.Volume)\n rows.append({'a':a,'b':b,'volume':c.Volume})\nfor y in [-750,750]:\n for foot in ['gantry-foot--1','gantry-foot-1']:\n  moving=mapped[foot].copy();moving.translate(App.Vector(0,y,0))\n  for pan in ['coolant-pan-side--1','coolant-pan-side-1','coolant-pan-end--1','coolant-pan-end-1']:\n   c=moving.common(mapped[pan])\n   assert math.isfinite(c.Volume) and abs(c.Volume)<1e-6,(y,foot,pan,c.Volume)\n   rows.append({'y':y,'a':foot,'b':pan,'volume':c.Volume})\nopen('/tmp/protolab-cnc-bed-native.json','w').write(json.dumps({'passed':True,'cases':rows},indent=2,allow_nan=False))`,
    ].join('\n');
    const path = '/tmp/protolab-cnc-bed-native.py';
    writeFileSync(path, source);
    const execution = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 180000,
    });
    assert.equal(execution.status, 0, execution.stdout + '\n' + execution.stderr);
    const result = JSON.parse(readFileSync('/tmp/protolab-cnc-bed-native.json', 'utf8'));
    assert.equal(result.cases.length, pairs.length + 16);
    writeFileSync(
      '/tmp/protolab-cnc-bed-native-manifest.json',
      JSON.stringify(
        {
          sourceSha256: createHash('sha256').update(source).digest('hex'),
          rootConfiguration: mill.defaults,
          selected,
          pairs,
          scope:
            'Actual Simple bed/pad/crossmember/formedpan and foot clearances at midpoint and bothYendpoints. Does not establish wet containment or complete-machine qualification.',
        },
        null,
        2,
      ),
    );
  },
);
