"""Run in FreeCAD after verify-workshop-jigs.ts. WORKSHOP_JIG_OUTPUT selects the export directory."""
import json
import math
from pathlib import Path
import FreeCAD as App
import Part
import MeshPart

output = Path(globals().get('WORKSHOP_JIG_OUTPUT', Path.cwd() / 'test-results/workshop-jigs'))
report = list(globals().get('WORKSHOP_JIG_PREVIOUS', []))
completed = {record['id'] for record in report}
only = globals().get('WORKSHOP_JIG_ONLY')
for case in json.loads((output / 'cases.json').read_text()):
    key = case['partId'] + '/' + case['id']
    if key in completed:
        continue
    if only and case['partId'] not in only:
        continue
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(case['code'], scope)
    shapes = scope['shape'].childShapes()
    labels = scope['component_labels']
    assert len(shapes) == len(labels) == len(case['pieces']), key
    for label, shape in zip(labels, shapes):
        assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1 and shape.Volume > 0, (key, label)
    checks = ['valid single-solid physical components']
    if case['state'] == 'assembled':
        for i, a in enumerate(shapes):
            for j in range(i + 1, len(shapes)):
                b = shapes[j]
                if not a.BoundBox.intersect(b.BoundBox):
                    continue
                assert a.common(b).Volume < 1e-5, (key, 'component interference', labels[i], labels[j])
        for tool in case['paths']:
            cutter = Part.makeCylinder(tool['diameter'] / 2, tool['length'], App.Vector(*tool['origin']), App.Vector(*tool['axis']))
            for label, shape in zip(labels, shapes):
                if shape.BoundBox.intersect(cutter.BoundBox):
                    assert shape.common(cutter).Volume < 1e-5, (key, 'blocked drill path', label)
        checks += ['no component interference', 'declared drill paths clear']
        p, d, body = case['parameters'], case['layout'], shapes[0]
        if case['partId'] == 'angle-drill-jig':
            below = Part.makeBox(2*p['length'],2*p['width'],100,App.Vector(-p['length'],-p['width'],-100))
            assert body.common(below).Volume < 1e-6, (key, 'sleeve below support plane')
            bottom_faces = [face for face in body.Faces if isinstance(face.Surface,Part.Plane) and face.normalAt(0,0).z < -0.999999 and abs(face.CenterOfMass.z) < 1e-6]
            assert sum(face.Area for face in bottom_faces) > 100, (key, 'flat foot area')
            checks += ['inclined sleeve trimmed flush to flat workpiece support plane']
        stock = None
        shift = None
        if case['partId'] == 'shaft-end-drill-jig':
            stock = Part.makeCylinder(p['stockOD'] / 2, p['sleeve'])
            shift = App.Vector(0, 0, 0.1)
        elif case['partId'] == 'v-block-drill-jig':
            stock = Part.makeCylinder(d['r'], d['l'], App.Vector(-d['l']/2+5, 0, d['center']), App.Vector(1,0,0))
            shift = App.Vector(-0.1,0,0)
        elif case['partId'] == 'edge-dowel-jig':
            stock = Part.makeBox(d['l'], p['stockThickness'], p['cheek'], App.Vector(-d['l']/2+4, -p['stockThickness']/2, -p['cheek']))
            shift = App.Vector(-0.1,0,0)
        if stock is not None:
            assert body.common(stock).Volume < 1e-5, (key, 'stock insertion')
            stock.translate(shift)
            assert body.common(stock).Volume > 0.01, (key, 'positive end stop')
            checks += ['workpiece clearance and positive datum stop']
    if case.get('export'):
        folder = output / case['partId']
        folder.mkdir(exist_ok=True)
        doc = App.newDocument('Workshop_' + case['partId'].replace('-','_'))
        group = doc.addObject('App::Part', 'Fixture')
        group.Label = case['name']
        printable = []
        for i, (shape, label) in enumerate(zip(shapes, labels)):
            feature = doc.addObject('Part::Feature', 'Component%03d' % i)
            feature.Label, feature.Shape = label, shape
            feature.ViewObject.ShapeColor = tuple(scope['component_colors'][i])
            feature.addProperty('App::PropertyString', 'Supply')
            feature.Supply = 'purchased' if case['pieces'][i]['bought'] else 'manufactured'
            group.addObject(feature)
            if feature.Supply == 'manufactured':
                printable.append(feature)
                oriented = shape.copy()
                if case['partId'] in ['drill-pattern-jig', 'shaft-end-drill-jig', 'edge-dowel-jig', 'router-template', 'chain-drill-slot-jig', 'corner-radius-template']:
                    oriented.rotate(App.Vector(), App.Vector(1,0,0), 180)
                bb = oriented.BoundBox
                # OpenCASCADE's conservative bounds may include trimmed curve extrema.
                # These parts have a planar support face containing minimum-Z vertices.
                support_z = min(vertex.Point.z for vertex in oriented.Vertexes)
                oriented.translate(App.Vector(-(bb.XMin+bb.XMax)/2, -(bb.YMin+bb.YMax)/2, -support_z))
                name = case['pieces'][i]['id']
                oriented.exportStep(str(folder / (name + '.step')))
                mesh = MeshPart.meshFromShape(Shape=oriented, LinearDeflection=0.08, AngularDeflection=0.2, Relative=False)
                assert mesh.isSolid() and not mesh.hasNonManifolds(), (key, name, 'STL topology')
                mesh.write(str(folder / (name + '.stl')))
        doc.recompute()
        doc.saveAs(str(folder / (case['partId'] + '.FCStd')))
        Part.export(printable, str(folder / (case['partId'] + '.step')))
        reread = Part.read(str(folder / (case['partId'] + '.step')))
        assert reread.isValid() and len(reread.Solids) == len(printable), (key, 'STEP solid count')
        expected = sum(item.Shape.Volume for item in printable)
        assert abs(reread.Volume - expected) / expected < 1e-4, (key, 'STEP volume')
        Gui.activeDocument().activeView().viewAxonometric()
        Gui.activeDocument().activeView().fitAll()
        Gui.activeDocument().activeView().saveImage(str(folder / 'preview.png'),900,650,'White')
        App.closeDocument(doc.Name)
        reopened = App.openDocument(str(folder / (case['partId'] + '.FCStd')))
        assert len([o for o in reopened.Objects if o.TypeId == 'Part::Feature']) == len(shapes), key
        App.closeDocument(reopened.Name)
        checks += ['individual STEP / watertight STL', 'assembly STEP volume and solid count', 'FCStd reopen']
    report.append({'id': key, 'solids': len(shapes), 'checks': checks, 'result': 'PASS'})
    (output / 'validation.json').write_text(json.dumps({'units':'mm','cases':report},indent=2)+'\n')
    print(key + ': PASS')
print('PASS: %d workshop fixture native cases' % len(report))
