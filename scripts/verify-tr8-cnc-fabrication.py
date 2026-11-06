"""Verify actual public API fabrication outputs using independent native contour readers.

Generate inputs first with verify-tr8-cnc-fabrication.ts. No assembly geometry is
regenerated here except the public expectations captured alongside each output.
"""
import hashlib
import json
import math
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part

ROOT = Path(__file__).resolve().parents[1]
START = time.perf_counter()
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
vec = lambda point: App.Vector(point[0], point[1], 0)
close = lambda a, b: (a - b).Length < 1e-6


def valid_solid(shape):
    assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1


def difference(a, b):
    first, second = a.cut(b), b.cut(a)
    assert first.isValid() and second.isValid(), 'Invalid symmetric-difference result'
    return abs(first.Volume) + abs(second.Volume)


def connected_wires(edges):
    remaining = [edge.copy() for edge in edges]
    wires = []
    while remaining:
        selected = [remaining.pop(0)]
        start = selected[0].Vertexes[0].Point
        end = selected[-1].Vertexes[-1].Point
        while not close(start, end):
            found = False
            for index, edge in enumerate(remaining):
                if close(edge.Vertexes[0].Point, end):
                    selected.append(remaining.pop(index)); found = True; break
                if close(edge.Vertexes[-1].Point, end):
                    edge = remaining.pop(index); edge.reverse()
                    selected.append(edge); found = True; break
            assert found, 'Open or disconnected laser contour'
            end = selected[-1].Vertexes[-1].Point
        wire = Part.Wire(selected)
        assert wire.isClosed() and wire.isValid()
        wires.append(wire)
    return wires


def cut_face(wires):
    faces = sorted([Part.Face(wire) for wire in wires], key=lambda face: face.Area, reverse=True)
    assert faces and all(face.isValid() for face in faces)
    outer, holes = faces[0], faces[1:]
    # Cutting files must contain closed, disjoint holes, entirely within one outline.
    for index, hole in enumerate(holes):
        assert hole.cut(outer).Area < 1e-7, 'Hole outside outer contour'
        assert hole.distToShape(outer.OuterWire)[0] > .01, 'Hole touches exterior'
        for previous in holes[:index]:
            assert hole.common(previous).Area < 1e-8, 'Duplicate, nested or overlapping cut contours'
    result = outer
    for hole in holes:
        result = result.cut(hole)
    assert result.isValid() and len(result.Faces) == 1
    assert abs(result.Area - (outer.Area - sum(hole.Area for hole in holes))) < 1e-6
    return result


def dxf_read(path):
    lines = path.read_text().splitlines()
    assert len(lines) % 2 == 0
    pairs = [(int(lines[index]), lines[index + 1]) for index in range(0, len(lines), 2)]
    unit = next(pairs[index + 1][1] for index, pair in enumerate(pairs) if pair == (9, '$INSUNITS'))
    assert unit == '4', 'DXF must use millimetres'
    edges, wires, entities = [], [], []
    section, index = False, 0
    while index < len(pairs):
        code, name = pairs[index]
        if code == 2 and name == 'ENTITIES':
            section = True; index += 1; continue
        if section and code == 0 and name == 'ENDSEC':
            break
        if section and code == 0:
            end = index + 1
            while end < len(pairs) and pairs[end][0] != 0:
                end += 1
            values = dict(pairs[index + 1:end]); entities.append(name)
            number = lambda key: float(values[key])
            if name == 'LINE':
                edges.append(Part.makeLine(vec([number(10), number(20)]), vec([number(11), number(21)])))
            elif name == 'CIRCLE':
                wires.append(Part.Wire([Part.makeCircle(number(40), vec([number(10), number(20)]))]))
            elif name == 'ARC':
                start = math.radians(number(50)); stop = math.radians(number(51))
                stop = start + (stop - start) % (2 * math.pi)
                point = lambda angle: vec([number(10) + number(40) * math.cos(angle), number(20) + number(40) * math.sin(angle)])
                edges.append(Part.Arc(point(start), point((start + stop) / 2), point(stop)).toShape())
            else:
                raise ValueError('Unexpected DXF entity ' + name)
            index = end; continue
        index += 1
    wires += connected_wires(edges)
    return cut_face(wires), len(wires), entities


def svg_arc(start, stop, radius, large, sweep):
    dx, dy = stop[0] - start[0], stop[1] - start[1]
    length = math.hypot(dx, dy)
    assert 1e-8 < length <= 2 * radius + 1e-7
    height = math.sqrt(max(0, radius * radius - length * length / 4))
    mid = [(start[0] + stop[0]) / 2, (start[1] + stop[1]) / 2]
    for sign in [-1, 1]:
        centre = [mid[0] - sign * dy * height / length, mid[1] + sign * dx * height / length]
        a = math.atan2(start[1] - centre[1], start[0] - centre[0])
        b = math.atan2(stop[1] - centre[1], stop[0] - centre[0])
        delta = (b - a) % (2 * math.pi) if sweep else -((a - b) % (2 * math.pi))
        if bool(abs(delta) > math.pi + 1e-7) == bool(large):
            middle = [centre[0] + radius * math.cos(a + delta / 2), centre[1] + radius * math.sin(a + delta / 2)]
            return Part.Arc(vec(start), vec(middle), vec(stop)).toShape()
    raise ValueError('Invalid SVG circular arc')


def svg_read(path):
    root = ET.parse(path).getroot()
    view = list(map(float, root.attrib['viewBox'].split()))
    assert root.attrib['width'].endswith('mm') and root.attrib['height'].endswith('mm')
    width, height = float(root.attrib['width'][:-2]), float(root.attrib['height'][:-2])
    assert abs(width - view[2]) < 1e-9 and abs(height - view[3]) < 1e-9
    wires = []
    for node in root.iter():
        kind = node.tag.split('}')[-1]
        if kind == 'circle':
            wires.append(Part.Wire([Part.makeCircle(float(node.attrib['r']), vec([float(node.attrib['cx']), float(node.attrib['cy'])]))]))
        elif kind == 'path':
            tokens = re.findall(r'[MLAZ]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?', node.attrib['d'])
            index, edges, start, current = 0, [], None, None
            while index < len(tokens):
                command = tokens[index]; index += 1
                if command == 'M':
                    assert not edges
                    start = current = [float(tokens[index]), float(tokens[index + 1])]; index += 2
                elif command == 'L':
                    point = [float(tokens[index]), float(tokens[index + 1])]; index += 2
                    if math.dist(current, point) > 1e-8:
                        edges.append(Part.makeLine(vec(current), vec(point)))
                    current = point
                elif command == 'A':
                    rx, ry, rotation, large, sweep, x, y = map(float, tokens[index:index + 7]); index += 7
                    assert abs(rx - ry) < 1e-8 and rotation == 0
                    point = [x, y]
                    edges.append(svg_arc(current, point, rx, int(large), int(sweep))); current = point
                elif command == 'Z':
                    if math.dist(current, start) > 1e-8:
                        edges.append(Part.makeLine(vec(current), vec(start)))
                    wires += connected_wires(edges); edges = []; current = start
                else:
                    raise ValueError('Unexpected SVG path command ' + command)
            assert not edges, 'SVG path must close explicitly'
    face = cut_face(wires)
    group = next(node for node in root.iter() if node.tag.split('}')[-1] == 'g')
    assert group.attrib['transform'] == 'scale(1,-1)'
    bounds = face.BoundBox
    assert bounds.XMin >= view[0] - 1e-6 and bounds.XMax <= view[0] + view[2] + 1e-6
    assert -bounds.YMax >= view[1] - 1e-6 and -bounds.YMin <= view[1] + view[3] + 1e-6
    return face, len(wires), {'oneUnitPerMm': True, 'withinViewport': True, 'physicalSizeMm': [width, height]}


def transform(shape, translation, rotation):
    for axis, angle in zip([App.Vector(1, 0, 0), App.Vector(0, 1, 0), App.Vector(0, 0, 1)], rotation):
        if angle:
            shape.rotate(App.Vector(), axis, angle)
    shape.translate(App.Vector(*translation))
    return shape


def evaluate(source):
    scope = {'App': App, 'Part': Part, 'math': math, '_pl_transform': transform}
    exec(source, scope)
    return scope['shape']


def run(folder):
    started = time.perf_counter()
    path = folder / 'fabrication-expectations.json'
    expected = json.loads(path.read_text())
    for source in expected['sourceHashes']:
        assert digest(ROOT / source['path']) == source['sha256'], 'Source changed after API capture: ' + source['path']
    assert len(expected['files']) == len(set(item['name'] for item in expected['files'])) == 12
    for item in expected['files']:
        assert digest(folder / item['name']) == item['sha256']
    stem = expected['stem']
    manifest = json.loads((folder / (stem + '-cut-manifest.json')).read_text())
    assert manifest['mainOuterDiscs'] == 2 and manifest['forks'] == 4 and manifest['integralMiddleBodies'] == 1
    assert manifest['units'] == 'mm' and manifest['scale'] == '1:1' and manifest['laserStockThickness'] == 3
    blank_scope = {}
    exec((folder / (stem + '-laser-blanks.FCMacro')).read_text(), blank_scope)
    blank_doc = blank_scope['doc']
    blanks = [blank_doc.getObject('Blank' + str(index)).Shape for index in range(6)]
    assert len([obj for obj in blank_doc.Objects if hasattr(obj, 'Shape')]) == 6
    for blank in blanks:
        valid_solid(blank)
        assert abs(blank.BoundBox.ZMin) < 1e-6 and abs(blank.BoundBox.ZMax - 3) < 1e-6
    minimum_layout_gap = min(blanks[a].distToShape(blanks[b])[0] for a in range(6) for b in range(a))
    assert minimum_layout_gap >= 4.99, 'Native laser blanks overlap or lack declared spacing'
    records = []
    for row in expected['rows']:
        identity = row['id']
        dxf, dxf_count, entities = dxf_read(folder / (stem + '-' + identity + '-3mm.dxf'))
        svg, svg_count, svg_meta = svg_read(folder / (stem + '-' + identity + '-3mm.svg'))
        assert dxf_count == svg_count == {'motor-disc': 17, 'end-disc': 9, 'fork': 3}[identity]
        dxf_solid = dxf.extrude(App.Vector(0, 0, 3))
        svg_solid = svg.extrude(App.Vector(0, 0, 3))
        pair_diff = difference(dxf_solid, svg_solid)
        assert pair_diff < 1e-6, (identity, 'DXF/SVG mismatch', pair_diff)
        pilot, finished = evaluate(row['pilotSource']), evaluate(row['finishedSource'])
        valid_solid(pilot); valid_solid(finished)
        analytic_diff = difference(dxf_solid, pilot)
        assert analytic_diff < 1e-5, (identity, 'Public blank recipe mismatch', analytic_diff)
        finished_outside = finished.cut(pilot)
        assert finished_outside.isValid() and abs(finished_outside.Volume) < 1e-6
        removed = pilot.cut(finished)
        assert removed.isValid()
        assert abs(removed.Volume - row['expectedAreaRemoved'] * 3) < 1e-5, (identity, 'Pilot finishing mismatch')
        assert abs((pilot.Volume - finished.Volume) - removed.Volume) < 1e-5
        placements = []
        for index, translation in zip(row['indices'], row['translations']):
            blank = blanks[index].copy(); blank.translate(-App.Vector(*translation))
            delta = difference(blank, pilot)
            assert delta < 1e-5, (identity, 'Six-blank native macro mismatch', delta)
            placements.append({'nativeBlank': index, 'symmetricDifferenceMm3': delta})
        assembled_diff = None
        if 'assembledSource' in row:
            assembled = evaluate(row['assembledSource']); valid_solid(assembled)
            world_finished = finished.copy()
            if identity == 'fork':
                world_finished.translate(App.Vector(0, 0, -3))
                world_finished.rotate(App.Vector(), App.Vector(1, 0, 0), 90)
                world_finished.translate(App.Vector(0, expected['linkage']['forkInnerFace'], 0))
                matched_drill = Part.makeCylinder(expected['linkage']['crossPinDiameter'] / 2, 20,
                                                 App.Vector(-10, expected['linkage']['pinCentreY'], 0), App.Vector(1, 0, 0))
                world_finished = world_finished.cut(matched_drill)
            else:
                world_finished.rotate(App.Vector(), App.Vector(1, 1, 1), 120)
                world_finished.translate(App.Vector(row['assembledStation'], 0, 0))
            assembled_diff = difference(assembled, world_finished)
            assert assembled_diff < 1e-5, (identity, 'Finished assembly disc mismatch', assembled_diff)
        records.append({'id': identity, 'quantity': row['quantity'], 'closedContours': dxf_count,
                        'cutAreaMm2': dxf.Area, 'DXFSVG_differenceMm3': pair_diff,
                        'publicBlank_differenceMm3': analytic_diff, 'pilotHolesPerBlank': row['pilotHoles'],
                        'finishingRemovedMm3': removed.Volume, 'assembledFinished_differenceMm3': assembled_diff,
                        'nativeBlankChecks': placements, 'svg': svg_meta})
    App.closeDocument(blank_doc.Name)
    middle_path = folder / (stem + '-middle-body.FCMacro')
    middle_source = middle_path.read_text()
    assert expected['expectedBodySource'] in middle_source, 'CNC macro differs from authoritative public frame source'
    assert hashlib.sha256(expected['expectedBodySource'].encode()).hexdigest() == expected['expectedBodySourceSha256']
    middle_scope = {}
    exec(middle_source, middle_scope)
    doc = middle_scope['doc']
    objects = [obj for obj in doc.Objects if hasattr(obj, 'Shape')]
    assert len(objects) == 1 and objects[0].Name == 'CncMiddleBody'
    shape = objects[0].Shape; valid_solid(shape)
    assert len(objects[0].SourceRGB) == 3
    bounds = shape.optimalBoundingBox(False, False)
    ordinary = shape.BoundBox
    expected_bounds = [expected['layout']['motorPlateX'] + 3, -expected['layout']['diameter'] / 2,
                       -expected['layout']['diameter'] / 2, expected['layout']['endPlateX'],
                       expected['layout']['diameter'] / 2, expected['layout']['diameter'] / 2]
    actual_bounds = [bounds.XMin, bounds.YMin, bounds.ZMin, bounds.XMax, bounds.YMax, bounds.ZMax]
    assert max(abs(a - b) for a, b in zip(actual_bounds, expected_bounds)) < 1e-4, 'CNC body exceeds its billet envelope'
    middle = {'solids': len(shape.Solids), 'faces': len(shape.Faces), 'valid': True, 'closed': True,
              'volumeMm3': shape.Volume, 'boundsMm': actual_bounds,
              'conservativeOCCBoundsMm': [ordinary.XMin, ordinary.YMin, ordinary.ZMin, ordinary.XMax, ordinary.YMax, ordinary.ZMax],
              'authoritativeSourceSha256': expected['expectedBodySourceSha256']}
    App.closeDocument(doc.Name)
    report = {'schemaVersion': 1, 'passed': True, 'partId': expected['partId'], 'mode': expected['mode'],
              'expectationsSha256': digest(path), 'sourceHashes': expected['sourceHashes'], 'apiFiles': expected['files'],
              'laserBlanks': 6, 'pilotHoles': 8, 'minimumBlankLayoutGapMm': minimum_layout_gap,
              'profiles': records, 'cncMiddleBody': middle, 'elapsedSeconds': time.perf_counter() - started}
    (folder / 'fabrication-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'partId': expected['partId'], 'mode': expected['mode'], 'passed': True,
                      'laserBlanks': 6, 'cncFaces': middle['faces'], 'elapsedSeconds': report['elapsedSeconds']}), flush=True)
    return report


if __name__ == '__main__':
    if len(sys.argv) > 1:
        folders = [Path(value).resolve() for value in sys.argv[1:]]
    else:
        captures = json.loads((ROOT / 'test-results/tr8-quad-milled-study/fabrication-captures.json').read_text())
        folders = [Path(item['directory']) for item in captures]
    reports = [run(folder) for folder in folders]
    summary = {'schemaVersion': 1, 'passed': True, 'cases': reports, 'elapsedSeconds': time.perf_counter() - START}
    (ROOT / 'test-results/tr8-quad-milled-study/fabrication-report.json').write_text(json.dumps(summary, indent=2) + '\n')
