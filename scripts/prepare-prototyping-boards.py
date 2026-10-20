"""Bake declared PY perfboard reconstructions; requires FreeCAD Python.

Source photographs are linked and hashed in models.json, not embedded here.
Each board is an analytically perforated solid plus a compound of isolated
copper annuli and edge pads per side. No iterative thousand-hole CSG or
thousand-object document tree is needed at runtime.
"""
import base64
from collections import Counter
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import sys
import time
import zlib

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import MeshPart
import Part

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'src/parts/prototyping-board'
COPPER = .035


def encoded(data):
    return base64.b64encode(zlib.compress(data, 9)).decode('ascii')


def bounds(shape):
    b = shape.BoundBox
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]


def circle(x, y, radius, z):
    return Part.Wire([Part.makeCircle(radius, App.Vector(x, y, z))])


def rectangle(x, y, length, width, z):
    return Part.makePolygon([App.Vector(x-length/2, y-width/2, z),
                             App.Vector(x+length/2, y-width/2, z),
                             App.Vector(x+length/2, y+width/2, z),
                             App.Vector(x-length/2, y+width/2, z),
                             App.Vector(x-length/2, y-width/2, z)])


def plate(wires, height):
    return Part.makeFace(wires, 'Part::FaceMakerBullseye').extrude(App.Vector(0, 0, height))


def bake(shape, label, index):
    assert shape.isValid() and shape.isClosed() and shape.Volume > 0, label
    assert all(s.isValid() and s.isClosed() and s.Volume > 0 for s in shape.Solids), label
    native = MeshPart.meshFromShape(Shape=shape, LinearDeflection=.02, AngularDeflection=.5, Relative=False)
    points, triangles = native.Topology
    packed = struct.pack('<%sf' % (len(points)*3), *[v for p in points for v in p])
    floats = list(struct.iter_unpack('<fff', packed))
    # FreeCAD may keep identical boundary points per solid; weld only exact packed coordinates.
    keys = [tuple(v) for v in floats]
    edges = Counter(tuple(sorted((keys[t[j]], keys[t[(j+1) % 3]]))) for t in triangles for j in range(3))
    assert all(n == 2 for n in edges.values()), (label, 'open mesh boundary')
    vectors = [App.Vector(*p) for p in floats]
    volume = sum(vectors[a].dot(vectors[b].cross(vectors[c])) / 6 for a,b,c in triangles)
    assert volume > 0 and abs(volume-shape.Volume)/shape.Volume < .01, (label, volume, shape.Volume)
    for a,b,c in triangles:
        assert (vectors[b]-vectors[a]).cross(vectors[c]-vectors[a]).Length > 1e-12
    brep = shape.exportBrepToString().encode()
    roundtrip = Part.Shape()
    roundtrip.importBrepFromString(brep.decode())
    assert roundtrip.isValid() and roundtrip.isClosed()
    assert len(roundtrip.Solids) == len(shape.Solids)
    assert abs(roundtrip.Volume-shape.Volume) < 1e-6
    return dict(label=label, sourceSolid=index, positions=encoded(packed),
                indices=encoded(struct.pack('<%sI' % (len(triangles)*3), *[i for t in triangles for i in t])),
                groups=[[0,len(triangles)*3,0]], brep=encoded(brep),
                brepSha256=hashlib.sha256(brep).hexdigest(), bounds=bounds(shape), volume=shape.Volume,
                solidCount=len(shape.Solids), vertexCount=len(points), triangleCount=len(triangles),
                meshProof=dict(closed=True, edgeIncidence=2, float32Volume=volume,
                               volumeRelativeError=abs(volume-shape.Volume)/shape.Volume))


def generate(model):
    started = time.monotonic()
    m = model
    print(m['id'] + ': building perforated substrate', flush=True)
    holes = [((x-(m['columns']-1)/2)*m['pitch'], (y-(m['rows']-1)/2)*m['pitch'])
             for y in range(m['rows']) for x in range(m['columns'])]
    mounts = [(sx*m['mountPitchX']/2, sy*m['mountPitchY']/2) for sx in [-1,1] for sy in [-1,1]]
    bottom = COPPER
    top = m['thickness'] - (COPPER if m['sides'] == 2 else 0)
    wires = [rectangle(0, 0, m['length'], m['width'], bottom)]
    wires.extend(circle(x,y,m['holeDiameter']/2,bottom) for x,y in holes)
    wires.extend(circle(x,y,m['mountDiameter']/2,bottom) for x,y in mounts)
    substrate = plate(wires, top-bottom)
    print(m['id'] + ': checking all open holes', flush=True)
    assert len(substrate.Solids) == 1
    # Every hole centre must be genuinely empty; a mid-thickness ray crosses no solid.
    for x,y in holes+mounts:
        assert not substrate.isInside(App.Vector(x,y,(top+bottom)/2), 1e-8, True)
    expected = (m['length']*m['width'] - len(holes)*math.pi*(m['holeDiameter']/2)**2
                - len(mounts)*math.pi*(m['mountDiameter']/2)**2)*(top-bottom)
    assert abs(substrate.Volume-expected) < .0001
    components = [substrate]
    labels = ['Perforated FR4 substrate']
    for z, label in [(0,'Bottom copper pads')] + ([(m['thickness']-COPPER,'Top copper pads')] if m['sides'] == 2 else []):
        if m.get('padSides'):
            count=m['padSides']
            outer=Part.makePolygon([App.Vector(m['padDiameter']/2*math.cos((i%count)*2*math.pi/count+math.pi/count),
                                               m['padDiameter']/2*math.sin((i%count)*2*math.pi/count+math.pi/count),z)
                                    for i in range(count+1)])
        else:
            outer=circle(0,0,m['padDiameter']/2,z)
        ring = plate([outer,circle(0,0,m['holeDiameter']/2,z)], COPPER)
        pads = []
        for x,y in holes:
            pad=ring.copy()
            pad.translate(App.Vector(x,y,0))
            pads.append(pad)
        for sx in [-1,1]:
            for i in range(m['sidePadCount']):
                # Rounded exposed edge lands; no authored circuit traces.
                x = sx*m['sidePadCenterX']
                y = (i-(m['sidePadCount']-1)/2)*m['sidePadPitch']
                length,width=m['sidePadLength'],m['sidePadWidth']
                radius=width/2
                pad=Part.makeBox(length-width,width,COPPER,App.Vector(x-(length-width)/2,y-radius,z))
                pad=pad.fuse(Part.makeCylinder(radius,COPPER,App.Vector(x-(length-width)/2,y,z)))
                pad=pad.fuse(Part.makeCylinder(radius,COPPER,App.Vector(x+(length-width)/2,y,z))).removeSplitter()
                pads.append(pad)
        components.append(Part.makeCompound(pads))
        labels.append(label)
    assembled=Part.makeCompound(components)
    print(m['id'] + ': baking native components and preview meshes', flush=True)
    assert assembled.isValid() and assembled.isClosed()
    assert all(abs(a-b)<1e-7 for a,b in zip([assembled.BoundBox.XLength,assembled.BoundBox.YLength,assembled.BoundBox.ZLength],[m['length'],m['width'],m['thickness']]))
    baked=[bake(shape,label,i) for i,(shape,label) in enumerate(zip(components,labels))]
    asset=dict(id=m['id'],sourceFile=m['photoUrl'].rsplit('/',1)[1], sourceSha256=m['sourceSha256'],
               sourceUrl=m['sourceUrl'], sourcePhotoUrl=m['photoUrl'],
               geometryEvidence='source-dimensions', factoryGeometryUnmodified=False,
               geometryOrigin='Authored analytical reconstruction; not manufacturer CAD.',
               assumptions=['Pad dimensions and mounting centres reconstructed from photo.',
                            'Copper thickness 0.035 mm; plating barrels and silkscreen omitted.'] +
                           ([] if m['thicknessVerified'] else ['Board thickness 1.5 mm and hole diameter 0.8 mm assumed.']),
               gridHoles=[list(h) for h in holes],mountingHoles=[dict(x=x,y=y,diameter=m['mountDiameter']) for x,y in mounts],
               dimensions=[m['length'],m['width'],m['thickness']],components=baked)
    if m.get('mountPhotoMismatch'):
        asset['assumptions'].append('Published supplier-table mounting-bore diameter retained; photograph shows larger openings and may depict another execution. Confirm the delivered bore before choosing mounting hardware.')
    destination=PACKAGE/'lib/native'/(m['id']+'.json')
    destination.write_text(json.dumps(asset,separators=(',',':'))+'\n')
    # Independent STEP round trip validates native export, analytic circular holes and solids.
    step=Path('/tmp')/(m['id']+'-audit.step')
    print(m['id'] + ': checking independent STEP round trip', flush=True)
    assembled.exportStep(str(step))
    restored=Part.read(str(step))
    assert restored.isValid() and restored.isClosed()
    assert len(restored.Solids)==len(assembled.Solids)
    assert abs(restored.Volume-assembled.Volume) < .001
    restored_substrate = max(restored.Solids, key=lambda s: s.Volume)
    assert all(not restored_substrate.isInside(App.Vector(x,y,m['thickness']/2),1e-8,True) for x,y in holes+mounts)
    result=dict(model=m['id'],dimensions=asset['dimensions'],gridHoles=len(holes),mountingHoles=4,
                components=len(components),solids=len(assembled.Solids),closed=True,allHoleCentresOpen=True,
                stepRoundTrip=True,assetBytes=destination.stat().st_size,
                seconds=round(time.monotonic()-started,3),
                meshes=[dict(label=c['label'],triangles=c['triangleCount'],**c['meshProof']) for c in baked])
    print(json.dumps(result),flush=True)
    return result


if __name__ == '__main__':
    models=json.loads((PACKAGE/'lib/models.json').read_text())
    report=ROOT/'test-results/prototyping-board-native-audit.json'
    existing=json.loads(report.read_text()) if report.exists() else []
    reports=[generate(m) for m in models if not sys.argv[1:] or m['id'] in sys.argv[1:]]
    updated={r['model']:r for r in existing}
    updated.update({r['model']:r for r in reports})
    report.parent.mkdir(exist_ok=True)
    report.write_text(json.dumps(list(updated.values()),indent=2)+'\n')
