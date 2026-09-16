"""Bake the supplied ST3215 STEP into portable native solids and preview meshes.

Run with FreeCAD's Python. The original STEP is kept unchanged.
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

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('st3215-hs-manufacturer.step')
OUTPUT = ROOT / 'src/parts/servo-motor/lib/waveshare/native.json'
SOURCE_SHA = '58e38e4dc49f97df738c5f229f9aa8a7dce64a0a1d01335486a52d53e6017e8a'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA
source = Part.Shape()
source.read(str(SOURCE))
solids = source.Solids
assert len(solids) == 8

# The source rear cover has an annular internal void touching its outer shell.
# Rebuild its cavities and move only that void 0.00001 mm inward, preserving
# all external surfaces and the source volume to numerical precision.
rear = solids[2]
assert len(rear.Shells) == 8
fixed = Part.makeSolid(rear.Shells[0])
for index, shell in enumerate(rear.Shells[1:]):
    void = Part.makeSolid(shell)
    if void.Volume < 0:
        void.reverse()
    if index == 6:
        void.translate(App.Vector(0, -0.00001, 0))
    fixed = fixed.cut(void)
assert fixed.isValid() and abs(fixed.Volume - rear.Volume) < 1e-6
solids[2] = fixed

labels = ['Middle case', 'Front cover', 'Rear cover and pivot', 'Motor',
          'Circuit board', 'Output gear and shaft', 'Front output disc', 'Rear idler disc']
colors = ['#32363d', '#292d33', '#292d33', '#a8adb5', '#24794f',
          '#c8a56b', '#e0e2e5', '#d0d3d8']
records = []
for index, solid in enumerate(solids):
    solid = solid.copy()
    solid.rotate(App.Vector(), App.Vector(1, 0, 0), 90)
    solid.translate(App.Vector(25.5, 0, 24.1))
    assert solid.isValid() and solid.isClosed() and len(solid.Solids) == 1
    mesh = MeshPart.meshFromShape(Shape=solid, LinearDeflection=0.02,
                                  AngularDeflection=0.15, Relative=False)
    assert mesh.isSolid()
    points, facets = mesh.Topology
    positions = [coordinate for point in points for coordinate in point]
    indices = [vertex for triangle in facets for vertex in triangle]
    bbox = solid.optimalBoundingBox(False, False)
    records.append(dict(
        label=labels[index], color=colors[index], sourceSolid=index,
        volume=solid.Volume,
        bounds=[bbox.XMin, bbox.YMin, bbox.ZMin, bbox.XMax, bbox.YMax, bbox.ZMax],
        positions=base64.b64encode(struct.pack('<%sf' % len(positions), *positions)).decode(),
        indices=base64.b64encode(struct.pack('<%sI' % len(indices), *indices)).decode(),
        brep=base64.b64encode(zlib.compress(solid.exportBrepToString().encode(), 9)).decode(),
    ))
OUTPUT.write_text(json.dumps(dict(
    sourceSha256=SOURCE_SHA,
    transform='X=x+25.5, Y=-z, Z=y+24.1',
    repair='Rear cover internal annular void translated -0.00001 mm on source Y; external surfaces unchanged.',
    linearDeflection=0.02, angularDeflection=0.15,
    components=records,
), separators=(',', ':')) + '\n')
print(json.dumps({'output': str(OUTPUT), 'bytes': OUTPUT.stat().st_size,
                  'components': len(records), 'sourceSha256': SOURCE_SHA}))
