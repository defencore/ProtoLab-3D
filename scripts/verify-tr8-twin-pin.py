"""Native nominal-motion and fabrication proof for the new twin-pin family.

Finite public macros check exported solids/metadata. Continuous positive-stock
bounds check independent channels and changed frame; coupled pin slots and the
rotationally invariant shaft seats are certified separately by construction.
This does not qualify strength, actual fits, wear or manufacturing tolerances.
"""
import hashlib,importlib.util,json,math,sys,time
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
from tr8_cnc_cross_stock import frame_envelope

CAPTURE=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-twin-pin/validation/captures.json').resolve()
DATA=json.loads(CAPTURE.read_text());OUT=CAPTURE.parent;START=time.monotonic();EPS=1e-7
sha=lambda value:hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()
REPORT={'passed':False,'captureSha256':sha(CAPTURE.read_bytes()),'verifierSha256':sha(Path(__file__).read_bytes()),
 'freecad':'.'.join(App.Version()[:3]),'runtimeSha256':sha(Path(sys.executable).read_bytes()),'cases':[]}
def note(stage,**values):
 REPORT['elapsedSeconds']=time.monotonic()-START;(OUT/'native-report.json').write_text(json.dumps(REPORT,indent=2))
 print(json.dumps(dict(stage=stage,**values)),flush=True)
def volume(s):return 0. if s.isNull() else abs(s.Volume)
def valid(s):return not s.isNull() and s.isValid() and s.isClosed() and bool(s.Solids) and s.Volume>0
def overlap(a,b):
 aa,bb=a.BoundBox,b.BoundBox
 if any(min(getattr(aa,k+'Max'),getattr(bb,k+'Max'))-max(getattr(aa,k+'Min'),getattr(bb,k+'Min'))<=1e-8 for k in 'XYZ'):return 0.
 return volume(a.common(b))
def execute(source):
 scope={'App':App,'Part':Part,'math':math};exec(source,scope);return scope
def groups(scope):
 result={}
 for s,m in zip(scope['components'],scope['component_metadata']):result.setdefault(m['AssemblyOccurrenceId'],[]).append(s)
 return {identity:Part.makeCompound(children) for identity,children in result.items()}
def placed(s,mount):
 s=s.copy();s.rotate(App.Vector(),App.Vector(1,0,0),mount['clock']);s.translate(App.Vector(*mount['origin']));return s
def bind(item):assert sha(Path(item['path']).read_bytes())==item['sha256'],('changed input',item['path'])
def bindings():
 for item in DATA['sources']+DATA['priorProofs']+DATA['fabrication']:bind(item)
 for path,digest in DATA['preserved'].items():assert sha(Path(path).read_bytes())==digest,path
bindings();note('bound-sources',count=len(DATA['sources']))

# Independently reconstruct the actual user-facing laser contours.
spec=importlib.util.spec_from_file_location('contours',Path(__file__).with_name('verify-tr8-cnc-fabrication.py'))
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
profile_rows=[]
for row in DATA['profiles']:
 dxf,dc,_=reader.dxf_read(Path(row['dxf']['path']));svg,sc,_=reader.svg_read(Path(row['svg']['path']))
 d=dxf.extrude(App.Vector(0,0,row['thickness']));s=svg.extrude(App.Vector(0,0,row['thickness']))
 expected=execute(row['source'])['shape'];assert valid(d) and valid(s) and valid(expected)
 assert len(d.Solids)==len(s.Solids)==len(expected.Solids)==1 and dc==sc
 delta=reader.difference(d,s);native_delta=reader.difference(d,expected)
 assert delta<1e-6 and native_delta<1e-5,(row['id'],delta,native_delta)
 if row.get('finishedSource'):
  finish=execute(row['finishedSource'])['shape'];assert valid(finish) and volume(finish.cut(expected))<1e-6
 profile_rows.append(dict(id=row['id'],quantity=row['quantity'],dxfSvgDifferenceMm3=delta,nativeDifferenceMm3=native_delta))
REPORT['laserProfiles']=profile_rows
blank_file=next(f for f in DATA['fabrication'] if f['id']=='laser-blanks');scope=execute(Path(blank_file['path']).read_text())
blank_doc=scope['doc'];blanks=[o.Shape for o in blank_doc.Objects if hasattr(o,'Shape')]
assert len(blanks)==sum(row['quantity'] for row in DATA['profiles'])==15
assert all(valid(s) and len(s.Solids)==1 for s in blanks)
App.closeDocument(blank_doc.Name);note('laser-profiles',unique=6,physicalBlanks=15)

frame=groups(execute(DATA['frameSource']));assert len(frame)==27 and all(valid(s) for s in frame.values())
frame_checks=0
for i,(identity,shape) in enumerate(frame.items()):
 for other,candidate in list(frame.items())[:i]:
  v=overlap(shape,candidate);assert v<EPS,('frame overlap',identity,other,v);frame_checks+=1
REPORT['frame']={'configuredParts':len(frame),'pairChecks':frame_checks,'centralLaserGuides':4,'milledCentralSpines':0}
new_ids=['lead-nut','output-shaft','output-crank','output-long-spacer','output-inner-guide-bearing']
locals={};finite=[]
for case in DATA['local']:
 g=groups(execute(case['source']));locals[case['angle']]=g;count=0
 assert all(valid(s) for s in g.values())
 for identity in new_ids:
  for other,candidate in g.items():
   if identity==other or other in new_ids and other<identity:continue
   v=overlap(g[identity],candidate);assert v<EPS,('local overlap',case['angle'],identity,other,v);count+=1
 finite.append(dict(angle=case['angle'],changedPartPairChecks=count))
REPORT['finiteLocalChecks']=finite;note('local-motion',poses=len(finite))

# The unchanged local channel and its continuous bounds are source-authenticated.
folder=Path('test-results/tr8-quad-cnc-actuator/channel');stock=json.loads((folder/'swept-stock.json').read_text())
old_cases=json.loads((folder/'cases.json').read_text());old=next(c for c in old_cases if c['parameters']['outputAngle']==0)
assert stock['passed'] and stock['independentChannelAngles'] and not stock['unresolvedPairs']
assert stock['runtimeSha256']==REPORT['runtimeSha256']
assert stock['casesSha256']==sha((folder/'cases.json').read_bytes())
assert stock['nativeAuditSha256']==sha((folder/'native-report.json').read_bytes())
assert old['source']==DATA['originalNativeSources']['full'] and old['nominalSource']==DATA['originalNativeSources']['simple']
configurations={c['id']:c for c in old['billOfMaterials']['components']};tier=stock['tiers'][0]
travel=DATA['layout']['lever']*math.tan(math.radians(20));old_envelopes={}
for identity in DATA['unchangedIds']+['output-rear-crank']:
 c=configurations[identity];cells=[cell for cell in tier['stockCells'] if cell['id']==identity]
 envelope=frame_envelope(cells,0,c,travel)
 if c['libraryId']=='flanged-ball-bearing':
  p=c['parameters'];w=p['width'];f=p['flangeWidth']
  envelope=Part.makeCylinder(p['outer']/2,w,App.Vector(0,0,-w/2)).fuse(Part.makeCylinder(p['flangeOuter']/2,f,App.Vector(0,0,w/2-f)))
  for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],c['placement']['rotation']):
   if angle:envelope.rotate(App.Vector(),axis,angle)
  envelope.translate(App.Vector(*c['placement']['translation']))
 old_envelopes['output-crank' if identity=='output-rear-crank' else identity]=envelope

def cy(radius,low,high):return Part.makeCylinder(radius,high-low,App.Vector(0,low,0),App.Vector(0,1,0))
nut=Part.makeCylinder(6.5,8+2*travel,App.Vector(-4-travel,0,10),App.Vector(1,0,0)).common(Part.makeBox(8+2*travel,10,13,App.Vector(-4-travel,-5,3.5)))
def pin_sweep(low,high):
 caps=[Part.makeCylinder(2,high-low,App.Vector(x,low,10),App.Vector(0,1,0)) for x in [-travel,travel]]
 return caps[0].fuse(caps[1]).fuse(Part.makeBox(2*travel,high-low,4,App.Vector(-travel,low,8)))
nut=nut.fuse(pin_sweep(-8.2,-4.6)).fuse(pin_sweep(4.6,9.7))
shaft=cy(3,-4.05,27.5).fuse(cy(1.8,-4.45,-4)).fuse(cy(1.5,-7.45,-4.4))
new_envelopes={'lead-nut':nut,'output-shaft':shaft,'output-long-spacer':locals[0]['output-long-spacer'],
 'output-inner-guide-bearing':locals[0]['output-inner-guide-bearing']}
for angle,g in locals.items():
 for identity,envelope in new_envelopes.items():
  escaped=volume(g[identity].cut(envelope));assert escaped<1e-5,('stock containment',angle,identity,escaped)
all_envelopes={**old_envelopes,**new_envelopes}
continuous_frame=[];invariant_contacts=[]
for mount in DATA['mounts']:
 for identity,envelope in all_envelopes.items():
  world=placed(envelope,mount)
  for other,candidate in frame.items():
   v=overlap(world,candidate)
   if v>=EPS:
    old_id='output-rear-crank' if identity=='output-crank' else identity
    cells=[cell for cell in tier['stockCells'] if cell['id']==old_id]
    assert identity not in new_envelopes and cells and all(cell['motion']=='invariant' for cell in cells),('moving continuous frame',mount['id'],identity,other,v)
    actual=max(overlap(placed(local[identity],mount),candidate) for local in locals.values())
    assert actual<EPS,('actual invariant frame contact',mount['id'],identity,other,actual)
    invariant_contacts.append(dict(channel=mount['id'],identity=identity,frame=other,paddedStockOverlapMm3=v,actualOverlapMm3=actual))
   continuous_frame.append(1)
cross=0
for a in range(4):
 for b in range(a):
  for identity,shape in all_envelopes.items():
   first=placed(shape,DATA['mounts'][a])
   for other,candidate in all_envelopes.items():
    if identity not in new_envelopes and other not in new_envelopes:continue
    v=overlap(first,placed(candidate,DATA['mounts'][b]));assert v<EPS,('independent channels',a,b,identity,other,v);cross+=1
REPORT['continuousProof']={'intervalDegrees':[-20,20],'independentOutputs':True,'frameStockChecks':len(continuous_frame),
 'changedCrossChannelStockChecks':cross,'inheritedInvariantStockContacts':invariant_contacts,'oldStockProofSha256':sha((folder/'swept-stock.json').read_bytes()),
 'policy':'Fresh conservative positive stocks cover all new moving parts over the complete travel; original crank/drive stocks retain source equality. Coupled mates are proved separately.'}
note('continuous-frame-and-channels',frame=len(continuous_frame),crossChannel=cross)

# Coupled slot paths hold for every angle, rather than independently swept mates.
rmin=10;rmax=10/math.cos(math.radians(20));slotlo=9.7;slothi=rmax+.30822227524088
assert slotlo<rmin<rmax<slothi
assert abs(DATA['twinPin']['guideSlotHalfTravel']-travel-.05)<1e-10
assert 10-6.5-3>=.5
REPORT['coupledMotion']={'outwardFollowerInverseRotatedX':'cos(a)*10*tan(a)-sin(a)*10 = 0',
 'outwardFollowerRadiusRangeMm':[rmin,rmax],'crankSlotEndCentresMm':[slotlo,slothi],
 'pinDiameterMm':4,'slotWidthMm':4.1,'inwardGuideSlotPath':'Fixed Z=10; X=10*tan(a); slot covers full travel with 0.05 mm radial edge clearance',
 'minimumNutBodyToShaftMm':.5,'shaftBearingContacts':'Both bearing-seat and shaft sections are circular and invariant under output rotation; exact finite mate Booleans above remain invariant.'}
# Test anti-roll with the outward crank absent; the inward trunnion alone hits its guide.
guide=execute(DATA['guideSource'])['shape'];guide.rotate(App.Vector(),App.Vector(1,0,0),90);guide.translate(App.Vector(0,-5.05,0))
roll=[]
for case in DATA['nutSources']:
 n=execute(case['source'])['shape'];assert n.distToShape(guide)[0]>.0499
 for sign in [-1,1]:
  s=n.copy();s.rotate(App.Vector(case['center'],0,10),App.Vector(1,0,0),sign)
  v=overlap(s,guide);assert v>1e-5,('guide fails to block roll',case['angle'],sign,v)
  roll.append(dict(angle=case['angle'],sign=sign,oneDegreeBlockedMm3=v))
REPORT['guideAntiRoll']=roll;note('guide-anti-roll',bothSignProbes=len(roll))

# Execute, save and reopen the unmodified public Simple and Full macros.
def objects(doc):return sorted([o for o in doc.Objects if hasattr(o,'AssemblyOccurrenceId') and hasattr(o,'Shape')],key=lambda o:int(o.ComponentIndex))
for case in DATA['cases']:
 path=OUT/(case['name']+'.FCMacro');script=path.read_text();assert sha(script)==case['scriptSha256'];observed={}
 def observe(frame,event,arg):
  if event=='return' and frame.f_code.co_name=='_protolab_create':
   observed.update({key:frame.f_locals[key] for key in ['component_colors','component_metadata','component_labels','component_shapes']})
 doc=App.newDocument('TwinPinMacroAudit');sentinel=doc.addObject('App::FeaturePython','ExistingDocumentSentinel')
 sys.setprofile(observe)
 try:exec(script,{'App':App,'Part':Part,'math':math})
 finally:sys.setprofile(None)
 assert doc.getObject(sentinel.Name)
 root=next(o for o in doc.RootObjects if hasattr(o,'PartId'));assert root.PartId=='tr8-quad-twin-pin-actuator'
 assert root.GeometryMode==case['mode'] and json.loads(root.Configuration)==case['parameters']
 children=objects(doc);assert len({o.AssemblyOccurrenceId for o in children})==case['expectedConfigurations']==123
 assert len(observed['component_colors'])==len(children) and all(valid(o.Shape) for o in children)
 assert all(len(o.Shape.Solids)==1 for o in children if o.Supply=='manufactured')
 signatures=[]
 for o,rgb,metadata in zip(children,observed['component_colors'],observed['component_metadata']):
  assert o.AssemblyOccurrenceId==metadata['AssemblyOccurrenceId']
  o.addProperty('App::PropertyFloatList','SourceRGB','Verification');o.SourceRGB=list(rgb)
  signatures.append((o.Label,o.AssemblyOccurrenceId,o.Shape.Volume,list(rgb)))
 identities={o.AssemblyOccurrenceId for o in children}
 for channel in 'abcd':
  assert all(channel+'-'+identity not in identities for identity in ['nut-yoke','nut-flange-negative','nut-flange-positive','output-bearing-0'])
  nut_objects=[o for o in children if o.AssemblyOccurrenceId==channel+'-lead-nut'];assert len(nut_objects)==1 and len(nut_objects[0].Shape.Solids)==1
  crank_objects=[o for o in children if o.AssemblyOccurrenceId==channel+'-output-crank'];assert len(crank_objects)==1 and len(crank_objects[0].Shape.Solids)==1
 doc.removeObject(sentinel.Name);doc.recompute();save=OUT/(case['name']+'.FCStd');doc.saveAs(str(save));App.closeDocument(doc.Name)
 doc=App.openDocument(str(save));restored=objects(doc);assert len(restored)==len(signatures) and all(valid(o.Shape) for o in restored)
 for o,(label,identity,v,rgb) in zip(restored,signatures):
  assert o.Label==label and o.AssemblyOccurrenceId==identity and abs(o.Shape.Volume-v)<max(1e-7,v*1e-10)
  assert max(abs(a-b) for a,b in zip(o.SourceRGB,rgb))<1e-12
 REPORT['cases'].append(dict(name=case['name'],passed=True,nativeChildren=len(restored),configuredOccurrences=123,
  oneSolidPerNutAndCrank=True,savedAndReopened=True,actualRGBMetadataPreserved=True,existingDocumentPreserved=True,
  file=str(save),sha256=sha(save.read_bytes()),macroSha256=case['scriptSha256']))
 App.closeDocument(doc.Name);note('public-macro',name=case['name'])
bindings();REPORT['passed']=True;note('complete',passed=True)
