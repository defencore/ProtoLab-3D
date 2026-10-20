"""Export the prepared panel-mounted mechanism in isolated FreeCAD Python.

First run scripts/export-servo-toggle-parallel.ts. Units are millimetres.
The example host panel is an installation reference, outside the physical BOM.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import Mesh
import MeshPart

case = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-parallel-print-case.json').read_text())
output = Path(case['output'])
output.mkdir(parents=True, exist_ok=True)
assert hashlib.sha256(case['script'].encode()).hexdigest() == case['codeSha256']
doc = App.newDocument('ParallelRockerExample')
exec(case['script'], {})
root = doc.RootObjects[0]
children = list(root.Group)
expected_components = len(case['components'])
expected_solids = sum(len(obj.Shape.Solids) for obj in children)
assert len(children) == expected_components
dual = case['parameters']['mechanism'] == 'parallel-dual'
assert expected_components == (30 if dual else 24)
assert expected_solids == (59 if dual else 40)
assembly_stem = case['assemblyFileStem']
installation_stem = case['installationFileStem']
print_ids = {meta['id'] for meta in case['components'] if meta['supply'] == 'manufactured'}
assert print_ids == ({'parallel-base', 'parallel-cradle', 'parallel-clamp', 'parallel-rocker', 'parallel-switch-gasket', 'parallel-panel-gasket'} | ({'parallel-manual-gasket'} if dual else set()))
rows = []
for obj, meta in zip(children, case['components']):
    if meta['supply'] != 'manufactured':
        continue
    shape = obj.Shape.copy()
    assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1
    if meta['id'] == 'parallel-clamp':
        shape.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), 180)
    bounds = shape.BoundBox
    shape.translate(App.Vector(-bounds.XMin, -bounds.YMin, -bounds.ZMin))
    mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=.04, AngularDeflection=.12, Relative=False)
    assert mesh.isSolid() and mesh.CountFacets > 0
    file = output / (meta['id'] + '.stl')
    mesh.write(str(file))
    saved = Mesh.Mesh(str(file))
    assert saved.isSolid()
    bounds = saved.BoundBox
    assert abs(bounds.ZMin) < 1e-5
    rows.append({
        'file': file.name, 'closed': True, 'facets': saved.CountFacets,
        'dimensionsMm': [bounds.XLength, bounds.YLength, bounds.ZLength],
        'min': [bounds.XMin, bounds.YMin, bounds.ZMin],
        'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
        'sourceCodeSha256': case['codeSha256'],
    })
    print(json.dumps(rows[-1]), flush=True)
assert len(rows) == len(print_ids)
(output / 'print-mesh-validation.json').write_text(json.dumps(rows, indent=2) + '\n')

step = output / (assembly_stem + '.step')
Part.export(children, str(step))
roundtrip = Part.read(str(step))
expected_volume = sum(obj.Shape.Volume for obj in children)
assert roundtrip.isValid() and roundtrip.isClosed() and len(roundtrip.Solids) == expected_solids
assert abs(roundtrip.Volume - expected_volume) / expected_volume < 1e-5
root_name = root.Name
doc.recompute()
assembly_file = output / (assembly_stem + '.FCStd')
doc.saveAs(str(assembly_file))
App.closeDocument(doc.Name)
doc = App.openDocument(str(assembly_file))
root = doc.getObject(root_name)
children = list(root.Group)
assert len(children) == expected_components and sum(len(obj.Shape.Solids) for obj in children) == expected_solids
assert all(obj.Shape.isValid() and obj.Shape.isClosed() for obj in children)

# One 3 mm host plate illustrates the installation plane; its opening is THROUGH.
interface = case['installation']
cut = interface['cutout']
width, height, radius = cut['width'], cut['height'], cut['radius']
cx, cy = cut['centre']
x0, y0 = cx - width / 2, cy - height / 2
thickness = 3
blank_width = interface['flangeSize'][0] + 40
blank_height = interface['flangeSize'][1] + 40
flange_cx, flange_cy = interface['flangeCentre']
blank = Part.makeBox(blank_width, blank_height, thickness, App.Vector(flange_cx - blank_width/2, flange_cy - blank_height/2, -thickness))
opening = Part.makeBox(width - 2 * radius, height, thickness + 2, App.Vector(x0 + radius, y0, -thickness - 1))
opening = opening.fuse(Part.makeBox(width, height - 2 * radius, thickness + 2, App.Vector(x0, y0 + radius, -thickness - 1)))
for x in [x0 + radius, x0 + width - radius]:
    for y in [y0 + radius, y0 + height - radius]:
        opening = opening.fuse(Part.makeCylinder(radius, thickness + 2, App.Vector(x, y, -thickness - 1)))
for notch in [cut['terminalNotch']] + cut['additionalTerminalNotches']:
    nw, nh, nr = notch['width'], notch['height'], notch['radius']
    ncx, ncy = notch['centre']
    nx, ny = ncx - nw / 2, ncy - nh / 2
    branch = Part.makeBox(nw - 2 * nr, nh, thickness + 2, App.Vector(nx + nr, ny, -thickness - 1))
    branch = branch.fuse(Part.makeBox(nw, nh - 2 * nr, thickness + 2, App.Vector(nx, ny + nr, -thickness - 1)))
    for x in [nx + nr, nx + nw - nr]:
        for y in [ny + nr, ny + nh - nr]:
            branch = branch.fuse(Part.makeCylinder(nr, thickness + 2, App.Vector(x, y, -thickness - 1)))
    opening = opening.fuse(branch)
plate = blank.cut(opening)
for x, y in interface['mountingHoles']:
    plate = plate.cut(Part.makeCylinder(interface['holeDiameter'] / 2, thickness + 2, App.Vector(x, y, -thickness - 1)))
plate = plate.removeSplitter()
assert plate.isValid() and plate.isClosed() and len(plate.Solids) == 1
for obj in children:
    assert obj.Shape.common(plate).Volume < 1e-5, obj.Label + ' obstructs the example panel'
assert sum(obj.Shape.common(blank).Volume for obj in children) > 1, 'Uncut panel negative control failed'
reference = doc.addObject('PartDesign::Feature', 'HostPlateReference')
reference.Label = 'Example host plate - 3 mm - installation reference'
reference.Shape = plate
reference.addProperty('App::PropertyString', 'Role')
reference.Role = 'Reference only; select the actual panel material, thickness and M4 mounting hardware.'
reference.addProperty('App::PropertyString', 'Cutout')
notch_side = 'negative-Y terminal notches' if dual else 'right terminal notch'
reference.Cutout = f'{width} x {height} R{radius} THROUGH plus {notch_side}; mounting plane at upper face Z0'
doc.recompute()
Part.export(children + [reference], str(output / (installation_stem + '.step')))
doc.saveAs(str(output / (installation_stem + '.FCStd')))
reference_step = Part.read(str(output / (installation_stem + '.step')))
assert reference_step.isValid() and reference_step.isClosed() and len(reference_step.Solids) == expected_solids + 1
App.closeDocument(doc.Name)
print(json.dumps({'assemblyComponents': expected_components, 'assemblySolids': expected_solids, 'installationSolids': expected_solids + 1, 'stepRoundtrip': True, 'fcstdRoundtrip': True, 'hostPlateClear': True, 'sourceCodeSha256': case['codeSha256']}), flush=True)
