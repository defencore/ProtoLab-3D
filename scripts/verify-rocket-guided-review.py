"""Source-bound native fit, sampled assembly paths, and native-derived printing screen.

Stage with stage-rocket-guided-review.ts first. Run in FreeCAD's Python runtime.
This is a geometry/assembly audit. It is not a slicer, material test, or load rating.
"""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
import traceback

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import MeshPart

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('folder', nargs='?', default='test-results/rocket-camera-nose-guided-rebuild/current')
parser.add_argument('--checks', default='topology,fit,motion,contacts,printing', help='Comma-separated checks; omitted sections remain unverified.')
parser.add_argument('--motion', help='One motion ID for diagnosis; complete verification requires all required IDs.')
parser.add_argument('--print-part', help='One print ID for diagnosis; complete verification requires every printing-process body.')
args = parser.parse_args()
folder = Path(args.folder).resolve()
checks = set(args.checks.split(','))
started = time.perf_counter()
sha = lambda data: hashlib.sha256(data if isinstance(data, bytes) else data.encode()).hexdigest()
manifest_bytes = (folder / 'review-manifest.json').read_bytes()
manifest = json.loads(manifest_bytes)
assert manifest['schemaVersion'] == 1 and manifest['units'] == 'mm'
spec = manifest['specification']
limits = spec.get('limits', {})
volume_tolerance = float(limits.get('overlapVolume', 0.01))
assert 0 < volume_tolerance <= 0.01
validator_source=Path(__file__).read_bytes()
validator_sha=sha(validator_source)
(folder/'validator-frozen.py').write_bytes(validator_source)
cache = folder / 'native-cache'
cache.mkdir(exist_ok=True)
report = {
    'schemaVersion': 1, 'units': 'mm', 'checkedAt': datetime.now(timezone.utc).isoformat(),
    'partId': manifest['partId'], 'presetId': manifest['presetId'], 'parameters': manifest['parameters'],
    'manifestSHA256': sha(manifest_bytes), 'validatorSHA256': validator_sha,
    'freecad': '.'.join(App.Version()[:3]), 'overlapVolumeTolerance': volume_tolerance,
    'checkedSections': sorted(checks), 'sourceMacros': {}, 'topology': [], 'fit': {}, 'motions': [], 'contacts':[], 'printing': [],
    'unresolvedEvidence':spec.get('unresolvedEvidence',[]), 'engineeringReleaseReady':False,
    'scope':'Geometric review of the declared physical units and explicit cable/tool proxies only; unresolved delivered connector, power wiring, material and flight evidence remains separate.',
    'limitations': [
        'Motion checks evaluate exact native BReps at every reported intermediate translation; they do not claim a mathematically continuous sweep.',
        'Cable proxies do not prove a real flat ribbon can bend/twist that way or survive service.',
        'Printing screen uses horizontal sections of native-derived mesh, without bridge credit; it is not slicer toolpaths or a support-removal/strength test.',
    ],
}

def dump():
    report['elapsedSeconds'] = time.perf_counter() - started
    temporary = folder / 'guided-review-report.tmp'
    temporary.write_text(json.dumps(report, indent=2) + '\n')
    temporary.replace(folder / 'guided-review-report.json')

def metric(shape):
    box = shape.optimalBoundingBox(False, False)
    return {
        'valid': shape.isValid(), 'closed': shape.isClosed(), 'solids': len(shape.Solids),
        'volume': shape.Volume, 'faces': len(shape.Faces), 'edges': len(shape.Edges),
        'min': [box.XMin, box.YMin, box.ZMin], 'max': [box.XMax, box.YMax, box.ZMax],
        'surfaceTypes': dict(Counter(type(face.Surface).__name__ for face in shape.Faces)),
    }

def source_guard():
    assert sha((folder / 'review-manifest.json').read_bytes()) == report['manifestSHA256'], 'Manifest changed during audit.'
    for binding in spec['sourceBindings']['files']:
        assert sha(Path(binding['path']).read_bytes()) == binding['sha256'], 'Source changed during audit: ' + binding['path']
    for state in manifest['records']:
        assert sha((folder / state['macroFile']).read_bytes()) == state['macroSHA256'], 'Frozen macro changed during audit.'

def native_state(state):
    """Execute an unmodified frozen macro, or load its exact hash-guarded topology snapshot."""
    macro = (folder / state['macroFile']).read_bytes()
    assert sha(macro) == state['macroSHA256']
    report['sourceMacros'][state['state']] = state['macroSHA256']
    sources=[json.loads(v) for v in re.findall(r'^\s*component, local_metadata = _pl_component\((.*)\)\s*$',macro.decode(),re.M)]
    assert len(sources)==len(state['components']), 'Native source unit count mismatch.'
    snapshot_dir = cache / state['macroSHA256']
    snapshot_path = snapshot_dir / 'snapshot.json'
    units = state['components']
    shapes = {}
    records = []
    if snapshot_path.exists():
        snapshot = json.loads(snapshot_path.read_text())
        assert snapshot['sourceMacroSHA256'] == state['macroSHA256']
        assert [r['id'] for r in snapshot['records']] == [u['id'] for u in units]
        for unit, record in zip(units, snapshot['records']):
            data = (snapshot_dir / record['file']).read_bytes()
            assert sha(data) == record['brepSHA256']
            shape = Part.Shape()
            shape.importBrepFromString(data.decode())
            actual = metric(shape)
            assert actual['valid'] and actual['closed'] and actual['volume'] > 0 and actual['solids'] > 0
            assert actual['solids'] == record['metrics']['solids'] and actual['faces'] == record['metrics']['faces']
            assert abs(actual['volume'] - record['metrics']['volume']) <= max(1e-6, actual['volume'] * 1e-10)
            assert max(abs(a-b) for a,b in zip(actual['min']+actual['max'], record['metrics']['min']+record['metrics']['max'])) < 1e-6
            shapes[unit['id']] = shape
            records.append(record)
        mode = 'hash-guarded-native-snapshot'
    else:
        document = App.newDocument('GuidedReview_' + state['state'].replace('-', '_'))
        try:
            exec(compile(macro.decode(), state['macroFile'], 'exec'), {})
            features = sorted([o for o in document.Objects if o.isDerivedFrom('Part::Feature') and hasattr(o, 'ComponentIndex')], key=lambda o:o.ComponentIndex)
            assert len(features) == len(units) and len(features) > 0
            snapshot_dir.mkdir(exist_ok=True)
            for index, (unit, feature) in enumerate(zip(units, features)):
                assert feature.LibraryId == unit['libraryId']
                assert json.loads(feature.ConfigurationJSON) == unit['parameters']
                shape = feature.Shape.copy()
                actual = metric(shape)
                assert actual['valid'] and actual['closed'] and actual['volume'] > 0 and actual['solids'] > 0, unit['id']
                if unit['requireSingleSolid']:
                    assert actual['solids'] == 1, (unit['id'], 'Disconnected fabricated part', actual['solids'])
                text = shape.exportBrepToString()
                file = f'{index:03d}-{unit["id"]}.brep'
                (snapshot_dir / file).write_text(text)
                record = {'id': unit['id'], 'libraryId': unit['libraryId'], 'presetId': unit.get('presetId'), 'brepSHA256': sha(text), 'file': file, 'metrics': actual, 'nativeProgramSHA256':sha(sources[index])}
                shapes[unit['id']] = shape
                records.append(record)
            snapshot_path.write_text(json.dumps({'sourceMacroSHA256': state['macroSHA256'], 'records': records}, indent=2) + '\n')
        finally:
            App.closeDocument(document.Name)
        mode = 'fresh-unmodified-native-macro'
    for index,(unit, record) in enumerate(zip(units, records)):
        actual = metric(shapes[unit['id']])
        assert record['nativeProgramSHA256']==sha(sources[index]), 'Native unit source differs from cached source.'
        assert not unit['requireSingleSolid'] or actual['solids'] == 1, unit['id']
        report['topology'].append({'state': state['state'], 'id': unit['id'], 'libraryId': unit['libraryId'], 'presetId': unit.get('presetId'), 'sourceMacroSHA256': state['macroSHA256'], 'brepSHA256': record['brepSHA256'], 'nativeProgramSHA256':record['nativeProgramSHA256'], 'buildMode': mode, **actual})
        if state['state'] == 'assembled':
            placed = folder / 'assembled-breps'
            placed.mkdir(exist_ok=True)
            data = (snapshot_dir / record['file']).read_bytes()
            assert sha(data) == record['brepSHA256']
            (placed / (unit['id'] + '.brep')).write_bytes(data)
    return shapes

def substantial(a, b):
    return all(min(getattr(a, k+'Max'), getattr(b, k+'Max')) - max(getattr(a, k+'Min'), getattr(b, k+'Min')) > 1e-6 for k in ['X','Y','Z'])

def common_volume(a, b):
    if not substantial(a.BoundBox, b.BoundBox):
        return 0
    common = a.common(b)
    value = 0 if common.isNull() else common.Volume
    assert math.isfinite(value) and value >= -volume_tolerance, 'Invalid native overlap volume: ' + str(value)
    return max(0, value)

def fit(shapes):
    ids = list(shapes)
    pairs = 0
    collisions = []
    for i, first in enumerate(ids):
        for second in ids[i+1:]:
            if not substantial(shapes[first].BoundBox, shapes[second].BoundBox):
                continue
            pairs += 1
            volume = common_volume(shapes[first], shapes[second])
            if volume > volume_tolerance:
                collisions.append({'first': first, 'second': second, 'overlapVolume': volume})
    return {'exactCandidatePairChecks': pairs, 'collisions': collisions, 'passed': not collisions,
            'statement': 'Every physical occurrence is checked as one procurement/fabrication unit; no interference exemption list.'}

def poses(waypoints, max_step):
    first = True
    for start, end in zip(waypoints, waypoints[1:]):
        distance = math.dist(start, end)
        assert distance > 0, 'Duplicate motion waypoint.'
        steps = max(1, math.ceil(distance / max_step))
        for i in range(0 if first else 1, steps+1):
            yield [a + (b-a)*i/steps for a,b in zip(start,end)]
        first = False

def proxy_scope():
    # Match the repository native-shape SDK transform convention for generated reserve code.
    def transform(shape, translation, rotation):
        for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):
            if angle: shape.rotate(App.Vector(0,0,0),axis,angle)
        shape.translate(App.Vector(*translation))
        return shape
    return {'App':App,'Part':Part,'math':math,'_pl_transform':transform}


def check_motion(case, shapes):
    moving_ids = case.get('movingIds', [])
    obstacles = list(case['obstacleIds'])
    assert (bool(moving_ids)) != bool(case.get('proxyCode'))
    assert not set(moving_ids).intersection(obstacles)
    removed = case['removedIds']
    stage_ids = moving_ids + obstacles + removed
    assert len(set(stage_ids)) == len(stage_ids), 'Stage groups overlap.'
    assert set(stage_ids) == set(shapes), 'Every physical unit needs an explicit stage disposition.'
    if removed: assert len(case.get('stageReason', '')) > 15
    for id in moving_ids + obstacles:
        assert id in shapes, (case['id'], id)
    shapes=dict(shapes)
    stationary=[]
    for proxy in case.get('extraObstacles',[]):
        assert proxy['id'] not in shapes, 'Proxy ID duplicates a physical unit.'
        scope=proxy_scope();exec(proxy['shapeCode'],scope)
        value=scope['shape'];assert value.isValid() and value.isClosed() and value.Solids and value.Volume>0
        shapes[proxy['id']]=value;obstacles.append(proxy['id']);stationary.append({'id':proxy['id'],'sourceSHA256':sha(proxy['shapeCode'])})
    if moving_ids:
        original = Part.makeCompound([shapes[id] for id in moving_ids])
    else:
        scope = proxy_scope()
        exec(case['proxyCode'], scope)
        original = scope['shape']
        assert original.isValid() and original.isClosed() and original.Solids and original.Volume > 0
    carried=[]
    for proxy in case.get('extraMoving',[]):
        scope=proxy_scope();exec(proxy['shapeCode'],scope)
        value=scope['shape'];assert value.isValid() and value.isClosed() and value.Solids and value.Volume>0
        carried.append((proxy['id'],value,sha(proxy['shapeCode'])))
    if carried: original=Part.makeCompound([original,*[p[1] for p in carried]])
    result = {'id':case['id'], 'kind':case['kind'], 'description':case.get('description'), 'movingIds':moving_ids,
              'obstacleIds':obstacles,'removedIds':removed,'stageReason':case.get('stageReason'),'carriedProxies':[{'id':p[0],'sourceSHA256':p[2]} for p in carried],'stationaryProxies':stationary, 'waypoints':case['waypoints'], 'maxTranslationStep':case['maxStep'],
              'proxySHA256': sha(case['proxyCode']) if case.get('proxyCode') else None,
              'poseCount':0, 'exactCandidateChecks':0, 'collisions':[],'carriedReserveInternalChecks':0}
    result['exteriorEndpointIndices']=[]
    for i,delta in enumerate([case['waypoints'][0],case['waypoints'][-1]]):
        endpoint=original.copy();endpoint.translate(App.Vector(*delta))
        if all(not substantial(endpoint.BoundBox,shapes[obstacle].BoundBox) for obstacle in obstacles):result['exteriorEndpointIndices'].append(i)
    if case.get('requireExteriorEndpoint') is not True or not result['exteriorEndpointIndices']:
        result['passed']=False
        result['incompleteApproach']='No endpoint is wholly exterior to every stage obstacle; extend the travel.'
        return result
    # Carried cables must also fit their own cassette, not merely pass the fixed receiver.
    for i,(id,proxy,_) in enumerate(carried):
        for physical in moving_ids:
            if not substantial(proxy.BoundBox,shapes[physical].BoundBox):continue
            result['carriedReserveInternalChecks']+=1
            volume=common_volume(proxy,shapes[physical])
            if volume>volume_tolerance:
                result['collisions'].append({'movingReserveId':id,'movingPhysicalId':physical,'overlapVolume':volume,'stage':'canonical-prewired-cassette'})
        for other,b,_ in carried[i+1:]:
            if not substantial(proxy.BoundBox,b.BoundBox):continue
            result['carriedReserveInternalChecks']+=1
            volume=common_volume(proxy,b)
            if volume>volume_tolerance:result['collisions'].append({'movingReserveId':id,'secondMovingReserveId':other,'overlapVolume':volume,'stage':'canonical-prewired-cassette'})
    if result['collisions']:
        result['passed']=False
        return result
    # Exact broad phase: omitted material lies outside every translated opposing
    # bounding box over the complete waypoint polyline, not just the sampled poses.
    items=[(id,shapes[id]) for id in moving_ids] if moving_ids else [('working-proxy',original)]
    if moving_ids:items += [(id,value) for id,value,_ in carried]
    minimum=[min(w[k] for w in case['waypoints']) for k in range(3)]
    maximum=[max(w[k] for w in case['waypoints']) for k in range(3)]
    axes=['X','Y','Z'];pairs=[];pruned=0;clip_checks=0
    def bounds_box(low,high):
        return Part.makeBox(*[high[k]-low[k] for k in range(3)],App.Vector(*low))
    for obstacle in obstacles:
        fixed=shapes[obstacle]; bb=fixed.BoundBox
        local_low=[getattr(bb,axis+'Min')-maximum[k]-1e-5 for k,axis in enumerate(axes)]
        local_high=[getattr(bb,axis+'Max')-minimum[k]+1e-5 for k,axis in enumerate(axes)]
        local_window=bounds_box(local_low,local_high)
        for id,value in items:
            vb=value.BoundBox
            swept_low=[getattr(vb,axis+'Min')+minimum[k]-1e-5 for k,axis in enumerate(axes)]
            swept_high=[getattr(vb,axis+'Max')+maximum[k]+1e-5 for k,axis in enumerate(axes)]
            window=bounds_box(swept_low,swept_high)
            if not substantial(window.BoundBox,bb):pruned+=1;continue
            clip_checks+=1;fixed_clip=fixed.common(window)
            if fixed_clip.isNull() or not fixed_clip.Solids:pruned+=1;continue
            clip_checks+=1;moving_clip=value.common(local_window)
            if moving_clip.isNull() or not moving_clip.Solids:pruned+=1;continue
            assert fixed_clip.isValid() and moving_clip.isValid(), 'Invalid exact sweep clipping'
            pairs.append((id,moving_clip,obstacle,fixed_clip))
    result['sweepClipping']={'exactClips':clip_checks,'provedSeparatedPairs':pruned,'remainingPairs':len(pairs),'padding':1e-5,
                            'method':'Native material intersection with complete-path swept opposing bounding boxes; no physical-unit exemptions.'}
    print('Sweep broad phase',case['id'],json.dumps(result['sweepClipping']),flush=True)
    for delta in poses(case['waypoints'], case['maxStep']):
        result['poseCount']+=1;volumes={};offenders={}
        for id,source,obstacle,fixed_clip in pairs:
            moving=source.copy();moving.translate(App.Vector(*delta))
            if not substantial(moving.BoundBox,fixed_clip.BoundBox):continue
            result['exactCandidateChecks']+=1
            volume=common_volume(moving,fixed_clip)
            if volume>1e-10:
                volumes[obstacle]=volumes.get(obstacle,0)+volume
                offenders.setdefault(obstacle,[]).append({'movingId':id,'overlapVolume':volume})
        for obstacle,volume in volumes.items():
            if volume>volume_tolerance:
                result['collisions'].append({'translationDelta':delta,'obstacleId':obstacle,'overlapVolume':volume,'movingOffenders':offenders[obstacle]})
                result['passed']=False;return result
    result['passed'] = True
    return result


def stop_contact(case, shapes):
    first,second=shapes[case['first']],shapes[case['second']]
    axis=case.get('axis','z').lower();index={'x':0,'y':1,'z':2}[axis]
    coordinate=case.get('planeCoordinate',case.get('planeZ'));tolerance=1e-5
    assert coordinate is not None
    def planar_faces(shape):
        result=[]
        for face in shape.Faces:
            if type(face.Surface).__name__!='Plane':continue
            if getattr(face.BoundBox,axis.upper()+'Length')>tolerance or abs(face.CenterOfMass[index]-coordinate)>tolerance:continue
            u0,u1,v0,v1=face.ParameterRange
            normal=face.normalAt((u0+u1)/2,(v0+v1)/2)
            if abs(normal[index])>0.999:result.append((face,normal))
        return result
    a,b=planar_faces(first),planar_faces(second);patches=[]
    for i,(fa,na) in enumerate(a):
        for j,(fb,nb) in enumerate(b):
            if na.dot(nb)>-0.999:continue
            shared=fa.common(fb);area=0 if shared.isNull() else shared.Area
            if area>1e-6:patches.append({'firstFace':i,'secondFace':j,'area':area,'firstNormal':[na.x,na.y,na.z],'secondNormal':[nb.x,nb.y,nb.z]})
    total=sum(p['area'] for p in patches)
    return {**case,'candidateFaces':[len(a),len(b)],'patches':patches,'contactArea':total,'passed':total>=case['minArea'],'scope':'Opposing native planar face contact at the declared restraint; no lifting, preload, deformation or flight-load rating.'}


def print_screen(id, shape, macro_sha):
    import numpy as np
    from shapely.geometry import Polygon, Point, GeometryCollection, MultiLineString
    from shapely.ops import linemerge
    part_start = time.perf_counter()
    policy = spec.get('printing', {})
    layer = float(policy.get('layerHeight', 0.2))
    reach = float(policy.get('allowedLateralReach', layer))
    deflection = float(policy.get('meshDeflection', 0.025))
    assert 0 < layer <= 0.3 and 0 < reach <= layer and 0 < deflection <= 0.05
    native = metric(shape)
    assert native['valid'] and native['closed'] and native['solids'] == 1
    assert abs(native['min'][2]) < 0.03, (id,'Native print pose is not grounded',native['min'][2])
    mesh = MeshPart.meshFromShape(Shape=shape.copy(True,False), LinearDeflection=deflection, AngularDeflection=0.08, Relative=False)
    mesh_closed = mesh.isSolid()
    mesh_volume_error = abs(mesh.Volume-shape.Volume)/shape.Volume
    assert mesh_closed and mesh.Volume > 0 and mesh_volume_error < 0.01, (id,'Native-derived STL topology/volume failed')
    target = folder / 'print'; target.mkdir(exist_ok=True)
    file = target / (id+'.stl'); mesh.write(str(file))
    step = target / (id+'.step');shape.exportStep(str(step))
    restored = Part.Shape();restored.read(str(step));roundtrip = metric(restored)
    assert roundtrip['valid'] and roundtrip['closed'] and roundtrip['solids'] == 1
    # STEP converts native spline/revolution trims at finite tolerance. Keep the
    # measured error explicit; analytic-only pieces retain tighter invariants.
    freeform=any(k not in {'Plane','Cylinder','Cone','Sphere','Toroid'} for k in native['surfaceTypes'])
    step_volume_tolerance=5e-5 if freeform else 1e-6
    step_bounds_tolerance=0.005 if freeform else 1e-4
    step_volume_error=abs(roundtrip['volume']-native['volume'])/native['volume']
    step_bounds_error=max(abs(a-b) for a,b in zip(roundtrip['min']+roundtrip['max'],native['min']+native['max']))
    step_boolean_equivalence=None
    if step_volume_error>step_volume_tolerance:
        # Identical trimmed analytic shapes can receive different mass integrals
        # after STEP reconstruction. Require two empty native differences before
        # accepting that case; a nonempty residual still fails the export check.
        differences=[shape.cut(restored),restored.cut(shape)]
        step_boolean_equivalence=[{'valid':v.isValid(),'faces':len(v.Faces),'solids':len(v.Solids),'volume':v.Volume} for v in differences]
        assert all(v['valid'] and v['faces']==0 and v['solids']==0 and abs(v['volume'])<1e-10 for v in step_boolean_equivalence), (id,'STEP round trip material differs',step_volume_error,step_boolean_equivalence)
    assert step_bounds_error < step_bounds_tolerance, (id,'STEP round trip bounds',step_bounds_error)
    vertices, faces = mesh.Topology
    points = np.array([[p.x,p.y,p.z] for p in vertices]); face_indices=np.array(faces,dtype=np.int64); triangles=points[face_indices]
    low = triangles[:,:,2].min(axis=1); high = triangles[:,:,2].max(axis=1)
    errors = []
    def section(z):
        active=np.flatnonzero((low<z)&(high>z))
        segments=[];edge_points={}
        for row in active:
            triangle=triangles[row];endpoints=[]
            for i,j in [(0,1),(1,2),(2,0)]:
                if (triangle[i,2]<z) != (triangle[j,2]<z):
                    edge=tuple(sorted((int(face_indices[row,i]),int(face_indices[row,j]))))
                    if edge not in edge_points:
                        point=triangle[i]+(triangle[j]-triangle[i])*(z-triangle[i,2])/(triangle[j,2]-triangle[i,2])
                        edge_points[edge]=tuple(point[:2])
                    endpoints.append(edge_points[edge])
            if len(endpoints)==2 and endpoints[0]!=endpoints[1]:segments.append(endpoints)
        if not segments:return GeometryCollection()
        merged=linemerge(MultiLineString(segments));lines=list(merged.geoms) if merged.geom_type=='MultiLineString' else [merged]
        material=GeometryCollection()
        for line in lines:
            coordinates=list(line.coords)
            if len(coordinates)<4 or not line.is_closed:
                errors.append({'z':z,'kind':'open-contour','points':len(coordinates),'gap':math.dist(coordinates[0],coordinates[-1])})
                continue
            polygon=Polygon(coordinates)
            if not polygon.is_valid:
                errors.append({'z':z,'kind':'invalid-polygon','points':len(coordinates)})
                continue
            material=material.symmetric_difference(polygon)
        return material
    previous=None;first_layer=None;flags=[];count=0
    for z in np.arange(layer*0.5+0.0000137,native['max'][2],layer):
        current=section(float(z));first_layer=current.area if first_layer is None else first_layer
        if previous is not None:
            support=previous.buffer(reach,quad_segs=8)
            unsupported=current.difference(support)
            pieces=list(current.geoms) if current.geom_type=='MultiPolygon' else [current] if current.geom_type=='Polygon' else []
            islands=[p for p in pieces if p.area>0.1 and p.intersection(support).area<1e-6]
            if unsupported.area>0.1 or islands:
                max_reach=0
                regions=list(unsupported.geoms) if unsupported.geom_type=='MultiPolygon' else [unsupported]
                for region in regions:
                    if region.geom_type=='Polygon':
                        for ring in [region.exterior,*region.interiors]:
                            for x,y in ring.coords:max_reach=max(max_reach,Point(x,y).distance(previous))
                flags.append({'z':float(z),'unsupportedArea':unsupported.area,'newIslands':len(islands),'islandAreas':[p.area for p in islands], 'maxReach':max_reach})
        previous=current;count+=1
    area_checks=[]
    for fraction in [0.137,0.333,0.517,0.749,0.913]:
        z=native['max'][2]*fraction+0.0000137
        sliced=section(z);wires=shape.slice(App.Vector(0,0,1),z)
        if any(not wire.isClosed() for wire in wires):errors.append({'z':z,'kind':'native-open-section'})
        face=Part.makeFace(wires,'Part::FaceMakerBullseye') if wires else None
        if face is not None and not face.isValid():errors.append({'z':z,'kind':'native-invalid-section-face'})
        native_area=face.Area if face is not None else 0
        area_checks.append({'z':z,'meshArea':sliced.area,'nativeArea':native_area,'relativeAreaError':abs(sliced.area-native_area)/max(native_area,1)})
    islands=sum(f['newIslands'] for f in flags)
    result={'id':id,'sourceMacroSHA256':macro_sha,'native':native,'stlClosed':mesh_closed,'stlRelativeVolumeError':mesh_volume_error,
            'stlSHA256':sha(file.read_bytes()),'stepSHA256':sha(step.read_bytes()),'stepRoundTrip':roundtrip,'stepPolicy':{'relativeVolumeTolerance':step_volume_tolerance,'boundsTolerance':step_bounds_tolerance,'relativeVolumeError':step_volume_error,'boundsError':step_bounds_error,'freeformTrimConversion':freeform,'emptyNativeSymmetricDifference':step_boolean_equivalence},
            'policy':{'layerHeight':layer,'allowedLateralReach':reach,'meshDeflection':deflection,'noBridgeCredit':True,'nominalNozzle':0.4,'sectionConnectivity':'shared watertight mesh edge IDs; no coordinate rounding or mesh repairs'},
            'triangleCount':len(triangles),'layerCount':count,'firstLayerArea':first_layer,'contourErrors':errors,'areaCrossChecks':area_checks,
            'newIslandCount':islands,'flaggedLayerCount':len(flags),'maxUnsupportedArea':max([f['unsupportedArea'] for f in flags],default=0),
            'maxReach':max([f['maxReach'] for f in flags],default=0),'worstLayers':sorted(flags,key=lambda f:f['unsupportedArea'],reverse=True)[:20],
            'elapsedSeconds':time.perf_counter()-part_start,
            'screenComplete':not errors and all(c['relativeAreaError']<0.02 for c in area_checks),
            'noNewIslands':islands==0,'requiresSlicerBridgeReview':bool(flags)}
    (target/(id+'-screen.json')).write_text(json.dumps(result,indent=2)+'\n')
    return result

try:
    source_guard()
    states={record['state']:record for record in manifest['records']}
    assembled=native_state(states['assembled'])
    if 'fit' in checks:
        print('Checking all physical occurrence pairs',flush=True)
        report['fit']=fit(assembled);dump()
        print(json.dumps({'fitPassed':report['fit']['passed'],'collisions':report['fit']['collisions']}),flush=True)
        isolation=[]
        for pair in spec.get('isolationPairs',[]):
            distance=assembled[pair['electronics']].distToShape(assembled[pair['frame']])[0]
            isolation.append({**pair,'measuredClearance':distance,'passed':distance>=pair['minimumClearance']})
        report['isolation']={'pairs':isolation,'passed':bool(isolation) and all(p['passed'] for p in isolation)}
        dump()
    if 'contacts' in checks:
        for contact in spec.get('contacts',[]):
            result=stop_contact(contact,assembled);report['contacts'].append(result);dump()
            print(json.dumps({'stopContact':result}),flush=True)
    if 'motion' in checks:
        motions=spec['motions']
        if args.motion:motions=[m for m in motions if m['id']==args.motion];assert motions,'Unknown motion'
        for motion in motions:
            print('Checking motion',motion['id'],flush=True)
            result=check_motion(motion,assembled);report['motions'].append(result);dump()
            print(json.dumps({key:result.get(key) for key in ['id','passed','poseCount','exactCandidateChecks','collisions','incompleteApproach']}),flush=True)
    if 'printing' in checks:
        printed=native_state(states['print-layout'])
        report['printLayoutFit']=fit(printed);dump()
        canonical={row['id']:row for row in report['topology'] if row['state']=='assembled'}
        for row in [r for r in report['topology'] if r['state']=='print-layout']:
            assert row['nativeProgramSHA256']==canonical[row['id']]['nativeProgramSHA256'], row['id']+': native fabrication program changed in print layout'
            assert abs(row['volume']-canonical[row['id']]['volume'])<=max(1e-5,row['volume']*1e-7), row['id']+': native print material differs'
        ids=list(printed)
        if args.print_part:ids=[args.print_part];assert args.print_part in printed
        for id in ids:
            print('Screening native print',id,flush=True)
            try:
                result=print_screen(id,printed[id],states['print-layout']['macroSHA256'])
            except Exception as error:
                result={'id':id,'screenComplete':False,'noNewIslands':False,'requiresSlicerBridgeReview':True,'error':str(error),'traceback':traceback.format_exc(),'sourceMacroSHA256':states['print-layout']['macroSHA256']}
            report['printing'].append(result);dump()
            print(json.dumps({k:result.get(k) for k in ['id','screenComplete','newIslandCount','maxUnsupportedArea','maxReach','requiresSlicerBridgeReview','error']}),flush=True)
    source_guard()
    preview_passed=manifest.get('previewChecksComplete') is True and all(m['passed'] for state in manifest['records'] for m in state['meshChecks'])
    required=set(spec['requiredCheckIds']); completed={m['id'] for m in report['motions']}
    expected_print={u['id'] for u in states.get('print-layout',{}).get('components',[])}
    actual_print={p['id'] for p in report['printing']}
    complete=checks.issuperset({'topology','fit','motion','contacts','printing'}) and required.issubset(completed) and actual_print==expected_print
    report['complete']=complete
    report['previewMeshesPassed']=preview_passed
    report['nativeFitAndPathsPassed']=report.get('fit',{}).get('passed',False) and report.get('isolation',{}).get('passed',False) and all(m['passed'] for m in report['motions']) and required.issubset(completed)
    report['positiveStopsPassed']=len(report['contacts'])==len(spec.get('contacts',[])) and len(report['contacts'])>=2 and all(c['passed'] for c in report['contacts'])
    report['printScreenComplete']=bool(expected_print) and actual_print==expected_print and report.get('printLayoutFit',{}).get('passed',False) and all(p['screenComplete'] for p in report['printing'])
    report['noPrintedIslands']=bool(expected_print) and actual_print==expected_print and all(p['noNewIslands'] for p in report['printing'])
    report['slicerReviewNeeded']=[p['id'] for p in report['printing'] if p['requiresSlicerBridgeReview']]
    report['passed']=complete and preview_passed and report['nativeFitAndPathsPassed'] and report['positiveStopsPassed'] and report['printScreenComplete'] and report['noPrintedIslands']
    report['status']='passed-geometric-review' if report['passed'] else 'incomplete-or-failed'
    dump()
    print(json.dumps({key:report[key] for key in ['status','complete','nativeFitAndPathsPassed','printScreenComplete','noPrintedIslands','slicerReviewNeeded','elapsedSeconds']}),flush=True)
except Exception as error:
    report['status']='error';report['passed']=False;report['error']=str(error);report['traceback']=traceback.format_exc();dump()
    raise
sys.exit(0 if report['passed'] else 1)
