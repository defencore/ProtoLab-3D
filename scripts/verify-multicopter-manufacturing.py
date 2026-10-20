"""Run inside FreeCAD. Native geometry and screw seating, not flight qualification."""
import FreeCAD as App, Part, json, math, time, base64, zlib, os
from pathlib import Path
from PySide import QtCore
_out=Path(__file__).resolve().parents[1]/'data/real-frame-audit'
_config=json.loads((_out/'cases.json').read_text());_cases=_config['cases']
_filter=os.environ.get('PROTOLAB_FRAME_AUDIT_FILTER','')
if _filter:_cases=[c for c in _cases if c['id'] in _filter.split(',')]
_report={'done':False,'flightQualified':False,'scope':'Source topology, preview/native bounds, sheet contacts, corrected screw bearing planes and native exports.','cases':[]}
_start=time.perf_counter();_refs={}
for m in _config['reference']:
 s=Part.Shape();s.importBrepFromString(zlib.decompress(base64.b64decode(m['brep'])).decode());_refs[m['id']]=(m,s)

def _run_frame_case(index):
 case=_cases[index];record={'id':case['id'],'passed':False}
 try:
  scope={'App':App,'Part':Part,'math':math};exec(case['code'],scope);solids=scope['components']
  assert len(solids)==len(case['components'])
  for s,id in zip(solids,case['components']):
   m,ref=_refs[id]
   assert s.isValid() and s.isClosed() and len(s.Solids)==1,('Native solid invalid',id)
   assert abs(s.Volume-ref.Volume)<1e-4,('Source volume changed',id)
   assert len(s.Faces)==len(ref.Faces),('Source face count changed',id)
  compound=Part.makeCompound(solids);vertices,_=compound.tessellate(.025)
  # OCC optimalBoundingBox can inflate trimmed helices even when using its mesh.
  actual=[max(v[k] for v in vertices)-min(v[k] for v in vertices) for k in range(3)]
  assert max(abs(x-y) for x,y in zip(actual,case['dimensions']))<.07,('Preview/native mismatch',case['dimensions'],actual)
  if case['state']=='assembled':
   byid=dict(zip(case['components'],solids))
   if case['frame']=='source-podracer-v1':
    plate=byid['source-podracer-v1-00'];pod=byid['source-podracer-v1-06']
    assert pod.common(plate).Volume<.002 and pod.distToShape(plate)[0]<.001
    feet=[]
    for x,y in [(-24,0),(0,24),(24,0),(0,-24)]:
     axis=[]
     for s,r,z,h in [(plate,1,0,1.5),(pod,.8,1.5,5)]:
      matches=[f for f in s.Faces if type(f.Surface).__name__=='Cylinder' and abs(f.Surface.Radius-r)<1e-6 and abs(f.Surface.Axis.z)>.999 and math.hypot(f.Surface.Center.x-x,f.Surface.Center.y-y)<1e-6]
      assert matches,('Pod attachment axis missing',x,y,r)
      assert Part.makeCylinder(.75,h,App.Vector(x,y,z)).common(s).Volume<1e-6
     # A 0.01 mm virtual approach must make each bearing foot contact carbon.
     moved=pod.copy();moved.translate(App.Vector(0,0,-.01))
     region=Part.makeCylinder(3.1,.05,App.Vector(x,y,1.47))
     contact=moved.common(plate).common(region).Volume/.01
     assert contact>5,('Pod foot unsupported',x,y,contact)
     feet.append({'x':x,'y':y,'bearingAreaMm2':contact})
    record['podMounts']=feet
   if case['frame'] in ['comet-y6','source-one-x8']:
    stations=_config['motorStations'][case['frame']]
    for station in stations:
     for side in ['upper','lower']:
      s=byid[case['frame']+'-'+str(station[side+'Part']).zfill(2)]
      radius=3 if case['frame']=='comet-y6' else 3.5
      axes=[f.Surface for f in s.Faces if type(f.Surface).__name__=='Cylinder' and abs(f.Surface.Radius-radius)<1e-6 and abs(f.Surface.Axis.z)>.999 and math.hypot(f.Surface.Center.x-station['x'],f.Surface.Center.y-station['y'])<1e-5]
      assert axes,('Motor shaft axis missing',station,side)
      z=station[side+'MountZ'];direction=App.Vector(0,0,-1 if side=='upper' else 1)
      assert Part.makeCylinder(2.8,1,App.Vector(station['x'],station['y'],z),direction).common(s).Volume<1e-5,('Blocked motor shaft',station,side)
    record['verifiedMotorInterfaces']=2*len(stations)
    envelope=_config['rotorEnvelopes'][case['frame']]
    for plane in envelope['planes']:
     for side in ['upper','lower']:
      z=plane[side+'PropellerZ'];height=envelope['axialEnvelope']
      rotor=Part.makeCylinder(envelope['diameter']/2,height,App.Vector(plane['x'],plane['y'],z-height/2))
      for s in solids:
       if s.BoundBox.ZMin>z+height/2 or s.BoundBox.ZMax<z-height/2:continue
       assert rotor.common(s).Volume<.002,('Default swept rotor intersects frame',case['frame'],plane,side)
    record['defaultSweptRotorEnvelopesClear']=True
   if case['frame']=='comet-y6':
    for arm in [2,7,12]:
     for plate in [0,1]:
      assert byid['comet-y6-'+str(arm).zfill(2)].distToShape(byid['comet-y6-'+str(plate).zfill(2)])[0]<.001
   if case['frame']=='source-one-v5':
    seating=[]
    lower=[19,24,25,28,29,30,31,36,39,40,41,42]
    for i in lower+[23,35]:
     screw=byid['part-'+str(i).zfill(2)];plate=byid['part-02' if i in lower else 'part-03']
     overlap=screw.common(plate).Volume;gap=screw.distToShape(plate)[0]
     assert overlap<.002,('Screw penetrates plate',i,overlap)
     assert gap<.005,('Floating screw head',i,gap)
     seating.append({'sourceIndex':i,'overlapMm3':overlap,'bearingGapMm':gap})
    record['screwSeating']=seating
    for a in [53,54,55,56]:
     for p in [2,4]:assert byid['part-'+str(a)].distToShape(byid['part-'+str(p).zfill(2)])[0]<.005
   # A source conflict is reported rather than hidden by claiming flight approval.
   sheet=[(id,s) for id,s in byid.items() if _refs[id][0]['route']=='sheet' or case['frame']=='comet-y6']
   overlaps=[]
   for ai,(aid,a) in enumerate(sheet):
    for bid,b in sheet[ai+1:]:
     v=a.common(b).Volume
     if v>.002:overlaps.append({'a':aid,'b':bid,'volumeMm3':v})
   record['sourceSheetOverlaps']=overlaps
   expected=_config['knownInterferences'][case['frame']]
   assert len(overlaps)==len(expected),('Undocumented source sheet interference',overlaps)
   for actual,known in zip(overlaps,expected):
    assert actual['a']==known['a'] and actual['b']==known['b'] and abs(actual['volumeMm3']-known['volumeMm3'])<1e-4,('Source tab fit changed',actual,known)
   if expected:record['fabricationFitPending']=True
   prior=App.ActiveDocument.Name if App.ActiveDocument else None;doc=App.newDocument('RealFrameExportAudit')
   try:
    sentinel=doc.addObject('App::FeaturePython','ExistingUserObject')
    exec((_out/(case['frame']+'.FCMacro')).read_text(),{})
    assert sentinel in doc.Objects
    roots=[o for o in doc.RootObjects if o!=sentinel];assert len(roots)==1
    objects=list(roots[0].Group);assert len(objects)==len(solids)
    step=str(_out/(case['frame']+'.step'));Part.export(objects,step)
    restored=Part.Shape();restored.read(step);assert restored.isValid() and len(restored.Solids)==len(solids)
    doc.saveAs(str(_out/(case['frame']+'.FCStd')));record['stepRoundTrip']=True
   finally:
    App.closeDocument(doc.Name)
    if prior and prior in App.listDocuments():App.setActiveDocument(prior)
  record.update(passed=True,solids=len(solids))
 except Exception as e:record['error']=str(e)
 _report['cases'].append(record);_report.update(done=index+1==len(_cases),passed=sum(c['passed'] for c in _report['cases']),failed=sum(not c['passed'] for c in _report['cases']),total=len(_cases),seconds=time.perf_counter()-_start)
 (_out/('targeted-validation.json' if _filter else 'validation.json' if App.GuiUp else 'headless-validation.json')).write_text(json.dumps(_report,indent=2))
 if App.GuiUp and index+1<len(_cases):QtCore.QTimer.singleShot(0,lambda:_run_frame_case(index+1))
if App.GuiUp:QtCore.QTimer.singleShot(0,lambda:_run_frame_case(0))
else:
 for i in range(len(_cases)):_run_frame_case(i)
print('Started',len(_cases),'native geometry checks; flight qualification is not assessed.')
