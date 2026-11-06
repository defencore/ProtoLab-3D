"""Audit generated TR8 recipes, physical occurrences and native file round trips.

Run with the FreeCAD Python and a generated cases.json. Supplier internals are
checked for validity but their intended contacts within one bought occurrence
are excluded from assembly interference checks. No unrelated collision is waived.
"""
from datetime import datetime, timezone
import argparse
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
from freecad_tree import component_leaves
from tr8_cnc_cross_stock import CncCrossStockGuard as CrossStockGuard


def digest(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def bounds(shape, mesh=False):
    if mesh:
        shape.tessellate(0.005)
    b = shape.optimalBoundingBox(mesh, False)
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]


def group_bounds(shapes, mesh=False):
    boxes = [bounds(shape, mesh) for shape in shapes]
    return [min(box[i] for box in boxes) for i in range(3)] + [max(box[i] for box in boxes) for i in range(3, 6)]


def valid(shape):
    return not shape.isNull() and shape.isValid() and shape.isClosed() and bool(shape.Solids) and shape.Volume > 0


def coarse_overlap(a, b):
    first, second = a.BoundBox, b.BoundBox
    return not any(min(getattr(first, axis+'Max'), getattr(second, axis+'Max')) -
                   max(getattr(first, axis+'Min'), getattr(second, axis+'Min')) <= 1e-7 for axis in 'XYZ')


def overlap(a, b):
    if not coarse_overlap(a,b):
        return 0.0
    common = a.common(b)
    return 0 if common.isNull() else common.Volume


def thread_band_budget(records):
    """Conservative volume bound for declared metric thread cuts/lands only."""
    features = [feature for record in records for feature in json.loads(record.get('ThreadFeaturesJSON', '[]'))]
    budget = 0.0
    for feature in features:
        radius, pitch = feature['nominalDiameter']/2, feature['pitch']
        inner, outer = max(0, radius-pitch), radius+0.15
        budget += math.pi*(outer*outer-inner*inner)*(feature['length']+0.04)
    return features, budget


def run(cases_path, output_path=None, resume_path=None):
    cases_path = Path(cases_path).resolve()
    output_path = Path(output_path).resolve() if output_path else cases_path.with_name('native-report.json')
    directory = output_path.parent
    cases = json.loads(cases_path.read_text())
    started = time.perf_counter()
    proof_path = directory/'thread-mating.json'
    proof = json.loads(proof_path.read_text()) if proof_path.exists() else None
    certified = {}
    if proof:
        assert proof['positiveControls'] and all(item['overlapMm3'] > 0.001 for item in proof['positiveControls'])
        assert proof['runtimeSha256'] == digest(Path(sys.executable).read_bytes()), 'Thread proof used a different native runtime.'
        certified = {frozenset(item['occurrenceIds']): min(0.001, item['overlapBudgetMm3']) for item in proof['matedPairs']}
    cached = {}
    world_pair_cache = {}
    quad_source_cache = {}
    cross_stock_guard = CrossStockGuard(directory)
    if resume_path:
        resume_path = Path(resume_path).resolve()
        prior = json.loads(resume_path.read_text())
        assert prior['casesSha256'] == digest(cases_path.read_bytes()), 'Resume requires exactly the original generated cases.'
        assert prior['freecad'] == '.'.join(App.Version()[:3]), 'Resume requires the same native kernel version.'
        cached = {item['name']: item for item in prior['cases']}
    assert cases and len({case['id'] for case in cases}) == 1, 'Audit one assembly definition at a time.'
    report = {'partId': cases[0]['id'], 'checkedAt': datetime.now(timezone.utc).isoformat(),
              'freecad': '.'.join(App.Version()[:3]), 'gui': bool(App.GuiUp), 'cases': [],
              'casesSha256': digest(cases_path.read_bytes()),
              'supplierInternalsPolicy': 'Exclude contacts only within the same purchased occurrence.',
              'fullSTEPCertified': False,
              'threadProof': str(proof_path) if proof else None}
    if resume_path:
        report['resumedPairAudit'] = {'path': str(resume_path), 'sha256': digest(resume_path.read_bytes()),
                                     'policy': 'Reuse completed pair Booleans only with identical generated macro SHA, case bytes, runtime, component counts and rebuilt preview metrics; fresh proof calibrates only the named helical mates.'}

    def save():
        report.update(passed=sum(row['passed'] for row in report['cases']),
                      failed=sum(not row['passed'] for row in report['cases']), elapsedSeconds=time.perf_counter()-started)
        output_path.write_text(json.dumps(report, indent=2))

    for case in cases:
        row = {'name': case['name'], 'mode': case['mode'], 'passed': False, 'codeSha256': digest(case['script'])}
        prior_row = cached.get(case['name'])
        if prior_row:
            assert prior_row['codeSha256'] == row['codeSha256'], 'Resume macro source changed.'
            if prior_row['passed']:
                report['cases'].append(prior_row)
                save()
                print(json.dumps({'case': case['name'], 'stage': 'reuse-completed-native-case'}), flush=True)
                continue
        doc = None
        try:
            print(json.dumps({'case': case['name'], 'stage': 'native-build'}), flush=True)
            scope = {'App': App, 'Part': Part, 'math': math, '_audit_cnc_source_cache': quad_source_cache}
            source = case['source']
            if '_cnc_cache = {}' in source:
                before = set(quad_source_cache)
                # The assembly's own cache already keys complete native source
                # bytes and copies every shape before placing it. Keep that same
                # cache across audited poses; inputs and generated macros stay intact.
                source = source.replace('_cnc_cache = {}', '_cnc_cache = _audit_cnc_source_cache', 1)
                exec(source, scope)
                row['nativeSourceCache'] = {
                    'newCompleteLocalSources': len(set(quad_source_cache) - before),
                    'retainedCompleteLocalSources': len(before),
                    'policy': 'Reuse only byte-identical complete local source scopes; every placed shape is copied by the generated assembly emitter.'}
            else:
                exec(source, scope)
            shapes, labels, colors, metadata = [scope[key] for key in ['components', 'component_labels', 'component_colors', 'component_metadata']]
            assert len(shapes) == len(labels) == len(colors) == len(metadata)
            groups, group_records = {}, {}
            for shape, label, record in zip(shapes, labels, metadata):
                assert valid(shape), ('Invalid component', label)
                if record['Supply'] == 'manufactured':
                    assert len(shape.Solids) == 1, ('Disconnected manufactured part', label)
                groups.setdefault(record['AssemblyOccurrenceId'], []).append(shape)
                group_records.setdefault(record['AssemblyOccurrenceId'], []).append(record)
            assert set(groups) == {item['id'] for item in case['expected']}
            drives = case.get('driveAxes', [{'screw': 'lead-screw', 'nut': 'lead-nut', 'origin': [0, 0, 10], 'axis': [1, 0, 0]}])
            assert all(len(groups[identity]) == 1 and len(groups[identity][0].Solids) == 1
                       for drive in drives for identity in [drive['screw'], drive['nut']]), 'Each drive element must be one closed solid.'
            drive_ids = {identity for drive in drives for identity in [drive['screw'], drive['nut']]}
            row.update(components=len(shapes), occurrences=len(groups), solids=sum(len(s.Solids) for s in shapes))
            nominal = {}
            if case.get('nominalSource'):
                source = {'App': App, 'Part': Part, 'math': math, '_audit_cnc_source_cache': quad_source_cache}
                nominal_source = case['nominalSource'].replace('_cnc_cache = {}', '_cnc_cache = _audit_cnc_source_cache', 1)
                exec(nominal_source, source)
                for shape, record in zip(source['components'], source['component_metadata']):
                    nominal.setdefault(record['AssemblyOccurrenceId'], []).append(shape)
            preview = []
            for expected in case['expected']:
                identity = expected['id']
                native = groups[identity]
                target = expected['min']+expected['max']
                actual = group_bounds(native)
                error = max(abs(a-b) for a, b in zip(actual, target))
                if error >= 0.08:
                    actual = group_bounds(native, True)
                    error = max(abs(a-b) for a, b in zip(actual, target))
                assert error < 0.08, ('Preview bounds differ', identity, error, actual, target)
                volume = sum(shape.Volume for shape in native)
                volume_error = abs(volume-expected['volume']) / max(volume, 1e-9)
                comparison = 'actual native geometry'
                if volume_error >= 0.025 and case['mode'] == 'full' and identity not in drive_ids:
                    features, budget = thread_band_budget(group_records[identity])
                    reference = sum(shape.Volume for shape in nominal.get(identity, []))
                    assert features and reference > 0, ('Unexplained preview/native volume difference', identity, volume_error)
                    assert abs(volume-reference) <= budget+1e-6, ('Change exceeds declared thread material bands', identity)
                    assert abs(reference-expected['volume']) / reference < 0.025, ('Nominal shader envelope differs', identity)
                    comparison = 'declared nominal thread-shader envelope; native helical material bounded separately'
                else:
                    assert volume_error < 0.025, ('Preview volume differs', identity, volume_error)
                preview.append({'id': identity, 'boundsErrorMm': error, 'volumeErrorFraction': volume_error, 'comparison': comparison})
            row['previewComparisons'] = preview
            # A rigidly mounted, byte-identical local prototype retains its audited
            # internal contacts. A separate continuous certificate may cover only
            # cross-channel pairs; structural frame pairs always remain fresh.
            certified_channels = set()
            prototype = case.get('prototypeAudit')
            if prototype:
                prototype_cases_path = directory / prototype['cases']
                prototype_report_path = directory / prototype['report']
                prototype_cases = json.loads(prototype_cases_path.read_text())
                prototype_report = json.loads(prototype_report_path.read_text())
                assert prototype_report['casesSha256'] == digest(prototype_cases_path.read_bytes())
                assert prototype_report['freecad'] == report['freecad']
                for channel in prototype['channels']:
                    local = next(item for item in prototype_cases if item['mode'] == case['mode'] and
                                 item['name'] == channel['caseName'] and
                                 item['parameters']['outputAngle'] == channel['angle'] and
                                 item['kinematics']['neutralNutX'] == channel['neutralNutX'])
                    proof_row = next(item for item in prototype_report['cases'] if item['name'] == local['name'])
                    assert proof_row['passed'] and proof_row['codeSha256'] == digest(local['script'])
                    assert channel['source'] == local['source'], 'Prototype geometry or metadata changed.'
                    assert json.dumps(channel['source'], ensure_ascii=False) in case['source'], 'Native quad does not instantiate the audited source.'
                    certified_channels.add(channel['id'])
                row['prototypeInternalPairProof'] = {
                    'casesSha256': digest(prototype_cases_path.read_bytes()),
                    'reportSha256': digest(prototype_report_path.read_bytes()),
                    'channels': sorted(certified_channels),
                    'policy': 'Byte-identical local native source, current passed static audit, and proper rigid placement; only same-channel pairs reuse the prototype proof.'}
            shape_hashes = [digest(shape.exportBrepToString()) for shape in shapes]
            if case.get('crossChannelStockProof'):
                print(json.dumps({'case':case['name'],'stage':'continuous-stock-native-containment'}),flush=True)
            stock_channels, stock_proof = cross_stock_guard.check(case, scope, shapes, metadata, shape_hashes)
            if stock_proof:
                row['continuousCrossChannelStockProof'] = stock_proof
            def pair_key(first, second):
                return tuple(sorted(((metadata[first]['AssemblyOccurrenceId'], shape_hashes[first]),
                                     (metadata[second]['AssemblyOccurrenceId'], shape_hashes[second]))))
            row['worldBrepHashes'] = shape_hashes
            intersections, residuals = [], []
            if prior_row and 'intersections' in prior_row:
                assert prior_row.get('error', '').startswith("('Physical occurrences intersect',"), 'Only a completed physical-pair audit may resume.'
                for key in ['components', 'occurrences', 'solids']:
                    assert row[key] == prior_row[key], ('Rebuilt component count changed', key)
                assert len(preview) == len(prior_row['previewComparisons'])
                for rebuilt, old in zip(preview, prior_row['previewComparisons']):
                    assert rebuilt['id'] == old['id'] and rebuilt['comparison'] == old['comparison']
                    assert abs(rebuilt['boundsErrorMm']-old['boundsErrorMm']) < 1e-7
                    assert abs(rebuilt['volumeErrorFraction']-old['volumeErrorFraction']) < 1e-7
                row['rawPairIntersections'] = prior_row['intersections']
                row['pairAuditReuse'] = {'reportSha256': digest(resume_path.read_bytes()), 'macroSha256': row['codeSha256'],
                                         'rebuiltGeometryMetricsMatch': True}
                original_collisions = {frozenset([(item['firstId'], item['first']), (item['secondId'], item['second'])]): item
                                       for item in prior_row['intersections']+prior_row.get('calibratedThreadResiduals', [])}
                for first in range(len(shapes)):
                    for second in range(first+1, len(shapes)):
                        a, b = metadata[first], metadata[second]
                        if a['AssemblyOccurrenceId'] == b['AssemblyOccurrenceId'] and a['Supply'] == 'purchased':
                            continue
                        collision = original_collisions.get(frozenset([(a['AssemblyOccurrenceId'], labels[first]),
                                                                      (b['AssemblyOccurrenceId'], labels[second])]))
                        world_pair_cache[pair_key(first, second)] = (
                            {'volumeMm3': collision['volumeMm3']} if collision else
                            {'upperBoundMm3': max(1e-6, min(shapes[first].Volume, shapes[second].Volume)*1e-7)})
                for collision in prior_row['intersections']:
                    pair = frozenset([collision['firstId'], collision['secondId']])
                    assert pair in certified and collision['volumeMm3'] <= certified[pair], ('Unproven collision cannot be resumed', collision)
                    residuals.append(dict(collision, proof=str(proof_path)))
                residuals.extend(prior_row.get('calibratedThreadResiduals', []))
                print(json.dumps({'case': case['name'], 'stage': 'pair-audit-reuse', 'calibratedResiduals': len(residuals)}), flush=True)
            else:
                print(json.dumps({'case': case['name'], 'stage': 'pair-intersections'}), flush=True)
                reused_pairs, fresh_pairs, prototype_pairs, stock_pairs = 0, 0, 0, 0
                for index, first in enumerate(shapes):
                    for other in range(index+1, len(shapes)):
                        a, b = metadata[index], metadata[other]
                        if a['AssemblyOccurrenceId'] == b['AssemblyOccurrenceId'] and a['Supply'] == 'purchased':
                            continue
                        if a.get('QuadChannel') == b.get('QuadChannel') and a.get('QuadChannel') in certified_channels:
                            prototype_pairs += 1
                            continue
                        if (a.get('QuadChannel') != b.get('QuadChannel') and
                            a.get('QuadChannel') in stock_channels and b.get('QuadChannel') in stock_channels):
                            stock_pairs += 1
                            continue
                        general_tolerance = max(1e-6, min(first.Volume, shapes[other].Volume)*1e-7)
                        cache_key = pair_key(index, other)
                        cached_pair = world_pair_cache.get(cache_key)
                        if cached_pair is not None and ('volumeMm3' in cached_pair or
                                                        cached_pair.get('upperBoundMm3', math.inf) <= general_tolerance):
                            reused_pairs += 1
                            if cached_pair.get('upperBoundMm3', math.inf) <= general_tolerance:
                                continue
                            volume = cached_pair['volumeMm3']
                        else:
                            fresh_pairs += 1
                            if (stock_proof and coarse_overlap(first,shapes[other]) and
                                cross_stock_guard.proves_frame_empty(index,other,shapes,metadata,shape_hashes)):
                                world_pair_cache[cache_key]={'volumeMm3':0.0}
                                if a['AssemblyOccurrenceId'].endswith('lead-screw') or b['AssemblyOccurrenceId'].endswith('lead-screw'):
                                    print(json.dumps({'case':case['name'],'stage':'fresh-envelope-frame-zero',
                                                      'first':a['AssemblyOccurrenceId'],'second':b['AssemblyOccurrenceId']}),flush=True)
                                continue
                            if (case['mode']=='full' and
                                ((a['AssemblyOccurrenceId'].endswith('lead-screw') and not b.get('QuadChannel')) or
                                 (b['AssemblyOccurrenceId'].endswith('lead-screw') and not a.get('QuadChannel'))) and
                                coarse_overlap(first,shapes[other])):
                                print(json.dumps({'case':case['name'],'stage':'fresh-screw-frame-boolean',
                                                  'first':a['AssemblyOccurrenceId'],'second':b['AssemblyOccurrenceId']}),flush=True)
                            elif fresh_pairs%2000==0:
                                print(json.dumps({'case':case['name'],'stage':'pair-progress','freshPairs':fresh_pairs,
                                                  'prototypePairs':prototype_pairs,'crossStockPairs':stock_pairs}),flush=True)
                            volume = overlap(first, shapes[other])
                            world_pair_cache[cache_key] = {'volumeMm3': volume}
                        if volume <= general_tolerance:
                            continue
                        pair = frozenset([a['AssemblyOccurrenceId'], b['AssemblyOccurrenceId']])
                        result = {'first': labels[index], 'second': labels[other], 'firstId': a['AssemblyOccurrenceId'],
                                  'secondId': b['AssemblyOccurrenceId'], 'volumeMm3': volume}
                        if case['mode'] == 'full' and pair in certified and volume <= certified[pair]:
                            result['proof'] = str(proof_path)
                            residuals.append(result)
                        else:
                            intersections.append(result)
                row['worldPairReuse'] = {'exactWorldBrepAndOccurrencePairsReused': reused_pairs,
                                        'certifiedRigidPrototypeInternalPairs': prototype_pairs,
                                        'certifiedContinuousCrossChannelPairs': stock_pairs,
                                        'freshPairBooleans': fresh_pairs,
                                        'policy': 'Only bit-identical serialized world BReps and occurrence identities reuse completed pair results; changed poses are computed afresh.'}
            if stock_proof:
                row['freshEnvelopeFrameBroadPhase']=dict(cross_stock_guard.frame_statistics)
            row['intersections'], row['calibratedThreadResiduals'] = intersections, residuals
            assert not intersections, ('Physical occurrences intersect', intersections)
            if case['mode'] == 'full':
                phase_checks = []
                for drive in drives:
                    screw, nut = groups[drive['screw']][0], groups[drive['nut']][0]
                    wrong = screw.copy()
                    wrong.rotate(App.Vector(*drive['origin']), App.Vector(*drive['axis']), 45)
                    positive = overlap(wrong, nut)
                    assert positive > 0.01, ('The half-period four-start phase control failed', positive)
                    phase_checks.append({'screw': drive['screw'], 'nut': drive['nut'], 'correctPhaseOverlapMm3': overlap(screw, nut),
                                         'wrongPhaseDegrees': 45, 'wrongPhaseOverlapMm3': positive})
                row['fourStartPhase'] = phase_checks[0] if len(phase_checks) == 1 else phase_checks
            doc = App.newDocument('TR8Audit')
            sentinel = doc.addObject('App::FeaturePython', 'ExistingAuditObject')
            block = '\n'.join('        '+line for line in case['source'].splitlines())
            assert case['script'].count(block) == 1
            reuse = '\n'.join([
                '        shape = _checked["shape"].copy()',
                '        components = [item.copy() for item in _checked["components"]]',
                '        component_labels = list(_checked["component_labels"])',
                '        component_colors = list(_checked["component_colors"])',
                '        component_metadata = [dict(item) for item in _checked["component_metadata"]]',
                '        component_groups = _checked.get("component_groups")',
            ])
            exec(case['script'].replace(block, reuse), {'_checked': scope})
            roots = [root for root in doc.RootObjects if root != sentinel]
            assert len(roots) == 1 and doc.getObject(sentinel.Name)
            root = roots[0]
            assert root.PartId == case['id'] and json.loads(root.Configuration) == case['parameters']
            children = component_leaves(root)
            assert len(children) == len(shapes)
            assert [item.AssemblyOccurrenceId for item in children] == [item['AssemblyOccurrenceId'] for item in metadata]
            row['macroGeometrySourceSha256'] = digest(case['source'])
            if case['export']:
                doc.removeObject(sentinel.Name)
                for item, rgb in zip(children, colors):
                    if 'SourceRGB' not in item.PropertiesList:
                        item.addProperty('App::PropertyFloatList', 'SourceRGB', 'Verification')
                    item.SourceRGB = list(rgb)
                root.addProperty('App::PropertyString', 'MotionLaw', 'Mechanism')
                kinematics=case.get('kinematics',{})
                lever=float(kinematics.get('crankRadius',10))
                lead=float(kinematics.get('screwLead',8))
                root.MotionLaw = f'Per channel: nut travel={lever:g}*tan(output angle) mm; pin radius={lever:g}/cos(angle); TR8x8(P2) RH lead{lead:g}, pitch2, four starts; output±20deg.'
                doc.recompute()
                path = directory/(case['name']+'.FCStd')
                root_name, saved_labels = root.Name, [item.Label for item in children]
                if case['mode'] == 'simple':
                    step = path.with_suffix('.step')
                    Part.export(children, str(step))
                    restored = Part.read(str(step))
                    total = sum(shape.Volume for shape in shapes)
                    assert valid(restored) and len(restored.Solids) == row['solids']
                    assert abs(restored.Volume-total) < max(0.01, total*1e-5)
                    row['stepRoundtrip'] = True
                doc.saveAs(str(path))
                App.closeDocument(doc.Name)
                doc = App.openDocument(str(path))
                root = doc.getObject(root_name)
                reopened = component_leaves(root)
                assert [item.Label for item in reopened] == saved_labels
                assert all(valid(item.Shape) for item in reopened)
                assert all(max(abs(a-b) for a, b in zip(item.SourceRGB, color)) < 1e-12 for item, color in zip(reopened, colors))
                row.update(fcstdRoundtrip=True, exports={'fcstd': str(path), **({'step': str(step)} if case['mode'] == 'simple' else {})})
            row['passed'] = True
        except Exception as error:
            row['error'] = str(error)
        finally:
            if doc and doc.Name in App.listDocuments():
                App.closeDocument(doc.Name)
        report['cases'].append(row)
        save()
        print(json.dumps({'case': case['name'], 'passed': row['passed'], 'error': row.get('error')}), flush=True)
    save()
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cases')
    parser.add_argument('report', nargs='?')
    parser.add_argument('--resume')
    args = parser.parse_args()
    result = run(args.cases, args.report, args.resume)
    print(json.dumps({'passed': result['passed'], 'failed': result['failed']}), flush=True)
    sys.exit(bool(result['failed']))
