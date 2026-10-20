"""Bake pinned KiCad 9.0.1 connector STEP references into private native assets.

Run with FreeCAD Python: scripts/import-signal-connectors.py [model-id ...]
Source files are downloaded separately to /tmp/protolab-signal-connectors using
catalog.json downloadUrl. This importer is offline and rejects changed source
hashes after first import. Original KiCad PCB origins and poses are retained;
Z=0 is the source PCB reference, so solder tails may extend below it.
No geometry repair, scaling or component omission is performed.
Use --colors-only with ordinary Python to refresh only proven source colors;
this mode asserts that all source geometry and dimensions stay identical.
"""
import base64,copy,hashlib,json,math,os,struct,sys,zlib
from signal_connector_colors import source_solid_colors, packed_color, geometry_fingerprint
from collections import Counter
from pathlib import Path
sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
COLORS_ONLY='--colors-only' in sys.argv
if not COLORS_ONLY:
 import FreeCAD as App
 import Part,MeshPart
ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'src/parts/signal-connector'
CATALOG=PACKAGE/'lib/catalog.json'
SOURCES=Path('/tmp/protolab-signal-connectors')
rows=json.loads(CATALOG.read_text())
COLOR_EVIDENCE=PACKAGE/'lib/color-evidence.json'
color_evidence=json.loads(COLOR_EVIDENCE.read_text()) if COLOR_EVIDENCE.exists() else {'method':'AP214 surface styles: uniform color must be established for every face of a solid; curve styles excluded. Mixed or missing styles retain explicitly illustrative fallback colors.', 'models':{}}
requested=[arg for arg in sys.argv[1:] if arg!='--colors-only']

def b64(data):return base64.b64encode(zlib.compress(data,9)).decode('ascii')
def bbox(shape):
 b=shape.BoundBox;return [b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]
def volume(vertices,triangles):
 return sum(vertices[a].dot(vertices[b].cross(vertices[c]))/6 for a,b,c in triangles)
def mesh(solid):
 for angle in [.25,.15,.1,.07]:
  m=MeshPart.meshFromShape(Shape=solid,LinearDeflection=.025,AngularDeflection=angle,Relative=False)
  vs,ts=m.Topology;ts=[tuple(t) for t in ts]
  edges=Counter(tuple(sorted((t[j],t[(j+1)%3]))) for t in ts for j in range(3))
  if all(n==2 for n in edges.values()):
   measured=volume(vs,ts)
   if measured<0:ts=[(a,c,b) for a,b,c in ts];measured=-measured
   assert abs(measured-solid.Volume)<max(.001,solid.Volume*.015),(measured,solid.Volume)
   return vs,ts,angle
 raise ValueError('Source tessellation is not closed; no automatic patching is allowed')

for row in rows:
 if requested and row['id'] not in requested:continue
 source=SOURCES/row['file'];data=source.read_bytes();sha=hashlib.sha256(data).hexdigest()
 if row.get('sourceSha256'):assert row['sourceSha256']==sha,('Changed source',row['id'])
 target=PACKAGE/'lib/native'/ (row['id']+'.json')
 if COLORS_ONLY:
  asset=json.loads(target.read_text());before=copy.deepcopy(asset)
  evidence=source_solid_colors(data.decode('utf-8'),len(asset['components']))
  for component,entry in zip(asset['components'],evidence):
   if entry['kind']=='source-step':component['color']=packed_color(entry['rgb'])
  # Strictly prohibit changes to any geometry, source identity or dimensions.
  for previous,current in zip(before['components'],asset['components']):
   previous.pop('color');candidate=dict(current);candidate.pop('color');assert previous==candidate
  for key in asset:
   if key!='components':assert before[key]==asset[key]
  color_evidence['models'][row['id']]={'sourceSha256':sha,'geometryFingerprint':geometry_fingerprint(asset),'components':evidence}
  target.write_text(json.dumps(asset,separators=(',',':'))+'\n')
  print(row['id'],'source-colored',sum(e['kind']=='source-step' for e in evidence),'of',len(evidence),flush=True)
  continue
 source_shape=Part.read(str(source));solids=source_shape.Solids
 assert solids and all(s.isValid() and s.isClosed() and s.Volume>0 for s in solids),('Invalid source',row['id'])
 components=[]
 largest=max(range(len(solids)),key=lambda i:solids[i].Volume)
 evidence=source_solid_colors(data.decode('utf-8'),len(solids))
 for index,s in enumerate(solids):
  vs,ts,angle=mesh(s);raw=s.exportBrepToString().encode('utf-8')
  # Complete uniform-solid source styles take priority over illustrative fallbacks.
  dark_family=row['family'] in ['JST XH','JST PH','2.54 mm header','IDC','3.5 mm TRS']
  color=packed_color(evidence[index]['rgb']) if evidence[index]['kind']=='source-step' else 0x3a3e44 if index==largest and dark_family else 0xadb6c0
  positions=struct.pack('<%sf'%(len(vs)*3),*[v for p in vs for v in (p.x,p.y,p.z)])
  indices=struct.pack('<%sI'%(len(ts)*3),*[v for t in ts for v in t])
  components.append(dict(id='source-solid-%d'%(index+1),label=row['name']+' · source solid %d'%(index+1),sourceSolid=index+1,sourceSolids=1,color=color,bounds=bbox(s),volume=s.Volume,brep=b64(raw),brepSha256=hashlib.sha256(raw).hexdigest(),vertices=b64(positions),triangles=b64(indices),vertexCount=len(vs),triangleCount=len(ts),angularDeflection=angle))
 asset=dict(id=row['id'],sourceFile=row['file'],sourceUrl=row['sourceUrl'],sourceSha256=sha,origin='KiCad source PCB origin; original coordinates retained; solder tails can extend below Z=0.',brepCompression='zlib',linearDeflection=.025,sourceSolids=len(solids),bounds=bbox(source_shape),dimensions=[source_shape.BoundBox.XLength,source_shape.BoundBox.YLength,source_shape.BoundBox.ZLength],components=components)
 target.write_text(json.dumps(asset,separators=(',',':'))+'\n')
 color_evidence['models'][row['id']]={'sourceSha256':sha,'geometryFingerprint':geometry_fingerprint(asset),'components':evidence}
 row['sourceSha256']=sha
 print(row['id'],len(solids),sum(c['triangleCount'] for c in components),round(target.stat().st_size/1024),flush=True)
if not COLORS_ONLY:CATALOG.write_text(json.dumps(rows,indent=2)+'\n')
COLOR_EVIDENCE.write_text(json.dumps(color_evidence,indent=2)+'\n')
