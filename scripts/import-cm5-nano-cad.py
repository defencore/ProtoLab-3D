"""Bake Waveshare CM5-NANO-A/B source STEP surfaces without reconstructing them.

Usage with FreeCAD Python: import-cm5-nano-cad.py nano-a|nano-b SOURCE.step
Only a rigid translation sets the PCB XY centre and underside Z=0. Both boards
exclude their source's optional soldered 40-way GPIO header (A:60 solids, B:120); the
source-index mapping is retained. Every selected source solid remains separate.
Preview meshing/repairs never change the native BREP. Source CAD itself contains
simplified supplier component shapes; faithful import is not physical metrology.
"""
import base64, hashlib, json, os, struct, sys, zlib
from collections import Counter
from pathlib import Path
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part, MeshPart
ROOT = Path(__file__).resolve().parents[1]
name, source_path = sys.argv[1:3]
config = {
 'nano-a': {'sha':'6a39316c42b75bd57b7a01651c6174a1287a447e1d9f833862d5c544928ddd26','solids':337,'excluded':list(range(252,312))},
 'nano-b': {'sha':'d06dc1f14b2095aef56fd06abfc7b5920c7c8fa508e7b9b330b8f560e49b79fe','solids':537,'excluded':list(range(270,390))},
}[name]
source=Path(source_path)
sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert sha==config['sha'], 'Source revision changed'
shape=Part.Shape();shape.read(str(source))
assert len(shape.Solids)==config['solids']
board_bounds=shape.Solids[0].optimalBoundingBox(False,False)
shift=[-(board_bounds.XMin+board_bounds.XMax)/2,-(board_bounds.YMin+board_bounds.YMax)/2,-board_bounds.ZMin]
def preview_mesh(solid, mesh, index):
 cleaned = 0
 if mesh.hasNonManifolds():
  before = mesh.CountFacets
  mesh.removeDuplicatedFacets()
  mesh.removeNonManifolds()
  cleaned = before - mesh.CountFacets
 points, facets = mesh.Topology
 facets = list(facets); points = list(points)
 collapsed = []
 # OCC may triangulate a tiny sliver with collinear float32 vertices. Collapse
 # only a sub-0.002 mm edge of that sliver; CAD surfaces remain untouched.
 for _ in range(200):
  bad = next((t for t in facets if (points[t[1]]-points[t[0]]).cross(points[t[2]]-points[t[0]]).Length**2 <= 1e-18),None)
  if bad is None: break
  a,b = min(((bad[j],bad[(j+1)%3]) for j in range(3)),key=lambda e:(points[e[0]]-points[e[1]]).Length)
  distance = (points[a]-points[b]).Length
  assert distance < 0.002, ('preview sliver too large',index,distance)
  facets = [tuple(a if v==b else v for v in t) for t in facets]
  facets = [t for t in facets if len(set(t))==3]
  collapsed.append(distance)
 else: raise AssertionError(('too many preview slivers',index))
 edges = Counter(tuple(sorted((t[j],t[(j+1)%3]))) for t in facets for j in range(3))
 assert max(edges.values()) <= 2, ('nonmanifold preview',index)
 boundary = [(t[(j+1)%3],t[j]) for t in facets for j in range(3) if edges[tuple(sorted((t[j],t[(j+1)%3]))) ] == 1]
 patches = []
 while boundary:
  a,b = boundary.pop(); loop = [a,b]
  while loop[-1] != loop[0]:
   found = next((e for e in boundary if e[0] == loop[-1]),None)
   assert found is not None, ('branched preview boundary',index)
   boundary.remove(found); loop.append(found[1])
  loop.pop()
  diameter = max((points[a]-points[b]).Length for a in loop for b in loop)
  assert diameter < 0.5, ('preview hole too large',index,diameter)
  center = sum((points[a] for a in loop),App.Vector()) / len(loop)
  shell = Part.makeShell(solid.Faces)
  center = Part.Vertex(center).distToShape(shell)[1][0][1]
  n = len(points); points.append(center)
  patch = [(loop[j],loop[(j+1)%len(loop)],n) for j in range(len(loop))]
  error = max(Part.Vertex((points[a]+points[b]+points[c])/3).distToShape(shell)[0] for a,b,c in patch)
  assert error < 0.015, ('preview patch deviation',index,error)
  facets.extend(patch); patches.append(dict(diameter=diameter,maxSampledSurfaceError=error,triangles=len(patch)))
 check = Counter(tuple(sorted((t[j],t[(j+1)%3]))) for t in facets for j in range(3))
 assert all(n==2 for n in check.values()), ('preview closure',index)
 return points,facets,patches,cleaned,collapsed

records,templates,template_ids=[],[],{}
for i,original in enumerate(shape.Solids):
 if i in config['excluded']: continue
 assert original.isValid() and original.isClosed() and original.Volume>0, ('source solid',i)
 solid=original.copy();solid.translate(App.Vector(*shift))
 placement=solid.Placement
 canonical=solid.copy();canonical.Placement=App.Placement()
 center=canonical.CenterOfMass;canonical.translate(-center)
 matrix=list(placement.multiply(App.Placement(center,App.Rotation())).Matrix.A)
 brep=canonical.exportBrepToString().encode()
 # Byte-identical centred source BREP is the only deduplication criterion.
 # Similar envelopes do not prove that two manufacturer shapes are equivalent.
 digest=hashlib.sha256(brep).hexdigest()
 template_id=template_ids.get(digest)
 if template_id is None:
  mesh=MeshPart.meshFromShape(Shape=canonical,LinearDeflection=0.015,AngularDeflection=0.2,Relative=False)
  points,facets,patches,cleaned,collapsed=preview_mesh(canonical,mesh,i)
  positions=[v for p in points for v in p];indices=[v for t in facets for v in t]
  template_id=len(templates);template_ids[digest]=template_id
  templates.append(dict(previewPatches=patches,previewRemovedFacets=cleaned,previewCollapsedEdges=collapsed,
   positions=base64.b64encode(struct.pack('<%sf'%len(positions),*positions)).decode(),
   indices=base64.b64encode(struct.pack('<%sI'%len(indices),*indices)).decode(),
   brep=base64.b64encode(zlib.compress(brep,9)).decode(),faces=len(original.Faces)))
  if patches or cleaned or collapsed:print('preview repairs',i,len(patches),cleaned,len(collapsed),flush=True)
 b=solid.optimalBoundingBox(False,False)
 bounds=[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]
 color='#23456b' if i==0 else '#27292c'
 if i!=0 and original.Volume>80:color='#afb4bb'
 elif i!=0 and original.Volume<0.1:color='#bba977'
 records.append(dict(label=('PCB' if i==0 else 'Source solid')+' %04d'%i,color=color,
  sourceSolid=i,template=template_id,matrix=matrix,volume=solid.Volume,bounds=bounds,
  faces=len(original.Faces),layer=0 if i==0 else (-1 if (b.ZMin+b.ZMax)/2<board_bounds.ZLength/2 else 1)))
 if len(records)%50==0:print('baked',name,len(records),'templates',len(templates),flush=True)
output=ROOT/'src/parts/compute-module-carrier/lib'/name/'native.json'
output.parent.mkdir(parents=True,exist_ok=True)
data=dict(formatVersion=2,sourceSha256=sha,sourceSolids=len(shape.Solids),selectedSolids=len(records),
 excludedSourceSolids=config['excluded'],transform=dict(rotate=0,shift=shift),
 linearDeflection=0.015,angularDeflection=0.2,templates=templates,components=records)
output.write_text(json.dumps(data,separators=(',',':'))+'\n')
print(json.dumps(dict(output=str(output),bytes=output.stat().st_size,templates=len(templates),
 sourceSha256=sha,selectedSolids=len(records),excludedSourceSolids=config['excluded'],
 faces=sum(c['faces'] for c in records),bounds=[min(c['bounds'][j] for c in records) for j in range(3)]+[max(c['bounds'][j] for c in records) for j in range(3,6)])),flush=True)
