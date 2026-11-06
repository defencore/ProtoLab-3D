#!/usr/bin/env python3
"""Export and independently audit the exact Grandado tube-mount recipes in FreeCAD.

Use FreeCAD's Python for native checking. --prepare-only invokes the TypeScript
fixture producer without importing FreeCAD. Existing GUI documents are preserved.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import math

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'test-results/grandado-tube-mount')
parser.add_argument('--fixture', type=Path)
parser.add_argument('--prepare-only', action='store_true')
parser.add_argument('--freecad-lib', default=os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
args = parser.parse_args()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
fixture_path = args.fixture.resolve() if args.fixture else output / 'native-input.json'
if not args.fixture:
    subprocess.run(['node', '--import', 'tsx', 'scripts/verify-grandado-tube-mount.ts', str(output)], cwd=ROOT, check=True)
fixture = json.loads(fixture_path.read_text())
if args.prepare_only:
    print(json.dumps({'fixture': str(fixture_path), 'printedParts': len(fixture['printed'])}))
    sys.exit(0)

sys.path.insert(0, args.freecad_lib)
import FreeCAD as App
import Part
import Mesh
import MeshPart

started = time.perf_counter()
report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'freecad': '.'.join(App.Version()[:3]),
    'sourceHashes': fixture['sourceHashes'],
    'unit': 'mm', 'printedParts': [], 'checks': [], 'errors': [], 'completed': False,
    'windowVariants': {'fittingMm': [fixture['layout']['windowLength'], fixture['layout']['windowWidth']], 'nominalJigMm': [83, 58]},
    'revision': fixture['revision'],
    'scope': 'Solid radial-bolt discs, passive core and smooth curved lid with one continuous lid-side gasket groove; native STL/STEP, bench assembly, tube entry and rigid restraint. Source-derived lid screws are lowered and tip-trimmed explicitly. Source holder fit, physical fastening, sealing and load qualification remain separately disclosed limitations.',
}


def save_report():
    report['elapsedSeconds'] = time.perf_counter() - started
    report['passed'] = report['completed'] and not report['errors']
    (output / 'native-report.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')


def check(condition, label, **values):
    report['checks'].append({'label': label, 'passed': bool(condition), **values})
    if not condition:
        report['errors'].append({'label': label, **values})


def evaluate(code, label):
    scope = {'App': App, 'Part': Part}
    exec(compile(code, label, 'exec'), scope)
    return scope['shape'], scope


def overlap(first, second):
    if not first.BoundBox.intersect(second.BoundBox):
        return 0.0
    common = first.common(second)
    return 0.0 if common.isNull() else common.Volume


def solid_intersection_volume(first, second):
    """Material intersection excludes zero-volume face/edge contact results."""
    if not first.BoundBox.intersect(second.BoundBox):
        return 0.0
    common = first.common(second)
    return sum(solid.Volume for solid in common.Solids)


def solid_check(shape, label, count=1):
    check(not shape.isNull() and shape.isValid() and shape.isClosed()
          and len(shape.Solids) == count and shape.Volume > 0,
          label, solids=len(shape.Solids), volumeMm3=shape.Volume)


def bounds(shape):
    bb = shape.BoundBox
    return {'min': [bb.XMin, bb.YMin, bb.ZMin], 'max': [bb.XMax, bb.YMax, bb.ZMax],
            'size': [bb.XLength, bb.YLength, bb.ZLength]}


def radial_max(shape):
    # Tessellation supplements exact Boolean interference; it never substitutes for it.
    vertices, _ = shape.tessellate(.08)
    return max((point.y * point.y + point.z * point.z) ** .5 for point in vertices)


def motion_contact(moving, blockers, axis, direction, maximum=2.0):
    """Find first positive-volume contact after geometric clearance, without assigning strength."""
    def hit(distance):
        shifted = moving.copy()
        delta = [0.0, 0.0, 0.0]
        delta[axis] = direction * distance
        shifted.translate(App.Vector(*delta))
        for name, blocker in blockers:
            volume = overlap(shifted, blocker)
            if volume > 1e-5:
                return name, volume
        return None
    low = 0.0
    for high in [.02, .05, .1, .2, .3, .45, .6, .8, 1.0, 1.5, maximum]:
        contact = hit(high)
        if contact:
            for _ in range(8):
                middle = (low + high) / 2
                if hit(middle):
                    high = middle
                else:
                    low = middle
            name, volume = hit(high)
            return {'axis': 'XYZ'[axis], 'direction': direction, 'blocked': True,
                    'freePlayMm': low, 'contactByMm': high, 'blocker': name,
                    'contactOverlapMm3': volume}
        low = high
    return {'axis': 'XYZ'[axis], 'direction': direction, 'blocked': False,
            'freePlayAtLeastMm': maximum}


def tilt_contact(moving, blockers, axis, direction, maximum=2.0, center=None):
    """A round cell may spin about X; Y/Z tilt must meet a rigid stop."""
    center = moving.BoundBox.Center if center is None else center
    vector = [App.Vector(1,0,0), App.Vector(0,1,0), App.Vector(0,0,1)][axis]
    def hit(angle):
        shifted = moving.copy()
        shifted.rotate(center, vector, direction * angle)
        for name, blocker in blockers:
            volume = overlap(shifted, blocker)
            if volume > 1e-5:
                return name, volume
        return None
    low = 0.0
    for high in [.02, .05, .1, .2, .3, .5, .75, 1.0, 1.5, maximum]:
        contact = hit(high)
        if contact:
            for _ in range(7):
                middle = (low + high) / 2
                if hit(middle):
                    high = middle
                else:
                    low = middle
            name, volume = hit(high)
            return {'axis': 'XYZ'[axis], 'direction': direction, 'blocked': True,
                    'freeTiltDegrees': low, 'contactByDegrees': high,
                    'blocker': name, 'contactOverlapMm3': volume}
        low = high
    return {'axis': 'XYZ'[axis], 'direction': direction, 'blocked': False,
            'freeTiltAtLeastDegrees': maximum}


def certify_bounded_motion_clearance(build_pose, fixed, start, finish, point_speed,
                                     required_gap=.25, minimum_interval=.0001,
                                     maximum_evaluations=1200, fixed_primitives=None):
    """Certify whole intervals from native distance and a point-travel bound.

    ``point_speed`` bounds every envelope point's displacement per unit motion
    parameter. Native overlap excludes containment as well as penetration at each
    probe. Unresolved intervals fail; clear discrete poses alone do not pass.
    """
    poses = {}
    certificates, failures = [], []

    def pose(parameter):
        key = round(parameter, 12)
        if key not in poses:
            if len(poses) >= maximum_evaluations:
                return None
            shape = build_pose(parameter)
            volume = (max(overlap(shape,primitive) for primitive in fixed_primitives)
                      if fixed_primitives is not None else overlap(shape,fixed))
            separation = shape.distToShape(fixed)[0]
            poses[key] = {'parameter':parameter, 'overlapMm3':volume,
                          'nativeSeparationMm':separation}
        return poses[key]

    def interval(first, last):
        middle = (first+last)/2
        sample = pose(middle)
        if sample is None:
            failures.append({'startParameter':first,'finishParameter':last,'reason':'evaluation limit; interval uncertified'})
            return False
        radius = point_speed*abs(last-first)/2
        lower_bound = sample['nativeSeparationMm']-radius
        if sample['overlapMm3'] > 1e-5:
            failures.append({'startParameter':first,'finishParameter':last,'reason':'native cable/part penetration',**sample})
            return False
        if lower_bound >= required_gap+1e-6:
            certificates.append({'startParameter':first,'finishParameter':last,'midpointParameter':middle,
                                 'midpointSeparationMm':sample['nativeSeparationMm'],
                                 'maximumPointTravelFromMidpointMm':radius,
                                 'certifiedMinimumGapMm':lower_bound})
            return True
        if abs(last-first) <= minimum_interval:
            failures.append({'startParameter':first,'finishParameter':last,'reason':'required gap not certified',
                             'certifiedGapLowerBoundMm':lower_bound,**sample})
            return False
        return interval(first,middle) and interval(middle,last)

    passed = interval(start,finish)
    return {'passed':passed,'startParameter':start,'finishParameter':finish,
            'maximumPointSpeedMmPerParameter':point_speed,
            'requiredGapMm':required_gap,'minimumParameterInterval':minimum_interval,
            'evaluatedPoseCount':len(poses),'certifiedIntervals':certificates,'failures':failures,
            'minimumCertifiedGapMm':min((row['certifiedMinimumGapMm'] for row in certificates),default=None),
            'minimumSampledSeparationMm':min((row['nativeSeparationMm'] for row in poses.values()),default=None),
            'maximumSampledOverlapMm3':max((row['overlapMm3'] for row in poses.values()),default=None),
            'overlapQuery':'Maximum individual authored-primitive intersection; no dense wire union is used.' if fixed_primitives is not None else 'Native moving/fixed shape intersection.',
            'scope':'Continuous native clearance certificate using an explicit global envelope point-travel bound. The bound covers every position between native probes; cable elasticity, physical bend radius and an anti-pinch load rating remain unqualified.'}


def certify_translation_clearance(moving, fixed, axis, start, finish,
                                  required_gap=.25, minimum_interval=.025,
                                  maximum_evaluations=1200, fixed_primitives=None):
    def pose(offset):
        shape = moving.copy()
        delta = [0.0,0.0,0.0]; delta[axis] = offset
        shape.translate(App.Vector(*delta))
        return shape
    result = certify_bounded_motion_clearance(pose,fixed,start,finish,1,
        required_gap,minimum_interval,maximum_evaluations,fixed_primitives)
    result.update({'axis':'XYZ'[axis],'startOffsetMm':start,'finishOffsetMm':finish,
                   'motion':'Rigid translation against an already attached, fixed lead envelope.'})
    return result


def compare_step_boundaries(native, restored, label):
    """Compare actual boundaries; trimmed analytic mass integrals are recorded separately."""
    dimensions = ['XMin','XMax','YMin','YMax','ZMin','ZMax']
    first_bounds, second_bounds = native.optimalBoundingBox(False,False), restored.optimalBoundingBox(False,False)
    bound_delta = max(abs(getattr(first_bounds,key)-getattr(second_bounds,key)) for key in dimensions)
    check(bound_delta < 1e-5, label + ': tight STEP bounds agree', maximumDeltaMm=bound_delta)
    directions = []
    for name, first, second in [('native-to-step',native,restored),('step-to-native',restored,native)]:
        difference = first.cut(second)
        volume = 0.0 if difference.isNull() else difference.Volume
        target = Part.makeCompound(second.Faces)
        vertex_delta = max(vertex.distToShape(target)[0] for vertex in first.Vertexes)
        points = []
        for face in first.Faces:
            u0,u1,v0,v1 = face.ParameterRange
            for uf in [.2,.5,.8]:
                for vf in [.2,.5,.8]:
                    point = face.valueAt(u0+(u1-u0)*uf,v0+(v1-v0)*vf)
                    if face.isInside(point,1e-6,True):
                        points.append(point)
        skin_delta = max(Part.Vertex(point).distToShape(target)[0] for point in points)
        check(volume < 1e-5 and vertex_delta < 1e-5 and skin_delta < 1e-5,
              label + ': ' + name + ' exact difference and boundary samples agree',
              differenceVolumeMm3=volume, maximumVertexDistanceMm=vertex_delta,
              sampledFacePoints=len(points), maximumSampledSkinDistanceMm=skin_delta)
        directions.append({'direction':name,'differenceVolumeMm3':volume,'maximumVertexDistanceMm':vertex_delta,
                           'sampledFacePoints':len(points),'maximumSampledSkinDistanceMm':skin_delta})
    return {'maximumTightBoundsDeltaMm':bound_delta,'directions':directions,
            'scope':'Exact Boolean differences in both directions, every vertex and finite valid-face UV .2/.5/.8 samples projected to the opposite boundary. Volume integrals are recorded independently. Finite samples alone are not a global Hausdorff proof.'}


def audit_lid_gasket_groove(cap, body, raised_rim, tube, occupied, groove, channel, lid_spec, d):
    """Audit the printed channel, approximate raw fit bounds and estimated turns."""
    error_start = len(report['errors'])
    g = lid_spec['gasketGroove']
    for name, shape in [('groove cutter', groove), ('channel-space inspection reference', channel)]:
        solid_check(shape, 'lid gasket ' + name + ': valid closed single connected solid')
    wires = groove.slice(App.Vector(0, 0, 1), g['openingZ'] + g['grooveMinimumDepth'] / 2)
    closed_wires = [wire for wire in wires if wire.isClosed()]
    check(len(wires) == 2 and len(closed_wires) == 2,
          'lid gasket groove is one complete annular loop', sliceWires=len(wires), closedWires=len(closed_wires))
    path = g['path']
    joins = [math.dist(segment['points'][-1], path[(index + 1) % len(path)]['points'][0]) for index, segment in enumerate(path)]
    check(g['closed'] and max(joins) < 1e-8, 'all sixteen analytic channel path segments join continuously', maximumJoinGapMm=max(joins), segments=len(path))
    # Inspect the source support flange immediately below the hard-stop plane.
    # The actual raised rim enters the channel and is checked separately below.
    probe_depth = min(.01, g['grooveMinimumDepth'] / 10)
    footprint_probe = channel.common(Part.makeBox(200, 200, probe_depth, App.Vector(-100, -100, g['openingZ'])))
    footprint_probe.translate(App.Vector(0, 0, -2 * probe_depth))
    contact_band = footprint_probe.common(body)
    solid_check(contact_band, 'channel footprint has a continuous source hard-seat flange band')
    contact_wires = contact_band.slice(App.Vector(0,0,1),g['openingZ']-1.5*probe_depth)
    check(len(contact_wires) == 2 and all(wire.isClosed() for wire in contact_wires),
          'hard-seat flange band remains one closed loop without gaps', sliceWires=len(contact_wires))
    contact_widths = []
    for segment_index, segment in enumerate(path):
        first, last = segment['points'][0], segment['points'][-1]
        if segment['kind'] == 'line':
            length = math.dist(first,last)
            count = max(2,math.ceil(length/2))
            dx,dy = (last[0]-first[0])/length,(last[1]-first[1])/length
        else:
            count = 18
            cx,cy = segment['center']
            start_angle = math.atan2(first[1]-cy,first[0]-cx)
        for index in range(count+1):
            t = index/count
            if segment['kind'] == 'line':
                x,y = first[0]+(last[0]-first[0])*t,first[1]+(last[1]-first[1])*t
                nx,ny = -dy,dx
            else:
                angle = start_angle+math.pi/2*t
                nx,ny = math.cos(angle),math.sin(angle)
                x,y = cx+segment['radius']*nx,cy+segment['radius']*ny
            half = g['width']/2+.01
            start = App.Vector(x-nx*half,y-ny*half,g['openingZ']-1.5*probe_depth)
            stop = App.Vector(x+nx*half,y+ny*half,g['openingZ']-1.5*probe_depth)
            width = sum(edge.Length for edge in contact_band.common(Part.makeLine(start,stop)).Edges)
            contact_widths.append({'segment':segment_index,'fraction':t,'x':x,'y':y,'contactWidthMm':width})
    narrowest = min(contact_widths,key=lambda row:row['contactWidthMm'])
    check(narrowest['contactWidthMm'] >= g['sourceStraightContactWidth']-1e-5 and g['sourceStraightContactWidth'] > 0,
          'finite stations around every channel segment retain the source flange support band', minimumContactWidthMm=narrowest['contactWidthMm'], expectedRimContactWidthMm=g['sourceStraightContactWidth'], samples=len(contact_widths), narrowest=narrowest)
    groove_plastic = overlap(groove, cap)
    raised_channel = channel.copy(); raised_channel.translate(App.Vector(0,0,probe_depth))
    floor_probe = raised_channel.cut(channel)
    missing_floor = floor_probe.cut(cap).Volume
    check(groove_plastic < 1e-5 and floor_probe.Volume > 0 and missing_floor < 1e-5,
          'complete measured channel has a continuous lid-side floor', groovePlasticOverlapMm3=groove_plastic, missingFloorVolumeMm3=missing_floor, floorProbeVolumeMm3=floor_probe.Volume)
    outside = channel.cut(groove).Volume
    plastic = overlap(channel, cap)
    body_overlap = overlap(channel, body)
    rim_outside_channel = raised_rim.cut(channel).Volume
    rim_plastic = overlap(raised_rim,cap)
    rim_missing_body = raised_rim.cut(body).Volume
    channel_body = channel.common(body)
    unexpected_body_in_channel = channel_body.cut(raised_rim).Volume
    rim_missing_channel_body = raised_rim.cut(channel_body).Volume
    solid_check(raised_rim, 'source raised rim is one valid closed native solid')
    rim_wires = raised_rim.slice(App.Vector(0,0,1),d['bodySeamZ']+d['bodyRimHeight']/2)
    check(len(rim_wires)==2 and all(wire.isClosed() for wire in rim_wires),
          'source raised rim has one closed annular native section',sliceWires=len(rim_wires))
    check(outside < 1e-5 and plastic < 1e-5,
          'channel-space inspection witness fits the actual lid groove', outsideGrooveMm3=outside, lidOverlapMm3=plastic)
    check(max(rim_outside_channel,rim_plastic,rim_missing_body,unexpected_body_in_channel,rim_missing_channel_body)<1e-5,
          'entire measured-height source rim enters the channel without lid interference',
          raisedRimOutsideChannelMm3=rim_outside_channel,raisedRimLidOverlapMm3=rim_plastic,
          raisedRimOutsidePurchasedBodyMm3=rim_missing_body,
          nonRimBodyInChannelMm3=unexpected_body_in_channel,raisedRimOutsideChannelBodyMm3=rim_missing_channel_body)
    rim_floor_headroom = g['grooveMinimumDepth']-d['bodyRimHeight']
    rim_lid_separation = raised_rim.distToShape(cap)[0]
    check(rim_floor_headroom>0 and rim_lid_separation>=rim_floor_headroom-1e-5,
          'raised rim retains positive native lid-floor headroom',
          nominalFloorHeadroomMm=rim_floor_headroom,nativeRimLidSeparationMm=rim_lid_separation,
          scope='Rigid fit only; actual gasket compression and leakage remain unqualified.')
    inner_cylinder = Part.makeCylinder(g['floorClipRadius'],lid_spec['coverLength']+4,App.Vector(-lid_spec['coverLength']/2-2,0,0),App.Vector(1,0,0))
    roof_intrusion = channel.cut(inner_cylinder).Volume
    check(roof_intrusion < 1e-5, 'complete channel floor preserves the structural radial roof', channelBeyondInnerRoofCylinderMm3=roof_intrusion, remainingRoofMm=lid_spec['outerRadius']-g['floorClipRadius'])
    def intervals(shape,start,direction,length):
        point,vector = App.Vector(*start),App.Vector(*direction)
        values = []
        for edge in shape.common(Part.makeLine(point,point+vector*length)).Edges:
            distances = [(vertex.Point-point).dot(vector) for vertex in edge.Vertexes]
            if distances: values.append([min(distances),max(distances)])
        return sorted(values)
    straight_sections = []
    section_z = g['openingZ']+min(.5,g['grooveMinimumDepth']/2)
    for axis,half,rail,inner_half in [
        (0,lid_spec['bodyLength']/2,g['railX'],lid_spec['skirtInnerLength']/2),
        (1,lid_spec['bodyWidth']/2,g['railY'],lid_spec['skirtInnerWidth']/2),
    ]:
        direction = [0,0,0]; direction[axis] = 1
        cuts = intervals(cap,[0,0,section_z],direction,half+.01)
        cuts = [pair for pair in cuts if pair[1] <= half+1e-5]
        inner_flank=g['endInnerFlankX'] if axis==0 else rail-g['width']/2
        outer_flank=g['endOuterFlankX'] if axis==0 else rail+g['width']/2
        expected = [[inner_half,inner_flank],[outer_flank,half]]
        delta = max(abs(actual-value) for pair,wanted in zip(cuts,expected) for actual,value in zip(pair,wanted)) if len(cuts)==2 else 1000
        check(len(cuts)==2 and delta < 1e-5, 'native measured inner/channel/outer straight section along '+'XY'[axis], materialIntervalsMm=cuts, expectedIntervalsMm=expected, outerWallMm=half-outer_flank, channelWidthMm=outer_flank-inner_flank, innerWallMm=g['innerWall'])
        straight_sections.append({'axis':'XY'[axis],'sectionZMm':section_z,'materialIntervalsMm':cuts,'expectedIntervalsMm':expected})
    # These diagnostic bars reproduce approximate raw fit bounds only. Their
    # short axial/tangential length and 0.01 mm height are probes, not an invented
    # whole body rim, corner contour or raised-rim height.
    measured_rim = g['measuredBodyRim']
    rim_fit_sections = []
    for axis, outer_key, inner_key in [
        (0,'outerLength','innerLength'),
        (1,'outerWidth','innerWidth'),
    ]:
        inner_half, outer_half = measured_rim[inner_key]/2, measured_rim[outer_key]/2
        thickness = outer_half-inner_half
        for sign in [-1,1]:
            direction = [0,0,0]; direction[axis] = sign
            cuts = intervals(cap,[0,0,section_z],direction,100)
            body_half = lid_spec['bodyLength' if axis == 0 else 'bodyWidth']/2
            near_channel = [pair for pair in cuts if pair[1] <= body_half+1e-5]
            if len(near_channel) != 2:
                check(False, 'measured body rim native straight section has two adjacent lid walls '+str((axis,sign)), materialIntervalsMm=cuts)
                continue
            inner_clearance = inner_half-near_channel[0][1]
            outer_clearance = near_channel[1][0]-outer_half
            corner = [ -5.0, -5.0, section_z ]
            size = [10.0,10.0,.01]
            corner[axis] = inner_half if sign == 1 else -outer_half
            size[axis] = thickness
            probe = Part.makeBox(*size,App.Vector(*corner))
            missing_channel = probe.cut(channel).Volume
            plastic_overlap = overlap(probe,cap)
            inner_flank=g['endInnerFlankX'] if axis==0 else g['railY']-g['width']/2
            outer_flank=g['endOuterFlankX'] if axis==0 else g['railY']+g['width']/2
            nominal_inner=inner_half-inner_flank
            nominal_outer=outer_flank-outer_half
            check(min(inner_clearance,outer_clearance) > 0 and
                  abs(inner_clearance-nominal_inner)<1e-5 and abs(outer_clearance-nominal_outer)<1e-5 and
                  missing_channel<1e-6 and plastic_overlap<1e-6,
                  'approximate raw body-rim bounds fit native straight groove '+str(('XY'[axis],sign)),
                  innerClearanceMm=inner_clearance,outerClearanceMm=outer_clearance,
                  rawEnvelopeBandMm=thickness,expectedInnerClearanceMm=nominal_inner,expectedOuterClearanceMm=nominal_outer,
                  diagnosticProbeOutsideChannelMm3=missing_channel,diagnosticProbeLidOverlapMm3=plastic_overlap)
            rim_fit_sections.append({'axis':'XY'[axis],'side':sign,'sectionZMm':section_z,
                                     'rimIntervalMm':[inner_half,outer_half],
                                     'grooveIntervalMm':[near_channel[0][1],near_channel[1][0]],
                                     'rawEnvelopeBandMm':thickness,'innerClearanceMm':inner_clearance,
                                     'outerClearanceMm':outer_clearance,
                                     'diagnosticProbeOutsideChannelMm3':missing_channel,'diagnosticProbeLidOverlapMm3':plastic_overlap})
    depth_sections = []
    for x,y in [(0,0),(0,g['railY']),(0,g['railY']+g['width']/2-.001),(0,-g['railY']-g['width']/2+.001),(g['railX'],0)]:
        if x==0 and y==0: continue
        values = intervals(channel,[x,y,g['openingZ']-.1],[0,0,1],g['depth']+.3)
        measured = max(pair[1]-pair[0] for pair in values) if values else 0
        expected = min(g['depth'],math.sqrt(g['floorClipRadius']**2-y*y)-g['openingZ'])
        check(abs(measured-expected)<1e-5, 'native local channel depth matches nominal or roof clip '+str((x,y)), depthMm=measured, expectedMm=expected)
        depth_sections.append({'x':x,'y':y,'depthMm':measured,'expectedMm':expected})
    # The external 1 mm curved wrap may descend below the seam; the central lid may not.
    prism = Part.makeBox(lid_spec['bodyLength'], lid_spec['bodyWidth'], d['bodySeamZ'] + 100 - 1e-5,
                         App.Vector(-lid_spec['bodyLength']/2, -lid_spec['bodyWidth']/2, -100))
    below_volume = cap.common(prism).Volume
    check(below_volume < 1e-5, 'no central locating tongue projects below the unchanged body seam', plasticBelowSeamMm3=below_volume)
    bearing_areas = []
    for seat in lid_spec['screwSeats']:
        x,y,z = seat['x'],seat['y'],seat['bearingZ']
        expected = Part.makeCylinder(lid_spec['screwHeadDiameter']/2,lid_spec['minimumBearingWeb'],App.Vector(x,y,z-lid_spec['minimumBearingWeb']))
        expected = expected.cut(Part.makeCylinder(lid_spec['screwThroughDiameter']/2,lid_spec['minimumBearingWeb']+.2,App.Vector(x,y,z-lid_spec['minimumBearingWeb']-.1)))
        missing_bearing = expected.cut(cap).Volume
        check(missing_bearing < 1e-5, 'entire factory head-bearing annulus retains three-millimeter web '+str((x,y)), missingBearingStockMm3=missing_bearing, expectedWebMm=lid_spec['minimumBearingWeb'])
        bearing_areas.append({'x':x,'y':y,'missingBearingStockMm3':missing_bearing})
    insertion = []
    for dz in [0,.1,.3,.7,1,1.5,2,5,20]:
        moving = cap.copy(); moving.translate(App.Vector(0,0,dz))
        insertion.append({'offsetZMm':dz,'bodyOverlapMm3':overlap(moving,body),'occupiedConnectorOverlapMm3':overlap(moving,occupied),'pipeOverlapMm3':overlap(moving,tube)})
    check(all(max(row['bodyOverlapMm3'],row['occupiedConnectorOverlapMm3'],row['pipeOverlapMm3'])<1e-5 for row in insertion),
          'measured-channel cover clears body posts connectors and pipe throughout sampled radial insertion',samples=insertion)
    report['lidGasketGroove'] = {
        'passed':len(report['errors'])==error_start,'sourceBodyReusedWithoutKitResizing':True,'gasketProcurementIncluded':False,'referenceOnly':True,
        'nativeLoopSlice':{'wires':len(wires),'closedWires':len(closed_wires)},
        'matingContactBand':{'connectedSolids':len(contact_band.Solids),'closedSliceWires':len(contact_wires),'areaMm2':contact_band.Volume/probe_depth,'minimumSampledWidthMm':narrowest['contactWidthMm'],'sampledStations':len(contact_widths),'narrowest':narrowest,'fullChannelFootprintSupported':False,'unsupportedChannelFootprintVolumeMm3':footprint_probe.cut(body).Volume,'scope':'Source support flange below the hard-stop plane; the raised rim contact is checked separately. The 2 mm flange backing remains reconstructed evidence.'},
        'wholeGrooveFloor':{'groovePlasticOverlapMm3':groove_plastic,'missingFloorVolumeMm3':missing_floor,'floorProbeVolumeMm3':floor_probe.Volume},
        'channelSpace':{'outsideGrooveMm3':outside,'lidOverlapMm3':plastic,'bodyOverlapMm3':body_overlap,'boundsMm':bounds(channel)},
        'raisedRimFit':{'heightMm':d['bodyRimHeight'],'boundsMm':bounds(raised_rim),'sliceWires':len(rim_wires),
                        'outsideChannelMm3':rim_outside_channel,'lidOverlapMm3':rim_plastic,
                        'outsidePurchasedBodyMm3':rim_missing_body,
                        'nonRimBodyInChannelMm3':unexpected_body_in_channel,
                        'nominalFloorHeadroomMm':rim_floor_headroom,'nativeLidSeparationMm':rim_lid_separation,
                        'scope':'The actual raised source rim intentionally occupies part of the channel-space witness. That witness is not rubber; no gasket squeeze or leakage is inferred.'},
        'roofPreservation':{'channelBeyondInnerRoofCylinderMm3':roof_intrusion,'remainingRoofMm':lid_spec['outerRadius']-g['floorClipRadius']},
        'measuredStraightSections':straight_sections,
        'deliveredRimStraightFit':{'measurements':measured_rim,'nativeSections':rim_fit_sections,
                                 'scope':'Four native straight diagnostic sections using approximate raw outer/inner fit envelopes, centred on the confirmed screw-pattern datum. The user clarified the actual rim has uniform thickness; inconsistent raw dimension differences do not establish unequal physical walls. Actual uniform thickness, rim height, corner shape and XY centring/tolerances are not measured. Full delivered-part closure and elastomer compression are not claimed.'},
        'localDepthSections':depth_sections,'gland':g,'bearingAnnuli':bearing_areas,'centralPlasticBelowSeamMm3':below_volume,'insertion':insertion,
        'scope':'The source library includes the delivered22 mm hard body,1.8 mm raised rim and6 mm ears. The complete source rim enters the approximately2 mm-deep channel with positive rigid headroom. Side/post width remains1.8 mm; default0.5 mm total inner-end relief gives2.05 mm end width without moving the outer flanks or screw axes. The physical contact face remains unidentified and a repeat fitting is required. The support flange and molded corner profile remain reconstructed. Channel occupied space includes the entering rim and is not rubber or a sealing qualification.'}


original_documents = set(App.listDocuments())
original_active = App.ActiveDocument.Name if App.ActiveDocument else None
created_document = None
try:
    # These two folders contain only generated print exports owned by this script.
    # Do not let a superseded rectangular frame or outer saddle enter a new archive.
    for directory in [output / 'printed', output / 'nominal-83x58-jig']:
        if directory.exists():
            for pattern in ['*.stl', '*.step']:
                for obsolete in directory.glob(pattern):
                    obsolete.unlink()
    installed = []
    export_items = [dict(item, variant='fitting-kit') for item in fixture['printed']] + [dict(item, variant='nominal-83x58-jig') for item in fixture['nominalJig']]
    for item in export_items:
        try:
            shape, scope = evaluate(item['python'], item['id'] + '-print')
            raw_print_bounds = bounds(shape)
            print_shift = [-value for value in raw_print_bounds['min']]
            shape.translate(App.Vector(*print_shift))
            solid_check(shape, item['id'] + ': printable single solid')
            check(abs(shape.BoundBox.ZMin) < 1e-6, item['id'] + ': print bed Z=0', bedZ=shape.BoundBox.ZMin)
            assembled, _ = evaluate(item['installedPython'], item['id'] + '-installed')
            solid_check(assembled, item['id'] + ': installed single solid')
            check(abs(assembled.Volume - shape.Volume) < max(shape.Volume * 1e-6, 1e-4),
                  item['id'] + ': print orientation preserves volume', installedMm3=assembled.Volume, printMm3=shape.Volume)
            stem = output / ('printed' if item['variant'] == 'fitting-kit' else 'nominal-83x58-jig') / item['id']
            stem.parent.mkdir(exist_ok=True)
            shape.exportStep(str(stem) + '.step')
            restored = Part.Shape()
            restored.read(str(stem) + '.step')
            solid_check(restored, item['id'] + ': STEP roundtrip')
            step_relative_tolerance = 1e-6 if item['nativeRefine'] else 5e-6
            step_volume_delta = abs(restored.Volume-shape.Volume)
            step_geometry = None
            if item['id'] == fixture['audit']['lidId']:
                # The lid's trimmed analytic face mass integrals vary after STEP
                # reparameterization; strict actual-boundary comparisons decide it.
                step_geometry = compare_step_boundaries(shape, restored, item['id'])
                step_relative_tolerance = None
            else:
                check(step_volume_delta < max(shape.Volume * step_relative_tolerance, 1e-4),
                      item['id'] + ': STEP volume retained', nativeMm3=shape.Volume, stepMm3=restored.Volume,
                      absoluteDeltaMm3=step_volume_delta, relativeTolerance=step_relative_tolerance)
            step_bbox_delta=max(abs(getattr(shape.BoundBox,key)-getattr(restored.BoundBox,key)) for key in ['XMin','XMax','YMin','YMax','ZMin','ZMax'])
            check(step_bbox_delta<1e-5,item['id']+': STEP bounds retained',maximumDeltaMm=step_bbox_delta)
            step_vertex_delta=0.0
            if not item['nativeRefine']:
                for first,second in [(shape,restored),(restored,shape)]:
                    points=[vertex.Point for vertex in first.Vertexes]
                    targets=[vertex.Point for vertex in second.Vertexes]
                    step=max(1,len(points)//48)
                    step_vertex_delta=max(step_vertex_delta,max(min((point-target).Length for target in targets) for point in points[::step]))
                check(step_vertex_delta<1e-5,item['id']+': unrefined STEP sampled vertices agree bidirectionally',maximumDeltaMm=step_vertex_delta)

            mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=.08, AngularDeflection=.15, Relative=False)
            mesh.write(str(stem) + '.stl')
            restored_mesh = Mesh.Mesh(str(stem) + '.stl')
            check(restored_mesh.isSolid() and restored_mesh.CountFacets > 0,
                  item['id'] + ': STL closed manifold', facets=restored_mesh.CountFacets)
            check(abs(abs(restored_mesh.Volume) - shape.Volume) / shape.Volume < .01,
                  item['id'] + ': STL volume agrees', nativeMm3=shape.Volume, meshMm3=restored_mesh.Volume)
            row = {'id': item['id'], 'label': item['label'], 'role': item['role'], 'variant': item['variant'],
                   'solids': len(shape.Solids), 'volumeMm3': shape.Volume,
                   'boundsMm': bounds(shape), 'rawPrintBoundsMm': raw_print_bounds, 'printBedTranslationMm': print_shift, 'facets': restored_mesh.CountFacets,
                   'stl': str(stem) + '.stl', 'step': str(stem) + '.step',
                   'recipeSha256': hashlib.sha256(item['python'].encode()).hexdigest(),
                   'stepVerification': {'nativeVolumeMm3':shape.Volume,'restoredVolumeMm3':restored.Volume,'absoluteVolumeDeltaMm3':step_volume_delta,'relativeTolerance':step_relative_tolerance,'maximumBoundsDeltaMm':step_bbox_delta,'maximumSampledVertexDeltaMm':step_vertex_delta,'boundaryComparison':step_geometry}}
            report['printedParts'].append(row)
            if item['role'] != 'coupon' and item['variant'] == 'fitting-kit':
                installed.append((item, assembled))
            print(json.dumps({'printed': item['id'], 'solids': len(shape.Solids), 'facets': restored_mesh.CountFacets}), flush=True)
        except Exception as error:
            report['errors'].append({'part': item['id'], 'error': str(error)})
        save_report()

    audit = fixture['audit']
    contact, disc, lid_spec, d = audit['cassetteContacts'], audit['discSpec'], audit['lidSpec'], fixture['layout']
    stock, _ = evaluate(audit['tubeStock'], 'uncut-tube')
    tube, _ = evaluate(audit['tubeWindow'], 'windowed-tube')
    box, _ = evaluate(audit['grandado'], 'installed-grandado-with-factory-screws')
    body_only, _ = evaluate(audit['grandadoBodyOnly'], 'grandado-body-before-cover')
    raised_rim, _ = evaluate(audit['grandadoRaisedRim'], 'measured-height-source-raised-rim')
    holder, _ = evaluate(audit['holder'], 'installed-3s-holder')
    factory_screws,_=evaluate(audit['factoryLidScrews'],'four-source-derived-lowered-trimmed-lid-screws')
    original_factory_screws,_=evaluate(audit['originalFactoryScrews'],'four-unmodified-source-lid-screws')
    lid_groove,_=evaluate(audit['lidGroove'],'continuous-lid-gasket-groove')
    channel_space,_=evaluate(audit['lidChannelSpace'],'measured-channel-space-inspection-reference')
    reliefs, _ = evaluate(audit['connectorReliefs'], 'connector-service-reliefs')
    occupied, _ = evaluate(audit['connectorOccupied'], 'connector-occupied-envelope')
    inward_power, _ = evaluate(audit['inwardPowerConnector'], 'measured-centre-inward-power-connector')
    cable_entry, _ = evaluate(audit['cableEntryRelief'], 'optional-lower-cable-entry')
    hardware, hardware_scope = evaluate(audit['hardware'], 'sixteen-standard-end-disc-fasteners')
    shape_by_id = {item['id']: shape for item, shape in installed}
    shape_by_id.update({'grandado': box, 'grandado-body': body_only, 'holder-3s': holder, 'tube': tube})
    shape_by_id.update({item['id']: shape for item, shape in zip(audit['hardwareRecords'], hardware_scope['components'])})
    cells = [(item, evaluate(item['python'], item['id'])[0]) for item in audit['cells']]
    shape_by_id.update({item['id']: shape for item, shape in cells})
    upper_id, lower_part_ids, keeper_id, lid_id = audit['upperId'], audit['lowerIds'], audit['keeperId'], audit['lidId']
    lower_id = 'loaded-lower-halves-reference'
    shape_by_id[lower_id] = Part.makeCompound([shape_by_id[name] for name in lower_part_ids])
    cap = shape_by_id[lid_id]
    core_ids = [upper_id, lower_id, keeper_id]
    disc_ids = audit['discIds']
    internal_ids = [upper_id, *lower_part_ids, keeper_id] + disc_ids
    solid_check(stock, 'reference tube stock is one solid')
    solid_check(tube, 'reference machined tube is one solid')
    check(len(body_only.Solids) == 5 and len(box.Solids) == 9, 'factory body/inserts plus four lowered source screws; original lid omitted', bodyOnlySolids=len(body_only.Solids), installedSolids=len(box.Solids))
    check(abs(cap.BoundBox.ZMax - d['radius'] - 1) < 1e-6, 'curved cover apex is exactly one millimeter above pipe', apexMm=cap.BoundBox.ZMax)
    check(abs(body_only.BoundBox.ZMin-d['boxBottom'])<1e-6 and abs(body_only.BoundBox.ZMax-d['bodyRimTopZ'])<1e-6,
          'source body retains measured hard height and projecting rim at the unchanged lid datum',
          bodyBottomMm=body_only.BoundBox.ZMin,hardStopMm=d['bodySeamZ'],
          rimTopMm=body_only.BoundBox.ZMax,hardHeightMm=d['bodyHardHeight'],
          totalBodyHeightMm=body_only.BoundBox.ZLength)
    check(overlap(body_only, tube) < 1e-5, 'factory body clears windowed tube', overlapMm3=overlap(body_only, tube))
    check(overlap(body_only, holder) < 1e-5, 'holder clears factory body', overlapMm3=overlap(body_only, holder))
    check(overlap(holder, stock) < 1e-5, 'existing3S holder fits intact bore', overlapMm3=overlap(holder, stock))
    report['hardwareBoundsMm'] = [{'id': item['id'], 'label': label, **bounds(shape)} for item, label, shape in zip(audit['hardwareRecords'], hardware_scope['component_labels'], hardware_scope['components'])]
    for item, shape in installed:
        if item['role'] == 'jig':
            check(overlap(shape, stock) < 1e-5, item['id'] + ': no tube interference', overlapMm3=overlap(shape, stock))
        elif item['id'] != lid_id:
            check(radial_max(shape) <= d['innerRadius'] + 1e-5, item['id'] + ': internal circular envelope', maxRadiusMm=radial_max(shape))
            for label, target in [('tube', tube), ('purchased body', body_only), ('holder', holder), ('connector allowance', reliefs), ('optional cable entry', cable_entry)]:
                volume = overlap(shape, target)
                check(volume < 1e-5, item['id'] + ': clears ' + label, overlapMm3=volume)
            interference = [{'label': label, 'overlapMm3': volume} for label, part in zip(hardware_scope['component_labels'], hardware_scope['components']) if (volume := overlap(shape, part)) > 1e-5]
            check(not interference, item['id'] + ': hardware clears print', interferences=interference)
    for index, (first_item, first) in enumerate(installed):
        for second_item, second in installed[index + 1:]:
            if first_item['role'] == second_item['role'] and lid_id not in (first_item['id'], second_item['id']):
                volume = overlap(first, second)
                check(volume < 1e-5, first_item['id'] + ' / ' + second_item['id'] + ': no print interference', overlapMm3=volume)
    # Section probes inspect the actual refined native cover used by the exports.
    def line_intervals(shape, start, direction, length):
        origin, vector = App.Vector(*start), App.Vector(*direction)
        result = []
        for edge in shape.common(Part.makeLine(origin, origin + vector * length)).Edges:
            values = [(vertex.Point-origin).dot(vector) for vertex in edge.Vertexes]
            if values:
                result.append([min(values), max(values)])
        return sorted(result)
    roof_sections = []
    for x,y,expected in [(0,0,3),(0,29.2,3),(0,-29.2,3),(47,0,1),(-47,0,1),(0,35,1),(0,-35,1)]:
        sections = line_intervals(cap, [x,y,0], [0,0,1], d['boxTop']+2)
        radii = [[(y*y+z*z)**.5 for z in interval] for interval in sections]
        width = radii[-1][1]-radii[-1][0] if radii else 0
        check(abs(width-expected) < 1e-5, 'cover radial section at ' + str((x,y)), thicknessMm=width, expectedMm=expected, radiiMm=radii)
        roof_sections.append({'x':x,'y':y,'radialIntervalsMm':radii,'expectedThicknessMm':expected})
    report['coverSections'] = roof_sections
    audit_lid_gasket_groove(cap, body_only, raised_rim, tube, occupied, lid_groove, channel_space, lid_spec, d)
    power_lid_overlap=overlap(inward_power,cap)
    power_groove_overlap=overlap(inward_power,channel_space)
    power_lid_gap=inward_power.distToShape(cap)[0]
    check(power_lid_overlap<1e-5 and power_groove_overlap<1e-5 and power_lid_gap>=.5-1e-5,
          'actual inward power connector at measured12mm centre clears the unchanged sealed lid',
          lidOverlapMm3=power_lid_overlap,grooveOverlapMm3=power_groove_overlap,
          nativeLidGapMm=power_lid_gap,connectorTopMm=inward_power.BoundBox.ZMax,
          scope='Actual occupied connector only; no extra external one-millimetre lid service allowance is imposed.')
    report['powerConnectorLidFit']={'passed':power_lid_overlap<1e-5 and power_groove_overlap<1e-5 and power_lid_gap>=.5-1e-5,
                                   'bodyBottomMm':d['boxBottom'],'centerAboveBodyBottomMm':d['powerCenterZ']-d['boxBottom'],
                                   'diameterMm':d['powerDiameter'],'boundsMm':bounds(inward_power),
                                   'lidOverlapMm3':power_lid_overlap,'grooveOverlapMm3':power_groove_overlap,
                                   'nativeLidGapMm':power_lid_gap}
    ear_sections=[]
    for x in d['mountXs']:
        actual=line_intervals(body_only,[x,3,0],[0,0,1],d['boxTop']+3)
        ear=next((pair for pair in actual if pair[0]<=d['boxBottom']+.1<=pair[1]),None)
        roof=line_intervals(shape_by_id[upper_id],[x,3,d['earTop']],[0,0,1],d['boxTop']+3)
        ceiling_gap=roof[0][0] if roof else None
        ceiling_stock=roof[0][1]-roof[0][0] if roof else 0
        check(ear is not None and abs(ear[1]-ear[0]-audit['grandadoBodyMeasurements']['earThickness'])<1e-5,
              'actual source ear retains measured6mm thickness atX'+str(x),materialIntervalsMm=actual)
        check(ceiling_gap is not None and abs(ceiling_gap-d['earClearance'])<1e-5 and ceiling_stock>=3.2-1e-5,
              'actual ear pocket has measured6mm plus configured clearance atX'+str(x),
              ceilingGapMm=ceiling_gap,ceilingStockMm=ceiling_stock,
              actualPocketHeightMm=None if ceiling_gap is None else d['earThickness']+ceiling_gap)
        ear_sections.append({'xMm':x,'sourceEarIntervalMm':ear,'upperRoofIntervalsFromEarTopMm':roof,
                             'ceilingGapMm':ceiling_gap,'ceilingStockMm':ceiling_stock})
    report['measuredEarCapture']={'sourceThicknessMm':audit['grandadoBodyMeasurements']['earThickness'],
                                  'configuredPocketHeightMm':d['earThickness']+d['earClearance'],
                                  'nativeSections':ear_sections,
                                  'scope':'Native post-Boolean source-ear and cage-ceiling sections, not metadata-only pocket height.'}
    cap_pipe_volume = overlap(cap, tube)
    check(cap_pipe_volume < 1e-5, 'curved cover clears actual cut pipe', overlapMm3=cap_pipe_volume)
    cap_screw_data=[]
    screws = list(factory_screws.Solids)
    originals = list(original_factory_screws.Solids)
    inserts = [solid for solid in body_only.Solids if solid.Volume < 100]
    check(len(screws)==4 and len(inserts)==4 and len(originals)==4, 'four source screws and original body inserts remain')
    outside_cylinder=cap.cut(Part.makeCylinder(lid_spec['outerRadius'],lid_spec['coverLength']+4,App.Vector(-lid_spec['coverLength']/2-2,0,0),App.Vector(1,0,0))).Volume
    check(outside_cylinder<1e-5,'smooth lid has no material or external boss beyond the declared cylindrical roof',outsideVolumeMm3=outside_cylinder)
    for seat in lid_spec['screwSeats']:
        x,y=seat['x'],seat['y']
        nearest=lambda solids:min(solids,key=lambda value:abs(value.BoundBox.Center.x-x)+abs(value.BoundBox.Center.y-y))
        screw=nearest(screws);insert=nearest(inserts);original=nearest(originals).copy()
        original.translate(App.Vector(0,0,lid_spec['bodyTranslation']+lid_spec['screwOffsetZ']))
        expected=original.cut(Part.makeBox(200,200,seat['factoryScrewTipZ']+100,App.Vector(-100,-100,-100)))
        changed_volume=screw.cut(expected).Volume+expected.cut(screw).Volume
        check(changed_volume<1e-6,'factory screw retains source geometry except placement and specified tip trim '+str((x,y)),unexpectedVolumeMm3=changed_volume,trimMm=lid_spec['screwTipTrim'])
        bore=line_intervals(cap,[x,y,d['bodySeamZ']-1],[0,0,1],30)
        bearing=line_intervals(cap,[x+2.5,y,d['bodySeamZ']-1],[0,0,1],8)
        bearing_z=d['bodySeamZ']-1+bearing[0][1] if bearing else None
        web=bearing[0][1]-bearing[0][0] if bearing else 0
        check(not bore and bearing_z is not None and abs(bearing_z-seat['bearingZ'])<1e-5 and abs(web-3)<1e-5,'factory screw open bore and exact three-millimeter bearing web '+str((x,y)),bearingZMm=bearing_z,webMm=web)
        engagement=min(insert.BoundBox.ZMax,seat['bearingZ'])-max(insert.BoundBox.ZMin,screw.BoundBox.ZMin)
        blind_sections=line_intervals(body_only,[x,y,-100],[0,0,1],200)
        blind_top=-100+max(b for a,b in blind_sections)
        blind_clearance=screw.BoundBox.ZMin-blind_top
        radius_y=max(abs(screw.BoundBox.YMin),abs(screw.BoundBox.YMax))
        head_recess=math.sqrt(lid_spec['outerRadius']**2-radius_y**2)-screw.BoundBox.ZMax
        check(abs(engagement-4.6)<1e-5 and abs(screw.BoundBox.ZMax-seat['screwHeadTopZ'])<1e-5,'source screw full4.6mm axial insert overlap '+str((x,y)),axialOverlapMm=engagement,headTopMm=screw.BoundBox.ZMax)
        check(abs(blind_clearance-1.7)<1e-5 and abs(blind_top-seat['blindBottomZ'])<1e-5,'actual source blind floor has1.7mm tip clearance '+str((x,y)),blindFloorZMm=blind_top,tipClearanceMm=blind_clearance)
        check(head_recess>0 and abs(head_recess-seat['headRecess'])<1e-5,'factory head recessed below cylindrical outer envelope '+str((x,y)),headRecessMm=head_recess)
        cap_screw_data.append({'x':x,'y':y,'bearingZMm':bearing_z,'bearingWebMm':web,'tipTrimMm':lid_spec['screwTipTrim'],'axialInsertOverlapMm':engagement,'blindTipClearanceMm':blind_clearance,'headRecessMm':head_recess,'unexpectedSourceGeometryDeltaMm3':changed_volume,'scope':'The reused source screws are lowered and shortened by the specified tip trim. Source-model axial overlap does not verify unmodeled mating threads; actual screws require cutting, deburring and specimen fitting.'})
    report['coverFactoryFasteners']=cap_screw_data
    report['smoothLidEnvelope']={'passed':outside_cylinder<1e-5,'outsideCylinderVolumeMm3':outside_cylinder,'outerRadiusMm':lid_spec['outerRadius'],'apexMm':cap.BoundBox.ZMax,'separateExternalBosses':False}
    factory_screw_path=[]
    for dz in [0,.5,1,2,5,10,20]:
        moving=factory_screws.copy();moving.translate(App.Vector(0,0,dz))
        volumes={'lid':overlap(moving,cap),'bodyPostsAndInserts':overlap(moving,body_only)}
        check(max(volumes.values())<1e-5,'four source screws enter the recessed seats '+str(dz),overlapsMm3=volumes)
        factory_screw_path.append({'offsetZMm':dz,'overlapsMm3':volumes})
    report['factoryScrewInstallation']=factory_screw_path
    # A translated cover clears the body envelope and pipe throughout its radial installation.
    cover_path=[{'offsetZMm':0,'pipeOverlapMm3':cap_pipe_volume,'basis':'Native actual initial cover pose.'}]
    for dz in [1,20]:
        moving=cap.copy();moving.translate(App.Vector(0,0,dz))
        cover_path.append({'offsetZMm':dz,'pipeOverlapMm3':overlap(moving,tube),'basis':'Native actual translated cover.'})
    check(all(row['pipeOverlapMm3']<1e-5 for row in cover_path) and cap.BoundBox.ZMin>0, 'replacement cover installs fromabove after axial module insertion', samples=cover_path)
    report['coverInstallationContinuity']='The native starting pose is disjoint from the pipe/window solid. At fixedY, raising positiveZ only increases radius; the window is an unbounded upward prism. Native0/1/20mm samples corroborate this continuous clearance.'
    report['coverInstallation']=cover_path

    def radial_point(x,r,angle):
        a=angle*3.141592653589793/180
        return App.Vector(x,r*__import__('math').sin(a),r*__import__('math').cos(a))
    external=[item for item in audit['hardwareRecords'] if item['id'].endswith('-screw')]
    check(len(external)==8 and len(audit['hardwareRecords'])==16, 'only eight external radial screws and eight captured nuts')
    radial_axes=[]
    for sign in [-1,1]:
        for angle in [0,90,180,270]:
            name='disc-'+('positive' if sign>0 else 'negative')+'-'+str(angle)
            screw=shape_by_id[name+'-screw'];disc_shape=shape_by_id['end-disc-'+('positive' if sign>0 else 'negative')]
            record=next(v for v in external if v['id']==name+'-screw')
            r=radial_max(screw);v=overlap(screw,tube)
            expected_length=12
            limit=d['radius']
            check(record['parameters']['length']==expected_length and record['parameters']['head']=='countersunk' and r<=limit+1e-5 and v<1e-5,name+': correct anchor length and recessed head',lengthMm=record['parameters']['length'],maximumRadiusMm=r,outerBearingRadiusMm=limit,tubeOverlapMm3=v)
            unit=radial_point(0,1,angle)
            tip=min(vertex.Point.dot(unit) for vertex in screw.Vertexes)
            nut=shape_by_id[name+'-nut'];nut_inner=min(vertex.Point.dot(unit) for vertex in nut.Vertexes);nut_outer=max(vertex.Point.dot(unit) for vertex in nut.Vertexes)
            axial_engagement=max(0,min(nut_outer,max(vertex.Point.dot(unit) for vertex in screw.Vertexes))-max(nut_inner,tip))
            check(abs(tip-(d['screwTop']-12))<1e-5 and axial_engagement>=2.4-1e-5,name+': declared tip datum and full captive-nut axial overlap retained',tipRadiusMm=tip,nutAxialOverlapMm=axial_engagement)

            axis_mid=radial_point(sign*d['endMountX'],(d['radius']+d['innerRadius'])/2,angle)
            check(not tube.isInside(axis_mid,1e-7,False), name+': actual radial tube bore is open')
            # Native ID contact patch at each bolt axis is tangent to the intact tube.
            surface=radial_point(sign*d['endMountX']+3,d['innerRadius'],angle)
            gap=disc_shape.distToShape(Part.Vertex(surface))[0]
            check(gap<1e-6,name+': true-ID bearing patch',gapMm=gap)
            radial_axes.append({'disc':sign,'angleDeg':angle,'maxHeadRadiusMm':r,'pipeGapMm':gap})
    report['radialAnchors']=radial_axes
    for identity in disc_ids:
        shape=shape_by_id[identity];x=shape.BoundBox.Center.x
        sign=1 if x>0 else -1
        check(all(shape.isInside(App.Vector(sign*d['endMountX']+dx,0,0),1e-7,False) for dx in [-7.9,-4,0,4,7.9]), identity+': solid central plate preserved between lower-edge cable grooves')
        check(shape.distToShape(shape_by_id[keeper_id])[0]<1e-6,identity+': positive shoulder contacts passive keeper tails')
    # Each actual guide channel is empty on-axis, with printed material beside it.
    jig_shapes=Part.makeCompound([shape for item,shape in installed if item['role']=='jig'])
    for x in audit['jigSpec']['guideXs']:
        for angle in audit['jigSpec']['guideAngles']:
            unit=radial_point(0,1,angle)
            probe=Part.makeCylinder(.05,12,radial_point(x,d['radius']-1,angle),unit)
            volume=overlap(jig_shapes,probe)
            beside=radial_point(x+2.5,audit['jigSpec']['boreRadius']+3,angle)
            check(volume<1e-6 and jig_shapes.isInside(beside,1e-7,False),'jig radial guide ' + str((x,angle)), boreOverlapMm3=volume)
    report['minimumStructuralDimensions']={'authoredMm':audit['cassetteAllowances'],'scope':'Named structural primitives and native section probes; no general stress or impact qualification. The cover peripheral wrap is the intentional1mm radial lip; the user-measured sealing walls are separately checked at1.6mm outside and1.0mm inside. Molded purchased enclosure and stock holder are outside the printed-wall requirement.'}
    # Exact targeted section probes cover the smallest load-bearing primitives, not merely metadata.
    structural=[]
    t=contact['tracks'];r=contact['keeperRails'];upper=shape_by_id[upper_id];lower=shape_by_id[lower_id]
    for y in t['centersY']:
        side=1 if y>0 else -1
        sections=line_intervals(upper,[10,y+side*2.5,t['flangeBottom']-1],[0,0,1],12)
        thickness=sections[0][1]-sections[0][0] if sections else 0
        check(abs(thickness-4)<1e-5,'main T key flange actual4mm atY'+str(y),thicknessMm=thickness)
        structural.append({'feature':'main T flange','yMm':y,'thicknessMm':thickness})
        sections=line_intervals(upper,[10,y-5,t['flangeTop']+1],[0,1,0],10)
        thickness=next((b-a for a,b in sections if a<=5<=b),0)
        check(thickness>=3-1e-5,'main T stem actual minimum3mm atY'+str(y),thicknessMm=thickness)
        structural.append({'feature':'main T stem','yMm':y,'thicknessMm':thickness})
    # The old 150-degree lower ray crosses the intended bottom-slot lip atY20.5,
    # so it measures a cropped hole edge rather than an intact radial wall.
    for identity,angle in [(upper_id,60),(lower_id,135)]:
        unit=radial_point(0,1,angle)
        sections=line_intervals(shape_by_id[identity],[0,0,0],[unit.x,unit.y,unit.z],d['cassetteRadius']+1)
        thickness=sections[-1][1]-sections[-1][0] if sections else 0
        check(abs(thickness-3)<1e-5,identity+': intact native cylindrical skin3mm',thicknessMm=thickness,probeAngleDegrees=angle)
        structural.append({'feature':identity+' intact radial skin','thicknessMm':thickness,'probeAngleDegrees':angle})
    for side in [-1,1]:
        y=side*(r['uprightOuterY']+1)
        sections=line_intervals(lower,[10,y,r['beamBottom']-4],[0,0,1],8)
        thickness=sections[0][1]-sections[0][0] if sections else 0
        check(abs(thickness-3)<1e-5,'keeper C guide retaining floor actual3mm side'+str(side),thicknessMm=thickness)
        structural.append({'feature':'keeper C guide retaining floor','side':side,'thicknessMm':thickness})
    for identity in disc_ids:
        side=1 if identity.endswith('positive') else -1;x=side*d['endMountX']+.5*side
        y=d['nutAF']/(3**.5)-.001;z=disc['nutOuterRadius']-.001
        norm=(y*y+z*z)**.5
        sections=line_intervals(shape_by_id[identity],[x,y,z],[0,y/norm,z/norm],12)
        thickness=sections[0][1]-sections[0][0] if sections else 0
        check(thickness>=6.4,identity+': full pocket-corner radial nut roof exceeds6.4mm',thicknessMm=thickness)
        structural.append({'feature':identity+' minimum nut roof near slot corner','thicknessMm':thickness,'innerAxialCheekLowerBoundMm':disc['minimumAxialNutWall'],'outerAxialSide':'Intentional open nut-loading slot.'})

    # Only the opposed outboard roofs remain: probe their actual three-millimeter stock.
    for y in t['centersY']:
        side=1 if y>0 else -1
        start=[10,y+side*2,t['flangeTop']-1]
        sections=line_intervals(lower,start,[0,0,1],5)
        roof=next((b-a for a,b in sections if a<=2<=b),0)
        check(abs(roof-3)<1e-5,'actual outboard female key roof3mm side'+str(side),thicknessMm=roof)
        structural.append({'feature':'opposed outboard female key roof','side':side,'thicknessMm':roof,'inboardRoof':'Intentionally open; no isolated0.8mm lip.'})
    report['minimumStructuralDimensions']['nativeSections']=structural
    # Validate the exact pipe/window-corner direction that is thinner than cardinal boss rays.
    cover_ranges=[]
    cover_cases=[{'tubeOD':d['od'],'windowClearance':fixture['parameters']['windowClearance'],'spec':lid_spec,'shape':cap}]+fixture['coverAuditCases']
    for case in cover_cases:
        s=case['spec'];shape=case.get('shape')
        if shape is None:shape,_=evaluate(case['python'],'cover-range-'+str(case['tubeOD'])+'-'+str(case['windowClearance']))
        solid_check(shape,'curved cover valid range '+str((case['tubeOD'],case['windowClearance'])))
        for seat in s['screwSeats']:
            x,y=seat['x'],seat['y'];z=s['screwUnderHeadZ']+.001
            cx=math.copysign(s['windowLength']/2,x);cy=math.copysign(math.sqrt(s['tubeRadius']**2-z*z),y)
            dx,dy=cx-x,cy-y;norm=math.hypot(dx,dy)
            sections=line_intervals(shape,[x,y,z],[dx/norm,dy/norm,0],12)
            thickness=sections[0][1]-sections[0][0] if sections else 0
            check(thickness>=3-1e-5,'cover lower bearing-core diagonal stock '+str((case['tubeOD'],case['windowClearance'],x,y)),thicknessMm=thickness)
            cover_ranges.append({'tubeODmm':case['tubeOD'],'windowAllowanceMm':case['windowClearance'],'seatXYmm':[x,y],'minimumCornerRayWallMm':thickness})
    report['coverBossRangeSections']=cover_ranges
    # Only cover material within the core radius can contact the internal printed module.
    inside_cap=cap.common(Part.makeCylinder(d['cassetteRadius'],lid_spec['coverLength']+4,App.Vector(-lid_spec['coverLength']/2-2,0,0),App.Vector(1,0,0)))
    cap_core=[]
    for identity in internal_ids:
        volume=overlap(inside_cap,shape_by_id[identity]);cap_core.append({'part':identity,'overlapMm3':volume})
        check(volume<1e-5,'curved cover clears '+identity,overlapMm3=volume)
    report['coverCoreFit']=cap_core
    # A cable corridor must be a finite connected free volume, not an unexplained pair of holes.
    routing=audit['cableRouting'];routing_spec=routing['spec'];routing_error_start=len(report['errors'])
    display_wire,_=evaluate(routing['wire'],'fused-routed-wire-inspection-reference')
    wire,wire_scope=evaluate(routing['wirePrimitiveEnvelope'],'complete-unfused-authored-wire-envelope')
    wire_primitives=wire_scope['components']
    body_entry_lead,_=evaluate(routing['bodyEntryLead'],'straight-attached-lead-for-body-loading')
    corridor,_=evaluate(routing['clearance'],'connected-cable-service-corridor')
    closing_cuts,_=evaluate(routing['closingCuts'],'fixed-lead-axial-closure-entries')
    all_cassette_cuts,_=evaluate(routing['allCassetteCuts'],'all-authored-cassette-wire-reliefs')
    disc_cuts,_=evaluate(routing['discCuts'],'full-depth-disc-U-grooves')
    solid_check(display_wire,'fused cable inspection reference is valid closed and single')
    solid_check(corridor,'service corridor is one valid connected solid')
    lead_nodes=routing['assemblySpec']['finalCenterline']
    wire_radius=routing['assemblySpec']['wireRadius']
    expected_wire_bounds={
        'min':[min(point[axis] for point in lead_nodes)-wire_radius for axis in range(3)],
        'max':[max(point[axis] for point in lead_nodes)+wire_radius for axis in range(3)],
    }
    actual_wire_bounds=bounds(wire)
    bound_delta=max(abs(actual_wire_bounds[side][axis]-expected_wire_bounds[side][axis])
                    for side in ['min','max'] for axis in range(3))
    display_bounds=bounds(display_wire)
    display_bound_delta=max(abs(display_bounds[side][axis]-expected_wire_bounds[side][axis])
                            for side in ['min','max'] for axis in range(3))
    check(bound_delta<1e-5 and display_bound_delta<1e-5,'exact primitive envelope and inspection lead retain complete authored bounds',
          actualBoundsMm=actual_wire_bounds,expectedBoundsMm=expected_wire_bounds,
          maximumBoundsDeltaMm=bound_delta,inspectionBoundsDeltaMm=display_bound_delta)
    bad_primitives=[index for index,shape in enumerate(wire_primitives)
                    if shape.isNull() or not shape.isValid() or not shape.isClosed() or len(shape.Solids)!=1 or shape.Volume<=0]
    complete_count=len(wire_primitives)==2*len(lead_nodes)-1 and len(wire.Solids)==len(wire_primitives)
    check(not bad_primitives and complete_count,
          'collision envelope retains every valid authored native sphere and cylinder without Boolean fusion',
          primitiveCount=len(wire_primitives),expectedCount=2*len(lead_nodes)-1,
          compoundSolidCount=len(wire.Solids),badPrimitiveIndices=bad_primitives)
    joins=[{'first':index,'second':index+1,'overlapMm3':overlap(first,last)}
           for index,(first,last) in enumerate(zip(wire_primitives,wire_primitives[1:]))]
    connected=complete_count and all(row['overlapMm3']>1e-5 for row in joins)
    check(connected,'ordered analytic sphere-cylinder graph is one physically connected lead envelope',
          graphEdges=len(joins),minimumAdjacentOverlapMm3=min(row['overlapMm3'] for row in joins))
    primitive_coverage=[]
    for index,primitive in enumerate(wire_primitives):
        difference=primitive.cut(display_wire)
        primitive_coverage.append({'primitive':index,'fusedReferenceBooleanResidualMm3':0. if difference.isNull() else difference.Volume})
    maximum_residual=max(row['fusedReferenceBooleanResidualMm3'] for row in primitive_coverage)
    report['cableNativeIntegrity']={'passed':display_wire.isValid() and display_wire.isClosed() and len(display_wire.Solids)==1 and bound_delta<1e-5 and display_bound_delta<1e-5 and not bad_primitives and connected,
                                   'collisionRepresentation':'Unfused compound of every exact serialized authored sphere and cylinder. All overlap tests query its members individually; compound distance is the minimum member distance.',
                                   'primitiveCount':len(wire_primitives),'logicalConnectedLead':connected,'adjacentPrimitiveGraph':joins,
                                   'expectedBoundsMm':expected_wire_bounds,'actualBoundsMm':actual_wire_bounds,
                                   'maximumBoundsDeltaMm':bound_delta,
                                   'fusedInspectionReference':{'valid':display_wire.isValid(),'closed':display_wire.isClosed(),'solids':len(display_wire.Solids),
                                        'faces':len(display_wire.Faces),'kernelMassIntegralMm3':display_wire.Volume,'boundsMm':display_bounds,
                                        'maximumPrimitiveBooleanResidualMm3':maximum_residual,'primitiveDifferenceDiagnostics':primitive_coverage,
                                        'usedForClearance':False,'exactUnionFidelityEstablished':False},
                                   'scope':'Clearance uses the complete original analytic primitive union, represented without fusion so no member can be silently discarded. Positive adjacent intersections prove its connected graph. The fused inspection solid is not the clearance authority: its near-coincident Boolean difference residual is retained without interpreting it as missing material or claiming an exact union mass.'}
    outside_volume=max(primitive.cut(corridor).Volume for primitive in wire_primitives)
    check(outside_volume<1e-5,'every actual rounded-wire primitive is contained in service corridor',maximumPrimitiveOutsideVolumeMm3=outside_volume)
    cable_fit=[]
    for identity,target in [(name,shape_by_id[name]) for name in internal_ids+[lid_id]]+ [('purchased-body',body_only),('purchased-holder',holder),('tube',tube),('standard-hardware',hardware)]:
        actual_volume=max(overlap(primitive,target) for primitive in wire_primitives);clearance_volume=overlap(corridor,target)
        check(actual_volume<1e-5,'every exact routed-wire primitive clears '+identity,maximumPrimitiveOverlapMm3=actual_volume)
        check(clearance_volume<1e-5,'complete service corridor clears '+identity,overlapMm3=clearance_volume)
        cable_fit.append({'part':identity,'wireMaximumPrimitiveOverlapMm3':actual_volume,'serviceOverlapMm3':clearance_volume})
    path_points=[point for path in routing_spec['centerlines'] for point in path['points']]
    check(all(corridor.isInside(App.Vector(*point),1e-7,True) for point in path_points),'all authored service-route junctions lie inside the same connected service volume',sampleCount=len(path_points))
    groove_probes=[]
    for identity in disc_ids:
        sign=1 if identity.endswith('positive') else -1
        for axis in routing_spec['exitAxes']:
            start=contact['coreHalfLength']-.1 if sign>0 else -d['endMountX']-disc['thickness']/2-.1
            length=d['endMountX']+disc['thickness']/2-contact['coreHalfLength']+.2
            probe=Part.makeCylinder(routing_spec['clearanceRadius'],length,App.Vector(start,axis['y'],axis['z']),App.Vector(1,0,0))
            volume=overlap(probe,shape_by_id[identity])
            check(volume<1e-5,identity+': cable groove passes complete plate and shoulder atY'+str(axis['y']),overlapMm3=volume,axialDepthMm=length-.2)
            mouth=App.Vector(sign*d['endMountX'],axis['y'],-38)
            beside=App.Vector(sign*d['endMountX'],axis['y']+4,-35)
            check(not shape_by_id[identity].isInside(mouth,1e-7,False) and shape_by_id[identity].isInside(beside,1e-7,False),identity+': edge groove is open downward with adjacent solid stock atY'+str(axis['y']))
            groove_probes.append({'disc':identity,'yMm':axis['y'],'axisZmm':axis['z'],'plateAndShoulderDepthMm':length-.2,'overlapMm3':volume})
    protected=[]
    skin_ties=[]
    for tie in contact['cableSkinTies']:
        minimum,maximum=tie['min'],tie['max']
        identity=next(name for name in lower_part_ids if name.endswith('negative' if maximum[0]<0 else 'positive'))
        max_y=max(abs(minimum[1]),abs(maximum[1]))
        safe_bottom=-math.sqrt(d['cassetteRadius']**2-max_y**2)+.01
        top=maximum[2]-.01
        stock=Part.makeBox(maximum[0]-minimum[0],maximum[1]-minimum[1],top-safe_bottom,
                           App.Vector(minimum[0],minimum[1],safe_bottom))
        missing=stock.cut(shape_by_id[identity]).Volume
        check(missing<1e-5 and maximum[0]-minimum[0]>=6-1e-5 and maximum[1]-minimum[1]>=6-1e-5,
              identity+': actual bottom-skin tie retains full6x6mm stock to the holder floor',
              missingStockMm3=missing,sectionMm=[maximum[0]-minimum[0],maximum[1]-minimum[1]],
              inspectedZRangeMm=[safe_bottom,top])
        skin_ties.append({'part':identity,'sectionMm':[maximum[0]-minimum[0],maximum[1]-minimum[1]],
                          'inspectedZRangeMm':[safe_bottom,top],'missingStockMm3':missing})
    keeper_tails=[]
    inner_tail_x=contact['holderPocket']['length']/2+3
    for face in contact['keeperClosureFaces']:
        sign=face['side']
        first_x=-contact['coreHalfLength'] if sign<0 else inner_tail_x
        last_x=-inner_tail_x if sign<0 else contact['coreHalfLength']
        stock=Part.makeBox(last_x-first_x,face['maxY']-face['minY'],face['maxZ']-face['minZ'],
                           App.Vector(first_x,face['minY'],face['minZ']))
        missing=stock.cut(shape_by_id[keeper_id]).Volume
        probe_x=sign*46
        probe_y=-32 if face['maxY']<0 else 32
        z_sections=line_intervals(shape_by_id[keeper_id],[probe_x,probe_y,face['minZ']-1],[0,0,1],face['maxZ']-face['minZ']+2)
        expected_height=face['maxZ']-face['minZ']
        actual_height=max((b-a for a,b in z_sections),default=0)
        check(missing<1e-5 and abs(actual_height-expected_height)<1e-5 and face['maxY']-face['minY']>=3-1e-5,
              'keeper end-tail neck retains its full3mm upright throughout '+str((sign,probe_y)),
              missingStockMm3=missing,widthMm=face['maxY']-face['minY'],
              expectedHeightMm=expected_height,actualHeightMm=actual_height,probeXYmm=[probe_x,probe_y])
        keeper_tails.append({'side':sign,'yRangeMm':[face['minY'],face['maxY']],
                             'xRangeMm':[first_x,last_x],'zRangeMm':[face['minZ'],face['maxZ']],
                             'missingStockMm3':missing,'probeXYmm':[probe_x,probe_y],
                             'actualHeightMm':actual_height})
    for pocket in contact['endKeyPockets']:
        minimum,maximum=pocket['min'],pocket['max']
        block=Part.makeBox(*[maximum[i]-minimum[i] for i in range(3)],App.Vector(*minimum))
        distance=all_cassette_cuts.distToShape(block)[0]
        check(distance>=3-1e-5,'all actual wire cuts retain3mm to torque-key pocket '+str(minimum),distanceMm=distance)
        protected.append({'feature':'torque-key-pocket','boundsMm':[minimum,maximum],'distanceMm':distance,'checkedReliefs':'All final-route, open trough and axial-closing cuts.'})
    for sign in [-1,1]:
        for pocket in disc['positivePockets']:
            minimum=[pocket['min'][0]+.3 if sign>0 else -d['endMountX']+disc['thickness']/2-.2,pocket['min'][1]+.3,pocket['min'][2]+.3]
            maximum=[d['endMountX']-disc['thickness']/2+.2 if sign>0 else -pocket['min'][0]-.3,pocket['max'][1]-.3,pocket['max'][2]-.3]
            block=Part.makeBox(*[maximum[i]-minimum[i] for i in range(3)],App.Vector(*minimum))
            distance=disc_cuts.distToShape(block)[0]
            check(distance>=3-1e-5,'disc cable mouth retains3mm to actual torque key '+str((sign,minimum[1])),distanceMm=distance)
            protected.append({'feature':'disc-torque-key','side':sign,'distanceMm':distance})
    nut_gaps=[]
    for record in audit['hardwareRecords']:
        if record['id'].endswith('-nut'):
            distance=disc_cuts.distToShape(shape_by_id[record['id']])[0]
            check(distance>=3-1e-5,'disc groove clears captured nut '+record['id'],distanceMm=distance)
            nut_gaps.append({'id':record['id'],'distanceMm':distance})
    # Witness the preserved ear-side web and the deliberately open outer service flute.
    portal=routing_spec['bodyPortal'];strip_start=[-d['boxLength']/2-d['fit']-1.7,portal['max'][1]-1,d['boxBottom']+1.8]
    sections=line_intervals(shape_by_id[upper_id],strip_start,[0,1,0],5)
    strip_width=next((b-a for a,b in sections if a<=2<=b),0)
    check(strip_width>=3-1e-5,'body cable portal leaves actual3mm ear-side web',widthMm=strip_width)
    flute_sections=line_intervals(shape_by_id[upper_id],[-20,routing_spec['highRun']['y'],routing_spec['highRun']['z']],[0,-1,0],15)
    check(not flute_sections,'high cable flute opens to outside without a thin retained roof',materialIntervalsMm=flute_sections)
    report['cableRouting']={'passed':len(report['errors'])==routing_error_start,'wireLogicalComponents':1 if connected else None,'wireCollisionPrimitiveCount':len(wire_primitives),'inspectionWireSolids':len(display_wire.Solids),'serviceConnectedSolids':len(corridor.Solids),'actualWireDiameterMm':2*routing_spec['wireRadius'],'nominalServiceDiameterMm':routing_spec['clearanceDiameter'],'maximumWirePrimitiveOutsideServiceMm3':outside_volume,'fitting':cable_fit,'discGrooves':groove_probes,'bottomSkinTies':skin_ties,'keeperEndTailStock':keeper_tails,'protectedWebs':protected,'capturedNutGaps':nut_gaps,'bodyPortalEarSideWebMm':strip_width,'routePointSamples':len(path_points),'scope':'One attached lead is checked as its complete, logically connected union of exact native primitives without a dense Boolean fuse. All upper/lower final, open trough and axial entry cuts preserve the torque-pocket gaps and full6x6mm bottom ties. The keeper uses only required wire reliefs and retains its full3mm upright end tails. Continuous closure is checked separately; material-specific cable bend, strain relief and impact qualification remain open.'}
    save_report()
    print(json.dumps({'stage':'continuous-cable-routing','passed':report['cableRouting']['passed'],'errors':report['errors']}),flush=True)
    save_report()
    print(json.dumps({'stage':'installed-static-clearances','errors':report['errors']}),flush=True)
    # Preserve the unmodified purchased holder and explicitly disclose its rigid-CAD fit limitation.
    holder_solids = holder.Solids
    housing_index = max(range(len(holder_solids)), key=lambda index: holder_solids[index].Volume)
    housing = holder_solids[housing_index]
    spring_contacts = Part.makeCompound([solid for index, solid in enumerate(holder_solids) if index != housing_index])
    floor = housing.common(Part.makeBox(160, 100, fixture['layout']['cellSupportZ'] - holder.BoundBox.ZMin + .01, App.Vector(-80, -50, holder.BoundBox.ZMin - .01)))
    report['stockHolderFit'] = {'confirmed': False, 'explanation': 'Source-dimension holder retains undeformed end-side plastic ribs, raised supports and spring contacts. Intersections below are measured source-fit limitations, not discarded or claimed zero; no physical rib flexibility has been verified.', 'cells': []}
    for item, cell in cells:
        plastic_overlap, spring_overlap = overlap(cell, housing), overlap(cell, spring_contacts)
        common = cell.common(housing)
        report['stockHolderFit']['cells'].append({'id': item['id'], 'undeformedPlasticOverlapMm3': plastic_overlap, 'springContactOverlapMm3': spring_overlap, 'plasticOverlapBoundsMm': None if plastic_overlap <= 1e-5 else bounds(common)})
        check(overlap(cell, floor) < 1e-5, item['id'] + ': support-derived seated pose does not cross rigid floor', overlapMm3=overlap(cell, floor))
        check(abs(cell.BoundBox.ZMin - fixture['layout']['cellSupportZ']) < 1e-5, item['id'] + ': cell is seated on measured source support pads', bottomMm=cell.BoundBox.ZMin)
        for printed, shape in installed:
            if printed['role'] == 'cassette':
                check(overlap(cell, shape) < 1e-5, item['id'] + ' / ' + printed['id'] + ': cell clears new rigid print', overlapMm3=overlap(cell, shape))
        check(overlap(cell, hardware) < 1e-5, item['id'] + ': no cell/fastener collision', overlapMm3=overlap(cell, hardware))
    report['connectorTubeOverlapMm3'] = overlap(occupied, tube)
    check(report['connectorTubeOverlapMm3'] < 1e-5, 'occupied connectors clear machined tube', overlapMm3=report['connectorTubeOverlapMm3'])
    save_report()
    print(json.dumps({'stage': 'installed-static-clearances', 'errors': report['errors'], 'stockHolderFit': report['stockHolderFit']}), flush=True)

    if report['errors']:
        raise RuntimeError('Static checks failed; resolve these before motion and cell-retention proof.')

    # Bench assembly must be possible before the entire module enters the bore.
    cell_ids=[item['id'] for item,_ in cells]
    keeper=shape_by_id[keeper_id]
    loaded_holder=Part.makeCompound([holder]+[cell for _,cell in cells])
    keeper_steps=[]
    for dz in [0,.2,1,3,8,20,50]:
        moving=keeper.copy();moving.translate(App.Vector(0,0,dz))
        keeper_steps.append({'offsetZMm':dz,'holderMm3':overlap(moving,holder),'cellsMm3':overlap(moving,Part.makeCompound([cell for _,cell in cells]))})
    check(all(max(row['holderMm3'],row['cellsMm3'])<1e-5 for row in keeper_steps),'passive keeper lowers vertically over loaded holder on bench',samples=keeper_steps)
    bundle=Part.makeCompound([keeper,loaded_holder])
    lower_load_steps=[]
    for identity in lower_part_ids:
        sign=1 if identity.endswith('positive') else -1
        for offset in [0,.5,1,2,5,10,15,20,30,40,60,80,120,180]:
            moving=shape_by_id[identity].copy();moving.translate(App.Vector(sign*offset,0,0))
            lower_load_steps.append({'part':identity,'outwardOffsetXmm':sign*offset,'bundleMm3':overlap(moving,bundle)})
    check(all(row['bundleMm3']<1e-5 for row in lower_load_steps),'lower halves slide around loaded holder/keeper fromopposite ends',samples=lower_load_steps)
    body_steps=[]
    for dz in [0,-.2,-1,-3,-8,-20,-40,-80]:
        moving=body_only.copy();moving.translate(App.Vector(0,0,dz))
        body_steps.append({'offsetZMm':dz,'upperMm3':overlap(moving,shape_by_id[upper_id])})
    check(all(row['upperMm3']<1e-5 for row in body_steps),'factory body enters open upper cage frombelow',samples=body_steps)
    body_loading_certificate=certify_translation_clearance(
        Part.makeCompound([body_only,body_entry_lead]),shape_by_id[upper_id],2,-80,0,
        required_gap=min(d['earClearance'],d['fit'])/2)
    check(body_loading_certificate['passed'],
          'body with already attached straight lead clears upper notch throughout continuous vertical loading',
          certificate=body_loading_certificate)
    save_report()
    print(json.dumps({'stage':'continuous-body-and-attached-lead-loading',
                      'passed':body_loading_certificate['passed'],
                      'evaluatedPoses':body_loading_certificate['evaluatedPoseCount'],
                      'failures':body_loading_certificate['failures']}),flush=True)
    upper_group=Part.makeCompound([body_only,shape_by_id[upper_id]])
    lower_ids=[lower_id,keeper_id,'holder-3s']+cell_ids
    lower_group=Part.makeCompound([shape_by_id[name] for name in lower_ids])
    lower_steps=[]
    for offset in [0,.5,1,2,5,10,15,20,40,80,120,180]:
        moving=lower_group.copy();moving.translate(App.Vector(offset,0,0))
        lower_steps.append({'offsetXmm':offset,'upperMm3':overlap(moving,upper_group)})
    check(all(row['upperMm3']<1e-5 for row in lower_steps),'loaded lower assembly slides into upper T guides onbench',samples=lower_steps)
    lower_closing_certificate=certify_translation_clearance(lower_group,wire,0,180,0,fixed_primitives=wire_primitives)
    check(lower_closing_certificate['passed'],
          'complete loaded lower group clears the already attached final lead throughout continuous axial closure',
          certificate=lower_closing_certificate)
    save_report()
    print(json.dumps({'stage':'continuous-loaded-lower-closure-over-fixed-lead',
                      'passed':lower_closing_certificate['passed'],
                      'evaluatedPoses':lower_closing_certificate['evaluatedPoseCount'],
                      'failures':lower_closing_certificate['failures']}),flush=True)
    assembled_core=Part.makeCompound([upper_group,lower_group])
    end_steps=[]
    end_lead_certificates=[]
    for identity in disc_ids:
        sign=1 if identity.endswith('positive') else -1
        nut_ids=[item['id'] for item in audit['hardwareRecords'] if item['id'].startswith('disc-'+('positive' if sign>0 else 'negative')) and item['id'].endswith('-nut')]
        group=Part.makeCompound([shape_by_id[identity]]+[shape_by_id[name] for name in nut_ids])
        certificate=certify_translation_clearance(group,wire,0,sign*120,0,fixed_primitives=wire_primitives)
        check(certificate['passed'],identity+': loaded disc clears the already attached routed lead throughout axial installation',
              certificate=certificate)
        end_lead_certificates.append({'disc':identity,**certificate})
        for offset in [0,.5,1,2,5,10,20,40,80,120]:
            moving=group.copy();moving.translate(App.Vector(sign*offset,0,0))
            end_steps.append({'disc':identity,'outwardOffsetMm':offset,'coreMm3':overlap(moving,assembled_core)})
    check(all(row['coreMm3']<1e-5 for row in end_steps),'both loaded solid discs approach their keyed shoulders fromopposite ends',samples=end_steps)
    nut_ids=[item['id'] for item in audit['hardwareRecords'] if item['id'].endswith('-nut')]
    module=Part.makeCompound([assembled_core,wire]+[shape_by_id[name] for name in disc_ids+nut_ids])
    module_steps=[]
    for offset in [0,40,120,240]:
        intersections=[]
        for index,solid in enumerate(module.Solids):
            moving=solid.copy();moving.translate(App.Vector(offset,0,0))
            volume=solid_intersection_volume(moving,stock)
            if volume>1e-5:intersections.append({'solidIndex':index,'materialOverlapMm3':volume})
        module_steps.append({'offsetXmm':offset,'intersectingSolids':intersections,
                             'maximumMaterialOverlapMm3':max((row['materialOverlapMm3'] for row in intersections),default=0.),
                             'checkedSolidCount':len(module.Solids)})
    check(all(not row['intersectingSolids'] for row in module_steps),'body/loadedcore/discs/captive nuts enter intact tube axially atfinalheight',
          samples=module_steps,maximumRadiusMm=radial_max(module),
          scope='Every original component/wire solid is checked individually. Intentional bore-contact faces have no material volume; an aggregate Boolean of overlapping reference primitives is not used.')
    report['attachedCableAssembly']={
        'passed':report['cableNativeIntegrity']['passed'] and body_loading_certificate['passed'] and lower_closing_certificate['passed'] and all(row['passed'] for row in end_lead_certificates),
        'bodyLoading':body_loading_certificate,'lowerClosure':lower_closing_certificate,'endDiscs':end_lead_certificates,
        'leadAssemblySpec':routing['assemblySpec'],'collisionRepresentation':'All exact authored native primitives in an unfused compound; intersections checked member by member, distance is the compound minimum. The fused inspection wire is not used.',
        'scope':'The lead is already connected during body loading. Its straight outward posture enters the upper-only notch, then the free tail is laid into the final route while lower parts and discs are still separate. The complete original analytic primitive union stays fixed throughout loaded-lower and disc translations. Free preclosure tail manipulation is not a cable-material deformation or minimum-bend simulation; no postclosure reconnection is assumed.'}
    report['assemblyPaths']={'keeperVertical':keeper_steps,'bundleIntoLower':lower_load_steps,'bodyIntoUpper':body_steps,'lowerIntoUpper':lower_steps,'endDiscs':end_steps,'completeModuleIntoTube':module_steps,'scope':'Native part-path samples plus continuous distance-bound certificates for body/attached lead loading and every subsequent closing part against the fixed routed lead. Circular envelope establishes axial bore invariance. Grandado has no lid or factory screws during module entry.'}
    save_report()
    print(json.dumps({'stage':'new-bench-and-tube-assembly-path','errors':report['errors']}),flush=True)
    if report['errors']:
        raise RuntimeError('Assembly-path checks failed; resolve these before retention proof.')
    restraint_ids=internal_ids+[item['id'] for item in audit['hardwareRecords']]+['grandado-body','tube']
    groups=[('grandado-body',['grandado-body']),('upper-cylinder',[upper_id]),*[(identity,[identity]) for identity in lower_part_ids],('passive-keeper',[keeper_id]),('holder',['holder-3s'])]+[(identity,[identity]) for identity in disc_ids]
    motion_results=[]
    for name,moving_ids in groups:
        moving=Part.makeCompound([shape_by_id[identity] for identity in moving_ids])
        blockers=[(identity,shape_by_id[identity]) for identity in restraint_ids if identity not in moving_ids]
        if name=='holder':blockers += [(keeper_id,keeper),(lower_id,shape_by_id[lower_id])]
        motions=[motion_contact(moving,blockers,axis,direction) for axis in range(3) for direction in [-1,1]]
        check(all(row['blocked'] for row in motions),name+': positive geometric stop inallsixdirections',motions=motions)
        motion_results.append({'group':name,'designTrackClearanceMm':contact['trackClearance'],'motions':motions})
        save_report()
        print(json.dumps({'retentionGroup':name,'motions':motions}),flush=True)

    # Isolate the actual authored opposed male keys, excluding body-wall or ear contacts as false restraints.
    key_regions=[]
    for y in contact['tracks']['centersY']:
        t=contact['tracks']
        key_regions.append(Part.makeBox(2*contact['coreHalfLength'],t['flangeWidth'],t['flangeTop']-t['flangeBottom'],App.Vector(-contact['coreHalfLength'],y-t['flangeWidth']/2,t['flangeBottom'])))
        key_regions.append(Part.makeBox(2*contact['coreHalfLength'],t['stemWidth'],t['stemHeight'],App.Vector(-contact['coreHalfLength'],y-t['stemWidth']/2,t['flangeTop'])))
    actual_keys=shape_by_id[upper_id].common(Part.makeCompound(key_regions))
    outer_blockers=[('actual-lower-opposed-guides',shape_by_id[lower_id])]
    key_moves=[motion_contact(actual_keys,outer_blockers,axis,direction) for axis in [1,2] for direction in [-1,1]]
    key_rolls=[tilt_contact(actual_keys,outer_blockers,0,direction,center=App.Vector(0,0,0)) for direction in [-1,1]]
    check(all(row['blocked'] for row in key_moves+key_rolls),'actual opposed outer captures stopY/Ztranslation androll without inboard lips',motions=key_moves,rolls=key_rolls)
    witness=actual_keys.copy();witness.translate(App.Vector(0,0,contact['trackClearance']+.001))
    bearing_volume=overlap(witness,shape_by_id[lower_id])
    check(bearing_volume>.1,'opposed outer roof has positive native bearing area',overlapAtOneMicronMm3=bearing_volume,approximateBearingAreaMm2=bearing_volume/.001)
    report['outerGuideCapture']={'motions':key_moves,'rolls':key_rolls,'approximateBearingAreaMm2':bearing_volume/.001,'scope':'Native authored male-key subset against both actual lower halves only; inboard lips, purchased body, ears and discs are excluded from these Y/Z/roll blockers. Axial withdrawal is independently stopped by both end discs.'}
    report['geometricRestraint']=motion_results
    angular_blockers=[(identity,shape_by_id[identity]) for identity in disc_ids+nut_ids+['tube']]
    angular_core=assembled_core
    angular=[tilt_contact(angular_core,angular_blockers,axis,direction,center=App.Vector(0,0,0)) for axis in range(3) for direction in [-1,1]]
    check(all(row['blocked'] for row in angular),'complete core has positive rotational stops aboutallthreeaxes',rotations=angular)
    report['angularRestraint']={'rotations':angular,'scope':'Geometric engagement only. Angular acceleration, fatigue, preload and physical impact strength are unqualified.'}
    save_report()
    # New rigid bars/end stops must retain cells without help from undeformed stock ribs/springs.
    cell_blockers = [(identity, shape_by_id[identity]) for identity in [lower_id, keeper_id]] + [('source-holder-rigid-supports-only', floor)]
    cell_results = []
    for item, cell in cells:
        motions = [motion_contact(cell, cell_blockers, axis, direction) for axis in range(3) for direction in [-1, 1]]
        tilts = [tilt_contact(cell, cell_blockers, axis, direction) for axis in [1, 2] for direction in [-1, 1]]
        check(all(row['blocked'] for row in motions + tilts), item['id'] + ': rigid keepers capture translation and transverse tilt', motions=motions, tilts=tilts)
        row = {'id': item['id'], 'diameterMm': 2 * contact['cellRadius'], 'motions': motions, 'tilts': tilts}
        cell_results.append(row)
        save_report()
        print(json.dumps({'cellRetention': row}), flush=True)
    pack = Part.makeCompound([cell for _, cell in cells])
    pack_motions = [motion_contact(pack, cell_blockers, axis, direction) for axis in range(3) for direction in [-1, 1]]
    check(all(row['blocked'] for row in pack_motions), 'all three cells remain captured as a pack', motions=pack_motions)
    report['cellRetention'] = {'stockRibsAndSpringsExcluded': True, 'measuredRigidSupportPadsIncluded': True, 'cells': cell_results, 'packMotions': pack_motions}
    # Diameter tolerance probe: same source can scaled radially only, reseated on the same floor.
    small_results = []
    scale = audit['cellNominalToleranceDiameter'] / (2 * contact['cellRadius'])
    for item, cell in cells:
        center = cell.BoundBox.Center
        matrix = App.Matrix()
        matrix.A11, matrix.A22, matrix.A33 = 1, scale, scale
        matrix.A24 = center.y * (1 - scale)
        matrix.A34 = center.z * (1 - scale) - contact['cellRadius'] * (1 - scale)
        smaller = cell.transformGeometry(matrix)
        motions = [motion_contact(smaller, cell_blockers, axis, direction) for axis in range(3) for direction in [-1, 1]]
        check(all(row['blocked'] for row in motions), item['id'] + ': 18.3mm tolerance envelope also captured', motions=motions)
        small_results.append({'id': item['id'], 'diameterMm': audit['cellNominalToleranceDiameter'], 'motions': motions})
    report['cellRetention']['smallerDiameterTolerance'] = small_results
    report['retentionScope'] = 'Geometric restraint of the authored rigid capture parts, including floor-seated source cell envelopes and an18.3mm radial tolerance probe. Source-holder rib flexibility, preload, material fatigue and impact rating remain unverified; original holder plastic/contact overlaps are explicitly reported above.'

    # Export exact installed assembly, retaining each printed and purchased item separately.
    created_document = App.newDocument('GrandadoTubeMountNativeAudit')
    assembly_shapes = []
    assembly_meshes = []
    def append_mesh(shape, label, color):
        vertices, faces = shape.tessellate(.1)
        assembly_meshes.append({'label': label, 'color': color, 'positions': [[point.x, point.y, point.z] for point in vertices], 'triangles': faces})
    for index, (item, shape) in enumerate(installed):
        if item['role'] != 'cassette':
            continue
        obj = created_document.addObject('Part::Feature', 'Printed' + str(index + 1))
        obj.Label, obj.Shape = item['label'], shape
        assembly_shapes.append(shape)
        append_mesh(shape, item['label'], item['color'])
    for index, (name, shape) in enumerate([('Reference pipe with window', tube), ('Grandado body with original inserts', body_only), ('Existing BeiLaMoo 3S holder', holder), ('Standard M3 mounting hardware', hardware), ('Connector occupied envelopes', occupied), ('Routed cable inspection reference', display_wire)]):
        obj = created_document.addObject('Part::Feature', 'Reference' + str(index + 1))
        obj.Label, obj.Shape = name, shape
        assembly_shapes.append(shape)
        append_mesh(shape, name, [0x667079, 0xe5e3dc, 0x29323a, 0xb6bcc3, 0xcf9552, 0xf59b38][index])
    for index, shape in enumerate(screws):
        obj=created_document.addObject('Part::Feature','SourceFactoryScrew'+str(index+1))
        obj.Label='Grandado source lid screw '+str(index+1)+' ·2mm tip trimmed'
        obj.Shape=shape
        assembly_shapes.append(shape)
        append_mesh(shape,obj.Label,0xb6bcc3)
    for index, (item, shape) in enumerate(cells):
        obj = created_document.addObject('Part::Feature', 'CellReference' + str(index + 1))
        obj.Label, obj.Shape = item['label'], shape
        assembly_shapes.append(shape)
        append_mesh(shape, item['label'], 0x52799c)
    (output / 'assembly-meshes.json').write_text(json.dumps({'unit': 'mm', 'meshes': assembly_meshes}, separators=(',', ':')) + '\n')
    created_document.recompute()
    created_document.saveAs(str(output / 'assembly.FCStd'))
    Part.makeCompound(assembly_shapes).exportStep(str(output / 'assembly.step'))
    report['assemblyArtifacts'] = [str(output / 'assembly.FCStd'), str(output / 'assembly.step')]
    report['completed'] = True
except Exception as error:
    report['errors'].append({'stage': 'assembly', 'error': str(error)})
finally:
    if created_document and created_document.Name in App.listDocuments():
        App.closeDocument(created_document.Name)
    if set(App.listDocuments()) != original_documents:
        report['errors'].append({'stage': 'documents', 'error': 'Existing FreeCAD document set changed'})
    if original_active:
        App.setActiveDocument(original_active)
    save_report()
print(json.dumps({'passed': report['passed'], 'parts': len(report['printedParts']), 'fittingKitParts': sum(row['variant'] == 'fitting-kit' for row in report['printedParts']), 'nominalJigParts': sum(row['variant'] == 'nominal-83x58-jig' for row in report['printedParts']), 'errors': len(report['errors']), 'report': str(output / 'native-report.json')}), flush=True)
sys.exit(not report['passed'])
