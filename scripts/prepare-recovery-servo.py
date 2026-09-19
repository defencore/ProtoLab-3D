"""Bake the direct-drive release spline and CAD-fit reference retaining screw.
Run with FreeCAD Python. Six installed servo solids remain identical to the catalog.
The reference fastener copies the supplier's modeled bore; it is not a verified ISO screw.
"""
import sys, os, json, zlib, base64, math, struct
from pathlib import Path
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as A, Part, MeshPart
ROOT=Path(__file__).resolve().parents[1]
j=json.loads((ROOT/'src/parts/servo-motor/lib/waveshare/native.json').read_text())
s=Part.Shape();s.importBrepFromString(zlib.decompress(base64.b64decode(j['components'][5]['brep'])).decode())
sec=s.section(Part.makePlane(100,100,A.Vector(-50,-50,30)))
wires=[Part.Wire(edges) for edges in Part.sortEdges(sec.Edges)]
for w in wires:
 if w.BoundBox.XLength > 5:
  points=[[v.x,v.y] for v in w.discretize(Deflection=.002)]
  points=[[x*(1+.04/math.hypot(x,y)),y*(1+.04/math.hypot(x,y))] for x,y in points]
  if math.dist(points[0],points[-1])<1e-6:points.pop()
  (ROOT/'src/parts/rocket-release/lib/st3215-spline.json').write_text(json.dumps(points)+'\n')

shaft=Part.Shape();shaft.importBrepFromString(zlib.decompress(base64.b64decode(j['components'][5]['brep'])).decode())
path=Part.Wire(Part.makeHelix(.3,2.1,1.2).Edges)
pts=[A.Vector(1.18,0,-.06),A.Vector(1.44,0,0),A.Vector(1.18,0,.06)]
profile=Part.Wire(Part.makePolygon(pts+[pts[0]]).Edges)
ridge=path.makePipeShell([profile],True,True)
ridge.rotate(A.Vector(),A.Vector(0,0,1),-75.7);ridge.translate(A.Vector(0,0,29.45))
ridge=ridge.common(Part.makeCylinder(2,1.85,A.Vector(0,0,29.6)))
t=Part.makeCylinder(1.2,3.2,A.Vector(0,0,29.6)).fuse(ridge).fuse(Part.makeCylinder(2.5,1,A.Vector(0,0,32.8)))
pts=[A.Vector(1.2*math.cos(i*math.pi/3),1.2*math.sin(i*math.pi/3),33.2) for i in range(6)]
t=t.cut(Part.Face(Part.makePolygon(pts+[pts[0]])).extrude(A.Vector(0,0,1))).removeSplitter()
assert t.isValid() and len(t.Solids)==1
mesh=MeshPart.meshFromShape(Shape=t,LinearDeflection=.005,AngularDeflection=.08,Relative=False)
print('retainer volumes',t.Volume,mesh.Volume,'interference',t.common(shaft).Volume,flush=True)
points,facets=mesh.Topology;b=t.optimalBoundingBox(False,False)
record=dict(label='Output retaining screw (CAD-fit reference)',color='#929eac',sourceSolid=None,derived='Reference fastener with reduced 0.3 mm-pitch helical ridge matching supplier CAD bore phase; assumed head Ø5×1 and hex recess. Actual supplied screw must be checked.',volume=t.Volume,bounds=[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax],positions=base64.b64encode(struct.pack('<%sf'%(len(points)*3),*[v for p in points for v in p])).decode(),indices=base64.b64encode(struct.pack('<%sI'%(len(facets)*3),*[v for f in facets for v in f])).decode(),brep=base64.b64encode(zlib.compress(t.exportBrepToString().encode(),9)).decode())
j['components']=j['components'][:8]+[record]

(ROOT/'src/parts/rocket-release/lib/st3215-native.json').write_text(json.dumps(j,separators=(',',':'))+'\n')
