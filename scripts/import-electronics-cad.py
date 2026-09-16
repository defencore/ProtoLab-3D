"""Bake source STEP solids without reconstructing their surfaces.

Run with FreeCAD Python: import-electronics-cad.py feather|pi5 SOURCE.step
Source hashes lock the precise manufacturer revision. No solid healing, scaling,
booleans or shape simplification is performed. Preview tessellation is separate
from the exact BREP used for CAD exports. Colors are illustrative.
"""
import base64, hashlib, json, os, struct, sys, zlib
from collections import Counter
from pathlib import Path
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part, MeshPart, Mesh
ROOT = Path(__file__).resolve().parents[1]
name, source_path = sys.argv[1:3]
source = Path(source_path)
config = {
 'feather': {'part':'nrf52840', 'solids':61, 'board':0, 'rotate':90, 'shift':[11.43,-25.4,0]},
 'pi5': {'part':'raspberry-pi', 'solids':2689, 'board':2688, 'rotate':0, 'shift':[-42.5,-28,0]},
}[name]
sha = hashlib.sha256(source.read_bytes()).hexdigest()
assert sha == {'feather':'77f9e8d9deba17aee67a93ea8fe38eb4aea36aa4d70febbff5465d9b83be4975','pi5':'78164070c1cc7ab854382950d2e85926c6e35432f1e5a146b733397a7c6afb44'}[name], 'Source revision changed'
shape = Part.Shape(); shape.read(str(source))
assert len(shape.Solids) == config['solids']
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

records, templates, template_ids, template_shapes = [], [], {}, []
for i, original in enumerate(shape.Solids):
 assert original.isValid() and original.isClosed() and original.Volume > 0, i
 solid = original.copy()
 solid.rotate(App.Vector(), App.Vector(0,0,1), config['rotate'])
 solid.translate(App.Vector(*config['shift']))
 placement = solid.Placement
 canonical = solid.copy(); canonical.Placement = App.Placement()
 center = canonical.CenterOfMass
 canonical.translate(-center)
 matrix = list(placement.multiply(App.Placement(center,App.Rotation())).Matrix.A)
 cb = canonical.optimalBoundingBox(False,False)
 signature = tuple(round(v,5) for v in [canonical.Volume,canonical.Area,cb.XLength,cb.YLength,cb.ZLength])
 template_id = None
 for candidate in template_ids.get(signature,[]):
  other = template_shapes[candidate]
  # Equivalent centered geometry only; never deduplicate on dimensions alone.
  left, right = canonical.cut(other), other.cut(canonical)
  delta = abs(left.Volume) + abs(right.Volume)
  if left.isValid() and right.isValid() and delta < 1e-8:
   template_id = candidate
   break
 brep = canonical.exportBrepToString().encode()
 if template_id is None:
  mesh = MeshPart.meshFromShape(Shape=canonical, LinearDeflection=0.015, AngularDeflection=0.2, Relative=False)
  points, facets, patches, cleaned, collapsed = preview_mesh(canonical, mesh, i)
  positions = [c for point in points for c in point]
  indices = [v for triangle in facets for v in triangle]
  template_id = len(templates)
  template_ids.setdefault(signature,[]).append(template_id)
  template_shapes.append(canonical)
  templates.append(dict(previewPatches=patches,previewRemovedFacets=cleaned,previewCollapsedEdges=collapsed,
   positions=base64.b64encode(struct.pack('<%sf'%len(positions),*positions)).decode(),
   indices=base64.b64encode(struct.pack('<%sI'%len(indices),*indices)).decode(),
   brep=base64.b64encode(zlib.compress(brep,9)).decode()))
  if patches or cleaned or collapsed: print('preview repairs',i,len(patches),cleaned,len(collapsed),flush=True)
 b = solid.optimalBoundingBox(False,False)
 bounds = [b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]
 color = '#27292c'
 if i == config['board']: color = '#247648' if name == 'pi5' else '#244251'
 elif name == 'feather' and i in [25,26,13,14]: color = '#afb4bb'
 elif name == 'pi5' and i in [1339,1340,1600,1601,1939,554]: color = '#afb4bb'
 elif original.Volume < 0.1: color = '#bba977'
 records.append(dict(label=('PCB' if i == config['board'] else 'Source solid') + ' %04d'%i,
  color=color,sourceSolid=i,template=template_id,matrix=matrix,volume=solid.Volume,bounds=bounds,
  layer=0 if i==config['board'] else (-1 if (b.ZMin+b.ZMax)/2<0 else 1)))
 if i%200==0: print('baked',i,'templates',len(templates),flush=True)
output=ROOT/'src/parts'/config['part']/'lib'/name/'native.json'
output.write_text(json.dumps(dict(formatVersion=2,sourceSha256=sha,sourceSolids=len(records),transform=config,
 linearDeflection=0.015,angularDeflection=0.2,templates=templates,components=records),separators=(',',':'))+'\n')
print(json.dumps(dict(output=str(output),bytes=output.stat().st_size,templates=len(templates),sourceSha256=sha)),flush=True)
