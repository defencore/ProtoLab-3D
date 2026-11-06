"""Check changed motor/frame interfaces against emitted native installation solids.

Only the supplier's simplified M2 tap-drill/thread engagements are exempted,
and only inside their two-millimetre blind engagement regions. Existing linkage
geometry is separately asserted identical to the approved mechanism by TS tests.
"""
import hashlib,importlib.util,json,math,sys,time
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
OUT=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/faulhaber-twin-pin')
DATA=json.loads((OUT/'capture.json').read_text());START=time.monotonic()
R={'passed':False,'captureSha256':hashlib.sha256((OUT/'capture.json').read_bytes()).hexdigest(),'poses':[],'cases':[],'laser':[]}
def save(stage):
 R['elapsedSeconds']=time.monotonic()-START;(OUT/'native-report.json').write_text(json.dumps(R,indent=2));print(stage,flush=True)
def execute(source):
 scope={'App':App,'Part':Part,'math':math};exec(source,scope);return scope
def groups(scope):
 result={}
 for s,m in zip(scope['components'],scope['component_metadata']):result.setdefault(m['AssemblyOccurrenceId'],[]).append(s)
 return {key:Part.makeCompound(items) for key,items in result.items()}
def common(a,b):
 aa,bb=a.BoundBox,b.BoundBox
 if any(min(getattr(aa,k+'Max'),getattr(bb,k+'Max'))-max(getattr(aa,k+'Min'),getattr(bb,k+'Min'))<1e-8 for k in 'XYZ'):return None
 return a.common(b)
def overlap(a,b):
 c=common(a,b);return abs(c.Volume) if c else 0
def valid(s):return not s.isNull() and s.isValid() and s.isClosed() and len(s.Solids)>0 and s.Volume>0
try:
 for row in DATA['locals']:
  scope=execute(row['source']);g=groups(scope);assert all(valid(s) for s in g.values())
  changed=set(row['changed']);count=0;mates=[]
  for identity in changed:
   for other,s in g.items():
    if identity==other or other in changed and other<identity:continue
    c=common(g[identity],s);v=abs(c.Volume) if c else 0;count+=1
    if v<1e-7:continue
    motor,bolt=(identity,other) if identity.endswith('-motor') else (other,identity)
    assert motor.endswith('-motor') and bolt.startswith(motor[:-5]+'motor-mount-M2-'),('unexpected overlap',row['angle'],identity,other,v)
    bb=g[bolt].BoundBox;y=(bb.YMin+bb.YMax)/2;z=(bb.ZMin+bb.ZMax)/2
    region=Part.makeCylinder(1.01,2.02,App.Vector(-53.01,y,z),App.Vector(1,0,0))
    outside=abs(c.cut(region).Volume)
    assert outside<1e-7,('overlap outside intended blind threads',motor,bolt,outside)
    mates.append({'motor':motor,'bolt':bolt,'simplifiedThreadOverlapMm3':v})
  assert len(mates)==8,('expected eight supplier tap-drill engagements',len(mates))
  motors=[g[x+'-motor'] for x in 'abcd'];gap=min(motors[i].distToShape(motors[j])[0] for i in range(4) for j in range(i))
  assert gap>.45,('adjacent motors',gap)
  probe=Part.makeCylinder(2.45,150,App.Vector(-120,0,0),App.Vector(1,0,0))
  for identity,s in g.items():assert overlap(probe,s)<1e-7,('centre passage',identity)
  R['poses'].append({'angle':row['angle'],'pairs':count,'minimumMotorGapMm':gap,'threadMates':mates,'centralPassageClear':True});save('pose '+str(row['angle']))
 spec=importlib.util.spec_from_file_location('contours',Path(__file__).with_name('verify-tr8-cnc-fabrication.py'))
 reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
 for pattern in ['lightened','solid']:
  folder=OUT/pattern
  for dxf in folder.glob('*.dxf'):
   a,ac,_=reader.dxf_read(dxf);b,bc,_=reader.svg_read(dxf.with_suffix('.svg'))
   assert ac==bc and reader.difference(a.extrude(App.Vector(0,0,1)),b.extrude(App.Vector(0,0,1)))<1e-6
   R['laser'].append(str(dxf))
  scope=execute(next(folder.glob('*laser-blanks.FCMacro')).read_text());doc=scope['doc'];shapes=[o.Shape for o in doc.Objects if hasattr(o,'Shape')]
  assert len(shapes)==15 and all(valid(s) and len(s.Solids)==1 for s in shapes)
  manifest=json.loads(next(folder.glob('*cut-manifest.json')).read_text());cursor=0
  for profile in manifest['profiles']:
   dxf=next(folder.glob('*-'+profile['id']+'.dxf'));face,_,_=reader.dxf_read(dxf)
   expected=face.extrude(App.Vector(0,0,profile['thickness']))
   for _ in range(profile['quantity']):
    actual=shapes[cursor].copy();cursor+=1;actual.translate(App.Vector(-70*cursor,0,0))
    assert reader.difference(actual,expected)<1e-5,('native/laser mismatch',pattern,profile['id'])
  App.closeDocument(doc.Name)
 save('laser')
 for case in DATA['cases']:
  doc=App.newDocument('FaulhaberAudit');sentinel=doc.addObject('Part::Feature','Sentinel');sentinel.Shape=Part.makeBox(1,1,1)
  before=set(o.Name for o in doc.Objects);execute(Path(case['path']).read_text())
  objects=[o for o in doc.Objects if o.Name not in before and hasattr(o,'AssemblyOccurrenceId')]
  assert objects and all(valid(o.Shape) for o in objects)
  ids={o.AssemblyOccurrenceId for o in objects};assert len(ids)==case['expected']
  motors=[o for o in objects if o.LibraryId=='faulhaber-bx4'];assert len(motors)==4
  for o in motors:
   assert json.loads(o.ConfigurationJSON)=={'model':'2250S024BX4-6855'}
   assert '2250S024BX4 6855' in o.Label and '2250S024BX4 6855' in o.ProductName
  assert len({o.AssemblyOccurrenceId for o in objects if o.LibraryId=='flanged-ball-bearing'})==16
  assert not any(o.LibraryId=='gmp16-gearmotor' for o in objects)
  if case['mode']=='full':
   g={identity:Part.makeCompound([o.Shape for o in objects if o.AssemblyOccurrenceId==identity]) for identity in ids}
   for i in range(1,5):
    bolt=g['frame-front-bolt-'+str(i)];column=g['frame-column-'+str(i)+'-1']
    residual=overlap(bolt,column)
    # OCC leaves micrometre-scale volume residue on coincident helical faces.
    # Bound this only for these exact M3 mates, with a deliberately wrong phase
    # as a positive control; all installation interference checks retain1e-7.
    bb=bolt.BoundBox;wrong=bolt.copy()
    wrong.rotate(App.Vector(0,(bb.YMin+bb.YMax)/2,(bb.ZMin+bb.ZMax)/2),App.Vector(1,0,0),30)
    wrong_volume=overlap(wrong,column)
    assert residual<1e-5 and wrong_volume>max(.001,1000*residual),('full thread phase',i,residual,wrong_volume)
    R.setdefault('fullThreadMates',[]).append({'column':i,'residualMm3':residual,'wrongPhaseOverlapMm3':wrong_volume})
  bb=Part.makeCompound([o.Shape for o in objects]).BoundBox
  assert abs(bb.XLength-126.8)<1e-5 and abs(bb.YLength-56)<1e-5 and abs(bb.ZLength-56)<1e-5,(bb.XLength,bb.YLength,bb.ZLength)
  assert abs(sentinel.Shape.Volume-1)<1e-9
  R['cases'].append({'pattern':case['pattern'],'mode':case['mode'],'validNativeChildren':len(objects),'occurrences':len(ids),'motors':len(motors),'bounds':[bb.XLength,bb.YLength,bb.ZLength]})
  App.closeDocument(doc.Name);save('macro '+case['pattern']+' '+case['mode'])
 prior=json.loads((OUT/'preserved-source-sha256.json').read_text())
 assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in prior.items()),'An earlier mechanism source changed'
 R['earlierMechanismsUnchanged']=True;R['passed']=True;save('passed')
except BaseException as error:
 R['error']=str(error);save('FAILED');raise
