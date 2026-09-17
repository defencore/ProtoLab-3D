"""Bake explicitly selected FAULHABER STEP solids for the runtime library.
Usage: FreeCAD Python scripts/import-faulhaber-drives.py manifest.json models.json
Inputs are research files outside the repository. Never copies source archives/PDFs.
manifest maps asset keys to a STEP path and solid indices; models maps part families
 to catalog models whose assets reference those keys. Runtime BREP supports native export.
"""
import base64, hashlib, json, os, struct, sys, zlib
from pathlib import Path
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import MeshPart
root = Path(__file__).resolve().parents[1]
manifest = json.loads(Path(sys.argv[1]).read_text())
models = json.loads(Path(sys.argv[2]).read_text())
selected = set(sys.argv[3:])
def packed(fmt, values):
    return base64.b64encode(zlib.compress(struct.pack('<%s%s' % (len(values), fmt), *values), 9)).decode()
for family, rows in models.items():
    out = root / 'src/parts' / ('faulhaber-' + family) / 'lib'
    out.mkdir(parents=True, exist_ok=True)
    keys = sorted({a['key'] for r in rows for a in r['assets']})
    for key in keys:
        if selected and key not in selected:
            continue
        selection = manifest[key]
        path = Path(selection['path'])
        source = Part.Shape(); source.read(str(path))
        result = dict(sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(), sourceFile=path.name, components=[])
        for index in selection['solids']:
            shape = source.Solids[index]
            assert shape.isValid() and shape.isClosed() and shape.Volume > 0, (key, index)
            positions, indices, groups = [], [], []
            for face in shape.Faces:
                mesh = MeshPart.meshFromShape(Shape=face, LinearDeflection=0.02, AngularDeflection=0.15, Relative=False)
                # OCC can omit valid planar STEP faces with touching trim wires.
                # Reorder their edges for tessellation only; native BREP stays original.
                if not mesh.CountFacets and face.Area > 1e-8:
                    assert isinstance(face.Surface, Part.Plane), (key, 'Unmeshed non-planar face')
                    planar = Part.Face(Part.Wire(face.Edges))
                    assert planar.isValid() and abs(planar.Area - face.Area) < max(1e-4, face.Area * 1e-5)
                    if planar.normalAt(0, 0).dot(face.normalAt(0, 0)) < 0:
                        planar.reverse()
                    mesh = MeshPart.meshFromShape(Shape=planar, LinearDeflection=0.02, AngularDeflection=0.15, Relative=False)
                    assert mesh.CountFacets, (key, 'Unmeshed face')
                points, facets = mesh.Topology
                offset, start = len(positions) // 3, len(indices)
                positions.extend(c for p in points for c in p)
                indices.extend(v + offset for f in facets for v in f)
                groups.append([start, len(indices)-start, 0])
            bbox = shape.optimalBoundingBox(False, False)
            result['components'].append(dict(sourceSolid=index,
                bounds=[bbox.XMin,bbox.YMin,bbox.ZMin,bbox.XMax,bbox.YMax,bbox.ZMax], volume=shape.Volume,
                positions=packed('f',positions), indices=packed('I',indices), groups=groups,
                brep=base64.b64encode(zlib.compress(shape.exportBrepToString().encode(),9)).decode()))
        dest = out / ('native-' + key + '.json')
        dest.write_text(json.dumps(result,separators=(',',':'))+'\n')
        print(family, key, dest.stat().st_size, flush=True)
    imports = [f'import n{i} from "./native-{key}.json";' for i,key in enumerate(keys)]
    (out / 'native.ts').write_text('\n'.join(imports) + '\nexport const nativeModels = {\n' + ',\n'.join(f'  {json.dumps(key)}: n{i}' for i,key in enumerate(keys)) + '\n};\n')
