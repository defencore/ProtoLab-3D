"""Recheck disputed Full stock samples from a saved native actuator document.

This incremental check preserves the prior all-pair collision and FCStd audit.
It never rebuilds Full geometry. It checks the saved shapes and their prior
volume results, then repeats the two disputed shader-stock proofs against the
Simple reference generated from the same case source.

CLI: FreeCAD Python scripts/recheck-sfk-stock.py cases.json [native-report.json]
"""
import ast
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

IDENTITIES = ['output-front-clamp-bolt', 'output-rear-clamp-bolt']


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def saved_features(root):
    for item in root.Group:
        if item.TypeId == 'App::Part':
            yield from saved_features(item)
        elif hasattr(item, 'Shape') and hasattr(item, 'AssemblyOccurrenceId'):
            yield item


def run(cases_path, native_report_path=None):
    started = time.perf_counter()
    cases_path = Path(cases_path).resolve()
    native_report_path = Path(native_report_path).resolve() if native_report_path else cases_path.with_name('native-report.json')
    cases = json.loads(cases_path.read_text())
    case = next(case for case in cases if case['mode'] == 'full')
    baseline_bytes = native_report_path.read_bytes()
    report = json.loads(baseline_bytes)
    row = next(row for row in report['cases'] if row['name'] == case['name'])
    assert row['codeSha256'] == hashlib.sha256(case['script'].encode()).hexdigest(), 'The saved audit and current Full case must have the same generated source.'
    original_failures = row['previewFailures']
    assert len(original_failures) == 2 and {failure[1] for failure in original_failures} == set(IDENTITIES)
    assert all(failure[0] == 'Preview/native volume differs' for failure in original_failures)
    assert not row['intersections'] and row['fcstdRoundtrip'] and row['fcstdColorRoundtrip']
    assert row['fullSTEPCertified'] is False
    native_path = Path(row['exports']['fcstd']).resolve()
    native_sha = digest(native_path)
    checker_path = Path(__file__).with_name('verify-sfk-rotary-actuator.py')
    checker_source = checker_path.read_text()
    names = {'bounds', 'combined_bounds', 'check_shader_thread_difference'}
    definitions = ast.Module(body=[node for node in ast.parse(checker_source).body
                                  if isinstance(node, ast.FunctionDef) and node.name in names], type_ignores=[])
    scope = {'App': App, 'Part': Part, 'math': math, 'json': json}
    exec(compile(definitions, str(checker_path), 'exec'), scope)
    nominal_scope = {'App': App, 'Part': Part, 'math': math}
    exec(case['nominalSource'], nominal_scope)
    nominal_groups = {}
    for shape, metadata in zip(nominal_scope['components'], nominal_scope['component_metadata']):
        nominal_groups.setdefault(metadata['AssemblyOccurrenceId'], []).append(shape)
    doc = App.openDocument(str(native_path))
    try:
        root = next(item for item in doc.RootObjects if getattr(item, 'PartId', None) == 'sfk-rotary-actuator')
        assert json.loads(root.Configuration) == case['parameters']
        features = list(saved_features(root))
        assert len(features) == row['components']
        groups, records = {}, {}
        for item in features:
            shape = item.Shape.copy()
            shape.Placement = item.getGlobalPlacement()
            assert shape.isValid() and shape.isClosed() and shape.Volume > 0
            groups.setdefault(item.AssemblyOccurrenceId, []).append(shape)
            records.setdefault(item.AssemblyOccurrenceId, {
                key: str(getattr(item, key)) for key in ['LibraryId', 'ConfigurationJSON', 'ThreadFeaturesJSON']
                if hasattr(item, key)
            })
        assert len(groups) == row['occurrences']
        assert sum(len(shape.Solids) for shapes in groups.values() for shape in shapes) == row['solids']
        assert sum(len(shape.Faces) for shapes in groups.values() for shape in shapes) == row['faces']
        prior_volumes = {record['id']: record for record in row['previewVolumeErrors']}
        volume_transfer_errors = []
        for expected in case['expected']:
            volume = sum(shape.Volume for shape in groups[expected['id']])
            fraction = abs(volume - expected['volume']) / volume
            error = abs(fraction - prior_volumes[expected['id']]['fraction'])
            assert error < 1e-8, ('Saved geometry differs from the audited occurrence volume', expected['id'], error)
            volume_transfer_errors.append(error)
        results = []
        for identity in IDENTITIES:
            shapes = groups[identity]
            expected = next(record for record in case['expected'] if record['id'] == identity)
            wanted = expected['min'] + expected['max']
            actual_bounds = scope['combined_bounds'](shapes)
            bounds_error = max(abs(a-b) for a, b in zip(actual_bounds, wanted))
            if bounds_error >= 0.08:
                actual_bounds = scope['combined_bounds'](shapes, True)
                bounds_error = max(abs(a-b) for a, b in zip(actual_bounds, wanted))
            assert bounds_error < 0.08, ('Preview/native bounds differ', identity, bounds_error)
            proof = scope['check_shader_thread_difference'](shapes, nominal_groups[identity], records[identity])
            proof['nativeVolume'] = sum(shape.Volume for shape in shapes)
            nominal_error = abs(proof['nominalNativeVolume'] - expected['volume']) / proof['nominalNativeVolume']
            assert nominal_error < 0.025, ('Nominal thread envelope differs from the preview', identity, nominal_error)
            proof['nominalPreviewFraction'] = nominal_error
            assert proof['solidClassifierMaterialConfirmations'], 'The disputed classifier result must receive independent material evidence.'
            results.append({'id': identity, 'previewBoundsErrorMm': bounds_error, 'shaderThreadProof': proof})
        assert digest(native_path) == native_sha, 'The source FCStd changed during incremental verification.'
        verification = {
            'checkedAt': datetime.now(timezone.utc).isoformat(),
            'freecad': '.'.join(App.Version()[:3]), 'passed': True,
            'method': 'Saved native geometry plus unchanged Simple reference; disputed point classifications receive independent local material-volume probes.',
            'nativeFile': str(native_path), 'nativeFileSha256': native_sha,
            'casesFileSha256': digest(cases_path), 'caseCodeSha256': row['codeSha256'],
            'baselineReportSha256': hashlib.sha256(baseline_bytes).hexdigest(),
            'checkerSourceSha256': digest(checker_path), 'recheckSourceSha256': digest(__file__),
            'priorChecksPreserved': ['All-pair physical collisions', 'Native solid validity', 'FCStd reopen', 'FCStd colors'],
            'geometryTransfer': {'validSavedComponents': len(features), 'occurrences': len(groups),
                                 'solids': row['solids'], 'faces': row['faces'],
                                 'maxPriorVolumeFractionDifference': max(volume_transfer_errors)},
            'originalPreviewFailures': original_failures, 'results': results,
            'fullSTEPCertified': False, 'elapsedSeconds': time.perf_counter() - started,
        }
        proof_path = cases_path.with_name('full-stock-recheck.json')
        proof_path.write_text(json.dumps(verification, indent=2))
        backup = native_report_path.with_name('native-report.before-stock-recheck.json')
        assert not backup.exists(), 'Preserve the previous incremental baseline instead of overwriting it.'
        backup.write_bytes(baseline_bytes)
        for result in results:
            prior_volumes[result['id']]['shaderThreadProof'] = result['shaderThreadProof']
        row['previewFailures'] = []
        row.pop('error', None)
        row['passed'] = True
        row['incrementalStockVerification'] = {'path': str(proof_path), 'sourceNativeFileSha256': native_sha,
                                              'checkerSourceSha256': verification['checkerSourceSha256'],
                                              'supersededPreviewFailures': original_failures}
        report['incrementalVerifications'] = [verification]
        report['passed'] = sum(case['passed'] for case in report['cases'])
        report['failed'] = sum(not case['passed'] for case in report['cases'])
        native_report_path.write_text(json.dumps(report, indent=2))
        print(json.dumps({'passed': True, 'checkedOccurrences': IDENTITIES, 'nativePassed': report['passed'],
                          'nativeFailed': report['failed'], 'report': str(proof_path)}), flush=True)
        return verification
    finally:
        App.closeDocument(doc.Name)


if __name__ == '__main__':
    run(*sys.argv[1:3])
