import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import mill, {
  millingComponents,
  millingLayout,
  millingPieces,
} from '../src/parts/cnc-milling-machine/part';
import { millingLibraries } from '../src/parts/cnc-milling-machine/lib/composition';
import frame, { frameManufacturing, type FrameHole } from '../src/parts/cnc-frame-part/part';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode, type GeometryMode } from '../src/core/geometry-mode';
import { fastenerValues } from '../src/core/hardware/fasteners';
import type { Parameters } from '../src/core/types';
import threadedRod, { threadedRodFastenerParameters } from '../src/parts/threaded-rod/part';
import hexNut from '../src/parts/hex-nut/part';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const holes = (p: Parameters) => JSON.parse(String(p.holes)) as FrameHole[];
const nativeDir = 'test-results/cnc-milling/optimization/portal';
function cachedNativeGeometry(geometry: string) {
  const nativePython = process.env.FREECAD_PYTHON!,
    nativeLib = process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib';
  const runtimeSignature = JSON.stringify(
    [nativePython, resolve(nativeLib, 'FreeCAD.so')].map((path) => ({
      path,
      ...(existsSync(path) ? { size: statSync(path).size, modified: statSync(path).mtimeMs } : {}),
    })),
  );
  const templatesPath = resolve(
    'test-results/cnc-milling/templates',
    createHash('sha256').update(runtimeSignature).digest('hex'),
  );
  const marker = '\ncomponents = []\ncomponent_metadata = []\n';
  assert.equal(geometry.split(marker).length, 2, 'The original native factory marker changed.');
  // Cache entries contain the exact source constructor result, before occurrence placement.
  // Every placed component and every native contact/intersection check still runs below.
  const persistence = String.raw`
portal_template_path=${JSON.stringify(templatesPath)}
portal_runtime_signature=${JSON.stringify(runtimeSignature)}
os.makedirs(portal_template_path,exist_ok=True)
portal_template_records=[]
_original_component_builder=_pl_component
def _pl_component(source):
 key=hashlib.sha256(source.encode()).hexdigest()
 base=os.path.join(portal_template_path,key)
 reused=False
 if source not in _pl_component_cache:
  if os.path.exists(base+'.json') and os.path.exists(base+'.brep'):
   record=json.load(open(base+'.json'))
   with open(base+'.brep','rb') as handle: file_hash=hashlib.sha256(handle.read()).hexdigest()
   if record.get('sourceHash')==key and record.get('fileHash')==file_hash:
    cached=Part.Shape();cached.read(base+'.brep')
    with open(base+'.brep','rb') as handle: after_hash=hashlib.sha256(handle.read()).hexdigest()
    if after_hash==file_hash:
     _pl_component_cache[source]=(cached,record['metadata'],record['labels']);reused=True
  if source not in _pl_component_cache:
   _original_component_builder(source)
   cached,metadata,labels=_pl_component_cache[source]
   temporary=base+'.'+str(os.getpid())+'.tmp'
   cached.exportBrep(temporary+'.brep')
   with open(temporary+'.brep','rb') as handle: file_hash=hashlib.sha256(handle.read()).hexdigest()
   with open(temporary+'.json','w') as handle: json.dump({'sourceHash':key,'fileHash':file_hash,'metadata':metadata,'labels':labels},handle)
   os.replace(temporary+'.brep',base+'.brep');os.replace(temporary+'.json',base+'.json')
  portal_template_records.append({'sourceHash':key,'reusedExactConstructor':reused})
 return _original_component_builder(source)
`;
  return { geometry: geometry.replace(marker, '\n' + persistence + marker), runtimeSignature };
}
const portalId = (id: string) =>
  /^(portal-post-|gantry-foot-|gantry-drive-link-|drive-link-foot-|tiebar-link-|tiebar-end-insert-|tiebar-insert-|beam-side--1-|beam-insert--1-)/.test(
    id,
  ) ||
  ['lower-moving-tiebar', 'gantry-box-beam', 'x-drive-end-plate', 'beam-end-insert--1'].includes(
    id,
  );

test('short boxed posts have complete real seats while the source axis and head datums remain unchanged', () => {
  for (const spindle of [
    'jst-1500-water-65',
    'jst-2200-water-80',
    'jst-2200-air-80',
    'jst-3000-water-100',
    'zhj-3000-air-100',
  ])
    for (const tableHeight of [700, 800, 950]) {
      const p = { ...mill.defaults, spindle, tableHeight },
        v = millingLayout(p),
        all = millingComponents(p);
      assert.deepEqual([v.workX, v.workY, v.workZ], [800, 1500, 200]);
      assert.equal(v.portalPostHeight, 214);
      assert.deepEqual([v.xPlateBack, v.zPlateBack, v.zScrewX, v.zScrewY], [125, 175, 0, 178]);
      assert.ok(!all.some((piece) => /^gantry-side-/.test(piece.component.id)));
      assert.ok(!all.some((piece) => piece.component.id === 'beam-end-insert-1'));
      for (const side of [-1, 1]) {
        const get = (id: string) => all.find((piece) => piece.component.id === id)!.component;
        const foot = get('gantry-foot-' + side),
          post = get('portal-post-' + side),
          lower = get(`portal-post-${side}-lower-cap`),
          upper = get(`portal-post-${side}-upper-cap`),
          link = get('gantry-drive-link-' + side);
        for (const part of [foot, post, lower, upper, link])
          assert.deepEqual(frame.validate(part.parameters, 'default'), [], part.id);
        close(
          foot.placement.translation[2] + 15,
          lower.placement.translation[2] - v.portalCapThickness / 2,
        );
        close(
          lower.placement.translation[2] + v.portalCapThickness / 2,
          post.placement.translation[2] - v.portalPostHeight / 2,
        );
        close(
          post.placement.translation[2] + v.portalPostHeight / 2,
          upper.placement.translation[2] - v.portalCapThickness / 2,
        );
        close(upper.placement.translation[2] + v.portalCapThickness / 2, v.beamCenter - 100);
        close(
          link.placement.translation[2] + Number(link.parameters.sizeZ) / 2,
          v.gantryFootBottom,
        );
        assert.equal(link.parameters.role, 'gantry-drive-link');
        assert.deepEqual(
          [
            link.parameters.sizeX,
            link.parameters.sizeY,
            link.parameters.ribDepth,
            link.parameters.rearWebHeight,
          ],
          [20, 400, 100, 50],
        );
        assert.ok(
          frameManufacturing(link.parameters).requirements.some((line) =>
            line.includes('ONE plate'),
          ),
        );
        for (const port of holes(post.parameters)) {
          assert.equal(port.diameter, 32);
          close(post.placement.translation[2] + port.at[2], v.portalPostTop - 40);
          close(v.portalPostTop - (post.placement.translation[2] + port.at[2] + 16), 24);
        }
      }
      const end = all.find((piece) => piece.component.id === 'x-drive-end-plate')!.component;
      assert.deepEqual(
        [end.parameters.sizeX, end.parameters.sizeY, end.parameters.sizeZ],
        [40, 400, 200],
      );
      assert.deepEqual(end.placement.translation, [-707.5, 0, tableHeight + 400]);
    }
});

test('portal fasteners have authored bearing seats, positive engagement and blind-floor reserve', () => {
  const all = millingComponents(mill.defaults),
    v = millingLayout(mill.defaults);
  const tie = all.filter(
    (piece) =>
      /^portal-post-.*-tie-/.test(piece.component.id) &&
      piece.component.libraryId === threadedRod.id,
  );
  assert.equal(tie.length, 8);
  for (const { component: c } of tie) {
    assert.equal(c.libraryId, threadedRod.id);
    assert.equal(c.parameters.diameter, 10);
    assert.equal(c.parameters.pitch, 1.5);
    const footId = c.placement.translation[0] < 0 ? 'gantry-foot--1' : 'gantry-foot-1';
    const foot = all.find((one) => one.component.id === footId)!.component;
    const local = c.placement.translation.map((n, i) => n - foot.placement.translation[i]);
    const tap = holes(foot.parameters).find(
      (h) =>
        h.axis === 'z' &&
        Math.abs(h.at[0] - local[0]) < 1e-8 &&
        Math.abs(h.at[1] - local[1]) < 1e-8 &&
        h.depth === 26,
    )!;
    assert.deepEqual([tap.diameter, tap.threadPitch, tap.threadDesignation], [10, 1.5, 'M10']);
    assert.equal(c.parameters.length, 287.2);
    const actual = fastenerValues(threadedRodFastenerParameters(c.parameters), true);
    assert.equal(actual.threaded, true);
    assert.equal(actual.start, 0);
    assert.equal(actual.threadLength, 287.2);
    assert.equal(actual.end, 287.2);
    assert.equal(actual.shaftLength, 287.2);
    const rodTop = c.placement.translation[2] + 287.2 / 2,
      tip = c.placement.translation[2] - 287.2 / 2;
    close(v.gantryFootTop - tip, 24.1);
    close(tip - (v.gantryFootTop - 26), 1.9);
    close(v.beamCenter - 100 - rodTop, 0.9);
    assert.equal(c.presetId, undefined, 'A cut rod is not the purchased1000 mm stock SKU.');
    assert.equal(c.supply, 'manufactured');
    assert.equal(
      c.procurement,
      undefined,
      'Raw-stock ordering belongs to the manufacturing route, not a false finished supplier item.',
    );
    assert.ok(c.manufacturing?.blank.includes('Three published M10 x 1000'));
    assert.ok(c.manufacturing?.requirements.some((line) => line.includes('kl-pr-8-8-m10h1000')));
    assert.ok(
      c.manufacturing?.requirements.some((line) => line.includes('not a287.2 mm supplier SKU')),
    );
    const nut = all.find((piece) => piece.component.id === c.id + '-nut')!.component;
    assert.equal(nut.libraryId, hexNut.id);
    assert.equal(nut.parameters.threadAllowance, 0.05);
    assert.deepEqual(hexNut.validate(nut.parameters, nut.state), []);
    close(rodTop - (nut.placement.translation[2] + Number(nut.parameters.height)), 2.8);
    close(nut.placement.translation[2], v.beamCenter - 100 - 13.7 + 2);
    assert.ok(nut.procurement?.source.includes('kl-pr-8-0'));
  }
  for (const { component: c } of all.filter(
    (piece) =>
      /^portal-post-.*-beam-/.test(piece.component.id) && !piece.component.id.endsWith('-washer'),
  )) {
    assert.equal(c.parameters.length, 35);
    const seat = c.placement.translation[2] - (35 - 8) / 2,
      tip = seat + 35;
    close(tip - (v.beamCenter - 100), 8.4);
    close(v.beamWall - 8.4, 4.1);
  }
  for (const { component: c } of all.filter(
    (piece) =>
      /^drive-link-foot-/.test(piece.component.id) && !piece.component.id.endsWith('-washer'),
  )) {
    assert.equal(c.parameters.length, 75);
    const seat = c.placement.translation[2] - (75 - 8) / 2,
      tip = seat + 75;
    close(tip - v.gantryFootBottom, 23.4);
    close(v.gantryFootBottom + 26 - tip, 2.6);
    assert.equal(Math.abs(c.placement.translation[1]), 190);
  }
});

test('portal relief preserves all primary steel sections and source mounting datums', () => {
  const all = millingComponents(mill.defaults),
    v = millingLayout(mill.defaults);
  for (const side of [-1, 1]) {
    const foot = all.find((p) => p.component.id === 'gantry-foot-' + side)!.component;
    assert.deepEqual(
      [foot.parameters.sizeX, foot.parameters.sizeY, foot.parameters.sizeZ],
      [160, 500, 30],
    );
    close(Math.abs(foot.placement.translation[0]) + 80, 727.5);
    const post = all.find((p) => p.component.id === 'portal-post-' + side)!.component;
    assert.deepEqual(
      [
        post.parameters.sizeX,
        post.parameters.sizeY,
        post.parameters.wall,
        post.parameters.cornerRadius,
      ],
      [100, 300, 8, 20],
    );
    assert.equal(post.parameters.material, 'steel');
  }
  for (const [id, centreY, length] of [
    ['beam-end-insert--1', 0, 120],
    ['x-drive-end-plate', 140, 150],
  ] as const) {
    const c = all.find((p) => p.component.id === id)!.component;
    assert.deepEqual(frame.validate(c.parameters, c.state), []);
    const slot = holes(c.parameters).find((h) => h.slotLength === length)!;
    assert.deepEqual(
      [slot.axis, slot.at[1], slot.at[2], slot.diameter, slot.slotAxis],
      ['x', centreY, 0, 60, 'z'],
    );
    assert.equal(slot.depth, 40.2);
  }
  close(v.footPlateCenterX, 647.5);
});

test('exploded inspection keeps each physical subassembly and its mounting fasteners together', () => {
  const installed = millingPieces(mill.defaults, 'assembled'),
    exploded = millingPieces(mill.defaults, 'exploded');
  for (const motion of ['fixed', 'gantry', 'x', 'z']) {
    const shifts = installed.flatMap((piece, i) =>
      piece.motion === motion && (motion !== 'fixed' || piece.section === 'bed')
        ? [exploded[i].position!.map((n, j) => n - piece.position![j])]
        : [],
    );
    assert.ok(shifts.length > 1);
    for (const shift of shifts) assert.deepEqual(shift, shifts[0]);
  }
});

for (const mode of ['simple', 'full'] as GeometryMode[])
  test(
    `native ${mode} portal has positive seat areas, real key access and clear installed/eight-corner bodies`,
    { skip: !process.env.FREECAD_PYTHON },
    () => {
      const all = millingComponents(mill.defaults),
        v = millingLayout(mill.defaults);
      const selected = all.filter(
        (piece) =>
          portalId(piece.component.id) ||
          (piece.component.libraryId === frame.id && ['x', 'z'].includes(piece.motion)) ||
          /^y-carriage-/.test(piece.component.id) ||
          piece.component.id === 'x-precision-coupling',
      );
      const rows = selected.map((piece) => ({
        ...piece.component,
        motion: piece.motion,
        frame: piece.component.libraryId === frame.id,
      }));
      const geometry = withGeometryMode(mode, () => componentPython(millingLibraries, selected));
      const cached = cachedNativeGeometry(geometry);
      const contacts = [-1, 1]
        .flatMap((side) => [
          [`gantry-foot-${side}`, `portal-post-${side}-lower-cap`, 2, v.gantryFootTop],
          [`portal-post-${side}-lower-cap`, `portal-post-${side}`, 2, v.portalPostBottom],
          [`portal-post-${side}`, `portal-post-${side}-upper-cap`, 2, v.portalPostTop],
          [`portal-post-${side}-upper-cap`, 'gantry-box-beam', 2, v.beamCenter - 100],
          [`gantry-drive-link-${side}`, `gantry-foot-${side}`, 2, v.gantryFootBottom],
        ])
        .concat([['x-drive-end-plate', 'beam-end-insert--1', 0, -687.5]]);
      const source =
        `import FreeCAD as App,Part,math,json,hashlib,sys,os\n${cached.geometry}\n` +
        String.raw`
definitions=json.loads(${JSON.stringify(JSON.stringify(rows))})
mapped={row['id']:shape for row,shape in zip(definitions,components)}
for row in definitions:
 s=mapped[row['id']]
 assert s.isValid() and s.isClosed() and math.isfinite(s.Volume) and s.Volume>0,row['id']
 if row['frame'] or row['libraryId'] in ['threaded-rod','hex-nut','washer']: assert len(s.Solids)==1,row['id']
def intersection(a,b,context=None):
 c=a.common(b); volume=c.Volume
 assert math.isfinite(volume),'nonfinite native common'
 assert abs(volume)<1e-6,(context,volume)
 return volume
def bounds_overlap(a,b):
 A=a.BoundBox;B=b.BoundBox
 return all(getattr(A,n+'Max')>getattr(B,n+'Min')+1e-7 and getattr(B,n+'Max')>getattr(A,n+'Min')+1e-7 for n in 'XYZ')
seats=[]
for a,b,axis,datum in ${JSON.stringify(contacts)}:
 fa=[f for f in mapped[a].Faces if abs(getattr(f.BoundBox,'XYZ'[axis]+'Min')-datum)<1e-6 and abs(getattr(f.BoundBox,'XYZ'[axis]+'Max')-datum)<1e-6]
 fb=[f for f in mapped[b].Faces if abs(getattr(f.BoundBox,'XYZ'[axis]+'Min')-datum)<1e-6 and abs(getattr(f.BoundBox,'XYZ'[axis]+'Max')-datum)<1e-6]
 area=sum(f.common(g).Area for f in fa for g in fb)
 assert math.isfinite(area) and area>100,(a,b,area)
 intersection(mapped[a],mapped[b])
 seats.append({'a':a,'b':b,'nativeFaceContactAreaMm2':area})
clamp_seats=[]
for row in definitions:
 if row['libraryId']!='threaded-rod' or not row['id'].startswith('portal-post-'):continue
 nut=row['id']+'-nut';washer=row['id']+'-washer'
 side=-1 if row['placement']['translation'][0]<0 else 1
 cap='portal-post-'+str(side)+'-upper-cap'
 nutrow=next(r for r in definitions if r['id']==nut)
 z=nutrow['placement']['translation'][2]
 washerrow=next(r for r in definitions if r['id']==washer)
 washerbottom=washerrow['placement']['translation'][2]-washerrow['parameters']['thickness']/2
 for a,b,datum in [(nut,washer,z),(washer,cap,washerbottom)]:
  fa=[f for f in mapped[a].Faces if abs(f.BoundBox.ZMin-datum)<1e-6 and abs(f.BoundBox.ZMax-datum)<1e-6]
  fb=[f for f in mapped[b].Faces if abs(f.BoundBox.ZMin-datum)<1e-6 and abs(f.BoundBox.ZMax-datum)<1e-6]
  area=sum(f.common(g).Area for f in fa for g in fb)
  assert math.isfinite(area) and area>1,(a,b,area)
  intersection(mapped[a],mapped[b],('clamp-seat',a,b))
  clamp_seats.append({'a':a,'b':b,'nativeFaceContactAreaMm2':area})
checks=[]
for i,row in enumerate(definitions):
 for other in definitions[i+1:]:
  if bounds_overlap(mapped[row['id']],mapped[other['id']]):
   checks.append({'a':row['id'],'b':other['id'],'volumeMm3':intersection(mapped[row['id']],mapped[other['id']],(row['id'],other['id']))})
corners=[]
for x in [-400,400]:
 for y in [-750,750]:
  for z in [0,200]:
   placed={}
   for row in definitions:
    s=mapped[row['id']].copy();m=row['motion']
    s.translate(App.Vector(x if m in ['x','z'] else 0,y if m!='fixed' else 0,z-100 if m=='z' else 0));placed[row['id']]=s
   count=0
   for row in definitions:
    if not row['id'].startswith('portal-post-') and not row['id'].startswith('gantry-drive-link-'):continue
    for other in definitions:
     if other['motion'] not in ['x','z']:continue
     if bounds_overlap(placed[row['id']],placed[other['id']]):intersection(placed[row['id']],placed[other['id']],(x,y,z,row['id'],other['id']));count+=1
   corners.append({'x':x,'y':y,'z':z,'candidatePairs':count})
keys=[]
for row in definitions:
 if '-beam-' not in row['id'] or not row['id'].startswith('portal-post-') or row['id'].endswith('-washer'):continue
 # A real six-flat 6 mm key, 7 mm bend radius, 35 mm short leg and 45 mm long leg.
 key_z=(row['parameters']['length']+row['parameters']['headHeight'])/2-row['parameters']['driveDepth']+.2
 points=[App.Vector(3/math.cos(math.pi/6)*math.cos((2*i+1)*math.pi/6),3/math.cos(math.pi/6)*math.sin((2*i+1)*math.pi/6),key_z) for i in range(6)]
 profile=Part.Wire(Part.makePolygon(points+[points[0]]).Edges)
 for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],row['placement']['rotation']):profile.rotate(App.Vector(0,0,0),axis,angle)
 profile.translate(App.Vector(*row['placement']['translation']));start=profile.CenterOfMass
 side=-1 if (abs(start.x)-650)*(-1 if start.x<0 else 1)<0 else 1
 # Nearest column X face determines the outward horizontal leg.
 postCenter=-650 if start.x<0 else 650;side=-1 if start.x<postCenter else 1
 elbowZ=start.z-35;R=7
 a=App.Vector(start.x,start.y,elbowZ+R);center=App.Vector(start.x+side*R,start.y,elbowZ+R)
 mid=App.Vector(center.x-side*R/math.sqrt(2),start.y,center.z-R/math.sqrt(2));b=App.Vector(center.x,start.y,elbowZ)
 end=App.Vector(start.x+side*45,start.y,elbowZ)
 path=Part.Wire([Part.makeLine(start,a),Part.Arc(a,mid,b).toShape(),Part.makeLine(b,end)])
 key=path.makePipeShell([profile],True,False)
 assert key.isValid() and key.isClosed() and key.Volume>0,row['id']
 for other in definitions:
  if other['id'].startswith('portal-post-') or other['id']==row['id']:intersection(key,mapped[other['id']],('hex-key',row['id'],other['id']))
 # A shorter offset approach outside the socket tests passage through the real side aperture.
 entry=key.copy();entry.translate(App.Vector(0,0,-10))
 for other in definitions:
  if other['id'] in ['portal-post--1','portal-post-1']:intersection(entry,mapped[other['id']])
 keys.append({'bolt':row['id'],'acrossFlatsMm':6,'shortLegMm':35,'longLegMm':45,'bendRadiusMm':7,'volumeMm3':key.Volume})
sockets=[]
for row in definitions:
 if row['libraryId']!='hex-nut' or not row['id'].startswith('portal-post-'):continue
 x,y,z=row['placement']['translation']
 # Published Wera05003562001 exterior: frontD23.5x12, rearD24, overall30.
 # The17.1AF access profile is authored working clearance; actual tool/preload remains a release check.
 points=[App.Vector(17.1/math.sqrt(3)*math.cos((i+.5)*math.pi/3),17.1/math.sqrt(3)*math.sin((i+.5)*math.pi/3),0) for i in range(6)]
 opening=Part.Face(Part.Wire(Part.makePolygon(points+[points[0]]).Edges)).extrude(App.Vector(0,0,12.1))
 socket=Part.makeCylinder(11.75,12).fuse(Part.makeCylinder(12,18,App.Vector(0,0,12))).cut(opening)
 for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],row['placement']['rotation']):socket.rotate(App.Vector(0,0,0),axis,angle)
 socket.translate(App.Vector(x,y,z+.05))
 assert socket.isValid() and socket.isClosed() and socket.Volume>0,row['id']
 for approach in [0,10,30]:
  tool=socket.copy();tool.translate(App.Vector(0,0,approach))
  for other in definitions:
   # The upper beam is intentionally not installed until tie preload and tip-gap dry-fit complete.
   if other['id'].startswith('portal-post-') or other['id'].startswith('gantry-foot-'):
    if bounds_overlap(tool,mapped[other['id']]):intersection(tool,mapped[other['id']],('pre-beam-socket',row['id'],approach,other['id']))
 sockets.append({'nut':row['id'],'publishedTool':'Wera05003562001','sourceUrl':'https://www.wera.de/en/tools/8790-hmb-zyklop-socket-with-3-8-drive/','frontDiameterMm':23.5,'rearDiameterMm':24,'recessDiameterMm':25,'minimumRadialClearanceMm':.5,'assemblySequence':'Preload before beam installation; actual socket internal geometry and required torque remain release checks.','testedApproachMm':[0,10,30]})
mass=[]
for row in definitions:
 if row['frame'] and row['motion']=='gantry' and (${JSON.stringify(selected.filter((piece) => portalId(piece.component.id) && piece.component.libraryId === frame.id).map((piece) => piece.component.id))}).count(row['id']):
  density=7850 if row['parameters']['material']=='steel' else 2700
  mass.append({'id':row['id'],'sourceParameters':row['parameters'],'volumeMm3':mapped[row['id']].Volume,'densityKgPerM3':density,'estimatedMassKg':mapped[row['id']].Volume*density/1e9})
report={'passed':True,'mode':${JSON.stringify(mode)},'componentCount':len(definitions),'installedChecks':checks,'positiveFaceContacts':seats,'positiveTieClampContacts':clamp_seats,'eightCorners':corners,'actualHexKeys':keys,'tieNutSocketAccess':sockets,'manufacturedMassRows':mass,'freecadVersion':App.Version(),'sourceHash':hashlib.sha256(open(__file__,'rb').read()).hexdigest(),'geometryHash':${JSON.stringify(createHash('sha256').update(geometry).digest('hex'))},'runtimeSignature':portal_runtime_signature,'exactConstructorTemplates':portal_template_records,'templateCacheMethod':'exact-source-and-runtime-constructor-brep-v1'}
open(${JSON.stringify(nativeDir + '/' + mode + '-native.json')},'w').write(json.dumps(report,indent=2,allow_nan=False))
print(json.dumps({'passed':True,'mode':report['mode'],'components':len(definitions),'pairs':len(checks),'seats':len(seats),'keys':len(keys)},allow_nan=False))
`;
      mkdirSync(nativeDir, { recursive: true });
      const path = nativeDir + '/' + mode + '-native.py';
      writeFileSync(path, source);
      const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
        encoding: 'utf8',
        env: process.env,
        timeout: 600000,
      });
      assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
      const proof = JSON.parse(readFileSync(nativeDir + '/' + mode + '-native.json', 'utf8'));
      assert.equal(proof.positiveFaceContacts.length, 11);
      assert.equal(proof.positiveTieClampContacts.length, 16);
      assert.equal(proof.actualHexKeys.length, 8);
      assert.equal(proof.tieNutSocketAccess.length, 8);
      assert.equal(proof.eightCorners.length, 8);
      assert.equal(proof.sourceHash, createHash('sha256').update(source).digest('hex'));
    },
  );

test(
  'native post access ports retain a positive measured net section and the X coupling clears all corners',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const all = millingComponents(mill.defaults),
      v = millingLayout(mill.defaults);
    const selected = all.filter((piece) =>
      ['portal-post--1', 'portal-post-1', 'x-precision-coupling'].includes(piece.component.id),
    );
    assert.equal(selected.length, 3);
    const geometry = withGeometryMode('simple', () => componentPython(millingLibraries, selected));
    const source =
      `import FreeCAD as App,Part,math,json,hashlib\n${geometry}\n` +
      String.raw`
mapped=dict(zip(${JSON.stringify(selected.map((piece) => piece.component.id))},components))
sections=[];corners=[]
for side in [-1,1]:
 post=mapped['portal-post-'+str(side)]
 assert post.isValid() and post.isClosed() and len(post.Solids)==1
 # Both authored circular access ports reach their widest chord at this exact height.
 z=${v.portalPostTop - 40};thickness=.01
 slice=post.common(Part.makeBox(200,400,thickness,App.Vector(side*650-100,${v.portalPostCenterY}-200,z-thickness/2)))
 assert slice.isValid() and slice.isClosed() and slice.Volume>0
 area=slice.Volume/thickness
 assert math.isfinite(area) and 4899<area<4902,area
 sections.append({'post':'portal-post-'+str(side),'portCentreZ':z,'nativeSliceThicknessMm':thickness,'nativeNetAreaMm2':area,'status':'Current two-port minimum-area location; not an as-machined inertia or joint stiffness qualification.'})
for x in [-400,400]:
 for y in [-750,750]:
  for z in [0,200]:
   coupling=mapped['x-precision-coupling'].copy();coupling.translate(App.Vector(0,y,0))
   for side in [-1,1]:
    post=mapped['portal-post-'+str(side)].copy();post.translate(App.Vector(0,y,0))
    c=coupling.common(post);distance=coupling.distToShape(post)[0]
    assert math.isfinite(c.Volume) and abs(c.Volume)<1e-6 and math.isfinite(distance) and distance>0
    corners.append({'x':x,'y':y,'z':z,'post':'portal-post-'+str(side),'commonVolumeMm3':c.Volume,'distanceMm':distance})
report={'passed':True,'actualSourceModes':['simple'],'netSections':sections,'eightCornerCouplingPairs':corners,'sourceHash':hashlib.sha256(open(__file__,'rb').read()).hexdigest(),'geometryHash':${JSON.stringify(createHash('sha256').update(geometry).digest('hex'))},'freecadVersion':App.Version()}
open(${JSON.stringify(nativeDir + '/net-section-coupling-native.json')},'w').write(json.dumps(report,indent=2,allow_nan=False))
`;
    mkdirSync(nativeDir, { recursive: true });
    const path = nativeDir + '/net-section-coupling-native.py';
    writeFileSync(path, source);
    const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 120000,
    });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    const proof = JSON.parse(readFileSync(nativeDir + '/net-section-coupling-native.json', 'utf8'));
    assert.equal(proof.netSections.length, 2);
    assert.equal(proof.eightCornerCouplingPairs.length, 16);
  },
);
