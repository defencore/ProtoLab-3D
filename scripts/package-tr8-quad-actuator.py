"""Package only the final, source-bound three-disc TR8 quad release.

Default invocation checks readiness without copying or archiving files. Run with
--execute only after the final GUI styling and screenshots have been approved.
"""
import argparse
import hashlib
import io
import json
import shutil
import struct
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'test-results/tr8-quad-actuator'
STUDY = ROOT / 'test-results/tr8-quad-study'
PIN_STUDY = ROOT / 'test-results/tr8-pin-study'
SIGNATURE = '2910431eb6eeb6675af84b0e941b221a9875677d40d835754d1cd2ecb9fcc18d'


class GateError(RuntimeError):
    pass


def demand(condition, message):
    if not condition:
        raise GateError(message)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    demand(path.is_file(), 'Missing required file: ' + str(path))
    return json.loads(path.read_text())


def audit_gate(directory, count):
    path = directory / 'native-report.json'
    proof, cases = read(path), read(directory / 'cases.json')
    demand(proof.get('passed') == count and proof.get('failed') == 0,
           f'Native audit needs {count} passed / 0 failed: {path}')
    demand(len(cases) == count and len(proof.get('cases', [])) == count,
           'Native audit/case count mismatch: ' + str(directory))
    demand(proof.get('casesSha256') == sha(directory / 'cases.json'),
           'Native audit is stale: ' + str(path))
    for case in cases:
        matches = [row for row in proof['cases'] if row['name'] == case['name']]
        demand(len(matches) == 1 and matches[0].get('passed') is True,
               'Unpassed native configuration: ' + case['name'])
        demand(matches[0]['codeSha256'] == hashlib.sha256(case['script'].encode()).hexdigest(),
               'Native script hash mismatch: ' + case['name'])
    return proof, cases


def fcstd_crc(path):
    demand(path.is_file() and zipfile.is_zipfile(path), 'Missing or invalid FCStd: ' + str(path))
    with zipfile.ZipFile(path) as archive:
        demand(archive.testzip() is None, 'FCStd CRC failure: ' + str(path))
        names = archive.namelist()
        demand('Document.xml' in names and 'GuiDocument.xml' in names,
               'Styled FCStd is missing document or GUI state: ' + str(path))
        xml = archive.read('Document.xml')
        for letter in 'ABCD':
            demand(('Angle' + letter + 'Command').encode() in xml,
                   'FCStd is missing an independent saved angle control: ' + letter)
        return {'passed': True, 'members': len(names), 'crcVerified': True,
                'documentAndGuiState': True, 'fourIndependentControls': True}


def style_gate(certificate, path, expected_law):
    demand(isinstance(certificate, dict), 'Missing GUI colour certificate.')
    for key in ['gui', 'savedAndReopened', 'validClosedShapes', 'sourceRGBPreserved', 'colorsCertified']:
        demand(certificate.get(key) is True, 'GUI certificate needs ' + key)
    metadata = certificate.get('rootMetadataPreserved')
    demand(isinstance(metadata, dict) and metadata.get('MotionLaw') == expected_law,
           'GUI certificate must preserve the exact motion law from the current source kinematics.')
    demand(certificate.get('maxColorDifference') == 0,
           'GUI certificate reports a material colour mismatch.')
    demand(certificate.get('maxRGBQuantizationError', 0) == 0,
           'GUI certificate reports an RGB quantization mismatch.')
    demand(Path(certificate.get('file', '')).resolve() == path.resolve(),
           'GUI certificate refers to another FCStd.')
    demand(certificate.get('fileSha256') == sha(path),
           'GUI certificate is stale for the final styled FCStd.')


def image_size(path):
    demand(path.is_file(), 'Missing required preview: ' + str(path))
    data = path.read_bytes()
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return struct.unpack('>II', data[16:24])
    demand(data.startswith(b'\xff\xd8'), 'Invalid preview image: ' + str(path))
    offset = 2
    while offset + 4 < len(data):
        if data[offset] != 255:
            offset += 1
            continue
        while data[offset] == 255:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in [0xD8, 0xD9] or 0xD0 <= marker <= 0xD7:
            continue
        length = int.from_bytes(data[offset:offset + 2], 'big')
        if marker in [0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]:
            height, width = struct.unpack('>HH', data[offset + 3:offset + 7])
            return width, height
        offset += length
    raise GateError('Cannot read preview dimensions: ' + str(path))


def readiness():
    native, cases = audit_gate(SOURCE, 4)
    kinematics = cases[0]['kinematics']
    demand(all(case['kinematics'] == kinematics for case in cases), 'Source kinematics changed between cases.')
    radius, lead = kinematics['crankRadius'], kinematics['screwLead']
    expected_law = (f'Each independent nut travel={radius:g}*tan(output angle) mm; '
                    f'radial pin distance={radius:g}/cos(angle) mm; TR8x8(P2) RH lead{lead:g}, '
                    'pitch2, four starts; four outputs +/-20deg.')
    prototype, prototype_cases = audit_gate(SOURCE / 'channel', 3)
    demand(all(case['mode'] == 'full' for case in prototype_cases),
           'All three prototype checks must use Full native geometry.')
    pin_joints = read(SOURCE / 'channel/pin-joints.json')
    demand(pin_joints.get('passed') is True and
           pin_joints.get('casesSha256') == sha(SOURCE / 'channel/cases.json'),
           'Actual supplier-pin joint certificate is missing or stale.')
    joints = pin_joints.get('joints', [])
    demand(len(joints) == 6 and
           {(row['angle'], row['pin']) for row in joints} ==
           {(angle, pin) for angle in [-20, 0, 20] for pin in ['output-front-cross-pin', 'output-rear-cross-pin']},
           'Pin-joint proof must cover both actual library pins at all three audited angles.')
    for joint in joints:
        demand(all(value <= 1e-6 for value in joint['nominalContactOverlapMm3'].values()) and
               all(value > .01 for value in joint['wrongPhaseOverlapMm3'].values()),
               'Pin-joint nominal fit or wrong-phase positive control failed.')
        demand(len(joint['hubWalls']) == 2 and {row['side'] for row in joint['hubWalls']} == {-1, 1} and
               all(row['escapedMm3'] <= 1e-6 and row['witnessLengthMm'] > 0 for row in joint['hubWalls']),
               'Actual library pin does not engage both prepared hub walls.')
    motion_path = SOURCE / 'quad-full-motion.FCStd'
    motion = read(SOURCE / 'full-motion-report.json')
    for key in ['passed', 'gui', 'sourceRGBPreserved', 'colorsPreserved']:
        demand(motion.get(key) is True, 'Full motion report needs ' + key)
    demand(motion.get('casesSha256') == sha(SOURCE / 'cases.json') and
           motion.get('nativeAuditSha256') == sha(SOURCE / 'native-report.json'),
           'Full motion proof is not bound to the current whole-assembly audit.')
    demand(len(motion.get('poseChecks', [])) >= 3 and len(motion.get('reopenedPoseChecks', [])) >= 3,
           'Full motion needs checked and reopened independent poses.')
    style_gate(motion.get('GUIstyleCertificate'), motion_path, expected_law)
    persistence = read(SOURCE / 'motion-body-persistence.json')
    demand(persistence.get('passed') is True and persistence.get('components') == motion['physicalComponents'] and
           persistence.get('numericTokensVerifiedFinite', 0) > 0 and
           persistence.get('maxRelativeDelta', float('inf')) <= persistence.get('relativeSerializationBound', 0),
           'Native motion-body persistence certificate must pass for every physical body.')
    demand(persistence.get('sourceSha256') == sha(SOURCE / 'quad-full-neutral.FCStd') and
           persistence.get('motionSha256') == sha(motion_path),
           'Native motion-body persistence proof is stale for the styled current FCStd.')
    crc = fcstd_crc(motion_path)
    render = read(SOURCE / 'render-report.json')
    demand(render.get('passed') is True and render.get('gui') is True and
           render.get('colorsCertified') is True and render.get('maxRGBQuantizationError') == 0,
           'Final GUI render report is missing or not colour-certified.')
    rows = [row for row in render.get('files', []) if Path(row.get('file', '')).resolve() == motion_path.resolve()]
    demand(len(rows) == 1 and rows[0].get('passed') is True,
           'Final GUI render report does not include the styled Full motion file.')
    style_gate(rows[0].get('GUIstyleCertificate'), motion_path, expected_law)
    images = [image for image in rows[0].get('images', []) if image.get('view') in ['axonometric', 'isometric']]
    demand(len(images) == 1, 'Require one final native isometric preview.')
    native_image = Path(images[0]['file']).resolve()
    demand(native_image.is_relative_to(SOURCE.resolve()), 'Native preview must come from the current result directory.')
    width, height = image_size(native_image)
    demand(width >= 800 and height >= 600 and images[0].get('nonWhiteCoverage', 0) > .02,
           'Native preview is too small or blank.')
    browser = [SOURCE / 'ProtoLab-quad-X-end.jpg', SOURCE / 'ProtoLab-quad-three-disc-isometric.jpg']
    for image in browser:
        width, height = image_size(image)
        demand(width >= 400 and height >= 300, 'Browser preview is too small: ' + str(image))
        demand(image.stat().st_mtime >= (SOURCE / 'cases.json').stat().st_mtime,
               'Browser preview predates the final source cases: ' + str(image))
    fabrication = read(SOURCE / 'fabrication-report.json')
    for key, value in [('passed', True), ('mainRoundDiscs', 3), ('mainDiscDiameterMm', 82),
                       ('bearingCheeks', 8), ('forkQuantity', 8), ('actualDxfSvgPairs', 12), ('bearingPilots', 16),
                       ('forkShaftPilots', 8), ('nativeMacroSingleClosedSolids', 19), ('mainProfileSignature', SIGNATURE)]:
        demand(fabrication.get(key) == value, 'Fabrication QA mismatch: ' + key)
    demand(fabrication.get('machiningSchedulesPassed') is True and
           fabrication.get('componentListOccurrences') == native['cases'][0]['occurrences'],
           'Fabrication machining schedules or component list are not certified for the final assembly.')
    demand(fabrication['provenance']['manifestSha256'] == sha(SOURCE / 'TR8-quad-laser-manifest.json') and
           fabrication['provenance']['nativeMacroSha256'] == sha(SOURCE / 'TR8-quad-laser-blanks.FCMacro'),
           'Fabrication QA is stale for the delivered manifest or native blank macro.')
    demand(fabrication['provenance']['expectationsSha256'] == sha(SOURCE / 'fabrication-expectations.json'),
           'Fabrication QA expectations have changed since verification.')
    for file in fabrication['filesEqualCurrentPartApi']:
        demand(sha(SOURCE / file['name']) == file['sha256'], 'Fabrication QA is stale: ' + file['name'])
    frame = read(PIN_STUDY / 'production-frame-report.json')
    demand(frame.get('passed') is True and frame.get('productionEquivalentToPassedCandidate') is True and
           frame.get('matchingReceiverSlots') == 32 and frame.get('inheritedIndependentReceiverChecks') == 160,
           'Production frame must match the passed pinwheel/160-receiver candidate.')
    demand(frame['productionFrame']['discDiameter'] == 82 and frame['productionFrame']['radius'] == 23.5,
           'Production frame proof describes another footprint.')
    demand(frame['provenance']['productionMainPlatesSha256'] == sha(STUDY / 'main-plates.json') and
           frame['provenance']['productionCheekCasesSha256'] == sha(PIN_STUDY / 'production-cheek-cases.json') and
           frame['provenance']['candidateFrameCasesSha256'] == sha(PIN_STUDY / 'frame-study-cases.json') and
           frame['provenance']['continuousCandidateReportSha256'] == sha(PIN_STUDY / 'frame-continuous-report.json'),
           'Production frame proof has stale recipe dependencies.')
    swept = read(SOURCE / 'channel/swept-stock.json')
    demand(swept.get('passed') is True and swept.get('radiusMm') == 23.5 and
           swept.get('columnEnvelope', {}).get('columnRadiusMm') == 32.5,
           'Continuous channel/column stock certificate must cover the final R23.5/column32.5 layout.')
    demand(swept.get('casesSha256') == sha(SOURCE / 'channel/cases.json') and
           swept.get('nativeAuditSha256') == sha(SOURCE / 'channel/native-report.json'),
           'Continuous stock certificate is stale for the final Full prototype.')
    demand(not swept.get('unresolvedPairs'), 'Continuous stock certificate has unresolved contacts.')
    process = subprocess.run(['node', '--import', 'tsx', 'scripts/export-tr8-quad-delivery-manifest.ts'],
                             cwd=ROOT, text=True, capture_output=True, check=True)
    api = json.loads(process.stdout)
    demand(api.get('partId') == 'tr8-quad-actuator', 'Wrong part API manifest.')
    demand(len(api['fabricationFiles']) == 31 and
           len({file['name'] for file in api['fabricationFiles']}) == 31,
           'Final pinned version must deliver 31 uniquely named current-API fabrication files.')
    for file in api['fabricationFiles']:
        demand(sha(SOURCE / file['name']) == file['sha256'], 'Delivered fabrication differs from the current API: ' + file['name'])
    for name in ['quad-simple-neutral', 'quad-full-neutral']:
        case = next(case for case in cases if case['name'] == name)
        demand(sha(SOURCE / (name + '.FCMacro')) == hashlib.sha256(case['script'].encode()).hexdigest(),
               'Static macro differs from its audited source: ' + name)
    step = SOURCE / 'quad-simple-neutral.step'
    demand(step.is_file() and step.stat().st_size > 10000, 'Missing Simple STEP export.')
    demand(step.stat().st_mtime >= (SOURCE / 'cases.json').stat().st_mtime,
           'Simple STEP export predates the final source cases.')
    demand(step.read_bytes().startswith(b'ISO-10303-21;') and b'END-ISO-10303-21;' in step.read_bytes()[-100:],
           'Invalid Simple STEP envelope.')
    demand(next(row for row in native['cases'] if row['name'] == 'quad-simple-neutral').get('stepRoundtrip') is True,
           'Simple STEP roundtrip was not certified.')
    stock = read(PIN_STUDY / 'frame-continuous-report.json')
    prior_frame = read(PIN_STUDY / 'frame-study-report.json')
    demand(stock.get('passed') is True and prior_frame.get('passed') is True,
           'Missing current pinned cheek/receiver stock proof.')
    demand(stock['selectedPin']['diameterMm'] == 2 and stock['selectedPin']['lengthMm'] == 10,
           'Pinned stock proof must cover standard 2x10 pins.')
    demand(stock['provenance']['pinnedCasesSha256'] == sha(PIN_STUDY / 'cases.json') and
           stock['provenance']['frameCasesSha256'] == sha(PIN_STUDY / 'frame-study-cases.json') and
           stock['provenance']['priorPin8CasesSha256'] == sha(PIN_STUDY / 'cases-pin8.json') and
           stock['nativeStaticFrameAndReceiverProofSha256'] == sha(PIN_STUDY / 'frame-study-report.json') and
           prior_frame['provenance']['pinnedCasesSha256'] == sha(PIN_STUDY / 'cases-pin8.json'),
           'Pinned stock/receiver proof has stale recipe dependencies.')
    demand(read(SOURCE / 'column-thread-mating.json').get('passed') is True,
           'Current standard-column thread calibration must pass.')
    return dict(native=native, cases=cases, prototype=prototype, motion=motion, render=render,
                fabrication=fabrication, api=api, nativeImage=native_image, browser=browser, fcstdCRC=crc,
                motionLaw=expected_law)


def package(proof, replace=False):
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    target, archive_path = SOURCE / 'delivery', SOURCE / 'TR8-quad-three-disc.zip'
    demand(replace or not target.exists() and not archive_path.exists(),
           'A delivery already exists. Use --replace to preserve it as a dated backup and replace it.')
    staging = SOURCE / ('delivery.build-' + stamp)
    demand(not staging.exists(), 'Staging directory already exists: ' + str(staging))
    staging.mkdir()
    def copy(source, relative):
        demand(source.is_file(), 'Missing package input: ' + str(source))
        destination = staging / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    copy(SOURCE / 'quad-full-motion.FCStd', 'TR8-quad-full-motion.FCStd')
    copy(SOURCE / 'quad-simple-neutral.step', 'TR8-quad-simple.step')
    copy(SOURCE / 'quad-simple-neutral.FCMacro', 'TR8-quad-simple-static.FCMacro')
    copy(SOURCE / 'quad-full-neutral.FCMacro', 'TR8-quad-full-static.FCMacro')
    copy(SOURCE / 'README-UA.md', 'README-UA.md')
    guide = (ROOT / 'src/parts/tr8-quad-actuator/GUIDE.md').read_text().replace('../../../public/references/', 'references/')
    (staging / 'GUIDE.md').write_text(guide)
    for name in ['h-nut-drawing.png', 'tr8-stock.png']:
        copy(ROOT / 'public/references/tr8-h-nut' / name, 'references/tr8-h-nut/' + name)
    for image in proof['browser']:
        copy(image, image.name)
    copy(proof['nativeImage'], 'FreeCAD-quad-isometric.png')
    layout_image = SOURCE / 'inner-bearing-bars-layout.svg'
    if layout_image.is_file():
        drawing = layout_image.read_text()
        end = drawing.index('>') + 1
        drawing = drawing[:end] + '<title>Inner bearing support layout schematic</title><desc>Explanatory assembly diagram only; not a fabrication drawing or a laser-cut profile.</desc>' + drawing[end:]
        destination = staging / 'illustrations/inner-bearing-bars-layout.svg'
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(drawing)
    for file in proof['api']['fabricationFiles']:
        copy(SOURCE / file['name'], 'fabrication/' + file['name'])
    required = ['cases.json', 'native-report.json', 'full-motion-report.json', 'motion-body-persistence.json', 'render-report.json',
                'fabrication-report.json', 'fabrication-expectations.json', 'thread-mating.json',
                'column-thread-mating.json', 'channel/cases.json', 'channel/native-report.json',
                'channel/thread-mating.json', 'channel/swept-stock.json', 'channel/pin-joints.json']
    for name in required:
        copy(SOURCE / name, 'evidence/' + name)
    for name in ['frame-study-report.json', 'frame-study-cases.json', 'frame-continuous-report.json',
                 'production-frame-report.json', 'production-cheek-cases.json', 'cases.json', 'cases-pin8.json']:
        copy(PIN_STUDY / name, 'evidence/frame/' + name)
    copy(STUDY / 'main-plates.json', 'evidence/frame/main-plates.json')
    (staging / 'evidence/current-part-api-manifest.json').write_text(json.dumps(proof['api'], indent=2) + '\n')
    payload = sorted(path for path in staging.rglob('*') if path.is_file())
    manifest = dict(schemaVersion=1, partId='tr8-quad-actuator', builtAt=datetime.now(timezone.utc).isoformat(),
                    overallMm=proof['cases'][0]['dimensions'], mainDiscDiameterMm=82,
                    mainRoundDiscs=3, independentOutputs=4, outputAngleRangeDegrees=[-20, 20],
                    finishedScrewLengthMm=52, outputConnection='Eight standard steel 2x10 press-fit dowels; 3 mm unsplit forks',
                    nativeCasesPassed=4, nativeCasesFailed=0,
                    prototypeCasesPassed=3, prototypeCasesFailed=0,
                    casesSha256=sha(SOURCE / 'cases.json'), prototypeCasesSha256=sha(SOURCE / 'channel/cases.json'),
                    motionLaw=proof['motionLaw'],
                    fullMotionSha256=sha(SOURCE / 'quad-full-motion.FCStd'),
                    fullMotionGUIstyleCertificate=proof['motion']['GUIstyleCertificate'],
                    nativeFCStdCRC=proof['fcstdCRC'], fabricationFiles=len(proof['api']['fabricationFiles']),
                    laserPairs=12, bearingPilots=16, forkQuantity=8, forkShaftPilots=8, profileSignature=SIGNATURE,
                    sourceFiles=proof['api']['sourceFiles'],
                    manifestScope='SHA256 of every payload file; this self-describing manifest is covered by the archive integrity sidecar.',
                    files=[dict(path=str(path.relative_to(staging)), bytes=path.stat().st_size, sha256=sha(path)) for path in payload])
    manifest_path = staging / 'package-manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    for file in manifest['files']:
        demand(sha(staging / file['path']) == file['sha256'], 'Staged checksum mismatch: ' + file['path'])
    temp_archive = SOURCE / ('TR8-quad-three-disc.build-' + stamp + '.zip')
    with zipfile.ZipFile(temp_archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(path for path in staging.rglob('*') if path.is_file()):
            archive.write(path, 'TR8-quad-three-disc/' + str(path.relative_to(staging)))
    with zipfile.ZipFile(temp_archive) as archive:
        demand(archive.testzip() is None, 'Delivery ZIP CRC failure.')
        demand(len(archive.namelist()) == len(manifest['files']) + 1, 'Delivery ZIP member count mismatch.')
        for file in manifest['files']:
            data = archive.read('TR8-quad-three-disc/' + file['path'])
            demand(hashlib.sha256(data).hexdigest() == file['sha256'], 'ZIP payload SHA256 mismatch: ' + file['path'])
            if file['path'].endswith('.FCStd'):
                with zipfile.ZipFile(io.BytesIO(data)) as nested:
                    demand(nested.testzip() is None, 'Nested FCStd CRC failure.')
        demand(hashlib.sha256(archive.read('TR8-quad-three-disc/package-manifest.json')).hexdigest() == sha(manifest_path),
               'ZIP manifest SHA256 mismatch.')
    if target.exists():
        target.rename(SOURCE / ('delivery.previous-' + stamp))
    if archive_path.exists():
        archive_path.rename(SOURCE / ('TR8-quad-three-disc.previous-' + stamp + '.zip'))
    staging.rename(target)
    temp_archive.rename(archive_path)
    integrity = dict(passed=True, archive=str(archive_path), archiveBytes=archive_path.stat().st_size,
                     archiveSha256=sha(archive_path), archiveCRCVerified=True,
                     nativeFCStdCRCVerified=True, payloadSHA256Verified=True,
                     packageManifestSha256=sha(target / 'package-manifest.json'),
                     payloadFiles=len(manifest['files']), zipMembers=len(manifest['files']) + 1,
                     fabricationFiles=manifest['fabricationFiles'])
    (SOURCE / 'delivery-integrity.json').write_text(json.dumps(integrity, indent=2) + '\n')
    (SOURCE / 'TR8-quad-three-disc.zip.sha256').write_text(integrity['archiveSha256'] + '  ' + archive_path.name + '\n')
    return integrity


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='Build the final delivery after all gates pass.')
    parser.add_argument('--replace', action='store_true', help='Keep dated backups of an existing delivery before replacement.')
    args = parser.parse_args()
    try:
        proof = readiness()
        if args.execute:
            print(json.dumps(package(proof, args.replace), indent=2))
        else:
            print(json.dumps(dict(ready=True, executed=False,
                                 fabricationFiles=len(proof['api']['fabricationFiles']),
                                 nativePassed=4, prototypePassed=3, guiAndMotionCertified=True), indent=2))
    except (GateError, FileNotFoundError, subprocess.CalledProcessError, KeyError, ValueError) as error:
        print(json.dumps(dict(ready=False, executed=False, reason=str(error)), indent=2))
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
