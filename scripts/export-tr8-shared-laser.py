"""Freeze exact merged native cut wires for the quad's three round laser discs.

Input is the generated main-plates.json containing the current cut/finished
native sources and their SHA256 signature. Run with a FreeCAD-enabled Python.
No construction window is exported directly and no curve is polygonized.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part


def point(vector):
    return [float(vector.x), float(vector.y)]


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def flip(edge):
    result = dict(edge, **{'from': edge['to'], 'to': edge['from']})
    if edge['kind'] == 'arc':
        result.update(start=edge['end'], end=edge['start'], clockwise=not edge['clockwise'])
    return result


def ordered_wire(wire):
    assert wire.isClosed(), 'A laser wire must be closed.'
    edges = []
    for native in wire.Edges:
        curve = native.Curve
        start = point(native.valueAt(native.FirstParameter))
        end = point(native.valueAt(native.LastParameter))
        if isinstance(curve, Part.Circle):
            center = point(curve.Center)
            if distance(start, end) < 1e-7:
                assert len(wire.Edges) == 1
                return [dict(kind='circle', center=center, radius=float(curve.Radius))]
            middle = point(native.valueAt((native.FirstParameter + native.LastParameter) / 2))
            angle = lambda p: math.atan2(p[1] - center[1], p[0] - center[0])
            a, b, m = angle(start), angle(end), angle(middle)
            clockwise = (m - a) % (2 * math.pi) > (b - a) % (2 * math.pi) + 1e-8
            edges.append(dict(kind='arc', **{'from': start, 'to': end},
                              center=center, radius=float(curve.Radius),
                              start=a, end=b, clockwise=clockwise))
        else:
            assert isinstance(curve, (Part.Line, Part.LineSegment)), type(curve).__name__
            edges.append(dict(kind='line', **{'from': start, 'to': end}))
    ordered = [edges.pop(0)]
    while edges:
        last = ordered[-1]['to']
        found = next((i for i, edge in enumerate(edges)
                      if min(distance(last, edge['from']), distance(last, edge['to'])) < 1e-6), None)
        assert found is not None, ('Disconnected native cut wire', last)
        edge = edges.pop(found)
        if distance(last, edge['to']) < distance(last, edge['from']):
            edge = flip(edge)
        ordered.append(edge)
    assert distance(ordered[-1]['to'], ordered[0]['from']) < 1e-6
    return ordered


def scalar(value):
    return format(0 if abs(value) < 1e-12 else value, '.12g')


def dxf(loops):
    pairs = [0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1015',
             9, '$INSUNITS', 70, 4, 9, '$MEASUREMENT', 70, 1, 0, 'ENDSEC',
             0, 'SECTION', 2, 'ENTITIES']
    for index, loop in enumerate(loops):
        for edge in loop:
            layer = 'OUTER' if index == 0 else 'INNER'
            if edge['kind'] == 'circle':
                pairs.extend([0, 'CIRCLE', 8, layer, 10, edge['center'][0],
                              20, edge['center'][1], 30, 0, 40, edge['radius']])
            elif edge['kind'] == 'line':
                pairs.extend([0, 'LINE', 8, layer, 10, edge['from'][0], 20, edge['from'][1],
                              30, 0, 11, edge['to'][0], 21, edge['to'][1], 31, 0])
            else:
                start, end = edge['start'], edge['end']
                if edge['clockwise']:
                    start, end = end, start
                pairs.extend([0, 'ARC', 8, layer, 10, edge['center'][0], 20, edge['center'][1],
                              30, 0, 40, edge['radius'], 50, math.degrees(start) % 360,
                              51, math.degrees(end) % 360])
    pairs.extend([0, 'ENDSEC', 0, 'EOF'])
    return '\n'.join(scalar(value) if isinstance(value, float) else str(value) for value in pairs) + '\n'


def svg(plate_id, loops, half):
    paths = []
    for loop in loops:
        if loop[0]['kind'] == 'circle':
            edge = loop[0]
            paths.append('<circle cx="%s" cy="%s" r="%s"/>' %
                         tuple(map(scalar, [*edge['center'], edge['radius']])))
            continue
        values = ['M' + ' '.join(map(scalar, loop[0]['from']))]
        for edge in loop:
            if edge['kind'] == 'line':
                values.append('L' + ' '.join(map(scalar, edge['to'])))
            else:
                sweep = ((edge['start'] - edge['end']) if edge['clockwise']
                         else (edge['end'] - edge['start'])) % (2 * math.pi)
                values.append('A%s %s 0 %d %d %s' %
                              (scalar(edge['radius']), scalar(edge['radius']),
                               int(sweep > math.pi), int(not edge['clockwise']),
                               ' '.join(map(scalar, edge['to']))))
        paths.append('<path d="' + ' '.join(values) + ' Z"/>')
    size = 2 * half + 4
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<svg xmlns="http://www.w3.org/2000/svg" width="%smm" height="%smm" viewBox="0 0 %s %s">'
            '<title>TR8 quad %s, 3 mm steel, scale 1:1 in millimetres</title>'
            '<g transform="translate(%s %s) scale(1 -1)" fill="none" stroke="#111" stroke-width="0.1">%s</g></svg>\n' %
            (*[scalar(size)] * 4, plate_id, scalar(half + 2), scalar(half + 2), ''.join(paths)))


def freeze(input_path, output_path, report_path):
    data = json.loads(Path(input_path).read_text())
    source_text = json.dumps([dict(id=record['id'], stationX=record['stationX'],
                                   source=record['flatCutSource'])
                              for record in data['plates']], ensure_ascii=False, separators=(',', ':'))
    assert hashlib.sha256(source_text.encode()).hexdigest() == data['signature'], 'Stale native cut sources.'
    plates, rows = [], []
    total_seats = 0
    for record in data['plates']:
        shapes = {}
        for key in ['flatCutSource', 'flatFinishedSource']:
            scope = {'App': App, 'Part': Part, 'math': math}
            exec(record[key], scope)
            shape = scope['shape']
            assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1, record['id']
            shapes[key] = shape
        cut, finished = shapes['flatCutSource'], shapes['flatFinishedSource']
        seats = sum(feature.get('operation') == 'ream' for feature in record['cuts'])
        expected_delta = seats * math.pi * (6.51 ** 2 - 6.4 ** 2)
        area_delta = (cut.Volume - finished.Volume) / 3
        assert abs(area_delta - expected_delta) < 1e-6, (record['id'], area_delta, expected_delta)
        total_seats += seats
        bottoms = [face for face in cut.Faces if face.BoundBox.ZLength < 1e-7
                   and abs(face.BoundBox.ZMin) < 1e-7]
        assert len(bottoms) == 1, (record['id'], len(bottoms))
        face = bottoms[0]
        wires = [face.OuterWire] + [wire for wire in face.Wires if not wire.isSame(face.OuterWire)]
        loops = [ordered_wire(wire) for wire in wires]
        half = record['outer']['radius']
        plates.append(dict(id=record['id'], thickness=3, dxf=dxf(loops), svg=svg(record['id'], loops, half)))
        row = dict(id=record['id'], valid=True, closed=True, solids=1,
                   nativeCutAreaMm2=cut.Volume / 3, nativeFinishedAreaMm2=finished.Volume / 3,
                   bearingSeats=seats, pilotFinishedAreaDeltaMm2=area_delta,
                   expectedPilotFinishedAreaDeltaMm2=expected_delta,
                   closedMergedWires=len(loops), edges=sum(map(len, loops)))
        rows.append(row)
        print(json.dumps(row), flush=True)
    assert total_seats == 8, total_seats
    result = dict(schemaVersion=1, signature=data['signature'], plates=plates)
    Path(output_path).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    Path(report_path).write_text(json.dumps(dict(passed=True, signature=data['signature'],
                                               mainBearingSeats=total_seats, plates=rows), indent=2) + '\n')


if __name__ == '__main__':
    freeze(*sys.argv[1:4])
