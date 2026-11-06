"""Preserve an unchanged fitted print after explicitly qualifying mesh reuse.

Run with the bundled FreeCAD Python. This does not save or replace native CAD,
or relabel the old source's checks as new validation.
"""
import argparse
import ast
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import struct

import FreeCAD as App
import Mesh


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + '\n')


def triangle_data(path):
    raw = Path(path).read_bytes()
    count = struct.unpack_from('<I', raw, 80)[0]
    assert len(raw) == 84 + count * 50, 'Expected binary STL'
    triangles = []
    for index in range(count):
        values = struct.unpack_from('<12fH', raw, 84 + index * 50)
        vertices = tuple(tuple(values[3 + i * 3:6 + i * 3]) for i in range(3))
        oriented = min(vertices, vertices[1:] + vertices[:1], vertices[2:] + vertices[:2])
        triangles.append((values[:3], oriented, values[-1]))
    return raw, Counter(triangles)


def directed_boundary(triangles):
    edges = Counter()
    for _, vertices, _ in triangles:
        for a, b in zip(vertices, vertices[1:] + vertices[:1]):
            if edges[(b, a)]:
                edges[(b, a)] -= 1
            else:
                edges[(a, b)] += 1
    return +edges


def triangulation_change(baseline, generated):
    old_bytes, old = triangle_data(baseline)
    new_bytes, new = triangle_data(generated)
    old_diff, new_diff = list((old - new).elements()), list((new - old).elements())
    assert len(old_diff) == len(new_diff) == 2, 'Only the observed quad diagonal may differ'
    old_vertices = {p for _, triangle, _ in old_diff for p in triangle}
    new_vertices = {p for _, triangle, _ in new_diff for p in triangle}
    assert old_vertices == new_vertices and len(old_vertices) == 4
    assert directed_boundary(old_diff) == directed_boundary(new_diff)
    a, b, c = [App.Vector(*p) for p in old_diff[0][1]]
    d = App.Vector(*next(p for p in old_vertices if p not in old_diff[0][1]))
    triple = abs((d - a).dot((b - a).cross(c - a)))
    normal = (b - a).cross(c - a)
    planarity = triple / normal.Length
    tetrahedron = triple / 6
    assert planarity < 1e-5 and tetrahedron < 1e-6
    return {
        'exactTriangleSurfaceEquality': False,
        'cause': 'Opposite diagonal on one float32 loft quadrilateral; normals recomputed.',
        'unchangedFacetCount': sum(old.values()) - 2,
        'changedOldFacetCount': 2, 'changedGeneratedFacetCount': 2,
        'sameFourVertexCoordinates': True, 'sameDirectedOuterBoundary': True,
        'float32QuadPlanarityErrorMm': planarity,
        'float32QuadTetrahedronVolumeMm3': tetrahedron,
        'binaryByteDifferenceCount': sum(a != b for a, b in zip(old_bytes, new_bytes)),
        'binaryHeaderEqual': old_bytes[:80] == new_bytes[:80],
        'baselineFacets': old_diff, 'generatedFacets': new_diff,
    }


def mesh_readback(path):
    mesh = Mesh.Mesh(str(path))
    assert mesh.isSolid(), 'Preserved STL must be closed'
    assert mesh.countComponents() == 1, 'Preserved STL must stay one connected mesh'
    bounds = mesh.BoundBox
    assert abs(bounds.ZMin) < 1e-5, 'Preserved STL must touch its declared print bed'
    return {
        'closed': True, 'connectedComponents': 1, 'facets': mesh.CountFacets,
        'dimensionsMm': [bounds.XLength, bounds.YLength, bounds.ZLength],
        'min': [bounds.XMin, bounds.YMin, bounds.ZMin],
        'max': [bounds.XMax, bounds.YMax, bounds.ZMax], 'sha256': digest(path),
    }


def physical_fingerprint(source, records, part_id):
    stage = Path(__file__).with_name('stage-servo-toggle-case-panel.py')
    namespace = {'ast': ast, 'hashlib': hashlib}
    for node in ast.parse(stage.read_text()).body:
        if isinstance(node, ast.FunctionDef) and node.name in ['assembly_blocks', 'fingerprint']:
            exec(compile(ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[])),
                         '<verified-physical-fingerprint>', 'exec'), namespace)
    _, blocks = namespace['assembly_blocks'](source)
    assert len(blocks) == len(records)
    index = next(i for i, row in enumerate(records) if row['id'] == part_id)
    return namespace['fingerprint'](blocks[index]), index + 1, digest(stage)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('current')
parser.add_argument('--baseline', required=True)
parser.add_argument('--input', required=True)
parser.add_argument('--contract', required=True)
parser.add_argument('--archive', required=True)
args = parser.parse_args()
current, baseline = Path(args.current), Path(args.baseline)
input_path, contract_path, archive = Path(args.input), Path(args.contract), Path(args.archive)
part_id = 'case-electronics-hat-adapter'
case = json.loads(input_path.read_text())
old_meta = json.loads((baseline / 'case-panel-components.json').read_text())
new_meta = json.loads((current / 'case-panel-components.json').read_text())
review = json.loads(contract_path.read_text())
assert review['sourceCodeSha256'] == case['codeSha256'] == new_meta['codeSha256']
assert review['baselineSourceCodeSha256'] == old_meta['codeSha256']
assert part_id in review['preservedPrintIds']
assert new_meta['components'] == case['components']
reports = [json.loads((folder / 'native-export-validation.json').read_text())
           for folder in [baseline, current]]
for folder, report, metadata in zip([baseline, current], reports, [old_meta, new_meta]):
    assert report['sourceCodeSha256'] == metadata['codeSha256']
    assert report['fcstdRoundtrip'] and report['stepRoundtrip'] and not report['intersections']
    assert digest(folder / 'servo-toggle-case-panel.FCStd') == report['fcstdSha256']
    assert digest(folder / 'case-panel-source.FCMacro') == metadata['codeSha256']
old_key, old_index, stage_sha = physical_fingerprint(
    (baseline / 'case-panel-source.FCMacro').read_text(), old_meta['components'], part_id)
new_key, new_index, current_stage_sha = physical_fingerprint(case['script'], case['components'], part_id)
assert old_key == new_key and stage_sha == current_stage_sha
old_component, new_component = old_meta['components'][old_index - 1], case['components'][new_index - 1]
for key in ['libraryId', 'parameters', 'state', 'placement', 'supply']:
    assert old_component[key] == new_component[key], ('Changed physical component', key)

proof_path = current / 'native-preserved-mesh-validation.json'
assert not proof_path.exists(), 'Preservation already recorded; verify the existing proof instead'
archive.mkdir(parents=True, exist_ok=True)
generated_stl = current / (part_id + '.stl')
baseline_stl = baseline / (part_id + '.stl')
manifest_path = current / 'print-mesh-validation.json'
manifest_bytes = manifest_path.read_bytes()
rows = json.loads(manifest_bytes)
row_index = next(i for i, row in enumerate(rows) if row['id'] == part_id)
generated_row = rows[row_index]
baseline_rows = json.loads((baseline / 'print-mesh-validation.json').read_text())
baseline_row = next(row for row in baseline_rows if row['id'] == part_id)
assert digest(generated_stl) == generated_row['sha256']
assert digest(baseline_stl) == baseline_row['sha256']
assert generated_row['sourceCodeSha256'] == case['codeSha256']
saved_generated = archive / (part_id + '.generated.stl')
saved_manifest = archive / 'print-mesh-validation.generated.json'
saved_row = archive / (part_id + '.generated-row.json')
assert not saved_generated.exists() and not saved_manifest.exists() and not saved_row.exists()
shutil.copyfile(generated_stl, saved_generated)
saved_manifest.write_bytes(manifest_bytes)
write_json(saved_row, generated_row)
comparison = triangulation_change(baseline_stl, saved_generated)
old_readback, generated_readback = mesh_readback(baseline_stl), mesh_readback(saved_generated)
assert old_readback['facets'] == generated_readback['facets'] == generated_row['facets']
assert old_readback['dimensionsMm'] == generated_readback['dimensionsMm']

documents = []
native_shapes = []
for folder, index in [(baseline, old_index), (current, new_index)]:
    doc = App.openDocument(str(folder / 'servo-toggle-case-panel.FCStd'))
    documents.append(doc)
    objects = [o for o in doc.Objects if getattr(o, 'ComponentIndex', None) == index]
    assert len(objects) == 1
    shape = objects[0].Shape
    assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1
    native_shapes.append(shape)
old_shape, new_shape = native_shapes
old_only, new_only = old_shape.cut(new_shape), new_shape.cut(old_shape)
old_volume = 0 if old_only.isNull() else abs(old_only.Volume)
new_volume = 0 if new_only.isNull() else abs(new_only.Volume)
assert old_volume < 1e-7 and new_volume < 1e-7
assert abs(old_shape.Volume - new_shape.Volume) < 1e-7
old_bounds, new_bounds = old_shape.BoundBox, new_shape.BoundBox
bound_delta = max(abs(getattr(old_bounds, name) - getattr(new_bounds, name))
                  for name in ['XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax'])
assert bound_delta < 1e-9
brep_hashes = []
for label, shape in zip(['baseline', 'current'], native_shapes):
    file = archive / (part_id + '.' + label + '.brep')
    assert not file.exists()
    shape.copy().exportBrep(str(file))
    brep_hashes.append(digest(file))
for doc in reversed(documents):
    App.closeDocument(doc.Name)
for folder, report in zip([baseline, current], reports):
    assert digest(folder / 'servo-toggle-case-panel.FCStd') == report['fcstdSha256']

proof = {
    'passed': True, 'validation': 'Qualified preservation of one unchanged fitted STL',
    'scriptSha256': digest(__file__), 'physicalFingerprintScriptSha256': stage_sha,
    'sourceCodeSha256': case['codeSha256'], 'baselineSourceCodeSha256': old_meta['codeSha256'],
    'currentInputSha256': digest(input_path), 'reviewedChangeContractSha256': digest(contract_path),
    'currentCanonicalSha256': reports[1]['fcstdSha256'],
    'baselineCanonicalSha256': reports[0]['fcstdSha256'],
    'canonicalFilesNotResaved': True,
    'preservedMeshes': [{
        'id': part_id, 'file': generated_stl.name,
        'physicalAstSha256': new_key, 'physicalParametersAndPlacementIdentical': True,
        'nativeSolidEquivalence': {
            'passed': True, 'baselineOnlyVolumeMm3': old_volume,
            'currentOnlyVolumeMm3': new_volume, 'xorVolumeThresholdMm3': 1e-7,
            'baselineVolumeMm3': old_shape.Volume, 'currentVolumeMm3': new_shape.Volume,
            'maximumBoundsDeltaMm': bound_delta,
            'exportedBrepSha256': {'baseline': brep_hashes[0], 'current': brep_hashes[1]},
            'exportedBrepBytesIdentical': brep_hashes[0] == brep_hashes[1],
        },
        'triangulationDifference': comparison,
        'generatedArtifact': {'sha256': generated_row['sha256'], 'archiveFile': str(saved_generated),
                              'manifestArchiveFile': str(saved_manifest), 'rowArchiveFile': str(saved_row)},
        'baselineArtifact': {'sha256': baseline_row['sha256'], 'file': str(baseline_stl)},
        'preservedBaselineNativeReadback': old_readback,
    }],
    'generatedManifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
    'limits': (
        'The executable physical recipe, parameters, placement and native solid equivalence '
        'justify preserving this original printed geometry. The new triangulation chose a '
        'different diagonal on one slightly nonplanar float32 quad; exact STL surface equality '
        'is not claimed. Only this unchanged HAT STL is reused. Current native mesh readback '
        'and this source-bound proof qualify reuse; old source checks are not relabeled. '
        'Native CAD and its export validation are not changed or resaved.'),
}
preserved_row = dict(generated_row)
preserved_row.update({key: old_readback[key] for key in ['closed', 'facets', 'dimensionsMm', 'min', 'max', 'sha256']})
preserved_row['solids'] = 1
preserved_row['preservationRelation'] = 'unchanged-native-geometry-preserved-baseline-stl'
preserved_row['preservationProof'] = proof_path.name
preserved_row['preservedFromSourceCodeSha256'] = old_meta['codeSha256']
preserved_row['generatedStlSha256'] = generated_row['sha256']
rows[row_index] = preserved_row
pending_stl = generated_stl.with_suffix('.preservation-tmp')
pending_manifest = manifest_path.with_suffix('.preservation-tmp')
shutil.copyfile(baseline_stl, pending_stl)
write_json(pending_manifest, rows)
try:
    pending_stl.replace(generated_stl)
    pending_manifest.replace(manifest_path)
    readback = mesh_readback(generated_stl)
    assert readback == old_readback and digest(generated_stl) == baseline_row['sha256']
    proof['preservedManifestSha256'] = digest(manifest_path)
    proof['preservedMeshes'][0]['savedCurrentArtifactSha256'] = digest(generated_stl)
    proof['preservedMeshes'][0]['savedCurrentNativeMeshReadback'] = readback
    assert digest(current / 'servo-toggle-case-panel.FCStd') == reports[1]['fcstdSha256']
    assert digest(baseline / 'servo-toggle-case-panel.FCStd') == reports[0]['fcstdSha256']
    write_json(proof_path, proof)
except BaseException:
    shutil.copyfile(saved_generated, generated_stl)
    manifest_path.write_bytes(manifest_bytes)
    raise
print(json.dumps({'passed': True, 'proof': str(proof_path), 'id': part_id,
                  'currentCanonicalSha256': reports[1]['fcstdSha256'],
                  'preservedStlSha256': baseline_row['sha256'],
                  'nativeXorVolumeMm3': old_volume + new_volume}))
