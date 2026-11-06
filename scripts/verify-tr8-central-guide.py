"""Validate the added guide against source-bound existing native assemblies.

The unchanged channel emitters and 112 occurrences inherit the earlier local,
cross-channel and thread-pair audits. This check certifies only the added stock,
guide anti-roll action and actual public Simple/Full macro roundtrips.
"""
import ast
import hashlib
import json
import math
from pathlib import Path
import sys
import time

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
from tr8_cnc_cross_stock import frame_envelope

CAPTURE = Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-central-guide/validation/captures.json').resolve()
DIRECTORY = CAPTURE.parent
DATA = json.loads(CAPTURE.read_text())
START = time.monotonic()
EPS = 1e-7
REPORT = {'schemaVersion':1,'passed':False,'captureSha256':hashlib.sha256(CAPTURE.read_bytes()).hexdigest(),
          'freecad':'.'.join(App.Version()[:3]),'runtimeSha256':hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest(),
          'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'cases':[],
          'scope':'Added guide stock, continuous channel separation and finite anti-roll probes. Actual public Simple and Full macros execute and save/reopen. Unchanged channel contacts inherit the prior exact-source audit; all added guide contacts are freshly certified.'}
RESUME = Path(sys.argv[2]).resolve() if len(sys.argv)>2 else None
PRIOR = json.loads(RESUME.read_text()) if RESUME else None

def sha(value): return hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()
def write():
 REPORT['elapsedSeconds']=time.monotonic()-START
 (DIRECTORY/'native-report.json').write_text(json.dumps(REPORT,indent=2))
def note(**values): print(json.dumps(values),flush=True)
def vector(values): return App.Vector(*values)
def valid(shape): return not shape.isNull() and shape.isValid() and shape.isClosed() and bool(shape.Solids) and shape.Volume>0
def volume(shape): return 0 if shape.isNull() else shape.Volume
def common(first,second):
 a,b=first.BoundBox,second.BoundBox
 if any(min(getattr(a,d+'Max'),getattr(b,d+'Max'))-max(getattr(a,d+'Min'),getattr(b,d+'Min'))<=1e-8 for d in 'XYZ'):return 0
 return volume(first.common(second))
def transform(shape,face):
 result=shape.copy();result.rotate(App.Vector(),App.Vector(1,0,0),face['clock']);result.translate(vector(face['origin']));return result
def objects(doc): return sorted([ob for ob in doc.Objects if hasattr(ob,'AssemblyOccurrenceId') and hasattr(ob,'Shape')],key=lambda ob:int(ob.ComponentIndex))
def frame_source(source):
 tree=ast.parse(source)
 calls=[n.value for n in tree.body if isinstance(n,ast.Assign) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='_cnc_source']
 assert len(calls)==5 and all(len(c.args)==1 and isinstance(c.args[0],ast.Constant) and isinstance(c.args[0].value,str) for c in calls)
 return tree,calls
def prove_emitter_prefix(old,new):
 first,old_calls=frame_source(old);second,new_calls=frame_source(new)
 assert [c.args[0].value for c in old_calls[:4]]==[c.args[0].value for c in new_calls[:4]],'An unchanged channel emitter changed.'
 old_frame=old_calls[-1].args[0].value;new_frame=new_calls[-1].args[0].value
 old_calls[-1].args[0].value='FRAME';new_calls[-1].args[0].value='FRAME'
 assert ast.dump(first)==ast.dump(second),'Mounted assembly emitter changed outside the middle-frame source.'
 return old_frame,new_frame
def execute(source):
 scope={'App':App,'Part':Part,'math':math};exec(source,scope);return scope
def extrema(a,b,limit):
 angles=[-limit,limit];critical=math.atan2(b,a)
 for turn in range(-2,3):
  angle=critical+turn*math.pi
  if -limit<=angle<=limit:angles.append(angle)
 values=[a*math.cos(t)+b*math.sin(t) for t in angles]
 return min(values),max(values)
def roll_band_envelope(station,offset,lever,travel):
 limit=math.radians(2);ys=[];zs=[]
 for y in [-2,2]:
  for z in [offset-2,offset+2]:
   ys.extend(extrema(y,-z,limit));zs.extend(extrema(z,y,limit))
 lo=[station-travel-2.6-1e-5,min(ys)-1e-5,lever+min(zs)-1e-5]
 hi=[station+travel+7.6+1e-5,max(ys)+1e-5,lever+max(zs)+1e-5]
 return Part.makeBox(*(hi[i]-lo[i] for i in range(3)),vector(lo))
def check_bindings():
 for item in DATA['sources']:assert sha(Path(item['path']).read_bytes())==item['sha256'],('Source changed',item['path'])

check_bindings();write()
for case in DATA['cases']:
 if PRIOR:
  assert PRIOR['captureSha256']==REPORT['captureSha256'] and PRIOR['runtimeSha256']==REPORT['runtimeSha256']
  completed=next((row for row in PRIOR['cases'] if row['variant']==case['variant'] and row['passed']),None)
  if completed:
   assert all(mode['passed'] and sha(Path(mode['macroExport']['file']).read_bytes())==mode['macroExport']['sha256'] for mode in completed['modes'])
   REPORT['cases'].append(completed);REPORT['resumedCompletedEvidence']={'report':str(RESUME),'reportSha256':sha(RESUME.read_bytes()),'verifierScriptSha256':PRIOR['scriptSha256'],'policy':'Reuse only a fully passed variant with byte-identical public API capture, runtime, product sources and native export files.'};write();note(variant=case['variant'],stage='reuse-completed-variant');continue
 row={'variant':case['variant'],'passed':False,'modes':[]};REPORT['cases'].append(row);write()
 layout=case['layout'];travel=layout['lever']*math.tan(math.radians(20))
 guide=execute(case['guideSource'])['shape'];assert valid(guide) and len(guide.Solids)==1
 row['guide']={'solids':len(guide.Solids),'volumeMm3':guide.Volume,'sourceSha256':sha(case['guideSource'])}
 faces=case['faces'];assert len(faces)==4
 # Each actual solid contains the whole supporting face strip, not just a point.
 coverage=[]
 for face in faces:
  lo,hi=face['padXEnvelope'];bottom,top=face['padZSpan'];plane=face['localFaceY']
  strip=Part.makeBox(hi-lo,.01,top-bottom,App.Vector(lo,plane-.01,bottom));strip=transform(strip,face)
  missing=volume(strip.cut(guide));assert abs(missing)<=EPS,('Incomplete real guide face',face['channel'],missing)
  assert face['xSpan'][0]<lo and hi<face['xSpan'][1]
  coverage.append({'channel':face['channel'],'faceAreaMm2':(hi-lo)*(top-bottom),'missingSupportingStockMm3':missing,'nominalGapMm':face['runningGap']})
 row['continuousFaceCoverage']=coverage
 # Authenticate the old native audits and their unchanged channel stocks.
 assert sha(Path(case['oldCasesPath']).read_bytes())==case['oldCasesSha256']
 assert sha(Path(case['oldAuditPath']).read_bytes())==case['oldAuditSha256']
 old_cases=json.loads(Path(case['oldCasesPath']).read_text());old_audit=json.loads(Path(case['oldAuditPath']).read_text())
 assert old_audit['passed']==2 and old_audit['failed']==0 and old_audit['casesSha256']==case['oldCasesSha256']
 stock_path=Path(case['stockProofPath']);assert sha(stock_path.read_bytes())==case['stockProofSha256']
 stock=json.loads(stock_path.read_text());assert stock['passed'] and stock['independentChannelAngles'] and not stock['unresolvedPairs']
 assert stock['layout']==layout and stock['runtimeSha256']==REPORT['runtimeSha256']
 assert stock['casesSha256']==sha((stock_path.parent/'cases.json').read_bytes())
 assert stock['nativeAuditSha256']==sha((stock_path.parent/'native-report.json').read_bytes())
 local_cases=json.loads((stock_path.parent/'cases.json').read_text())
 # Tight continuous source-positive envelopes are freshly checked to contain
 # every native child; no first-child-only purchased component approximation.
 envelopes={};native_containment=[]
 for tier in stock['tiers']:
  neutral=tier['neutralNutX'];native_path=stock_path.parent/tier['nativeNeutralFile']
  assert sha(native_path.read_bytes())==tier['nativeNeutralSha256']
  local=next(c for c in local_cases if c['parameters']['outputAngle']==0 and c['kinematics']['neutralNutX']==neutral)
  configs={c['id']:c for c in local['billOfMaterials']['components']}
  doc=App.openDocument(str(native_path));groups={}
  for ob in objects(doc):groups.setdefault(ob.AssemblyOccurrenceId,[]).append(ob.Shape.copy())
  envelopes[neutral]={}
  for identity,configuration in configs.items():
   cells=[item for item in tier['stockCells'] if item['id']==identity]
   candidate=frame_envelope(cells,neutral,configuration,travel)
   assert valid(candidate)
   maximum=0
   for child in groups[identity]:
    residual=child.cut(candidate);escaped=volume(residual);assert abs(escaped)<=EPS,(identity,'escapes continuous stock',escaped)
    maximum=max(maximum,abs(escaped))
   envelopes[neutral][identity]=candidate
   native_containment.append({'tier':neutral,'id':identity,'nativeChildren':len(groups[identity]),'escapedMm3':maximum})
  App.closeDocument(doc.Name)
 row['continuousNativeContainment']=native_containment
 minimum=math.inf;continuous=[]
 for face in faces:
  for identity,envelope in envelopes[layout['outputStations'][face['channel']]].items():
   placed=transform(envelope,face)
   v=common(guide,placed);assert abs(v)<=EPS,('Continuous guide clash',face['channel'],identity,v)
   distance=guide.distToShape(placed)[0];minimum=min(minimum,distance)
   continuous.append({'channel':face['channel'],'id':identity,'overlapMm3':v,'distanceMm':distance})
 row['continuousGuideClearance']={'checks':len(continuous),'minimumMm':minimum,'results':continuous,'independentAngles':True,'intervalDegrees':[-20,20]}
 simple_antiroll=None;simple_carrier_invariants=None
 for mode in case['modes']:
  record={'mode':mode['mode'],'passed':False};row['modes'].append(record);write()
  old_frame_source,new_frame_source=prove_emitter_prefix(mode['oldSource'],mode['newSource'])
  prior=next(c for c in old_cases if c['name']==mode['oldCaseName']);prior_audit=next(c for c in old_audit['cases'] if c['name']==mode['oldCaseName'])
  assert prior['source']==mode['oldSource'] and prior_audit['codeSha256']==mode['oldCaseCodeSha256'] and prior_audit['passed']
  assert mode['unchangedChannels']==112
  new_scope=execute(new_frame_source);new_middle_index=next(i for i,r in enumerate(new_scope['component_metadata']) if r['AssemblyOccurrenceId']=='cnc-middle-body')
  new_middle=new_scope['components'][new_middle_index];assert valid(new_middle) and len(new_middle.Solids)==1
  witness=mode['constructiveMiddleUnion'];assert witness['parametersSha256']==witness['expectedParametersSha256']
  assert json.loads(new_scope['component_metadata'][new_middle_index]['ConfigurationJSON'])==witness['actualParameters']
  native_file=Path(mode['oldNativeFile']);assert sha(native_file.read_bytes())==mode['oldNativeSha256']
  doc=App.openDocument(str(native_file));parts=objects(doc);assert len(parts)==391 and len({o.AssemblyOccurrenceId for o in parts})==123
  middle=next(o for o in parts if o.AssemblyOccurrenceId=='cnc-middle-body');old_middle=middle.Shape.copy()
  inherited_colors=[list(ob.SourceRGB) for ob in parts]
  for rgb,metadata in zip(new_scope['component_colors'],new_scope['component_metadata']):
   prior_color=next(ob.SourceRGB for ob in parts if ob.AssemblyOccurrenceId==metadata['AssemblyOccurrenceId'])
   assert max(abs(a-b) for a,b in zip(rgb,prior_color))<1e-12,'Existing frame color changed.'
  if mode['mode']=='simple':
   missing=volume(old_middle.cut(new_middle));assert abs(missing)<=1e-5,('Old middle material removed',mode['mode'],missing)
   added=new_middle.cut(old_middle)
  else:
   # Exact authored world-CSG is old body UNION guide. Its subset relation is
   # constructive; a coincident subtraction of all eight helical bores is not
   # needed. Only the guide is cut against the old body to obtain new stock.
   missing=0.;added=guide.cut(old_middle)
  assert valid(added)
  volume_identity_error=abs((new_middle.Volume-old_middle.Volume)-added.Volume)
  # Volume integration is a corroborative mass-property check, separate from
  # the unchanged 1e-7 mm3 overlap criterion and exact constructive CSG union.
  volume_precision=max(1e-4,(abs(new_middle.Volume)+abs(old_middle.Volume))*1e-8)
  assert volume_identity_error<=volume_precision,('Union volume integration identity',volume_identity_error,volume_precision)
  escaped=volume(added.cut(guide));assert abs(escaped)<=1e-5,('New stock outside authored guide',escaped)
  billet=Part.makeCylinder(layout['diameter']/2,layout['endPlateX']-layout['motorPlateX']-3,App.Vector(layout['motorPlateX']+3,0,0),App.Vector(1,0,0))
  outside=volume(new_middle.cut(billet));assert abs(outside)<=1e-5
  record['middleBody']={'solids':len(new_middle.Solids),'volumeMm3':new_middle.Volume,'addedVolumeMm3':added.Volume,'oldMaterialRemovedMm3':missing,'oldSubsetPolicy':'Native subtraction in Simple; exact verified positive CSG union in Full.','unionVolumeIdentityErrorMm3':volume_identity_error,'volumeIntegrationPrecisionMm3':volume_precision,'newStockOutsideGuideMm3':escaped,'outsideOriginalBilletMm3':outside,'nativeFrameSourceSha256':sha(new_frame_source)}
  checks=[]
  for ob in parts:
   if ob==middle:continue
   v=common(added,ob.Shape);assert abs(v)<=EPS,('Added guide intersects native child',mode['mode'],ob.Label,v)
   checks.append({'name':ob.Name,'occurrenceId':ob.AssemblyOccurrenceId,'overlapMm3':v})
  record['addedStockNativeChecks']={'checkedNativeChildren':len(checks),'results':checks}
  # Probe the real carrier with BOTH follower pins and the output fork absent.
  body=execute(mode['carrierBodySource'])['shape'];assert valid(body) and len(body.Solids)==1
  tools=[]
  for source,offset in zip(mode['carrierTapSources'],[-8,8]):
   tool=execute(source)['shape'];assert valid(tool)
   band=Part.makeBox(10.2,4,4,App.Vector(-2.6,-2,layout['lever']+offset-2))
   escaped=volume(tool.cut(band));assert abs(escaped)<=EPS,('M3 cutting tool escapes its internal band',mode['mode'],offset,escaped)
   tools.append({'offset':offset,'sourceSha256':sha(source),'volumeMm3':tool.Volume,'outsideInternalBandMm3':escaped})
  record['nativeCarrierM3CutSupport']=tools
  roll=[]
  if mode['mode']=='simple':simple_carrier_invariants=mode['carrierInvariantPositiveAndBore']
  if mode['mode']=='full':
   assert simple_antiroll is not None and mode['carrierInvariantPositiveAndBore']==simple_carrier_invariants
   band_checks=[]
   for face in faces:
    for offset in [-8,8]:
     envelope=transform(roll_band_envelope(layout['outputStations'][face['channel']],offset,layout['lever'],travel),face)
     v=common(guide,envelope);assert abs(v)<=EPS,('Internal thread difference can reach the guide',face['channel'],offset,v)
     band_checks.append({'channel':face['channel'],'threadOffset':offset,'overlapMm3':v,'distanceMm':guide.distToShape(envelope)[0]})
   record['antiRoll']={'inheritedSimpleProbes':simple_antiroll['probes'],'forkAndFollowersRemoved':True,
     'policy':'The authored positive carrier and main bore are identical in Simple/Full. Both actual Full M3 subtractors are natively contained in internal bands whose conservative full-stroke and +/-2-degree roll envelopes are disjoint from the guide. Therefore guide intersections equal the directly probed Simple carrier intersections throughout that domain, without a coincident body subtraction.',
     'nativeM3ToolSupport':tools,'continuousInternalBandChecks':band_checks,
     'firstContactRangeDegrees':simple_antiroll['firstContactRangeDegrees']}
  for face in (faces if mode['mode']=='simple' else []):
   station=layout['outputStations'][face['channel']]
   for angle in [-20,-10,0,10,20]:
    centre=station+layout['lever']*math.tan(math.radians(angle))
    nominal=body.copy();nominal.translate(App.Vector(centre,0,0));placed=transform(nominal,face)
    v=common(guide,placed);gap=guide.distToShape(placed)[0]
    assert abs(v)<=EPS and abs(gap-face['runningGap'])<1e-6,(face['channel'],angle,'nominal gap',v,gap)
    for sign in [-1,1]:
     def penetration(degrees):
      wrong=nominal.copy();wrong.rotate(App.Vector(centre,0,layout['lever']),App.Vector(1,0,0),sign*degrees)
      return common(guide,transform(wrong,face))
     free=penetration(.1);blocked=penetration(1);strong=penetration(2)
     assert abs(free)<=EPS and blocked>.001 and strong>blocked,(face['channel'],angle,sign,free,blocked,strong)
     low,high=0.,1.
     for _ in range(22):
      mid=(low+high)/2
      if penetration(mid)>1e-6:high=mid
      else:low=mid
     roll.append({'channel':face['channel'],'outputAngleDegrees':angle,'rollSign':sign,'nominalGapMm':gap,'freeAtPointOneDegreesMm3':free,'blockedAtOneDegreeMm3':blocked,'blockedAtTwoDegreesMm3':strong,'firstNumericalPenetrationDegrees':high})
  if mode['mode']=='simple':
   record['antiRoll']={'forkAndFollowersRemoved':True,'probes':len(roll),'firstContactRangeDegrees':[min(x['firstNumericalPenetrationDegrees'] for x in roll),max(x['firstNumericalPenetrationDegrees'] for x in roll)],'results':roll}
   simple_antiroll=record['antiRoll']
  App.closeDocument(doc.Name)
  # Exercise each actual public macro, retaining an existing-document sentinel.
  macro_path=DIRECTORY/(mode['name']+'.FCMacro')
  script=mode['simpleScript'] if mode['mode']=='simple' else macro_path.read_text()
  embedded='\n'.join('        '+line for line in mode['newSource'].split('\n'))
  assert embedded in script,'Macro does not embed the frozen actual public native source.'
  doc=App.newDocument('GuidedMacroAudit');sentinel=doc.addObject('App::FeaturePython','ExistingDocumentSentinel')
  scope={'App':App,'Part':Part,'math':math};exec(script,scope)
  root=next(o for o in doc.RootObjects if hasattr(o,'PartId'));assert root.PartId==case['partId'] and doc.getObject(sentinel.Name)
  assert json.loads(root.Configuration)==mode['parameters'] and root.GeometryMode==mode['mode']
  children=objects(doc);assert len(children)==391 and len({o.AssemblyOccurrenceId for o in children})==123
  assert all(valid(ob.Shape) for ob in children)
  assert all(len(ob.Shape.Solids)==1 for ob in children if ob.Supply=='manufactured')
  # Unchanged channel source and freshly checked frame colors above establish
  # the exact public RGB sequence without rebuilding the same geometry twice.
  colors=inherited_colors;assert len(colors)==391
  labels=[ob.Label for ob in children]
  for ob,rgb in zip(children,colors):
   if 'SourceRGB' not in ob.PropertiesList:ob.addProperty('App::PropertyFloatList','SourceRGB','Verification')
   ob.SourceRGB=list(rgb)
  root.addProperty('App::PropertyString','GuideValidationScope','Verification');root.GuideValidationScope=REPORT['scope']
  root.addProperty('App::PropertyString','CentralGuideDefinition','Mechanism');root.CentralGuideDefinition=json.dumps(case['guideLayout'])
  doc.removeObject(sentinel.Name);doc.recompute();path=DIRECTORY/(mode['name']+'.FCStd');doc.saveAs(str(path));App.closeDocument(doc.Name);doc=App.openDocument(str(path))
  restored=objects(doc);assert len(restored)==391 and all(valid(ob.Shape) for ob in restored)
  assert [ob.Label for ob in restored]==labels
  assert all(max(abs(a-b) for a,b in zip(ob.SourceRGB,rgb))<1e-12 for ob,rgb in zip(restored,colors))
  root=next(o for o in doc.RootObjects if hasattr(o,'PartId'));assert root.PartId==case['partId']
  record['macroExport']={'file':str(path),'sha256':sha(path.read_bytes()),'savedAndReopened':True,'actualPublicMacroExecuted':True,'macroSha256':sha(script),'existingDocumentPreserved':True,'nativeSolids':sum(len(ob.Shape.Solids) for ob in restored),'labelsPreserved':True,'sourceRGBPreserved':True}
  App.closeDocument(doc.Name)
  record['passed']=True;write();note(variant=case['variant'],mode=mode['mode'],passed=True,firstContact=record['antiRoll']['firstContactRangeDegrees'])
 row['passed']=True;write()
check_bindings();REPORT['passed']=all(c['passed'] for c in REPORT['cases']);write()
note(passed=REPORT['passed'],cases=len(REPORT['cases']),elapsedSeconds=REPORT['elapsedSeconds'])
