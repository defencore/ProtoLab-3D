"""FreeCAD audit for the ST3215 recovery package, including source CAD overlaps.
Prepare: node --import tsx scripts/verify-recovery.ts /tmp/recovery-cases.json
Run using FreeCAD Python: scripts/verify-recovery.py cases.json report.json
Append --roundtrip-only to repeat metrology and FCStd roundtrips after an interference audit.
Append --step to additionally audit STEP conversion (supplier rotated shaft currently fails).
Append --changed-prefix=LABEL to recheck only pairs involving an edited component after
a full audit of the previous geometry; the report records this restricted scope.
"""
import sys,os,json,base64,zlib,time,tempfile,traceback,math
from pathlib import Path
sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App,Part
cases=json.loads(Path(sys.argv[1]).read_text());output=Path(sys.argv[2]);report=[]
check_intersections='--roundtrip-only' not in sys.argv
changed_prefix=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--changed-prefix=')),None)
source=json.loads((Path(__file__).resolve().parent.parent/'src/parts/rocket-release/lib/st3215-native.json').read_text())
def mesh_volume(shape):
 points,triangles=shape.tessellate(.01)
 center=shape.BoundBox.Center
 vertices=[p-center for p in points]
 return abs(math.fsum(vertices[a].dot(vertices[b].cross(vertices[c]))/6 for a,b,c in triangles))
for case in cases:
 started=time.time();record={'name':case['name'],'passed':False};doc=App.newDocument('RecoveryAudit')
 try:
  namespace={}
  exec(case['script'],namespace)
  root=doc.RootObjects[0];children=list(root.Group)
  assert len(children)==len(case['components'])
  assert json.loads(root.Configuration)==case['parameters']
  bounds_errors=[];volume_errors=[];metrology_errors=[]
  for child,expected in zip(children,case['components']):
   s=child.Shape
   is_hat=child.Label.startswith('BUY Waveshare Bus Servo')
   assert s.isValid() and s.isClosed() and (len(s.Solids)==361 if is_hat else len(s.Solids)==1) and s.Volume>0,(child.Label,'invalid physical component')
   assert child.Label.startswith(expected['label']),(child.Label,expected['label'])
   b=s.optimalBoundingBox(False,False)
   error=max(abs(a-b) for a,b in zip([b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax],expected['min']+expected['max']))
   bounds_errors.append(error)
   if error>=.05:metrology_errors.append((child.Label,'preview bounds',error))
   error=abs(s.Volume-expected['volume'])/s.Volume;volume_errors.append(error)
   if error>=.015:metrology_errors.append((child.Label,'preview volume',error,s.Volume,expected['volume']))
  print(case['name'],'topology checked; metrology issues:',metrology_errors,flush=True)
  native_indices={}
  for i,child in enumerate(children):
   if not child.Label.startswith('ST3215 ·'):continue
   index=next(k for k,c in enumerate(source['components']) if child.Label.startswith('ST3215 · '+c['label']+' ·'))
   s=Part.Shape();s.importBrepFromString(zlib.decompress(base64.b64decode(source['components'][index]['brep'])).decode())
   if index==5:s.rotate(App.Vector(),App.Vector(0,0,1),-5*case['parameters']['unlockAngle']*min(1,case['parameters']['release']/60))
   p=case['parameters'];angle=p['unlockAngle']*min(1,p['release']/60);lift=p['separation']*max(0,(p['release']-60)/40)
   pack=p['batteryPack']=='3x18650'
   s.translate(App.Vector(0,0,54.4 if pack else 18.4))
   s.rotate(App.Vector(),App.Vector(0,0,1),-angle);s.translate(App.Vector(0,0,-lift))
   s.rotate(App.Vector(),App.Vector(1,0,0),180);s.translate(App.Vector(0,0,56+(44 if pack else 8)))
   s=s.removeSplitter();native_indices[i]=s
   assert abs(s.Volume-child.Shape.Volume)<1e-5,(child.Label,'supplier geometry volume changed')
   assert (s.Solids[0].CenterOfMass-child.Shape.Solids[0].CenterOfMass).Length<1e-6,(child.Label,'supplier placement changed')
  if case['parameters']['drive']=='st3215-nose':
   rear=next(c for c in children if c.Label.startswith('ST3215 · Rear cover'))
   front=next(c for c in children if c.Label.startswith('ST3215 · Front cover'))
   deck=next((c for c in children if c.Label.startswith('Nose servo and gear mounting disk')),None)
   for i in range(1,5):
    clip=next(c for c in children if c.Label.startswith(f'Piston external retaining ring {i} ·'))
    plug=next(c for c in children if c.Label.startswith(f'Spring barrel bottom plug {i} ·'))
    expected=0.2+max(0,p['springTravel']-min(lift,p['springTravel']))
    assert abs(clip.Shape.distToShape(plug.Shape)[0]-expected)<1e-5,(clip.Label,'incorrect external stop clearance')
   for child in children:
    if child.Label.startswith('ST3215 machined rear mounting plate'):
     assert child.Shape.distToShape(rear.Shape)[0]<1e-5,(child.Label,'does not clamp rear case')
    if child.Label.startswith('ST3215 front support pillar'):
     assert child.Shape.distToShape(front.Shape)[0]<1e-5,(child.Label,'does not support front case')
     if deck:assert child.Shape.distToShape(deck.Shape)[0]<1e-5,(child.Label,'does not support mounting disk')
   # Probe each load-bearing contact with a 0.01 mm virtual approach. A zero
   # minimum distance alone would also pass a single-point or edge contact.
   contacts=[];pillars=[]
   for child in children:
    back=child.Label.startswith('ST3215 machined rear mounting plate')
    pillar=child.Label.startswith('ST3215 front support pillar')
    if not (back or pillar):continue
    probe=child.Shape.copy();probe.translate(App.Vector(0,0,-.01 if back else .01))
    area=probe.common(rear.Shape if back else front.Shape).Volume/.01
    assert area>2,(child.Label,'insufficient case contact area',area)
    contacts.append({'part':child.Label,'contactAreaMm2':area})
    if pillar:pillars.append(child.Shape)
   for dx,dy in [(.2,0),(-.2,0),(0,.2),(0,-.2)]:
    probe=front.Shape.copy();probe.translate(App.Vector(dx,dy,0))
    assert sum(s.common(probe).Volume for s in pillars)>1e-4,('front pilot pins do not locate case',dx,dy)
   record['servoMountContactAreas']=contacts
   record['servoLateralLocationChecked']=True
  overlaps=[];source_pairs=[]
  boxes=[c.Shape.optimalBoundingBox(False,False)for c in children]
  for i,first in enumerate(children if check_intersections else []):
   if i%20==0:print(case['name'],'interference progress',i,'/',len(children),flush=True)
   for j,second in enumerate(children[i+1:],i+1):
    if changed_prefix and not (first.Label.startswith(changed_prefix) or second.Label.startswith(changed_prefix)):continue
    a,b=boxes[i],boxes[j]
    # Skip separate or merely touching bounding boxes.
    if min(a.XMax,b.XMax)-max(a.XMin,b.XMin)<1e-6 or min(a.YMax,b.YMax)-max(a.YMin,b.YMin)<1e-6 or min(a.ZMax,b.ZMax)-max(a.ZMin,b.ZMin)<1e-6:continue
    # Avoid a global boolean across overlapping supplier subcomponents. The
    # PCB assembly is purchased as one item; check each solid against the mount.
    if first.Label.startswith('BUY Waveshare Bus Servo') or second.Label.startswith('BUY Waveshare Bus Servo'):
     board,other=(first,second) if first.Label.startswith('BUY Waveshare Bus Servo') else (second,first)
     box=other.Shape.BoundBox
     v=sum(s.common(other.Shape).Volume for s in board.Shape.Solids if s.BoundBox.intersect(box))
    else:
     c=first.Shape.common(second.Shape);v=0 if c.isNull() else c.Volume
    if i in native_indices and j in native_indices:
     original=native_indices[i].common(native_indices[j]);expected=0 if original.isNull()else original.Volume
     assert abs(v-expected)<1e-5,(first.Label,second.Label,'new source-model intersection',v,expected)
     if v>1e-5:source_pairs.append({'first':first.Label,'second':second.Label,'volume':v})
    elif v>max(1e-5,min(first.Shape.Volume,second.Shape.Volume)*1e-6):
     overlaps.append({'first':first.Label,'second':second.Label,'volume':v})
  # Actual mating volumes are checked against installed solids, not only the
  # PCB bounding box. Header pins are intentionally inside their mating body.
  service_zones=[]
  # Generated builders may scope their transform helpers inside a function.
  # Service envelopes only need these two explicitly defined rigid transforms.
  def zone_place(shape,angle,offset):
   shape.rotate(App.Vector(),App.Vector(0,0,1),angle);shape.translate(App.Vector(*offset));return shape
  def zone_rotate(shape,angle,axis):
   shape.rotate(App.Vector(),App.Vector(1,0,0) if axis=='x' else App.Vector(0,1,0),angle);return shape
  zone_scope=dict(namespace,App=App,Part=Part,_release_place=zone_place,_release_rotate=zone_rotate)
  for zone in case.get('serviceZones',[]):
   reserved=eval(zone['expression'],zone_scope);hits=[];a=reserved.BoundBox
   for child in children:
    if zone['label'].startswith('PLS mating') and 'header pin' in child.Label:continue
    b=child.Shape.BoundBox
    if min(a.XMax,b.XMax)-max(a.XMin,b.XMin)<1e-6 or min(a.YMax,b.YMax)-max(a.YMin,b.YMin)<1e-6 or min(a.ZMax,b.ZMax)-max(a.ZMin,b.ZMin)<1e-6:continue
    common=reserved.common(child.Shape)
    if not common.isNull() and common.Volume>1e-5:hits.append(child.Label)
   service_zones.append({'zone':zone['label'],'blockedBy':hits})
   assert not hits,('connector access blocked',zone['label'],hits)
  record['serviceZones']=service_zones
  assert not metrology_errors and not overlaps,('metrology',metrology_errors,'assembly interference',overlaps)
  # Export/import representative assembled poses; all poses retain individual shapes.
  roundtrip=False
  if case['name'].startswith('wing-') or case['name'] in ['locked','separated','battery-pack','battery-separated']:
   with tempfile.TemporaryDirectory(prefix='recovery-cad-')as folder:
    if '--step' in sys.argv:
     step=str(Path(folder)/'recovery.step');Part.export(children,step);restored=Part.Shape();restored.read(step)
     assert restored.isValid() and len(restored.Solids)==len(children),'STEP topology changed'
     # OCC's default volume integration changes on STEP-converted helical surfaces.
     # Compare each solid with identical fine tessellation and bounds instead.
     for child,solid in zip(children,restored.Solids):
      a=child.Shape.optimalBoundingBox(False,False);b=solid.optimalBoundingBox(False,False)
      assert max(abs(x-y)for x,y in zip([a.XMin,a.YMin,a.ZMin,a.XMax,a.YMax,a.ZMax],[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]))<.001,(child.Label,'STEP bounds changed')
      before=mesh_volume(child.Shape);after=mesh_volume(solid)
      # Re-tessellation of the 0.6 mm spring wire is not bit-identical after STEP.
      assert abs(before-after)/before<.002,(child.Label,'STEP surface volume changed',before,after)
    names=[c.Label for c in children];rootname=root.Name;fcstd=str(Path(folder)/'recovery.FCStd');doc.saveAs(fcstd)
    App.closeDocument(doc.Name);doc=App.openDocument(fcstd)
    saved=list(doc.getObject(rootname).Group)
    assert [c.Label for c in saved]==names
    assert json.loads(doc.getObject(rootname).Configuration)==case['parameters']
    invalid=[c.Label for c in saved if not (c.Shape.isValid() and c.Shape.isClosed() and (len(c.Shape.Solids)==361 if c.Label.startswith('BUY Waveshare Bus Servo') else len(c.Shape.Solids)==1))]
    assert not invalid, ('FCStd roundtrip topology', invalid)
    roundtrip=True
  record.update(passed=True,components=len(children),maxBoundsError=max(bounds_errors),maxRelativeVolumeError=max(volume_errors),intersectionsChecked=check_intersections,intersectionScope=changed_prefix or 'all pairs',newIntersections=overlaps,preservedSourceIntersections=source_pairs,roundtrip=roundtrip)
 except Exception as error:
  record['error']=str(error)
  record['traceback']=traceback.format_exc()
 finally:
  if doc and doc.Name in App.listDocuments():App.closeDocument(doc.Name)
 record['seconds']=time.time()-started;report.append(record);output.write_text(json.dumps(report,indent=2));print(json.dumps(record),flush=True)
 if not record['passed']:break
sys.exit(any(not r['passed']for r in report))
