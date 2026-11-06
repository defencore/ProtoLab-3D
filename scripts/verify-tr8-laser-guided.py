"""Fresh public-macro and fabrication checks for the NEW laser-frame variant.

Changed frame stock is tested against continuous old drive envelopes. The 108
unchanged drive occurrences and four replacement-crank subsets inherit the
source-bound prior local/cross-channel proofs; finite poses are not a sweep.
"""
import ast
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import time

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
from tr8_cnc_cross_stock import frame_envelope

CAPTURE=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-laser-guided/validation/captures.json').resolve()
DATA=json.loads(CAPTURE.read_text());DIRECTORY=CAPTURE.parent;START=time.monotonic();EPS=1e-7
sha=lambda value:hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()
REPORT={'schemaVersion':1,'passed':False,'captureSha256':sha(CAPTURE.read_bytes()),
 'scriptSha256':sha(Path(__file__).read_bytes()),'runtimeSha256':sha(Path(sys.executable).read_bytes()),
 'freecad':'.'.join(App.Version()[:3]),'cases':[],
 'scope':'Fresh public macros, all native children and metadata roundtrips, actual public laser contours, continuous new-frame versus inherited drive-stock bounds and four separate anti-roll faces. Prior local drive, cross-channel, full thread-phase and crank-subset proofs are authenticated by source/file hashes. This checks nominal geometry, not strength or production fits.'}
def write():
 REPORT['elapsedSeconds']=time.monotonic()-START;(DIRECTORY/'native-report.json').write_text(json.dumps(REPORT,indent=2))
def note(stage,**values):write();print(json.dumps({'stage':stage,**values}),flush=True)
def volume(s):return 0. if s.isNull() else s.Volume
def valid(s):return not s.isNull() and s.isValid() and s.isClosed() and bool(s.Solids) and s.Volume>0
def overlap(a,b):
 aa,bb=a.BoundBox,b.BoundBox
 if any(min(getattr(aa,d+'Max'),getattr(bb,d+'Max'))-max(getattr(aa,d+'Min'),getattr(bb,d+'Min'))<=1e-8 for d in 'XYZ'):return 0.
 return volume(a.common(b))
def execute(source):
 scope={'App':App,'Part':Part,'math':math};exec(source,scope);return scope
def placed(shape,mount):
 s=shape.copy();s.rotate(App.Vector(),App.Vector(1,0,0),mount['clock']);s.translate(App.Vector(*mount['origin']));return s
def objects(doc):return sorted([ob for ob in doc.Objects if hasattr(ob,'AssemblyOccurrenceId') and hasattr(ob,'Shape')],key=lambda ob:int(ob.ComponentIndex))
def bind(item):assert sha(Path(item['path']).read_bytes())==item['sha256'],('Changed bound input',item['path'])
def bindings():
 for item in DATA['sources']+DATA['references']+DATA['fabricationFiles']:bind(item)
 bind(DATA['captureScript'])
 for family,files in DATA['preservedSource'].items():
  for file,checksum in files.items():assert sha(Path('src/parts',family,file).read_bytes())==checksum

bindings();note('authenticated-inputs',sources=len(DATA['sources']))
# Read independent contours from the actual public fabrication files.
spec=importlib.util.spec_from_file_location('laser_contour_reader',Path(__file__).with_name('verify-tr8-cnc-fabrication.py'))
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
# Vertex enumeration does not reverse with TopoDS edge orientation in this
# FreeCAD build. Track the selected endpoint explicitly for clockwise arcs.
def connected_wires(edges):
 remaining=[edge.copy() for edge in edges];wires=[]
 while remaining:
  edge=remaining.pop(0);chain=[edge];start=edge.Vertexes[0].Point;end=edge.Vertexes[-1].Point
  while (start-end).Length>=1e-6:
   found=False
   for index,candidate in enumerate(remaining):
    first,last=candidate.Vertexes[0].Point,candidate.Vertexes[-1].Point
    if (first-end).Length<1e-6:
     chain.append(remaining.pop(index));end=last;found=True;break
    if (last-end).Length<1e-6:
     selected=remaining.pop(index);selected.reverse();chain.append(selected);end=first;found=True;break
   assert found,'Open or disconnected laser contour'
  wire=Part.Wire(chain);assert wire.isValid() and wire.isClosed();wires.append(wire)
 return wires
reader.connected_wires=connected_wires
profile_results=[]
for row in DATA['profiles']:
 print(json.dumps({'stage':'read-laser-profile','id':row['id']}),flush=True)
 bind(row['dxf']);bind(row['svg'])
 dxf,dc,entities=reader.dxf_read(Path(row['dxf']['path']));svg,sc,svg_meta=reader.svg_read(Path(row['svg']['path']))
 assert dc==sc
 d=dxf.extrude(App.Vector(0,0,row['thickness']));s=svg.extrude(App.Vector(0,0,row['thickness']))
 expected=execute(row['source'])['shape'];assert valid(d) and valid(s) and valid(expected)
 assert len(d.Solids)==len(s.Solids)==len(expected.Solids)==1
 delta=reader.difference(d,s);authored=reader.difference(d,expected)
 assert delta<1e-6 and authored<1e-5,(row['id'],delta,authored)
 record={'id':row['id'],'thicknessMm':row['thickness'],'quantity':row['quantity'],'closedContours':dc,
  'dxfSvgDifferenceMm3':delta,'nativeBlankDifferenceMm3':authored,'nativeVolumeMm3':d.Volume,'svgUnits':svg_meta}
 if row.get('finishedSource'):
  finished=execute(row['finishedSource'])['shape'];assert valid(finished) and len(finished.Solids)==1
  outside=volume(finished.cut(expected));assert abs(outside)<1e-6
  record.update(finishedOutsidePilotMm3=outside,finishingStockMm3=volume(expected.cut(finished)))
 profile_results.append(record)
REPORT['laserProfiles']=profile_results
blank_file=next(f for f in DATA['fabricationFiles'] if f['id']=='laser-blanks')
scope=execute(Path(blank_file['path']).read_text());doc=scope['doc'];blanks=[ob.Shape.copy() for ob in doc.Objects if hasattr(ob,'Shape')]
assert len(blanks)==sum(p['quantity'] for p in DATA['profiles'])==27
assert all(valid(s) and len(s.Solids)==1 for s in blanks)
gap=min(blanks[a].distToShape(blanks[b])[0] for a in range(len(blanks)) for b in range(a))
assert gap>=4.99999
REPORT['publicBlankMacro']={'actualFile':blank_file['path'],'validSingleSolids':len(blanks),'minimumSeparationMm':gap}
App.closeDocument(doc.Name);note('laser-contours',uniqueProfiles=len(profile_results),physicalBlanks=len(blanks))

# Authenticate the old continuous cross-channel and local native certificates.
stock_path=Path(DATA['oldDirectory'])/'channel/swept-stock.json';stock=json.loads(stock_path.read_text())
old_audit=json.loads((stock_path.parent/'native-report.json').read_text())
assert stock['passed'] and stock['independentChannelAngles'] and not stock['unresolvedPairs']
assert stock['casesSha256']==sha((stock_path.parent/'cases.json').read_bytes())
assert stock['nativeAuditSha256']==sha((stock_path.parent/'native-report.json').read_bytes())
assert stock['runtimeSha256']==REPORT['runtimeSha256'] and old_audit['failed']==0
base_layout=dict(DATA['layout']);base_layout['middleBase']=[-20,-15]
assert stock['layout']==base_layout
REPORT['inheritedCrossChannelProof']={'file':str(stock_path),'sha256':sha(stock_path.read_bytes()),
 'independentAngles':True,'intervalDegrees':[-20,20],'checkedCellPairs':stock['checkedCellPairs'],
 'minimumCoordinateGapMm':stock['minSeparatingCoordinateGapMm'],
 'policy':'All 27 non-crank local recipes/placements are exactly equal in all three authored poses and modes. Laminations are native-proved subsets of the old drilled crank. Hence old cross-channel bounds remain conservative.'}
# Bind sibling native proofs instead of repeating their exact Boolean pairs.
delegated=[]
for name in ['frame','crank']:
 folder=DIRECTORY.parent/name;capture=folder/'captures.json';report=folder/('native-report.json' if name=='crank' else 'report.json')
 evidence=json.loads(report.read_text());frozen=json.loads(capture.read_text())
 assert evidence['passed'] and evidence['captureSha256']==sha(capture.read_bytes())
 for item in frozen.get('sources',[]):bind(item)
 delegated.append({'kind':name,'report':str(report),'sha256':sha(report.read_bytes()),'captureSha256':sha(capture.read_bytes()),
  'currentApiBinding':'Exact componentPython source equality with all three current crankPieces poses, asserted by capture generator' if name=='crank' else 'All capture source file hashes unchanged'})
REPORT['authenticatedDeltaProofs']=delegated

# Every native child of every old occurrence is freshly contained in the
# tight full-stroke stock; this includes purchased bearing internal children.
local_cases=json.loads((stock_path.parent/'cases.json').read_text())
assert len(stock['tiers'])==1
tier=stock['tiers'][0];neutral=tier['neutralNutX'];travel=DATA['layout']['lever']*math.tan(math.radians(20))
native_path=stock_path.parent/tier['nativeNeutralFile'];assert sha(native_path.read_bytes())==tier['nativeNeutralSha256']
local=next(c for c in local_cases if c['parameters']['outputAngle']==0 and c['kinematics']['neutralNutX']==neutral)
configs={c['id']:c for c in local['billOfMaterials']['components']}
doc=App.openDocument(str(native_path));groups={}
for ob in objects(doc):groups.setdefault(ob.AssemblyOccurrenceId,[]).append(ob.Shape.copy())
App.closeDocument(doc.Name)
envelopes={};containment=[];cells_by_id={}
for identity,configuration in configs.items():
 cells=[item for item in tier['stockCells'] if item['id']==identity];cells_by_id[identity]=cells
 candidate=frame_envelope(cells,neutral,configuration,travel)
 if configuration['libraryId']=='flanged-ball-bearing':
  # The exact purchased positive cylinder/flange envelope is rotationally
  # invariant. Padding would falsely penetrate a cheek at its seating face.
  p=configuration['parameters'];w=p['width'];f=p['flangeWidth']
  candidate=Part.makeCylinder(p['outer']/2,w,App.Vector(0,0,-w/2)).fuse(
   Part.makeCylinder(p['flangeOuter']/2,f,App.Vector(0,0,w/2-f)))
  for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],configuration['placement']['rotation']):
   if angle:candidate.rotate(App.Vector(),axis,angle)
  candidate.translate(App.Vector(*configuration['placement']['translation']))
 assert valid(candidate)
 escaped=[]
 for child in groups[identity]:
  v=volume(child.cut(candidate));assert abs(v)<=EPS,(identity,'native child escapes stock',v);escaped.append(v)
 envelopes[identity]=candidate;containment.append({'id':identity,'nativeChildren':len(escaped),'maximumEscapeMm3':max(map(abs,escaped))})
REPORT['freshContinuousContainment']=containment;note('continuous-native-containment',occurrences=len(containment),nativeChildren=sum(x['nativeChildren'] for x in containment))
frame_scope=execute(DATA['frameSource']);frame=list(zip(frame_scope['components'],[
 dict(metadata,AssemblyOccurrenceId=label) for metadata,label in zip(frame_scope['component_metadata'],frame_scope['component_labels'])]))
assert len(frame)==28 and all(valid(s) for s,_ in frame)
checks=[];fallbacks=[]
for mount in DATA['cases'][0]['mounts']:
 for identity,envelope in envelopes.items():
  current=placed(envelope,mount)
  for shape,metadata in frame:
   v=overlap(current,shape)
   if abs(v)<=EPS:continue
   # Stock padding creates artificial contact at a fixed bearing flange or
   # motor face. Exact native children certify invariant contacts only.
   invariant=all(cell['motion']=='invariant' for cell in cells_by_id[identity])
   assert invariant,('Moving continuous stock intersects new frame',mount['id'],identity,metadata['AssemblyOccurrenceId'],v)
   actual=max(abs(overlap(placed(child,mount),shape)) for child in groups[identity])
   assert actual<=EPS,('Actual invariant child intersects frame',mount['id'],identity,metadata['AssemblyOccurrenceId'],actual)
   fallbacks.append({'channel':mount['id'],'occurrence':identity,'frame':metadata['AssemblyOccurrenceId'],'paddedOverlapMm3':v,'actualNativeOverlapMm3':actual})
  checks.append({'channel':mount['id'],'occurrence':identity,'frameChecks':len(frame)})
REPORT['continuousNewFrameProof']={'independentAngles':True,'intervalDegrees':[-20,20],
 'exactFrameEnvelopeChecks':len(checks)*len(frame),'invariantPaddingFallbacks':fallbacks,'results':checks}
note('continuous-frame-clearance',checks=len(checks)*len(frame),staticContactFallbacks=len(fallbacks))

# The separate guide must contain every complete original carrier reaction
# strip. Its changed roots/keys lie outside these unchanged face strips.
guide=execute(DATA['guideSource'])['shape'];body=execute(DATA['carrierBodySource'])['shape'];assert valid(guide) and valid(body)
coverage=[];roll=[]
for face in DATA['guideFaces']:
 lo,hi=face['padXEnvelope'];bottom,top=face['padZSpan'];plane=face['localFaceY']
 strip=Part.makeBox(hi-lo,.01,top-bottom,App.Vector(lo,plane-.01,bottom));strip=placed(strip,face)
 missing=volume(strip.cut(guide));assert abs(missing)<=EPS
 coverage.append({'channel':face['channel'],'faceAreaMm2':(hi-lo)*(top-bottom),'missingMm3':missing,'runningGapMm':face['runningGap']})
 for angle in [-20,0,20]:
  x=travel*angle/20 if abs(angle)==20 else 0.
  nominal=body.copy();nominal.translate(App.Vector(x,0,0));actual=placed(nominal,face)
  assert abs(overlap(actual,guide))<=EPS
  distance=actual.distToShape(guide)[0];assert abs(distance-.05)<1e-6
  for sign in [-1,1]:
   wrong=nominal.copy();wrong.rotate(App.Vector(x,0,DATA['layout']['lever']),App.Vector(1,0,0),sign)
   v=overlap(placed(wrong,face),guide);assert v>.001
   roll.append({'channel':face['channel'],'outputAngle':angle,'rollSign':sign,'oneDegreeBlockedMm3':v,'nominalGapMm':distance})
REPORT['separateGuide']={'completeReactionFaceCoverage':coverage,'forkAndFollowerPinsRemoved':True,
 'finiteBothSignRollProbes':roll,'inheritedFullModePolicy':'The source-identical carrier positive/main bore and prior source-bound Full internal-tap exclusion proof preserve these guide contacts in Full mode.'}
note('guide-anti-roll',completeFaces=len(coverage),finiteBlockedProbes=len(roll))

# Execute each unmodified public macro. A read-only Python profiler observes
# its actual local RGB arrays; geometry is not regenerated for color metadata.
for case in DATA['cases']:
 script_path=DIRECTORY/(case['name']+'.FCMacro');script=script_path.read_text()
 assert sha(script)==case['scriptSha256']
 assert '\n'.join('        '+line for line in case['source'].split('\n')) in script
 observed={}
 def observe(frame,event,arg):
  if event=='return' and frame.f_code.co_name=='_protolab_create':
   observed.update({key:frame.f_locals[key] for key in ['component_colors','component_metadata','component_labels','component_shapes']})
 doc=App.newDocument('LaserFrameMacroAudit');sentinel=doc.addObject('App::FeaturePython','ExistingDocumentSentinel')
 scope={'App':App,'Part':Part,'math':math};sys.setprofile(observe)
 try:exec(script,scope)
 finally:sys.setprofile(None)
 assert doc.getObject(sentinel.Name)
 root=next(ob for ob in doc.RootObjects if hasattr(ob,'PartId'));assert root.PartId==DATA['partId']
 assert root.GeometryMode==case['mode'] and json.loads(root.Configuration)==case['parameters']
 children=objects(doc);expected=420 if case['construction']=='laminated' else 408
 assert len(children)==expected and len({ob.AssemblyOccurrenceId for ob in children})==case['expectedConfigurations']
 assert len(observed['component_colors'])==len(children) and all(valid(ob.Shape) for ob in children)
 assert all(len(ob.Shape.Solids)==1 for ob in children if ob.Supply=='manufactured')
 signatures=[]
 for ob,rgb,metadata in zip(children,observed['component_colors'],observed['component_metadata']):
  assert ob.AssemblyOccurrenceId==metadata['AssemblyOccurrenceId']
  assert json.loads(ob.ConfigurationJSON)==json.loads(metadata['ConfigurationJSON'])
  ob.addProperty('App::PropertyFloatList','SourceRGB','Verification');ob.SourceRGB=list(rgb)
  signatures.append((ob.Label,ob.AssemblyOccurrenceId,ob.Shape.Volume,list(rgb),ob.Shape.BoundBox))
 doc.removeObject(sentinel.Name);doc.recompute();path=DIRECTORY/(case['name']+'.FCStd');doc.saveAs(str(path));App.closeDocument(doc.Name)
 doc=App.openDocument(str(path));restored=objects(doc);assert len(restored)==expected and all(valid(ob.Shape) for ob in restored)
 for ob,(label,identity,v,rgb,bounds) in zip(restored,signatures):
  assert ob.Label==label and ob.AssemblyOccurrenceId==identity
  assert abs(ob.Shape.Volume-v)<max(1e-7,abs(v)*1e-10)
  assert max(abs(a-b) for a,b in zip(ob.SourceRGB,rgb))<1e-12
  for axis in 'XYZ':
   for end in ['Min','Max']:assert abs(getattr(ob.Shape.BoundBox,axis+end)-getattr(bounds,axis+end))<1e-7
 row={'name':case['name'],'mode':case['mode'],'construction':case['construction'],'passed':True,
  'actualUnmodifiedPublicMacro':True,'existingDocumentPreserved':True,'validNativeChildren':len(restored),
  'physicalSolids':sum(len(ob.Shape.Solids) for ob in restored),'configurationOccurrences':case['expectedConfigurations'],
  'savedAndReopened':True,'labelsAndManufacturingMetadataPreserved':True,'executedSourceRGBMetadataPreserved':True,
  'colorScope':'Actual emitted RGB array observed read-only during macro execution and saved/reopened as verification metadata; display-view rendering is a separate GUI check.',
  'file':str(path),'sha256':sha(path.read_bytes()),'macroSha256':case['scriptSha256']}
 REPORT['cases'].append(row);App.closeDocument(doc.Name);note('public-macro',name=case['name'],nativeChildren=len(restored))
bindings();REPORT['passed']=True;note('complete',passed=True)
