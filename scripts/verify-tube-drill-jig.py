"""Execute in FreeCAD after preparing cases with verify-tube-drill-jig.ts.

GUI console: exec(open('/absolute/path/to/this/file.py').read())
Override TUBE_JIG_OUTPUT in the calling scope to change the data directory.
"""
import json
import math
from pathlib import Path
import FreeCAD as App
import Part
import MeshPart

output = Path(globals().get('TUBE_JIG_OUTPUT', Path.cwd() / 'data' / 'tube-drill-jig'))
report = list(globals().get('TUBE_JIG_PREVIOUS_REPORT', []))
only_ids = globals().get('TUBE_JIG_ONLY_IDS')
for case in json.loads((output / 'cases.json').read_text()):
    if only_ids is not None and case['id'] not in only_ids:
        continue
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(case['code'], scope)
    shapes = scope['shape'].childShapes()
    labels = scope['component_labels']
    assert len(shapes) == len(case['pieces']) == len(labels), case['id']
    for name, shape in zip(labels, shapes):
        assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1, (case['id'], name)
        assert shape.Volume > 0, (case['id'], name)
    checks = ['valid single-solid physical components']
    if case['state'] == 'assembled':
        p, d = case['parameters'], case['layout']
        collar = shapes[0]
        tube = Part.makeCylinder(p['tubeOD'] / 2, d['top'] + 20).cut(
            Part.makeCylinder(p['tubeOD'] / 2 - p['tubeWall'], d['top'] + 22, App.Vector(0, 0, -1)))
        tube.translate(App.Vector(0, 0, d['spacerHeight']))
        supports = [collar] + [shape for piece, shape in zip(case['pieces'], shapes) if piece['id'].startswith('spacer-')]
        assert sum(shape.common(tube).Volume for shape in supports) < 1e-6, (case['id'], 'tube insertion')
        shifted = tube.copy()
        shifted.translate(App.Vector(0, 0, -0.1))
        assert sum(shape.common(shifted).Volume for shape in supports) > 0.1, (case['id'], 'positive spacer stop')
        assert abs(d['axisHeight'] - d['spacerHeight'] - p['endOffset']) < 1e-9
        checks += ['tube insertion clearance', 'positive stop at calculated spacer height', 'fixed drill height minus spacer stack equals requested offset']
        for station in d['stations']:
            direction = App.Vector(*station['direction'])
            support_faces = [face for face in collar.Faces if isinstance(face.Surface, Part.Plane) and face.normalAt(0, 0).dot(direction) > 1 - 1e-8 and abs(face.CenterOfMass.dot(direction) - d['radius']) < 1e-6]
            assert sum(face.Area for face in support_faces) > 10, (case['id'], 'flat support face', station['angle'])
            for piece, shape in zip(case['pieces'][1:], shapes[1:]):
                assert max(v.Point.dot(direction) for v in shape.Vertexes) <= d['radius'] + 1e-6, (case['id'], 'component protrudes beyond support flat', piece['id'])
        checks += ['planar support at every drill station / all hardware recessed']
        printed = [i for i, piece in enumerate(case['pieces']) if piece['supply'] == 'manufactured']
        for i in printed:
            for j in range(i + 1, len(shapes)):
                if case['pieces'][j]['id'].startswith('screw-'):
                    # M3 screws intentionally engage undersized printed pilots.
                    continue
                if not shapes[i].BoundBox.intersect(shapes[j].BoundBox):
                    continue
                assert shapes[i].common(shapes[j]).Volume < 1e-5, (case['id'], 'interference', labels[i], labels[j])
        checks += ['no printed-part or guide interference']
        for station in d['stations']:
            direction = App.Vector(*station['direction'])
            radial_start = p['tubeOD'] / 2 - p['tubeWall'] - 0.5
            origin = direction * radial_start
            origin.z = d['axisHeight']
            tool = Part.makeCylinder(d['drill'] / 2, d['radius'] + 5 - radial_start, origin, direction)
            for i, shape in enumerate(shapes):
                if case['pieces'][i]['id'].startswith('screw-'):
                    continue
                if not shape.BoundBox.intersect(tool.BoundBox):
                    continue
                assert shape.common(tool).Volume < 1e-5, (case['id'], 'drill path', labels[i], station['angle'])
        checks += ['all radial drill paths unobstructed at specified end offset']
    if case.get('export'):
        existing = App.listDocuments().get(case['id'])
        if existing is not None and Path(existing.FileName).parent == output:
            App.closeDocument(existing.Name)
        doc = App.newDocument(case['id'])
        assembly = doc.addObject('App::Part', 'Jig')
        assembly.Label = case['id'] + ' / adjustable spacer stop / fixed drill height %g' % case['layout']['axisHeight']
        doc.addObject('App::FeaturePython', 'Specification')
        spec = doc.getObject('Specification')
        spec.addProperty('App::PropertyString', 'ConfigurationJSON')
        spec.ConfigurationJSON = json.dumps(case['parameters'])
        printable = []
        for i, (label, shape) in enumerate(zip(labels, shapes)):
            obj = doc.addObject('Part::Feature', 'Component%03d' % (i + 1))
            obj.Label, obj.Shape = label, shape
            obj.addProperty('App::PropertyString', 'Supply')
            obj.Supply = case['pieces'][i]['supply']
            obj.ViewObject.ShapeColor = tuple(scope['component_colors'][i])
            assembly.addObject(obj)
            if obj.Supply == 'manufactured':
                printable.append(obj)
        doc.recompute()
        doc.saveAs(str(output / (case['id'] + '.FCStd')))
        Part.export(printable, str(output / (case['id'] + '.step')))
        imported = Part.read(str(output / (case['id'] + '.step')))
        assert imported.isValid() and len(imported.Solids) == len(printable), (case['id'], 'STEP solid count')
        expected = sum(obj.Shape.Volume for obj in printable)
        step_relative_error = abs(imported.Volume - expected) / expected
        assert step_relative_error < 1e-4, (case['id'], 'STEP volume', step_relative_error)
        checks += ['printed STEP reimport / solid count / volume']
        if case['id'] == 'Tube90_4_M3':
            for index, name in [(0, 'Collar_print1'), (1, 'Cartridge_print4'), (2, 'Retainer_print4')]:
                shape = shapes[index].copy()
                if index:
                    shape.rotate(App.Vector(), App.Vector(0, 1, 0), 90)
                bb = shape.BoundBox
                shape.translate(App.Vector(-(bb.XMin + bb.XMax) / 2, -(bb.YMin + bb.YMax) / 2, -bb.ZMin))
                shape.exportStep(str(output / (name + '.step')))
                mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=0.05, AngularDeflection=0.15, Relative=False)
                assert mesh.isSolid() and not mesh.hasNonManifolds(), name
                mesh.write(str(output / (name + '.stl')))
            checks += ['individual print-oriented watertight STL exports']
            for thickness in [0.5, 1, 2, 5, 10, 20]:
                ring = Part.makeCylinder(d['spacerOD'] / 2, thickness).cut(Part.makeCylinder(d['stopBore'] / 2, thickness + 2, App.Vector(0, 0, -1)))
                name = 'HeightSpacer_%smm' % str(thickness).replace('.', 'p')
                ring.exportStep(str(output / (name + '.step')))
                mesh = MeshPart.meshFromShape(Shape=ring, LinearDeflection=0.05, AngularDeflection=0.15, Relative=False)
                assert mesh.isSolid() and not mesh.hasNonManifolds(), name
                mesh.write(str(output / (name + '.stl')))
            checks += ['complete reusable 0.5/1/2/5/10/20 mm spacer kit STEP and STL exports']
        App.closeDocument(doc.Name)
        reopened = App.openDocument(str(output / (case['id'] + '.FCStd')))
        assert len([o for o in reopened.Objects if o.TypeId == 'Part::Feature']) == len(shapes)
        App.closeDocument(reopened.Name)
        checks += ['FCStd reopen / physical component count']
    report.append({'id': case['id'], 'solids': len(shapes), 'checks': checks, 'result': 'PASS'})
    print(case['id'] + ': PASS')
(output / 'validation.json').write_text(json.dumps({'units': 'mm', 'cases': report}, indent=2) + '\n')
print('PASS: %d tube jig native cases' % len(report))
