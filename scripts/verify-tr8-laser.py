"""Prove exact DXF/SVG cut profiles and mixed 3/4 mm native blank thicknesses."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import runpy
import sys
import time

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import Import

# Reuse the established format parsers and symmetric solid-comparison helpers.
# This module's independent DXF extrusion accepts each actual sheet thickness.
HELPER_PATH = Path(__file__).with_name('verify-sfk-disc-laser.py')
helpers = runpy.run_path(str(HELPER_PATH), run_name='laser_profile_helpers')
compare, records, svg_proof, source_shape = [helpers[key] for key in ['compare', 'dxf_records', 'svg_profile_proof', 'source_shape']]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def imported_solid(path, thickness, count=1):
    doc = App.newDocument('Tr8DxfReimport')
    try:
        Import.readDXF(str(path))
        doc.recompute()
        seen = set()
        shapes = [shape for item in doc.RootObjects for shape in helpers['root_shapes'](item, seen)]
        assert shapes
        edges = [edge for shape in shapes for edge in shape.Edges]
        assert all(type(edge.Curve).__name__ in ['Line', 'Circle'] for edge in edges)
        wires = [Part.Wire(group) for group in Part.sortEdges(edges)]
        assert wires and all(wire.isClosed() for wire in wires)
        assert all(abs(vertex.Point.z) < 1e-7 for wire in wires for vertex in wire.Vertexes)
        face = Part.makeFace(wires, 'Part::FaceMakerBullseye')
        assert face.isValid() and len(face.Faces) == count
        solids = [part.extrude(App.Vector(0, 0, thickness)) for part in face.Faces]
        solid = Part.makeCompound(solids) if count > 1 else solids[0]
        assert solid.isValid() and solid.isClosed() and len(solid.Solids) == count
        return solid, {'nativeEdges': len(edges), 'closedWires': len(wires), 'nativeFaces': count,
                       'thicknessMm': thickness, 'importer': 'FreeCAD modern C++ Import.readDXF'}
    finally:
        App.closeDocument(doc.Name)


def shifted_loop(loop, offset):
    value = dict(loop)
    if loop['kind'] == 'circle':
        value['center'] = [loop['center'][axis]+offset[axis] for axis in range(2)]
    else:
        value['points'] = [[point[axis]+offset[axis] for axis in range(2)] for point in loop['points']]
    return value


def run(manifest_path, report_path=None, cases_path=None):
    started = time.perf_counter()
    manifest_path = Path(manifest_path).resolve()
    folder = manifest_path.parent
    manifest = json.loads(manifest_path.read_text())
    report_path = Path(report_path).resolve() if report_path else folder/'laser-validation.json'
    assert manifest['partId'] == 'tr8-compact-actuator' and manifest['units'] == 'mm' and manifest['scale'] == '1:1'
    assert manifest['stockThicknessesMm'] == [3, 4] and manifest['plateOccurrences'] == 5
    assert len(manifest['plates']) == 5 and manifest['totalReamedBearingHoles'] == 4
    assert sorted(plate['thickness'] for plate in manifest['plates']) == [3, 3, 3, 4, 4]
    assert sum(plate['outer']['kind'] == 'circle' and plate['outer']['radius'] == 28 for plate in manifest['plates']) == 3
    assembled = {}
    if cases_path:
        cases = json.loads(Path(cases_path).read_text())
        case = next(case for case in cases if case['mode'] == 'simple' and case['parameters']['outputAngle'] == 0)
        scope = {'App': App, 'Part': Part, 'math': math}
        exec(case['source'], scope)
        assembled = {record['AssemblyOccurrenceId']: shape for shape, record in zip(scope['components'], scope['component_metadata'])
                     if record['AssemblyOccurrenceId'] in {plate['id'] for plate in manifest['plates']}}
    rows, blanks, reamed = [], {}, 0
    for plate in manifest['plates']:
        thickness, identity = plate['thickness'], plate['id']
        dxf = folder/plate['cutDxf']
        entities = records(dxf)
        assert len(entities) == 1+len(plate['inner'])
        assert sum(row['groups'][8][0].endswith('_OUTER') for row in entities) == 1
        imported, import_info = imported_solid(dxf, thickness)
        blank = source_shape(plate['nativeCutSource'])
        finished = source_shape(plate['nativeFinishedSource'])
        assert len(blank.Solids) == len(finished.Solids) == 1
        assert abs(blank.BoundBox.ZLength-thickness) < 1e-7
        assert abs(blank.Volume-plate['cutAreaMm2']*thickness) < 1e-5
        assert abs(finished.Volume-plate['finishedAreaMm2']*thickness) < 1e-5
        profile = compare(imported, blank, identity)
        allowed = []
        for inner in plate['inner']:
            if inner.get('operation') == 'ream':
                reamed += 1
                assert inner['cutDiameter'] == 12.8 and inner['finishedDiameter'] == 13.02
                origin = App.Vector(*inner['loop']['center'], 0)
                allowed.append(Part.makeCylinder(13.02/2, thickness, origin).cut(Part.makeCylinder(12.8/2, thickness, origin)))
        removal = blank.cut(finished)
        assert finished.cut(blank).Volume < 1e-5
        finishing = compare(removal, Part.makeCompound(allowed), identity+' reaming') if allowed else {'removedMaterialMm3': 0}
        if not allowed:
            assert abs(removal.Volume) < 1e-5
        assembly = compare(assembled[identity], source_shape(plate['nativeWorldFinishedSource']), identity+' assembled') if assembled else None
        blanks[identity] = blank
        rows.append({'id': identity, **import_info, 'dxfSha256': sha(dxf), 'profileProof': profile,
                     'svgProof': svg_proof(folder/plate['cutSvg'], plate['cutLoops']),
                     'finishingProof': finishing, 'assemblyProof': assembly})
    assert reamed == 4
    nests = []
    for nest in manifest['nests']:
        thickness = nest['thickness']
        plates = [plate for plate in manifest['plates'] if plate['id'] in nest['plateIds']]
        expected, loops = [], []
        for plate in plates:
            offset = plate['nestOffsetMm']
            blank = blanks[plate['id']].copy()
            blank.translate(App.Vector(*offset, 0))
            expected.append(blank)
            loops.extend(shifted_loop(loop, offset) for loop in plate['cutLoops'])
        imported, info = imported_solid(folder/nest['dxf'], thickness, len(plates))
        assert len(records(folder/nest['dxf'])) == sum(1+len(plate['inner']) for plate in plates)
        nests.append({**info, 'plateIds': nest['plateIds'], 'profileProof': compare(imported, Part.makeCompound(expected), nest['dxf']),
                      'svgProof': svg_proof(folder/nest['svg'], loops)})
    macro_path = folder/manifest['nativeBlankMacro']
    macro_doc = App.newDocument('Tr8LaserBlankMacro')
    try:
        exec(macro_path.read_text(), {'App': App, 'Part': Part, 'math': math})
        actual_blanks = [item for item in macro_doc.Objects if hasattr(item, 'PlateId')]
        assert len(actual_blanks) == 5 and {item.PlateId for item in actual_blanks} == set(blanks)
        for item in actual_blanks:
            expected = blanks[item.PlateId]
            actual = item.Shape.copy()
            a, b = actual.BoundBox, expected.BoundBox
            actual.translate(App.Vector(b.XMin-a.XMin, b.YMin-a.YMin, b.ZMin-a.ZMin))
            compare(actual, expected, item.PlateId+' macro blank after layout translation')
            assert abs(item.StockThickness.Value-expected.BoundBox.ZLength) < 1e-7
    finally:
        App.closeDocument(macro_doc.Name)
    report = {'passed': True, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'partId': manifest['partId'],
              'freecad': '.'.join(App.Version()[:3]), 'plateOccurrences': 5, 'stockThicknessesMm': [3, 4],
              'reamedBearingHoles': reamed, 'plates': rows, 'nests': nests,
              'nativeBlankMacroSolids': 5, 'assembledFinishedProfilesChecked': bool(assembled),
              'provenance': {'manifestSha256': sha(manifest_path), 'casesSha256': sha(cases_path) if cases_path else None,
                             'checkerSha256': sha(__file__), 'profileHelperSha256': sha(HELPER_PATH), 'nativeBlankMacroSha256': sha(macro_path)},
              'elapsedSeconds': time.perf_counter()-started}
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps({'passed': True, 'plates': 5, 'nests': 2, 'report': str(report_path)}), flush=True)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest')
    parser.add_argument('report', nargs='?')
    parser.add_argument('--cases')
    args = parser.parse_args()
    run(args.manifest, args.report, args.cases)
