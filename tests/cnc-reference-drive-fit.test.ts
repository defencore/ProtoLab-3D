import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import jaw, { jawCouplingLayout } from '../src/parts/jaw-coupling/part';
import drive, { driveScrewLayout, driveScrewParameters } from '../src/parts/cnc-drive-screw/part';
import support, { screwSupportParameters } from '../src/parts/cnc-screw-support/part';
import { validateParameters } from '../src/core/validation';
import { withGeometryMode } from '../src/core/geometry-mode';

const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const couplers = ['hltnc-d25-l30-6.35-10', 'hltnc-d25-l30-8-10'].map((id) => {
  const preset = jaw.presets.find((row) => row.id === id);
  if (!preset) throw new Error('Required independent-bore coupling configuration is absent: ' + id);
  return preset;
});

test('existing jaw couplings keep independent motor/screw bores and expose their actual smooth-hub grip datums', () => {
  for (const preset of couplers) {
    const p = preset.parameters,
      v = jawCouplingLayout(p);
    assert.deepEqual(validateParameters(jaw, p, 'assembly'), []);
    assert.equal(v.axis, 'z');
    assert.equal(v.hubA.bore, Number(p.boreA));
    assert.equal(v.hubB.bore, 10);
    assert.equal(v.hubA.start, -15);
    assert.equal(v.hubA.end, -4.7);
    assert.equal(v.hubB.start, 4.7);
    assert.equal(v.hubB.end, 15);
    assert.equal(v.shaftTipGap, 9.4);
    assert.equal(v.hubA.grip, 10.3);
    assert.equal(v.hubB.grip, 10.3);
    assert.equal(v.outsideDiameter, 25);
    assert.deepEqual(preset.catalog!.verifiedParameters, [
      'outerDiameter',
      'length',
      'boreA',
      'boreB',
    ]);
    assert.match(jaw.notes!, /prototype geometry/);
  }
});

test(
  'native independent-bore couplers and retained SFU1610 shafts fit the actual BK12/BF12 source interfaces in Full',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    const input = {
      couplers: couplers.map((preset) => ({
        id: preset.id,
        layout: jawCouplingLayout(preset.parameters),
        source: jaw.python(preset.parameters, 'assembly'),
      })),
      bk: withGeometryMode('full', () =>
        support.python(screwSupportParameters('bk12'), 'assembled'),
      ),
      bf: withGeometryMode('full', () =>
        support.python(screwSupportParameters('bf12'), 'assembled'),
      ),
      shafts: [1800, 1000, 460].map((length) => ({
        length,
        layout: driveScrewLayout(driveScrewParameters(length)),
        source: withGeometryMode('full', () =>
          drive.python(driveScrewParameters(length), 'default'),
        ),
      })),
    };
    const source = `import FreeCAD as App,Part,math,json,hashlib
data=json.loads(${JSON.stringify(JSON.stringify(input))})
def valid(shape):
    assert not shape.isNull() and shape.isValid() and shape.isClosed() and shape.Solids and math.isfinite(shape.Volume) and shape.Volume>0
def common(a,b):
    c=a.common(b);v=c.Volume
    assert math.isfinite(v)
    if c.Solids:assert c.isValid() and c.isClosed()
    assert abs(v)<=.001,('physical interference',v)
    return v
def overlap(a,b):
    x=a.BoundBox;y=b.BoundBox
    return min(x.XMax,y.XMax)-max(x.XMin,y.XMin)>0 and min(x.YMax,y.YMax)-max(x.YMin,y.YMin)>0 and min(x.ZMax,y.ZMax)-max(x.ZMin,y.ZMin)>0
def execute(text):
    scope={'App':App,'Part':Part,'math':math};exec(text,scope)
    for q in scope['components']:valid(q);assert len(q.Solids)==1
    return scope
proof={'couplers':[],'supports':[],'shafts':[]}
for item in data['couplers']:
    print('COUPLER '+item['id'],flush=True)
    scope=execute(item['source']);components=scope['components'];v=item['layout']
    assert len(components)==5
    for i,a in enumerate(components):
        for b in components[i+1:]:
            if overlap(a,b):common(a,b)
    for index,end in [(0,'hubA'),(2,'hubB')]:
        hub=components[index];h=v[end];z=(h['start']+h['end'])/2;r=h['bore']/2
        assert not hub.isInside(App.Vector(0,r-.02,z),1e-7,True),'actual bore must remain open'
        assert hub.isInside(App.Vector(0,r+.02,z),1e-7,True),'bore shoulder must keep material away from either clamp slit'
        shaft=Part.makeCylinder(r,h['grip'],App.Vector(0,0,h['start']))
        common(shaft,scope['shape'])
    proof['couplers'].append({'id':item['id'],'solids':len(components),'nativeBores':[v['hubA']['bore'],v['hubB']['bore']],'shaftGripMm':v['hubA']['grip'],'gapMm':v['shaftTipGap']})
supports={}
for key in ['bk','bf']:
    print('SUPPORT '+key,flush=True)
    scope=execute(data[key]);parts=scope['components']
    for i,a in enumerate(parts):
        for b in parts[i+1:]:
            if overlap(a,b):common(a,b)
    supports[key]=scope
    proof['supports'].append({'id':key,'solids':len(parts),'allInternalIntersectionsWithinMm3':.001})
for item in data['shafts']:
    print('SHAFT '+str(item['length']),flush=True)
    scope=execute(item['source']);shaft=scope['shape'];valid(shaft);assert len(shaft.Solids)==1
    v=item['layout'];bb=shaft.optimalBoundingBox(False,False)
    assert abs(bb.XMin-v['minimum'])<1e-5 and abs(bb.XMax-v['maximum'])<1e-5
    assert abs(bb.YLength-16)<1e-5 and abs(bb.ZLength-16)<1e-5
    assert not shaft.isInside(App.Vector((v['groove']['start']+v['groove']['end'])/2,4.9,0),1e-7,True)
    # Clip the actual installed long shaft to the entire support bounding box, not a regenerated proxy.
    pairs=[]
    for key,center in [('bk',v['fixedSupportCenter']),('bf',v['freeSupportCenter'])]:
        mounted=supports[key]['shape'].copy();mounted.translate(App.Vector(center,0,0));b=mounted.BoundBox;margin=.1
        clip=shaft.common(Part.makeBox(b.XLength+2*margin,b.YLength+2*margin,b.ZLength+2*margin,App.Vector(b.XMin-margin,b.YMin-margin,b.ZMin-margin)))
        valid(clip)
        volume=common(clip,mounted)
        pairs.append({'support':key,'centerX':center,'overlapMm3':volume,'method':'exact actual shaft localized to entire support BoundBox+0.1mm'})
    features=json.loads(scope['component_metadata'][0]['ThreadFeaturesJSON'])
    assert [(f['nominalDiameter'],f['pitch'],f['designation']) for f in features]==[(12,1,'M12x1')]
    proof['shafts'].append({'length':item['length'],'solidCount':len(shaft.Solids),'volumeMm3':shaft.Volume,'bounds':[bb.XMin,bb.XMax,bb.YMin,bb.YMax,bb.ZMin,bb.ZMax],'threadFeatures':features,'pairs':pairs})
print('REFERENCE_DRIVE_NATIVE:'+json.dumps(proof,allow_nan=False),flush=True)
`;
    const path = '/tmp/protolab-cnc-reference-drive-fit.py';
    writeFileSync(path, source);
    const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 590_000,
      maxBuffer: 8_000_000,
    });
    writeFileSync(
      '/tmp/protolab-cnc-reference-drive-fit.log',
      result.stdout + '\n' + result.stderr,
    );
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    const line = result.stdout.split('\n').find((one) => one.startsWith('REFERENCE_DRIVE_NATIVE:'));
    assert.ok(line);
    if (process.env.CNC_REFERENCE_DRIVE_PROOF) {
      const proofPath = resolve(process.env.CNC_REFERENCE_DRIVE_PROOF);
      mkdirSync(dirname(proofPath), { recursive: true });
      const archivedSourcePath = resolve(dirname(proofPath), 'native-proof.py');
      writeFileSync(archivedSourcePath, source);
      writeFileSync(
        proofPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            sourceSha256: sha(source),
            archivedSourcePath,
            nativeRuntimeSha256: sha(readFileSync(process.env.FREECAD_PYTHON!)),
            inputHashes: {
              bk: sha(input.bk),
              bf: sha(input.bf),
              couplers: input.couplers.map((c) => ({ id: c.id, sha256: sha(c.source) })),
              shafts: input.shafts.map((s) => ({ length: s.length, sha256: sha(s.source) })),
            },
            ...JSON.parse(line.slice('REFERENCE_DRIVE_NATIVE:'.length)),
          },
          null,
          2,
        ) + '\n',
      );
    }
  },
);
