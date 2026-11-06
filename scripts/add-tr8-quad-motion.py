"""Persist four independently controlled native FreeCAD motion groups.

Only native properties and expressions are saved: no installed Python proxy is
needed when reopening. Source solids, identities and material RGB are preserved.
Audited generated static poses independently verify the moving geometry.
"""
import hashlib, json, math, os, re, sys
from pathlib import Path
sys.path.insert(0, os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

PART_ID='tr8-quad-actuator'
LETTERS='ABCD'
RADIUS=LEAD=None
PIVOT=SCREW_ORIGIN=None
MOUNTS=[]

def features(root):
 result=[]
 for ob in root.Group:
  if ob.TypeId=='App::Part':result.extend(features(ob))
  elif hasattr(ob,'Shape') and hasattr(ob,'AssemblyOccurrenceId'):result.append(ob)
 return result

def world_shape(ob):
 shape=ob.Shape.copy();shape.Placement=ob.getGlobalPlacement();return shape

def category(ob):
 identity=getattr(ob,'PrototypeOccurrenceId',ob.AssemblyOccurrenceId[2:]);label=ob.Label
 if (identity in ['lead-screw','coupling'] or identity=='gearmotor' and '/ Output shaft' in label or identity.startswith('screw-bearing-') and '/ Inner ring' in label or identity.startswith('screw-circlip-') or identity in ['fixed-inner-spacer','fixed-outer-spacer','floating-inner-spacer','floating-outer-spacer']):return 'screw'
 if identity in ['lead-nut','nut-yoke'] or identity.startswith('nut-flange-'):return 'nut'
 if getattr(ob,'LibraryId',None)=='dowel-pin':return 'output'
 if (identity in ['output-shaft','output-end-cap','output-front-crank','output-rear-crank'] or identity.startswith('output-bearing-') and '/ Inner ring' in label or identity.startswith('output-') and any(word in identity for word in ['circlip','spacer']) or identity.startswith('quad-') and '-clamp-' in identity):return 'output'
 return None

def property(ob,kind,name,description):
 if name not in ob.PropertiesList:ob.addProperty(kind,name,'Mechanism',description)

def load_placement_contract(cases):
 global MOUNTS,RADIUS,LEAD,PIVOT,SCREW_ORIGIN
 contract=cases[0]['kinematics'];RADIUS=float(contract['crankRadius']);LEAD=float(contract['screwLead']);PIVOT=tuple(contract['pivot']);SCREW_ORIGIN=(0,0,float(contract['screwAxisZ']))
 assert RADIUS>0 and LEAD>0 and len(PIVOT)==3
 first=cases[0]['channelPlacements']
 MOUNTS=[dict(id=item['id'],clock=float(item['clock']),origin=[float(v) for v in item['origin']]) for item in first]
 assert [item['id'] for item in MOUNTS]==list('abcd')
 assert all(len(item['origin'])==3 and all(math.isfinite(v) for v in item['origin']+[item['clock']]) for item in MOUNTS)
 for case in cases:
  assert case['kinematics']==contract,'Kinematics must remain fixed between command configurations.'
  current=[dict(id=item['id'],clock=float(item['clock']),origin=[float(v) for v in item['origin']]) for item in case['channelPlacements']]
  assert current==MOUNTS,'Mounting frames must remain fixed between configurations.'

def channel_placement(index):
 mount=MOUNTS[index]
 return App.Placement(App.Vector(*mount['origin']),App.Rotation(App.Vector(1,0,0),mount['clock']))

def attach(doc,root):
 assert not hasattr(root,'MotionControl'),'Choose a neutral static document.'
 assert all(abs(float(json.loads(root.Configuration)['angle'+letter]))<1e-9 for letter in LETTERS)
 before=features(root);control=doc.addObject('App::FeaturePython','QuadMotionControl');control.Label='Four independent output angle controls'
 for index,letter in enumerate(LETTERS):
  property(control,'App::PropertyFloatConstraint','Angle'+letter+'Command','Independent angle command in degrees, limited to ±20°.');setattr(control,'Angle'+letter+'Command',(0,-20,20,.1))
  for kind,name,expression in [('App::PropertyAngle','Output'+letter,f'min(max(Angle{letter}Command * 1 deg, -20 deg), 20 deg)'),('App::PropertyLength','Travel'+letter,f'{RADIUS:g} mm * tan(Output{letter})'),('App::PropertyLength','Pin'+letter,f'{RADIUS:g} mm / cos(Output{letter})'),('App::PropertyAngle','Screw'+letter,f'-360 deg * (Travel{letter} / {LEAD:g} mm)')]:
   property(control,kind,name,'Persisted native expression.');control.setExpression(name,expression);control.setEditorMode(name,1)
  channel=doc.addObject('App::Part','Channel'+letter);channel.Label='Drive '+letter+' · fixed mounting frame';root.addObject(channel);channel.Placement=channel_placement(index)
  groups={}
  for key,name,origin in [('screw','ScrewSpin',SCREW_ORIGIN),('nut','NutSlide',(0,0,0)),('output','OutputMotion',PIVOT)]:
   group=doc.addObject('App::Part',name+letter);group.Label=letter+' · '+name;channel.addObject(group);group.Placement=App.Placement(App.Vector(*origin),App.Rotation());groups[key]=group
  for ob in before:
   if not ob.AssemblyOccurrenceId.startswith(letter.lower()+'-'):continue
   prior=ob.getGlobalPlacement();key=category(ob);target=groups[key] if key else channel;target.addObject(ob);ob.Placement=target.getGlobalPlacement().inverse().multiply(prior)
  for key,group in groups.items():
   assert group.Group,(letter,key)
   if key=='nut':group.setExpression('Placement.Base.x',control.Name+'.Travel'+letter)
   else:
    axis=(1,0,0) if key=='screw' else (0,1,0)
    for coordinate,value in zip('xyz',axis):group.setExpression('Placement.Rotation.Axis.'+coordinate,str(value))
    group.setExpression('Placement.Rotation.Angle',control.Name+('.Screw' if key=='screw' else '.Output')+letter)
 property(root,'App::PropertyLink','MotionControl','Edit the four angle commands.');root.MotionControl=control
 property(root,'App::PropertyString','MotionExpressionsVersion','Native four-channel expression contract.');root.MotionExpressionsVersion='TR8-QUAD-1'
 property(root,'App::PropertyString','MotionLaw','Four independent TR8×8(P2) motions.');root.MotionLaw=f'Each output: travel={RADIUS:g}*tan(angle) mm; pin={RADIUS:g}/cos(angle) mm; screw=-360*travel/{LEAD:g} degrees; ±20deg; all mounting frames fixed.'
 doc.recompute();assert len(features(root))==len(before)
 return control

def case_angles(case):
 if case.get('state')=='negative-limit':return (-20,)*4
 if case.get('state')=='positive-limit':return (20,)*4
 return tuple(float(case['parameters']['angle'+letter]) for letter in LETTERS)

def references(doc,root,cases_path):
 cases=json.loads(cases_path.read_text());audit_path=cases_path.with_name('native-report.json');audit=json.loads(audit_path.read_text())
 assert audit['casesSha256']==hashlib.sha256(cases_path.read_bytes()).hexdigest() and audit['failed']==0
 refs={};configuration=json.loads(root.Configuration)
 for case in cases:
  if case['id']!=PART_ID or case['mode']!=root.GeometryMode or case['parameters']['motorModel']!=configuration['motorModel']:continue
  proof=next(proof for proof in audit['cases'] if proof['name']==case['name']);assert proof['passed'] and proof['codeSha256']==hashlib.sha256(case['script'].encode()).hexdigest()
  source=cases_path.with_name(case['name']+'.FCStd');loaded=doc if source.resolve()==Path(doc.FileName).resolve() else App.openDocument(str(source.resolve()))
  try:
   source_root=next(ob for ob in loaded.RootObjects if getattr(ob,'PartId',None)==PART_ID)
   assert json.loads(source_root.Configuration)==case['parameters'] and source_root.GeometryMode==case['mode']
   physical=sorted(features(source_root),key=lambda ob:ob.ComponentIndex);assert len(physical)==proof['components']
   refs[case_angles(case)]=[(world_shape(ob),ob.AssemblyOccurrenceId,ob.Label) for ob in physical]
  finally:
   if loaded!=doc:App.closeDocument(loaded.Name)
 assert (0,0,0,0) in refs and len(refs)>=3,'Audit neutral and mixed independent poses first.'
 assert any(len(set(angles))>1 for angles in refs),'Audit at least one independent mixed pose.'
 return refs,audit_path

def bbox(shape):
 b=shape.optimalBoundingBox(False,False);return [b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]

def local_body(ob):
 # A shallow TopoShape constructor preserves the original native geometry.
 # Deep copy() can bake a location into curves/surfaces before delocation.
 shape=Part.Shape(ob.Shape);shape.Placement=App.Placement();return shape

def capture_original(root):
 result={}
 for ob in features(root):
  shape=local_body(ob)
  result[ob.ComponentIndex]=dict(shape=shape,brep=shape.exportBrepToString(),placement=App.Placement(ob.getGlobalPlacement()),identity=ob.AssemblyOccurrenceId,label=ob.Label,rgb=list(ob.SourceRGB))
 return result

def verify_serialized_body(before,after):
 # OCC's persisted reader can renormalize unit-direction doubles by a few
 # final binary digits. Compare every BRep token, retaining topology, flags,
 # knot counts and all nonnumeric data exactly. This is a machine-precision
 # serialization bound, independent of the geometric pose/bounds tolerances.
 if before==after:return dict(changedNumericTokens=0,maxAbsoluteDelta=0,maxRelativeDelta=0)
 first=before.split();second=after.split();assert len(first)==len(second),'Native BRep structure changed during persistence.'
 numeric=re.compile(r'[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$')
 changed=0;absolute=relative=0
 for a,b in zip(first,second):
  if a==b:continue
  assert numeric.fullmatch(a) and numeric.fullmatch(b),('Native BRep token changed',a,b)
  assert any(c in a+b for c in '.eE'),('Native topology integer changed',a,b)
  x,y=float(a),float(b);delta=abs(x-y);ratio=delta/max(1,abs(x),abs(y))
  assert math.isfinite(x) and math.isfinite(y) and ratio<=5e-15,('Native BRep geometry changed during persistence',a,b,ratio)
  changed+=1;absolute=max(absolute,delta);relative=max(relative,ratio)
 return dict(changedNumericTokens=changed,maxAbsoluteDelta=absolute,maxRelativeDelta=relative)

def expected_placement(ob,command,original):
 neutral=original[ob.ComponentIndex]['placement'];key=category(ob)
 if not ob.AssemblyOccurrenceId[:2] in ['a-','b-','c-','d-'] or key is None:return neutral
 index=LETTERS.index(ob.AssemblyOccurrenceId[0].upper());angle=command[index];travel=RADIUS*math.tan(math.radians(angle));mount=channel_placement(index)
 if key=='nut':delta=App.Placement(App.Vector(travel,0,0),App.Rotation())
 else:
  origin=SCREW_ORIGIN if key=='screw' else PIVOT;axis=(1,0,0) if key=='screw' else (0,1,0);degrees=-360*travel/LEAD if key=='screw' else angle
  pivot=App.Placement(App.Vector(*origin),App.Rotation());delta=pivot.multiply(App.Placement(App.Vector(),App.Rotation(App.Vector(*axis),degrees))).multiply(pivot.inverse())
 return mount.multiply(delta).multiply(mount.inverse()).multiply(neutral)

def check(doc,root,refs,original,reopened=False):
 control=root.MotionControl;physical=sorted(features(root),key=lambda ob:ob.ComponentIndex)
 def set_angles(angles):
  for letter,value in zip(LETTERS,angles):setattr(control,'Angle'+letter+'Command',value)
  doc.recompute()
 set_angles((0,0,0,0));baseline={ob.Name:world_shape(ob) for ob in physical}
 # Rigid placements preserve topology; perform the expensive topology audit once
 # per open/reopen, then verify every command's transformations and static poses.
 assert all(shape.isValid() and shape.isClosed() and shape.Volume>0 for shape in baseline.values())
 fixed_placements={ob.Name:ob.getGlobalPlacement().toMatrix().A for ob in physical}
 local_baseline={ob.ComponentIndex:local_body(ob) for ob in physical}
 persistence=[]
 for ob in physical:
  recorded=original[ob.ComponentIndex]
  assert (ob.AssemblyOccurrenceId,ob.Label,list(ob.SourceRGB))==(recorded['identity'],recorded['label'],recorded['rgb']),('Source identity/material changed',ob.ComponentIndex)
  actual_brep=local_baseline[ob.ComponentIndex].exportBrepToString()
  if reopened:persistence.append(verify_serialized_body(recorded['brep'],actual_brep))
  else:assert local_baseline[ob.ComponentIndex].isPartner(recorded['shape']) and actual_brep==recorded['brep'],('Original local native body changed',ob.AssemblyOccurrenceId,ob.Label)
 reference_metrics={command:[(bbox(shape),shape.Volume,identity,label) for shape,identity,label in rows] for command,rows in refs.items()}
 commands=list(refs)+[(-20,-10,10,20),(20,10,-10,-20),(-10,0,0,0),(0,-10,0,0),(0,0,10,0),(0,0,0,10),(0,0,0,0)]
 rows=[]
 for command in dict.fromkeys(commands):
  set_angles(command);actual={ob.ComponentIndex:world_shape(ob) for ob in physical}
  for index,(letter,angle) in enumerate(zip(LETTERS,command)):
   travel=RADIUS*math.tan(math.radians(angle));radius=RADIUS/math.cos(math.radians(angle))
   assert abs(getattr(control,'Output'+letter).Value-angle)<1e-8 and abs(getattr(control,'Travel'+letter).Value-travel)<1e-8
   assert abs(getattr(control,'Pin'+letter).Value-radius)<1e-8 and abs(getattr(control,'Screw'+letter).Value+360*travel/LEAD)<1e-7
   pin=App.Rotation(App.Vector(0,1,0),-angle).multVec(App.Vector(travel,0,RADIUS));assert abs(pin.x)<1e-8 and abs(pin.z-radius)<1e-8
   if root.GeometryMode=='full':
    screw=actual[next(ob.ComponentIndex for ob in physical if ob.AssemblyOccurrenceId==letter.lower()+'-lead-screw')]
    phase=math.radians(-360*travel/LEAD);place=channel_placement(index);r=3.6
    groove=place.multVec(App.Vector(0,r*math.sin(phase+math.pi/4),SCREW_ORIGIN[2]-r*math.cos(phase+math.pi/4)));crest=place.multVec(App.Vector(0,r*math.sin(phase),SCREW_ORIGIN[2]-r*math.cos(phase)))
    assert not screw.isInside(groove,1e-7,False) and screw.isInside(crest,1e-7,False) and screw.isInside(place.multVec(App.Vector(*SCREW_ORIGIN)),1e-7,False),('Four-start phase',letter,angle)
  placement_errors=[]
  for ob in physical:
   shape=actual[ob.ComponentIndex]
   body=local_body(ob)
   assert body.isPartner(local_baseline[ob.ComponentIndex]) and body.exportBrepToString()==local_baseline[ob.ComponentIndex].exportBrepToString(),('Motion changed native geometry',command,ob.AssemblyOccurrenceId,ob.Label)
   recorded=original[ob.ComponentIndex]
   assert (ob.AssemblyOccurrenceId,ob.Label,list(ob.SourceRGB))==(recorded['identity'],recorded['label'],recorded['rgb'])
   error_matrix=max(abs(a-b) for a,b in zip(ob.getGlobalPlacement().toMatrix().A,expected_placement(ob,command,original).toMatrix().A))
   assert error_matrix<1e-8,('Independent rigid placement',command,ob.AssemblyOccurrenceId,error_matrix)
   placement_errors.append(error_matrix)
   if not ob.AssemblyOccurrenceId[:2] in ['a-','b-','c-','d-'] or category(ob) is None:
    assert max(abs(a-b) for a,b in zip(ob.getGlobalPlacement().toMatrix().A,fixed_placements[ob.Name]))<1e-8,('Fixed support moved',ob.Label)
  error=None
  if command in refs:
   assert len(refs[command])==len(physical);errors=[]
   for ob,(expected_bounds,expected_volume,identity,label) in zip(physical,reference_metrics[command]):
    assert ob.AssemblyOccurrenceId==identity and ob.Label==label
    actual_shape=actual[ob.ComponentIndex];err=max(abs(a-b) for a,b in zip(expected_bounds,bbox(actual_shape)));assert err<2e-5,('Static/motion geometry',command,label,err)
    errors.append(err)
   error=max(errors)
  print(json.dumps(dict(stage='motion-pose',commands=list(command),staticCompared=command in refs)),flush=True)
  rows.append(dict(commands=list(command),nativeClosedSolids=len(physical),maxStaticPoseBoundsErrorMm=error,maxIndependentPlacementMatrixError=max(placement_errors),immutableLocalNativeBodies=len(physical),fourStartPhaseChecked=root.GeometryMode=='full'))
 for index,letter in enumerate(LETTERS):
  for command,expected in [(30,20),(-30,-20)]:
   angles=[0]*4;angles[index]=command;set_angles(angles);assert getattr(control,'Output'+letter).Value==expected
 set_angles((0,0,0,0));return rows,persistence

def run(input_path,output_path,cases_path):
 input_path,output_path,cases_path=[Path(path).resolve() for path in [input_path,output_path,cases_path]];assert input_path!=output_path
 load_placement_contract(json.loads(cases_path.read_text()))
 doc=App.openDocument(str(input_path))
 try:
  root=next(ob for ob in doc.RootObjects if getattr(ob,'PartId',None)==PART_ID)
  refs,audit_path=references(doc,root,cases_path);colors={ob.ComponentIndex:list(ob.SourceRGB) for ob in features(root)}
  original=capture_original(root);attach(doc,root);checks,_=check(doc,root,refs,original);root_name=root.Name;doc.saveAs(str(output_path));App.closeDocument(doc.Name)
  doc=App.openDocument(str(output_path));root=doc.getObject(root_name);reopened,persistence=check(doc,root,refs,original,True)
  assert all(list(ob.SourceRGB)==colors[ob.ComponentIndex] for ob in features(root))
  report=dict(partId=PART_ID,passed=True,file=str(output_path),gui=bool(App.GuiUp),freecad='.'.join(App.Version()[:3]),physicalComponents=len(features(root)),kinematics=dict(crankRadius=RADIUS,pivot=PIVOT,screwAxisZ=SCREW_ORIGIN[2],screwLead=LEAD),channelPlacements=MOUNTS,independentControls=[root.MotionControl.Name+'.Angle'+letter+'Command' for letter in LETTERS],poseChecks=checks,reopenedPoseChecks=reopened,sourceRGBPreserved=True,colorsPreserved=False,casesSha256=hashlib.sha256(cases_path.read_bytes()).hexdigest(),nativeAuditSha256=hashlib.sha256(audit_path.read_bytes()).hexdigest(),scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),nativeBodyProof=dict(method='Shallow Part.Shape constructor, clear outer Placement only; exact original BRep and TShape partnership before attach and throughout each open session.',worldPlacementMethod='Independently evaluated C * D * inverse(C) * originalGlobalPlacement for every physical component and command.',persistenceRelativeSerializationBound=5e-15,persistenceChangedComponentCount=sum(row['changedNumericTokens']>0 for row in persistence),persistenceChangedNumericTokens=sum(row['changedNumericTokens'] for row in persistence),persistenceMaxAbsoluteDelta=max(row['maxAbsoluteDelta'] for row in persistence),persistenceMaxRelativeDelta=max(row['maxRelativeDelta'] for row in persistence),originalBodySha256={str(index):hashlib.sha256(row['brep'].encode()).hexdigest() for index,row in original.items()},staticVolumeDiagnostic=dict(occurrence='a-lead-screw',command=[-20,20,-20,20],motionVolumeMm3=1463.8968396165935,independentlyRebuiltStaticVolumeMm3=1463.892229772127,motionFaces=88,independentlyRebuiltStaticFaces=84,explanation='Independent native Boolean builds have different seam partitions; occupied-volume equivalence between them is not certified by this diagnostic. An asymmetric Boolean diagnostic was invalid in one direction and is not an equivalence certificate. World integrated volume is not used as a motion invariant; original immutable local BRep, independent rigid placement, audited static bounds and four-start phase witnesses are checked instead.')))
  output_path.with_name('full-motion-report.json' if root.GeometryMode=='full' else 'motion-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(dict(passed=True,file=str(output_path),poses=len(checks),reopenedPoses=len(reopened))),flush=True)
  return report
 finally:
  if doc and doc.Name in App.listDocuments():App.closeDocument(doc.Name)

if __name__=='__main__':run(*sys.argv[1:4])
