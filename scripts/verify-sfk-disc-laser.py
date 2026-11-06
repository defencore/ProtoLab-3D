"""Reimport actual 1:1 laser DXFs and compare their extrusions with native plates.

FreeCAD Python scripts/verify-sfk-disc-laser.py manufacturing.json [report.json]
  [--cases cases.json] [--native assembly.FCStd]

No external DXF library or network download is used. The installed modern C++
DXF importer provides the independent native curves. Blank and finished sources
come from the common profile manifest; optional assembly comparison checks the
actual finished plate occurrences as well.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import xml.etree.ElementTree as ET

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import Import

TOLERANCE = 1e-5


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def source_shape(source):
    scope = {'App': App, 'Part': Part, 'math': math}
    exec(source, scope)
    return scope['shape']


def compare(actual, expected, label):
    assert actual.isValid() and actual.isClosed() and expected.isValid() and expected.isClosed(), label
    assert len(actual.Solids) == len(expected.Solids), ('Solid count differs', label)
    first, second = actual.cut(expected).Volume, expected.cut(actual).Volume
    error = abs(actual.Volume - expected.Volume)
    assert max(abs(first), abs(second), error) < TOLERANCE, ('Native plate differs from exported profile', label, first, second, error)
    return {'extraMaterialMm3': first, 'missingMaterialMm3': second, 'volumeDifferenceMm3': error}


def dxf_records(path):
    lines = path.read_text().strip().splitlines()
    assert len(lines) % 2 == 0
    pairs = [(int(lines[index]), lines[index+1].strip()) for index in range(0, len(lines), 2)]
    units = next(index for index, value in enumerate(pairs) if value == (9, '$INSUNITS'))
    assert pairs[units+1] == (70, '4'), 'DXF must explicitly use millimetres.'
    records, current, in_entities = [], None, False
    for index, (code, value) in enumerate(pairs):
        if code == 2 and value == 'ENTITIES':
            in_entities = True
            continue
        if not in_entities:
            continue
        if code == 0:
            if current:
                records.append(current)
            if value == 'ENDSEC':
                break
            assert value in ['CIRCLE', 'LWPOLYLINE'], ('Unsupported or non-cut DXF entity', value)
            current = {'type': value, 'groups': {}}
        elif current:
            current['groups'].setdefault(code, []).append(value)
    for record in records:
        if record['type'] == 'LWPOLYLINE':
            assert record['groups'][70] == ['1'], 'Every path must be explicitly closed.'
            assert len(record['groups'][10]) == int(record['groups'][90][0])
    return records


def svg_profile_proof(path, loops):
    root = ET.parse(path).getroot()
    assert root.tag == '{http://www.w3.org/2000/svg}svg'
    assert root.attrib['width'].endswith('mm') and root.attrib['height'].endswith('mm')
    view = [float(value) for value in root.attrib['viewBox'].split()]
    assert view[:2] == [0, 0]
    assert abs(float(root.attrib['width'][:-2]) - view[2]) < 1e-9
    assert abs(float(root.attrib['height'][:-2]) - view[3]) < 1e-9
    def loop_bounds(loop):
        if loop['kind'] == 'circle':
            x,y = loop['center'];r = loop['radius']
            return [x-r,y-r,x+r,y+r]
        return [min(point[0] for point in loop['points']),min(point[1] for point in loop['points']),
                max(point[0] for point in loop['points']),max(point[1] for point in loop['points'])]
    bounds = [loop_bounds(loop) for loop in loops]
    low_x,high_y = min(value[0] for value in bounds),max(value[3] for value in bounds)
    cut = next(child for child in root if child.attrib.get('id') == 'CUT')
    assert len(cut) == len(loops) and 'transform' not in cut.attrib
    for element,loop in zip(cut,loops):
        assert 'transform' not in element.attrib
        if loop['kind'] == 'circle':
            assert element.tag.endswith('}circle')
            actual = [float(element.attrib[key]) for key in ['cx','cy','r']]
            expected = [loop['center'][0]-low_x+2,high_y-loop['center'][1]+2,loop['radius']]
        else:
            assert element.tag.endswith('}path')
            data = element.attrib['d']
            assert re.findall('[A-Za-z]',data) == ['M'] + ['L']*(len(loop['points'])-1) + ['Z']
            actual = [float(value) for value in re.findall(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',data)]
            expected = [value for x,y in loop['points'] for value in [x-low_x+2,high_y-y+2]]
        assert len(actual)==len(expected) and max(abs(a-b) for a,b in zip(actual,expected)) < 1e-9, ('SVG contour differs from native cutting profile',path)
    return {'sha256':sha(path),'scale':'1 native unit = 1 mm','closedContours':len(loops)}


def root_shapes(item, seen=None):
    seen = seen if seen is not None else set()
    if item.Name in seen:
        return
    seen.add(item.Name)
    if hasattr(item, 'Shape') and not item.Shape.isNull() and item.Shape.Edges:
        yield item.Shape
    elif hasattr(item, 'Group'):
        for child in item.Group:
            yield from root_shapes(child, seen)


def imported_face(path, expected_outer_count=1):
    doc = App.newDocument('LaserDxfReimport')
    try:
        # Direct C++ entry point: no legacy importer and no downloadable modules.
        stats = Import.readDXF(str(path))
        doc.recompute()
        seen = set()
        shapes = [shape for item in doc.RootObjects for shape in root_shapes(item, seen)]
        assert shapes, ('DXF importer produced no native geometry', path)
        edges = [edge for shape in shapes for edge in shape.Edges]
        assert edges and all(type(edge.Curve).__name__ in ['Line', 'Circle'] for edge in edges)
        wires = [Part.Wire(group) for group in Part.sortEdges(edges)]
        assert all(wire.isClosed() for wire in wires), ('Reimported DXF contains an open contour', path)
        assert all(abs(vertex.Point.z) < 1e-7 for wire in wires for vertex in wire.Vertexes)
        # FaceMaker classifies the independent imported wires by geometric nesting.
        face = Part.makeFace(wires, 'Part::FaceMakerBullseye')
        assert face.isValid() and len(face.Faces) == expected_outer_count, ('Unexpected number of native plate profiles', path, len(face.Faces))
        solids = [part.extrude(App.Vector(0, 0, 4)) for part in face.Faces]
        solid = Part.makeCompound(solids) if len(solids) > 1 else solids[0]
        assert solid.isValid() and solid.isClosed() and len(solid.Solids) == expected_outer_count
        return solid, {'nativeEdges': len(edges), 'nativeClosedWires': len(wires), 'nativeFaces': len(face.Faces), 'nativeVolumeMm3': solid.Volume, 'importer': 'FreeCAD modern C++ Import.readDXF'}
    finally:
        App.closeDocument(doc.Name)


def physical_features(root):
    for item in root.Group:
        if item.TypeId == 'App::Part':
            yield from physical_features(item)
        elif hasattr(item, 'Shape') and hasattr(item, 'AssemblyOccurrenceId'):
            shape = item.Shape.copy()
            shape.Placement = item.getGlobalPlacement()
            yield item.AssemblyOccurrenceId, shape


def run(manifest_path, report_path=None, cases_path=None, native_path=None):
    started = time.perf_counter()
    manifest_path = Path(manifest_path).resolve()
    folder = manifest_path.parent
    manifest = json.loads(manifest_path.read_text())
    report_path = Path(report_path).resolve() if report_path else folder / 'laser-validation.json'
    assert manifest['partId'] == 'sfk-disc-actuator' and manifest['units'] == 'mm' and manifest['scale'] == '1:1'
    assert manifest['thicknessMm'] == 4 and manifest['plateOccurrences'] == 5
    assert len(manifest['plates']) == 5 and manifest['totalReamedBearingHoles'] == 4
    assert len({plate['id'] for plate in manifest['plates']}) == 5
    assert sum(plate['outer']['kind'] == 'circle' and plate['outer']['radius'] == 34 for plate in manifest['plates']) == 3
    assembled, assembly_doc = {}, None
    if native_path:
        native_path = Path(native_path).resolve()
        assembly_doc = App.openDocument(str(native_path))
        root = next(item for item in assembly_doc.RootObjects if getattr(item, 'PartId', None) == manifest['partId'])
        for identity, shape in physical_features(root):
            if identity in {plate['id'] for plate in manifest['plates']}:
                assert identity not in assembled
                assembled[identity] = shape
    elif cases_path:
        cases = json.loads(Path(cases_path).read_text())
        case = next(case for case in cases if case['mode'] == 'simple' and case['parameters']['outputAngle'] == 0)
        assert case['id'] == manifest['partId']
        scope = {'App': App, 'Part': Part, 'math': math}
        exec(case['source'], scope)
        assembled = {record['AssemblyOccurrenceId']: shape for shape, record in zip(scope['components'], scope['component_metadata']) if record['AssemblyOccurrenceId'] in {plate['id'] for plate in manifest['plates']}}
    rows, nested_blanks, reamed = [], [], 0
    try:
        for plate in manifest['plates']:
            assert plate['thickness'] == 4 and plate['quantity'] == 1
            path = folder / plate['cutDxf']
            records = dxf_records(path)
            assert len(records) == 1 + len(plate['inner'])
            assert sum(record['groups'][8][0].endswith('_OUTER') for record in records) == 1
            svg_proof = svg_profile_proof(folder / plate['cutSvg'], plate['cutLoops'])
            imported, import_report = imported_face(path)
            blank = source_shape(plate['nativeCutSource'])
            finished = source_shape(plate['nativeFinishedSource'])
            assert len(blank.Solids) == len(finished.Solids) == 1
            assert abs(blank.BoundBox.ZLength - 4) < 1e-7 and abs(finished.BoundBox.ZLength - 4) < 1e-7
            assert abs(blank.Volume - plate['cutAreaMm2'] * 4) < TOLERANCE
            assert abs(finished.Volume - plate['finishedAreaMm2'] * 4) < TOLERANCE
            profile_proof = compare(imported, blank, plate['id'])
            allowed = []
            for inner in plate['inner']:
                if inner.get('operation') == 'ream':
                    reamed += 1
                    assert inner['loop']['kind'] == 'circle' and inner['cutDiameter'] == 12.8 and inner['finishedDiameter'] == 13.02
                    center = inner['loop']['center']
                    outer = Part.makeCylinder(13.02/2, 4, App.Vector(center[0], center[1], 0))
                    pilot = Part.makeCylinder(12.8/2, 4, App.Vector(center[0], center[1], 0))
                    allowed.append(outer.cut(pilot))
                else:
                    assert 'cutDiameter' not in inner
            removal = blank.cut(finished)
            assert finished.cut(blank).Volume < TOLERANCE, 'Finishing must only remove stock.'
            expected_removal = Part.makeCompound(allowed) if allowed else Part.Shape()
            if allowed:
                finishing_proof = compare(removal, expected_removal, plate['id'] + ' reaming stock')
            else:
                assert abs(removal.Volume) < TOLERANCE
                finishing_proof = {'removedMaterialMm3': 0}
            assembly_proof = None
            if assembled:
                assert plate['id'] in assembled
                world_finished = source_shape(plate['nativeWorldFinishedSource'])
                assembly_proof = compare(assembled[plate['id']], world_finished, plate['id'] + ' assembled profile')
            offset = plate['nestOffsetMm']
            nested = blank.copy(); nested.translate(App.Vector(offset[0], offset[1], 0)); nested_blanks.append(nested)
            rows.append({'id': plate['id'], 'thicknessMm': 4, 'dxfSha256': sha(path), **import_report,
                         'profileProof': profile_proof, 'svgProof': svg_proof, 'finishingProof': finishing_proof, 'assemblyProof': assembly_proof})
            print(json.dumps({'plate': plate['id'], 'nativeDxfMatch': True, 'reamedBearingHoles': len(allowed)}), flush=True)
        assert reamed == 4
        nest_path = folder / manifest['nestDxf']
        nest_records = dxf_records(nest_path)
        assert sum(record['groups'][8][0].endswith('_OUTER') for record in nest_records) == 5
        assert len(nest_records) == sum(1 + len(plate['inner']) for plate in manifest['plates'])
        imported_nest, nest_report = imported_face(nest_path, 5)
        nest_proof = compare(imported_nest, Part.makeCompound(nested_blanks), 'five-plate cutting layout')
        nested_loops = []
        for plate in manifest['plates']:
            offset = plate['nestOffsetMm']
            for loop in plate['cutLoops']:
                value = dict(loop)
                if loop['kind'] == 'circle':
                    value['center'] = [loop['center'][axis]+offset[axis] for axis in range(2)]
                else:
                    value['points'] = [[point[axis]+offset[axis] for axis in range(2)] for point in loop['points']]
                nested_loops.append(value)
        nest_svg = svg_profile_proof(folder / manifest['nestSvg'], nested_loops)
        # Execute the actual downloadable native blank macro too; it must produce
        # five distinct, uniformly thick physical plate occurrences.
        macro_path = folder / manifest['nativeBlankMacro']
        macro_doc = App.newDocument('LaserBlankMacroAudit')
        try:
            exec(macro_path.read_text(), {'App': App, 'Part': Part, 'math': math})
            blanks = [item for item in macro_doc.Objects if hasattr(item, 'PlateId')]
            assert {item.PlateId for item in blanks} == {plate['id'] for plate in manifest['plates']}
            assert len(blanks) == 5
            for item, plate in zip(blanks, manifest['plates']):
                assert item.StockThickness.Value == 4
                expected = nested_blanks[next(i for i, value in enumerate(manifest['plates']) if value['id'] == item.PlateId)]
                compare(item.Shape, expected, item.PlateId + ' native blank macro')
        finally:
            App.closeDocument(macro_doc.Name)
        report = {'passed': True, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]),
                  'partId': manifest['partId'], 'units': 'mm', 'scale': '1:1', 'plateOccurrences': 5, 'uniformThicknessMm': 4,
                  'reamedBearingHoles': reamed, 'plates': rows, 'combinedNest': {**nest_report, 'proof': nest_proof,'svgProof':nest_svg},
                  'nativeBlankMacroSolids': 5, 'assembledFinishedProfilesChecked': bool(assembled),
                  'geometryProof': 'DXF native reimport equals the actual uniform profile extrusion. Finished geometry differs only by the four explicitly listed through bearing-ream annuli; no hidden pockets, counterbores or plate threads.',
                  'provenance': {'manifestSha256': sha(manifest_path), 'checkerSourceSha256': sha(__file__), 'nativeBlankMacroSha256': sha(macro_path),
                                 'casesSha256': sha(cases_path) if cases_path else None, 'nativeFileSha256': sha(native_path) if native_path else None},
                  'elapsedSeconds': time.perf_counter() - started}
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2))
        print(json.dumps({'passed': True, 'plates': 5, 'reamedBearingHoles': reamed, 'assembledProfilesChecked': bool(assembled), 'report': str(report_path)}), flush=True)
        return report
    finally:
        if assembly_doc:
            App.closeDocument(assembly_doc.Name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest')
    parser.add_argument('report', nargs='?')
    parser.add_argument('--cases')
    parser.add_argument('--native')
    args = parser.parse_args()
    run(args.manifest, args.report, args.cases, args.native)
