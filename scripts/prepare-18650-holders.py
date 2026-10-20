"""Bake pinned MPD 18650 STEP models and explicitly declared wired proxies.

Run with FreeCAD Python: scripts/prepare-18650-holders.py [model-id ...]
Place the three original BK-18650-PC4/PC6/PC8.STEP files in /tmp, or set
HOLDER_SOURCE_DIR. This offline importer checks their exact SHA-256 hashes.

MPD variants retain every source solid and use only Rx(+90 deg), then Z(-3.2).
The BeiLaMoo variants are declared mechanical reconstructions using the MPD
solids as proxies. Their contacts are trimmed at the tray underside and two
assumed wire entrances are drilled through the negative-X wall. This does
not establish factory geometry, contact wiring, fit tolerances or ratings.
External leads are omitted from the part model and FreeCAD export.
"""

import base64
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import sys
import zlib

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import MeshPart
import Part

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'src/parts/li-ion-battery-holder/lib/native'
SOURCES = Path(os.environ.get('HOLDER_SOURCE_DIR', '/tmp'))
LINEAR_DEFLECTION = .025
SPECS = {
    2: {
        'part': 'BK-18650-PC4', 'downloadId': 1435,
        'sha': '05981dfcd16010cf7f94161a07a1ce0ff2a1dfa389d460bcbf7a5fdf44fcfc7e',
        'bodyDimensions': [77.70, 40.21, 21.54],
        'wiredProductId': 21007225,
        'wiredSlug': 'Two_18650_In_Series_Battery_Holder_with_Wire_Leads.html',
    },
    3: {
        'part': 'BK-18650-PC6', 'downloadId': 1437,
        'sha': 'd5d1ba3bdac990db31d7fac8107b9d2fc293f567080af6f3b552be542da0bdc2',
        'bodyDimensions': [77.70, 59.69, 21.54],
        'wiredProductId': 21007228,
        'wiredSlug': 'Three_18650_In_Series_Battery_Holder_with_Wire_Lea.html',
    },
    4: {
        'part': 'BK-18650-PC8', 'downloadId': 1439,
        'sha': 'dc6b4071d9c72596b681e996058252a077ca6fe7ca437b39a936020d43664d93',
        'bodyDimensions': [77.98, 78.84, 21.54],
        'wiredProductId': 21007231,
        'wiredSlug': 'Four_18650_In_Series_Battery_Holder_with_Wire_Lead.html',
    },
}


def encoded(raw):
    return base64.b64encode(zlib.compress(raw, 9)).decode('ascii')


def bounds(shape):
    b = shape.BoundBox
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]


def dimensions(shape):
    b = shape.BoundBox
    return [b.XLength, b.YLength, b.ZLength]


def check_solid(shape):
    assert not shape.isNull() and shape.isValid() and shape.isClosed()
    assert len(shape.Solids) == 1 and shape.Volume > 0


def signed_mesh_volume(points, triangles):
    return sum(points[a].dot(points[b].cross(points[c])) / 6 for a, b, c in triangles)


def closed_mesh(solid):
    """Require closed native tessellation and independently check packed float32."""
    failures = []
    for angle in [.25, .15, .10, .07, .04]:
        native_mesh = MeshPart.meshFromShape(
            Shape=solid, LinearDeflection=LINEAR_DEFLECTION,
            AngularDeflection=angle, Relative=False,
        )
        points, facets = native_mesh.Topology
        triangles = [tuple(f) for f in facets]
        edges = Counter(tuple(sorted((t[j], t[(j + 1) % 3]))) for t in triangles for j in range(3))
        if not edges or any(count != 2 for count in edges.values()):
            failures.append({'angle': angle, 'nonClosedEdges': sum(n != 2 for n in edges.values())})
            continue
        measured = signed_mesh_volume(points, triangles)
        if measured < 0:
            triangles = [(a, c, b) for a, b, c in triangles]
        packed = struct.pack('<%sf' % (len(points) * 3), *[v for p in points for v in p])
        packed_points = [App.Vector(*v) for v in struct.iter_unpack('<fff', packed)]
        packed_volume = signed_mesh_volume(packed_points, triangles)
        assert packed_volume > 0
        error = abs(packed_volume - solid.Volume)
        assert error <= max(.001, solid.Volume * .005), (packed_volume, solid.Volume)
        for a, b, c in triangles:
            cross = (packed_points[b] - packed_points[a]).cross(packed_points[c] - packed_points[a])
            assert cross.Length > 1e-12, 'Float32 triangle has collapsed'
        index_bytes = struct.pack('<%sI' % (len(triangles) * 3), *[v for t in triangles for v in t])
        return {
            'positions': encoded(packed), 'indices': encoded(index_bytes),
            'vertexCount': len(points), 'triangleCount': len(triangles),
            'meshProof': {
                'closed': True, 'edgeIncidence': 2, 'float32Volume': packed_volume,
                'volumeError': error, 'volumeRelativeError': error / solid.Volume,
                'linearDeflection': LINEAR_DEFLECTION, 'angularDeflection': angle,
                'nativeGeometryModifiedForPreview': False,
            },
        }
    raise AssertionError(('No closed unmodified source tessellation', failures))


def mount_pattern(body, cells):
    found = {}
    for face in body.Faces:
        surface = face.Surface
        if not isinstance(surface, Part.Cylinder):
            continue
        if abs(surface.Radius - 1.6) > 1e-7 or abs(surface.Axis.z) < .999999:
            continue
        x, y = surface.Center.x, surface.Center.y
        key = (round(x, 8), round(y, 8))
        found[key] = {'x': x, 'y': y, 'diameter': 3.2, 'axis': [0, 0, 1], 'source': 'original STEP cylindrical face'}
    result = sorted(found.values(), key=lambda h: (round(h['y'], 8), round(h['x'], 8)))
    assert len(result) == 2 * cells, ('Unexpected mount pattern', cells, result)
    for hole in result:
        probe = Part.makeCylinder(1.599, 22, App.Vector(hole['x'], hole['y'], -.01))
        assert body.common(probe).Volume < 1e-7, ('Blocked original mounting hole', hole)
    return result


def mount_planes(body):
    result = []
    for index, face in enumerate(body.Faces):
        if not isinstance(face.Surface, Part.Plane):
            continue
        b = face.BoundBox
        if b.ZLength < 1e-7 and abs(face.CenterOfMass.z) < 1e-7 and face.normalAt(0, 0).z < -.999999:
            result.append({'faceIndex': index, 'z': 0, 'normal': [0, 0, -1], 'area': face.Area, 'bounds': bounds(face)})
    assert result, 'No original underside mounting plane'
    return result


def bake_component(solid, source_index, is_body, modified):
    check_solid(solid)
    mesh = closed_mesh(solid)
    brep = solid.exportBrepToString().encode('utf-8')
    roundtrip = Part.Shape()
    roundtrip.importBrepFromString(zlib.decompress(base64.b64decode(encoded(brep))).decode('utf-8'))
    check_solid(roundtrip)
    assert abs(roundtrip.Volume - solid.Volume) < 1e-7
    label = 'Moulded tray' if is_body else 'Leaf spring contact'
    if modified:
        label += ' · declared reconstruction'
    return {
        'id': 'body' if is_body else 'contact-source-%d' % (source_index + 1),
        'label': label,
        'sourceSolid': source_index,
        'positions': mesh['positions'], 'indices': mesh['indices'],
        'groups': [[0, mesh['triangleCount'] * 3, 1 if is_body else 0]],
        'brep': encoded(brep), 'brepSha256': hashlib.sha256(brep).hexdigest(),
        'bounds': bounds(solid), 'volume': solid.Volume,
        'vertexCount': mesh['vertexCount'], 'triangleCount': mesh['triangleCount'],
        'meshProof': mesh['meshProof'],
    }


def source_solids(spec, cells):
    path = SOURCES / (spec['part'] + '.STEP')
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    assert sha == spec['sha'], ('Changed manufacturer source', path, sha)
    original = Part.read(str(path))
    assert original.isValid() and len(original.Solids) == 1 + 2 * cells
    result = []
    for index, source in enumerate(original.Solids):
        check_solid(source)
        normalized = source.copy()
        normalized.rotate(App.Vector(), App.Vector(1, 0, 0), 90)
        normalized.translate(App.Vector(0, 0, -3.2))
        check_solid(normalized)
        assert abs(normalized.Volume - source.Volume) < 1e-7
        result.append((index, normalized))
    body_index = max(range(len(result)), key=lambda i: result[i][1].Volume)
    body = result.pop(body_index)
    result.insert(0, body)
    assert all(abs(actual - expected) < 1e-7 for actual, expected in zip(dimensions(body[1]), spec['bodyDimensions']))
    return original, result


def make_asset(spec, cells, original, sources, wired):
    part_id = 'beilamoo-%ds' % cells if wired else 'mpd-' + spec['part'].lower()
    model = 'BeiLaMoo BH18650*%dS-W' % cells if wired else 'MPD ' + spec['part']
    originals = [solid for _, solid in sources]
    solids = [solid.copy() for solid in originals]
    holes = mount_pattern(solids[0], cells)
    original_planes = mount_planes(solids[0])
    entrances = []
    modifications = []
    if wired:
        pin_clip = Part.makeBox(200, 200, 100, App.Vector(-100, -100, 0))
        for index in range(1, len(solids)):
            old = solids[index]
            solids[index] = old.common(pin_clip)
            check_solid(solids[index])
            assert solids[index].Volume < old.Volume
            assert abs(solids[index].BoundBox.ZMin) < 1e-7
        modifications.append('All MPD contact solids clipped to Z >= 0; original PCB pins removed. Remaining leaf contacts are MPD proxies, not verified BeiLaMoo factory contacts.')
        length = spec['bodyDimensions'][0]
        for y in [-(cells - 1) * 9.65, (cells - 1) * 9.65]:
            start = [-length / 2 - 1, y, 7]
            drill = Part.makeCylinder(.9, 5, App.Vector(*start), App.Vector(1, 0, 0))
            removed = solids[0].common(drill).Volume
            assert removed > .001, ('Wire entrance did not reach tray wall', part_id, y)
            solids[0] = solids[0].cut(drill)
            check_solid(solids[0])
            entrances.append({
                'diameter': 1.8, 'center': [-length / 2 + .3, y, 7],
                'axis': [-1, 0, 0], 'wallDrillStart': start, 'wallDrillLength': 5,
                'removedBodyVolume': removed,
                'evidence': 'Authored lead routing assumption; not a dimension from BeiLaMoo factory drawings.',
            })
        modifications.append('Two assumed diameter 1.8 mm negative-X end-wall wire entrances at Z=7 mm and Y=±(cells−1)*9.65 mm; MPD mounting pattern and all source polarity embossing retained unchanged.')
        assert all(abs(a - b) < 1e-7 for a, b in zip(bounds(solids[0]), bounds(originals[0])))
        after_holes = mount_pattern(solids[0], cells)
        assert all(abs(a[k] - b[k]) < 1e-8 for a, b in zip(after_holes, holes) for k in ['x', 'y', 'diameter'])
        after_planes = mount_planes(solids[0])
        plane_key = lambda p: tuple(round(v, 7) for v in p['bounds'])
        before_planes = sorted(original_planes, key=plane_key)
        after_planes = sorted(after_planes, key=plane_key)
        assert len(before_planes) == len(after_planes)
        for before, after in zip(before_planes, after_planes):
            assert abs(before['area'] - after['area']) < 1e-7
            assert all(abs(a - b) < 1e-7 for a, b in zip(before['bounds'], after['bounds']))
        original_planes = after_planes
    combined = Part.makeCompound(solids)
    assert combined.isValid() and combined.isClosed()
    source_url = 'https://www.memoryprotectiondevices.com/3D/download.php?pn=%s&id=%d' % (spec['part'], spec['downloadId'])
    product_url = 'https://www.beilamoo.com/sdp/1074412/4/pd-5180803/%d-2439217/%s' % (spec['wiredProductId'], spec['wiredSlug'])
    return {
        'id': part_id, 'model': model,
        'sourceFile': spec['part'] + '.STEP', 'sourceSha256': spec['sha'],
        'sourceUrl': source_url,
        'sourceProductUrl': 'https://www.batteryholders.com/part.php?pn=' + spec['part'],
        'productSourceUrl': product_url if wired else 'https://www.batteryholders.com/part.php?pn=' + spec['part'],
        'geometryEvidence': 'declared MPD-based reconstruction' if wired else 'original manufacturer STEP',
        'geometryProxy': {'manufacturer': 'MPD', 'part': spec['part'], 'originalFactoryCadForNamedProduct': False} if wired else None,
        'sourceSolidIndexBase': 0,
        'sourceSolids': len(original.Solids), 'outputSolids': len(solids), 'cells': cells,
        'normalization': {'rotation': {'axis': [1, 0, 0], 'degrees': 90}, 'translation': [0, 0, -3.2]},
        'origin': 'Original source outline centered in X/Y; tray underside Z=0. Unmodified MPD pins reach Z=-3.2 mm.',
        'modifications': modifications,
        'factoryGeometryUnmodified': not wired,
        'bodyBounds': bounds(solids[0]), 'bodyDimensions': dimensions(solids[0]),
        'bounds': bounds(combined), 'dimensions': dimensions(combined),
        'volume': combined.Volume,
        'sourceVolume': original.Volume,
        'mountingHoles': holes, 'mountingPlanes': original_planes,
        'wireEntrances': entrances,
        'electricalTopology': 'No series links included in this native asset. MPD cells have separate contact pairs; any series wiring is an explicit authored installation.',
        'brepCompression': 'zlib', 'positionsEncoding': 'zlib base64 little-endian float32 XYZ',
        'indicesEncoding': 'zlib base64 little-endian uint32 triangle indices',
        'linearDeflection': LINEAR_DEFLECTION,
        'components': [bake_component(s, source_index, i == 0, wired) for i, ((source_index, _), s) in enumerate(zip(sources, solids))],
    }


def main():
    requested = set(sys.argv[1:])
    all_ids = {'mpd-' + spec['part'].lower() for spec in SPECS.values()} | {'beilamoo-%ds' % cells for cells in SPECS}
    assert requested <= all_ids, ('Unknown model IDs', sorted(requested - all_ids))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {
        'checkedAt': datetime.now(timezone.utc).isoformat(),
        'freecad': '.'.join(App.Version()[:3]),
        'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'scope': 'Original MPD source solids and declared BeiLaMoo proxy changes; every output leaf is closed and valid, float32 preview is closed, underside planes and mounting holes retained. No electrical, thermal, retention or force rating is established.',
        'models': [],
    }
    for cells, spec in SPECS.items():
        original, solids = source_solids(spec, cells)
        for wired in [False, True]:
            model_id = 'beilamoo-%ds' % cells if wired else 'mpd-' + spec['part'].lower()
            if requested and model_id not in requested:
                continue
            asset = make_asset(spec, cells, original, solids, wired)
            path = OUTPUT / (model_id + '.json')
            path.write_text(json.dumps(asset, separators=(',', ':'), ensure_ascii=False) + '\n')
            summary = {
                'id': model_id, 'sourceSha256': asset['sourceSha256'],
                'assetSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'components': len(asset['components']), 'nativeValidAndClosed': True,
                'previewClosed': all(c['meshProof']['closed'] for c in asset['components']),
                'bodyDimensions': asset['bodyDimensions'], 'bounds': asset['bounds'],
                'volume': asset['volume'], 'mountingHoles': asset['mountingHoles'],
                'mountingPlaneArea': sum(p['area'] for p in asset['mountingPlanes']),
                'wireEntrances': asset['wireEntrances'],
                'triangles': sum(c['triangleCount'] for c in asset['components']),
            }
            report['models'].append(summary)
            print(json.dumps(summary), flush=True)
    proof = ROOT / 'test-results/18650-holder-native-bake.json'
    proof.parent.mkdir(parents=True, exist_ok=True)
    proof.write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
