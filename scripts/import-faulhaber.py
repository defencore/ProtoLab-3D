"""Bake FAULHABER STEP selections into runtime meshes and compressed native BREP.
Usage: FreeCAD Python scripts/import-faulhaber.py /tmp/faulhaber
Supplier archives/PDFs stay outside the repository. Mounting plane is Z=0.
"""
import base64, hashlib, json, os, struct, sys, zlib
from pathlib import Path
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import MeshPart
ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
# The AM STEP archives place alternative executions side-by-side, not assemblies.
# Select single front shaft, round PCB where offered; AM3248 execution 00.
selections = {'2232': (0, 0), '2250': (0, 0), '3242': (0, 0), '3268': (0, 0),
              'AM0820': (1, 9), 'AM1020': (1, 11), 'AM1524': (3, 32),
              'AM2224': (0, 0), 'AM2224R3': (0, 0), 'AM3248': (0, 0)}
for series, (index, x) in selections.items():
    path = next((source / series).rglob('*.stp'))
    original = Part.Shape(); original.read(str(path))
    shape = original.Solids[index].copy()
    shape.translate(App.Vector(-x, 0, 0))
    assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1
    positions, indices, groups = [], [], []
    # Per-face tessellation retains sharp CAD edges while smoothing curved faces.
    for face in shape.Faces:
        mesh = MeshPart.meshFromShape(Shape=face, LinearDeflection=0.012,
                                      AngularDeflection=0.12, Relative=False)
        points, facets = mesh.Topology
        offset = len(positions) // 3
        start = len(indices)
        positions.extend(c for p in points for c in p)
        indices.extend(v + offset for f in facets for v in f)
        # Cosmetic material only; geometry remains the unmodified supplier solid.
        silver = face.CenterOfMass.z > -0.01 or not series.startswith('AM')
        groups.append([start, len(indices)-start, 0 if silver else 1])
    bbox = shape.optimalBoundingBox(False, False)
    def packed(fmt, values): return base64.b64encode(struct.pack('<%s%s' % (len(values), fmt), *values)).decode()
    record = dict(sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                  sourceFile=path.name, sourceSolid=index, translation=[-x, 0, 0],
                  bounds=[bbox.XMin,bbox.YMin,bbox.ZMin,bbox.XMax,bbox.YMax,bbox.ZMax],
                  volume=shape.Volume, positions=packed('f',positions), indices=packed('I',indices),
                  groups=groups, brep=base64.b64encode(zlib.compress(shape.exportBrepToString().encode(),9)).decode())
    family='am' if series.startswith('AM') else 'bx4'
    out=ROOT/'src/parts'/('faulhaber-'+family)/'lib'/('native-'+series+'.json')
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(record,separators=(',',':'))+'\n')
    print(series, out.stat().st_size, [round(v,3) for v in record['bounds']], flush=True)
