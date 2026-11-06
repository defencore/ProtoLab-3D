import sys,json,math,time,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
V=App.Vector
out=Path('test-results/tr8-quad-geared-rocker-lightened-cables');d=json.loads((out/'cable-capture.json').read_text());start=time.monotonic();report={'passed':False,'scope':'Direct-axis valid primitive route envelopes with positive endpoint overlap, against unchanged core poses, conservative motor envelopes, actual new end discs and all20stand shanks. Virtual fused-tool topology is not used.','families':[]}
def save(stage):report['stage']=stage;report['elapsedSeconds']=time.monotonic()-start;(out/'cable-candidate-native-report.json').write_text(json.dumps(report,indent=2)+'\n');print(stage,flush=True)
def overlap(a,b):
 if any(min(getattr(a.BoundBox,k+'Max'),getattr(b.BoundBox,k+'Max'))-max(getattr(a.BoundBox,k+'Min'),getattr(b.BoundBox,k+'Min'))<1e-8 for k in'XYZ'):return 0.
 return abs(a.common(b).Volume)
def matrix(e):
 m=App.Matrix()
 for r in range(4):
  for c in range(4):setattr(m,'A'+str(r+1)+str(c+1),e[r+4*c])
 return m
def _pl_transform(shape,translation,rotation):
 for axis,angle in zip([V(1,0,0),V(0,1,0),V(0,0,1)],rotation):
  if angle:shape.rotate(V(),axis,angle)
 shape.translate(V(*translation));return shape
def wireparts(route,ports):
 radius=route['clearanceProbeRadius'];points=[V(*x)for x in route['centerline']];parts=[];edges=[]
 for i,point in enumerate(points):
  ball=Part.makeSphere(radius,point);parts.append(ball)
  if i+1<len(points):
   delta=points[i+1]-point;pipe=Part.makeCylinder(radius,delta.Length,point,delta);assert pipe.isValid()and pipe.isClosed();parts.append(pipe)
   for end in[point,points[i+1]]:assert overlap(pipe,Part.makeSphere(radius,end))>1e-6,('Disconnected leg endpoint',route['id'],i)
 port=next(p for p in ports if p['id']==route['portId']);axis=V(*port['axis']);distance=(V(*port['outerPoint'])-points[-1]).Length+.2;parts.append(Part.makeCylinder(radius,distance,points[-1],axis))
 assert all(p.isValid()and p.isClosed()and len(p.Solids)==1 for p in parts)
 return parts

def wire_overlap(parts,other):return sum(overlap(p,other)for p in parts)

try:
 for f,h in dict(d['sources'],**d['preserved']).items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,('Stale source',f)
 rods={}
 for s in d['standMountStations']:
  a=V(*s['axis']);p=V(*s['plateFace'])-a*3.6;rods[s['id']]=Part.makeCylinder(1.65,80,p,a)
 for family in d['families']:
  motor=family['motor'];old={}
  for f in(Path('test-results/tr8-quad-geared-rocker-five-stand/native-shapes')/motor).glob('*.brep'):
   if f.stem.startswith('cover-')or f.stem.endswith('-end-disc'):continue
   s=Part.Shape();s.read(str(f));old[f.stem]=s

  for end in ['upper','lower']:
   cap=Part.Shape();cap.read(str(out/'native-metal'/motor/(end+'-end-disc.brep')));old[end+'-end-disc']=cap
  initial={x['id']:x for x in family['poses'][0]['occurrences']};details={'motor':motor,'routes':[]};report['families'].append(details);cache={}
  for route in family['routes']:
   wire=wireparts(route,family['routing']['ports'])
   rd={'id':route['id'],'radius':route['clearanceProbeRadius'],'validPrimitiveCount':len(wire),'positiveEndpointOverlapGraph':True,'includesOutsidePortExtension':True,'virtualShankHits':[],'poses':[]};details['routes'].append(rd)
   for key,rod in rods.items():
    v=wire_overlap(wire,rod)
    if v>1e-6:rd['virtualShankHits'].append([key,v])
   assert not rd['virtualShankHits'],('Stand-shank cable crossing',route['id'],rd['virtualShankHits'])
   rd['allAngleGearStockHits']=[]
   for g in family['gearStocks']:
    stock=Part.makeCylinder(g['radius'],g['height'],V(*g['origin']),V(*g['axis']));v=wire_overlap(wire,stock)
    if v>1e-6:rd['allAngleGearStockHits'].append([g['id'],g['kind'],v])
   assert not rd['allAngleGearStockHits'],('Cable/full-rim envelope',route['id'],rd['allAngleGearStockHits'])
   for pose in family['poses']:
    shapes={};hits=[]
    for item in pose['occurrences']:
     key=item['id'];neutral=initial[key]
     if item['libraryId']in['surpass-2838','surpass-2845']:
      s=Part.makeCylinder(14,family['routing']['motorLength'],V(0,0,-family['routing']['motorLength'])).fuse(Part.makeCylinder(1.5875,family['routing']['motorLength']+15,V(0,0,-family['routing']['motorLength'])));s.transformShape(matrix(item['frame']))
     else:
      assert item['parameters']==neutral['parameters'],('Nonrigid core',key)
      s=old[key].copy();s.transformShape(matrix(item['frame']).multiply(matrix(neutral['frame']).inverse()))
     ck=(route['id'],key,item['key']);v=cache.get(ck)
     if v is None:v=wire_overlap(wire,s);cache[ck]=v
     if v>1e-6:hits.append([key,v])
    # Existing panels are stronger supersets of the newly lightened ones.
    for key,s in old.items():
     if key.endswith('-case-panel') or key.endswith('-end-disc'):
      v=wire_overlap(wire,s)
      if v>1e-6:hits.append([key,v])
    rd['poses'].append({'angle':pose['angle'],'hits':hits});save(motor+' '+route['id']+' '+str(pose['angle'])+' checked')
    assert not hits,('Cable/core collision',motor,route['id'],pose['angle'],hits)
  details['completed']=True
 report['passed']=True;save('all maximum raw route probes passed')
except BaseException as e:report['error']=str(e);save('FAILED');raise
