"""Verify actual native assembly geometry and export its neutral and end poses.

Prepare: node --import tsx scripts/verify-sfk-rotary-actuator.ts [--full]
Run using a FreeCAD-enabled Python, or from a dedicated FreeCAD GUI macro:
    exec(compile(open('scripts/verify-sfk-rotary-actuator.py').read(), 'actuator-audit', 'exec'))

Arguments/environment: cases.json [report.json], or PROTOLAB_ACTUATOR_CASES.
GUI execution also preserves the generated per-component display materials in FCStd.

The generated --full case receives native geometry, mating and FCStd checks.
STEP certification is limited to Simple geometry because the detailed supplier
geometry has a known strict volume-roundtrip issue. Full STEP is not generated
or certified here. Diagnose existing files with diagnose-sfk-step.py; the separate
full-step-diagnostic.json and full-step-mesh-diagnostic.json record that export
investigation. No geometric check or Simple STEP threshold is relaxed.
"""
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

# The documented console invocation executes this file from the repository root.
sys.path.append(str(Path.cwd() / 'scripts'))
from freecad_tree import component_leaves

default_cases = Path.cwd() / 'test-results/sfk-rotary-actuator/closed-fork/cases.json'
json_arguments = [value for value in sys.argv[1:] if value.endswith('.json')]
input_path = Path(os.environ.get('PROTOLAB_ACTUATOR_CASES', json_arguments[0] if json_arguments else default_cases))
output = Path(json_arguments[1]) if len(json_arguments) > 1 else input_path.with_name('native-report.json')
directory = output.parent
directory.mkdir(parents=True, exist_ok=True)
cases = json.loads(input_path.read_text())
started = time.perf_counter()
report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'freecad': '.'.join(App.Version()[:3]), 'gui': bool(App.GuiUp),
    'supplierInternalsPolicy': 'Intersections within the same purchased occurrence are excluded; all different physical occurrences are checked.',
    'fullSTEPCertified': False,
    'stepExportPolicy': 'Only Simple STEP is exported and certified; Full geometry receives native FCStd checks.',
    'cases': [],
}
proof_path = input_path.parent / 'thread-mating.json'
if not proof_path.exists():
    proof_path = None
thread_proof = json.loads(proof_path.read_text()) if proof_path else None
verified_thread_pairs = {}
shader_proof_cache = {}
if thread_proof:
    assert thread_proof['positiveControls'] and all(row['overlapMm3'] > 0.001 for row in thread_proof['positiveControls']), 'Thread audit requires true-overlap positive controls.'
    verified_thread_pairs = {frozenset(row['occurrenceIds']): min(0.001, row['overlapBudgetMm3']) for row in thread_proof['matedPairs']}
    report['helicalThreadProof'] = {'path': str(proof_path), 'sourceSha256': thread_proof['sourceSha256'],
                                    'runtimeSha256': thread_proof['runtimeSha256'], 'testedPairs': len(verified_thread_pairs),
                                    'positiveControls': thread_proof['positiveControls']}


def bounds(shape, tessellated=False):
    if tessellated:
        shape.tessellate(0.005)
    box = shape.optimalBoundingBox(tessellated, False)
    return [box.XMin, box.YMin, box.ZMin, box.XMax, box.YMax, box.ZMax]


def combined_bounds(shapes, tessellated=False):
    values = [bounds(shape, tessellated) for shape in shapes]
    return [min(value[i] for value in values) for i in range(3)] + [max(value[i] for value in values) for i in range(3, 6)]


def overlap_volume(first, second):
    a, b = first.BoundBox, second.BoundBox
    if min(a.XMax, b.XMax) - max(a.XMin, b.XMin) < 1e-7 or min(a.YMax, b.YMax) - max(a.YMin, b.YMin) < 1e-7 or min(a.ZMax, b.ZMax) - max(a.ZMin, b.ZMin) < 1e-7:
        return 0.0
    common = first.common(second)
    return 0.0 if common.isNull() else common.Volume


def positive_stock_proxies(case, groups):
    """Load conservative stock bounds authored from the base's positive recipe.

    Subtraction cannot add material; each supported outer stock primitive lies
    inside its authored AABB. Missing proxies keep the existing whole-shape test.
    This function checks consistency, while the generator proves completeness
    by refusing an unsupported recipe instead of inventing proxy geometry.
    """
    expected = next((item for item in case['expected'] if item['id'] == 'base'), None)
    values = expected.get('positiveStockBounds') if expected else None
    if values is None:
        return None, {'enabled': False, 'skippedPairs': 0}
    assert values and all(len(value) == 6 and all(math.isfinite(number) for number in value) and
                          all(value[axis] <= value[axis+3] for axis in range(3)) for value in values), 'Invalid authored positive-stock bounds.'
    envelope = [min(value[axis] for value in values) for axis in range(3)] + [max(value[axis] for value in values) for axis in range(3, 6)]
    native_bounds = combined_bounds(groups['base'])
    if not all(envelope[axis] - 1e-6 <= native_bounds[axis] and native_bounds[axis+3] <= envelope[axis+3] + 1e-6
               for axis in range(3)):
        # Trimmed helical faces may have loose analytic bounds. Use the same
        # native trimmed-face bounds procedure as the preview audit above.
        native_bounds = combined_bounds(groups['base'], True)
    assert all(envelope[axis] - 1e-6 <= native_bounds[axis] and native_bounds[axis+3] <= envelope[axis+3] + 1e-6
               for axis in range(3)), ('Authored stock bounds must enclose the native base', envelope, native_bounds)
    return values, {
        'enabled': True, 'occurrenceId': 'base', 'positivePrimitiveBounds': values,
        'proxyDataSha256': hashlib.sha256(json.dumps(values, separators=(',', ':')).encode()).hexdigest(),
        'generatedMacroSha256': hashlib.sha256(case['script'].encode()).hexdigest(),
        'nativeBaseBounds': native_bounds, 'paddingMm': 1e-6, 'skippedPairs': 0,
        'method': 'Actual base material is a subset of the supported positive recipe primitives; subtraction adds no material. A candidate missing every expanded positive-stock AABB cannot intersect the base.',
    }


def misses_positive_stock(shape, proxies):
    box = shape.BoundBox
    low, high = [box.XMin, box.YMin, box.ZMin], [box.XMax, box.YMax, box.ZMax]
    return not any(all(high[axis] >= value[axis] - 1e-6 and low[axis] <= value[axis+3] + 1e-6
                       for axis in range(3)) for value in proxies)


def mating_thread_features(first, second, first_record, second_record):
    """Identify an actual engaged coaxial male/female thread, not a general contact."""
    def placed(shape, record):
        result = []
        for feature in json.loads(record.get('ThreadFeaturesJSON', '[]')):
            if feature['representation'] != 'machined-helix':
                continue
            feature = dict(feature)
            feature['axis'] = App.Vector(*feature['axis']) if feature.get('axis') is not None else shape.Placement.Rotation.multVec(App.Vector(0, 0, 1))
            feature['origin'] = App.Vector(*feature['origin']) if feature.get('origin') is not None else shape.Placement.Base
            result.append(feature)
        return result
    for a in placed(first, first_record):
        for b in placed(second, second_record):
            if a['internal'] == b['internal'] or abs(a['nominalDiameter'] - b['nominalDiameter']) > 1e-7 or abs(a['pitch'] - b['pitch']) > 1e-7:
                continue
            if ('LH' in a['designation']) != ('LH' in b['designation']):
                continue
            if abs(abs(a['axis'].dot(b['axis'])) - 1) > 1e-7:
                continue
            delta = b['origin'] - a['origin']
            if delta.cross(a['axis']).Length > 1e-6:
                continue
            start = delta.dot(a['axis'])
            finish = start + b['length'] * b['axis'].dot(a['axis'])
            if min(a['length'], max(start, finish)) - max(0, min(start, finish)) > 1e-5:
                return {'diameter': a['nominalDiameter'], 'pitch': a['pitch'], 'engagedCoaxialFlanks': True}
    return None


def authored_thread_allowances(record, features):
    """Read configured fit allowances, retaining the actual recipe callout order."""
    parameters = json.loads(record['ConfigurationJSON'])
    if record['LibraryId'] != 'manufactured-detail':
        return [parameters.get('threadAllowance', 0) if feature['internal'] else 0 for feature in features]
    recipe = json.loads(parameters['recipe'])
    cylinders = []

    def walk(shape):
        if shape['kind'] == 'cylinder' and shape.get('thread') and shape['thread'].get('callout') is not False:
            cylinders.append(shape)
        elif shape['kind'] == 'transform':
            walk(shape['child'])
        elif 'children' in shape:
            for child in shape['children']:
                walk(child)

    walk(recipe)
    assert len(cylinders) == len(features), 'Thread material proof must match the authored recipe callouts.'
    allowances = []
    for cylinder, feature in zip(cylinders, features):
        thread = cylinder['thread']
        assert bool(thread.get('internal')) == feature['internal']
        assert abs(2*cylinder['radius']-feature['nominalDiameter']) < 1e-7
        assert abs(cylinder['height']-feature['length']) < 1e-7 and abs(thread['pitch']-feature['pitch']) < 1e-7
        value = thread.get('radialClearance', 0) if feature['internal'] else 0
        assert math.isfinite(value) and value >= 0
        allowances.append(value)
    return allowances


def check_shader_thread_difference(actual, nominal, record):
    """Check the known shader/native contract with a bounded analytic material budget.

    Do not subtract almost identical threaded solids: OpenCascade can spend an
    unbounded time resolving coincident faces. Native validity, real mating and
    assembly collisions are checked independently of this display comparison.
    """
    assert len(actual) == len(nominal) == 1, 'Expected one standard threaded fastener solid.'
    shape = actual[0]
    reference = nominal[0].copy()
    # Thread mating may rotate the male socket/head about its own shaft axis.
    # Align the nominal reference's same local construction frame before comparing.
    reference.Placement = shape.Placement
    features = json.loads(record['ThreadFeaturesJSON'])
    allowances = authored_thread_allowances(record, features)
    bands = []
    budget = 0.0
    for feature, allowance in zip(features, allowances):
        radius = feature['nominalDiameter'] / 2
        depth = feature['pitch'] * math.sqrt(3) * (5/16 if feature['internal'] else 17/48)
        axis = App.Vector(*feature['axis']) if feature.get('axis') is not None else shape.Placement.Rotation.multVec(App.Vector(0, 0, 1))
        origin = App.Vector(*feature['origin']) if feature.get('origin') is not None else shape.Placement.Base
        inner, outer = radius + allowance - depth - 0.01, radius + allowance + 0.01
        length = feature['length']
        bands.append({'origin': origin, 'axis': axis, 'inner': inner, 'outer': outer, 'length': length})
        budget += math.pi * (outer * outer - inner * inner) * (length + 0.02)
    assert bands, 'A shader-volume difference requires explicit native thread callouts.'
    tolerance = max(1e-5, shape.Volume * 1e-7)
    change = shape.Volume - reference.Volume
    assert abs(change) <= budget + tolerance, ('Native thread volume exceeds its analytic flank-band budget', change, budget)
    if all(feature['internal'] for feature in features):
        assert change >= -tolerance, 'A female thread must add crest stock inside its configured nominal bore.'
    if all(not feature['internal'] for feature in features):
        assert change <= tolerance, 'A male thread must remove grooves from its nominal cylinder.'

    def in_band(point):
        for band in bands:
            delta = point - band['origin']
            axial = delta.dot(band['axis'])
            radial = (delta - band['axis'] * axial).Length
            if -0.02 <= axial <= band['length'] + 0.02 and band['inner'] - 0.01 <= radial <= band['outer'] + 0.01:
                return True
        return False

    box = reference.BoundBox
    samples = [App.Vector(box.XMin+box.XLength*x, box.YMin+box.YLength*y, box.ZMin+box.ZLength*z)
               for x in [0.13,0.31,0.5,0.69,0.87]
               for y in [0.13,0.31,0.5,0.69,0.87]
               for z in [0.13,0.31,0.5,0.69,0.87]]
    for band in bands:
        seed = App.Vector(1,0,0) if abs(band['axis'].x) < 0.9 else App.Vector(0,1,0)
        radial = band['axis'].cross(seed)
        radial.normalize()
        for fraction in [0.2,0.5,0.8]:
            for radius in [max(0,band['inner']-0.03),band['outer']+0.03]:
                for angle in [0,90,180,270]:
                    direction = App.Rotation(band['axis'],angle).multVec(radial)
                    samples.append(band['origin'] + band['axis']*(band['length']*fraction) + direction*radius)
    checked = 0
    classifier_confirmations = []
    for point in samples:
        if in_band(point):
            continue
        actual_inside = shape.isInside(point,1e-7,False)
        nominal_inside = reference.isInside(point,1e-7,False)
        if actual_inside != nominal_inside:
            # OpenCascade's solid classifier can disagree with actual material
            # around trimmed helical faces. Confirm the disputed sample using
            # a finite solid wholly clear of both surfaces. This is a material
            # intersection check, not a larger point-classification tolerance.
            vertex = Part.Vertex(point)
            clearance = [Part.makeCompound(candidate.Faces).distToShape(vertex)[0]
                         for candidate in [shape, reference]]
            assert min(clearance) > 1e-5, ('Stock sample is too close to a boundary for an independent material probe', list(point), clearance)
            radius = min(0.005, min(clearance) / 4)
            probe = Part.makeSphere(radius, point)
            volumes = [candidate.common(probe).Volume for candidate in [shape, reference]]
            fractions = [volume / probe.Volume for volume in volumes]
            # Every probe lies strictly away from either surface, so each must
            # be wholly filled or wholly empty. Partial material remains an error.
            assert all(abs(fraction) < 1e-6 or abs(fraction - 1) < 1e-6 for fraction in fractions), (
                'A clear stock probe must be wholly filled or empty', list(point), clearance, fractions)
            assert (fractions[0] > 0.5) == (fractions[1] > 0.5), (
                'Native thread changes probed stock outside the declared flank bands', list(point), fractions)
            classifier_confirmations.append({
                'point': list(point), 'solidClassifierInside': [actual_inside, nominal_inside],
                'boundaryClearanceMm': clearance, 'probeRadiusMm': radius,
                'probeVolumeMm3': probe.Volume, 'materialIntersectionMm3': volumes,
                'materialFractions': fractions,
                'materialInside': fractions[0] > 0.5,
            })
        checked += 1
    assert checked >= 20, 'Insufficient stock samples outside thread bands.'
    return {
        'reason': 'The browser shades the nominal thread cylinder; native Full geometry contains real helical flanks.',
        'method': 'Declared SDK profile contract, analytic flank-band material budget and bounded stock-membership samples; native BRep validity and mating checked separately.',
        'nominalNativeVolume': reference.Volume,
        'nativeThreadMaterialChange': change,
        'analyticThreadBandVolumeBudget': budget,
        'configuredRadialAllowancesMm': allowances,
        'outsideThreadBandSamples': checked,
        'solidClassifierMaterialConfirmations': classifier_confirmations,
    }


def save_report():
    report.update(passed=sum(row['passed'] for row in report['cases']),
                  failed=sum(not row['passed'] for row in report['cases']),
                  elapsedSeconds=time.perf_counter() - started)
    output.write_text(json.dumps(report, indent=2))


for case in cases:
    row = {'name': case['name'], 'mode': case['mode'], 'passed': False,
           'codeSha256': hashlib.sha256(case['script'].encode()).hexdigest()}
    doc = None
    try:
        print(json.dumps({'case': case['name'], 'stage': 'native-build'}), flush=True)
        scope = {'App': App, 'Part': Part, 'math': math}
        exec(case['source'], scope)
        shapes, labels, metadata = scope['components'], scope['component_labels'], scope['component_metadata']
        assert len(shapes) == len(labels) == len(metadata) == len(scope['component_colors'])
        groups = {}
        for shape, label, record in zip(shapes, labels, metadata):
            assert not shape.isNull() and shape.isValid() and shape.isClosed() and shape.Volume > 0, ('Invalid component', label)
            if record['Supply'] == 'manufactured':
                assert len(shape.Solids) == 1, ('Disconnected detail', label)
            groups.setdefault(record['AssemblyOccurrenceId'], []).append(shape)
        row['components'] = len(shapes)
        row['occurrences'] = len(groups)
        row['solids'] = sum(len(shape.Solids) for shape in shapes)
        row['faces'] = sum(len(shape.Faces) for shape in shapes)
        print(json.dumps({'case': case['name'], 'stage': 'native-built', 'components': len(shapes)}), flush=True)
        assert set(groups) == {record['id'] for record in case['expected']}, 'Missing or duplicated assembly occurrences'
        nominal_groups = {}
        if case.get('nominalSource'):
            print(json.dumps({'case': case['name'], 'stage': 'nominal-reference-build'}), flush=True)
            nominal_scope = {'App': App, 'Part': Part, 'math': math}
            exec(case['nominalSource'], nominal_scope)
            for nominal_shape, nominal_record in zip(nominal_scope['components'], nominal_scope['component_metadata']):
                nominal_groups.setdefault(nominal_record['AssemblyOccurrenceId'], []).append(nominal_shape)
            print(json.dumps({'case': case['name'], 'stage': 'nominal-reference-built'}), flush=True)
        row['previewBoundsErrors'], row['previewVolumeErrors'] = [], []
        preview_failures = []
        for expected in case['expected']:
            shapes_for_occurrence = groups[expected['id']]
            actual = combined_bounds(shapes_for_occurrence)
            wanted = expected['min'] + expected['max']
            error = max(abs(a-b) for a,b in zip(actual, wanted))
            if error >= 0.08:
                # Trimmed helical face bounds can extend beyond the actual trim.
                actual = combined_bounds(shapes_for_occurrence, True)
                error = max(abs(a-b) for a,b in zip(actual, wanted))
            row['previewBoundsErrors'].append({'id': expected['id'], 'millimetres': error})
            native_volume = sum(shape.Volume for shape in shapes_for_occurrence)
            volume_error = abs(native_volume - expected['volume']) / native_volume
            volume_record = {'id': expected['id'], 'fraction': volume_error}
            row['previewVolumeErrors'].append(volume_record)
            if error >= 0.08:
                preview_failures.append(('Preview/native bounds differ', expected['id'], error))
            if volume_error >= 0.025:
                try:
                    record = next(record for record in metadata if record['AssemblyOccurrenceId'] == expected['id'])
                    declared = json.loads(record.get('ThreadFeaturesJSON', '[]'))
                    custom_machined_threads = expected['libraryId'] == 'manufactured-detail' and declared and all(
                        feature['representation'] == 'machined-helix' for feature in declared)
                    if case['mode'] != 'full' or not (expected['libraryId'] in ['hex-nut', 'bolt-screw', 'pcb-standoff'] or custom_machined_threads):
                        raise ValueError('No declared shader-only standard thread reference.')
                    nominal = nominal_groups[expected['id']]
                    print(json.dumps({'case': case['name'], 'stage': 'shader-thread-check', 'id': expected['id']}), flush=True)
                    cache_key = (record['LibraryId'], record['ConfigurationJSON'])
                    cached = shader_proof_cache.get(cache_key)
                    if cached and abs(cached['nativeVolume'] - native_volume) < 1e-5 and abs(cached['nominalNativeVolume'] - sum(shape.Volume for shape in nominal)) < 1e-5:
                        proof = dict(cached, cachedEquivalentConfiguration=True)
                    else:
                        proof = check_shader_thread_difference(shapes_for_occurrence, nominal, record)
                        proof['nativeVolume'] = native_volume
                        shader_proof_cache[cache_key] = dict(proof)
                    nominal_error = abs(proof['nominalNativeVolume'] - expected['volume']) / proof['nominalNativeVolume']
                    assert nominal_error < 0.025, ('Nominal thread envelope differs from the preview', nominal_error)
                    volume_record['shaderThreadProof'] = dict(proof, nominalPreviewFraction=nominal_error)
                except Exception as error:
                    preview_failures.append(('Preview/native volume differs', expected['id'], volume_error, str(error)))
        row['previewFailures'] = preview_failures
        print(json.dumps({'case': case['name'], 'stage': 'intersections', 'previewFailures': len(preview_failures)}), flush=True)
        intersections, flank_residuals = [], []
        stock_proxies, stock_proof = positive_stock_proxies(case, groups)
        row['conservativeStockBroadPhase'] = stock_proof
        for i, first in enumerate(shapes):
            for j in range(i+1, len(shapes)):
                if metadata[i]['AssemblyOccurrenceId'] == metadata[j]['AssemblyOccurrenceId']:
                    continue
                if stock_proxies:
                    first_id, second_id = metadata[i]['AssemblyOccurrenceId'], metadata[j]['AssemblyOccurrenceId']
                    candidate = shapes[j] if first_id == 'base' else first if second_id == 'base' else None
                    if candidate is not None and first.BoundBox.intersect(shapes[j].BoundBox) and misses_positive_stock(candidate, stock_proxies):
                        stock_proof['skippedPairs'] += 1
                        continue
                if case['mode'] == 'full' and first.BoundBox.intersect(shapes[j].BoundBox):
                    print(json.dumps({'case': case['name'], 'stage': 'intersection-pair',
                                      'first': metadata[i]['AssemblyOccurrenceId'], 'second': metadata[j]['AssemblyOccurrenceId']}), flush=True)
                volume = overlap_volume(first, shapes[j])
                if volume <= max(1e-6, min(first.Volume, shapes[j].Volume) * 1e-7):
                    continue
                collision = {'first': labels[i], 'second': labels[j],
                             'firstId': metadata[i]['AssemblyOccurrenceId'],
                             'secondId': metadata[j]['AssemblyOccurrenceId'], 'volume': volume}
                budget = verified_thread_pairs.get(frozenset([collision['firstId'], collision['secondId']]), 0)
                mating = mating_thread_features(first, shapes[j], metadata[i], metadata[j]) if case['mode'] == 'full' and budget and volume <= budget else None
                if mating:
                    collision.update(mating, toleranceMm3=budget,
                                     reason='Calibrated helical-flank Boolean residual; general assembly collision tolerance is unchanged.')
                    flank_residuals.append(collision)
                    continue
                intersections.append(collision)
        row['intersections'] = intersections
        row['helicalFlankBooleanResiduals'] = flank_residuals
        print(json.dumps({'case': case['name'], 'stage': 'macro-build', 'intersections': len(intersections)}), flush=True)
        doc = App.newDocument('SFK0825ActuatorAudit')
        sentinel = doc.addObject('App::FeaturePython', 'ExistingAuditObject')
        # The generated macro contains this exact recipe. It was already built
        # and checked above, so reuse those same solids while still executing
        # the complete macro document/object/material/transaction implementation.
        # Assert the recipe's bytes before replacing its sole embedded block.
        source_block = '\n'.join('        ' + line for line in case['source'].splitlines())
        assert case['script'].count(source_block) == 1, 'The macro must contain exactly one unchanged geometry recipe.'
        restored_source = '\n'.join(line[8:] for line in source_block.splitlines())
        source_sha = hashlib.sha256(case['source'].encode()).hexdigest()
        assert hashlib.sha256(restored_source.encode()).hexdigest() == source_sha, 'The embedded macro recipe differs from the checked source.'
        reuse_block = '\n'.join([
            '        shape = _protolab_verified_geometry["shape"].copy()',
            '        components = [component.copy() for component in _protolab_verified_geometry["components"]]',
            '        component_labels = list(_protolab_verified_geometry["component_labels"])',
            '        component_colors = list(_protolab_verified_geometry["component_colors"])',
            '        component_metadata = [dict(record) for record in _protolab_verified_geometry["component_metadata"]]',
            '        component_groups = _protolab_verified_geometry.get("component_groups")',
        ])
        verified_macro = case['script'].replace(source_block, reuse_block)
        row['macroGeometryReuse'] = {'sourceSha256': source_sha, 'matchedRecipeBlocks': 1,
                                     'reusedComponents': len(shapes),
                                     'executedMacroSha256': hashlib.sha256(verified_macro.encode()).hexdigest()}
        exec(verified_macro, {'_protolab_verified_geometry': scope})
        roots = [root for root in doc.RootObjects if root != sentinel]
        assert len(roots) == 1 and doc.getObject(sentinel.Name), 'The macro must preserve existing document objects'
        root = roots[0]
        assert root.PartId == case['id'] and root.ModelState == case['state']
        assert json.loads(root.Configuration) == case['parameters']
        children = component_leaves(root)
        assert len(children) == len(shapes), 'Macro component count differs from raw native recipe'
        assert [child.AssemblyOccurrenceId for child in children] == [record['AssemblyOccurrenceId'] for record in metadata]
        if App.GuiUp:
            for child, rgb in zip(children, scope['component_colors']):
                material = child.ViewObject.ShapeAppearance[0]
                actual = list(material.DiffuseColor)[:3]
                assert max(abs(a-b) for a,b in zip(actual, rgb)) < 1e-5, ('Native display color differs', child.Label)
                assert child.ViewObject.DisplayMode == 'Shaded'
                assert material.Transparency == 0
        if case['export']:
            for child, rgb in zip(children, scope['component_colors']):
                if 'SourceRGB' not in child.PropertiesList:
                    child.addProperty('App::PropertyFloatList', 'SourceRGB', 'Verification', 'Original supplier/assembly RGB for independent GUI serialization checks.')
                child.SourceRGB = list(rgb)
            print(json.dumps({'case': case['name'], 'stage': 'export-roundtrip' if case['mode'] == 'simple' else 'native-fcstd-roundtrip'}), flush=True)
            # The audit sentinel belongs to no delivered mechanism file.
            doc.removeObject(sentinel.Name)
            doc.recompute()
            filename = directory / case['name']
            if case['mode'] == 'simple':
                step = str(filename.with_suffix('.step'))
                Part.export(children, step)
                restored = Part.read(step)
                assert restored.isValid() and restored.isClosed()
                assert len(restored.Solids) == row['solids'], 'STEP changes solid count'
                native_volume = sum(shape.Volume for shape in shapes)
                delta = restored.Volume - native_volume
                row['stepRoundtripMetrics'] = {
                    'nativeVolume': native_volume, 'restoredVolume': restored.Volume,
                    'volumeChange': delta, 'relativeVolumeChange': abs(delta)/native_volume,
                    'allowedAbsoluteVolumeChange': max(0.01, native_volume*1e-5),
                    'nativeSolids': row['solids'], 'restoredSolids': len(restored.Solids),
                }
                assert abs(delta) < max(0.01, native_volume*1e-5), ('STEP changes component volume', row['stepRoundtripMetrics'])
                row['stepRoundtrip'] = True
            else:
                row['stepRoundtrip'] = False
                row['fullSTEPCertified'] = False
            fcstd = str(filename.with_suffix('.FCStd'))
            root.addProperty('App::PropertyAngle', 'OutputAngle', 'Mechanism')
            root.OutputAngle = case['kinematics']['angle']
            root.addProperty('App::PropertyLength', 'NutTravelFromCentre', 'Mechanism')
            root.NutTravelFromCentre = case['kinematics']['displacement']
            root.addProperty('App::PropertyString', 'MotionLaw', 'Mechanism')
            root.MotionLaw = ('nut travel=13*tan(output angle) mm; '
                              'pin radius=13/cos(output angle) mm within closed radial fork slots; fixed drive supports; neutral drive phase=90 degrees; '
                              'right-hand lead=2.5 mm/revolution; output range=-20..+20 degrees')
            # Camera/images are handled by the dedicated event-loop renderer.
            # Inline GUI updates can interrupt a running macro and do not certify images.
            doc.saveAs(fcstd)
            saved_name, labels_before = root.Name, [child.Label for child in children]
            App.closeDocument(doc.Name)
            doc = App.openDocument(fcstd)
            root = doc.getObject(saved_name)
            reopened = component_leaves(root)
            assert [child.Label for child in reopened] == labels_before, 'FCStd changes component identity'
            assert all(child.Shape.isValid() and child.Shape.isClosed() for child in reopened)
            if App.GuiUp:
                serialization_errors = []
                for child, rgb in zip(reopened, scope['component_colors']):
                    material = child.ViewObject.ShapeAppearance[0]
                    actual_rgb = list(material.DiffuseColor)[:3]
                    serialized_rgb = [math.floor(value * 255 + 0.5) / 255 for value in rgb]
                    assert max(abs(a-b) for a,b in zip(actual_rgb, serialized_rgb)) < 1e-5, ('FCStd changes display color beyond 8-bit storage', child.Label, actual_rgb, rgb, serialized_rgb)
                    delta = max(abs(a-b) for a,b in zip(actual_rgb, rgb))
                    assert delta <= 1/255 + 1e-6
                    serialization_errors.append(delta)
                    assert child.ViewObject.DisplayMode == 'Shaded' and material.Transparency == 0
                row['fcstdColorRoundtrip'] = True
                row['fcstdColorStorage'] = {'format': '8-bit RGB', 'maxQuantizationError': max(serialization_errors)}
            row['exports'] = {'fcstd': fcstd, 'colorsInFCStd': bool(App.GuiUp)}
            if case['mode'] == 'simple':
                row['exports']['step'] = step
            row['fcstdRoundtrip'] = True
        assert not intersections, ('Physical assembly intersections', intersections)
        assert not preview_failures, ('Unexplained preview/native geometry differences', preview_failures)
        row['passed'] = True
    except Exception as error:
        row['error'] = str(error)
    finally:
        if doc and doc.Name in App.listDocuments():
            App.closeDocument(doc.Name)
    report['cases'].append(row)
    save_report()
    print(json.dumps({'name': row['name'], 'passed': row['passed'],
                      'intersections': row.get('intersections'), 'error': row.get('error')}), flush=True)

save_report()
print(json.dumps({'passed': report['passed'], 'failed': report['failed'], 'output': str(output)}), flush=True)
if not App.GuiUp:
    sys.exit(bool(report['failed']))
