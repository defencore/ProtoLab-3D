"""Render the exact exported Field DAQ BRep in a fresh Blender scene.

Run with FreeCAD Python and ``--mesh`` first, then Blender background mode
with ``--python this-file -- --render``. No interactive document is modified.
PCB rectangles and the label graphic are visual references. Connector geometry
must be present in the exported CAD as actual library components.
All authored mesh coordinates originate in the matching FCStd components.
"""
from pathlib import Path
import json
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/field-daq-enclosure'


def mesh_source():
    sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
    import FreeCAD as App
    import MeshPart
    source = json.loads((OUT / 'native-input.json').read_text())
    records = json.loads((OUT / 'installation-components.json').read_text())
    assert any(r['libraryId'] == 'waterproof-connector' for r in records), 'Actual connector library geometry is required'
    doc = App.openDocument(str(OUT / 'FieldDAQ-installation.FCStd'))
    objects = [o for o in doc.Objects if hasattr(o, 'Shape') and not o.Shape.isNull()]
    assert len(objects) == len(records)
    rows = []
    for obj, record in zip(objects, records):
        assert obj.ComponentId == record['id']
        if record['id'].endswith('-components'):
            continue
        mesh = MeshPart.meshFromShape(Shape=obj.Shape, LinearDeflection=.08,
                                      AngularDeflection=.15, Relative=False)
        vertices, triangles = mesh.Topology
        rows.append({**record, 'vertices': [[p.x, p.y, p.z] for p in vertices],
                     'triangles': triangles})
    (OUT / 'render-mesh.json').write_text(json.dumps({'layout': source['layout'], 'parts': rows}))
    App.closeDocument(doc.Name)
    print('Prepared %d exact CAD components' % len(rows))


def render():
    import bpy
    from mathutils import Matrix, Vector
    data = json.loads((OUT / 'render-mesh.json').read_text())
    d = data['layout']
    # --factory-startup gives this process its own scene, independent of the UI.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world.color = (.24, .24, .24)
    scene.view_settings.view_transform = 'AgX'
    scene.render.film_transparent = False

    def material(name, rgb, roughness=.5, metallic=0):
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*rgb, 1)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        return m

    gray = material('Light grey PETG', (.48, .52, .54), .43)
    black = material('Graphite PETG', (.047, .059, .066), .42)
    rubber = material('Black TPU', (.014, .018, .020), .78)
    steel = material('Stainless fasteners', (.48, .51, .53), .27, .82)
    pcb = material('PCB outline reference', (.045, .26, .20), .5)
    ink = material('Label ink', (.018, .025, .031), .65)
    label = material('Label reference', (.76, .79, .79), .65)
    groundmat = material('Studio background', (.77, .79, .80), .82)
    library_materials = {}

    def library_material(row):
        color = tuple(row['color'])
        if color not in library_materials:
            # Source component colors are sRGB; Principled expects linear RGB.
            rgb = tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in color)
            is_gold = color[0] > .55 and color[1] > .35 and color[2] < .5
            library_materials[color] = material('Library component %s' % (color,),
                rgb, .3 if is_gold else .45, .7 if is_gold else 0)
        return library_materials[color]

    def addmesh(row):
        mesh = bpy.data.meshes.new(row['id'])
        mesh.from_pydata([[v/1000 for v in p] for p in row['vertices']], [], row['triangles'])
        mesh.update()
        obj = bpy.data.objects.new(row['id'], mesh)
        scene.collection.objects.link(obj)
        obj.data.materials.append(library_material(row) if row['libraryId'] == 'waterproof-connector' else
                                 steel if row['supply'] == 'standard' else
                                 rubber if row['material'] == 'TPU' else
                                 pcb if row['id'] in ['reference-psu', 'reference-mcu'] else
                                 black if row['id'] == 'wall' else gray)
        # Deliberately retain the actual CAD edge geometry without cosmetic
        # bevel modifiers that could imply a different printable shape.
        for poly in mesh.polygons:
            poly.use_smooth = False
        return obj

    actual = {row['id']: addmesh(row) for row in data['parts']}

    def box(name, dimensions, location, mat):
        bpy.ops.mesh.primitive_cube_add(size=1, location=tuple(v/1000 for v in location))
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = tuple(v/1000 for v in dimensions)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(mat)
        return obj

    def text(name, value, size, location, mat, rotation=(0, 0, math.pi), align='CENTER'):
        curve = bpy.data.curves.new(name, 'FONT')
        curve.body = value
        curve.size = size/1000
        curve.align_x = align
        curve.align_y = 'CENTER'
        curve.extrude = .00001
        obj = bpy.data.objects.new(name, curve)
        scene.collection.objects.link(obj)
        obj.location = tuple(v/1000 for v in location)
        obj.rotation_euler = rotation
        obj.data.materials.append(mat)
        return obj

    # The label is a graphic suggestion; the true CAD has a protected label field.
    lid_label = [box('Sticker graphic reference', (94, 42, .04), (12, 0, 46.025), label),
                 text('Field DAQ label', 'FIELD  /  DAQ', 6, (12, -6, 46.06), ink),
                 text('DAQ label subline', 'PRESSURE   /   WEIGHT', 2.25, (12, 3, 46.06), ink),
                 text('DAQ label ID', 'DAQ-01     |     14-20 V DC  /  RS485', 1.9, (12, 10, 46.06), ink)]

    box('Studio floor', (2000, 2000, 2), (0, 0, -1.1), groundmat)

    def light(name, location, energy, size):
        lamp = bpy.data.lights.new(name, 'AREA')
        lamp.energy = energy
        lamp.shape = 'DISK'
        lamp.size = size
        obj = bpy.data.objects.new(name, lamp)
        scene.collection.objects.link(obj)
        obj.location = tuple(v/1000 for v in location)
        obj.rotation_euler = (Vector((0, 0, .04))-obj.location).to_track_quat('-Z', 'Y').to_euler()

    light('Large soft key', (-180, 120, 470), 2.8, .38)
    light('Cool fill', (320, 160, 210), 1.3, .32)
    light('Back edge', (40, -320, 330), 2.2, .24)
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.clip_end = 20
    scene.camera = camera

    def camera_view(position, target, scale):
        camera.location = tuple(v/1000 for v in position)
        camera.rotation_euler = (Vector(tuple(v/1000 for v in target))-camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = scale/1000

    if '--retention-only' in sys.argv:
        # Inspection view: hide the removable shell and lid to expose the actual
        # central groove. No replacement or illustrative connector geometry.
        visible = {'base', 'board-retainer', 'reference-psu', 'reference-mcu'}
        for key, obj in actual.items():
            obj.hide_render = key not in visible and not key.startswith('clamp-pad')
        for obj in lid_label:
            obj.hide_render = True
        actual['board-retainer'].data.materials.clear()
        actual['board-retainer'].data.materials.append(black)
        camera_view((-115, -160, 210), (-29, 8, 7), 148)
        scene.render.filepath = str(OUT / 'render-central-groove-locked.png')
        bpy.ops.render.render(write_still=True)
        # Released key and its pads lift together; the boards remain in place.
        for key, obj in actual.items():
            if key == 'board-retainer' or key.startswith('clamp-pad'):
                obj.location += Vector((0, -.003, .018))
        camera_view((-115, -160, 210), (-29, 8, 15), 158)
        scene.render.filepath = str(OUT / 'render-central-groove-service.png')
        bpy.ops.render.render(write_still=True)
        print('Rendered the actual R3 central groove locked and in service')
        return

    if '--opposite-only' in sys.argv:
        camera_view((-310, 220, 240), (0, 0, 22), 305)
        scene.render.filepath = str(OUT / 'render-sp16-end.png')
        bpy.ops.render.render(write_still=True)
        print('Rendered the actual library SP16 on the opposite narrow end')
        return

    camera_view((310, 220, 240), (0, 0, 22), 305)
    if '--exploded-only' not in sys.argv:
        scene.render.filepath = str(OUT / 'render-assembled.png')
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'render-studio.blend'))
        bpy.ops.render.render(write_still=True)
        if '--assembled-only' in sys.argv:
            return

    # Separate the actual CAD parts and library connector children together.
    # PCB outline references originate in the installation FCStd as well.
    lid_pivot = Vector((0, 0, .0445))
    lid_flip = Matrix.Translation(lid_pivot) @ Matrix.Rotation(math.pi, 4, 'X') @ Matrix.Translation(-lid_pivot)
    lid_shift = Vector((-.018, -.075, .100))
    for key, obj in actual.items():
        if key in ['wall', 'panel', 'panel-gasket']:
            obj.location.z += .062
        elif key.startswith('reference-sp20-'):
            obj.location += Vector((.022, 0, .062))
        elif key.startswith('reference-sp16-'):
            obj.location.z += .062
        elif key in ['reference-psu', 'reference-mcu']:
            obj.location.z += .015
        elif key == 'board-retainer' or key.startswith('clamp-pad'):
            obj.location += Vector((0, -.003, .037))
        elif key == 'lid' or key == 'lid-gasket' or key.startswith(('screw-seal', 'head-washer')):
            obj.matrix_world = lid_flip @ obj.matrix_world
            obj.location += lid_shift
        elif key.startswith('screw-'):
            obj.matrix_world = lid_flip @ obj.matrix_world
            obj.location += lid_shift + Vector((0, 0, -.013))
    for obj in lid_label:
        obj.matrix_world = lid_flip @ obj.matrix_world
        obj.location += lid_shift
    actual['panel'].location.x += .022
    actual['panel-gasket'].location.x += .022
    camera_view((340, 260, 340), (0, -5, 85), 445)
    scene.render.filepath = str(OUT / 'render-exploded.png')
    bpy.ops.render.render(write_still=True)
    print('Rendered assembled and exploded views from actual CAD')


if __name__ == '__main__':
    if '--mesh' in sys.argv:
        mesh_source()
    elif '--render' in sys.argv:
        render()
    else:
        raise SystemExit('Pass --mesh (FreeCAD Python) or --render (Blender).')
