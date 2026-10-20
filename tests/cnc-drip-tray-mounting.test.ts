import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import mill, { millingComponents, millingLibraries } from '../src/parts/cnc-milling-machine/part';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import { frameHoles } from '../src/parts/cnc-frame-part/lib/model';

test('every drip tray hanger seats against a rib and follows its own real M6 tap', () => {
  for (const tableHeight of [700, 800, 950]) {
    const all = millingComponents({ ...mill.defaults, tableHeight });
    const floor = all.find((p) => p.component.id === 'coolant-pan-floor')!.component;
    const spacers = all.filter((p) => p.component.id.startsWith('pan-hanger-spacer-'));
    assert.equal(spacers.length, 12);
    for (const { component: spacer } of spacers) {
      const [x, y, z] = spacer.placement.translation;
      const bottom = z - Number(spacer.parameters.sizeZ) / 2;
      const top = z + Number(spacer.parameters.sizeZ) / 2;
      assert.equal(bottom, floor.placement.translation[2] + Number(floor.parameters.thickness));
      const rib = all.find(
        (p) =>
          /^table-rib-\d+$/.test(p.component.id) &&
          Math.abs(p.component.placement.translation[1] - y) < 1e-8,
      )!.component;
      assert.equal(top, rib.placement.translation[2] - Number(rib.parameters.sizeZ) / 2);
      const taps = frameHoles(rib.parameters).filter(
        (h) =>
          h.axis === 'z' &&
          h.diameter === 6 &&
          h.threadDesignation === 'M6' &&
          Math.abs(h.at[0] - x) < 1e-8 &&
          h.at[1] === 0,
      );
      assert.equal(taps.length, 1, 'Each hanger has exactly one coaxial real rib-wall tap');
      assert.equal(taps[0].depth, Number(rib.parameters.wall));
      const id = spacer.id.replace('spacer', 'bolt');
      const bolt = all.find((p) => p.component.id === id)!.component;
      assert.equal(bolt.parameters.length, 70);
      assert.deepEqual(bolt.placement.translation.slice(0, 2), [x, y]);
    }
  }
});

test(
  'native tray hangers have positive bearing contacts and no material overlap',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const all = millingComponents(mill.defaults);
    const pairs: [string, string][] = [];
    for (const { component: spacer } of all.filter((p) =>
      p.component.id.startsWith('pan-hanger-spacer-'),
    )) {
      const rib = all.find(
        (p) =>
          /^table-rib-\d+$/.test(p.component.id) &&
          Math.abs(p.component.placement.translation[1] - spacer.placement.translation[1]) < 1e-8,
      )!;
      pairs.push(
        [spacer.id, 'coolant-pan-floor'],
        [spacer.id, rib.component.id],
        [spacer.id.replace('spacer', 'seal'), 'coolant-pan-floor'],
        [spacer.id.replace('spacer', 'washer'), spacer.id.replace('spacer', 'seal')],
        [spacer.id.replace('spacer', 'bolt'), spacer.id.replace('spacer', 'washer')],
      );
    }
    const ids = new Set(pairs.flat());
    const selected = all.filter((p) => ids.has(p.component.id));
    assert.equal(selected.length, ids.size);
    const output = resolve('test-results/cnc-milling/mounting');
    mkdirSync(output, { recursive: true });
    const reportPath = resolve(output, 'drip-tray-native.json');
    const source = [
      'import FreeCAD as App, Part, math, json',
      withGeometryMode('simple', () => componentPython(millingLibraries, selected)),
      `mapped=dict(zip(${JSON.stringify(selected.map((p) => p.component.id))},components))`,
      `rows=[]\nfor a,b in ${JSON.stringify(pairs)}:\n sa,sb=mapped[a],mapped[b]\n assert sa.isValid() and sb.isValid() and sa.isClosed() and sb.isClosed()\n overlap=sa.common(sb).Volume\n assert math.isfinite(overlap) and abs(overlap)<0.001,(a,b,'overlap',overlap)\n area=0.0\n for fa in sa.Faces:\n  if not isinstance(fa.Surface,Part.Plane): continue\n  for fb in sb.Faces:\n   if not isinstance(fb.Surface,Part.Plane): continue\n   if fa.distToShape(fb)[0]>1e-6: continue\n   common=fa.common(fb)\n   area+=common.Area\n assert math.isfinite(area) and area>1,(a,b,'missing bearing contact',area)\n rows.append({'a':a,'b':b,'contactAreaMm2':area,'overlapMm3':overlap})\nopen(${JSON.stringify(reportPath)},'w').write(json.dumps({'passed':True,'cases':rows},indent=2,allow_nan=False))`,
    ].join('\n');
    const sourcePath = resolve(output, 'drip-tray-native.py');
    writeFileSync(sourcePath, source);
    const run = spawnSync(process.env.FREECAD_PYTHON!, [sourcePath], {
      encoding: 'utf8',
      env: process.env,
      timeout: 180000,
    });
    assert.equal(run.status, 0, run.stdout + '\n' + run.stderr);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.cases.length, 60);
    writeFileSync(
      resolve(output, 'drip-tray-manifest.json'),
      JSON.stringify(
        {
          rootConfiguration: mill.defaults,
          selected,
          pairs,
          sourceSha256: createHash('sha256').update(source).digest('hex'),
          scope:
            'Twelve actual Simple hanger stacks: positive planar bearing contact and strict zero material overlap. Does not qualify preload, sealing, drainage or full-machine behavior.',
        },
        null,
        2,
      ),
    );
  },
);
