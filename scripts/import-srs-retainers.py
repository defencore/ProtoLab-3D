"""Bake TE customer-view STEP models, preserving the source BREP surfaces.

Run with FreeCAD Python. The single solid supplied in each source is retained;
no missing clip, initiator or holder geometry is fabricated.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import zlib

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import MeshPart

root = Path(__file__).resolve().parents[1]
# Download the source STEP revisions from the TE product links before rebaking.
source_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('srs-retainer-sources')
records = {}
for key in [1, 2, 3]:
    source = source_dir / f'te-{key}-1823640-1.step'
    shape = Part.Shape()
    shape.read(str(source))
    assert shape.isValid() and len(shape.Solids) == 1 and shape.isClosed()
    # The published model's mating face is +Z; put its bottom at Z=0.
    shape.translate(App.Vector(0, 0, 7.5))
    mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=0.01,
                                  AngularDeflection=0.15, Relative=False)
    assert mesh.isSolid() and not mesh.hasNonManifolds()
    points, triangles = mesh.Topology
    vertices = [v for p in points for v in p]
    indices = [v for t in triangles for v in t]
    b = shape.optimalBoundingBox(False, False)
    records[f'te-akii-{key}'] = dict(
        sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        sourceSolids=1, sourceTranslation=[0, 0, 7.5],
        bounds=[b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax],
        volume=shape.Volume,
        positions=base64.b64encode(struct.pack('<%sf' % len(vertices), *vertices)).decode(),
        indices=base64.b64encode(struct.pack('<%sI' % len(indices), *indices)).decode(),
        brep=base64.b64encode(zlib.compress(shape.exportBrepToString().encode(), 9)).decode())
    print(key, shape.Volume, records[f'te-akii-{key}']['bounds'], len(triangles))
(root / 'src/parts/srs-retainer/lib/native.json').write_text(json.dumps(records, separators=(',', ':')) + '\n')
