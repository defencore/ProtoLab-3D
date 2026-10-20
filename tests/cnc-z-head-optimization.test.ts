import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import machine, {
  millingComponents,
  millingLibraries,
  millingLayout,
} from '../src/parts/cnc-milling-machine/part';
import frame from '../src/parts/cnc-frame-part/part';
import { HGH20CA } from '../src/parts/cnc-guide-carriage/part';
import { spindleMountDefaults, spindleMountLayout } from '../src/parts/cnc-spindle-mount/part';
import { limitStations } from '../src/parts/cnc-milling-machine/lib/limits';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import type { Parameters } from '../src/core/types';

const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const before = JSON.parse(
  readFileSync(new URL('./fixtures/cnc-z-head-before.json', import.meta.url), 'utf8'),
);
const configurations = machine.parameters
  .find((p) => p.key === 'spindle')!
  .options!.flatMap((spindle) =>
    [20, 25, 50].map((toolProjection) => ({
      ...machine.defaults,
      spindle: spindle.value,
      toolProjection,
    })),
  );

test('trimmed Z head retains source contact envelopes, central drive and 200mm stroke for every spindle and gauge', () => {
  assert.equal(configurations.length, 15);
  for (const p of configurations) {
    const v = millingLayout(p),
      pieces = millingComponents(p),
      moving = pieces.find((one) => one.component.id === 'moving-z-saddle')!.component,
      fixed = pieces.find((one) => one.component.id === 'x-z-fixed-saddle')!.component,
      mount = spindleMountLayout({ ...spindleMountDefaults, bodyDiameter: v.spindle.bodyDiameter });
    assert.equal(v.movingPlateTop, v.tableTop + 545);
    assert.equal(v.movingPlateBottom, v.clampLow + 62);
    assert.equal(v.workZ, 200);
    assert.equal(v.fixedPlateCenter - v.fixedPlateHeight / 2, v.tableTop + 220);
    assert.equal(v.zScrewX, 0);
    assert.equal(v.zScrewY, 178);
    assert.equal(v.movingPlateThickness, 30);
    assert.equal(v.movingRibThickness, 12);
    assert.equal(v.movingRibDepth, 80);
    assert.deepEqual(frame.validate(moving.parameters, moving.state), [], String(p.spindle));
    assert.deepEqual(frame.validate(fixed.parameters, fixed.state), [], String(p.spindle));
    const upperCover = v.guideLow + 100 + 70 + HGH20CA.length / 2;
    assert.ok(Math.abs(v.movingPlateTop - upperCover - 6.25) < 1e-8);
    const clampBottom = v.clampLow + 100 - mount.clampHeight / 2;
    assert.ok(clampBottom - v.movingPlateBottom >= 5.5 - 1e-8);
    const stations = limitStations(p, v).filter((one) => one.axis === 'z');
    for (const station of stations) {
      const dz = station.end === 'min' ? -100 : 100;
      assert.equal(station.targetSize[0], 4);
      assert.ok(Math.abs(station.targetCenter[2] + dz - station.sensorOrigin[2]) < 1e-8);
      const faceX = station.sensorOrigin[0] - 47.5;
      assert.ok(Math.abs(faceX - station.targetCenter[0] - 2 - 2) < 1e-8);
      for (const seat of station.targetBoltSeats) {
        assert.ok(seat[2] - 2 >= v.movingPlateBottom);
        assert.ok(seat[2] + 2 <= v.movingPlateTop);
      }
    }
    assert.equal(stations.find((one) => one.end === 'max')!.targetCenter[2], v.movingPlateTop - 20);
    const ids = pieces.map((one) => one.component.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.filter((id) => id.startsWith('z-guide-rail-')).length, 2);
    assert.equal(
      pieces.filter(
        (one) =>
          /^z-carriage-/.test(one.component.id) && one.component.libraryId === 'cnc-guide-carriage',
      ).length,
      4,
    );
  }
});

test(
  'native end trimming reduces measured mass and retains actual Z contacts and strict clearances in Simple and Full',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    const p = machine.defaults,
      v = millingLayout(p),
      all = millingComponents(p);
    const selected = all.filter(
      (one) =>
        one.component.id.startsWith('z-') ||
        ['x-z-fixed-saddle', 'moving-z-saddle', 'cutting-spindle'].includes(one.component.id) ||
        one.component.id.startsWith('spindle-clamp-') ||
        one.component.id.startsWith('spindle-mount-back-bolt-'),
    );
    const ids = selected.map((one) => one.component.id);
    const modes = (['simple', 'full'] as const).map((mode) => ({
      mode,
      source: withGeometryMode(mode, () => componentPython(millingLibraries, selected)),
      previous: before.rows.map((row: any) => {
        const values = row.parameters as Parameters,
          b = row.worldBounds as number[];
        return {
          ...row,
          source: withGeometryMode(mode, () => frame.python(values, 'default')),
          translation: [
            (b[0] + b[1]) / 2,
            b[3] - Number(values.sizeY) / 2 - Number(values.ribDepth),
            b[4] + Number(values.sizeZ) / 2,
          ],
        };
      }),
    }));
    const movingCases = configurations.map((parameters) => {
      const layout = millingLayout(parameters),
        rows = millingComponents(parameters),
        moving = rows.find((one) => one.component.id === 'moving-z-saddle')!;
      return {
        spindle: parameters.spindle,
        gauge: parameters.toolProjection,
        top: layout.movingPlateTop,
        bottom: layout.movingPlateBottom,
        source: withGeometryMode('simple', () => componentPython(millingLibraries, [moving])),
      };
    });
    const contacts = [-1, 1].flatMap((side) =>
      [0, 1].map((row) => ({
        a: 'moving-z-saddle',
        b: `z-carriage-${side}-${row}`,
        axis: 1,
        plane: v.zPlateBack,
      })),
    );
    contacts.push({ a: 'moving-z-saddle', b: 'spindle-clamp-back', axis: 1, plane: v.zPlateFront });
    contacts.push({
      a: 'x-z-fixed-saddle',
      b: 'z-fixed-support-shim',
      axis: 1,
      plane: v.xPlateFront,
    });
    contacts.push({
      a: 'x-z-fixed-saddle',
      b: 'z-free-support-shim',
      axis: 1,
      plane: v.xPlateFront,
    });
    contacts.push({
      a: 'moving-z-saddle',
      b: 'z-ball-nut',
      axis: 2,
      plane: v.guideLow + 100 + v.zNutPlatformBottomFromGuide,
    });
    const input = {
      ids,
      motion: selected.map((one) => one.motion),
      libraries: selected.map((one) => one.component.libraryId),
      changedInterfaces: selected.map(
        (one) =>
          ['moving-z-saddle', 'x-z-fixed-saddle'].includes(one.component.id) ||
          one.component.id.startsWith('z-limit-max'),
      ),
      configuration: p,
      modes,
      movingCases,
      contacts,
      tableTop: v.tableTop,
      newTop: v.movingPlateTop,
      newBottom: v.movingPlateBottom,
      sectionHeights: [
        v.clampLow + 100,
        v.guideLow + 30,
        v.guideLow + 170,
        v.movingPlateTop - 30,
        v.movingPlateTop - 10,
      ],
    };
    const source = `import FreeCAD as App,Part,math,json
data=json.loads(${JSON.stringify(JSON.stringify(input))})
def valid(s):
    assert not s.isNull() and s.Solids and s.isValid() and s.isClosed() and math.isfinite(s.Volume) and s.Volume>0
def execute(text):
    scope={'App':App,'Part':Part,'math':math};exec(text,scope);return scope
def box_overlap(a,b):
    aa=a.BoundBox;bb=b.BoundBox
    return min(aa.XMax,bb.XMax)-max(aa.XMin,bb.XMin)>0 and min(aa.YMax,bb.YMax)-max(aa.YMin,bb.YMin)>0 and min(aa.ZMax,bb.ZMax)-max(aa.ZMin,bb.ZMin)>0
def common(a,b):
    c=a.common(b);v=c.Volume
    assert math.isfinite(v)
    if c.Solids:assert c.isValid() and c.isClosed()
    assert abs(v)<=.001,('physical overlap',v)
    return v
def face_area(a,b,axis,plane):
    faces=[]
    for shape in [a,b]:
        selected=[]
        for face in shape.Faces:
            bb=face.BoundBox;lo=[bb.XMin,bb.YMin,bb.ZMin][axis];hi=[bb.XMax,bb.YMax,bb.ZMax][axis]
            if abs(lo-plane)<1e-5 and abs(hi-plane)<1e-5:selected.append(face)
        faces.append(selected)
    area=0.
    for aa in faces[0]:
        for bb in faces[1]:
            c=aa.common(bb)
            assert math.isfinite(c.Area)
            area+=c.Area
    return area
def section(shape,z):
    h=.2
    slab=shape.common(Part.makeBox(600,400,h,App.Vector(-300,0,z-h/2)))
    valid(slab)
    # A horizontal section can contain disconnected solids. Sum each exact solid's
    # centroidal inertia with the parallel-axis theorem; Compound has no inertia property.
    center=App.Vector(sum(s.Volume*s.CenterOfMass.x for s in slab.Solids)/slab.Volume,sum(s.Volume*s.CenterOfMass.y for s in slab.Solids)/slab.Volume,sum(s.Volume*s.CenterOfMass.z for s in slab.Solids)/slab.Volume)
    ixx=sum(s.MatrixOfInertia.A11+s.Volume*((s.CenterOfMass.y-center.y)**2+(s.CenterOfMass.z-center.z)**2) for s in slab.Solids)
    iyy=sum(s.MatrixOfInertia.A22+s.Volume*((s.CenterOfMass.x-center.x)**2+(s.CenterOfMass.z-center.z)**2) for s in slab.Solids)
    return {'z':z,'sliceThicknessMm':h,'areaMm2':slab.Volume/h,'centroidY':center.y,'sliceIxxPerThicknessMm4':ixx/h,'sliceIyyPerThicknessMm4':iyy/h}
# Prove this runtime reports centroidal inertia, independent of the world translation.
for at in [App.Vector(),App.Vector(100,190,1000)]:
    box=Part.makeBox(100,30,.2,at)
    assert abs(box.MatrixOfInertia.A11-100*30*.2*(30**2+.2**2)/12)<1e-5
result={'status':'passed','densityKgPerM3':2700,'nativeVersion':App.Version(),'modes':[],'movingConfigurations':[],'sectionScope':'Actual Simple 0.2 mm native slabs retain holes/pockets and finite slice thickness. Not FEM, open-section warping or an accuracy certificate.','collisionScope':'Changed fixed/moving head and max-limit interfaces against every selected Z neighbor at 0/100/200 mm travel; rigid relative poses are evaluated once. Unchanged hardware pairs are covered by the whole-machine audit.'}
for mode in data['modes']:
    print('MODE '+mode['mode'],flush=True)
    scope=execute(mode['source']);components=scope['components']
    assert len(components)==len(data['ids'])
    for identity,s in zip(data['ids'],components):valid(s)
    print('GEOMETRY_READY '+mode['mode'],flush=True)
    by_id=dict(zip(data['ids'],components))
    previous={}
    for row in mode['previous']:
        old=execute(row['source'])['shape'];old.translate(App.Vector(*row['translation']));valid(old)
        if mode['mode']=='simple':assert abs(old.Volume-row['volumeMm3'])<.001,('accepted before volume changed',row['id'],old.Volume,row['volumeMm3'])
        previous[row['id']]=old
    moving=by_id['moving-z-saddle'];fixed=by_id['x-z-fixed-saddle']
    assert len(moving.Solids)==1 and len(fixed.Solids)==1
    assert abs(moving.BoundBox.ZMin-data['newBottom'])<1e-5 and abs(moving.BoundBox.ZMax-data['newTop'])<1e-5
    assert abs(fixed.BoundBox.ZMin-(data['tableTop']+220))<1e-5
    saved=previous['moving-z-saddle'].Volume;current=moving.Volume
    assert saved>current and (saved-current)*.0000027>1.,('actual mass reduction',saved,current)
    assert abs(previous['x-z-fixed-saddle'].Volume-fixed.Volume)<.001,'fixed tower must retain its source material'
    sections=[{'before':section(previous['moving-z-saddle'],z),'after':section(moving,z)} for z in data['sectionHeights']] if mode['mode']=='simple' else []
    # Guide/clamp loaded strips are identical; relocated M4 limit bores are measured separately.
    for pair in sections[:3]:
        for key in ['areaMm2','sliceIxxPerThicknessMm4','sliceIyyPerThicknessMm4']:
            assert abs(pair['before'][key]-pair['after'][key])<=max(.01,abs(pair['before'][key])*1e-7),(key,pair)
    print('SECTIONS_READY '+mode['mode'],flush=True)
    contact_rows=[]
    for contact in data['contacts']:
        a,b=by_id[contact['a']],by_id[contact['b']]
        distance=a.distToShape(b)[0];area=face_area(a,b,contact['axis'],contact['plane'])
        assert distance<1e-5 and area>10,('missing positive bearing face',contact,distance,area)
        contact_rows.append({**contact,'distanceMm':distance,'bearingAreaMm2':area})
    print('CONTACTS_READY '+mode['mode'],flush=True)
    cases=[];checked_pairs={}
    for dz in [-100,0,100]:
        posed=[]
        for s,motion in zip(components,data['motion']):
            q=s.copy()
            if motion=='z':q.translate(App.Vector(0,0,dz))
            posed.append(q)
        checked=0;reused=0
        for i,a in enumerate(posed):
            for j in range(i+1,len(posed)):
                b=posed[j]
                if not(data['changedInterfaces'][i] or data['changedInterfaces'][j]):continue
                if not box_overlap(a,b):continue
                relative=(dz if data['motion'][i]=='z' else 0)-(dz if data['motion'][j]=='z' else 0)
                key=(i,j,relative)
                if key in checked_pairs:
                    checked+=1;reused+=1;continue
                if 'cnc-precision-screw' in [data['libraries'][i],data['libraries'][j]]:
                    shaft,other=(a,b) if data['libraries'][i]=='cnc-precision-screw' else (b,a)
                    bb=other.BoundBox;margin=.1
                    clipped=shaft.common(Part.makeBox(bb.XLength+2*margin,bb.YLength+2*margin,bb.ZLength+2*margin,App.Vector(bb.XMin-margin,bb.YMin-margin,bb.ZMin-margin)))
                    valid(clipped)
                    try:common(clipped,other)
                    except Exception as e:raise AssertionError((mode['mode'],dz,data['ids'][i],data['ids'][j],str(e)))
                else:
                    try:common(a,b)
                    except Exception as e:raise AssertionError((mode['mode'],dz,data['ids'][i],data['ids'][j],str(e)))
                checked_pairs[key]=True
                checked+=1
        cases.append({'zTravelMm':dz+100,'checkedPositiveBoundsPairs':checked,'rigidRelativePoseReuses':reused,'freshNativePairs':checked-reused})
        print('POSE_READY '+mode['mode']+' '+str(dz+100)+' '+str(checked)+' '+str(reused),flush=True)
    result['modes'].append({'mode':mode['mode'],'components':len(components),'beforeVolumeMm3':saved,'afterVolumeMm3':current,'beforeMassKg':saved*.0000027,'afterMassKg':current*.0000027,'savedMassKg':(saved-current)*.0000027,'fixedMassKg':fixed.Volume*.0000027,'contacts':contact_rows,'poses':cases,'nativeSections':sections})
    print('MODE_RESULT:'+json.dumps(result['modes'][-1],allow_nan=False),flush=True)
for item in data['movingCases']:
    shape=execute(item['source'])['components'][0];valid(shape);assert len(shape.Solids)==1
    assert abs(shape.BoundBox.ZMin-item['bottom'])<1e-5 and abs(shape.BoundBox.ZMax-item['top'])<1e-5
    result['movingConfigurations'].append({'spindle':item['spindle'],'gaugeMm':item['gauge'],'volumeMm3':shape.Volume,'heightMm':shape.BoundBox.ZLength})
print('Z_HEAD_OPTIMIZATION:'+json.dumps(result,allow_nan=False),flush=True)
`;
    const path = '/tmp/protolab-cnc-z-head-optimization.py';
    writeFileSync(path, source);
    const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 590_000,
      maxBuffer: 8_000_000,
    });
    writeFileSync(
      '/tmp/protolab-cnc-z-head-optimization.log',
      result.stdout + '\n' + result.stderr,
    );
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    const line = result.stdout.split('\n').find((one) => one.startsWith('Z_HEAD_OPTIMIZATION:'));
    assert.ok(line);
    if (process.env.CNC_Z_HEAD_PROOF) {
      const path = resolve(process.env.CNC_Z_HEAD_PROOF);
      mkdirSync(dirname(path), { recursive: true });
      const archivedSourcePath = resolve(dirname(path), 'native-proof.py');
      writeFileSync(archivedSourcePath, source);
      writeFileSync(
        path,
        JSON.stringify(
          {
            schemaVersion: 1,
            sourceSha256: sha(source),
            archivedSourcePath,
            nativeRuntimeSha256: sha(readFileSync(process.env.FREECAD_PYTHON!)),
            configuration: p,
            unitSourceHashes: modes.map((mode) => ({ mode: mode.mode, sha256: sha(mode.source) })),
            ...JSON.parse(line.slice('Z_HEAD_OPTIMIZATION:'.length)),
          },
          null,
          2,
        ) + '\n',
      );
    }
  },
);
