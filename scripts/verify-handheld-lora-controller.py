"""Audit physical handheld CAD, fit, printed solids and independent STEP/FCStd roundtrips.

Prepare cases with verify-handheld-lora-controller.ts. Run with FreeCAD's Python.
"""
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time
import traceback

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
from freecad_tree import component_leaves

output=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/handheld-lora-body-models')
cases=json.loads((output/'cases.json').read_text())
if os.environ.get('HANDHELD_CASE_INDEX') is not None:
    cases=[cases[int(os.environ['HANDHELD_CASE_INDEX'])]]
started=time.perf_counter()
report={'checkedAt':datetime.now(timezone.utc).isoformat(),'units':'mm','freecad':'.'.join(App.Version()[:3]),'validatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'cases':[]}
base_common_cache=None
distance_statistics=None


def scalar_distance(first,second,margin=1.0):
    """Exact distance with a bounded local search and unchanged full fallback.

    A point outside a query bbox expanded by M, and every artificial crop
    face, is at least M from the query. Therefore a local minimum strictly
    below M is also the full-shape minimum. Optimal bounds use analytic
    trimmed surfaces with shape tolerances, not tessellated approximations.
    """
    if not math.isfinite(margin) or margin<=0:
        raise ValueError('Distance localization margin must be finite and positive')
    material,query=(first,second) if len(first.Faces)>=len(second.Faces) else (second,first)
    try:
        bounds=query.optimalBoundingBox(False,True)
        values=[bounds.XMin,bounds.YMin,bounds.ZMin,bounds.XMax,bounds.YMax,bounds.ZMax]
        if not all(math.isfinite(value) for value in values):
            raise ValueError('Nonfinite query bounds')
        region=Part.makeBox(bounds.XLength+2*margin,bounds.YLength+2*margin,bounds.ZLength+2*margin,App.Vector(bounds.XMin-margin,bounds.YMin-margin,bounds.ZMin-margin))
        subset=material.common(region)
        if not subset.isNull() and subset.Solids and subset.isValid() and subset.isClosed() and all(solid.Volume>0 for solid in subset.Solids):
            if len(subset.Faces)>500:
                # Retain the exact original faces: large equally closest
                # planar patches make distToShape enumerate huge support
                # lists. Intersection covers solid containment; otherwise
                # the minimum over boundary-face groups is the same scalar.
                if not query.Solids or not query.isValid() or not query.isClosed() or not all(solid.Volume>0 for solid in query.Solids):
                    raise ValueError('Boundary distance requires closed solid queries')
                contained=False
                for source,target in [(subset,query),(query,subset)]:
                    for solid in source.Solids:
                        if not solid.Vertexes:
                            raise ValueError('Containment classification has no original vertex')
                        point=solid.Vertexes[0].Point
                        if any(other.isInside(point,0.0,True) for other in target.Solids):
                            contained=True
                shared=subset.common(query)
                if not shared.isNull() and not shared.isValid():
                    raise ValueError('Invalid bounded solid intersection')
                if contained or (not shared.isNull() and (shared.Solids or shared.Faces or shared.Edges or shared.Vertexes)):
                    distance=0.0
                else:
                    faces=subset.Faces
                    distances=[]
                    for index in range(0,len(faces),50):
                        chunk_distance=Part.makeCompound(faces[index:index+50]).distToShape(query)[0]
                        if not math.isfinite(chunk_distance) or chunk_distance<0:
                            raise ValueError('Invalid original-face chunk distance')
                        distances.append(chunk_distance)
                    distance=min(distances)
                if distance_statistics is not None:
                    distance_statistics['originalFaceChunkQueries']=distance_statistics.get('originalFaceChunkQueries',0)+1
            else:
                distance=subset.distToShape(query)[0]
            if math.isfinite(distance) and 0<=distance<margin-1e-6:
                if distance_statistics is not None:
                    distance_statistics['localizedExactQueries']+=1
                return distance
    except Exception:
        # This optimization must never alter an unresolved fit assertion.
        pass
    if distance_statistics is not None:
        distance_statistics['fullFallbackQueries']+=1
    return first.distToShape(second)[0]


def common_with_base(first,second):
    """Use an exact subset only when the complete query is strictly inside it.

    For Q contained in C, (base intersect C) intersect Q = base intersect Q.
    All full geometry, guard probes, validity and export checks stay unchanged.
    """
    if base_common_cache is not None:
        for material,query in [(first,second),(second,first)]:
            if not material.isSame(base_common_cache['full']):
                continue
            bounds=query.optimalBoundingBox(False,True)
            if bounds.XMin>-19.999 and bounds.XMax<19.999 and bounds.YMin>-69.999 and bounds.YMax<69.999 and bounds.ZMin>-4.999 and bounds.ZMax<39.999:
                base_common_cache['subsetQueries']+=1
                return base_common_cache['subset'].common(query)
            base_common_cache['fullQueries']+=1
    return first.common(second)


def intentional_lanyard_cutout(metadata):
    """Exact authored U-shaped cutter; no tolerance or clearance is added."""
    assert metadata['profile']=='compact-u-teardrop' and metadata['roofAngleDegrees']==45,'Unexpected lanyard bore profile'
    stations=metadata['boreStations']
    assert len(stations)>=7,'The U passage has insufficient authored stations'
    rings=[]
    for station in stations:
        center,direction,r=station['center'],station['direction'],station['radius']
        assert abs(sum(value*value for value in direction)-1)<1e-9 and abs(direction[2])<1e-9,'Invalid U-passage station frame'
        assert r>=1.83-1e-9,'The authored teardrop cannot contain the required 3.6 mm cord'
        profile=[(r*math.cos(math.radians(45-270*i/36)),r*math.sin(math.radians(45-270*i/36))) for i in range(37)]+[(0,r*math.sqrt(2))]
        rings.append([[center[0]+direction[1]*radial,center[1]-direction[0]*radial,center[2]+height] for radial,height in profile])
    points=[point for ring in rings for point in ring]
    stride=len(rings[0])
    faces=[]
    for layer in range(len(rings)-1):
        for i in range(stride):
            a=layer*stride+i
            b=layer*stride+(i+1)%stride
            faces.extend([(a,b,b+stride),(a,b+stride,a+stride)])
    for i in range(1,stride-1):
        last=len(points)-stride
        faces.extend([(0,i+1,i),(last,last+i,last+i+1)])
    vectors=[App.Vector(*point) for point in points]
    if sum(vectors[a].dot(vectors[b].cross(vectors[c])) for a,b,c in faces)<0:
        faces=[tuple(reversed(face)) for face in faces]
    result=Part.makeSolid(Part.makeShell([Part.Face(Part.makePolygon([vectors[i] for i in (*face,face[0])])) for face in faces]))
    assert result.isValid() and result.isClosed() and result.Volume>0,'Invalid intentional lanyard cutter'
    return result


def inactive_guard_body_envelope():
    """Expected body footprint, excluding only its authored inactive blend.

    caseOutline's unchanged right side consists of these two 16-segment arcs
    and the intervening straight edge. Above the active collar and cheek,
    smoothMaximum(wall-.65, wall-.65) adds 3.5/4, leaving exactly .225 mm
    of uniform body continuation. This envelope is independent of the measured
    guard: an incorrectly extended collar cannot enlarge its own exclusion.
    """
    offset=3.5/4-.65
    lower=[App.Vector(9+12*math.cos(-math.pi/2+math.pi*i/32)+offset,
                      -41+12*math.sin(-math.pi/2+math.pi*i/32),-10) for i in range(17)]
    upper=[App.Vector(7+14*math.cos(math.pi*i/32)+offset,
                      39+14*math.sin(math.pi*i/32),-10) for i in range(1,17)]
    points=[App.Vector(-40,-53,-10),*lower,App.Vector(21+offset,39,-10),*upper,App.Vector(-40,53,-10)]
    return Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,60))


def collar_seam_witness(upper,seam,button_id):
    assert upper.Solids,('Fairing has no material above the purchased bezel',button_id)
    body_envelope=inactive_guard_body_envelope()
    collar=upper.cut(body_envelope)
    assert collar.Solids,('Fairing has no active collar beyond the authored body blend',button_id)
    valid(collar,'Active bezel collar')
    assert collar.optimalBoundingBox(False,False).ZMax<=seam-.15,('Fairing reaches the lid seam',button_id,collar.optimalBoundingBox(False,False).ZMax)
    return {'topBelowSeamMm':seam-collar.optimalBoundingBox(False,False).ZMax,
            'inactiveBodyBlendOffsetMm':3.5/4-.65,
            'bodyBlendExcludedMm3':upper.common(body_envelope).Volume,
            'actualCollarVolumeMm3':collar.Volume,
            'bodyContinuationTopBelowSeamMm':seam-upper.optimalBoundingBox(False,False).ZMax}


def valid(shape, context, expected_solids=None):
    assert not shape.isNull() and shape.isValid() and shape.isClosed(), (context,'invalid or open native shape')
    assert shape.Solids and all(s.isValid() and s.isClosed() and s.Volume>0 for s in shape.Solids), (context,'invalid physical solid')
    if expected_solids is not None:
        assert len(shape.Solids)==expected_solids,(context,'solid count',len(shape.Solids),expected_solids)


def bounded_common(first,second):
    """Exact solid intersection localized to its conservative overlap bounds.

    Analytic bounds including shape tolerances contain the complete originals,
    independently of any cached tessellation. Clipping both operands to their
    overlap preserves the intersection. The unchanged 0.001 mm expansion
    avoids creating a crop face coincident with the bounds of a touching part.
    Invalid or unresolved crops always use the original complete intersection.
    """
    if len(first.Faces)<500 and len(second.Faces)<500:
        return first.common(second)
    try:
        a,b=first.optimalBoundingBox(False,True),second.optimalBoundingBox(False,True)
        low=[max(a.XMin,b.XMin)-.001,max(a.YMin,b.YMin)-.001,max(a.ZMin,b.ZMin)-.001]
        high=[min(a.XMax,b.XMax)+.001,min(a.YMax,b.YMax)+.001,min(a.ZMax,b.ZMax)+.001]
        if not all(math.isfinite(value) for value in low+high) or not all(hi>lo for lo,hi in zip(low,high)):
            raise ValueError('Unresolved intersection crop bounds')
        region=Part.makeBox(*[hi-lo for lo,hi in zip(low,high)],App.Vector(*low))
        operands=[]
        for original in [first,second]:
            clipped=original.common(region)
            if clipped.isNull():
                return Part.Shape()
            if not clipped.Vertexes and clipped.isValid() and clipped.Volume==0:
                return Part.Shape()
            valid(clipped,'Bounded physical-intersection operand')
            operands.append(clipped)
        result=operands[0].common(operands[1])
        if not result.isNull():
            if not result.isValid() or not math.isfinite(result.Volume) or result.Volume<0:
                raise ValueError('Invalid bounded intersection')
            if result.Solids:
                valid(result,'Bounded physical intersection')
        return result
    except Exception:
        return first.common(second)


def intersections(children):
    result=[]
    for i,first in enumerate(children):
        for second in children[i+1:]:
            if not first.Shape.optimalBoundingBox(False,True).intersect(second.Shape.optimalBoundingBox(False,True)):
                continue
            common=bounded_common(first.Shape,second.Shape)
            volume=0 if common.isNull() else common.Volume
            if volume>max(1e-5,min(first.Shape.Volume,second.Shape.Volume)*1e-6):
                result.append({'first':first.Label,'second':second.Label,'volumeMm3':volume,
                               'bounds':[common.optimalBoundingBox(False,False).XMin,common.optimalBoundingBox(False,False).YMin,common.optimalBoundingBox(False,False).ZMin,common.optimalBoundingBox(False,False).XMax,common.optimalBoundingBox(False,False).YMax,common.optimalBoundingBox(False,False).ZMax]})
    return result


def missing_material(witness,material):
    """Positive coverage avoids OCC's Null-shape failure for an empty cut result."""
    common=common_with_base(witness,material)
    return max(0,witness.Volume-(0 if common.isNull() else common.Volume))


def authored_native_fixture(code,label):
    def transform(shape,translation,rotation):
        for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):
            if angle:
                shape.rotate(App.Vector(),axis,angle)
        shape.translate(App.Vector(*translation))
        return shape
    namespace={'App':App,'Part':Part,'math':math,'_pl_transform':transform}
    exec(code,namespace)
    result=namespace['shape']
    valid(result,label,1)
    return result


def rounded_floor_exterior_checks(base,body_model):
    radius,bottom=(4,0) if body_model=='original' else (5,-2.2)
    flat=[]
    for x,y in [(-8,0),(8,0),(0,-30),(0,30)]:
        inside=Part.makeBox(.08,.08,.08,App.Vector(x-.04,y-.04,bottom+.02))
        below=Part.makeBox(.08,.08,.08,App.Vector(x-.04,y-.04,bottom-.10))
        missing=missing_material(inside,base)
        obstruction=common_with_base(below,base).Volume
        assert missing<1e-6 and obstruction<1e-6,('The rounded base lost its true planar sole height',body_model,x,y,missing,obstruction)
        flat.append({'xy':[x,y],'soleZ':bottom,'insideMissingMm3':missing,'belowSoleObstructionMm3':obstruction})
    curve=[]
    # The positive-X straight branch is unchanged by the guard below Z=3.8.
    # Finite spheres on both sides reject the former bevel or a filled roll.
    for degrees in [15,30,45,60,75]:
        angle=math.radians(degrees)
        point=App.Vector(21-radius*(1-math.sin(angle)),0,bottom+radius*(1-math.cos(angle)))
        outward=App.Vector(math.sin(angle),0,-math.cos(angle))
        inside=Part.makeSphere(.03,point-outward*.1)
        outside=Part.makeSphere(.03,point+outward*.1)
        missing=missing_material(inside,base)
        obstruction=common_with_base(outside,base).Volume
        assert missing<1e-6 and obstruction<1e-6,('The lower exterior does not follow the required quarter-round',body_model,degrees,missing,obstruction)
        curve.append({'angleDegrees':degrees,'nominalSurfacePointMm':[point.x,point.y,point.z],'insideMissingMm3':missing,'outsideObstructionMm3':obstruction})
    return {'radiusMm':radius,'soleZ':bottom,'flatSoleWitnesses':flat,'quarterRoundWitnesses':curve}


def nut_exterior_checks(case,children,outer):
    parts={expected['id']:child.Shape for child,expected in zip(children,case['components'])}
    specs={expected['id']:expected for expected in case['components']}
    # Independent complete-pocket geometry and exterior wall stations. The
    # front pair loads along X, avoiding the long USB slider-loading channel.
    walls=[
        ('lid-nut-0',[-20.18572320181561,27.628395580807187],[.9971940757689576,.07485970378844821]),
        ('lid-nut-1',[21,30.2413030788],[-1,0]),
        ('lid-nut-2',[-15.7098453118,-46.8564905594],[.8793924390,.4760976142]),
        ('lid-nut-3',[17.2426540391,-49.7051859726],[-.6715589548,.7409511254]),
        ('battery-nut-0',[-20.3771691048,30.1786156669],[.9971940758,.0748597038]),
        ('battery-nut-1',[21,33.2413030788],[-1,0]),
    ]
    assert len(outer.Shells)==1,'Conservative exterior must have one closed boundary'
    rows=[]
    for id,q,n in walls:
        nut=parts[id]
        bounds=nut.optimalBoundingBox(False,False)
        x,y=(bounds.XMin+bounds.XMax)/2,(bounds.YMin+bounds.YMax)/2
        # Probe the current installed nut plane, including a raised battery
        # carrier, instead of a stale absolute height from a previous revision.
        z=(bounds.ZMin+bounds.ZMax)/2
        outside=max(0,nut.Volume-outer.common(nut).Volume)
        assert outside<1e-5,('Actual canonical M2 nut protrudes through the closed exterior',id,outside)
        radius=specs[id]['parameters']['acrossFlats']/math.sqrt(3)
        bound=Part.makeCylinder(radius,bounds.ZLength,App.Vector(x,y,bounds.ZMin))
        missing=max(0,nut.Volume-bound.common(nut).Volume)
        assert missing<1e-5,('Conservative M2 envelope does not contain the complete actual metal nut',id,missing)
        expanded=Part.makeCylinder(radius+1.2,bounds.ZLength+2.4,App.Vector(x,y,bounds.ZMin-1.2))
        reserve_outside=max(0,expanded.Volume-outer.common(expanded).Volume)
        assert reserve_outside<1e-5,('Actual M2 nut has less than a 1.2 mm conservative exterior reserve',id,reserve_outside)
        is_lid=id.startswith('lid-')
        index=int(id.rsplit('-',1)[1])
        axis='x' if not is_lid or index<2 else 'y'
        mount=case['layout']['lidMount' if is_lid else 'batteryMount']
        bottom=mount['nutPocketBottom']
        af=4.3 if is_lid else mount['nutPocketAcrossFlats']
        height=2 if is_lid else mount['nutPocketHeight']
        vertices=[App.Vector(x+af/math.sqrt(3)*math.cos(math.radians(30+60*i)),y+af/math.sqrt(3)*math.sin(math.radians(30+60*i)),bottom) for i in range(6)]
        hex_pocket=Part.Face(Part.makePolygon(vertices+[vertices[0]])).extrude(App.Vector(0,0,height))
        if axis=='x':
            width=2*af/math.sqrt(3)
            channel=Part.makeBox(8,width,height,App.Vector(x-8 if x>0 else x,y-width/2,bottom))
            if not is_lid:
                # Independent battery-tower mouth: a shallow widening keeps
                # the real nut clear without splitting its two broad cheeks.
                sign=math.copysign(1,x)
                center=abs(x)
                mouth=center-5
                inner=mouth+1
                points=[(center-8,y-2.8),(mouth,y-2.8),(inner,y-width/2),
                        (center+.05,y-width/2),(center+.05,y+width/2),
                        (inner,y+width/2),(mouth,y+2.8),(center-8,y+2.8)]
                polygon=[App.Vector(sign*u,v,bottom) for u,v in points]
                channel=Part.Face(Part.makePolygon(polygon+[polygon[0]])).extrude(App.Vector(0,0,height))
            expected_direction=[math.copysign(1,x),0,0]
        else:
            channel=Part.makeBox(af,8,height,App.Vector(x-af/2,y-8 if y>0 else y,bottom))
            expected_direction=[0,math.copysign(1,y),0]
        site=case['reinforcement']['lidPosts' if is_lid else 'batteryPosts'][index]
        assert site['nutLoadingDirection']==expected_direction,('Captive nut metadata does not describe the required cavityward loading axis',id,site['nutLoadingDirection'],expected_direction)
        pocket=hex_pocket.fuse(channel).removeSplitter()
        valid(pocket,'Independent complete captive-nut pocket '+id,1)
        pocket_obstruction=common_with_base(pocket,parts['base']).Volume
        assert pocket_obstruction<1e-5,('The complete hex and corner-clear loading corridor is not empty',id,pocket_obstruction)
        nut_outside_pocket=max(0,nut.Volume-pocket.common(nut).Volume)
        assert nut_outside_pocket<1e-5,('The actual canonical nut does not fit its complete intended pocket',id,nut_outside_pocket)
        exterior_distance,nearest,_=pocket.distToShape(outer.Shells[0])
        assert exterior_distance>=1.2,('The complete pocket or loading corridor has insufficient conservative exterior reserve',id,exterior_distance)
        closed_q=list(q)
        surface_inset=0
        if id=='lid-nut-0' and case['parameters']['bodyModel']=='web-grip':
            # This finished wall is the actual slot plane W=-0.6, whose
            # authored 4.294-degree frame differs slightly from caseOutline.
            q=[-20.188451294703093,27.628165189771643]
            n=[.9971929798113345,.07487430143240996]
            surface_inset=.6
        inward=App.Vector(n[0],n[1],0)
        inward.normalize()
        surface=[q[0]+surface_inset*inward.x,q[1]+surface_inset*inward.y]
        wall=Part.makeCylinder(.1,1,App.Vector(surface[0]+.1*inward.x,surface[1]+.1*inward.y,z),inward)
        wall_missing=missing_material(wall,parts['base'])
        assert wall_missing<1e-5,('Complete nut pocket lacks its finite external wall ligament',id,wall_missing)
        rows.append({'id':id,'actualMetalOutsideMm3':outside,'conservativeExteriorReserveMm':1.2,'expandedEnvelopeOutsideMm3':reserve_outside,'completePocket':{'loadingAxis':axis,'acrossFlatsMm':af,'heightMm':height,'loadingLengthMm':8,'loadingWidthMm':2*af/math.sqrt(3) if axis=='x' else af,'baseObstructionMm3':pocket_obstruction,'actualNutOutsideMm3':nut_outside_pocket,'nearestClosedExteriorGapMm':exterior_distance,'nearestClosedExteriorPointsMm':[[[p.x,p.y,p.z] for p in pair] for pair in nearest[:3]]},'externalWallWitness':{'radiusMm':.1,'lengthMm':1,'closedExteriorBoundaryPointMm':closed_q,'finishedSurfacePointMm':surface,'intentionalSliderRecessMm':surface_inset,'startInsideFinishedSurfaceMm':.1,'inwardDirectionXY':n,'heightZ':z,'missingMaterialMm3':wall_missing}})
    return rows


def switch_retaining_nut_checks(case,children,outer):
    rows=[]
    for child,spec in zip(children,case['components']):
        if spec['libraryId']!='panel-switch' or spec['parameters']['model']!='daier-ds-225':
            continue
        pose=spec['placement']
        rx,ry,rz=pose['rotation']
        rotation=App.Rotation(App.Vector(0,0,1),rz).multiply(App.Rotation(App.Vector(0,1,0),ry)).multiply(App.Rotation(App.Vector(1,0,0),rx))
        frame=App.Placement(App.Vector(*pose['translation']),rotation)
        local=child.Shape.copy()
        local.transformShape(frame.inverse().toMatrix())
        panel=spec['parameters']['panelThickness']
        candidates=[solid for solid in local.Solids if abs(solid.optimalBoundingBox(False,False).ZMin+panel+5)<1e-5 and abs(solid.optimalBoundingBox(False,False).ZMax+panel+2)<1e-5 and solid.optimalBoundingBox(False,False).XLength>13.4 and solid.optimalBoundingBox(False,False).YLength>13.4]
        assert len(candidates)==1,('Cannot independently identify the complete canonical DS-225 retaining nut',spec['id'],len(candidates))
        nut=candidates[0].copy()
        nut.transformShape(frame.toMatrix())
        outside=max(0,nut.Volume-outer.common(nut).Volume)
        assert outside<1e-5,('The complete canonical DS-225 retaining nut protrudes through the closed body exterior',spec['id'],outside)
        rows.append({'switchId':spec['id'],'modeledNutThicknessMm':3,'localAxialBoundsMm':[-panel-5,-panel-2],'completeModeledMetalOutsideMm3':outside})
    assert len(rows)==2,'The enclosure lost one of its two canonical DS-225 retaining-nut checks'
    return rows


def screw_mount_checks(case,children,references=None):
    """Both extreme lengths use the actual canonical head and full native hosts.

    A default-length reconstruction must first reproduce the supplied screw.
    No hole radius, nut engagement or floor-cap threshold follows descriptive
    acceptance metadata: these remain independent M2 fit requirements.
    """
    parts={expected['id']:child.Shape for child,expected in zip(children,case['components'])}
    specs={expected['id']:expected for expected in case['components']}
    def overlap_volume(first,second):
        intersection=bounded_common(first,second)
        return 0 if intersection.isNull() else intersection.Volume
    base=parts['base']
    rows=[]
    for prefix,mount_key,limits,seat_id in [('lid','lidMount',(6,12),'lid'),('battery','batteryMount',(6,10),'battery-retainer')]:
        mount=case['layout'][mount_key]
        lengths=sorted(mount['supportedScrewLengths'])
        assert lengths[0]==limits[0] and lengths[-1]==limits[1],('Supported screw range changed without an independent fit requirement',prefix,lengths)
        assert abs(mount['boreDiameter']-2.2)<1e-9 and mount['boreBottom']>=3,'M2 blind wells lost their nominal diameter or cap datum'
        for id in [id for id in parts if id.startswith(prefix+'-screw-')]:
            actual=parts[id]
            parameters=specs[id]['parameters']
            assert parameters['diameter']==2 and parameters['head']=='socket-cap' and parameters['tip']=='flat' and parameters['threadSpan']=='full','Unsupported canonical M2 screw form'
            seat=mount['screwSeat']
            # Display meshing can make BoundBox use asymmetric inscribed
            # triangle extrema. The canonical bolt axis is its declared pose,
            # independently checked against the exact native cylinder surface.
            pose=specs[id]['placement']
            assert pose['rotation']==[0,0,0],('Unsupported canonical M2 screw orientation',id,pose['rotation'])
            x,y=pose['translation'][:2]
            bounds=actual.optimalBoundingBox(False,False)
            axes=[face.Surface for face in actual.Faces if isinstance(face.Surface,Part.Cylinder) and abs(face.Surface.Radius-1)<1e-9]
            assert axes and all(abs(axis.Center.x-x)<1e-9 and abs(axis.Center.y-y)<1e-9 and abs(abs(axis.Axis.z)-1)<1e-9 for axis in axes),('Canonical M2 shaft axis differs from its declared assembly pose',id)
            assert abs(bounds.ZMax-seat-2)<1e-5 and abs(bounds.ZMin-(seat-parameters['length']))<1e-5,('Screw does not sit at its actual mounting plane',id)
            head=actual.common(Part.makeBox(10,10,3,App.Vector(x-5,y-5,seat)))
            valid(head,'Actual M2 head '+id,1)
            def at_length(length):
                shaft=Part.makeCylinder(1,length,App.Vector(x,y,seat-length))
                shape=head.fuse(shaft)
                valid(shape,'M2 extreme-length screw '+id,1)
                return shape
            reconstructed=at_length(parameters['length'])
            common=overlap_volume(reconstructed,actual)
            assert max(actual.Volume-common,reconstructed.Volume-common)<1e-5,('Canonical screw reconstruction changed head, shaft or tip geometry',id)
            nut=parts[id.replace('-screw-','-nut-')]
            nut_bounds=nut.optimalBoundingBox(False,False)
            assert abs((nut_bounds.XMin+nut_bounds.XMax)/2-x)<1e-5 and abs((nut_bounds.YMin+nut_bounds.YMax)/2-y)<1e-5,('M2 nut is not coaxial with its screw',id)
            assert 1.59<=nut_bounds.ZLength<=1.61,('M2 nut axial height differs from the required 1.6 mm',id,nut_bounds.ZLength)
            cap=Part.makeCylinder(1.1,3,App.Vector(x,y,mount['boreBottom']-3))
            cap_missing=missing_material(cap,base)
            assert cap_missing<1e-5,('Blind screw well lacks a complete 3 mm cap across its full 2.2 mm bore',id,cap_missing)
            seat_shape=parts[seat_id]
            forced=head.copy()
            forced.translate(App.Vector(0,0,-.02))
            bearing=overlap_volume(forced,seat_shape)/.02
            assert bearing>=6.5,('M2 head lacks a substantial native annular bearing seat',id,bearing)
            variants=[]
            targets={key:shape for key,shape in parts.items() if key!=id}
            for length in limits:
                shape=at_length(length)
                tip=seat-length
                engagement=min(seat,nut_bounds.ZMax)-max(tip,nut_bounds.ZMin)
                assert engagement>=1.59,('Extreme screw length does not span the complete M2 nut',id,length,engagement)
                assert tip-mount['boreBottom']>=1-1e-5,('Longest screw has insufficient clearance from its blind-well floor',id,length,tip-mount['boreBottom'])
                hits={key:overlap_volume(shape,target) if shape.optimalBoundingBox(False,True).intersect(target.optimalBoundingBox(False,True)) else 0 for key,target in targets.items()}
                assert max(hits.values())<1e-5,('Extreme M2 screw length collides with the actual full assembly hosts or nut',id,length,hits)
                reference_hits={key:overlap_volume(shape,target) if shape.optimalBoundingBox(False,True).intersect(target.optimalBoundingBox(False,True)) else 0 for key,target in (references or {}).items()}
                assert not reference_hits or max(reference_hits.values())<1e-5,('Extreme M2 screw length obstructs a declared battery or antenna packaging reference',id,length,reference_hits)
                variants.append({'lengthMm':length,'tipZ':tip,'fullNutSpanMm':engagement,'blindFloorClearanceMm':tip-mount['boreBottom'],'nativeObstructionsMm3':hits,'referenceObstructionsMm3':reference_hits})
            rows.append({'id':id,'supportedLengthsMm':lengths,'canonicalAxisXYMm':[x,y],'axisVerifiedByNativeCylinder':True,'actualHeadBearingAreaMm2':bearing,'closedCapDiameterMm':2.2,'closedCapHeightMm':3,'closedCapMissingMm3':cap_missing,'extremeLengths':variants})
    return rows


def cross(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def hull(points):
    points=sorted(set(points))
    chains=[]
    for ordered in [points,list(reversed(points))]:
        chain=[]
        for point in ordered:
            while len(chain)>1 and cross(chain[-2],chain[-1],point)<=1e-9:
                chain.pop()
            chain.append(point)
        chains.append(chain[:-1])
    return chains[0]+chains[1]


def inside_hull(polygon,point):
    return all(cross(a,b,point)>=-1e-5 for a,b in zip(polygon,polygon[1:]+polygon[:1]))


def routed_clearance(points,diameter,station_directions=None,endpoint_direction=None):
    vectors=[App.Vector(*point) for point in points]
    assert len(vectors)>=2
    if station_directions is not None:
        assert len(station_directions)==len(vectors),'Cord station centers and directions differ'
    wires=[]
    for index,point in enumerate(vectors):
        tangent=App.Vector(*station_directions[index]) if station_directions is not None else App.Vector(*endpoint_direction) if endpoint_direction is not None and index in [0,len(vectors)-1] else vectors[min(index+1,len(vectors)-1)]-vectors[max(0,index-1)]
        assert tangent.Length>1e-9,'Cord route has a zero direction'
        tangent.normalize()
        if station_directions is None:
            wires.append(Part.Wire([Part.makeCircle(diameter/2,point,tangent)]))
        else:
            # Give every true circular ring the same explicit radial/up phase.
            # An implicit circle seam can flip as a U turns through 180 degrees.
            radial=tangent.cross(App.Vector(0,0,1))
            if radial.Length<1e-9:
                radial=tangent.cross(App.Vector(1,0,0))
            radial.normalize()
            up=tangent.cross(radial)
            radial.multiply(diameter/2)
            up.multiply(diameter/2)
            wires.append(Part.Wire([Part.Arc(point+radial,point+up,point-radial).toShape(),Part.Arc(point-radial,point-up,point+radial).toShape()]))
    shape=Part.makeLoft(wires,True,True)
    valid(shape,'Authored first-lead/shrink clearance',1)
    return shape


def audit_direct_power(base,lid,power,p):
    """Audit the user's directly actuated 12 x 12 x 4 mm switch and its carrier."""
    assert p['model']=='user-tactile-12x12x4-d6-h6','Unexpected power-switch dimensional source'
    assert (p['bodyWidth'],p['bodyHeight'],p['bodyDepth'],p['actuatorDiameter'],p['actuatorProjection'])==(12,12,4,6,6)
    x,z=p['position'][0],p['position'][2]
    body=Part.makeBox(12,4,12,App.Vector(x-6,p['bodyFrontY'],p['bodyBottomZ']))
    missing=missing_material(body,power)
    assert missing<1e-5,('Actual power switch lacks its complete specified body',missing)
    actual_stroke=0 if p['inspectionPosition']=='first' else p['inspectionStroke']
    actual_actuator=Part.makeCylinder(3,6-actual_stroke,App.Vector(x,p['faceY']+actual_stroke,z),App.Vector(0,1,0))
    expected=body.fuse(actual_actuator)
    assert abs(expected.Volume-power.Volume)<1e-5 and expected.Volume-expected.common(power).Volume<1e-5,'Power occurrence differs from the specified directly actuated switch'
    sections=[]
    for sign in [-1,1]:
        widths=[]
        for section_z in [18,20,22]:
            origin=App.Vector(x+(6 if sign>0 else -10),-44.55,section_z-.05)
            section=common_with_base(base,Part.makeBox(4,.1,.1,origin))
            valid(section,'Power side cheek after lead groove and nut pocket',1)
            width=section.Volume/(.1*.1)
            assert width>=2-1e-5,('Power lead groove or nut pocket leaves a fragile side cheek',sign,section_z,width)
            widths.append({'zMm':section_z,'widthMm':width})
        # The adjacent tail-post nut pocket trims the outer 0.05 mm locally.
        # Stay within the continuously retained 7.2..9.35 mm cheek band.
        witness=Part.makeBox(2.08,3.8,7.2,App.Vector(x+sign*8.25-1.04,-46.4,17.2))
        gap=missing_material(witness,base)
        assert gap<1e-5,('Power side cheek is interrupted after its wire groove',sign,gap)
        sections.append({'side':sign,'measuredWidthMm':min(item['widthMm'] for item in widths),'nativeSections':widths,'provenContinuousWidthMm':2.08,'missingMaterialMm3':gap})
    floor=Part.makeBox(11.8,3.8,1.4,App.Vector(x-5.9,-46.4,13.6))
    floor_missing=missing_material(floor,base)
    assert floor_missing<1e-5,('Direct switch lacks a broad body-support floor',floor_missing)
    down=body.copy()
    down.translate(App.Vector(0,0,-.02))
    floor_area=common_with_base(down,base).Volume/.02
    assert floor_area>=44,('Power body has insufficient floor bearing area',floor_area)
    up=body.copy()
    up.translate(App.Vector(0,0,.02))
    lid_area=up.common(lid).Volume/.02
    assert lid_area>=28,('Lid does not clamp the direct power-switch body with its broad pad',lid_area)
    pad=Part.makeBox(7.8,3.4,1.1,App.Vector(x-3.9,-46.2,27.05))
    pad_missing=missing_material(pad,lid)
    assert pad_missing<1e-5,('Power body bearing pad has a weak or detached root',pad_missing)
    # The front key's two upper corners join directly into the roof. Its lower
    # half remains open while descending over the fixed round actuator.
    key_roots=[]
    for side in [-1,1]:
        witness=Part.makeBox(.8,2.6,1.2,App.Vector(x+side*2.4-.4,-52.6,27))
        gap=missing_material(witness,lid)
        assert gap<1e-5,('Power slot closure has an unrooted corner',side,gap)
        key_roots.append({'side':side,'missingMaterialMm3':gap})
    rear=Part.makeBox(5.8,1.4,7.8,App.Vector(x-2.9,-42.2,15.1))
    rear_missing=missing_material(rear,base)
    assert rear_missing<1e-5,('Power rear body stop is thin or detached',rear_missing)
    bridge=p['frontBridge']
    bridge_depth=bridge['backY']-bridge['frontY']
    shoulder_width=(bridge['width']-p['guideDiameter'])/2
    assert bridge_depth>=5.7-1e-9 and shoulder_width>=2.9-1e-9,('Power front wall does not extend broadly to its end aperture',bridge_depth,shoulder_width)
    assert bridge['frontY']<=-52.4+1e-9 and bridge['backY']>=p['pocketFrontY']-1e-9,'Power front bridge does not join the aperture and body bearing'
    assert bridge['bottomZ']<=p['bodyBottomZ'] and bridge['topZ']>=25,'Power front bridge has insufficient bearing height'
    bridge_roots=[]
    for side in [-1,1]:
        center_x=x+side*(p['guideDiameter']/2+shoulder_width/2)
        dimensions=[shoulder_width-.1,bridge_depth-.1,bridge['topZ']-bridge['bottomZ']-.2]
        origin=[center_x-dimensions[0]/2,bridge['frontY']+.05,bridge['bottomZ']+.1]
        witness=Part.makeBox(*dimensions,App.Vector(*origin))
        gap=missing_material(witness,base)
        assert gap<1e-5,('Power front bridge has a weak or interrupted aperture-to-body shoulder',side,gap)
        bridge_roots.append({'side':side,'dimensionsMm':dimensions,'originMm':origin,'missingMaterialMm3':gap})
    rear_t=p['rearT']
    crossbar_depth=rear_t['crossbarBackY']-rear_t['frontY']
    stem_length=rear_t['backY']-rear_t['frontY']
    assert rear_t['crossbarWidth']>=6 and crossbar_depth>=2.8-1e-9 and rear_t['stemWidth']>=3.2 and stem_length>=4.1-1e-9,('Power rear T support has an undersized crossbar or stem',rear_t)
    assert abs(crossbar_depth-rear_t['crossbarDepth'])<1e-9 and rear_t['frontY']==p['pocketBackY'],'Power rear T does not retain the actual body-bearing datum'
    assert abs(rear_t['lidBottomZ']-rear_t['baseTopZ']-.2)<1e-9,'Power rear T halves lack their declared assembly clearance'
    t_roots=[]
    # The existing upper-SMA tunnel intentionally relieves the low root. These
    # complete walls start at the switch floor and continue into the body stop;
    # the original broad floor proof above still checks the supporting carrier.
    for label,material,bottom,top in [
        ('base',base,max(p['bodyBottomZ'],rear_t['baseBottomZ'])+.1,rear_t['baseTopZ']-.1),
        ('lid',lid,rear_t['lidBottomZ']+.1,rear_t['lidTopZ']-.1),
    ]:
        assert top>bottom,('Power rear T has no continuous height',label,bottom,top)
        for region,width,depth,center_y in [
            ('crossbar',rear_t['crossbarWidth']-.2,crossbar_depth-.2,(rear_t['frontY']+rear_t['crossbarBackY'])/2),
            ('stem',rear_t['stemWidth']-.2,stem_length-.2,(rear_t['frontY']+rear_t['backY'])/2),
        ]:
            dimensions=[width,depth,top-bottom]
            origin=[x-width/2,center_y-depth/2,bottom]
            witness=Part.makeBox(*dimensions,App.Vector(*origin))
            gap=missing_material(witness,material)
            assert gap<1e-5,('Power rear T has an interrupted bearing or reinforcement root',label,region,gap)
            t_roots.append({'part':label,'region':region,'dimensionsMm':dimensions,'originMm':origin,'missingMaterialMm3':gap})
    retention=[]
    for label,offset,material in [('front',[0,-.3,0],base),('rear',[0,.3,0],base),('left',[-.3,0,0],base),('right',[.3,0,0],base),('lid',[0,0,.2],lid)]:
        shifted=body.copy()
        shifted.translate(App.Vector(*offset))
        blocked=common_with_base(shifted,material).Volume
        assert blocked>.01,('Direct power body lacks positive retention',label,blocked)
        retention.append({'direction':label,'probeDisplacementMm':offset,'obstructionMm3':blocked})
    guide_box=Part.makeBox(10,6,10,App.Vector(x-5,-52.5,z-5))
    guide=Part.makeCompound([common_with_base(base,guide_box),lid.common(guide_box)])
    actuator_poses=[]
    for stroke in [0,p['inspectionStroke']]:
        actuator=Part.makeCylinder(3,6-stroke,App.Vector(x,p['faceY']+stroke,z),App.Vector(0,1,0))
        base_hit=common_with_base(actuator,base).Volume
        lid_hit=actuator.common(lid).Volume
        assert max(base_hit,lid_hit)<1e-5,('Direct power actuator is obstructed',stroke,base_hit,lid_hit)
        clearance=scalar_distance(actuator,guide)
        assert .19<=clearance<=.4,('Direct power actuator has an invalid running clearance',stroke,clearance)
        actuator_poses.append({'inspectionStrokeMm':stroke,'baseObstructionMm3':base_hit,'lidObstructionMm3':lid_hit,'guideClearanceMm':clearance})
    aperture=Part.makeCylinder(p['guideDiameter']/2,2.4,App.Vector(x,-52.3,z),App.Vector(0,1,0))
    aperture_hit=common_with_base(aperture,base).Volume+aperture.common(lid).Volume
    assert aperture_hit<1e-5,('Power front guide clips its specified 6.6 mm opening',aperture_hit)
    guide_rim=[]
    for angle in range(0,360,45):
        radians=math.radians(angle)
        witness=Part.makeBox(.08,.08,.08,App.Vector(x+3.5*math.cos(radians)-.04,-51.04,z+3.5*math.sin(radians)-.04))
        covered=common_with_base(witness,base).Volume+witness.common(lid).Volume
        assert covered>=witness.Volume-1e-6,('Closed power guide is missing a supporting rim',angle,covered)
        guide_rim.append({'angleDegrees':angle,'materialMm3':covered})
    recess=power.optimalBoundingBox(False,False).YMin-p['guideCenter'][1]-actual_stroke
    assert .4<=recess<=.7,('Power actuator is insufficiently recessed',recess)
    insertion=[]
    for lift in [30,20,12,8,4,2,1,.2,0]:
        moving=power.copy()
        moving.translate(App.Vector(0,0,lift))
        blocked=common_with_base(moving,base).Volume
        assert blocked<1e-5,('Complete direct power switch cannot drop vertically into the open base',lift,blocked)
        insertion.append({'liftZ':lift,'blockedVolumeMm3':blocked})
    lid_tail=lid.common(Part.makeBox(20,16,20,App.Vector(x-10,-54,14)))
    closure=[]
    for lift in [12,8,4,2,1,.5,.2,0]:
        moving=lid_tail.copy()
        moving.translate(App.Vector(0,0,lift))
        blocked=moving.common(power).Volume+common_with_base(moving,base).Volume
        assert blocked<1e-5,('Direct power holder blocks vertical lid closure',lift,blocked)
        closure.append({'liftZ':lift,'blockedVolumeMm3':blocked})
    return {'powerDimensionalSource':p['model'],'powerBodyDimensionsMm':[12,12,4],'powerActuatorDimensionsMm':{'diameter':6,'projection':6},'powerCheeksAfterWireGrooves':sections,'powerBodyFloorMissingMm3':floor_missing,'powerBodyFloorBearingAreaMm2':floor_area,'powerLidBodyBearingAreaMm2':lid_area,'powerLidBodyPadMissingMm3':pad_missing,'powerSlotClosureRootWitnesses':key_roots,'powerRearBodyStopMissingMm3':rear_missing,'powerFrontApertureBridgeWitnesses':bridge_roots,'powerRearTSupportWitnesses':t_roots,'powerBodyRetentionProbes':retention,'powerDirectActuatorPoses':actuator_poses,'powerGuideOpeningBlockedMm3':aperture_hit,'powerGuideRimWitnesses':guide_rim,'powerActuatorRecessMm':recess,'powerVerticalInsertion':insertion,'powerLidLoweringPath':closure}


for case in cases:
    base_common_cache=None
    distance_statistics={'localizedExactQueries':0,'fullFallbackQueries':0,'marginMm':1.0,'strictDistanceGateMm':.999999}
    row={'name':case['name'],'presetId':case.get('presetId'),'state':case['state'],'featureScope':os.environ.get('HANDHELD_FEATURE_SCOPE','full'),'antennaType':case['parameters']['antennaType'],'externalMount':case['parameters']['externalMount'],'bodyModel':case['parameters']['bodyModel'],'passed':False,'codeSHA256':hashlib.sha256(case['script'].encode()).hexdigest()}
    problems=[]
    doc=None
    try:
        recipe_started=time.perf_counter()
        checkpoint_enabled=os.environ.get('HANDHELD_NATIVE_RECIPE_CACHE')=='1'
        checkpoint_folder=output/'native-recipe-checkpoints'
        checkpoint_file=checkpoint_folder/(case['name']+'-'+row['codeSHA256'][:16]+'.FCStd')
        checkpoint_manifest=checkpoint_file.with_suffix('.json')
        checkpoint_reused=False
        if checkpoint_enabled and checkpoint_file.exists() and checkpoint_manifest.exists():
            cached=json.loads(checkpoint_manifest.read_text())
            assert cached['schemaVersion']==1,'Unsupported native recipe checkpoint'
            assert cached['codeSHA256']==row['codeSHA256'],'Native checkpoint generator differs'
            assert cached['parameters']==case['parameters'],'Native checkpoint configuration differs'
            assert cached['freecadVersion']==list(App.Version()),'Native checkpoint kernel differs'
            assert cached['componentIds']==[part['id'] for part in case['components']],'Native checkpoint component identities differ'
            assert cached['documentSHA256']==hashlib.sha256(checkpoint_file.read_bytes()).hexdigest(),'Native checkpoint bytes differ'
            doc=App.openDocument(str(checkpoint_file))
            sentinel=doc.getObject(cached['sentinelName'])
            assert sentinel and sentinel.TypeId=='App::FeaturePython','Native checkpoint lost the existing-object witness'
            checkpoint_reused=True
            print(json.dumps({'stage':'native-recipe-checkpoint-loaded','case':case['name'],'codeSHA256':row['codeSHA256']}),flush=True)
        else:
            doc=App.newDocument('HandheldControllerAudit')
            sentinel=doc.addObject('App::FeaturePython','ExistingObject')
            print(json.dumps({'stage':'native-recipe-start','case':case['name']}),flush=True)
            exec(case['script'],{})
        print(json.dumps({'stage':'native-recipe-complete','case':case['name'],'seconds':time.perf_counter()-recipe_started}),flush=True)
        roots=[obj for obj in doc.RootObjects if obj!=sentinel]
        assert len(roots)==1 and doc.getObject(sentinel.Name),'Export must preserve existing document objects'
        root=roots[0]
        assert root.PartId==case['id'] and root.ModelState==case['state']
        assert json.loads(root.Configuration)==case['parameters']
        children=component_leaves(root)
        assert len(children)==len(case['components']),'Physical preview/native component count mismatch'
        if checkpoint_enabled:
            if checkpoint_reused:
                assert root.Name==cached['rootName'],'Native checkpoint root identity differs'
            else:
                checkpoint_folder.mkdir(parents=True,exist_ok=True)
                doc.saveAs(str(checkpoint_file))
                cached={
                    'schemaVersion':1,'codeSHA256':row['codeSHA256'],
                    'parameters':case['parameters'],'freecadVersion':list(App.Version()),
                    'componentIds':[part['id'] for part in case['components']],
                    'sentinelName':sentinel.Name,'rootName':root.Name,
                    'documentSHA256':hashlib.sha256(checkpoint_file.read_bytes()).hexdigest(),
                    'createdByValidatorSHA256':report['validatorSHA256'],
                    'scope':'Unvalidated native reconstruction only; every component, fit, reference, STEP and FCStd assertion must run after loading.',
                }
                temporary=checkpoint_manifest.with_suffix('.json.tmp')
                temporary.write_text(json.dumps(cached,indent=2)+'\n')
                temporary.replace(checkpoint_manifest)
                print(json.dumps({'stage':'native-recipe-checkpoint-saved','case':case['name'],'file':str(checkpoint_file)}),flush=True)
            row['nativeRecipeCheckpoint']={'reused':checkpoint_reused,'file':str(checkpoint_file.relative_to(output)),'documentSHA256':cached['documentSHA256'],'codeSHA256':cached['codeSHA256'],'scope':cached['scope']}
        bounds_errors,volume_errors=[],[]
        assembly_bounds=App.BoundBox()
        for child,expected in zip(children,case['components']):
            printed=expected['supply']=='manufactured' and 'printing' in expected.get('manufacturing',{}).get('processes',[])
            valid(child.Shape,child.Label,1 if printed else expected['solids'])
            points,_=child.Shape.tessellate(.01)
            bound=App.BoundBox()
            for point in points:
                bound.add(point)
            actual=[bound.XMin,bound.YMin,bound.ZMin,bound.XMax,bound.YMax,bound.ZMax]
            assembly_bounds.add(App.Vector(*actual[:3]))
            assembly_bounds.add(App.Vector(*actual[3:]))
            errors=[abs(a-b) for a,b in zip(actual,expected['min']+expected['max'])]
            assert max(errors)<.05,(child.Label,'preview/native bounds mismatch',max(errors))
            bounds_errors.extend(errors)
            error=abs(child.Shape.Volume-expected['volume'])/child.Shape.Volume
            assert error<.015,(child.Label,'preview/native volume mismatch',error)
            volume_errors.append(error)
            if case['state']=='print-layout':
                assert printed,(child.Label,'nonprinted item in print layout')
                assert abs(child.Shape.optimalBoundingBox(False,False).ZMin)<.001,(child.Label,'not flat on bed',child.Shape.optimalBoundingBox(False,False).ZMin)
                bed_area=sum(face.Area for face in child.Shape.Faces if isinstance(face.Surface,Part.Plane) and abs(face.optimalBoundingBox(False,False).ZMin)<.001 and abs(face.optimalBoundingBox(False,False).ZMax)<.001)
                assert bed_area>5,(child.Label,'insufficient planar bed contact',bed_area)
        intersections_started=time.perf_counter()
        print(json.dumps({'stage':'physical-intersections-start','case':case['name'],'physicalOccurrences':len(children)}),flush=True)
        overlap=intersections(children)
        row['physicalIntersectionsSeconds']=time.perf_counter()-intersections_started
        print(json.dumps({'stage':'physical-intersections-complete','case':case['name'],'seconds':row['physicalIntersectionsSeconds'],'interferenceCount':len(overlap)}),flush=True)
        row['interferences']=overlap
        if overlap:
            problems.append(('Physical occurrences intersect',overlap))
        if case.get('referenceCode'):
            scope={'App':App,'Part':Part,'math':math}
            exec(case['referenceCode'],scope)
            references=scope['components']
            reference_metadata=case['references']
            assert len(references)==len(reference_metadata),'Reference identity/count mismatch'
            reference_shapes={meta['id']:shape for meta,shape in zip(reference_metadata,references)}
            assert 'battery-reference' in reference_shapes,'Battery envelope is missing its explicit identity'
            battery=reference_shapes['battery-reference']
            non_battery=[]
            for meta,shape in zip(reference_metadata,references):
                if meta['id']=='battery-reference':
                    continue
                valid(shape,meta['label'])
                overlaps=[]
                for child,expected in zip(children,case['components']):
                    if not shape.optimalBoundingBox(False,True).intersect(child.Shape.optimalBoundingBox(False,True)):
                        continue
                    volume=shape.common(child.Shape).Volume
                    if volume>1e-5:
                        overlaps.append({'part':expected['id'],'volumeMm3':volume})
                battery_overlap=shape.common(battery).Volume
                assert not overlaps and battery_overlap<1e-5,('Nonphysical reference does not fit the real assembly',meta['id'],overlaps,battery_overlap)
                non_battery.append({'id':meta['id'],'physicalInterferences':overlaps,'batteryOverlapMm3':battery_overlap})
            assert len(non_battery)==(1 if case['parameters']['antennaType']=='internal' else 0),'Variant has an unexpected antenna reference'
            row['nonBatteryReferenceFit']=non_battery
            valid(battery,'Battery envelope',1)
            battery_overlap=[]
            for child in children:
                if not battery.optimalBoundingBox(False,True).intersect(child.Shape.optimalBoundingBox(False,True)):
                    continue
                common=battery.common(child.Shape)
                if not common.isNull() and common.Volume>1e-5:
                    battery_overlap.append({'part':child.Label,'volumeMm3':common.Volume})
            row['batteryInterferences']=battery_overlap
            if battery_overlap:
                problems.append(('Battery pouch intersects physical parts',battery_overlap))
            clearances=[]
            for child,expected in zip(children,case['components']):
                if expected['libraryId']=='panel-switch':
                    distance=scalar_distance(battery,child.Shape)
                    clearances.append({'button':expected['id'],'distanceMm':distance})
                    minimum=.45 if case['parameters']['bodyModel']=='web-grip' and expected['id']=='button-a' else .8
                    if distance<minimum:
                        problems.append((expected['id'],'Insufficient physical battery clearance',distance,minimum))
            row['batteryButtonClearances']=clearances
        print(json.dumps({'stage':'physical-fit','case':case['name'],'physicalInterferences':overlap,'batteryInterferences':row.get('batteryInterferences',[]),'nonBatteryReferenceFit':row.get('nonBatteryReferenceFit',[])}),flush=True)
        if os.environ.get('HANDHELD_DIAGNOSTIC_CACHE'):
            doc.saveAs(str(output/(case['name']+'-physical-fit.FCStd')))
        if case['state']=='assembled':
            guard_plane=case['layout']['guardPlane']
            base=next(child for child,expected in zip(children,case['components']) if expected['id']=='base')
            lid=next(child for child,expected in zip(children,case['components']) if expected['id']=='lid')
            # Removing distant external skin reduces repeated internal witness costs.
            # The subset is never substituted into physical geometry or exported.
            crop_started=time.perf_counter()
            subset=base.Shape.common(Part.makeBox(40,140,45,App.Vector(-20,-70,-5)))
            valid(subset,'Exact internal witness subset')
            base_common_cache={'full':base.Shape,'subset':subset,'subsetQueries':0,'fullQueries':0}
            row['internalWitnessSubset']={'boundsMm':[-20,-70,-5,20,70,40],'fullFaces':len(base.Shape.Faces),'subsetFaces':len(subset.Faces),'preparationSeconds':time.perf_counter()-crop_started}
            module=next(child for child,expected in zip(children,case['components']) if expected['libraryId']=='lora-module')
            d=case['layout']
            power=next(child for child,expected in zip(children,case['components']) if expected['id']=='power-switch')
            if os.environ.get('HANDHELD_FEATURE_SCOPE')!='antenna':
                outer_code=case['caseOuterEnvelopeCode']
                rounded_outer=authored_native_fixture(outer_code,'Conservative closed rounded exterior')
                row['caseOuterEnvelopeCodeSHA256']=hashlib.sha256(outer_code.encode()).hexdigest()
                print(json.dumps({'stage':'canonical-nut-exterior-start','case':case['name']}),flush=True)
                row['canonicalM2NutExterior']=nut_exterior_checks(case,children,rounded_outer)
                row['canonicalDS225NutExterior']=switch_retaining_nut_checks(case,children,rounded_outer)
                print(json.dumps({'stage':'canonical-nut-exterior-complete','case':case['name']}),flush=True)
                print(json.dumps({'stage':'m2-screw-mounts-start','case':case['name']}),flush=True)
                row['supportedM2ScrewLengthFits']=screw_mount_checks(case,children,reference_shapes if case.get('referenceCode') else None)
                print(json.dumps({'stage':'m2-screw-mounts-complete','case':case['name']}),flush=True)
                row['roundedFloorExterior']=rounded_floor_exterior_checks(base.Shape,case['parameters']['bodyModel'])
                floor_witness=Part.makeBox(16,30,.3,App.Vector(-8,-15,1.7))
                floor_missing=missing_material(floor_witness,base.Shape)
                assert floor_missing<1e-5,('Rounded shell lost its continuous cavity floor at Z=2',floor_missing)
                floor_void=Part.makeBox(10,10,.1,App.Vector(-5,-5,2.05))
                floor_above=common_with_base(floor_void,base.Shape).Volume
                assert floor_above<1e-5,('Rounded floor moved into the main battery cavity',floor_above)
                row['roundedCavityFloor']={'topZ':2,'filledWitnessDimensionsMm':[16,30,.3],'filledWitnessMissingMm3':floor_missing,'aboveFloorVoidZ':[2.05,2.15],'aboveFloorObstructionMm3':floor_above}
                assert module.Shape.optimalBoundingBox(False,False).ZMax<=d['seam']-.3,'Module protrudes above the open case wall'
                oled_frames=[solid for solid in module.Shape.Solids if abs(solid.optimalBoundingBox(False,False).XLength-18.6)<.02 and abs(solid.optimalBoundingBox(False,False).YLength-33)<.02]
                oled_faces=[solid for solid in module.Shape.Solids if abs(solid.optimalBoundingBox(False,False).XLength-11.4)<.02 and abs(solid.optimalBoundingBox(False,False).YLength-22)<.02 and abs(solid.optimalBoundingBox(False,False).ZLength-.1)<.01]
                assert len(oled_frames)==len(oled_faces)==1,'Cannot identify the canonical protected OLED and modeled face'
                oled_frame,oled_face=oled_frames[0],oled_faces[0]
                face_bounds=oled_face.optimalBoundingBox(False,False)
                recess=lid.Shape.optimalBoundingBox(False,False).ZMax-face_bounds.ZMax
                assert .8<=recess<=1.7,('Display remains deeply recessed',recess)
                mask_gap=scalar_distance(oled_frame,lid.Shape)
                assert .25<=mask_gap<=.55,('Opaque display mask has insufficient fit clearance or leaves a deep gap',mask_gap)
                view=Part.makeBox(face_bounds.XLength,face_bounds.YLength,lid.Shape.optimalBoundingBox(False,False).ZMax-face_bounds.ZMax+.5,App.Vector(face_bounds.XMin,face_bounds.YMin,face_bounds.ZMax+.01))
                clipped=lid.Shape.common(view).Volume
                assert clipped<1e-5,('Display aperture clips the modeled full face',clipped)
                mask_z=oled_frame.optimalBoundingBox(False,False).ZMax+mask_gap+.01
                mask_probe=Part.makeBox(18,31,.05,App.Vector(-9,d['board']['screenY']-15.5,mask_z))
                mask_void=mask_probe.cut(lid.Shape)
                assert len(mask_void.Solids)==1,'Opaque display surround has additional openings into the interior'
                aperture=mask_void.optimalBoundingBox(False,False)
                assert 11.4<=aperture.XLength<=12.2 and 22<=aperture.YLength<=22.8,('Display mask leaves an oversized or clipped lower opening',aperture.XLength,aperture.YLength)
                row.update(displayFaceRecessMm=recess,displayMaskFrameClearanceMm=mask_gap,displayFaceClippedVolumeMm3=clipped,displayMaskLowerOpeningMm=[aperture.XLength,aperture.YLength])
                print(json.dumps({'stage':'direct-power-fit-start','case':case['name']}),flush=True)
                row.update(audit_direct_power(base.Shape,lid.Shape,power.Shape,d['powerButton']))
                print(json.dumps({'stage':'direct-power-fit-complete','case':case['name']}),flush=True)
                pcb_candidates=[solid for solid in module.Shape.Solids if abs(solid.optimalBoundingBox(False,False).ZMin-d['board']['pcbBottom'])<.01 and abs(solid.optimalBoundingBox(False,False).ZMax-d['board']['pcbTop'])<.01]
                assert len(pcb_candidates)==1,'Cannot identify the actual FR4 PCB solid'
                pcb=pcb_candidates[0]
                bearing_probe=pcb.copy()
                bearing_probe.translate(App.Vector(0,0,.02))
                bearing=bearing_probe.common(lid.Shape)
                quadrants={(-1,-1):0,(-1,1):0,(1,-1):0,(1,1):0}
                for solid in bearing.Solids:
                    center=solid.CenterOfMass
                    key=(-1 if center.x<d['board']['x'] else 1,-1 if center.y<d['board']['y'] else 1)
                    quadrants[key]+=solid.Volume/.02
                assert all(area>=1 for area in quadrants.values()),('Lid lacks four separated bare-PCB bearing lands',quadrants)
                lifted=pcb.copy()
                lifted.translate(App.Vector(0,0,.2))
                captured=lifted.common(lid.Shape).Volume
                assert captured>.1,('Lid does not restrain PCB lift',captured)
                row.update(pcbBearingAreasMm2={str(key):area for key,area in quadrants.items()},pcbLiftInterferenceMm3=captured,moduleBelowWallMm=d['seam']-module.Shape.optimalBoundingBox(False,False).ZMax)
                tail_rims=[]
                for child,expected in zip(children,case['components']):
                    if not expected['id'].startswith('lid-screw-'):
                        continue
                    screw=child.Shape.optimalBoundingBox(False,False)
                    x,y=(screw.XMin+screw.XMax)/2,(screw.YMin+screw.YMax)/2
                    if y>=0:
                        continue
                    top=lid.Shape.optimalBoundingBox(False,False).ZMax
                    ring=Part.makeCylinder(3.405,.01,App.Vector(x,y,top-.01)).cut(Part.makeCylinder(2.205,.03,App.Vector(x,y,top-.02)))
                    missing=missing_material(ring,lid.Shape)
                    assert missing<1e-5,('Tail screw counterbore lacks a closed 1.2 mm material rim',expected['id'],missing)
                    tail_rims.append({'screw':expected['id'],'center':[x,y],'provenRimMm':1.205,'missingMaterialMm3':missing})
                assert len(tail_rims)==2
                row['tailCounterboreRims']=tail_rims
                usb=d['usb']
                witnesses=[]
                for width,height,y in [(usb['width'],usb['height'],usb['faceY']),(usb['reliefWidth'],usb['reliefHeight'],usb['reliefBottomY']+.5)]:
                    for x,z in [(-width/2-.4,usb['centerZ']),(width/2+.4,usb['centerZ']),(0,usb['centerZ']-height/2-.4),(0,usb['centerZ']+height/2+.4)]:
                        witness=Part.makeBox(.4,.4,.4,App.Vector(x-.2,y-.2,z-.2))
                        material=common_with_base(base.Shape,witness).Volume
                        assert material>.04,('USB opening lacks a closed compact perimeter',x,y,z,material)
                        witnesses.append(material)
                approach=Part.makeBox(9,55-usb['faceY']-.05,3.2,App.Vector(-4.5,usb['faceY']+.05,usb['centerZ']-1.6))
                obstructed=common_with_base(base.Shape,approach).Volume+lid.Shape.common(approach).Volume
                assert obstructed<1e-5,('USB metal plug approach is obstructed',obstructed)
                nose_walls=[]
                for x in [-10.54,10.54]:
                    probe=Part.makeBox(.04,5,.04,App.Vector(x-.02,d['board']['y']+25.845,(d['board']['pcbBottom']+d['board']['pcbTop'])/2-.02))
                    wall=common_with_base(base.Shape,probe)
                    assert wall.Solids,'PCB nose pocket opens through the case'
                    thickness=max(wall.Solids,key=lambda solid:solid.Volume).optimalBoundingBox(False,False).YLength
                    assert thickness>=1.3,('Insufficient wall ahead of PCB nose',x,thickness)
                    nose_walls.append(thickness)
                row.update(usbClosedPerimeterWitnessVolumesMm3=witnesses,usbApproachBlockedVolumeMm3=obstructed,pcbNoseWallThicknessesMm=nose_walls)
                print(json.dumps({'stage':'reinforcement-lanyard-start','case':case['name']}),flush=True)
                reinforcement=case['reinforcement']
                lanyard_cutter=intentional_lanyard_cutout(reinforcement['lanyard'])
                web_proofs=[]
                for sites,top_z in [(reinforcement['lidPosts'],reinforcement['lidPostWallTopZ']),
                                    (reinforcement['pcbSupports'],reinforcement['pcbWallTopZ']),
                                    (reinforcement['batteryPosts'],reinforcement['batteryWallTopZ'])]:
                    for site in sites:
                        x=(site['x']+site['wallX'])/2
                        witness=Part.makeBox(.3,2.8,top_z-2.7,App.Vector(x-.15,site['y']-1.4,2.1))
                        expected=witness
                        flanks=[]
                        cord_intersection=witness.common(lanyard_cutter)
                        if cord_intersection.Volume>1e-8:
                            # A support rib crosses the designed cord passage. Every
                            # remaining point of the original witness is required;
                            # the cutter is exact and excludes no other void.
                            expected=witness.cut(lanyard_cutter)
                            passage_bounds=cord_intersection.optimalBoundingBox(False,False)
                            for label,z0,z1 in [('below-cord',2.1,passage_bounds.ZMin-.2),('above-cord',passage_bounds.ZMax+.2,top_z-.6)]:
                                assert z1>z0,('Cord crossing leaves no complete flanking rib',site['id'],label,z0,z1)
                                flank=Part.makeBox(.3,2.8,z1-z0,App.Vector(x-.15,site['y']-1.4,z0))
                                assert flank.common(lanyard_cutter).Volume<1e-8,('Rib flank overlaps the cord passage',label)
                                flank_missing=missing_material(flank,base.Shape)
                                assert flank_missing<1e-5,('Lanyard crossing lacks a continuous flanking rib',label,flank_missing)
                                flanks.append({'region':label,'zBoundsMm':[z0,z1],'heightMm':z1-z0,'provenWebWidthMm':2.8,'missingMaterialMm3':flank_missing})
                        missing=missing_material(expected,base.Shape)
                        assert missing<1e-5,('Reinforced support has no continuous floor-to-wall web',site['id'],missing)
                        web_proofs.append({'id':site['id'],'missingMaterialMm3':missing,'provenWebWidthMm':2.8,'intentionalCordIntersectionMm3':cord_intersection.Volume,'solidFlankingRibs':flanks})
                roof_proofs=[]
                for site in reinforcement['lidClampRoot']['sites']:
                    x=(site['x']+site['outerX'])/2
                    witness=Part.makeBox(.3,2.8,1.1,App.Vector(x-.15,site['y']-1.4,26.3))
                    missing=missing_material(witness,lid.Shape)
                    assert missing<1e-5,('PCB clamp lacks a solid buttress into the lid roof',site,missing)
                    roof_proofs.append({'site':[site['x'],site['y']],'missingMaterialMm3':missing})
                nut_paths=[]
                for site in reinforcement['lidPosts']+reinforcement['batteryPosts']:
                    prefix='lid-nut-' if site['id'].startswith('lid-post-') else 'battery-nut-'
                    index=site['id'].rsplit('-',1)[1]
                    nut=next(child for child,expected in zip(children,case['components']) if expected['id']==prefix+index)
                    for distance in [6,3,0]:
                        moving=nut.Shape.copy()
                        moving.translate(App.Vector(*[-distance*v for v in site['nutLoadingDirection']]))
                        blocked=common_with_base(moving,base.Shape).Volume
                        assert blocked<1e-5,('Reinforcement blocks cavity-first captive-nut loading',site['id'],distance,blocked)
                        nut_paths.append({'id':site['id'],'offsetFromInstalledMm':distance,'blockedVolumeMm3':blocked})
                lanyard=reinforcement['lanyard']
                assert lanyard['profile']=='compact-u-teardrop' and lanyard['roofAngleDegrees']==45,'Unexpected lanyard bore profile'
                assert len(lanyard['cordPath'])==len(lanyard['boreStations']) and all(path==station['center'] and direction==station['direction'] for path,direction,station in zip(lanyard['cordPath'],lanyard['cordDirections'],lanyard['boreStations'])),'Cord clearance differs from the authored cutter frames'
                cord=routed_clearance(lanyard['cordPath'],3.6,lanyard['cordDirections'])
                cord_hits=[]
                for child,expected in zip(children,case['components']):
                    if cord.optimalBoundingBox(False,True).intersect(child.Shape.optimalBoundingBox(False,True)):
                        volume=cord.common(child.Shape).Volume
                        if volume>1e-5:
                            cord_hits.append({'id':expected['id'],'volumeMm3':volume})
                battery_cord=cord.common(battery).Volume
                assert not cord_hits and battery_cord<1e-5,('Lanyard cord route is blocked',cord_hits,battery_cord)
                ligament_proofs=[]
                for label,key in [('loaded-bridge','loadedBridgeWitness'),('floor-root','floorRootWitness'),('bore-roof','roofWitness')]:
                    center=lanyard[key]
                    witness=Part.makeBox(.8,.8,.8,App.Vector(*[value-.4 for value in center]))
                    missing=missing_material(witness,base.Shape)
                    assert missing<1e-5,('Lanyard anchor lacks material around its loaded tunnel',label,missing)
                    ligament_proofs.append({'region':label,'centerMm':center,'dimensionsMm':[.8,.8,.8],'missingMaterialMm3':missing})
                first,last=[App.Vector(*point) for point in lanyard['loadedBridgeSegment']]
                delta=last-first
                bridge_length=delta.Length
                assert bridge_length>=2.4-1e-6,('Lanyard loaded bridge is too narrow',bridge_length)
                bridge=Part.makeCylinder(.15,bridge_length,first,delta)
                bridge_missing=missing_material(bridge,base.Shape)
                assert bridge_missing<1e-5,('Lanyard loaded bridge has an interrupted load path',bridge_missing)
                interior_ligaments=[]
                stations=lanyard['boreStations']
                for index in sorted({2,3,len(stations)//4,len(stations)//2,3*len(stations)//4,len(stations)-4,len(stations)-3}):
                    station=stations[index]
                    cx,cy,cz=station['center']
                    for label,z0 in [('roof',cz+station['radius']*math.sqrt(2)+.02),('floor',cz-station['radius']-.02-2.4)]:
                        witness=Part.makeBox(.08,.08,2.4,App.Vector(cx-.04,cy-.04,z0))
                        missing=missing_material(witness,base.Shape)
                        assert missing<1e-5,('U-passage lacks a solid 2.4 mm interior load-path ligament',index,label,missing)
                        interior_ligaments.append({'station':index,'region':label,'dimensionsMm':[.08,.08,2.4],'missingMaterialMm3':missing})
                row.update(reinforcementFloorWebs=web_proofs,reinforcementLidButtresses=roof_proofs,cavityFirstNutInsertion=nut_paths,lanyardCordDiameterCheckedMm=3.6,lanyardCordInterferences=cord_hits,lanyardBatteryOverlapMm3=battery_cord,lanyardLoadedMaterialWitnesses=ligament_proofs,lanyardLoadedBridgeLengthMm=bridge_length,lanyardLoadedBridgeMissingMm3=bridge_missing,lanyardInteriorLigaments=interior_ligaments,lanyardRouteProfile=lanyard['profile'])
                print(json.dumps({'stage':'reinforcement-lanyard-complete','case':case['name']}),flush=True)
            rf_pairs=[(child,expected) for child,expected in zip(children,case['components']) if expected['libraryId']=='rf-pigtail']
            if case['parameters']['antennaType']=='external':
                print(json.dumps({'stage':'external-antenna-fit-start','case':case['name']}),flush=True)
                assert len(rf_pairs)==1,'Expected one canonical bulkhead pigtail kit'
                rf,rf_meta=rf_pairs[0]
                mount=d['antenna']
                cx,cy,cz=mount['position']
                assert rf_meta['parameters']['model']==mount['model']
                assert rf_meta['parameters']['panelThickness']==mount['panelThickness']
                assert len(rf.Shape.Solids)==6,'Bulkhead kit must retain its six modeled hardware solids'
                rx,ry,rz=mount['rotation']
                rotation=App.Rotation(App.Vector(0,0,1),rz).multiply(App.Rotation(App.Vector(0,1,0),ry)).multiply(App.Rotation(App.Vector(1,0,0),rx))
                frame=App.Placement(App.Vector(cx,cy,cz),rotation)
                def local(shape):
                    transformed=shape.copy()
                    transformed.transformShape(frame.inverse().toMatrix())
                    return transformed
                local_base=local(base.Shape)
                local_rf=local(rf.Shape)
                jack=max(local_rf.Solids,key=lambda solid:solid.Volume)
                assert abs(jack.optimalBoundingBox(False,False).ZMax-8.49)<.01 and abs(jack.optimalBoundingBox(False,False).ZMin+10.01)<.01,'Selected jack axial references changed'
                panel_t=abs(mount['seatOuterY']-mount['seatInnerY'])
                assert .8<=panel_t<=2.3,'Bulkhead clamp seat exceeds the conservative installation range'
                cradle_missing=[]
                cradle_paths=[]
                if mount['top']:
                    for sign in [-1,1]:
                        arm_x=cx+sign*(mount['cradleInnerWidth']+mount['cradleOuterWidth'])/4
                        arm_top=11.4
                        arm_bottom=4 if mount.get('compact') else 2.1
                        arm=Part.makeBox(1.5,abs(mount['cradleFrontY']-mount['cradleBackY'])-.2,arm_top-arm_bottom,App.Vector(arm_x-.75,min(mount['cradleBackY'],mount['cradleFrontY'])+.1,arm_bottom))
                        missing=missing_material(arm,base.Shape)
                        assert missing<1e-5,('Antenna support cheek is thin or detached from the floor',sign,missing)
                        cradle_missing.append(missing)
                else:
                    paths={path['id']:path for path in mount['cradleLoadPaths']}
                    assert set(paths)=={'left-lower-inner','left-upper-original','right-original'},'Bottom SMA lacks the full lower/upper cheek load path'
                    for id,path in paths.items():
                        low,high=path['min'],path['max']
                        spans=[b-a for a,b in zip(low,high)]
                        assert spans[0]>=2.1-1e-9 and spans[1]>=2-1e-9 and spans[2]>=6,('Bottom SMA load-path witness lost substantial width or coverage',id,spans)
                        assert abs(low[2]-(8.45 if id=='left-upper-original' else 2.1))<1e-9 and abs(high[2]-(8.45 if id=='left-lower-inner' else 19.4))<1e-9,('Bottom SMA cheek witness does not cover its complete root-to-upper-wall interval below the PCB-nose clearance',id)
                        witness=Part.makeBox(*spans,App.Vector(*low))
                        missing=missing_material(witness,base.Shape)
                        assert missing<1e-5,('Bottom SMA lacks a continuous 2.1 mm finite cheek load path after every cord and hardware cut',id,missing)
                        cradle_missing.append(missing)
                        cradle_paths.append({'id':id,'boundsMm':[low,high],'widthMm':spans[0],'missingMaterialMm3':missing})
                    lower,upper=paths['left-lower-inner'],paths['left-upper-original']
                    assert upper['max'][2]-lower['min'][2]>=17 and paths['right-original']['max'][2]-paths['right-original']['min'][2]>=17,'The bottom SMA load paths lost their required 17 mm floor-to-upper-wall height'
                    join_x=[max(lower['min'][0],upper['min'][0]),min(lower['max'][0],upper['max'][0])]
                    join_y=[max(lower['min'][1],upper['min'][1]),min(lower['max'][1],upper['max'][1])]
                    assert join_x[1]-join_x[0]>=.5 and join_y[1]-join_y[0]>=1.9,'The shifted lower SMA root does not overlap its upper cheek'
                    join=Part.makeBox(.3,1,.2,App.Vector(sum(join_x)/2-.15,sum(join_y)/2-.5,8.35))
                    join_missing=missing_material(join,base.Shape)
                    assert join_missing<1e-5,('The lower and upper SMA cheek paths meet without a continuous solid root',join_missing)
                    cradle_paths.append({'id':'lower-upper-solid-overlap','dimensionsMm':[.3,1,.2],'missingMaterialMm3':join_missing})
                key_slice=jack.common(Part.makeBox(8,8,panel_t-.2,App.Vector(-4,-4,-panel_t+.1)))
                assert key_slice.Solids,'No jack barrel engages the keyed panel thickness'
                key_blocks=[]
                for angle in [-15,15]:
                    turned=key_slice.copy()
                    turned.rotate(App.Vector(0,0,0),App.Vector(0,0,1),angle)
                    blocked=turned.common(local_base).Volume
                    assert blocked>.01,('SMA body can turn freely in its supposed D key',angle,blocked)
                    key_blocks.append(blocked)
                flange=jack.common(Part.makeBox(20,20,2,App.Vector(-10,-10,0)))
                valid(flange,'Complete actual recessed SMA flange',1)
                hex_slice=jack.common(Part.makeBox(20,20,1.8,App.Vector(-10,-10,.1)))
                valid(hex_slice,'Actual SMA flange independent of its negative-Z D barrel',1)
                hex_blocks=[]
                for angle in [-15,15]:
                    turned=hex_slice.copy()
                    turned.rotate(App.Vector(),App.Vector(0,0,1),angle)
                    blocked=turned.common(local_base).Volume
                    assert blocked>.01,('The recessed SMA hex flange has no independent positive torque stop',angle,blocked)
                    hex_blocks.append({'angleDegrees':angle,'blockedVolumeMm3':blocked})
                envelope_code=case['antennaOuterEnvelopeCode']
                outer=authored_native_fixture(envelope_code,'Uncut rounded body for complete SMA-flange recess')
                local_outer=local(outer)
                recessed=flange.copy()
                recessed.translate(App.Vector(0,0,.4))
                recess_missing=max(0,recessed.Volume-local_outer.common(recessed).Volume)
                assert recess_missing<1e-5,('The complete actual SMA flange protrudes beyond its promised 0.4 mm recess in the rounded exterior',recess_missing)
                mating_span=jack.optimalBoundingBox(False,False).ZMax-flange.optimalBoundingBox(False,False).ZMax
                assert mating_span>=6.4,('Insufficient actual SMA front span for antenna mating',mating_span)
                mating_collar=Part.makeCylinder(5.5,10,App.Vector(0,0,2.05)).cut(Part.makeCylinder(3.3,10.2,App.Vector(0,0,2)))
                valid(mating_collar,'True 11 mm antenna-coupling clearance',1)
                mating_hits={label:mating_collar.common(local(shape)).Volume for label,shape in [('base',base.Shape),('lid',lid.Shape),('board',module.Shape),('power-switch',power.Shape),('canonical-rf-kit',rf.Shape)]}
                assert max(mating_hits.values())<1e-5,('Recessed SMA does not admit a reasonable 11 mm mating collar',mating_hits)
                insertion=[]
                for offset in [12,8,4,2,0]:
                    moving=jack.copy()
                    moving.translate(App.Vector(0,0,offset))
                    blocked=moving.common(local_base).Volume
                    assert blocked<1e-5,('Bulkhead body cannot enter through the panel from outside',offset,blocked)
                    insertion.append({'offsetOutward':offset,'blockedVolumeMm3':blocked})
                if mount['top']:
                    t=mount['axialTool']
                    y0,y1=sorted([t['startY'],t['endY']])
                    tool=Part.makeCylinder(t['outerDiameter']/2,y1-y0,App.Vector(t['centerX'],y0,t['centerZ']),App.Vector(0,1,0)).cut(Part.makeCylinder(t['innerDiameter']/2,y1-y0+.2,App.Vector(t['centerX'],y0-.1,t['centerZ']),App.Vector(0,1,0)))
                else:
                    tool=Part.makeBox(mount['toolWidth'],abs(mount['toolFrontY']-mount['toolBackY']),20,App.Vector(cx-mount['toolWidth']/2,min(mount['toolBackY'],mount['toolFrontY']),mount['toolBottomZ']))
                tool_blocked=common_with_base(tool,base.Shape).Volume
                assert tool_blocked<1e-5,('Internal SMA nut tool path is obstructed by the base',tool_blocked)
                pcb_tool_blocked=tool.common(module.Shape).Volume
                power_tool_blocked=tool.common(power.Shape).Volume
                assert power_tool_blocked<1e-5,('SMA nut-driver approach is blocked by the actual power switch',power_tool_blocked)
                if mount['top']:
                    assert pcb_tool_blocked<1e-5,('Upper SMA nut driver is blocked by the installed actual board',pcb_tool_blocked)
                if not mount['top']:
                    assert pcb_tool_blocked>.1,'Nut tool witness does not demonstrate pre-PCB installation'
                hardware=[solid for solid in local_rf.Solids if solid.optimalBoundingBox(False,False).ZMax<=-panel_t+.01]
                assert len(hardware)==2,'Cannot identify the inner retaining washer and nut'
                nut_drop=[]
                for offset in [20,10,5,0]:
                    blocked=0
                    for solid in hardware:
                        moving=solid.copy()
                        moving.translate(App.Vector(0,0,-offset) if mount['top'] else App.Vector(0,-offset,0))
                        blocked+=moving.common(local_base).Volume
                    assert blocked<1e-5,('Inner SMA hardware cannot be placed before feeding the jack',offset,blocked)
                    nut_drop.append({'offsetAxial' if mount['top'] else 'liftZ':offset,'blockedVolumeMm3':blocked})
                shrink=routed_clearance(mount['shrinkPath'],mount['shrinkClearanceDiameter'],endpoint_direction=[0,1 if mount['top'] else -1,0])
                shrink_hits=[]
                shrink_gaps=[]
                for child,expected in zip(children,case['components']):
                    blocked=shrink.common(child.Shape).Volume if shrink.optimalBoundingBox(False,True).intersect(child.Shape.optimalBoundingBox(False,True)) else 0
                    if blocked>1e-5:
                        shrink_hits.append({'part':expected['id'],'volumeMm3':blocked})
                    if expected['id'] in ['battery-retainer','heltec-board']:
                        shrink_gaps.append({'part':expected['id'],'distanceMm':scalar_distance(shrink,child.Shape)})
                assert not shrink_hits,('Authored first-lead/shrink reservation intersects physical parts',shrink_hits)
                shrink_battery=shrink.common(battery).Volume
                assert shrink_battery<1e-5,('Authored first-lead/shrink reservation intersects the maximum battery',shrink_battery)
                row.update(antennaPanelThicknessMm=panel_t,antennaCradleRootWitnessMissingMm3=cradle_missing,antennaCradleFiniteLoadPaths=cradle_paths,antennaDKeyRotationBlockedMm3=key_blocks,antennaIndependentHexTorqueStops=hex_blocks,antennaOuterEnvelopeCodeSHA256=hashlib.sha256(envelope_code.encode()).hexdigest(),antennaCompleteFlangeRecess={'provenOutwardReserveMm':.4,'outsideRoundedExteriorMm3':recess_missing,'actualFlangeAxialBoundsMm':[flange.optimalBoundingBox(False,False).ZMin,flange.optimalBoundingBox(False,False).ZMax]},antennaActualMatingFrontSpanMm=mating_span,antennaMatingCollar={'outerDiameterMm':11,'innerDiameterMm':6.6,'axialBoundsMm':[2.05,12.05],'obstructionsMm3':mating_hits},antennaJackInsertion=insertion,antennaNutToolBlockedVolumeMm3=tool_blocked,antennaToolInstalledBoardObstructionMm3=pcb_tool_blocked,antennaToolInstalledPowerObstructionMm3=power_tool_blocked,antennaInnerHardwarePlacement=nut_drop,antennaShrinkClearanceInterferences=shrink_hits,antennaShrinkClearanceDistancesMm=shrink_gaps,antennaShrinkBatteryBlockedVolumeMm3=shrink_battery,antennaRouteScope='Authored 12.7 mm first-lead clearance only; full 100 mm coax/AMC route and supplier bend-radius qualification excluded')
                print(json.dumps({'stage':'external-antenna-fit-complete','case':case['name']}),flush=True)
            else:
                assert not rf_pairs,'Internal antenna variant retains external SMA hardware'
                assert 'internal-fpc-reference' in reference_shapes,'Internal antenna envelope is missing'
                # The tail is curved: its surface at X0 is inside the Y=-53
                # extremum. Measure the actual uninterrupted wall across each
                # former port, rather than placing a cylinder partly in air.
                sealed=[]
                for side,z in [(1,13.5),(-1,7.8)]:
                    for x in [-3,-1.5,0,1.5,3]:
                        for dz in [-3,-1.5,0,1.5,3]:
                            if x*x+dz*dz>9.01:
                                continue
                            column=Part.makeBox(.08,7,.08,App.Vector(x-.04,47 if side>0 else -54,z+dz-.04))
                            wall=common_with_base(column,base.Shape)
                            assert wall.Solids,('Internal antenna wall is missing at a former SMA port',side,x,z+dz)
                            # A separate inner power pedestal can also cross this
                            # column. Only the outermost uninterrupted wall seals
                            # the enclosure; the pedestal cannot fill a port.
                            outer_wall=max(wall.Solids,key=lambda solid:side*solid.CenterOfMass.y)
                            thickness=outer_wall.optimalBoundingBox(False,False).YLength
                            assert thickness>=2.1,('Internal antenna variant leaves an SMA opening or thin wall',side,x,z+dz,thickness)
                            sealed.append({'end':side,'x':x,'z':z+dz,'wallThicknessMm':thickness})
                fpc=reference_shapes['internal-fpc-reference']
                gap=scalar_distance(fpc,lid.Shape)
                assert gap<.01,'The internal adhesive antenna does not meet its lid mounting face'
                row.update(internalAntennaClosedWallSections=sealed,internalAntennaLidAdhesiveGapMm=gap)
            if os.environ.get('HANDHELD_FEATURE_SCOPE')!='antenna':
                assert abs(base.Shape.optimalBoundingBox(False,False).XMax-guard_plane)<.01,'Right-hand guards miss expected flat support plane'
                bounds=base.Shape.optimalBoundingBox(False,False)
                roots=[]
                # The exact internal power front-stop may be a separate island
                # in a transverse slice; it joins the floor outside that slab.
                # It is wholly inside the cavity, far from the positive-X guard.
                front_bridge=d['powerButton']['frontBridge']
                power_stop=Part.makeBox(front_bridge['width'],front_bridge['backY']-front_bridge['frontY'],front_bridge['topZ']-front_bridge['bottomZ'],App.Vector(-front_bridge['width']/2,front_bridge['frontY'],front_bridge['bottomZ']))
                assert power_stop.optimalBoundingBox(False,False).XMax<min(button['x'] for button in d['buttons'] if button['x']>0)-d['wall']
                for y in sorted(set(d['guardSupportYs']+[-47.5,47.5])):
                    section=common_with_base(base.Shape,Part.makeBox(bounds.XLength+2,.3,bounds.ZLength+2,App.Vector(bounds.XMin-1,y-.15,bounds.ZMin-1)))
                    original_solids=section.Solids
                    guard_index=max(range(len(original_solids)),key=lambda i:original_solids[i].optimalBoundingBox(False,False).XMax)
                    for i,solid in enumerate(original_solids):
                        if i!=guard_index:
                            assert solid.cut(power_stop).Volume<1e-8,('A disconnected section is not the internal power stop',y,i)
                    guard_wall=section.cut(power_stop)
                    assert len(guard_wall.Solids)==1,('Guard is locally detached from the curved case wall',y,len(guard_wall.Solids))
                    roots.append({'y':y,'solids':len(guard_wall.Solids),'originalSliceSolids':len(original_solids),'exactPowerStopExcludedMm3':section.common(power_stop).Volume})
                row['guardRootSections']=roots
                contact=common_with_base(base.Shape,Part.makeBox(.05,bounds.YLength+2,bounds.ZLength+2,App.Vector(guard_plane-.05,bounds.YMin-1,bounds.ZMin-1)))
                contact_points,_=contact.tessellate(.01)
                footprint=hull([(round(point.y,6),round(point.z,6)) for point in contact_points])
                assert len(footprint)>=3,'Guard contact has no stable supporting footprint'
                area=abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(footprint,footprint[1:]+footprint[:1])))/2
                assert area>100,('Guard support footprint is too narrow',area)
                physical_solids=[solid for child in children for solid in child.Shape.Solids]
                volume=sum(solid.Volume for solid in physical_solids)
                center_y=sum(solid.CenterOfMass.y*solid.Volume for solid in physical_solids)/volume
                center_z=sum(solid.CenterOfMass.z*solid.Volume for solid in physical_solids)/volume
                assert inside_hull(footprint,(center_y,center_z)),'Guard contacts do not surround the projected volume centroid'
                open_corridors=[]
                for button in [button for button in case['layout']['buttons'] if button['x']>0]:
                    assert inside_hull(footprint,(button['y'],button['z'])),(button['id'],'Cap lies outside guard support footprint')
                    corridor=Part.makeBox(.8,16,bounds.ZLength+4,App.Vector(guard_plane-1,button['y']-8,bounds.ZMin-2))
                    blocked=common_with_base(base.Shape,corridor).Volume
                    assert blocked<1e-5,(button['id'],'Scallop is enclosed or obstructs top/bottom finger access',blocked)
                    open_corridors.append({'button':button['id'],'widthMm':16,'blockedVolumeMm3':blocked})
                row.update(guardSupportHullYZ=footprint,guardSupportAreaMm2=area,projectedVolumeCentroidYZ=[center_y,center_z],openScallopCorridors=open_corridors)
                button_bounds=[]
                fairing_rows=[]
                for child,expected in zip(children,case['components']):
                    if expected['libraryId']=='panel-switch' and expected['parameters']['model']=='daier-ds-225' and expected['placement']['translation'][0]>0:
                        clearance=guard_plane-child.Shape.optimalBoundingBox(False,False).XMax
                        assert clearance>=case['layout']['flatSurfaceClearance']-.01,(child.Label,'flat surface can reach button',clearance)
                        button_bounds.append(clearance)
                        x,y,z=expected['placement']['translation']
                        bezel_candidates=[solid for solid in child.Shape.Solids if abs(solid.optimalBoundingBox(False,False).YLength-15)<.02 and abs(solid.optimalBoundingBox(False,False).ZLength-15)<.02 and solid.optimalBoundingBox(False,False).XMax>x+2.9]
                        assert len(bezel_candidates)==1,'Cannot identify the canonical DS225 rectangular bezel'
                        bezel=bezel_candidates[0]
                        installed_bezel=bezel.common(Part.makeBox(2,20,20,App.Vector(x+.5,y-10,z-10)))
                        bezel_gap=scalar_distance(installed_bezel,base.Shape)
                        assert bezel_gap>=.20,('Fairing pinches the purchased bezel',expected['id'],bezel_gap)
                        shoulder=[]
                        # At the top/bottom, sample 0.5 mm outside the bezel,
                        # before the accepted rounded return withdraws. The
                        # side probes and front-exposure limits stay unchanged.
                        for dy,dz,projection in [(-9,0,2.4),(9,0,2.4),(0,-8,1.7),(0,8,1.7)]:
                            witness=Part.makeBox(.1,.1,.1,App.Vector(x+projection,y+dy-.05,z+dz-.05))
                            material=common_with_base(base.Shape,witness).Volume
                            assert material>=.00095,('Fairing fails to approach a bezel side',expected['id'],dy,dz,material)
                            shoulder.append(material)
                        # Inspect the collar immediately above the bezel. The
                        # protective cheek farther along Y intentionally projects
                        # beyond the bezel and is checked separately as a guard.
                        collar_width=bezel.optimalBoundingBox(False,False).YLength+3
                        upper=common_with_base(base.Shape,Part.makeBox(6,collar_width,12,App.Vector(x+.1,y-collar_width/2,z+7.55)))
                        collar_seam=collar_seam_witness(upper,d['seam'],expected['id'])
                        assert upper.optimalBoundingBox(False,False).XMax<bezel.optimalBoundingBox(False,False).XMax-.2,'Fairing covers the purchased bezel front'
                        fairing_rows.append({'button':expected['id'],'bezelRunningClearanceMm':bezel_gap,'shoulderWitnessVolumesMm3':shoulder,**collar_seam,'bezelFrontExposureMm':bezel.optimalBoundingBox(False,False).XMax-upper.optimalBoundingBox(False,False).XMax})
                assert len(button_bounds)==(1 if case['parameters']['bodyModel']=='web-grip' else 2)
                row['guardClearancesMm']=button_bounds
                row['bezelFairings']=fairing_rows
                all_bounds=assembly_bounds
                envelope=all_bounds.XLength*all_bounds.YLength*all_bounds.ZLength
                printed_volume=sum(child.Shape.Volume for child,expected in zip(children,case['components']) if 'printing' in expected.get('manufacturing',{}).get('processes',[]))
                assert envelope<=70*132*36*.8,('Enclosure has not materially reduced its external bulk',envelope)
                assert printed_volume<=85438.59660319137*.9,('Printed material has not decreased',printed_volume)
                row.update(envelopeVolumeMm3=envelope,envelopeReductionPercent=100*(1-envelope/(70*132*36)),printedVolumeMm3=printed_volume,printedVolumeReductionPercent=100*(1-printed_volume/85438.59660319137))
        total_volume=sum(child.Shape.Volume for child in children)
        solid_count=sum(len(child.Shape.Solids) for child in children)
        assert not problems,problems
        step=output/(case['name']+'.step')
        print(json.dumps({'stage':'step-roundtrip-start','case':case['name']}),flush=True)
        Part.export(children,str(step))
        restored=Part.Shape()
        restored.read(str(step))
        valid(restored,'STEP roundtrip',solid_count)
        step_error=abs(restored.Volume-total_volume)/total_volume
        assert step_error<1e-5,('STEP changed volume',step_error)
        print(json.dumps({'stage':'step-roundtrip-complete','case':case['name']}),flush=True)
        name,labels=root.Name,[child.Label for child in children]
        fcstd=output/(case['name']+'.FCStd')
        print(json.dumps({'stage':'fcstd-roundtrip-start','case':case['name']}),flush=True)
        doc.saveAs(str(fcstd))
        App.closeDocument(doc.Name)
        doc=App.openDocument(str(fcstd))
        root=doc.getObject(name)
        reopened=component_leaves(root)
        assert [child.Label for child in reopened]==labels,'FCStd component identities changed'
        for child in reopened:
            valid(child.Shape,child.Label)
        print(json.dumps({'stage':'fcstd-roundtrip-complete','case':case['name']}),flush=True)
        row.update(passed=True,components=len(children),solids=solid_count,dimensionsMm=[assembly_bounds.XLength,assembly_bounds.YLength,assembly_bounds.ZLength],maxBoundsErrorMm=max(bounds_errors),maxRelativeVolumeError=max(volume_errors),stepRelativeVolumeError=step_error,stepRoundtrip=True,fcstdRoundtrip=True,fcstdSHA256=hashlib.sha256(fcstd.read_bytes()).hexdigest(),stepSHA256=hashlib.sha256(step.read_bytes()).hexdigest())
    except Exception as error:
        row['error']=str(error)
        row['traceback']=traceback.format_exc()
    finally:
        row['scalarDistanceQueries']=distance_statistics
        if base_common_cache is not None:
            row['internalWitnessSubset'].update(subsetQueries=base_common_cache['subsetQueries'],fullQueries=base_common_cache['fullQueries'])
        if doc and doc.Name in App.listDocuments():
            App.closeDocument(doc.Name)
    report['cases'].append(row)
    report.update(passed=sum(item['passed'] for item in report['cases']),failed=sum(not item['passed'] for item in report['cases']),elapsedSeconds=time.perf_counter()-started)
    (output/os.environ.get('HANDHELD_REPORT_FILE','validation.json')).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(row),flush=True)
sys.exit(bool(report['failed']))
