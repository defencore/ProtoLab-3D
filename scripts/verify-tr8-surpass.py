"""Native motor/frame/packing checks and independent fabrication reconstruction."""
import hashlib,importlib.util,json,math,sys,time
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
OUT=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/surpass-twin-pin')
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
def overlap(a,b):
 aa,bb=a.BoundBox,b.BoundBox
 if any(min(getattr(aa,k+'Max'),getattr(bb,k+'Max'))-max(getattr(aa,k+'Min'),getattr(bb,k+'Min'))<1e-8 for k in 'XYZ'):return 0.
 return abs(a.common(b).Volume)
def valid(s):return not s.isNull() and s.isValid() and s.isClosed() and len(s.Solids)>0 and s.Volume>0
try:
 for row in DATA['poses']:
  scope=execute(row['source']);g=groups(scope);assert len(g)==115 and all(valid(s) for s in g.values())
  count=0
  for i,(identity,shape) in enumerate(g.items()):
   for other,s in list(g.items())[:i]:
    # Unchanged joints within one channel retain the prior native proof and
    # are asserted identical by TS tests. Check all inter-channel interfaces,
    # all frame interfaces, and each new motor/coupling/mount in its channel.
    local=identity[:2]==other[:2] and identity[:2] in ['a-','b-','c-','d-']
    changed=lambda name:name[2:].startswith('motor') or name[2:]=='coupling'
    if local and not(changed(identity) or changed(other)):continue
    v=overlap(shape,s);assert v<1e-7,('interference',row['angle'],identity,other,v);count+=1
  motors=[g[x+'-motor'] for x in 'abcd'];gap=min(motors[i].distToShape(motors[j])[0] for i in range(4) for j in range(i))
  assert gap>.99,('adjacent motors',gap)
  probe=Part.makeCylinder(2.45,140,App.Vector(-115,0,0),App.Vector(1,0,0))
  for identity,s in g.items():assert overlap(probe,s)<1e-7,('centre passage',identity)
  R['poses'].append({'angle':row['angle'],'pairs':count,'minimumMotorGapMm':gap,'centralPassageClear':True});save('pose '+str(row['angle']))
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
   dxf=next(folder.glob('*-'+profile['id']+'.dxf'));face,_,_=reader.dxf_read(dxf);expected=face.extrude(App.Vector(0,0,profile['thickness']))
   for _ in range(profile['quantity']):
    actual=shapes[cursor].copy();cursor+=1;actual.translate(App.Vector(-DATA['blankPitch']*cursor,0,0))
    assert reader.difference(actual,expected)<1e-5,('native/laser mismatch',pattern,profile['id'])
  App.closeDocument(doc.Name)
 save('laser')
 cases=DATA['cases']+[{'pattern':'lightened','mode':'full-neutral','path':str(OUT/'TR8-SURPASS-2845-70.FCMacro'),'expected':115}]
 for case in cases:
  doc=App.newDocument('SurpassAudit');sentinel=doc.addObject('Part::Feature','Sentinel');sentinel.Shape=Part.makeBox(1,1,1)
  before=set(o.Name for o in doc.Objects);execute(Path(case['path']).read_text())
  objects=[o for o in doc.Objects if o.Name not in before and hasattr(o,'AssemblyOccurrenceId')]
  assert objects and all(valid(o.Shape) for o in objects)
  ids={o.AssemblyOccurrenceId for o in objects};assert len(ids)==case['expected']
  motors=[o for o in objects if o.LibraryId=='surpass-2845'];assert len({o.AssemblyOccurrenceId for o in motors})==4
  for o in motors:
   assert json.loads(o.ConfigurationJSON)=={'model':'surpass-2845-3100kv'}
   assert '2845' in o.Label and '3100KV' in o.ProductName
  assert len({o.AssemblyOccurrenceId for o in objects if o.LibraryId=='flanged-ball-bearing'})==16
  assert not any(o.LibraryId in ['gmp16-gearmotor','faulhaber-bx4'] for o in objects)
  bb=Part.makeCompound([o.Shape for o in objects]).BoundBox
  assert abs(bb.XLength-119)<1e-5 and abs(bb.YLength-70)<1e-5 and abs(bb.ZLength-70)<1e-5,(bb.XLength,bb.YLength,bb.ZLength)
  assert abs(sentinel.Shape.Volume-1)<1e-9
  R['cases'].append({'pattern':case['pattern'],'mode':case['mode'],'validNativeChildren':len(objects),'occurrences':len(ids),'motorOccurrences':4,'bounds':[bb.XLength,bb.YLength,bb.ZLength],
    'macroSha256':hashlib.sha256(Path(case['path']).read_bytes()).hexdigest()})
  App.closeDocument(doc.Name);save('macro '+case['pattern']+' '+case['mode'])
 prior=json.loads((OUT/'preserved-source-sha256.json').read_text())
 assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in prior.items()),'An earlier mechanism source changed'
 R['earlierMechanismsUnchanged']=True;R['passed']=True;save('passed')
except BaseException as error:
 R['error']=str(error);save('FAILED');raise
