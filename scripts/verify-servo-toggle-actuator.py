"""Audit the servo-toggle mounting assembly in an isolated FreeCAD Python.

node --import tsx scripts/verify-servo-toggle-actuator.ts [cases.json]
python scripts/verify-servo-toggle-actuator.py [cases.json] [report.json]

The printed rocker, single/dual parallel mechanisms and guided linkage are audited.
Purchased units remain atomic compounds. Their inherited internal source
contacts are not new assembly interference; every external component pair is
still checked. TPU geometry is only a proposed contact envelope, not a force
or material-compression certification.
"""
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

cases = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-servo-toggle-actuator-cases.json').read_text())
output = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/protolab-servo-toggle-actuator-results.json')
started = time.perf_counter()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]),
          'scope': 'Printed rocker, single/dual parallel-shaft rotors and guided linkage: OFF/ON rest, both push phases, inspection separation, retained source units, custom mounting details, external host-plate cutouts, authored cable/terminal approaches, guarded-switch travel and rotated left/right dual installation with engraved ARM 1 / ARM 2 legends; unchanged previous native proofs reused only with exact script and fixture hashes; no force or material-performance certification.', 'cases': []}


def save_row(row):
    report['cases'].append(row)
    report.update(passed=sum(item['passed'] for item in report['cases']), failed=sum(not item['passed'] for item in report['cases']),
                  componentOccurrences=sum(item.get('components', 0) for item in report['cases']), elapsedSeconds=time.perf_counter()-started)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2))
    print(json.dumps(row), flush=True)


def check_shape(shape, expected_solids=None):
    assert not shape.isNull() and shape.isValid() and shape.isClosed(), 'Expected valid closed native geometry'
    solids = shape.Solids
    assert solids and all(s.isValid() and s.isClosed() and s.Volume > 0 for s in solids), 'Invalid, open, empty or inward native solid'
    if expected_solids is not None:
        assert len(solids) == expected_solids, ('Native solid count differs', len(solids), expected_solids)
    return solids


def trim_bounds(shape):
    vertices, _ = shape.tessellate(0.005)
    result = App.BoundBox()
    for vertex in vertices:
        result.add(vertex)
    return [result.XMin, result.YMin, result.ZMin, result.XMax, result.YMax, result.ZMax]


def volume(shape):
    return 0 if shape.isNull() else sum(solid.Volume for solid in shape.Solids)


def overlap_volume(first, second):
    if not first.BoundBox.intersect(second.BoundBox):
        return 0
    return volume(first.common(second))


def rounded_opening(width, height, radius, centre, bottom, depth):
    x, y = centre
    shape = Part.makeBox(width-2*radius, height, depth, App.Vector(x-width/2+radius, y-height/2, bottom))
    shape = shape.fuse(Part.makeBox(width, height-2*radius, depth, App.Vector(x-width/2, y-height/2+radius, bottom)))
    for side in (-1, 1):
        for end in (-1, 1):
            shape = shape.fuse(Part.makeCylinder(radius, depth, App.Vector(x+side*(width/2-radius), y+end*(height/2-radius), bottom)))
    return shape.removeSplitter()



def planar_area(shape, z):
    return sum(face.Area for face in shape.Faces if face.Vertexes and all(abs(vertex.Point.z-z)<1e-7 for vertex in face.Vertexes))



def plane_contact_area(first, second, z):
    # Solid common intentionally discards zero-volume contact. Intersect the actual
    # coplanar boundary faces instead, normalizing only sub-tolerance Z roundoff.
    def at_plane(shape):
        faces=[]
        for face in shape.Faces:
            if face.Vertexes and all(abs(vertex.Point.z-z)<1e-7 for vertex in face.Vertexes):
                aligned=face.copy()
                aligned.translate(App.Vector(0,0,z-face.Vertexes[0].Point.z))
                faces.append(aligned)
        return faces
    return sum(a.common(b).Area for a in at_plane(first) for b in at_plane(second))


def ground_clip_fixtures(fixtures):
    clip = fixtures['groundClip']
    assert clip == {'finalMin':[-31.5,-4.5,-5.1], 'finalMax':[-14.5,4.5,-0.1], 'approachStroke':10}
    low,high = clip['finalMin'],clip['finalMax']
    final = Part.makeBox(*(b-a for a,b in zip(low,high)),App.Vector(*low))
    sweep = Part.makeBox(high[0]-low[0]+clip['approachStroke'],high[1]-low[1],high[2]-low[2],App.Vector(low[0]-clip['approachStroke'],low[1],low[2]))
    return final,sweep


def check_split_mount(case,children,fixtures,by_id):
    base,cradle,toggle = (by_id[name].Shape for name in ('parallel-base','parallel-cradle','toggle-switch'))
    assert fixtures['splitPlane'] == 0 and fixtures['gasketThickness'] == 0.8
    shoulder_area = plane_contact_area(base,cradle,0)
    assert shoulder_area > 10, ('Upper and lower parts need true rigid shoulders at Z0',shoulder_area)
    for x in (-20,20):
        for y in (-18,-63):
            collar_point = App.Vector(x+3,y,0.5)
            assert cradle.isInside(collar_point,1e-7,True) and not base.isInside(collar_point,1e-7,True), 'Male collar does not fit the upper socket'
            assert not base.isInside(App.Vector(x+4.1,y,0.5),1e-7,True), 'Diameter8.4 socket radial clearance lost'
            assert not base.isInside(App.Vector(x+3,y,1.1),1e-7,True), 'Socket depth must exceed the1mm collar by0.2mm'
    ties=[]
    for child,meta in zip(children,case['components']):
        if not meta['id'].startswith('parallel-clamp-screw-'):
            continue
        params=meta['parameters']
        assert params['diameter']==3 and params['length']==30 and params['pitch']==0.5
        nut_id=meta['id'].replace('screw','nut')
        nut=by_id[nut_id].Shape
        tip=child.Shape.BoundBox.ZMin
        protrusion=nut.BoundBox.ZMin-tip
        assert abs(tip+15.7)<1e-6 and abs(nut.BoundBox.ZMin+14)<1e-6 and abs(nut.BoundBox.ZMax+11.6)<1e-6, ('Native through-stack bounds differ',meta['id'],tip,nut.BoundBox.ZMin,nut.BoundBox.ZMax)
        assert protrusion >= 0.5 and abs(protrusion-1.7)<1e-6, ('Through tie does not retain full nut engagement',meta['id'],protrusion)
        assert child.Shape.BoundBox.ZMax < 17.5 and tip > -19.7+3.99
        ties.append({'id':meta['id'],'nutEngagementMm':nut.BoundBox.ZLength,'tipProtrusionMm':protrusion,'tipAboveOpenRimMm':tip+19.7})
    assert len(ties)==4
    source=fixtures['switchCase']
    assert source=={'size':[28,16,19],'origin':[-14,-8,-19],'pocketSize':[28.8,16.8],'yawNegativeControls':[-3,3]}
    # Retain the two actual source case solids. A Boolean crop of the complete
    # supplier compound is unreliable where its bushing/frame share interfaces.
    case_solids=[solid for solid in toggle.Solids if solid.BoundBox.ZMin >= -19-1e-5 and solid.BoundBox.ZMax <= 1e-5
                 and solid.BoundBox.XMin >= -14-1e-5 and solid.BoundBox.XMax <= 14+1e-5
                 and solid.BoundBox.YMin >= -8-1e-5 and solid.BoundBox.YMax <= 8+1e-5 and solid.Volume>100]
    assert len(case_solids)==2 and sum(solid.Volume for solid in case_solids)>8000, ('Expected actual insulator and metal case frame',len(case_solids))
    assert all(overlap_volume(solid,cradle)<1e-5 for solid in case_solids), 'Nominal source case does not fit the rigid pocket'
    yaw_controls=[]
    for yaw in source['yawNegativeControls']:
        collision=0
        for solid in case_solids:
            turned=solid.copy()
            turned.rotate(App.Vector(0,0,0),App.Vector(0,0,1),yaw)
            collision+=overlap_volume(turned,cradle)
        assert collision>1, ('The rigid case pocket does not bound yaw beyond its nominal0.4mm clearance',yaw,collision)
        yaw_controls.append({'yawDegrees':yaw,'interferenceMm3':collision})
    clip,clip_sweep=ground_clip_fixtures(fixtures)
    ground=[solid for solid in toggle.Solids if solid.BoundBox.XMin < -20 and solid.BoundBox.ZMin > -3.1 and solid.BoundBox.ZMax < -2.1]
    assert len(ground)==1 and overlap_volume(clip,ground[0])>0.1, 'Ground-clip fixture must actually enclose the source horizontal blade'
    clip_collisions=[]
    for child,meta in zip(children,case['components']):
        shapes=child.Shape.Solids
        if meta['id']=='toggle-switch':
            shapes=[solid for solid in shapes if not (solid.BoundBox.XMin < -20 and solid.BoundBox.ZMin > -3.1 and solid.BoundBox.ZMax < -2.1)]
        collision=sum(overlap_volume(clip_sweep,solid) for solid in shapes)
        if collision>1e-5:
            clip_collisions.append({'id':meta['id'],'interferenceMm3':collision})
    assert not clip_collisions, ('Ground clip final position or straight insertion stroke is obstructed',clip_collisions)
    gasket_rows=[]
    for name in ('parallel-switch-gasket','parallel-panel-gasket'):
        gasket=by_id[name].Shape
        assert abs(gasket.BoundBox.ZMin)<1e-6 and abs(gasket.BoundBox.ZLength-0.8)<1e-6
        footprint=planar_area(gasket,0)
        assert footprint>10 and abs(gasket.Volume-footprint*0.8)<1e-5, 'TPU must be an explicit nominal-thickness flat part'
        upper_contact=plane_contact_area(gasket,base,0.8)
        assert upper_contact>10, ('Nominal TPU gasket lacks a matching recess ceiling',name,upper_contact)
        item={'id':name,'thicknessMm':0.8,'flatAreaMm2':footprint,'upperSeatContactMm2':upper_contact}
        if name=='parallel-switch-gasket':
            case_contact=plane_contact_area(gasket,toggle,0)
            assert case_contact>1, ('Switch gasket does not meet actual case end regions',case_contact)
            item['caseContactMm2']=case_contact
        gasket_rows.append(item)
    bed_planes={'parallel-base':0,'parallel-cradle':-19.7,'parallel-clamp':17.5,'parallel-rocker':18.5,'parallel-switch-gasket':0,'parallel-panel-gasket':0}
    flat_faces=[]
    for name,z in bed_planes.items():
        area=planar_area(by_id[name].Shape,z)
        assert area>50, ('Printing detail lacks its claimed broad flat bed face',name,z,area)
        flat_faces.append({'id':name,'bedFaceInstalledZ':z,'flatAreaMm2':area})
    return {'rigidShoulderContactMm2':shoulder_area,'throughTieStacks':ties,'caseYawNegativeControls':yaw_controls,
            'groundClipAuthoredApproachClear':True,'groundClipScope':'Authored17×9×5mm envelope and10mm straight insertion stroke; actual mating-terminal tolerances require fitting.',
            'nominalGaskets':gasket_rows,'flatPrintFaces':flat_faces}



def clip_shapes(clip):
    low,high=clip['finalMin'],clip['finalMax']
    final=Part.makeBox(*(b-a for a,b in zip(low,high)),App.Vector(*low))
    sweep=Part.makeBox(high[0]-low[0]+clip['approachStroke'],high[1]-low[1],high[2]-low[2],App.Vector(low[0]-clip['approachStroke'],low[1],low[2]))
    return final,sweep


def fixture_transform(shape,translation,rotation):
    for axis,angle in zip((App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)),rotation):
        if angle:shape.rotate(App.Vector(),axis,angle)
    shape.translate(App.Vector(*translation))
    return shape


def source_fixture(expression,translation):
    shape=eval(expression,{'Part':Part,'App':App,'_pl_transform':fixture_transform}).removeSplitter()
    shape.translate(App.Vector(*translation))
    check_shape(shape,1)
    return shape


def box_separation(first,second):
    a,b=first.BoundBox,second.BoundBox
    return math.sqrt(sum(max(lo-hi2,lo2-hi,0)**2 for lo,hi,lo2,hi2 in ((a.XMin,a.XMax,b.XMin,b.XMax),(a.YMin,a.YMax,b.YMin,b.YMax),(a.ZMin,a.ZMax,b.ZMin,b.ZMax))))


def minimum_distance(shape,obstacles):
    result=float('inf')
    for obstacle in obstacles:
        if box_separation(shape,obstacle)<result:
            result=min(result,shape.distToShape(obstacle)[0])
    return result


def check_manual_switch(case,children,fixtures,by_id,host_coupons):
    manual=fixtures['manual'];guard=manual['guard']
    base,lower,unit=(by_id[name].Shape for name in ('parallel-base','parallel-cradle','manual-toggle-switch'))
    meta=next(item for item in case['components'] if item['id']=='manual-toggle-switch')
    assert meta['parameters']['model']=='daier-asw-07d-sac-01' and meta['placement']=={'translation':[0,-90,0],'rotation':[0,0,0]}
    state=case['parameters']['manualState']
    assert meta['parameters']['guard']==('closed' if state=='guarded-off' else 'open')
    assert meta['parameters']['position']==('last' if state=='open-on' else 'first')
    assert len(unit.Solids)==14 and manual['rearAxes']==[[-22,-101],[22,-79]]
    assert manual['webTop']==6.8
    nut_contact=plane_contact_area(base,unit,6.8)
    assert nut_contact>10, ('Guarded-source lower nut does not clamp the rear web',nut_contact)
    roi=Part.makeBox(56,44,1,App.Vector(-28,-112,-0.5))
    rear_shoulder=plane_contact_area(base.common(roi),lower.common(roi),0)
    assert rear_shoulder>10, ('Rear carrier has no local rigid split shoulder',rear_shoulder)
    stack=[]
    for index,(x,y) in enumerate(manual['rearAxes'],1):
        screw,nut=(by_id[f'manual-clamp-{kind}-{index}'].Shape for kind in ('screw','nut'))
        tip=screw.BoundBox.ZMin
        assert abs(tip+17)<1e-6 and abs(nut.BoundBox.ZMin+14)<1e-6 and abs(nut.BoundBox.ZLength-2.4)<1e-6
        assert abs(nut.BoundBox.ZMin-tip-3)<1e-6 and abs(tip+19.7-2.7)<1e-6
        assert lower.isInside(App.Vector(x+3,y,0.5),1e-7,True) and not base.isInside(App.Vector(x+3,y,0.5),1e-7,True)
        stack.append({'id':f'manual-clamp-screw-{index}','nutEngagementMm':2.4,'tipProtrusionMm':3,'tipAboveOpenRimMm':2.7})
    body=[solid for solid in unit.Solids if solid.BoundBox.ZMin>=-19-1e-5 and solid.BoundBox.ZMax<=1e-5 and solid.BoundBox.XMin>=-14-1e-5 and solid.BoundBox.XMax<=14+1e-5 and solid.BoundBox.YMin>=-98-1e-5 and solid.BoundBox.YMax<=-82+1e-5 and solid.Volume>100]
    assert len(body)==2 and sum(solid.Volume for solid in body)>8000
    yaw_controls=[]
    for yaw in (-3,3):
        collision=0
        for solid in body:
            turned=solid.copy();turned.rotate(App.Vector(0,-90,0),App.Vector(0,0,1),yaw)
            collision+=overlap_volume(turned,lower)
        assert collision>1
        yaw_controls.append({'yawDegrees':yaw,'interferenceMm3':collision})
    gasket=by_id['parallel-manual-gasket'].Shape
    assert abs(gasket.BoundBox.ZLength-0.8)<1e-6 and abs(gasket.BoundBox.ZMin)<1e-6
    gasket_upper=plane_contact_area(gasket,base,0.8);gasket_case=plane_contact_area(gasket,unit,0)
    assert gasket_upper>10 and gasket_case>10
    assert abs(gasket.Volume-planar_area(gasket,0)*0.8)<1e-5
    rearclip,rearsweep=clip_shapes(manual['groundClip'])
    ground=[solid for solid in unit.Solids if solid.BoundBox.XMin<-20 and solid.BoundBox.ZMin>-3.1 and solid.BoundBox.ZMax<-2.1]
    assert len(ground)==1 and overlap_volume(rearclip,ground[0])>0.1
    for child,expected in zip(children,case['components']):
        for solid in child.Shape.Solids:
            if expected['id']=='manual-toggle-switch' and solid.BoundBox.XMin<-20 and solid.BoundBox.ZMin>-3.1 and solid.BoundBox.ZMax<-2.1:continue
            assert overlap_volume(rearsweep,solid)<1e-5, ('Rear ground clip insertion is obstructed',expected['id'])
    assert all(overlap_volume(rearsweep,coupon)<1e-5 for coupon in host_coupons)
    cover_closed=source_fixture(guard['closedExpression'],manual['placement'])
    cover_open=source_fixture(guard['openExpression'],manual['placement'])
    expected=cover_closed if state=='guarded-off' else cover_open
    actual=unit.Solids[-1]
    assert abs(actual.Volume-expected.Volume)<1e-5 and max(abs(a-b) for a,b in zip(trim_bounds(actual),trim_bounds(expected)))<0.005, 'Retained SAC cover differs from catalog source'
    result={'manualSourceRetained':True,'manualGuardNutContactMm2':nut_contact,'manualRigidShoulderMm2':rear_shoulder,'manualThroughStacks':stack,'manualCaseYawControls':yaw_controls,'manualGasket':{'thicknessMm':0.8,'upperSeatContactMm2':gasket_upper,'caseContactMm2':gasket_case},'manualGroundClipApproachClear':True}
    if guard['auditSweep']:
        assert guard['pivot']==[15.5,-90,14.7] and guard['axis']==[0,1,0] and guard['opening']==69 and guard['sampleStep']==3
        pivot,axis=App.Vector(*guard['pivot']),App.Vector(*guard['axis'])
        bounds=cover_closed.BoundBox
        radius=max(math.hypot(x-pivot.x,z-pivot.z) for x in (bounds.XMin,bounds.XMax) for z in (bounds.ZMin,bounds.ZMax))
        gap_bound=2*radius*math.sin(math.radians(guard['sampleStep']/4))
        external=[child.Shape for child,expected in zip(children,case['components']) if expected['id']!='manual-toggle-switch']+host_coupons
        # This cylinder contains the opposed bar and its disc fasteners for every yaw.
        rotor_envelope=Part.makeCylinder(33,13.6,App.Vector(0,-28,14.5))
        for child,expected in zip(children,case['components']):
            if expected['id']=='parallel-rocker' or expected['id'].startswith('parallel-disc-'):
                assert volume(child.Shape.cut(rotor_envelope))<1e-5, ('Moving front hardware escapes the all-yaw envelope',expected['id'])
        external.append(rotor_envelope)
        cover_min=float('inf')
        for angle in range(0,70,3):
            moved=cover_closed.copy();moved.rotate(pivot,axis,angle)
            clearance=minimum_distance(moved,external)
            cover_min=min(cover_min,clearance)
            assert clearance>gap_bound+1e-6, ('Guard sweep clearance is smaller than its between-sample motion bound',angle,clearance,gap_bound)
        # The manual lever sweeps only with the cover fully open. A closed cover
        # intentionally acts on the lever; that interlock is not a clearance test.
        lever_pivot=App.Vector(*guard['leverPivot']);lever_min=float('inf')
        lever_shapes=[source_fixture(expression,manual['placement']) for expression in guard['firstLeverExpressions']]
        assert len(lever_shapes)==2
        lever_radius=max(math.hypot(x-lever_pivot.x,z-lever_pivot.z) for lever in lever_shapes for x in (lever.BoundBox.XMin,lever.BoundBox.XMax) for z in (lever.BoundBox.ZMin,lever.BoundBox.ZMax))
        lever_motion_bound=2*lever_radius*math.sin(math.radians(0.5))
        for angle in range(-12,13,2):
            for lever in lever_shapes:
                moved=lever.copy();moved.rotate(lever_pivot,axis,angle+12)
                clearance=minimum_distance(moved,external+[cover_open])
                lever_min=min(lever_min,clearance)
                assert clearance>lever_motion_bound+1e-6, ('Open guard does not clear the complete manual lever path',angle,clearance)
        result['modeledGuardSweep']={'rangeDegrees':[0,69],'poses':24,'minimumClearanceMm':cover_min,'betweenSampleMotionBoundMm':gap_bound,'continuousExternalClearanceProved':True,'scope':'Modeled catalog69-degree opening; hinge/angle/seat are illustrative, not verified hardware stops or interlock performance.'}
        result['modeledManualLeverSweep']={'rangeDegrees':[-12,12],'poses':13,'minimumClearanceMm':lever_min,'betweenSampleMotionBoundMm':lever_motion_bound,'continuousExternalClearanceProved':True,'guard':'fully open'}
    return result


def check_installation_canonical(case, children):
    fixtures = case.get('installationFixtures')
    if fixtures is None:
        return {}
    assert case['mechanism'] in ('parallel','parallel-dual') and case['state'] == 'assembled', 'Installation fixtures belong to the installed parallel mechanism'
    host, cable = fixtures['hostPlate'], fixtures['cableApproach']
    by_id = {expected['id']: child for child,expected in zip(children,case['components'])}
    base, cradle = by_id['parallel-base'].Shape, by_id['parallel-cradle'].Shape
    toggle = by_id['toggle-switch'].Shape
    assert host['top'] == 0 and host['thicknesses'] == [1, 3, 6]
    dual = case['mechanism']=='parallel-dual'
    assert host['opening'] == {'size': [56,124 if dual else 84], 'centre': [0,-48 if dual else -28], 'radius': 4}
    assert cable['nativeMin'] == [-10, -9, -35] and cable['nativeMax'] == [35, 9, -4.2]
    assert abs(cable['sourceRearFace']-cable['nativeMax'][2]-0.1) < 1e-9
    assert cable['translation'] == [0, -28, -15.2] and cable['rotation'] == [0, 0, -90]
    low, high = cable['nativeMin'], cable['nativeMax']
    corridor = Part.makeBox(*(b-a for a,b in zip(low, high)), App.Vector(*low))
    corridor.Placement = App.Placement(App.Vector(*cable['translation']), App.Rotation(App.Vector(0, 0, 1), -90))
    # The supplier source omits sockets and plugs: this is strictly a printed-mount approach envelope.
    mount_parts = [(child, expected) for child,expected in zip(children, case['components']) if expected['supply'] != 'purchased']
    cable_overlaps = [{'id': expected['id'], 'volumeMm3': overlap_volume(corridor, child.Shape)} for child,expected in mount_parts]
    assert all(item['volumeMm3'] < 1e-5 for item in cable_overlaps), ('Authored underside cable corridor obstructed', cable_overlaps)
    host_rows = []
    host_coupons=[]
    width, height = host['size']
    for thickness in host['thicknesses']:
        coupon = Part.makeBox(width, height, thickness, App.Vector(host['centre'][0]-width/2, host['centre'][1]-height/2, -thickness))
        for x,y in host['holes']:
            coupon = coupon.cut(Part.makeCylinder(host['holeDiameter']/2, thickness+2, App.Vector(x, y, -thickness-1)))
        negative = sum(overlap_volume(coupon, child.Shape) for child in children)
        assert negative > 1, ('Uncut host negative control did not detect the hanging body', thickness, negative)
        opening = host['opening']
        coupon = coupon.cut(rounded_opening(*opening['size'], opening['radius'], opening['centre'], -thickness-1, thickness+2))
        branch = host['sideBranch']
        assert branch == {'size':[16,12], 'centre':[-34,0], 'radius':2}
        main_only = coupon.copy()
        coupon = coupon.cut(rounded_opening(*branch['size'], branch['radius'], branch['centre'], -thickness-1, thickness+2))
        if dual:
            extra=host['rearSideBranch']
            assert extra=={'size':[16,12],'centre':[-34,-90],'radius':2}
            coupon=coupon.cut(rounded_opening(*extra['size'],extra['radius'],extra['centre'],-thickness-1,thickness+2))
        check_shape(coupon, 1)
        collisions = [{'id': expected['id'], 'volumeMm3': overlap_volume(coupon, child.Shape)} for child,expected in zip(children, case['components'])]
        assert all(item['volumeMm3'] < 1e-5 for item in collisions), ('Host plate cutout obstructs installed components', thickness, collisions)
        cable_overlap = overlap_volume(coupon, corridor)
        assert cable_overlap < 1e-5, ('Host plate obstructs underside cable corridor', thickness, cable_overlap)
        clip, clip_sweep = ground_clip_fixtures(fixtures)
        assert overlap_volume(coupon,clip_sweep) < 1e-5, ('Host terminal notch obstructs the clip approach',thickness)
        notch_negative = overlap_volume(main_only,clip_sweep)
        assert notch_negative > 1, ('Plain rectangular opening fails to exercise the ground-clip notch',thickness)
        gasket = by_id['parallel-panel-gasket'].Shape
        gasket_contact = plane_contact_area(gasket,coupon,0)
        hard_seat_contact = plane_contact_area(base,coupon,0)
        assert gasket_contact > 10 and hard_seat_contact > 10, ('TPU and rigid M4 lands must both meet the host plane',gasket_contact,hard_seat_contact)
        host_coupons.append(coupon)
        if dual:
            rearclip,rearsweep=clip_shapes(fixtures['manual']['groundClip'])
            assert overlap_volume(coupon,rearsweep)<1e-5, 'Rear terminal notch obstructs clip insertion'
            assert overlap_volume(main_only,rearsweep)>1, 'Rear terminal notch negative control did not obstruct insertion'
        host_rows.append({'thicknessMm': thickness, 'externalInterferences': 0, 'uncutNegativeControlMm3': negative, 'cableInterferenceMm3': cable_overlap, 'terminalNotchNegativeControlMm3':notch_negative, 'panelGasketContactMm2':gasket_contact, 'hardLandContactMm2':hard_seat_contact})
    rotor = next(child.Shape for child,expected in zip(children, case['components']) if expected['id'] == 'parallel-rocker')
    static_mount = [child.Shape for child,expected in mount_parts if expected['supply'] == 'manufactured' and expected['id'] != 'parallel-rocker' or expected['id'].startswith(('parallel-clamp-screw-', 'parallel-clamp-nut-', 'manual-clamp-'))]
    clearance = rotor.BoundBox.ZMin-max(shape.BoundBox.ZMax for shape in static_mount)
    assert clearance >= fixtures['minimumRotorClearance']-1e-6, ('Full rotary sweep must clear the entire stationary mount and clamp heads', clearance)
    result = check_split_mount(case,children,fixtures,by_id)
    if dual:
        result.update(check_manual_switch(case,children,fixtures,by_id,host_coupons))
    result.update(hostPlateInstallation=host_rows,authoredCableApproachClear=True,cableScope=cable['scope'],fullSweepMountClearanceMm=clearance)
    return result


def check_dual_world(case,children):
    by_id={meta['id']:child for child,meta in zip(children,case['components'])}
    metadata={meta['id']:meta for meta in case['components']}
    assert metadata['manual-toggle-switch']['placement']=={'translation':[-90,0,0],'rotation':[0,0,-90]}, 'Manual switch must be left in the final world frame'
    assert metadata['drive-servo']['placement']=={'translation':[-28,0,-15.2],'rotation':[0,0,-180]}, 'Servo source axes differ in the final world frame'
    assert metadata['toggle-switch']['placement']=={'translation':[0,0,0],'rotation':[0,0,-90]}, 'Driven switch must remain at the right-hand datum'
    plate=by_id['parallel-base'].Shape.BoundBox
    assert abs(plate.XLength-case['parameters']['baseWidth'])<0.001 and abs(plate.YLength-case['parameters']['baseLength'])<0.001
    assert abs((plate.XMin+plate.XMax)/2+47)<0.001 and abs((plate.YMin+plate.YMax)/2)<0.001
    if case['state']=='assembled':
        for name,centre in (('manual-toggle-switch',-90),('toggle-switch',0)):
            body=[solid for solid in by_id[name].Shape.Solids if solid.BoundBox.ZMin>=-19-1e-5 and solid.BoundBox.ZMax<=1e-5 and solid.BoundBox.XMin>=centre-8-1e-5 and solid.BoundBox.XMax<=centre+8+1e-5 and solid.BoundBox.YMin>=-14-1e-5 and solid.BoundBox.YMax<=14+1e-5 and solid.Volume>100]
            assert len(body)==2 and sum(solid.Volume for solid in body)>8000, 'Actual source cases must follow the rotated long-axis orientation'
    base=by_id['parallel-base'].Shape
    legends=[]
    for index,(cx,expected_removed) in enumerate(((-90,29.5485),(0,31.31025))):
        probes=[(cx-11.325,-38.3,False),(cx-9.575,-35.8,True),(cx-5.325,-37.5,False),(cx-3.875,-35,True),(cx+0.825,-37.8,False),(cx+6.275,-36,True),(cx+9.575,-38.4,False),(cx+8.375,-37.5,index==0)]
        for x,y,retained in probes:
            assert base.isInside(App.Vector(x,y,5.7),1e-7,True)==retained, ('Engraved legend content differs',index+1,x,y)
            assert base.isInside(App.Vector(x,y,5.39),1e-7,True), 'Engraving cuts below its Z5.4 floor'
            if not retained:assert not base.isInside(App.Vector(x,y,5.41),1e-7,True)
        slab=Part.makeBox(24.4,6.2,0.7,App.Vector(cx-12.2,-39.1,5.3))
        removed=slab.Volume-volume(base.common(slab))
        assert abs(removed-expected_removed)<1e-4, ('Engraving removed volume differs',index+1,removed,expected_removed)
        legends.append({'text':f'ARM {index+1}','centre':[cx,-36],'depthMm':0.6,'absoluteFloorZ':5.4,'removedVolumeMm3':removed,'strokeCounterAndSpaceProbes':8})
    assert abs(planar_area(base,5.4)-(29.5485+31.31025)/0.6)<1e-4, 'Legend floor faces differ from Z5.4'
    return {'worldLayout':{'manualCentre':[-90,0,0],'servoCentre':[-28,0,-15.2],'drivenCentre':[0,0,0],'plateCentre':[-47,0],'rigidRotationZ':-90},'engravedLegends':legends}



def check_installation(case,children):
    if case['mechanism']!='parallel-dual':
        return check_installation_canonical(case,children)
    result=check_dual_world(case,children)
    if case.get('installationFixtures') is None:
        return result
    assert case['installationFixtures']['frame']=={'worldRotationZ':-90,'fixtureRotationZ':90}
    # Clone only for mechanical fixture checks. The original document, collision
    # checks, preview comparisons and both CAD roundtrips stay in the world frame.
    canonical=[]
    for child in children:
        shape=child.Shape.copy();shape.rotate(App.Vector(),App.Vector(0,0,1),90)
        canonical.append(SimpleNamespace(Shape=shape))
    canonical_case={**case,'components':json.loads(json.dumps(case['components']))}
    for meta in canonical_case['components']:
        placement=meta.get('placement')
        if placement is None:continue
        x,y,z=placement['translation'];placement['translation']=[round(-y,9),round(x,9),z]
        rotation=placement['rotation'];rotation[2]=round((rotation[2]+270)%360-180,9)
    result.update(check_installation_canonical(canonical_case,canonical))
    result['fixtureFrame']={'canonicalRotationZ':90,'worldGeometryUntouched':True}
    return result


with tempfile.TemporaryDirectory(prefix='protolab-servo-toggle-actuator-') as directory:
    for case in cases:
        mode = case['parameters']['mechanism']
        row = {'name': case['name'], 'mechanism': mode, 'passed': False, 'codeSha256': hashlib.sha256(case['script'].encode()).hexdigest()}
        if case.get('installationFixtures') is not None:
            row['installationFixtureSha256'] = hashlib.sha256(json.dumps(case['installationFixtures'], separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
            assert row['installationFixtureSha256'] == case['installationFixtureSha256'], 'Installation fixture hash differs'
        cached = case.get('cachedNativeValidation')
        if cached and cached.get('passed') and cached.get('name') == row['name'] and cached.get('codeSha256') == row['codeSha256'] and cached.get('installationFixtureSha256') == row.get('installationFixtureSha256'):
            save_row({**cached, 'cachedNativeValidation': True, 'cachedReport': case['cachedReport']})
            continue
        doc = App.newDocument('ServoToggleActuatorAudit')
        try:
            sentinel = doc.addObject('App::FeaturePython', 'ExistingObject')
            exec(case['script'], {})
            roots = [obj for obj in doc.RootObjects if obj != sentinel]
            assert len(roots) == 1 and doc.getObject(sentinel.Name), 'Macro changed an existing object or made multiple roots'
            root = roots[0]
            assert root.PartId == case['id'] and root.ModelState == case['state'], 'Assembly identity/state differs'
            assert json.loads(root.Configuration) == case['parameters'], 'Assembly configuration differs'
            children = list(root.Group) if root.TypeId == 'App::Part' else [root]
            assert len(children) == len(case['components']), 'Preview/native top-level component count differs'
            expected_libraries = [item['libraryId'] for item in case['components']]
            assert expected_libraries == case['compositionLibraryIds'], 'Inspection view changed physical composition'
            assert expected_libraries.count('bus-servo') == 1 and expected_libraries.count('panel-switch') == (2 if mode=='parallel-dual' else 1), 'Purchased source units must each occur once'
            assert mode in ('rocker', 'guided', 'parallel','parallel-dual') and case['mechanism'] == mode, 'Unsupported or inconsistent mechanism'
            manufactured = [item for item in case['components'] if item['requireSingleSolid']]
            expected_manufactured = 27 if mode == 'guided' else 7 if mode=='parallel-dual' else 6 if mode == 'parallel' else 3
            assert len(manufactured) == expected_manufactured == case['expectedManufactured'], 'Mechanism fabrication contract differs'
            if mode == 'rocker':
                assert not any(word in (item['id']+' '+item['label']).lower() for item in manufactured for word in ('slider', 'guide', 'shaft', 'scotch')), 'Printed rocker unexpectedly contains linear guidance'
                servo = next(item for item in case['components'] if item['libraryId'] == 'bus-servo')
                toggle = next(item for item in case['components'] if item['libraryId'] == 'panel-switch')
                assert servo['placement']['rotation'] == [90, 0, 0] and toggle['placement']['rotation'] == [0, 0, 0], 'Rocker source axes differ'
            if mode in ('parallel','parallel-dual'):
                assert {item['id'] for item in manufactured} == {'parallel-base', 'parallel-cradle', 'parallel-clamp', 'parallel-rocker', 'parallel-switch-gasket', 'parallel-panel-gasket'} | ({'parallel-manual-gasket'} if mode=='parallel-dual' else set()), 'Parallel print boundaries differ'
                assert len(case['components']) == (30 if mode=='parallel-dual' else 24), 'Split parallel mechanism must retain six printed details, four common M3 ties and four source-disc fasteners'
                assert sum('PETG' in item['manufacturing']['material'] for item in manufactured) == 4
                assert sum('TPU' in item['manufacturing']['material'] for item in manufactured) == (3 if mode=='parallel-dual' else 2)
                servo = next(item for item in case['components'] if item['libraryId'] == 'bus-servo')
                toggle = next(item for item in case['components'] if item['libraryId'] == 'panel-switch')
                assert servo['placement']['rotation'] == ([0,0,-180] if mode=='parallel-dual' else [0,0,-90]) and toggle['placement']['rotation'] == ([0,0,-90] if mode=='parallel-dual' else [0,0,0]), 'Parallel source axes differ'
            bounds_errors, volume_errors = [], []
            for child, expected in zip(children, case['components']):
                assert child.Label == expected['label'] or child.Label.startswith(expected['label']+' · threads: '), ('Component label differs', child.Label, expected['label'])
                assert child.LibraryId == expected['libraryId'], ('Library identity differs', child.Label)
                assert json.loads(child.ConfigurationJSON) == expected['parameters'], ('Child configuration differs', child.Label)
                assert child.Supply == expected['supply'], ('Child supply identity differs', child.Label)
                try:
                    solids = check_shape(child.Shape, 1 if expected['requireSingleSolid'] else expected['sourceSolids'])
                except AssertionError as error:
                    raise AssertionError((child.Label, str(error))) from error
                errors = [abs(a-b) for a,b in zip(trim_bounds(child.Shape), expected['min']+expected['max'])]
                assert max(errors) < 0.05, (child.Label, 'Preview/native envelope differs', max(errors))
                bounds_errors.extend(errors)
                measured = sum(s.Volume for s in solids)
                error = abs(measured-expected['volume'])/measured
                assert error < 0.015, (child.Label, 'Preview/native volume differs', error)
                volume_errors.append(error)
            intersections = []
            for i, first in enumerate(children):
                for j in range(i+1, len(children)):
                    second = children[j]
                    if not first.Shape.BoundBox.intersect(second.Shape.BoundBox):
                        continue
                    common = first.Shape.common(second.Shape)
                    overlap = 0 if common.isNull() else sum(s.Volume for s in common.Solids)
                    first_volume = sum(s.Volume for s in first.Shape.Solids)
                    second_volume = sum(s.Volume for s in second.Shape.Solids)
                    if overlap > max(1e-5, min(first_volume, second_volume)*1e-7):
                        intersections.append({'first': case['components'][i]['id'], 'second': case['components'][j]['id'], 'firstLabel': first.Label, 'secondLabel': second.Label, 'volumeMm3': overlap})
            row['externalInterferences'] = intersections
            assert not intersections, ('Installed components intersect', intersections)
            row.update(check_installation(case, children))
            # Moving one physical occurrence must not move another source unit or detail.
            centres = [App.Vector(child.Shape.Solids[0].CenterOfMass) for child in children]
            saved = App.Placement(children[0].Placement)
            delta = App.Vector(3,-4,5)
            children[0].Placement.Base += delta
            doc.recompute()
            assert (children[0].Shape.Solids[0].CenterOfMass-centres[0]-delta).Length < 1e-6
            assert all((child.Shape.Solids[0].CenterOfMass-old).Length < 1e-6 for child,old in zip(children[1:], centres[1:])), 'Occurrence movement leaked into another component'
            children[0].Placement = saved
            doc.recompute()
            count = sum(len(child.Shape.Solids) for child in children)
            total_volume = sum(s.Volume for child in children for s in child.Shape.Solids)
            step_path = str(Path(directory)/'servo-toggle-actuator.step')
            Part.export(children, step_path)
            restored = Part.Shape()
            restored.read(step_path)
            check_shape(restored, count)
            step_error = abs(sum(s.Volume for s in restored.Solids)-total_volume)/total_volume
            assert step_error < 1e-5, ('STEP volume differs', step_error)
            root_name, labels = root.Name, [child.Label for child in children]
            fcstd_path = str(Path(directory)/'servo-toggle-actuator.FCStd')
            doc.saveAs(fcstd_path)
            App.closeDocument(doc.Name)
            doc = App.openDocument(fcstd_path)
            reopened_root = doc.getObject(root_name)
            assert reopened_root.PartId == case['id'] and json.loads(reopened_root.Configuration) == case['parameters']
            reopened = list(reopened_root.Group) if reopened_root.TypeId == 'App::Part' else [reopened_root]
            assert [child.Label for child in reopened] == labels, 'FCStd component labels differ'
            for child, expected in zip(reopened, case['components']):
                check_shape(child.Shape, 1 if expected['requireSingleSolid'] else expected['sourceSolids'])
                assert child.LibraryId == expected['libraryId'] and child.Supply == expected['supply'], 'FCStd source/procurement identity differs'
                assert json.loads(child.ConfigurationJSON) == expected['parameters'], 'FCStd child configuration differs'
            row.update(passed=True, components=len(children), solids=count, manufacturedComponents=sum(c['requireSingleSolid'] for c in case['components']),
                       maxBoundsError=max(bounds_errors), maxRelativeVolumeError=max(volume_errors),
                       independentMovement=True, stepRoundtrip=True, stepRelativeVolumeError=step_error,
                       fcstdRoundtrip=True, inheritedServoInternalContactChecked=False)
        except Exception as error:
            row['error'] = str(error)
        finally:
            if doc and doc.Name in App.listDocuments():
                App.closeDocument(doc.Name)
        save_row(row)
sys.exit(bool(report['failed']))
