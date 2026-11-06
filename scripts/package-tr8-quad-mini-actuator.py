"""Check or package the separate D72 TR8 mini static delivery.

The default is a read-only readiness check. Use --execute only after the final
GUI styling and fabrication reports are ready; --replace preserves dated backups.
"""
import argparse
import hashlib
import io
import json
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'test-results/tr8-quad-mini-actuator'
PART = 'tr8-quad-mini-actuator'
PREFIX = 'TR8-quad-mini'
STATIC = ['mini-full-neutral', 'mini-simple-neutral']
NATIVE_CASES = {'mini-simple-neutral', 'mini-full-neutral', 'mini-full-mixed-1'}
SIGNATURE = 'd8d6187e519ddabfd2d88913183fd316401926cf24d8248c27923b694741366f'


class GateError(RuntimeError):
    pass


def demand(condition, message):
    if not condition:
        raise GateError(message)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(name):
    path = SOURCE / name
    demand(path.is_file(), 'Missing required file: ' + name)
    return json.loads(path.read_text())


def audit(directory, count, expected_names=None):
    report, cases = read(directory + 'native-report.json'), read(directory + 'cases.json')
    demand(report.get('passed') == count and report.get('failed') == 0,
           f'{directory or "whole assembly"} native audit needs {count} passed / 0 failed.')
    demand(len(report.get('cases', [])) == count,
           'Native audit case count mismatch: ' + directory)
    demand(report.get('casesSha256') == sha(SOURCE / directory / 'cases.json'),
           'Native audit cases are stale: ' + directory)
    if expected_names is not None:
        demand({row['name'] for row in report['cases']} == expected_names,
               'Native report does not contain the approved exact case set.')
        cases = [case for case in cases if case['name'] in expected_names]
    demand(len(cases) == count, 'Native source case count mismatch: ' + directory)
    for case in cases:
        rows = [row for row in report['cases'] if row['name'] == case['name']]
        demand(len(rows) == 1 and rows[0].get('passed') is True and
               rows[0].get('codeSha256') == hashlib.sha256(case['script'].encode()).hexdigest(),
               'Native configuration is unpassed or stale: ' + case['name'])
    return report, cases


def native_gate():
    report, cases = audit('', 3, NATIVE_CASES)
    scope = read('native-audit-scope.json')
    demand(scope.get('passed') is True and set(scope.get('auditedCases', [])) == NATIVE_CASES and
           scope.get('generatedButNotAudited') == ['mini-full-mixed-2'] and
           scope.get('nativeReportSha256') == sha(SOURCE / 'native-report.json') and
           scope.get('casesSha256') == sha(SOURCE / 'cases.json'),
           'Approved three-case native audit scope is missing or stale.')
    demand(report.get('partId') == PART, 'Whole native report describes another part.')
    demand({case['name'] for case in cases} == NATIVE_CASES, 'Unexpected whole native case set.')
    for case in cases:
        demand(case.get('id') == PART and len(case['dimensions']) == 3 and all(abs(a - b) < .001 for a, b in
               zip(case['dimensions'], [133, 72, 72])), 'Native case has the wrong mini envelope.')
    for name in STATIC:
        case = next(case for case in cases if case['name'] == name)
        demand(sha(SOURCE / (name + '.FCMacro')) == hashlib.sha256(case['script'].encode()).hexdigest(),
               'Static macro differs from audited source: ' + name)
    row = next(row for row in report['cases'] if row['name'] == 'mini-simple-neutral')
    step = SOURCE / 'mini-simple-neutral.step'
    demand(row.get('stepRoundtrip') is True and step.is_file() and step.stat().st_size > 10000,
           'Simple STEP roundtrip/export is missing.')
    data = step.read_bytes()
    demand(data.startswith(b'ISO-10303-21;') and b'END-ISO-10303-21;' in data[-100:],
           'Simple STEP has an invalid envelope.')
    demand(step.stat().st_mtime >= (SOURCE / 'cases.json').stat().st_mtime,
           'Simple STEP predates current source cases.')
    return report, cases


def prototype_gate():
    report, cases = audit('channel/', 3)
    demand(all(case['mode'] == 'full' for case in cases) and
           {case['parameters']['outputAngle'] for case in cases} == {-20, 0, 20},
           'Prototype proof must use all three Full poses.')
    return report, cases


def continuous_gate():
    proof = read('channel/swept-stock.json')
    demand(proof.get('passed') is True and proof.get('independentChannelAngles') is True and
           proof.get('radiusMm') == 20.25 and proof.get('outputAngleIntervalDegrees') == [-20, 20] and
           proof.get('columnEnvelope', {}).get('columnRadiusMm') == 28 and not proof.get('unresolvedPairs'),
           'Continuous proof does not certify the D72 independent four-channel layout.')
    bindings = {'casesSha256': 'channel/cases.json', 'nativeAuditSha256': 'channel/native-report.json',
                'nativeNeutralSha256': 'channel/quad-mini-channel-neutral.FCStd',
                'columnStockSourceSha256': 'channel/column-stock.json'}
    for field, name in bindings.items():
        demand(proof.get(field) == sha(SOURCE / name), 'Continuous proof is stale: ' + field)
    demand(proof.get('scriptSha256') == sha(ROOT / 'scripts/verify-tr8-quad-mini-swept-stock.py'),
           'Continuous proof checker has changed.')
    native = read('native-report.json')
    for row in native.get('cases', []):
        binding = row.get('continuousCrossChannelStockProof', {})
        demand(binding.get('reportSha256') == sha(SOURCE / 'channel/swept-stock.json') and
               binding.get('guardScriptSha256') == sha(ROOT / 'scripts/tr8_cross_stock.py') and
               binding.get('maxNativeEnvelopeEscapeMm3', float('inf')) <= 1e-7 and
               binding.get('recomputedSeparatingBoxPairs', 0) == proof.get('checkedCellPairs') and
               binding.get('freshContainedLocalSources', 0) + binding.get('reusedExactlyHashedContainedSources', 0) == 4,
               'Whole native case lacks the current source-bound continuous proof: ' + row['name'])
    return proof


def pin_gate():
    proof = read('channel/pin-joints.json')
    demand(proof.get('passed') is True and proof.get('casesSha256') == sha(SOURCE / 'channel/cases.json') and
           proof.get('sourceSha256') == sha(SOURCE / 'channel/pin-joint-proof.py'), 'Pin proof is missing or stale.')
    joints = proof.get('joints', [])
    demand(len(joints) == 6 and {(row['angle'], row['pin']) for row in joints} ==
           {(angle, pin) for angle in [-20, 0, 20] for pin in ['output-front-cross-pin', 'output-rear-cross-pin']},
           'Pin proof needs six actual library pin joints.')
    for joint in joints:
        demand(all(v <= 1e-6 for v in joint['nominalContactOverlapMm3'].values()) and
               all(v > .01 for v in joint['wrongPhaseOverlapMm3'].values()) and
               {wall['side'] for wall in joint['hubWalls']} == {-1, 1} and
               all(wall['escapedMm3'] <= 1e-6 and wall['witnessLengthMm'] > 0 for wall in joint['hubWalls']),
               'Pin fit, engagement or wrong-phase control failed.')
    demand(proof.get('runtimeSha256') == read('channel/swept-stock.json').get('runtimeSha256'),
           'Pin and continuous proofs used different native runtimes.')
    return proof


def api_gate():
    process = subprocess.run(['node', '--import', 'tsx', 'scripts/export-tr8-quad-mini-delivery-manifest.ts'],
                             cwd=ROOT, text=True, capture_output=True, check=True)
    api = json.loads(process.stdout)
    files = api.get('fabricationFiles', [])
    demand(api.get('partId') == PART and len(files) == 31 and len({file['name'] for file in files}) == 31,
           'Expected 31 unique current mini fabrication API files.')
    for file in files:
        demand(file['name'].startswith(PREFIX + '-') and Path(file['name']).name == file['name'] and
               sha(SOURCE / file['name']) == file['sha256'], 'Fabrication API mismatch: ' + file['name'])
    return api


def fabrication_gate():
    proof = read('fabrication-report.json')
    expected = dict(passed=True, mainRoundDiscs=3, mainDiscDiameterMm=72, mainStockThicknessMm=3,
                    bearingCheeks=8, cheekStockThicknessMm=3, forkQuantity=8, forkStockThicknessMm=3,
                    actualDxfSvgPairs=12, bearingPilots=16, forkShaftPilots=8, nativeMacroSingleClosedSolids=19,
                    machiningSchedulesPassed=True, mainProfileSignature=SIGNATURE)
    for field, value in expected.items():
        demand(proof.get(field) == value, 'Fabrication QA mismatch: ' + field)
    provenance = proof.get('provenance', {})
    for field, name in [('manifestSha256', PREFIX + '-laser-manifest.json'),
                        ('nativeMacroSha256', PREFIX + '-laser-blanks.FCMacro'),
                        ('expectationsSha256', 'fabrication-expectations.json')]:
        demand(provenance.get(field) == sha(SOURCE / name), 'Fabrication QA is stale: ' + field)
    rows = proof.get('filesEqualCurrentPartApi', [])
    demand(len(rows) == 31, 'Fabrication report must cover all 31 API files.')
    for file in rows:
        demand(sha(SOURCE / file['name']) == file['sha256'],
               'Fabrication certificate is stale: ' + file['name'])
    return proof


def gui_gate():
    render = read('render-report.json')
    demand(render.get('passed') is True and render.get('gui') is True and render.get('colorsCertified') is True,
           'Final native GUI render report must pass with certified source colours.')
    certificates = {}
    for name in STATIC:
        path = SOURCE / (name + '.FCStd')
        demand(path.is_file() and zipfile.is_zipfile(path), 'Missing static FCStd: ' + path.name)
        with zipfile.ZipFile(path) as archive:
            demand(archive.testzip() is None and {'Document.xml', 'GuiDocument.xml'} <= set(archive.namelist()),
                   'Static FCStd is invalid or missing saved GUI state: ' + path.name)
        rows = [row for row in render.get('files', []) if Path(row.get('file', '')).resolve() == path.resolve()]
        demand(len(rows) == 1 and rows[0].get('passed') is True, 'GUI report lacks ' + path.name)
        certificate = rows[0].get('GUIstyleCertificate', {})
        for field in ['gui', 'savedAndReopened', 'validClosedShapes', 'sourceRGBPreserved', 'colorsCertified']:
            demand(certificate.get(field) is True, path.name + ' GUI certificate needs ' + field)
        demand(Path(certificate.get('file', '')).resolve() == path.resolve() and
               certificate.get('fileSha256') == sha(path) and certificate.get('geometryRebuilt') is False and
               certificate.get('maxColorDifference') == 0 and certificate.get('maxRGBQuantizationError') == 0,
               'GUI certificate is stale or changed source geometry/colours: ' + path.name)
        certificates[name] = certificate
    full_row = next(row for row in render['files'] if Path(row['file']).name == 'mini-full-neutral.FCStd')
    preview = next(image for image in full_row['images'] if image['view'] == 'axonometric')
    preview_path = Path(preview['file']).resolve()
    demand(preview_path.is_relative_to(SOURCE.resolve()) and preview_path.is_file() and
           preview.get('width', 0) >= 800 and preview.get('height', 0) >= 600 and
           preview.get('nonWhiteCoverage', 0) > .02,
           'Final native Full preview is missing, too small or blank.')
    return render, certificates, preview_path


def supplementary_gate():
    frame, footprint = read('frame-native-report.json'), read('footprint-abutment-report.json')
    demand(frame.get('passed') is True and frame.get('singleClosedCheeks') == 8 and
           frame.get('singleClosedMainDiscs') == 3 and frame.get('receiverProbeCount') == 160 and
           frame.get('receiverFailures') == 0 and frame.get('frame', {}).get('discDiameter') == 72 and
           frame.get('provenance', {}).get('frameCasesSha256') == sha(SOURCE / 'frame-cases.json'),
           'Current D72 native frame/receiver proof is missing or stale.')
    footprint_cases = read('prototype-five-pose-cases.json')
    neutral = next(case for case in footprint_cases['cases'] if case['angle'] == 0)
    provenance = footprint.get('provenance', {})
    demand(footprint.get('passed') is True and footprint.get('coreParts') == 32 and
           footprint.get('independentAngleIntervalDegrees') == [-20, 20] and
           footprint.get('minimumDiscMarginMm', 0) > 0 and len(footprint.get('abutments', [])) == 4 and
           provenance.get('casesFileSha256') == sha(SOURCE / 'prototype-five-pose-cases.json') and
           provenance.get('neutralSourceSha256') == hashlib.sha256(neutral['source'].encode()).hexdigest() and
           provenance.get('checkerSha256') == sha(SOURCE / 'prove-footprint-abutments.py'),
           'Footprint and bearing abutment proof is unpassed or stale.')
    demand(read('main-plate-laser-report.json').get('passed') is True,
           'Main-disc native laser proof must pass.')
    demand(read('column-thread-mating.json').get('passed') is True, 'Column thread mating must pass.')
    for name in ['README-UA.md']:
        demand((SOURCE / name).is_file(), 'Missing delivery document: ' + name)
    for view in ['library', 'isometric', 'side']:
        demand((SOURCE / ('ProtoLab-mini-' + view + '.jpg')).is_file(), 'Missing mini browser preview: ' + view)
    demand((ROOT / 'src/parts/tr8-quad-mini-actuator/GUIDE.md').is_file(), 'Missing current mini GUIDE.')
    return frame, footprint


def readiness():
    proofs, missing = {}, []
    gates = dict(native=native_gate, prototype=prototype_gate, continuous=continuous_gate, pins=pin_gate,
                 api=api_gate, fabrication=fabrication_gate, gui=gui_gate, supplementary=supplementary_gate)
    for name, gate in gates.items():
        try:
            proofs[name] = gate()
        except (GateError, FileNotFoundError, KeyError, ValueError, subprocess.CalledProcessError) as error:
            missing.append(dict(gate=name, reason=str(error)))
    return proofs, missing


def package(proofs, replace):
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    target, archive_path = SOURCE / 'delivery', SOURCE / (PREFIX + '.zip')
    demand(replace or not target.exists() and not archive_path.exists(),
           'Delivery exists; --replace preserves dated backups before replacing it.')
    staging = SOURCE / ('delivery.build-' + stamp)
    staging.mkdir()
    def copy(source, name):
        destination = staging / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    for name in STATIC:
        suffix = 'full' if name == STATIC[0] else 'simple'
        copy(SOURCE / (name + '.FCStd'), PREFIX + '-' + suffix + '-static.FCStd')
        copy(SOURCE / (name + '.FCMacro'), PREFIX + '-' + suffix + '-static.FCMacro')
    copy(SOURCE / 'mini-simple-neutral.step', PREFIX + '-simple.step')
    copy(SOURCE / 'README-UA.md', 'README-UA.md')
    copy(ROOT / 'src/parts/tr8-quad-mini-actuator/GUIDE.md', 'GUIDE.md')
    copy(proofs['gui'][2], PREFIX + '-FreeCAD-isometric.png')
    for view in ['library', 'isometric', 'side']:
        copy(SOURCE / ('ProtoLab-mini-' + view + '.jpg'), PREFIX + '-ProtoLab-' + view + '.jpg')
    for file in proofs['api']['fabricationFiles']:
        copy(SOURCE / file['name'], 'fabrication/' + file['name'])
    evidence = ['cases.json', 'native-report.json', 'native-audit-scope.json', 'render-report.json', 'fabrication-report.json',
                'fabrication-expectations.json', 'frame-native-report.json', 'frame-cases.json',
                'footprint-abutment-report.json', 'prototype-five-pose-cases.json',
                'main-plate-laser-report.json', 'thread-mating.json',
                'column-thread-mating.json', 'channel/cases.json', 'channel/native-report.json',
                'channel/swept-stock.json', 'channel/column-stock.json', 'channel/pin-joints.json',
                'channel/thread-mating.json']
    for name in evidence:
        copy(SOURCE / name, 'evidence/' + name)
    (staging / 'evidence/current-part-api-manifest.json').write_text(json.dumps(proofs['api'], indent=2) + '\n')
    payload = sorted(path for path in staging.rglob('*') if path.is_file())
    manifest = dict(schemaVersion=1, partId=PART, builtAt=datetime.now(timezone.utc).isoformat(),
                    deliveryMode='Static Full and Simple native documents; interactive controls remain in the library',
                    overallMm=[133, 72, 72], mainDiscDiameterMm=72, sheetThicknessMm=3,
                    mainRoundDiscs=3, independentOutputs=4, outputAngleRangeDegrees=[-20, 20],
                    nativeCasesPassed=3, nativeCasesFailed=0, nativeCasesAudited=sorted(NATIVE_CASES),
                    nativeCasesInputSha256=sha(SOURCE / 'cases.json'), nativeAuditSha256=sha(SOURCE / 'native-report.json'),
                    prototypeCasesPassed=3, prototypeCasesFailed=0,
                    actualPinJointsPassed=6, fabricationFiles=31, sourceFiles=proofs['api']['sourceFiles'],
                    nativeGUIstyleCertificates=proofs['gui'][1],
                    manifestScope='SHA256 of every payload file; archive integrity covers this manifest itself.',
                    files=[dict(path=str(path.relative_to(staging)), bytes=path.stat().st_size, sha256=sha(path)) for path in payload])
    manifest_path = staging / 'package-manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    temp_archive = SOURCE / (PREFIX + '.build-' + stamp + '.zip')
    with zipfile.ZipFile(temp_archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(path for path in staging.rglob('*') if path.is_file()):
            archive.write(path, PREFIX + '/' + str(path.relative_to(staging)))
    with zipfile.ZipFile(temp_archive) as archive:
        demand(archive.testzip() is None, 'Delivery ZIP CRC failure.')
        demand(len(archive.namelist()) == len(manifest['files']) + 1, 'ZIP member count mismatch.')
        for file in manifest['files']:
            data = archive.read(PREFIX + '/' + file['path'])
            demand(sha(staging / file['path']) == file['sha256'] and
                   hashlib.sha256(data).hexdigest() == file['sha256'], 'Payload SHA256 mismatch: ' + file['path'])
            if file['path'].endswith('.FCStd'):
                with zipfile.ZipFile(io.BytesIO(data)) as nested:
                    demand(nested.testzip() is None, 'Nested FCStd CRC failure.')
        demand(hashlib.sha256(archive.read(PREFIX + '/package-manifest.json')).hexdigest() == sha(manifest_path),
               'ZIP manifest SHA256 mismatch.')
    for path in [target, archive_path]:
        if path.exists():
            path.rename(path.with_name(path.stem + '.previous-' + stamp + path.suffix))
    staging.rename(target)
    temp_archive.rename(archive_path)
    integrity = dict(passed=True, archive=str(archive_path), archiveBytes=archive_path.stat().st_size,
                     archiveSha256=sha(archive_path), archiveCRCVerified=True, nativeFCStdCRCVerified=True,
                     payloadSHA256Verified=True, packageManifestSha256=sha(target / 'package-manifest.json'),
                     payloadFiles=len(manifest['files']), zipMembers=len(manifest['files']) + 1, fabricationFiles=31)
    (SOURCE / 'delivery-integrity.json').write_text(json.dumps(integrity, indent=2) + '\n')
    (SOURCE / (PREFIX + '.zip.sha256')).write_text(integrity['archiveSha256'] + '  ' + archive_path.name + '\n')
    return integrity


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='Build after all source, GUI and fabrication gates pass.')
    parser.add_argument('--replace', action='store_true', help='Preserve dated backups of a prior delivery.')
    args = parser.parse_args()
    proofs, missing = readiness()
    if missing:
        print(json.dumps(dict(ready=False, executed=False, missing=missing), indent=2))
        return 2
    if not args.execute:
        print(json.dumps(dict(ready=True, executed=False, nativePassed=3, prototypePassed=3,
                              pinJointsPassed=6, fabricationFiles=31, staticGUIFilesCertified=2), indent=2))
        return 0
    try:
        print(json.dumps(package(proofs, args.replace), indent=2))
        return 0
    except (GateError, FileNotFoundError, ValueError) as error:
        print(json.dumps(dict(ready=False, executed=False, reason=str(error)), indent=2))
        return 2


if __name__ == '__main__':
    sys.exit(main())
