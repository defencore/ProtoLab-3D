import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Euler, Mesh, Vector3 } from 'three';
import machine from '../src/parts/cnc-milling-machine/part';
import {
  millingComponents,
  millingLibraries,
} from '../src/parts/cnc-milling-machine/lib/composition';
import { precisionScrewLayout } from '../src/parts/cnc-precision-screw/part';
import ring from '../src/parts/retaining-ring/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';

test('free-ring source presets keep the installation envelope disabled and unverified', () => {
  assert.equal(ring.defaults.boreEnvelope, 0);
  const field = ring.parameters.find((f) => f.key === 'boreEnvelope')!;
  assert.equal(field.filterable, false);
  for (const preset of ring.presets) {
    assert.equal(preset.parameters.boreEnvelope, 0);
    assert.ok(!preset.catalog?.verifiedParameters.includes('boreEnvelope'));
    assert.deepEqual(validateParameters(ring, preset.parameters, 'default'), []);
    assert.ok(!ring.python(preset.parameters, 'default').includes('InstalledBoreEnvelope'));
  }
});

test('installed circlips remain inside their actual axial grooves and export closed outward preview shells', () => {
  const rows = millingComponents(machine.defaults);
  for (const axis of ['y', 'x', 'z']) {
    const shaft = rows.find((r) => r.component.id === axis + '-drive-screw')!.component,
      clip = rows.find((r) => r.component.id === axis + '-free-shaft-circlip')!.component,
      v = precisionScrewLayout(shaft.parameters),
      p = clip.parameters;
    assert.deepEqual(validateParameters(ring, p, 'default'), []);
    assert.equal(Number(p.boreEnvelope), v.groove.diameter + 0.1);
    assert.ok(Number(p.thickness) < v.groove.end - v.groove.start);
    assert.ok(Number(p.boreEnvelope) < v.freeJournal.diameter);
    assert.match(ring.python(p, 'default'), /not.*machining|no machining/);
    const model = ring.buildGeometry(p, 'default');
    try {
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone(),
          points = g.getAttribute('position');
        const edges = new Map<string, number>();
        let volume = 0;
        const key = (v: Vector3) =>
          v
            .toArray()
            .map((n) => Math.round(n * 1e5))
            .join(',');
        for (let i = 0; i < points.count; i += 3) {
          const a = new Vector3().fromBufferAttribute(points, i),
            b = new Vector3().fromBufferAttribute(points, i + 1),
            c = new Vector3().fromBufferAttribute(points, i + 2);
          assert.ok(a.clone().sub(c).cross(b.clone().sub(c)).length() > 1e-8);
          volume += a.dot(b.clone().cross(c)) / 6;
          for (const [u, v] of [
            [a, b],
            [b, c],
            [c, a],
          ]) {
            const k = [key(u), key(v)].sort().join('|');
            edges.set(k, (edges.get(k) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0);
        assert.ok(
          [...edges.values()].every((n) => n === 2),
          axis + ' closed preview shell',
        );
        g.dispose();
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('X support anchors bear at the rear with sourced washers and actual beam-wall engagement', () => {
  const rows = millingComponents(machine.defaults),
    anchors = rows.filter((r) => r.component.id.startsWith('x-drive-platform-anchor-'));
  assert.equal(anchors.length, 4);
  assert.ok(!rows.some((r) => r.component.id.startsWith('x-drive-platform-crush-')));
  for (const a of anchors) {
    assert.equal(a.component.parameters.length, 140);
    assert.equal(a.component.parameters.diameter, 8);
    const normal = new Vector3(0, 0, 1).applyEuler(
        new Euler(
          ...(a.component.placement.rotation.map((n) => (n * Math.PI) / 180) as [
            number,
            number,
            number,
          ]),
          'ZYX',
        ),
      ),
      seat = new Vector3(...a.component.placement.translation).addScaledVector(
        normal,
        (Number(a.component.parameters.length) - Number(a.component.parameters.headHeight)) / 2,
      );
    assert.ok(seat.y < -200, 'The actual under-head seat is behind the platform.');
    const washer = rows.find(
      (r) => r.component.id === a.component.id.replace('-anchor-', '-washer-'),
    )!.component;
    assert.equal(washer.parameters.thickness, 1.6);
    assert.equal(washer.parameters.bore, 8.4);
    assert.ok(
      Math.abs(seat.y - (washer.placement.translation[1] - 0.8)) < 1e-8,
      'Head must bear on its real washer.',
    );
  }
});

test(
  'optional native actual retention and rear X anchors clear the complete carriage travel in Simple and Full',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    const all = millingComponents(machine.defaults),
      rows = all.filter(
        (r) =>
          ['gantry-box-beam', 'x-fixed-support-platform', 'x-free-support-platform'].includes(
            r.component.id,
          ) ||
          r.component.id.startsWith('x-drive-platform-') ||
          (r.component.id.startsWith('x-carriage-') &&
            r.component.libraryId === 'cnc-guide-carriage') ||
          /^(x|y|z)-(drive-screw|free-shaft-circlip)$/.test(r.component.id),
      ),
      ids = rows.map((r) => r.component.id),
      grooves = ['y', 'x', 'z'].map((axis) => ({
        axis,
        shaft: ids.indexOf(axis + '-drive-screw'),
        ring: ids.indexOf(axis + '-free-shaft-circlip'),
      })),
      proofs = [];
    assert.ok(grooves.every((g) => g.shaft >= 0 && g.ring >= 0));
    for (const mode of ['simple', 'full'] as const) {
      const source = withGeometryMode(mode, () => componentPython(millingLibraries, rows));
      const native = `import FreeCAD as App,Part,math,json\n${source}
ids=json.loads(${JSON.stringify(JSON.stringify(ids))})
grooves=json.loads(${JSON.stringify(JSON.stringify(grooves))})
assert len(components)==len(ids)
for i,q in enumerate(components):assert not q.isNull() and q.Solids and q.isValid() and q.isClosed() and math.isfinite(q.Volume) and q.Volume>0,ids[i]
results=[]
for pair in grooves:
 s,r=components[pair['shaft']],components[pair['ring']];bb=r.BoundBox;margin=.1
 box=Part.makeBox(bb.XLength+2*margin,bb.YLength+2*margin,bb.ZLength+2*margin,App.Vector(bb.XMin-margin,bb.YMin-margin,bb.ZMin-margin))
 clipped=s.common(box)
 assert clipped.Solids and clipped.isValid() and clipped.isClosed() and math.isfinite(clipped.Volume) and clipped.Volume>0
 c=clipped.common(r);v=c.Volume
 assert math.isfinite(v) and abs(v)<=.001,(pair['axis'],'installed ring/groove interference',v)
 if c.Solids:assert c.isValid() and c.isClosed()
 results.append({'kind':'retention','axis':pair['axis'],'volumeMm3':v,'method':'exact installed shaft clipped to complete ring BoundingBox +0.1mm'})
for x in [-400,0,400]:
 placed=[]
 for ident,q in zip(ids,components):
  s=q.copy()
  if ident.startswith('x-carriage-'):s.translate(App.Vector(x,0,0))
  placed.append(s)
 for i,a in enumerate(placed):
  for j in range(i+1,len(placed)):
   if not (ids[i].startswith('x-drive-platform-') or ids[j].startswith('x-drive-platform-')):continue
   b=placed[j];ab=a.BoundBox;bb=b.BoundBox
   if min(ab.XMax,bb.XMax)-max(ab.XMin,bb.XMin)<=0 or min(ab.YMax,bb.YMax)-max(ab.YMin,bb.YMin)<=0 or min(ab.ZMax,bb.ZMax)-max(ab.ZMin,bb.ZMin)<=0:continue
   c=a.common(b);v=c.Volume
   assert math.isfinite(v) and abs(v)<=.001,(ids[i],ids[j],x,v)
   if c.Solids:assert c.isValid() and c.isClosed()
   results.append({'kind':'rear-anchor','a':ids[i],'b':ids[j],'x':x,'volumeMm3':v})
open('/tmp/protolab-drive-retention-${mode}.json','w').write(json.dumps({'mode':${JSON.stringify(mode)},'components':len(ids),'cases':results,'passed':True},indent=2,allow_nan=False))
`;
      const path = '/tmp/protolab-drive-retention-' + mode + '.py';
      writeFileSync(path, native);
      const r = spawnSync(process.env.FREECAD_PYTHON!, [path], {
        encoding: 'utf8',
        env: process.env,
        timeout: 290_000,
        maxBuffer: 2_000_000,
      });
      assert.equal(r.status, 0, `${r.error ?? ''}\n${r.stdout}\n${r.stderr}`);
      proofs.push({
        executedSourceSha256: createHash('sha256').update(native).digest('hex'),
        geometrySourceSha256: createHash('sha256').update(source).digest('hex'),
        ...JSON.parse(readFileSync('/tmp/protolab-drive-retention-' + mode + '.json', 'utf8')),
      });
    }
    writeFileSync(
      '/tmp/protolab-drive-retention-proof.json',
      JSON.stringify({ rootConfiguration: machine.defaults, proofs }, null, 2),
    );
  },
);
