"""Derive the functional housing asset from the user-supplied STEP, without bundling it.
Run with FreeCAD Python: import-bevel-gearbox-housing.py input.step output.json
Only solid 0 (the housing) is retained. The three placeholder gears are discarded.
"""
import sys, json, hashlib, base64, zlib, struct
from pathlib import Path
sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
source, target = map(Path, sys.argv[1:3])
assembly = Part.read(str(source))
assert len(assembly.Solids) == 4, 'Expected the supplied housing and three placeholder gears'
shape = assembly.Solids[0]
bounds = shape.BoundBox
assert shape.isValid() and all(abs(a-b) < 1e-5 for a,b in zip(
    [bounds.XMin,bounds.YMin,bounds.ZMin,bounds.XMax,bounds.YMax,bounds.ZMax],
    [0,0,0,42,42,42])), 'Unexpected source housing dimensions or coordinate system'
shape.translate(App.Vector(-21, -21, -21))
original_volume = shape.Volume
# Local positive Z points outward from the shared gear apex; ports +X, +Z, -Z.
def orient(s, port):
    if port == 'x': s.rotate(App.Vector(), App.Vector(0,1,0),90)
    if port == 'minus-z': s.rotate(App.Vector(), App.Vector(0,1,0),180)
    return s
for port in ['x','z','minus-z']:
    # 61802 bearing 15x24x5, support at z=12.85; ring groove 24 mm DIN 472 family.
    cutters = [Part.makeCylinder(12, 10, App.Vector(0,0,12.85)),
               Part.makeCylinder(12.6, 1.3, App.Vector(0,0,17.9)),
               Part.makeCylinder(7.6, 12, App.Vector(0,0,10)),
               Part.makeCylinder(11.15, 7, App.Vector(0,0,7))]
    for c in cutters: shape = shape.cut(orient(c, port))
shape = shape.removeSplitter()
assert shape.isValid() and len(shape.Solids)==1
vertices, faces = shape.tessellate(0.025)
positions = [float(v) for pt in vertices for v in (pt.x,pt.y,pt.z)]
indices = [i for f in faces for i in f]
b=shape.BoundBox
record={'sourceName':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceSolids':4,'retainedSolid':0,'originalVolume':original_volume,'volume':shape.Volume,
        'bounds':[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax],
        'modifications':['Translate (-21,-21,-21) mm','Three bearing seats Ø24 at local z12.85..21','Three bore circlip grooves Ø25.2 x1.3 at z17.9','Journal clearance Ø15.2','Gear clearance Ø22.3'],
        'brep':base64.b64encode(zlib.compress(shape.exportBrepToString().encode())).decode(),
        'positions':base64.b64encode(struct.pack('<%sf'%len(positions),*positions)).decode(),
        'indices':base64.b64encode(struct.pack('<%sI'%len(indices),*indices)).decode()}
target.write_text(json.dumps(record,separators=(',',':'))+'\n')
print(json.dumps({k:v for k,v in record.items() if k not in ['brep','positions','indices']},indent=2))
