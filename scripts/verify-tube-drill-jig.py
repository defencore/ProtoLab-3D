"""Audit actual generated tube-jig components, fit/indexing and CAD round trips.

Prepare cases with verify-tube-drill-jig.ts, then run with FreeCAD's Python:
    .../FreeCAD.app/Contents/Resources/bin/python scripts/verify-tube-drill-jig.py
The optional first argument or TUBE_JIG_OUTPUT global selects the output folder.
"""
import json
import hashlib
import math
from pathlib import Path
import sys

sys.path.append('/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
import MeshPart

output = Path(globals().get('TUBE_JIG_OUTPUT', sys.argv[1] if len(sys.argv) > 1 else Path.cwd() / 'test-results' / 'tube-drill-jig'))
report = list(globals().get('TUBE_JIG_PREVIOUS_REPORT', []))
only_ids = globals().get('TUBE_JIG_ONLY_IDS')


def intersects(a, b):
    aa, bb = a.BoundBox, b.BoundBox
    return not (aa.XMax < bb.XMin or bb.XMax < aa.XMin or aa.YMax < bb.YMin or bb.YMax < aa.YMin or aa.ZMax < bb.ZMin or bb.ZMax < aa.ZMin)


def overlap(a, b):
    return a.common(b).Volume if intersects(a, b) else 0


def shifted(shape, direction, distance):
    result = shape.copy()
    result.translate(direction * distance)
    return result


def export_print(shape, name, tilt=0):
    shape = shape.copy()
    if tilt:
        shape.rotate(App.Vector(), App.Vector(0, 1, 0), tilt)
    bb = shape.BoundBox
    shape.translate(App.Vector(-(bb.XMin + bb.XMax) / 2, -(bb.YMin + bb.YMax) / 2, -bb.ZMin))
    shape.exportStep(str(output / (name + '.step')))
    # STEP canonicalizes coincident CSG seams before tessellation. It must
    # preserve the original valid physical solid and its volume.
    canonical = Part.read(str(output / (name + '.step')))
    assert canonical.isValid() and canonical.isClosed() and len(canonical.Solids) == 1, name
    relative_volume_error = abs(canonical.Volume-shape.Volume)/shape.Volume
    comparison = {'part': name, 'sourceVolume': shape.Volume, 'stepVolume': canonical.Volume, 'rawVolumeRelativeError': relative_volume_error, 'method': 'mass-property comparison'}
    if relative_volume_error >= 1e-5:
        # STEP can reparameterize trimmed periodic faces. OCCT's default mass
        # integration then differs even for geometrically identical solids.
        # Never accept that difference merely by enlarging a tolerance: prove
        # identical bounds, both directed differences and common coverage.
        assert relative_volume_error < 1e-4, (name, 'STEP mass integration discrepancy', relative_volume_error)
        removed, added = shape.cut(canonical), canonical.cut(shape)
        assert abs(removed.Volume)+abs(added.Volume) < 1e-6 and not removed.Solids and not added.Solids, (name, 'STEP changed physical material')
        original_bb, step_bb = shape.BoundBox, canonical.BoundBox
        bounds_error = max(abs(getattr(original_bb, key)-getattr(step_bb, key)) for key in ['XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax'])
        assert bounds_error < 1e-6, (name, 'STEP bounds changed', bounds_error)
        common = shape.common(canonical)
        coverage_error = abs(common.Volume-shape.Volume)/shape.Volume
        assert common.isValid() and common.isClosed() and len(common.Solids) == 1 and coverage_error < 1e-8, (name, 'STEP boolean common does not cover source')
        assert abs(shape.Area-canonical.Area)/shape.Area < 1e-4, (name, 'STEP surface integration discrepancy')
        comparison.update(method='mass-integration discrepancy / geometrically identical boolean proof', removedVolume=removed.Volume, addedVolume=added.Volume, boundsMaximumError=bounds_error, commonVolumeRelativeError=coverage_error)
    step_checks.append(comparison)
    mesh = MeshPart.meshFromShape(Shape=canonical, LinearDeflection=0.05, AngularDeflection=0.15, Relative=False)
    assert mesh.isSolid() and not mesh.hasNonManifolds(), name
    mesh.write(str(output / (name + '.stl')))


for case in json.loads((output / 'cases.json').read_text()):
    if only_ids is not None and case['id'] not in only_ids:
        continue
    step_checks = []
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(case['code'], scope)
    shapes = scope['components']
    labels = scope['component_labels']
    assert len(shapes) == len(case['pieces']) == len(labels), case['id']
    by_id = {piece['id']: shape for piece, shape in zip(case['pieces'], shapes)}
    for piece, shape in zip(case['pieces'], shapes):
        assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1 and shape.Volume > 0, (case['id'], piece['id'], 'valid closed single physical solid', len(shape.Solids))
    checks = ['valid closed single-solid physical components']
    p, d = case['parameters'], case['layout']
    printed = [(piece['id'], shape) for piece, shape in zip(case['pieces'], shapes) if piece['supply'] == 'manufactured']
    if case['state'] == 'assembled':
        collar, lower = by_id['collar'], by_id['index-lower']
        upper, crown, liner = by_id['index-upper'], by_id['clamp-crown'], by_id['centering-liner']
        head = Part.makeCompound([lower, upper, crown, liner])
        tube_from = d['spacerHeight'] if d['endStop'] else d['bodyBottom']-40
        tube = Part.makeCylinder(p['tubeOD']/2, d['top']+12-tube_from, App.Vector(0, 0, tube_from)).cut(Part.makeCylinder(p['tubeOD']/2-p['tubeWall'], d['top']+14-tube_from, App.Vector(0, 0, tube_from-1)))
        if d['endStop']:
            stop = by_id['stop-plate']
            supports = [stop]+[shape for id, shape in by_id.items() if id.startswith('spacer-')]
            assert sum(overlap(shape, tube) for shape in supports) < 1e-6, (case['id'], 'tube insertion')
            assert sum(overlap(shape, shifted(tube, App.Vector(0, 0, 1), -.1)) for shape in supports) > .1, (case['id'], 'positive removable end stop')
            assert abs(d['axisHeight']-d['spacerHeight']-p['endOffset']) < 1e-9
            assert abs(stop.BoundBox.ZMin-(d['bodyBottom']-p['stopThickness'])) < 1e-6
            assert abs(stop.BoundBox.ZMax) < 1e-6, (case['id'], 'end stop boss does not establish datum Z=0')
            assert stop.distToShape(collar)[0] < 1e-6, (case['id'], 'removable stop lacks body seat')
            assert overlap(collar, shifted(stop, App.Vector(0, 0, 1), .1)) > .1, (case['id'], 'stop cannot seat on body bottom')
            screws = [(id, shape) for id, shape in by_id.items() if id.startswith('stop-screw-')]
            assert len(screws) == 4
            for id, screw in screws:
                assert screw.BoundBox.ZMin >= stop.BoundBox.ZMin-1e-6, (case['id'], 'countersunk head protrudes below flat base', id)
                assert abs(screw.BoundBox.ZMax-(d['bodyBottom']+7)) < 1e-6, (case['id'], 'stop screw engagement changed', id)
                assert overlap(stop, shifted(screw, App.Vector(0, 0, 1), .3)) > .01, (case['id'], 'stop screw head does not capture plate', id)
            checks += ['removable plate and spacer stack establish the requested end offset from datum Z=0', 'four flush countersunk heads capture the stop with 7 mm nominal pilot engagement']
        else:
            assert not any(id == 'stop-plate' or id.startswith(('spacer-', 'stop-screw-')) for id in by_id), (case['id'], 'end-stop hardware remains in through mode')
            passage = Part.makeCylinder(p['tubeOD']/2, d['top']-d['bodyBottom']+120, App.Vector(0, 0, d['bodyBottom']-60))
            for id, shape in by_id.items():
                if id != 'workpiece':
                    assert overlap(shape, passage) < 1e-5, (case['id'], 'solid tube OD cannot pass axially', id)
            if 'workpiece' in by_id:
                assert by_id['workpiece'].BoundBox.ZMin < d['bodyBottom']-20
                assert by_id['workpiece'].BoundBox.ZMax > d['top']+10
            checks += ['unobstructed full-diameter axial tube passage and long undrilled workpiece', 'stop plate, its screws and all spacers removed in through mode']
        assert overlap(collar, head) < 1e-5, (case['id'], 'head/cup pilot interference')
        assert collar.distToShape(lower)[0] < 1e-6, (case['id'], 'missing positive planar head seat')
        assert overlap(collar, shifted(lower, App.Vector(0, 0, 1), -.1)) > .1, (case['id'], 'head does not bottom on cup datum')
        assert liner.distToShape(collar)[0] < 1e-6, (case['id'], 'hanging liner flange has no body seat')
        assert overlap(collar, shifted(liner, App.Vector(0, 0, 1), -.1)) > .01, (case['id'], 'liner can drop through body without end stop')
        assert overlap(lower, shifted(liner, App.Vector(0, 0, 1), .1)) > .01, (case['id'], 'liner can lift out through lower head')
        checks += ['45 degree liner flange retained between common body and lower head independently of end stop']
        for above, below, description in [(upper, lower, 'split socket halves'), (crown, upper, 'clamp crown')]:
            assert above.distToShape(below)[0] < 1e-6, (case['id'], 'missing planar head-layer contact', description)
            assert overlap(below, shifted(above, App.Vector(0, 0, 1), -.1)) > .1, (case['id'], 'missing positive head-layer seat', description)
        bushes = [(id, shape) for id, shape in by_id.items() if id.startswith('alignment-bush-')]
        assert len(bushes) == 2
        for id, bush in bushes:
            assert lower.distToShape(bush)[0] < 1e-6, (case['id'], 'alignment bush lacks lower seat', id)
            assert overlap(lower, shifted(bush, App.Vector(0, 0, 1), -.1)) > .01, (case['id'], 'alignment bush can escape downward', id)
            assert overlap(crown, shifted(bush, App.Vector(0, 0, 1), .5)) > .01, (case['id'], 'alignment bush can escape above crown', id)
            assert overlap(upper, shifted(bush, App.Vector(1, 0, 0), .3)) > .01, (case['id'], 'alignment bush cannot register upper layer', id)
        for id, ring in by_id.items():
            if id.startswith('spacer-'):
                assert overlap(head, shifted(ring, App.Vector(1, 0, 0), .3)) > .01, (case['id'], 'spacer stack not laterally centered', id)
        checks += ['separate liner and split head clear the common cup and seat on planar datums', 'centering liner and lower head laterally confine every stop ring, including short stacks', 'two seated and captured alignment bushes register the three head layers']
        # Nominal screw envelopes intersect printed pilot bores where threads
        # engage. Every other physical-component intersection is forbidden.
        physical = list(by_id.items())
        for i, (id, shape) in enumerate(physical):
            for other_id, other in physical[i+1:]:
                pair = {id, other_id}
                intentional_thread = (
                    'collar' in pair and any(value.startswith(('head-screw-', 'stop-screw-')) for value in pair)
                    or pair == {'cassette-lock', 'clamp-crown'}
                    or 'cartridge-1' in pair and any(value.startswith('screw-') for value in pair)
                )
                if intentional_thread:
                    continue
                volume = overlap(shape, other)
                assert volume < 1e-5, (case['id'], 'physical component interference', id, other_id, volume)
        checks += ['no unintended physical-component intersections; printed thread engagement explicitly exempted']
        cassette_ids = [id for id in by_id if id.startswith(('cartridge-', 'retainer-', 'guide-', 'screw-')) or id in ['bearing-spacer', 'cassette-lock']]
        fixed = [(id, shape) for id, shape in by_id.items() if id not in cassette_ids and id != 'workpiece']
        guides = [id for id in by_id if id.startswith('guide-')]
        assert len(guides) == (2 if d['kind'] == 'bearing' else 1 if d['kind'] == 'bushing' else 0)
        axis = App.Vector(*d['active']['direction'])
        if d['kind'] == 'bearing':
            first, second = by_id['guide-1-1'], by_id['guide-1-2']
            sleeve, cassette, cap = by_id['bearing-spacer'], by_id['cartridge-1'], by_id['retainer-1']
            assert first.distToShape(cassette)[0] < 1e-6, (case['id'], 'missing inner bearing lip')
            assert overlap(cassette, shifted(first, axis, -.2)) > .01, (case['id'], 'bearing can escape inward')
            assert first.distToShape(sleeve)[0] < 1e-6 and second.distToShape(sleeve)[0] < 1e-6
            assert second.distToShape(cap)[0] <= .151, (case['id'], 'excessive outer retainer play')
            assert overlap(cap, shifted(second, axis, .3)) > .01, (case['id'], 'bearing can escape outward')
            relief = d['drill'] + (d['outer']-d['drill'])*.75
            old_thin_sleeve_volume = math.pi*((d['outer']-.15)**2-relief**2)/4*d['sleeveLength']
            assert sleeve.Volume > old_thin_sleeve_volume*1.1, (case['id'], 'distance sleeve retains the former thin wall')
            checks += ['two bearings total / integrated lip, thickened tapered outer-race sleeve and screwed cap retain both guides']
        if d['kind'] != 'plain':
            cap = by_id['retainer-1']
            tangent = App.Vector(-axis.y, axis.x, 0)
            assert abs(d['capEnd']-d['capStart']-4) < 1e-9
            for sign in [-1, 1]:
                for depth in [.2, 3.8]:
                    point = axis*(d['capStart']+depth)+tangent*(sign*d['screwOffset']+2.3)
                    point.z = d['axisHeight']
                    assert cap.isInside(point, 1e-6, False), (case['id'], 'retainer does not retain full 4 mm screw floor')
                point = axis*(d['capEnd']+.75)+tangent*(sign*d['screwOffset'])
                point.z = d['axisHeight']
                assert by_id['screw-1-'+str(sign)].isInside(point, 1e-6, False), (case['id'], 'M3 low head must sit above full-thickness retainer')
            checks += ['full 4 mm retainer floor / M3 x 10 heads above outer face']
        # Independently measure the actual finite socket cutters. Where their
        # shortest connector lies outside the tube bore, it must match the
        # advertised ligament and the real split head must contain that web.
        first_port = Part.makeCylinder((d['barrelOD']+p['cartridgeClearance'])/2, d['radius']+1-d['socketStart'], App.Vector(d['socketStart'], 0, d['axisHeight']), App.Vector(1, 0, 0))
        next_port = first_port.copy()
        next_port.rotate(App.Vector(), App.Vector(0, 0, 1), 360/d['count'])
        distance, nearest, _ = first_port.distToShape(next_port)
        if nearest:
            midpoint = (nearest[0][0]+nearest[0][1])*.5
            if math.hypot(midpoint.x, midpoint.y) > d['bore']/2+1.3:
                assert distance >= 2.4-1e-6, (case['id'], 'native socket ligament below 2.4 mm', distance)
                assert abs(distance-d['minWeb']) < 1e-5, (case['id'], 'reported web differs from native socket distance', distance, d['minWeb'])
                web = Part.makeSphere(1.1, midpoint)
                material = overlap(lower, web)+overlap(upper, web)
                assert abs(material-web.Volume) < 1e-5, (case['id'], 'narrow drill passage or other cut removes socket web', material, web.Volume)
        checks += ['native finite socket distance and actual solid web checked around the narrow bit passage']
        flange_port = Part.makeCylinder((d['flangeWidth']+p['cartridgeClearance'])/2, d['radius']+1-d['flangeStart'], App.Vector(d['flangeStart'], 0, d['axisHeight']), App.Vector(1, 0, 0))
        theta = math.pi/12
        key_port = Part.makeCylinder(4.2, 27.2, App.Vector(d['mountRadius']*math.cos(theta), d['mountRadius']*math.sin(theta), d['axisHeight']-3))
        distance, nearest, _ = flange_port.distToShape(key_port)
        assert distance >= 2.4-1e-6 and abs(distance-d['outerWeb']) < 1e-5, (case['id'], 'native flange-to-alignment-key ligament', distance, d['outerWeb'])
        web = Part.makeSphere(1.1, (nearest[0][0]+nearest[0][1])*.5)
        assert abs(overlap(lower, web)+overlap(upper, web)-web.Volume) < 1e-5, (case['id'], 'alignment-key load path is cut away')
        checks += ['native 2.4 mm flange-to-key ligament and actual printed load path']
        # The outer M5 recess and keyed pressure-pad windows must leave real
        # PETG floors instead of a thin appearance-only skin.
        outer_floor = App.Vector(d['radius']-3, 0, d['crownBase']+2.25)
        outer_open = App.Vector(d['radius']-3, 0, d['crownBase']+2.55)
        pad_floor = App.Vector(p['tubeOD']/2+3, 0, d['crownBase']+3.1)
        pad_open = App.Vector(p['tubeOD']/2+3, 0, d['crownBase']+3.3)
        assert crown.isInside(outer_floor, 1e-6, False) and not crown.isInside(outer_open, 1e-6, False), (case['id'], 'M5 head recess must retain 2.4 mm crown floor')
        assert crown.isInside(pad_floor, 1e-6, False) and not crown.isInside(pad_open, 1e-6, False), (case['id'], 'keyed clamp pocket must retain 3.2 mm crown floor')
        checks += ['native 2.4 mm outer clamp floor and 3.2 mm keyed-pocket floor']
        for station in d['stations']:
            direction = App.Vector(*station['direction'])
            support_faces = [face for face in collar.Faces if isinstance(face.Surface, Part.Plane) and face.normalAt(0, 0).dot(direction) > 1-1e-8 and abs(face.CenterOfMass.dot(direction)-d['radius']) < 1e-6]
            assert sum(face.Area for face in support_faces) > 10, (case['id'], 'support flat', station['angle'])
            moved = {}
            for id in cassette_ids:
                moved[id] = by_id[id].copy()
                moved[id].rotate(App.Vector(), App.Vector(0, 0, 1), station['angle']-d['active']['angle'])
                for fixed_id, fixed_shape in fixed:
                    if id == 'cassette-lock' and fixed_id == 'clamp-crown':
                        continue  # M4 lock deliberately engages an undersize head pilot.
                    assert overlap(moved[id], fixed_shape) < 1e-5, (case['id'], 'indexed cassette collision', station['angle'], id, fixed_id)
            assert head.distToShape(moved['cartridge-1'])[0] < 1e-6, (case['id'], 'cassette flange not seated', station['angle'])
            assert overlap(head, shifted(moved['cartridge-1'], direction, -.1)) > .01, (case['id'], 'cassette lacks positive insertion stop', station['angle'])
            for id, shape in list(fixed) + list(moved.items()):
                assert max(v.Point.dot(direction) for v in shape.Vertexes) <= d['radius'] + 1e-5, (case['id'], 'hardware outside support flat', station['angle'], id)
            radial_start = p['tubeOD'] / 2 - p['tubeWall'] - .5
            origin = direction * radial_start
            origin.z = d['axisHeight']
            tool = Part.makeCylinder(d['drill'] / 2 - .001, d['radius'] + 5 - radial_start, origin, direction)
            assert overlap(tube, tool) > .01, (case['id'], 'reference tube was predrilled')
            for id, shape in list(fixed) + list(moved.items()):
                assert overlap(shape, tool) < 1e-5, (case['id'], 'blocked single-wall drill path', station['angle'], id)
        checks += ['cassette seats and clears every indexed socket while the tube stays clamped', 'support flats and recessed radial hardware at all stations', 'every single-wall drill path is open; reference tube remains undrilled']
    if case['state'] == 'print-layout':
        assert len(printed) == len(shapes), (case['id'], 'purchased hardware in print layout')
        source_scope = {'App': App, 'Part': Part, 'math': math}
        exec(case['assembledCode'], source_scope)
        source_shapes = dict(zip(case['assembledPieceIds'], source_scope['components']))
        for id, shape in printed:
            assert abs(shape.Volume-source_shapes[id].Volume) < max(1e-5, shape.Volume*1e-8), (case['id'], 'print layout changes manufactured material volume', id)
        for i, (id, shape) in enumerate(printed):
            bb = shape.BoundBox
            assert abs(bb.ZMin) < 1e-5, (case['id'], 'print part does not sit at Z=0', id, bb.ZMin)
            bed_faces = [face for face in shape.Faces if isinstance(face.Surface, Part.Plane) and face.normalAt(0, 0).z < -1+1e-8 and abs(face.CenterOfMass.z) < 1e-5]
            assert sum(face.Area for face in bed_faces) > 1, (case['id'], 'insufficient flat bed contact', id)
            for other_id, other in printed[i+1:]:
                ob = other.BoundBox
                assert bb.XMax < ob.XMin-.1 or ob.XMax < bb.XMin-.1 or bb.YMax < ob.YMin-.1 or ob.YMax < bb.YMin-.1, (case['id'], 'overlapping print footprints', id, other_id)
            if id == 'clamp-crown':
                roof_faces = []
                for face in shape.Faces:
                    if not isinstance(face.Surface, Part.Plane) or face.CenterOfMass.z < .01:
                        continue
                    normal = face.normalAt(0, 0)
                    assert normal.z >= -math.sqrt(.5)-1e-6, (case['id'], 'unsupported horizontal clamp-port roof', normal)
                    if abs(normal.z+math.sqrt(.5)) < 1e-6 and face.Area > 1:
                        roof_faces.append(face)
                assert len(roof_faces) >= 6, (case['id'], 'missing 45 degree clamp-port roofs')
            for point in next(piece for piece in case['pieces'] if piece['id'] == id).get('openGrooveProbes') or []:
                origin = App.Vector(*point)
                ray = Part.makeCylinder(.15, bb.ZMax-origin.z+2, origin)
                assert overlap(shape, ray) < 1e-7, (case['id'], 'cassette half-socket is not open upward in print pose', id, point)
            export_print(shape, case['id']+'_'+id)
        checks += ['print poses preserve each assembled manufactured component volume', 'manufactured pieces only, Z=0 with positive flat bed contact and separated XY footprints', 'all cassette half-sockets open upward in the production print poses', 'clamp-crown port roofs slope 45 degrees without horizontal cavity ceilings', 'each production print part exports as watertight STEP/STL']
    if case.get('export'):
        # Exercise the production standalone wrapper, including component metadata.
        doc = App.newDocument(case['id'])
        exec(case['wrapper'], {'App': App, 'Part': Part, 'math': math})
        objects = [o for o in doc.Objects if o.TypeId == 'Part::Feature']
        assert len(objects) == len(shapes), (case['id'], 'wrapper component count')
        for obj, expected in zip(objects, shapes):
            assert abs(obj.Shape.Volume - expected.Volume) < 1e-5
            assert obj.Shape.isValid() and obj.Shape.isClosed()
        doc.recompute()
        doc.saveAs(str(output / (case['id'] + '.FCStd')))
        printable = [obj for obj, piece in zip(objects, case['pieces']) if piece['supply'] == 'manufactured']
        Part.export(printable, str(output / (case['id'] + '.step')))
        imported = Part.read(str(output / (case['id'] + '.step')))
        assert imported.isValid() and len(imported.Solids) == len(printable), (case['id'], 'STEP solid count')
        expected = sum(obj.Shape.Volume for obj in printable)
        step_relative_error = abs(imported.Volume - expected) / expected
        assert step_relative_error < 1e-4, (case['id'], 'STEP volume', step_relative_error)
        App.closeDocument(doc.Name)
        reopened = App.openDocument(str(output / (case['id'] + '.FCStd')))
        assert len([o for o in reopened.Objects if o.TypeId == 'Part::Feature']) == len(shapes)
        App.closeDocument(reopened.Name)
        checks += ['production standalone wrapper / printed STEP reimport / FCStd reopen']
        if case['id'] == 'Tube90_print_layout':
            plate = MeshPart.meshFromShape(Shape=imported, LinearDeflection=.05, AngularDeflection=.15, Relative=False)
            assert plate.isSolid() and not plate.hasNonManifolds(), (case['id'], 'combined print plate STL')
            plate.write(str(output / 'Tube90_PrintLayout.stl'))
            for thickness in [.5, 1, 2, 5, 10, 20]:
                ring = Part.makeCylinder(d['spacerOD']/2, thickness).cut(Part.makeCylinder(d['stopBore']/2, thickness+2, App.Vector(0, 0, -1)))
                export_print(ring, 'HeightSpacer_%smm' % str(thickness).replace('.', 'p'))
            checks += ['complete print-plate watertight STL and reusable 0.5/1/2/5/10/20 mm stop-ring kit']
    report.append({'id': case['id'], 'codeSHA256': hashlib.sha256(case['code'].encode()).hexdigest(), 'solids': len(shapes), 'stationChecks': d['count'] if case['state'] == 'assembled' else 0, 'checks': checks, 'stepReimports': step_checks, 'result': 'PASS'})
    (output / 'validation.json').write_text(json.dumps({'units': 'mm', 'cases': report}, indent=2) + '\n')
    print(case['id'] + ': PASS', flush=True)
print('PASS: %d tube jig native cases' % len(report))
