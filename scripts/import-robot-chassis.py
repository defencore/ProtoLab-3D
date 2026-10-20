"""Import pinned manufacturer chassis CAD without reconstructing source surfaces.

Run with FreeCAD Python: scripts/import-robot-chassis.py [romi|pirate-4wd|ugv-rover]
Sources belong in /tmp/protolab-real-chassis. Each physical leaf solid is retained.
Only a common rigid pose is changed: X is longitudinal, Y transverse, Z up, the
lowest source geometry is Z=0. Preview triangulation is separate from native
BRep. Illustrative group colors are not supplier material specifications.
"""
import base64, hashlib, json, lzma, math, os, struct, sys, zlib
from collections import Counter, defaultdict
from pathlib import Path
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part, MeshPart, Import

ROOT = Path(__file__).resolve().parents[1]
SOURCES = Path('/tmp/protolab-real-chassis')
OUTPUT = ROOT / 'src/parts/rover-chassis/lib/native'
SPECS = {
 'romi': dict(name='Pololu Romi chassis kit',sourceFile='romi-chassis-kit.step',file='romi.step',sha='38bb9571c9125f7f00ea12be1d8b85326b6557a96ddf9451932069ee58991be9',url='https://www.pololu.com/file/0J1298/romi-chassis-kit.step',rotation=[1,1,1,120]),
 'pirate-4wd': dict(name='DFRobot Pirate 4WD ROB0003',sourceFile='ROB0003.STEP',file='pirate4wd.step',sha='f0d62d2059f8768b2dc3f59a09711e0dd0d591e612bdfb3d32db2e6cd813584f',url='https://raw.githubusercontent.com/CainZ/ROB003/master/ROB0003.STEP',rotation=[1,1,1,120]),
 'ugv-rover': dict(name='Waveshare UGV Rover PI4B AI Kit',file='ugv-rover/UGV Rover PI4B AI Kit.step',sha='eec517fb278c336c5d6a2ec11636f60eb74c1b5a5c9743081220462e1903b6e0',url='https://files.waveshare.com/wiki/UGV-Rover/UGV_Rover_PI4B_AI_Kit.zip',rotation=[0,0,1,0]),
}
COLORS = {'structure':0x697582,'drive':0x24272b,'hardware':0xb2b8be,'electronics':0x23633d,'power':0x333e49}

def physical_leaves(doc):
 # STEP App::Part containers expose aggregate shapes. Exclude them to prevent
 # counting a part again at each assembly level. All leaves are split by solid.
 return [o for o in doc.Objects if o.TypeId in ('Part::Feature','App::Link') and hasattr(o,'Shape') and not o.Shape.isNull() and o.Shape.Solids]

def source_shape(obj):
 s=obj.Shape.copy()
 # Shape.Placement includes the object's local Placement, but excludes a
 # containing App::Part pose. Add only its global parent transform.
 parent=obj.getGlobalPlacement().multiply(obj.Placement.inverse())
 s.Placement=parent.multiply(s.Placement)
 return s

def metadata(model,index,source_label,solid_index,count,bounds,ancestors):
 label=source_label
 group='structure'
 if model=='romi':
  label=['Moulded chassis with battery bays','Removable battery cover','Drive wheel left','Drive wheel right','Front ball caster'][index]
  group='drive' if index in (2,3,4) else 'structure'
 elif model=='pirate-4wd':
  labels={0:'Front chassis cross member',9:'Right chassis side wall',18:'Left chassis side wall',19:'Rear chassis cross member',20:'Upper equipment deck',25:'Inner upper chassis plate',28:'Lower chassis plate',29:'Wheel hub front right',30:'Tyre front right',31:'Tyre rear right',32:'Wheel hub rear right',33:'Tyre front left',34:'Wheel hub front left',35:'Wheel hub rear left',36:'Tyre rear left',37:'Upper deck standoff rear right',38:'Upper deck standoff front right',39:'Upper deck standoff front left',40:'Upper deck standoff rear left',41:'Power switch body',42:'Power switch lock washer',43:'Power switch inner nut',44:'Power switch outer nut',45:'DC socket inner barrel',46:'DC socket body',47:'DC socket lock nut'}
  label=labels.get(index,'Chassis captive nut %02d'%index)
  group='drive' if 29<=index<=36 else 'power' if index in (41,45,46) else 'structure' if index in (0,9,18,19,20,25,28) else 'hardware'
 else:
  u=source_label.upper();context=' / '.join(a for a in ancestors if not a.upper().startswith('UGV ROVER')).upper()
  if any(x in u for x in ('HOLDER','BASE-STR','SURFACE','DOWN-SIDE','1020')) or u=='PLANE':group='structure'
  elif any(x in u for x in ('MOTOR','JGB37','GEARED','COUPL','WHEEL','TYRE','TIRE','80MM','F624','BEAR','HUB','BELT','620','DRIVE')):group='drive'
  elif any(x in u for x in ('SCREW','NUT','WASHER','BOLT','STANDOFF','M2','M3','M4','GB_','ISO','DIN','尼龙柱')):group='hardware'
  elif any(x in u for x in ('BATTERY','18650','POWER','DC5521','自锁开关','电池','电源')):group='power'
  elif any(x in (u+' / '+context) for x in ('PCB','RASPBERRY','PI4','CAMERA','IMX','ESP','LCD','USB','MIC','OLED','LIDAR','ROBOT','BOARD','JETSON','CONTROL','SENSOR','VOLT','RPI4MODELB','ROS DRIVER','OLED-JT','12V LED','RPI CAMERA','WIFI-AT')):group='electronics'
  if 'WIFI-AT' in context and source_label in ('BASE','WIRE','AT'):
   label={'BASE':'Wi-Fi antenna base','WIRE':'Wi-Fi antenna cable','AT':'Wi-Fi antenna'}[source_label]
  # Translate the upstream Chinese article labels for the visible library; the
  # original exact sourceLabel remains in metadata for source tracing.
  translations={'黑色金属杯头内六角螺丝':'Black socket cap screw ','银色金属螺丝':'Zinc plated screw ','六角铜柱':'Brass hex standoff ','黑色金属沉头螺丝':'Black countersunk screw ','黑色半透明亚克力':'Translucent acrylic panel','扣式塞头':'Snap-in blanking plug','1020铝型材':'1020 aluminium extrusion','1020堵头B':'1020 extrusion end cap','80mm轮毂':'80 mm wheel hub','80mm轮胎':'80 mm tyre','尼龙柱 7*4.2*25':'Nylon standoff 7 x 4.2 x 25','自锁开关':'Self-locking power switch'}
  for old,new in translations.items():label=label.replace(old,new)
  if not label.isascii():
   # Preserve technical ASCII identifiers; avoid guessing untranslated shapes.
   ascii_name=''.join(c if c.isascii() else ' ' for c in label)
   ascii_name=' '.join(ascii_name.split()).strip(' _-')
   label=('Source '+ascii_name if ascii_name else 'Source '+group+' component')
 if count>1:label+=' — solid %d/%d'%(solid_index+1,count)
 return label,group

def topology(mesh):
 vs,ts=mesh.Topology
 vs=list(vs);ts=[tuple(t) for t in ts if len(set(t))==3]
 edges=Counter(tuple(sorted((t[j],t[(j+1)%3]))) for t in ts for j in range(3))
 return vs,ts,edges

def uncached_closed_mesh(solid,model,index):
 # A purchased PCB is an atomic assembly in the library, but its source solids
 # keep independent vertex indices even where pads and package bodies touch.
 if len(solid.Solids)>1:
  vertices=[];triangles=[];notes=[];angles=[]
  for si,child in enumerate(solid.Solids):
   vs,ts,packed,child_notes,angle=closed_mesh(child,model,str(index)+'.'+str(si))
   offset=len(vertices);vertices.extend(vs);triangles.extend(tuple(v+offset for v in t) for t in ts);angles.append(angle)
   notes.extend(child_notes)
  packed=struct.pack('<%sf'%(len(vertices)*3),*[float(v) for p in vertices for v in p])
  return vertices,triangles,packed,list(dict.fromkeys(notes)),min(angles)
 notes=[]
 angles=[.35,.2,.15,.12,.1]
 for angle in angles:
  mesh=MeshPart.meshFromShape(Shape=solid,LinearDeflection=.05,AngularDeflection=angle,Relative=False)
  before=mesh.CountFacets;mesh.removeDuplicatedFacets()
  if mesh.hasNonManifolds():mesh.removeNonManifolds()
  removed=before-mesh.CountFacets
  if removed:notes.append('Preview only: removed %d duplicated/nonmanifold OCC facets before bounded omission checks; native BRep unchanged.'%removed)
  vs,ts,edges=topology(mesh)
  if all(n==2 for n in edges.values()):
   if angle!=angles[0]:notes.append('OCC preview uses finer %.2f rad angular sampling to close source tessellation seams; native BRep unchanged.'%angle)
   break
 else:
  # Match the library's established electronics importer: small OCC omitted
  # patches may be closed in the preview while the source BRep stays exact.
  assert max(edges.values())<=2,('Nonmanifold source preview',model,index)
  boundary=[(t[(j+1)%3],t[j]) for t in ts for j in range(3) if edges[tuple(sorted((t[j],t[(j+1)%3]))) ]==1]
  patches=[]
  while boundary:
   a,b=boundary.pop();loop=[a,b]
   while loop[-1]!=loop[0]:
    found=next((e for e in boundary if e[0]==loop[-1]),None)
    assert found is not None,('Branched source preview omission',model,index)
    boundary.remove(found);loop.append(found[1])
   loop.pop();diameter=max((vs[a]-vs[b]).Length for a in loop for b in loop)
   center=sum((vs[a] for a in loop),App.Vector())/len(loop)
   source_face=None
   if diameter>=.5:
    # A larger missing planar patch must be evidenced by one original trimmed
    # CAD face. Quarter-grid barycentric samples test interiors and all edges,
    # rather than assuming an arbitrary fan belongs to the source surface.
    for face in solid.Faces:
     if not isinstance(face.Surface,Part.Plane):continue
     if any(Part.Vertex(vs[a]).distToShape(face)[0]>.015 for a in loop):continue
     projected=Part.Vertex(center).distToShape(face)[1][0][1]
     possible=[(vs[loop[j]],vs[loop[(j+1)%len(loop)]],projected) for j in range(len(loop))]
     error=0
     for pa,pb,pc in possible:
      for u in range(5):
       for v in range(5-u):
        point=(pa*u+pb*v+pc*(4-u-v))/4
        error=max(error,Part.Vertex(point).distToShape(face)[0])
     if error<.015:source_face=face;center=projected;break
    assert source_face is not None,('Large preview omission lacks same-face evidence',model,index,diameter)
   else:
    shell=Part.makeShell(solid.Faces);center=Part.Vertex(center).distToShape(shell)[1][0][1]
   n=len(vs);vs.append(center);patch=[(loop[j],loop[(j+1)%len(loop)],n) for j in range(len(loop))]
   if source_face is None:
    error=max(Part.Vertex((vs[a]+vs[b]+vs[c])/3).distToShape(shell)[0] for a,b,c in patch)
   assert error<.015,('Source preview patch deviation',model,index,error)
   ts.extend(patch);patches.append((diameter,error))
   if diameter>=.5:notes.append('Preview only: triangulated an OCC-omitted %.6f mm planar patch; every barycentric quarter-grid sample lies on the same original trimmed CAD face within %.9f mm. Native BRep unchanged.'%(diameter,error))
  edges=Counter(tuple(sorted((t[j],t[(j+1)%3]))) for t in ts for j in range(3))
  assert all(n==2 for n in edges.values()),('Source preview not closed after tiny patch',model,index)
  small=sum(d<.5 for d,e in patches)
  if small:notes.append('Preview only: closed %d OCC omissions smaller than 0.5 mm diameter with sampled source-surface deviation below 0.015 mm; native BRep unchanged.'%small)
 # Native topological indexing preserves coincident source seam vertices. Never
 # weld float32 coordinates: doing so can merge separate thin source features.
 positions=[float(v) for p in vs for v in p]
 # Verify serialized float32 coordinates before publishing the preview.
 packed=struct.pack('<%sf'%len(positions),*positions)
 fp=list(struct.iter_unpack('<fff',packed))
 collapsed=[]
 for _ in range(200):
  bad=None
  for a,b,c in ts:
   pa,pb,pc=fp[a],fp[b],fp[c]
   u=[pb[k]-pa[k] for k in range(3)];v=[pc[k]-pa[k] for k in range(3)]
   cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
   if sum(x*x for x in cross)<=1e-24:bad=(a,b,c);break
  if bad is None:break
  distance=lambda a,b:sum((fp[a][k]-fp[b][k])**2 for k in range(3))**.5
  a,b=min(((bad[j],bad[(j+1)%3]) for j in range(3)),key=lambda e:distance(*e));d=distance(a,b)
  if d>=.002:
   # A zero-area stitch triangle sometimes bridges a split straight edge on
   # one face and an unsplit edge on its neighbour. Preserve every source point
   # and split the opposite triangle at the existing collinear middle point.
   left,right=max(((bad[j],bad[(j+1)%3]) for j in range(3)),key=lambda e:distance(*e));middle=next(v for v in bad if v not in (left,right))
   assert abs(distance(left,middle)+distance(middle,right)-distance(left,right))<1e-6,('Noncollinear source preview stitch',model,index)
   neighbours=[t for t in ts if t!=bad and left in t and right in t]
   assert len(neighbours)==1,('Ambiguous source preview stitch',model,index,len(neighbours))
   neighbour=neighbours[0];opposite=next(v for v in neighbour if v not in (left,right))
   forward=next(neighbour[(j+1)%3]==right for j in range(3) if neighbour[j]==left)
   if not forward:left,right=right,left
   ts.remove(bad);ts.remove(neighbour);ts.extend([(left,middle,opposite),(middle,right,opposite)])
   notes.append('Preview only: removed a zero-area collinear OCC stitch by splitting its adjacent triangle at an existing source vertex; every source point and native BRep is preserved.')
   continue
  ts=[tuple(a if v==b else v for v in t) for t in ts];ts=[t for t in ts if len(set(t))==3];collapsed.append(d)
 else:raise AssertionError(('Too many float32 source preview slivers',model,index))
 edges=Counter(tuple(sorted((t[j],t[(j+1)%3]))) for t in ts for j in range(3))
 assert all(n==2 for n in edges.values()),('Source preview closure after float32 serialization',model,index)
 if collapsed:notes.append('Preview only: collapsed %d float32 sliver edges shorter than 0.002 mm; native BRep unchanged.'%len(collapsed))
 return vs,ts,packed,notes,angle

def closed_mesh(solid,model,index):
 cache=SOURCES/'preview-cache';cache.mkdir(exist_ok=True)
 key=hashlib.sha256(solid.exportBrepToString().encode()).hexdigest()
 path=cache/(key+'.json')
 if path.exists():
  data=json.loads(path.read_text());packed=zlib.decompress(base64.b64decode(data['vertices']))
  vertices=[App.Vector(*v) for v in struct.iter_unpack('<fff',packed)]
  triangles=list(struct.iter_unpack('<III',zlib.decompress(base64.b64decode(data['triangles']))))
  return vertices,triangles,packed,data['notes'],data['angle']
 vertices,triangles,packed,notes,angle=uncached_closed_mesh(solid,model,index)
 path.write_text(json.dumps(dict(vertices=encode(packed),triangles=encode(struct.pack('<%sI'%(len(triangles)*3),*[v for t in triangles for v in t])),notes=notes,angle=angle),separators=(',',':')))
 return vertices,triangles,packed,notes,angle

def encode(data):return base64.b64encode(zlib.compress(data,9)).decode('ascii')
def encode_brep(data):return base64.b64encode(lzma.compress(data,preset=6)).decode('ascii')

def mounting_surfaces(components):
 surfaces=[]
 for c in components:
  if c['group']!='structure':continue
  shape=Part.Shape();shape.importBrepFromString(lzma.decompress(base64.b64decode(c['brep'])).decode())
  for fi,face in enumerate(shape.Faces):
   if not isinstance(face.Surface,Part.Plane) or face.normalAt(0,0).z<.999999 or face.Area<500:continue
   b=face.optimalBoundingBox(False,False)
   if b.ZLength>1e-5:continue
   circles=[]
   for wire in face.Wires:
    if wire.isSame(face.OuterWire) or not wire.Edges:continue
    curves=[edge.Curve for edge in wire.Edges];curve=curves[0]
    if all(isinstance(q,Part.Circle) for q in curves) and .5<=curve.Radius<=12 and all(abs(q.Radius-curve.Radius)<1e-4 and (q.Center-curve.Center).Length<1e-4 for q in curves) and abs(wire.Length-2*math.pi*curve.Radius)<1e-3:
     center=curve.Center;circles.append(dict(x=center.x,y=center.y,radius=curve.Radius))
   surfaces.append(dict(componentId=c['id'],label=c['label']+' upper planar face',faceIndex=fi,z=face.CenterOfMass.z,area=face.Area,bounds=[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax],circles=circles))
 surfaces.sort(key=lambda r:r['area'],reverse=True);selected=[]
 for row in surfaces:
  if any(row['componentId']==v['componentId'] for v in selected):continue
  selected.append(row)
  if len(selected)>=3:break
 return selected

def repair_source_topology(shape):
 original=shape.copy();before=original.optimalBoundingBox(False,False)
 raw_brep=original.exportBrepToString().encode();original_brep=encode_brep(raw_brep);original_sha=hashlib.sha256(raw_brep).hexdigest()
 for operation in ('fix(1e-7,1e-7,1e-5)','removeSplitter'):
  candidate=original.copy()
  try:
   if operation.startswith('fix'):candidate.fix(1e-7,1e-7,1e-5)
   else:candidate=candidate.removeSplitter()
   if not (candidate.isValid() and candidate.isClosed() and len(candidate.Solids)==len(original.Solids) and candidate.Volume>0):continue
   after=candidate.optimalBoundingBox(False,False)
   bb=lambda b:[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]
   delta_bounds=max(abs(a-b) for a,b in zip(bb(before),bb(after)))
   delta_volume=abs(candidate.Volume-original.Volume);delta_area=abs(candidate.Area-original.Area)
   if delta_bounds>1e-5 or delta_volume>1e-5 or delta_area>1e-5:continue
   difference=None;difference_note=None
   try:
    difference=abs(original.cut(candidate).Volume)+abs(candidate.cut(original).Volume)
    if difference>1e-5:continue
   except Exception as exc:difference_note=type(exc).__name__+': '+str(exc)
   repair=dict(operation=operation,originalBrep=original_brep,originalBrepCompression='xz',originalBrepSha256=original_sha,originalVolume=original.Volume,repairedVolume=candidate.Volume,originalArea=original.Area,repairedArea=candidate.Area,originalBounds=bb(before),repairedBounds=bb(after),maxBoundsDelta=delta_bounds,symmetricDifferenceVolume=difference,symmetricDifferenceNote=difference_note)
   return candidate,repair
  except Exception:continue
 return None,dict(originalBrep=original_brep,originalBrepCompression='xz',originalBrepSha256=original_sha,originalVolume=original.Volume,originalArea=original.Area)

def ancestors_of(obj):
 result=[];todo=list(obj.InList);seen=set()
 while todo:
  ancestor=todo.pop()
  if ancestor.Name in seen:continue
  seen.add(ancestor.Name);result.append(ancestor);todo.extend(ancestor.InList)
 return result

def electronics_product(obj):
 keys=('RASPBERRY PI 4 MODEL B','RPI AUDIO HAT','ROS DRIVER FOR ROBOTS','IMX335','OLED-JT','12V LED','PI-FAN-3007','ROS FAN')
 return next((a for a in reversed(ancestors_of(obj)) if any(k in a.Label.upper() for k in keys)),None)

def import_model(model):
 spec=SPECS[model];path=SOURCES/spec['file'];sha=hashlib.sha256(path.read_bytes()).hexdigest()
 assert spec['sha'] is None or sha==spec['sha'],('Pinned manufacturer source changed',model,sha)
 doc=None;prepared_path=SOURCES/(model+'-prepared-v3.json')
 if prepared_path.exists():
  prepared=json.loads(prepared_path.read_text());assert prepared['sourceSha256']==sha
  entries=[]
  for entry in prepared['entries']:
   shapes=[]
   for data in entry.pop('shapeBreps'):
    shape=Part.Shape();shape.importBrepFromString(zlib.decompress(base64.b64decode(data)).decode());shapes.append(shape)
   entry['shapes']=shapes;entries.append(entry)
  source_count=prepared['sourceSolids'];source_leaves=prepared['sourceLeaves'];omissions=prepared['omissions']
 else:
  cache=SOURCES/(model+'-import.FCStd')
  if cache.exists():doc=App.openDocument(str(cache))
  else:
   doc=App.newDocument('import_'+model.replace('-','_'));Import.insert(str(path),doc.Name);doc.recompute();doc.saveAs(str(cache))
  leaves=physical_leaves(doc);entries=[];electronic_groups={};omissions=[];source_count=0
  for i,obj in enumerate(leaves):
   solids=source_shape(obj).Solids
   for si,s in enumerate(solids):
    assert s.isClosed() and s.Volume>0,('Open/nonpositive original manufacturer solid',model,i,si)
    source_valid=s.isValid()
    if not source_valid:print('Original source validity warning',model,i,si,obj.Label,flush=True)
    source_count+=1
    repair=None
    if not source_valid:
     assert model=='ugv-rover' and electronics_product(obj) is not None,('Invalid original structural/drive source is never omitted or reconstructed',model,obj.Label)
     fixed,repair=repair_source_topology(s)
     if fixed is None:
      omissions.append(dict(sourceObject=obj.Name,sourceLabel=obj.Label,reason='Original nonstructural electronics solid is invalid; bounded topological repair could not preserve geometry within 0.00001 mm3 volume / 0.00001 mm bounds.',**repair))
      continue
     s=fixed;print('Bounded source topology repair',model,i,repair['operation'],flush=True)
    ancestors=[a.Label for a in ancestors_of(obj)]
    label,group=metadata(model,i,obj.Label,si,len(solids),[],ancestors)
    info=dict(sourceObject=obj.Name,sourceLabel=obj.Label,sourceSolid=si,nativeSourceValid=source_valid,topologyRepair=repair)
    product=electronics_product(obj) if model=='ugv-rover' else None
    if product:
     if product.Name not in electronic_groups:
      entry=dict(label=product.Label,group='electronics',sources=[],shapes=[])
      electronic_groups[product.Name]=entry;entries.append(entry)
     electronic_groups[product.Name]['shapes'].append(s.copy());electronic_groups[product.Name]['sources'].append(info)
    else:entries.append(dict(label=label,group=group,sources=[info],shapes=[s.copy()]))
  # Two upstream electronic features are shells rather than solid STEP entities.
  # A closed valid shell may be wrapped without changing a single surface. Open
  # shells remain explicitly reported omissions, never guessed or capped.
  for obj in doc.Objects:
   if obj.TypeId!='Part::Feature' or obj.Shape.isNull() or obj.Shape.Solids:continue
   source=source_shape(obj);shells=source.Shells
   if shells and all(sh.isClosed() for sh in shells):
    solids=[Part.makeSolid(sh) for sh in shells]
    if all(s.isValid() and s.Volume>0 for s in solids):
     product=electronics_product(obj)
     entry=electronic_groups.get(product.Name) if product else None
     if entry:
      entry['shapes'].extend(solids);entry['sources'].append(dict(sourceObject=obj.Name,sourceLabel=obj.Label,sourceSolid='closed shell wrapped as solid'))
      source_count+=len(solids)
      continue
   omissions.append(dict(sourceObject=obj.Name,sourceLabel=obj.Label,reason='Original STEP feature is not a closed valid volumetric solid; source surfaces are not capped or healed.',faces=len(source.Faces),shells=len(shells)))
  source_leaves=len(leaves)
  saved=[]
  for entry in entries:
   saved.append(dict(label=entry['label'],group=entry['group'],sources=entry['sources'],shapeBreps=[encode(shape.exportBrepToString().encode()) for shape in entry['shapes']]))
  prepared_path.write_text(json.dumps(dict(sourceSha256=sha,sourceSolids=source_count,sourceLeaves=source_leaves,omissions=omissions,entries=saved),separators=(',',':')))
 rot=spec['rotation'];rotation=App.Rotation(App.Vector(*rot[:3]),rot[3])
 for entry in entries:
  for s in entry['shapes']:s.Placement=App.Placement(App.Vector(),rotation).multiply(s.Placement)
 bb=Part.makeCompound([s for entry in entries for s in entry['shapes']]).optimalBoundingBox(False,False)
 shift=App.Vector(-(bb.XMin+bb.XMax)/2,-(bb.YMin+bb.YMax)/2,-bb.ZMin)
 records=[]
 for num,entry in enumerate(entries):
  for s in entry['shapes']:s.translate(shift)
  s=entry['shapes'][0] if len(entry['shapes'])==1 else Part.makeCompound(entry['shapes'])
  b=s.optimalBoundingBox(False,False);bounds=[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax];analytical_bounds=None
  if model=='ugv-rover' and num in (70,71,72,73):
   analytical_bounds=bounds;points,_=s.tessellate(.005)
   bounds=[min(p[k] for p in points) for k in range(3)]+[max(p[k] for p in points) for k in range(3)]
  label,group=entry['label'],entry['group']
  vs,ts,packed,notes,angle=closed_mesh(s,model,num)
  volume=sum(vs[a].dot(vs[b].cross(vs[c])) for a,b,c in ts)/6
  assert volume>0,('Inward source mesh',model,num,volume)
  assert abs(volume-s.Volume)/s.Volume<.02,('Preview volume mismatch',model,num,volume,s.Volume)
  brep=s.exportBrepToString().encode()
  records.append(dict(id='%s-%03d'%(model,num),label=label,group=group,color=COLORS[group],sourceObjects=entry['sources'],nativeValid=s.isValid(),solids=len(s.Solids),bounds=bounds,volume=s.Volume,brep=encode_brep(brep),brepSha256=hashlib.sha256(brep).hexdigest(),vertices=encode(packed),triangles=encode(struct.pack('<%sI'%(len(ts)*3),*[v for t in ts for v in t])),nativeTopology=True,previewNotes=notes,angularDeflection=angle,vertexCount=len(vs),triangleCount=len(ts)))
  if analytical_bounds is not None:
   records[-1]['analyticalBounds']=analytical_bounds;records[-1]['boundsMethod']='Native trimmed-surface tessellation at 0.005 mm chord; old OCC analytical overbound retained separately.'
  print(model,num+1,'/',len(entries),label,group,len(s.Solids),'solids',len(ts),'triangles',flush=True)
 out=dict(id=model,name=spec['name'],sourceUrl=spec['url'],sourceSha256=sha,sourceFile=spec.get('sourceFile',Path(spec['file']).name),linearDeflection=.05,brepCompression='xz',meshCompression='zlib',nativeTopology=True,sourceLeaves=source_leaves,sourceSolids=source_count,retainedSourceSolids=sum(c['solids'] for c in records),omissions=omissions,normalization=dict(rotationAxis=rot[:3],rotationDegrees=rot[3],translation=list(shift)),components=records)
 lo=[min(c['bounds'][i] for c in records) for i in range(3)];hi=[max(c['bounds'][i+3] for c in records) for i in range(3)]
 for row in omissions:
  row['label']=row['sourceLabel']
  if 'originalVolume' in row:row['volume']=row['originalVolume']
 out['bounds']=lo+hi;out['dimensions']=[hi[i]-lo[i] for i in range(3)];out['mountingSurfaces']=mounting_surfaces(records)
 if model=='ugv-rover':
  out['sourceArchiveSha256']='194c99e8760356f9392de1936e74fe281257e51c7312bd08d114a963463c3c3e'
  out['sourceNotes']=['All chassis, deck, rail, wheel, tyre and motor surfaces retain their manufacturer geometry and relative placements; only one shared rigid display pose is normalized.','Three originally invalid 65.6388797 mm3 electronics connector bodies and two non-solid electronics source features are excluded and recorded under omissions; valid structural and drive solids are retained.','Detailed electronics are grouped into purchased source products while each original valid solid remains inside the native compound. Preview-only OCC triangulation cleanup is recorded per component.']
 OUTPUT.mkdir(parents=True,exist_ok=True);target=OUTPUT/(model+'.json');target.write_text(json.dumps(out,separators=(',',':'))+'\n')
 print(json.dumps(dict(output=str(target),bytes=target.stat().st_size,components=len(records),solids=source_count,omissions=[dict(sourceObject=v['sourceObject'],sourceLabel=v['sourceLabel'],reason=v['reason']) for v in omissions],dimensions=out['dimensions'],groups=dict(Counter(c['group'] for c in records)))),flush=True)
 if doc is not None:App.closeDocument(doc.Name)

for model in (sys.argv[1:] or list(SPECS)):import_model(model)
