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
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time
import zlib
from types import SimpleNamespace

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part

cases = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-servo-toggle-actuator-cases.json').read_text())
output = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/protolab-servo-toggle-actuator-results.json')
started = time.perf_counter()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'freecad': '.'.join(App.Version()[:3]),
          'scope': 'Printed rocker, single/dual parallel-shaft rotors and guided linkage: OFF/ON rest, both push phases, inspection separation, retained source cases, explicitly reworked M3 disc sandwich with stepped rocker and continuous-yaw mount clearance, source-disc machining and internal fit, upper and lower stationary shaft-end case contacts with displacement controls, external host-plate cutouts, terminal-clip approaches, guarded-switch travel and rotated dual installation with ARM 1 / ARM 2 legends, flat supported PETG flanges with 1.5 mm external TPU sheets and a 0.2 mm top-open SAC locating seat; previous proofs reused only with exact script and fixture hashes; no force or material-performance certification.', 'cases': []}


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
    assert clip == {'finalMin':[14.5,-7,-5.1], 'finalMax':[31.5,7,-0.1], 'approachStroke':10,'lateralOffsets':[-1,0,1]}
    return clip_shapes(clip)


def flange_support_metrics(base,bottom,top):
    faces=[face for face in base.Faces if face.Vertexes and all(abs(vertex.Point.z-bottom)<1e-7 for vertex in face.Vertexes)]
    assert faces, 'Flange has no actual planar first-layer face'
    envelope=Part.makeCompound([face.extrude(App.Vector(0,0,top-bottom)) for face in faces])
    bounds=base.BoundBox
    slab=Part.makeBox(bounds.XLength+2,bounds.YLength+2,top-bottom,App.Vector(bounds.XMin-1,bounds.YMin-1,bottom))
    flange=base.common(slab)
    unsupported=volume(flange.cut(envelope))
    ceilings=[]
    for face in base.Faces:
        if not face.Vertexes:continue
        z=face.Vertexes[0].Point.z
        if not bottom+1e-6<z<top-1e-6 or not all(abs(vertex.Point.z-z)<1e-7 for vertex in face.Vertexes):continue
        low_u,high_u,low_v,high_v=face.ParameterRange
        if face.normalAt((low_u+high_u)/2,(low_v+high_v)/2).z < -0.999:
            ceilings.append({'heightZ':z,'areaMm2':face.Area})
    return {'firstLayerFaceAreaMm2':sum(face.Area for face in faces),'unsupportedVolumeMm3':unsupported,'internalDownwardCeilings':ceilings}


def check_flat_flange(case,base,fixtures):
    bottom,top=fixtures['flangeBottom'],fixtures['flangeTop']
    assert bottom==1.5 and top==7.5 and abs(top-bottom-6)<1e-9
    assert abs(base.BoundBox.ZMin-bottom)<1e-7, 'PETG flange must start on one common flat Z1.5 plane'
    metrics=flange_support_metrics(base,bottom,top)
    assert metrics['firstLayerFaceAreaMm2']>500, ('Flange first layer lacks its broad mounting footprint',metrics)
    assert metrics['unsupportedVolumeMm3']<1e-5, ('Flange material overhangs its actual first-layer footprint',metrics)
    assert not metrics['internalDownwardCeilings'], ('Blind underside pocket creates a support ceiling within the flange',metrics)
    # A real blind underside pocket must be rejected by both independent criteria.
    x=case['parameters']['baseLength']/2-4
    y=-47 if case['mechanism']=='parallel-dual' else -27
    negative=base.cut(Part.makeCylinder(1,0.7,App.Vector(x,y,bottom-0.1)))
    control=flange_support_metrics(negative,bottom,top)
    assert control['unsupportedVolumeMm3']>1 and len(control['internalDownwardCeilings'])>=1, ('Blind-pocket negative control failed to detect an unsupported roof',control)
    return {'flangeBottomZ':bottom,'flangeTopZ':top,'flangeThicknessMm':6,'externalTpuThicknessMm':1.5,**metrics,'blindPocketNegativeControl':control,'scope':'All PETG material within the 6 mm flange is supported by its real common bottom face; upper sleeve and lower cradle print features are audited separately.'}


def check_split_mount(case,children,fixtures,by_id):
    base,cradle,toggle = (by_id[name].Shape for name in ('parallel-base','parallel-cradle','toggle-switch'))
    assert fixtures['splitPlane'] == 1.5 and fixtures['gasketThickness'] == 1.5
    shoulder_area = plane_contact_area(base,cradle,1.5)
    assert shoulder_area > 10, ('Upper and lower parts need true rigid shoulders at Z1.5',shoulder_area)
    for x in (-20,20):
        for y in (-18,-63):
            assert cradle.isInside(App.Vector(x+3,y,1.2),1e-7,True) and not base.isInside(App.Vector(x+3,y,1.2),1e-7,True), 'Cradle must rise to a flat Z1.5 shoulder'
            assert not cradle.isInside(App.Vector(x+3,y,1.6),1e-7,True), 'Cradle must not have upward locating collars'
            for z in (1.6,2.6,4.6,7.4):
                assert base.isInside(App.Vector(x+3,y,z),1e-7,True), 'Blind underside locator or relief interrupts the flat flange web'

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
    ground_clip_fixtures(fixtures)
    clip_rows=check_ground_clip_approach(case,children,fixtures['groundClip'],'toggle-switch',0)
    gasket_rows=[]
    for name in ('parallel-switch-gasket','parallel-panel-gasket'):
        gasket=by_id[name].Shape
        assert abs(gasket.BoundBox.ZMin)<1e-6 and abs(gasket.BoundBox.ZLength-1.5)<1e-6
        footprint=planar_area(gasket,0)
        assert footprint>10 and abs(gasket.Volume-footprint*1.5)<1e-5, 'TPU must be an explicit nominal-thickness flat part'
        upper_contact=plane_contact_area(gasket,base,1.5)
        assert upper_contact>10, ('External TPU sheet lacks contact with the common flat PETG underside',name,upper_contact)
        item={'id':name,'thicknessMm':1.5,'flatAreaMm2':footprint,'upperSeatContactMm2':upper_contact}
        if name=='parallel-switch-gasket':
            case_contact=plane_contact_area(gasket,toggle,0)
            assert case_contact>1, ('Switch gasket does not meet actual case end regions',case_contact)
            item['caseContactMm2']=case_contact
        gasket_rows.append(item)
    bed_planes={'parallel-base':1.5,'parallel-cradle':-19.7,'parallel-clamp':17.5,'parallel-rocker':26.5,'parallel-switch-gasket':0,'parallel-panel-gasket':0}
    flat_faces=[]
    for name,z in bed_planes.items():
        area=planar_area(by_id[name].Shape,z)
        assert area>50, ('Printing detail lacks its claimed broad flat bed face',name,z,area)
        flat_faces.append({'id':name,'bedFaceInstalledZ':z,'flatAreaMm2':area})
    return {'rigidShoulderContactMm2':shoulder_area,'throughTieStacks':ties,'caseYawNegativeControls':yaw_controls,
            'drivenSwitchNutSeat':check_switch_nut_seat(base,toggle,fixtures,0),
            'groundClipAuthoredApproachClear':True,'groundClipOffsetCases':clip_rows,'groundClipScope':'Authored 17 × 14 × 5 mm envelope, lateral offsets -1/0/+1 mm and 10 mm straight insertion stroke; actual mating-terminal tolerances require fitting.',
            'nominalGaskets':gasket_rows,'flatPrintFaces':flat_faces,'flatFlangeManufacturability':check_flat_flange(case,base,fixtures)}



def clip_shapes(clip,lateral_offset=0):
    low,high=clip['finalMin'],clip['finalMax']
    origin=App.Vector(low[0],low[1]+lateral_offset,low[2])
    final=Part.makeBox(*(b-a for a,b in zip(low,high)),origin)
    sweep=Part.makeBox(high[0]-low[0]+clip['approachStroke'],high[1]-low[1],high[2]-low[2],origin)
    return final,sweep


def check_ground_clip_approach(case,children,clip,unit_id,centre_y,host_coupons=()):
    assert clip=={'finalMin':[14.5,centre_y-7,-5.1],'finalMax':[31.5,centre_y+7,-0.1],'approachStroke':10,'lateralOffsets':[-1,0,1]}
    unit=next(child.Shape for child,meta in zip(children,case['components']) if meta['id']==unit_id)
    ground=[solid for solid in unit.Solids if solid.BoundBox.XMax>20 and solid.BoundBox.ZMin>-3.1 and solid.BoundBox.ZMax<-2.1]
    assert len(ground)==1, 'Expected the actual horizontal switch ground blade'
    # Restore just the two wall strips removed by widening the former 10 mm
    # channel. A realistic clip must hit this independent obstruction control.
    old_walls=Part.makeCompound([Part.makeBox(4.6,4.2,6.8,App.Vector(14.4,centre_y+y,-6)) for y in (-9.2,5)])
    rows=[]
    for offset in clip['lateralOffsets']:
        final,sweep=clip_shapes(clip,offset)
        assert overlap_volume(final,ground[0])>0.1, 'Offset clip fixture does not actually enclose the source horizontal blade'
        collisions=[]
        for child,meta in zip(children,case['components']):
            solids=child.Shape.Solids
            if meta['id']==unit_id:
                solids=[solid for solid in solids if not (solid.BoundBox.XMax>20 and solid.BoundBox.ZMin>-3.1 and solid.BoundBox.ZMax<-2.1)]
            collision=sum(overlap_volume(sweep,solid) for solid in solids)
            if collision>1e-5:collisions.append({'id':meta['id'],'interferenceMm3':collision})
        assert not collisions, ('Offset ground clip or its insertion stroke is obstructed',unit_id,offset,collisions)
        host_collisions=[overlap_volume(sweep,coupon) for coupon in host_coupons]
        assert all(value<1e-5 for value in host_collisions), ('Host plate obstructs offset ground-clip insertion',unit_id,offset,host_collisions)
        negative=overlap_volume(sweep,old_walls)
        assert negative>10, ('Restored narrow-channel walls did not reject the realistic clip',unit_id,offset,negative)
        rows.append({'lateralOffsetMm':offset,'clipWidthMm':14,'insertionStrokeMm':10,'externalInterferences':0,'narrowChannelNegativeControlMm3':negative})
    return rows


def analytic_horizontal_faces(shape,z):
    # Imported trimmed vertices can depart by about 1e-6 mm from their actual
    # analytic plane. Select the Part.Plane itself; do not alter its geometry.
    return [face for face in shape.Faces if isinstance(face.Surface,Part.Plane)
            and abs(abs(face.Surface.Axis.z)-1)<1e-9 and abs(face.Surface.Position.z-z)<1e-7]


def analytic_contact_area(first,second,z):
    return sum(a.common(b).Area for a in analytic_horizontal_faces(first,z) for b in analytic_horizontal_faces(second,z))


def native_servo_frame(shape):
    result=shape.copy()
    result.translate(App.Vector(0,28,15.2))
    result.rotate(App.Vector(),App.Vector(0,0,1),90)
    return result


def native_geometry_signature(shape):
    def xyz(point):return [point.x,point.y,point.z]
    vertices=sorted((xyz(vertex.Point) for vertex in shape.Vertexes),key=lambda point:tuple(round(value,6) for value in point))
    edges=[]
    for edge in shape.Edges:
        low,high=edge.ParameterRange
        try:
            curve_type=type(edge.Curve).__name__
        except Exception as error:
            assert str(error)=='undefined curve type' and edge.Length<1e-8 and len(edge.Vertexes)==1, ('Unexpected source edge without an analytic curve',str(error),edge.Length)
            # The imported cover contains collapsed pole edges. Record their
            # actual point and zero-length state instead of skipping topology.
            curve_type='Collapsed source pole'
            samples=xyz(edge.Vertexes[0].Point)*5
        else:
            samples=[coordinate for fraction in (0,0.25,0.5,0.75,1) for coordinate in xyz(edge.valueAt(low+(high-low)*fraction))]
        edges.append((curve_type,[edge.Length,*xyz(edge.CenterOfMass),*samples]))
    faces=[]
    for face in shape.Faces:
        u0,u1,v0,v1=face.ParameterRange
        samples=[]
        for fu,fv in ((0.25,0.25),(0.5,0.5),(0.75,0.75),(0.25,0.75),(0.75,0.25)):
            u,v=u0+(u1-u0)*fu,v0+(v1-v0)*fv
            samples.extend(xyz(face.valueAt(u,v)))
            samples.extend(xyz(face.normalAt(u,v)))
        faces.append((type(face.Surface).__name__,[face.Area,*xyz(face.CenterOfMass),*samples]))
    # Sorting by invariant area/length and world centre retains complete curves
    # and surfaces even when import changes the underlying OCCT storage locations.
    key=lambda item:(item[0],*[round(number,6) for number in item[1][:4]])
    return {'mass':[shape.Volume,shape.Area,*xyz(shape.CenterOfMass)],'vertices':vertices,
            'edges':sorted(edges,key=key),'faces':sorted(faces,key=key)}


def assert_native_geometry_equal(actual,wanted,index):
    assert len(actual.Solids)==len(wanted.Solids)==1, ('Supplier leaf must remain one closed solid',index)
    actual,wanted=actual.Solids[0],wanted.Solids[0]
    first,second=native_geometry_signature(actual),native_geometry_signature(wanted)
    assert all(len(first[name])==len(second[name]) for name in first), ('Supplier source topology differs',index)
    errors=[abs(a-b) for a,b in zip(first['mass'],second['mass'])]
    errors.extend(abs(a-b) for p,q in zip(first['vertices'],second['vertices']) for a,b in zip(p,q))
    for name in ('edges','faces'):
        for (first_type,a),(second_type,b) in zip(first[name],second[name]):
            assert first_type==second_type and len(a)==len(b), ('Supplier source analytic surface/curve type differs',index,name,first_type,second_type)
            errors.extend(abs(x-y) for x,y in zip(a,b))
    maximum=max(errors)
    assert maximum<1e-6, ('Supplier source native coordinates, topology, analytic geometry or mass properties differ',index,maximum)
    return maximum


def check_servo_shaft_end_supports(fixtures,by_id):
    spec=fixtures['servoShaftEndSupports']
    assert spec=={'nativePads':[{'min':[-5,10,-4.5],'size':[10,7.8,4.5]},{'min':[-5,-17.8,-4.5],'size':[10,7.8,4.5]}],
                  'sourceRearCoverSolid':2,'nativeContactPlane':0,'minimumContactAreaMm2':18,
                  'fixedRearPivot':{'radius':3,'bottom':-4.1,'top':-0.2},'minimumRearPivotClearanceMm':6.99,
                  'downwardControlMm':0.1,'minimumControlInterferenceMm3':1.9}
    servo=native_servo_frame(by_id['drive-servo'].Shape)
    cradle=native_servo_frame(by_id['parallel-cradle'].Shape)
    assert len(servo.Solids)==9
    rear=servo.Solids[spec['sourceRearCoverSolid']]
    assert abs(rear.Volume-11128.230269219983)<1e-5, 'Support checks must retain the unchanged stationary rear cover and pivot'
    pivot_spec=spec['fixedRearPivot']
    pivot=rear.common(Part.makeCylinder(pivot_spec['radius'],pivot_spec['top']-pivot_spec['bottom'],App.Vector(0,0,pivot_spec['bottom'])))
    assert volume(pivot)>50, 'Fixed rear pivot is absent from its native lower position'
    source_faces=analytic_horizontal_faces(rear,spec['nativeContactPlane'])
    rows=[]
    for item in spec['nativePads']:
        pad=Part.makeBox(*item['size'],App.Vector(*item['min']))
        assert volume(pad.cut(cradle))<1e-5, 'The independent shaft-end support volume is absent from the printed cradle'
        assert overlap_volume(pad,servo)<1e-5, 'The shaft-end support intersects nominal supplier geometry'
        faces=analytic_horizontal_faces(pad,spec['nativeContactPlane'])
        contact=sum(first.common(second).Area for first in source_faces for second in faces)
        assert contact>spec['minimumContactAreaMm2'], ('Shaft-end support does not meet a broad stationary case shoulder',item,contact)
        clearance=pad.distToShape(pivot)[0]
        assert clearance>spec['minimumRearPivotClearanceMm'], ('Shaft-end support touches the fixed rear pivot',item,clearance)
        moved=rear.copy();moved.translate(App.Vector(0,0,-spec['downwardControlMm']))
        control=overlap_volume(pad,moved)
        assert control>spec['minimumControlInterferenceMm3'], ('Downward-displacement control does not engage the stationary shaft-end case supports',item,control)
        assert item['min'][2]==-4.5 and item['min'][2]+item['size'][2]==0, 'New supports must rise directly from the common flat cradle print bed'
        rows.append({'nativeMin':item['min'],'sizeMm':item['size'],'stationaryCaseContactMm2':contact,'fixedRearPivotClearanceMm':clearance,
                     'downwardControlMm':spec['downwardControlMm'],'downwardControlInterferenceMm3':control,'startsAtCommonCradleBed':True})
    return {'servoShaftEndSupports':rows,'servoSupportScope':'Two side-wall-connected pads contact the unchanged stationary rear cover. The fixed rear pivot and central cable approach remain clear; the separate idler disc is deliberately relocated above the rocker. Geometry establishes retention contact, not a force rating.'}


def check_servo_shaft_end_clamp(fixtures,by_id):
    spec=fixtures['servoShaftEndClamp']
    assert spec=={'nativePads':[{'min':[-5,9,29],'size':[10,8.8,3.7]},{'min':[-5,-17.8,29],'size':[10,8.8,3.7]}],
                  'sourceFrontCoverSolid':1,'nativeContactPlane':29,'openingRadius':10.5,'expectedContactAreaMm2':17.60206311,
                  'minimumDiscClearanceMm':0.89,'upwardControlMm':0.1,'minimumControlInterferenceMm3':1.89}
    servo=native_servo_frame(by_id['drive-servo'].Shape)
    lid=native_servo_frame(by_id['parallel-clamp'].Shape)
    front=servo.Solids[spec['sourceFrontCoverSolid']]
    disc=servo.Solids[6]
    assert abs(front.Volume-8526.533696822675)<1e-5, 'Upper clamp must contact the unchanged supplier front cover'
    rows=[]
    for item in spec['nativePads']:
        pad=Part.makeBox(*item['size'],App.Vector(*item['min'])).cut(Part.makeCylinder(spec['openingRadius'],9,App.Vector(0,0,25)))
        assert volume(pad.cut(lid))<1e-5, 'The independent upper shaft-end contact rib is absent from the clamp'
        assert overlap_volume(pad,servo)<1e-5, 'Upper contact rib intersects nominal supplier geometry'
        contact=analytic_contact_area(pad,front,spec['nativeContactPlane'])
        assert abs(contact-spec['expectedContactAreaMm2'])<1e-4, ('Upper contact rib does not meet its broad stationary case shoulder',item,contact)
        clearance=pad.distToShape(disc)[0]
        assert clearance>spec['minimumDiscClearanceMm'], ('Upper contact rib binds the rotating front disc',item,clearance)
        moved=front.copy();moved.translate(App.Vector(0,0,spec['upwardControlMm']))
        control=overlap_volume(pad,moved)
        assert control>spec['minimumControlInterferenceMm3'], ('Upward-displacement control does not engage the upper shaft-end ribs',item,control)
        rows.append({'nativeMin':item['min'],'sizeMm':item['size'],'stationaryCaseContactMm2':contact,'frontDiscClearanceMm':clearance,
                     'upwardControlMm':spec['upwardControlMm'],'upwardControlInterferenceMm3':control,'connectedToFlatUpperPrintFace':True})
    return {'servoShaftEndClamp':rows}


def check_rocker_sandwich(case,fixtures,by_id,static_mount):
    spec=fixtures['rockerSandwich']
    assert spec=={'hornMount':'rocker-m3','sourceOutputDiscSolid':6,'sourceUpperDiscSolid':7,
                  'lowerDisc':{'bottom':31.2,'top':33.7,'tappedDiameter':3,'pitch':0.5},
                  'upperDisc':{'rotationX':180,'translationZ':40.35,'bottom':41.7,'top':43.9,'clearanceDiameter':3.2},
                  'rocker':{'bossRadius':9.6,'bossBottom':33.7,'bodyBottom':34.7,'top':41.7,'centreDiameter':9.2,'clearanceDiameter':3.2},
                  'axes':[[7,0],[0,7],[-7,0],[0,-7]],'expectedContactAreaMm2':178.94511755,
                  'screw':{'diameter':3,'length':14,'underHead':43.9,'tip':29.9,'engagement':2.5,'minimumCaseClearance':0.89},
                  'minimumBodyClearanceMm':2,'minimumBossClearanceMm':0.9,'maximumSweepRadius':33}
    servo_meta=next(meta for meta in case['components'] if meta['id']=='drive-servo')
    assert servo_meta['parameters']['hornMount']==spec['hornMount'] and servo_meta['parameters']['showHorn'] is True, 'Parallel mechanism needs the explicit reworked-disc servo execution'
    angle=servo_meta['parameters']['outputAngle']
    servo=native_servo_frame(by_id['drive-servo'].Shape)
    solids=[]
    for index,solid in enumerate(servo.Solids):
        placed=solid.copy()
        if index>=5:placed.rotate(App.Vector(),App.Vector(0,0,1),-angle)
        solids.append(placed)
    assert len(solids)==9, 'Reworked purchased servo must retain nine separately identified supplier leaves'
    source_data=json.loads((Path(__file__).resolve().parents[1]/'src/core/assembly/recovery/st3215-native.json').read_text())
    original=[]
    for record in source_data['components']:
        solid=Part.Shape();solid.importBrepFromString(zlib.decompress(base64.b64decode(record['brep'])).decode())
        original.append(solid)
    expected=[solid.copy() for solid in original]
    for x,y in spec['axes']:
        expected[6]=expected[6].cut(Part.makeCylinder(1.5,8,App.Vector(x,y,28)))
        expected[7]=expected[7].cut(Part.makeCylinder(1.6,8,App.Vector(x,y,-5)))
    expected[7].rotate(App.Vector(),App.Vector(1,0,0),spec['upperDisc']['rotationX'])
    expected[7].translate(App.Vector(0,0,spec['upperDisc']['translationZ']))
    signature_errors=[]
    for index,(actual,wanted) in enumerate(zip(solids,expected)):
        # Coincident imported supplier solids return invalid Common/Cut results
        # in OCCT even for two identical source imports. Compare their actual
        # analytic geometry, complete native topology and mass properties instead.
        signature_errors.append(assert_native_geometry_equal(actual,wanted,index))
    internal=[]
    for index in (6,7):
        for other in range(9):
            if other==index or (index==7 and other==6):continue
            interference=overlap_volume(solids[index],solids[other])
            inherited=overlap_volume(original[index],original[other]) if index==6 else 0
            assert interference<=inherited+1e-5, ('Disc machining or relocation introduced a new internal servo collision',index,other,interference,inherited)
            internal.append({'discSolid':index,'otherSolid':other,'interferenceMm3':interference,'maximumInheritedContactMm3':inherited})
    rocker=native_servo_frame(by_id['parallel-rocker'].Shape)
    rocker.rotate(App.Vector(),App.Vector(0,0,1),-angle)
    lower,upper=solids[6],solids[7]
    r=spec['rocker']
    assert abs(rocker.BoundBox.ZMin-r['bossBottom'])<1e-7 and abs(rocker.BoundBox.ZMax-r['top'])<1e-7
    low=rocker.common(Part.makeBox(80,80,r['bodyBottom']-r['bossBottom'],App.Vector(-40,-40,r['bossBottom'])))
    expected_low=Part.makeCylinder(r['bossRadius'],1,App.Vector(0,0,r['bossBottom'])).cut(Part.makeCylinder(r['centreDiameter']/2,3,App.Vector(0,0,r['bossBottom']-1)))
    for x,y in spec['axes']:expected_low=expected_low.cut(Part.makeCylinder(1.6,3,App.Vector(x,y,r['bossBottom']-1)))
    assert volume(low.cut(expected_low))+volume(expected_low.cut(low))<1e-5, 'The lower mating step must be exactly diameter19.2 by1mm, with through bores'
    centre=Part.makeCylinder(r['centreDiameter']/2,r['top']-r['bossBottom']+2,App.Vector(0,0,r['bossBottom']-1))
    assert overlap_volume(centre,rocker)<1e-5, 'Printed centre relief obstructs the downward-facing upper-disc boss or shaft-screw access'
    assert overlap_volume(rocker,upper)<1e-5 and overlap_volume(rocker,lower)<1e-5
    contacts=[]
    for name,disc,z in (('lower',lower,33.7),('upper',upper,41.7)):
        area=analytic_contact_area(rocker,disc,z)
        assert abs(area-spec['expectedContactAreaMm2'])<1e-4, ('The rocker must be clamped by two broad metal faces',name,area)
        contacts.append({'disc':name,'nativeContactZ':z,'contactAreaMm2':area})
    screw_rows=[]
    for index,(x,y) in enumerate(spec['axes'],1):
        screw_id=f'parallel-disc-screw-{index}'
        meta=next(meta for meta in case['components'] if meta['id']==screw_id)
        params=meta['parameters']
        assert params['diameter']==3 and params['length']==14 and params['pitch']==0.5 and params['head']=='socket-cap'
        screw=native_servo_frame(by_id[screw_id].Shape);screw.rotate(App.Vector(),App.Vector(0,0,1),-angle)
        assert abs(screw.BoundBox.ZMin-spec['screw']['tip'])<1e-6 and abs(screw.BoundBox.ZMax-46.9)<1e-6, ('M3 sandwich fastener length or head seating differs',screw_id)
        assert abs((screw.BoundBox.XMin+screw.BoundBox.XMax)/2-x)<1e-6 and abs((screw.BoundBox.YMin+screw.BoundBox.YMax)/2-y)<1e-6, ('M3 sandwich fastener left PCD14',screw_id)
        for name,disc,bottom,top,radius in (('rocker',rocker,33.7,41.7,1.6),('upper',upper,41.7,43.9,1.6),('lower tapped envelope',lower,31.2,33.7,1.5)):
            bore=Part.makeCylinder(radius,top-bottom,App.Vector(x,y,bottom))
            assert overlap_volume(bore,disc)<1e-5, ('M3 through passage or tapped envelope is obstructed',screw_id,name)
        engagement=max(0,min(spec['lowerDisc']['top'],spec['screw']['underHead'])-max(spec['lowerDisc']['bottom'],screw.BoundBox.ZMin))
        assert abs(engagement-spec['screw']['engagement'])<1e-7
        clearance=screw.distToShape(solids[1])[0]
        assert clearance>spec['screw']['minimumCaseClearance'], ('M3 screw tip touches the fixed front cover',screw_id,clearance)
        assert all(overlap_volume(screw,solid)<1e-5 for solid in solids), 'M3 sandwich fastener intersects the servo source solids'
        screw_rows.append({'id':screw_id,'diameterMm':3,'underHeadLengthMm':14,'nativeUnderHeadZ':43.9,'nativeTipZ':screw.BoundBox.ZMin,
                           'nominalTappedPlateEngagementMm':engagement,'caseClearanceMm':clearance,'tappedThreadRepresentation':'Nominal M3 major-diameter bore; physical tapping is required and thread load capacity is not inferred.'})
    assert not any(meta['id'].startswith('parallel-disc-nut-') for meta in case['components']), 'The M3 sandwich must use the tapped lower disc instead of obstructed underside nuts'
    # Rotation-invariant containing volumes establish clearance for every yaw,
    # including intermediate positions that are absent from the authored poses.
    native_mount=[native_servo_frame(shape) for shape in static_mount]
    mount_top=max(shape.BoundBox.ZMax for shape in native_mount)
    body_clearance=r['bodyBottom']-mount_top
    assert abs(mount_top-32.7)<1e-6 and body_clearance>=spec['minimumBodyClearanceMm']-1e-6
    body_envelope=Part.makeCylinder(spec['maximumSweepRadius'],r['top']-r['bodyBottom'],App.Vector(0,0,r['bodyBottom']))
    boss_envelope=Part.makeCylinder(r['bossRadius'],r['bodyBottom']-r['bossBottom'],App.Vector(0,0,r['bossBottom']))
    assert volume(rocker.cut(body_envelope.fuse(boss_envelope)))<1e-5, 'Rocker escapes its continuous-yaw body/boss envelopes'
    gap=spec['minimumBossClearanceMm']
    expanded_boss=Part.makeCylinder(r['bossRadius']+gap,r['bodyBottom']-r['bossBottom']+2*gap,App.Vector(0,0,r['bossBottom']-gap))
    assert all(overlap_volume(expanded_boss,shape)<1e-5 for shape in native_mount), 'The boss enlarged by its required radial/axial clearance touches the stationary mount'
    access=Part.makeCylinder(1.5,30,App.Vector(0,0,33.81))
    assert all(overlap_volume(access,shape)<1e-5 for shape in (rocker,upper)), 'The retained shaft screw lacks a straight central tool approach'
    return {'rockerDiscSandwich':{'hornMount':spec['hornMount'],'retainedSourceLeaves':9,'sourceCasesAndSplineUnchanged':True,
                                'lowerDiscTappedM3':True,'upperDiscDrilled3p2AndRelocated':True,'metalFaceContacts':contacts,'throughFasteners':screw_rows,
                                'printedCentreDiameterMm':9.2,'centralShaftFastenerApproachDiameterMm':3,'newInternalServoInterferences':0,'internalDiscPairs':internal,
                                'sourceGeometryIdentity':{'leaves':9,'maximumNativeSignatureError':max(signature_errors),'tolerance':1e-6,
                                                          'compared':'Complete vertices, edge curve types/lengths/centres/five points, face surface types/areas/centres/five points and normals, and solid volume/area/centre.'}},
            'continuousRockerMountClearance':{'bodyAxialClearanceMm':body_clearance,'bossRadialAndAxialEnvelopeClearanceMm':gap,
                                            'allYawAnglesProved':True,'bossDiameterMm':19.2,'stationaryOpeningDiameterMm':21,
                                            'scope':'The broad body is at least2mm above the entire stationary mount; the diameter19.2 boss enlarged radially and axially by0.9mm remains clear. The stepped boss stays inside the diameter21 clamp opening.'}}


def check_switch_nut_seat(base,unit,fixtures,centre_y):
    spec=fixtures['switchNutSeat']
    assert spec=={'diameter':18.6,'floor':6.8,'depth':0.7,'minimumWeb':5.3}
    assert abs(spec['floor']-fixtures['flangeBottom']-spec['minimumWeb'])<1e-9
    assert abs(fixtures['flangeTop']-spec['floor']-spec['depth'])<1e-9
    contact=plane_contact_area(base,unit,spec['floor'])
    assert contact>80, ('The unchanged switch retaining nut lacks its broad top-counterseat floor',centre_y,contact)
    for z in (1.6,3,5,6.79):
        assert base.isInside(App.Vector(8,centre_y,z),1e-7,True), ('The switch counterseat does not retain its full lower web',centre_y,z)
    assert not base.isInside(App.Vector(8,centre_y,6.81),1e-7,True), 'The M12 nut top counterseat must open above its Z6.8 floor'
    return {'centre':[0,centre_y],'floorZ':spec['floor'],'depthMm':spec['depth'],'residualPetgWebMm':spec['minimumWeb'],'nutContactAreaMm2':contact,'openFromTop':True}


def check_guard_base_seat(base,unit,manual):
    spec=manual['guardSeat']
    assert spec=={'sourceBaseSolid':10,'centre':[-7,-90],'outerSize':[42.6,19],'recessSize':[41,17.4],
                  'bottom':7.5,'floor':9.5,'top':9.7,'recessDepth':0.2,
                  'centralSlot':{'min':[-9.7,-101,7.5],'max':[9.7,-79,10]},
                  'yawNegativeControls':[-3,3],'minimumContactAreaMm2':100,'minimumLandContactAreaMm2':30}
    assert abs(spec['top']-spec['floor']-spec['recessDepth'])<1e-9
    steel=unit.Solids[spec['sourceBaseSolid']]
    bounds=steel.BoundBox
    assert abs(bounds.XMin+27.3)<1e-5 and abs(bounds.XMax-13.3)<1e-5 and abs(bounds.ZMin-9.5)<1e-6, 'Guard-seat audit must use the actual unchanged SAC-01 steel base and hinge ears'
    assert overlap_volume(steel,base)<1e-5, 'The nominal SAC steel base intersects its locating seat'
    contact=plane_contact_area(base,steel,spec['floor'])
    assert contact>spec['minimumContactAreaMm2'], ('The shallow guard recess does not actually support the steel base',contact)
    land_contacts=[]
    for low,high in ((-28.3,-9.7),(9.7,14.3)):
        roi=Part.makeBox(high-low,19,0.2,App.Vector(low,-99.5,9.4))
        area=plane_contact_area(base.common(roi),steel,spec['floor'])
        assert area>spec['minimumLandContactAreaMm2'], ('Both guard end lands must support the source steel base',low,high,area)
        land_contacts.append({'xRange':[low,high],'contactAreaMm2':area})
    low,high=spec['centralSlot']['min'],spec['centralSlot']['max']
    slot=Part.makeBox(*(b-a for a,b in zip(low,high)),App.Vector(*low))
    assert overlap_volume(slot,base)<1e-5, 'Thin central saddle strips remain around the nut instead of a full open slot'
    lip_slab=Part.makeBox(42.6,19,0.3,App.Vector(-28.3,-99.5,spec['floor']))
    without_lip=base.cut(lip_slab)
    controls=[]
    for yaw in spec['yawNegativeControls']:
        turned=steel.copy();turned.rotate(App.Vector(0,-90,0),App.Vector(0,0,1),yaw)
        collision=overlap_volume(turned,base)
        assert collision>0.05, ('Shallow locating walls do not bound SAC-base yaw',yaw,collision)
        removed_control=overlap_volume(turned,without_lip)
        assert removed_control<1e-5, ('The SAC yaw control is obstructed by something other than the shallow locating lip',yaw,removed_control)
        controls.append({'yawDegrees':yaw,'lipInterferenceMm3':collision,'interferenceWithLipRemovedMm3':removed_control})
    return {'floorZ':spec['floor'],'lipTopZ':spec['top'],'recessDepthMm':spec['recessDepth'],'actualSteelBaseContactMm2':contact,
            'endLandContacts':land_contacts,'yawNegativeControls':controls,'centralNutSlotClear':True,'scope':'Top-open locating recess around unchanged SAC-01 steel base; its source hinge and cover travel remain unchanged.'}


def fixture_transform(shape,translation,rotation):
    for axis,angle in zip((App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)),rotation):
        if angle:shape.rotate(App.Vector(),axis,angle)
    shape.translate(App.Vector(*translation))
    return shape


def source_fixture(expression,translation,rotation_z=0):
    shape=eval(expression,{'Part':Part,'App':App,'_pl_transform':fixture_transform}).removeSplitter()
    if rotation_z:shape.rotate(App.Vector(),App.Vector(0,0,1),rotation_z)
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
    assert meta['parameters']['model']=='daier-asw-07d-sac-01' and meta['placement']['translation']==[0,-90,0] and meta['placement']['rotation'][:2]==[0,0] and meta['placement']['rotation'][2]%360==180
    state=case['parameters']['manualState']
    assert meta['parameters']['guard']==('closed' if state=='guarded-off' else 'open')
    assert meta['parameters']['position']==('last' if state=='open-on' else 'first')
    assert len(unit.Solids)==14 and manual['rearAxes']==[[-22,-101],[22,-76]]
    assert manual['nutSeatFloor']==6.8
    nut_contact=plane_contact_area(base,unit,6.8)
    assert nut_contact>10, ('Guarded-source lower nut does not clamp the rear web',nut_contact)
    roi=Part.makeBox(56,44,1,App.Vector(-28,-112,1))
    rear_shoulder=plane_contact_area(base.common(roi),lower.common(roi),1.5)
    assert rear_shoulder>10, ('Rear carrier has no local rigid split shoulder',rear_shoulder)
    stack=[]
    for index,(x,y) in enumerate(manual['rearAxes'],1):
        screw,nut=(by_id[f'manual-clamp-{kind}-{index}'].Shape for kind in ('screw','nut'))
        tip=screw.BoundBox.ZMin
        assert abs(tip+17)<1e-6 and abs(nut.BoundBox.ZMin+14)<1e-6 and abs(nut.BoundBox.ZLength-2.4)<1e-6
        assert abs(nut.BoundBox.ZMin-tip-3)<1e-6 and abs(tip+19.7-2.7)<1e-6
        assert lower.isInside(App.Vector(x+3,y,1.2),1e-7,True) and not base.isInside(App.Vector(x+3,y,1.2),1e-7,True)
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
    assert abs(gasket.BoundBox.ZLength-1.5)<1e-6 and abs(gasket.BoundBox.ZMin)<1e-6
    gasket_upper=plane_contact_area(gasket,base,1.5);gasket_case=plane_contact_area(gasket,unit,0)
    assert gasket_upper>10 and gasket_case>10
    assert abs(gasket.Volume-planar_area(gasket,0)*1.5)<1e-5
    clip_rows=check_ground_clip_approach(case,children,manual['groundClip'],'manual-toggle-switch',-90,host_coupons)
    cover_closed=source_fixture(guard['closedExpression'],manual['placement'],guard['sourceRotationZ'])
    cover_open=source_fixture(guard['openExpression'],manual['placement'],guard['sourceRotationZ'])
    expected=cover_closed if state=='guarded-off' else cover_open
    actual=unit.Solids[-1]
    assert abs(actual.Volume-expected.Volume)<1e-5 and max(abs(a-b) for a,b in zip(trim_bounds(actual),trim_bounds(expected)))<0.005, 'Retained SAC cover differs from catalog source'
    result={'manualSourceRetained':True,'manualGuardNutContactMm2':nut_contact,'manualRigidShoulderMm2':rear_shoulder,'manualThroughStacks':stack,'manualCaseYawControls':yaw_controls,'manualGasket':{'thicknessMm':1.5,'upperSeatContactMm2':gasket_upper,'caseContactMm2':gasket_case},'manualGroundClipApproachClear':True,'manualGroundClipOffsetCases':clip_rows,
            'manualSwitchNutSeat':check_switch_nut_seat(base,unit,fixtures,-90),'manualGuardBaseSeat':check_guard_base_seat(base,unit,manual)}
    tools=[]
    for index,(x,y) in enumerate(manual['rearAxes'],1):
        screw_id=f'manual-clamp-screw-{index}'
        tool=Part.makeCylinder(1.5,54,App.Vector(x,y,6.01))
        obstacles=[child.Shape for child,meta in zip(children,case['components']) if meta['id'] not in (screw_id,'manual-toggle-switch')]
        fixed_overlap=sum(overlap_volume(tool,shape) for shape in obstacles)+sum(overlap_volume(tool,solid) for solid in unit.Solids[:-1])
        assert fixed_overlap<1e-5, ('A straight M3 hex-key approach is blocked even with the removable SAC cover absent',screw_id,fixed_overlap)
        cover_overlap=overlap_volume(tool,unit.Solids[-1])
        tools.append({'id':screw_id,'canonicalAxis':[x,y],'toolDiameterMm':3,'toolBottomZ':6.01,'toolHeightMm':54,'fixedInterferenceMm3':fixed_overlap,'coverInterferenceMm3':cover_overlap,'requiresCoverRemovalForThisModeledPose':cover_overlap>1e-5})
    result['manualTieToolAccess']=tools
    if guard['auditSweep']:
        assert guard['pivot']==[-15.5,-90,14.7] and guard['axis']==[0,-1,0] and guard['sourceRotationZ']==180 and guard['opening']==69 and guard['sampleStep']==0.5
        pivot,axis=App.Vector(*guard['pivot']),App.Vector(*guard['axis'])
        bounds=cover_closed.BoundBox
        radius=max(math.hypot(x-pivot.x,z-pivot.z) for x in (bounds.XMin,bounds.XMax) for z in (bounds.ZMin,bounds.ZMax))
        gap_bound=2*radius*math.sin(math.radians(guard['sampleStep']/4))
        external=[child.Shape for child,expected in zip(children,case['components']) if expected['id']!='manual-toggle-switch']+host_coupons
        # This cylinder contains both relocated discs, the opposed bar and the
        # taller M3 heads for every yaw, including the unrendered intermediate poses.
        rotor_envelope=Part.makeCylinder(33.1,17.9,App.Vector(0,-28,13.9))
        servo=native_servo_frame(by_id['drive-servo'].Shape)
        for index in (6,7):
            disc=servo.Solids[index].copy();disc.rotate(App.Vector(),App.Vector(0,0,1),-90);disc.translate(App.Vector(0,-28,-15.2))
            assert volume(disc.cut(rotor_envelope))<1e-5, ('Source sandwich disc escapes the all-yaw manual-cover envelope',index)
        for child,expected in zip(children,case['components']):
            if expected['id']=='parallel-rocker' or expected['id'].startswith('parallel-disc-'):
                assert volume(child.Shape.cut(rotor_envelope))<1e-5, ('Moving front hardware escapes the all-yaw envelope',expected['id'])
        external.append(rotor_envelope)
        cover_min=float('inf')
        sample_count=round(guard['opening']/guard['sampleStep'])+1
        for sample in range(sample_count):
            angle=sample*guard['sampleStep']
            moved=cover_closed.copy();moved.rotate(pivot,axis,angle)
            clearance=minimum_distance(moved,external)
            cover_min=min(cover_min,clearance)
            assert clearance>gap_bound+1e-6, ('Guard sweep clearance is smaller than its between-sample motion bound',angle,clearance,gap_bound)
        # The manual lever sweeps only with the cover fully open. A closed cover
        # intentionally acts on the lever; that interlock is not a clearance test.
        lever_pivot=App.Vector(*guard['leverPivot']);lever_min=float('inf')
        lever_shapes=[source_fixture(expression,manual['placement'],guard['sourceRotationZ']) for expression in guard['firstLeverExpressions']]
        assert len(lever_shapes)==2
        lever_radius=max(math.hypot(x-lever_pivot.x,z-lever_pivot.z) for lever in lever_shapes for x in (lever.BoundBox.XMin,lever.BoundBox.XMax) for z in (lever.BoundBox.ZMin,lever.BoundBox.ZMax))
        lever_motion_bound=2*lever_radius*math.sin(math.radians(0.5))
        for angle in range(-12,13,2):
            for lever in lever_shapes:
                moved=lever.copy();moved.rotate(lever_pivot,axis,angle+12)
                clearance=minimum_distance(moved,external+[cover_open])
                lever_min=min(lever_min,clearance)
                assert clearance>lever_motion_bound+1e-6, ('Open guard does not clear the complete manual lever path',angle,clearance)
        result['modeledGuardSweep']={'rangeDegrees':[0,69],'poses':sample_count,'sampleStepDegrees':guard['sampleStep'],'minimumClearanceMm':cover_min,'betweenSampleMotionBoundMm':gap_bound,'continuousExternalClearanceProved':True,'scope':'Modeled catalog69-degree opening; hinge/angle/seat are illustrative, not verified hardware stops or interlock performance.'}
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
        assert branch == {'size':[16,20], 'centre':[34,0], 'radius':2}
        main_only = coupon.copy()
        coupon = coupon.cut(rounded_opening(*branch['size'], branch['radius'], branch['centre'], -thickness-1, thickness+2))
        if dual:
            extra=host['rearSideBranch']
            assert extra=={'size':[16,20],'centre':[34,-90],'radius':2}
            coupon=coupon.cut(rounded_opening(*extra['size'],extra['radius'],extra['centre'],-thickness-1,thickness+2))
        check_shape(coupon, 1)
        collisions = [{'id': expected['id'], 'volumeMm3': overlap_volume(coupon, child.Shape)} for child,expected in zip(children, case['components'])]
        assert all(item['volumeMm3'] < 1e-5 for item in collisions), ('Host plate cutout obstructs installed components', thickness, collisions)
        cable_overlap = overlap_volume(coupon, corridor)
        assert cable_overlap < 1e-5, ('Host plate obstructs underside cable corridor', thickness, cable_overlap)
        clip, clip_sweep = ground_clip_fixtures(fixtures)
        assert overlap_volume(coupon,clip_sweep) < 1e-5, ('Host terminal notch obstructs the clip approach',thickness)
        for offset in fixtures['groundClip']['lateralOffsets']:
            _,offset_sweep=clip_shapes(fixtures['groundClip'],offset)
            assert overlap_volume(coupon,offset_sweep)<1e-5, ('Host terminal notch obstructs a laterally offset clip',thickness,offset)
        notch_negative = overlap_volume(main_only,clip_sweep)
        assert notch_negative > 1, ('Plain rectangular opening fails to exercise the ground-clip notch',thickness)
        gasket = by_id['parallel-panel-gasket'].Shape
        gasket_contact = plane_contact_area(gasket,coupon,0)
        petg_host_contact = plane_contact_area(base,coupon,0)
        assert gasket_contact > 10 and petg_host_contact < 1e-6, ('External TPU must separate the flat flange from the host plane',gasket_contact,petg_host_contact)
        host_coupons.append(coupon)
        if dual:
            rearclip,rearsweep=clip_shapes(fixtures['manual']['groundClip'])
            assert overlap_volume(coupon,rearsweep)<1e-5, 'Rear terminal notch obstructs clip insertion'
            assert overlap_volume(main_only,rearsweep)>1, 'Rear terminal notch negative control did not obstruct insertion'
        host_rows.append({'thicknessMm': thickness, 'externalInterferences': 0, 'uncutNegativeControlMm3': negative, 'cableInterferenceMm3': cable_overlap, 'terminalNotchNegativeControlMm3':notch_negative, 'panelGasketContactMm2':gasket_contact, 'petgHostContactMm2':petg_host_contact})
    static_mount = [child.Shape for child,expected in mount_parts if expected['supply'] == 'manufactured' and expected['id'] != 'parallel-rocker' or expected['id'].startswith(('parallel-clamp-screw-', 'parallel-clamp-nut-', 'manual-clamp-'))]
    result = check_split_mount(case,children,fixtures,by_id)
    result.update(check_servo_shaft_end_supports(fixtures,by_id))
    result.update(check_servo_shaft_end_clamp(fixtures,by_id))
    result.update(check_rocker_sandwich(case,fixtures,by_id,static_mount))
    if dual:
        result.update(check_manual_switch(case,children,fixtures,by_id,host_coupons))
    result.update(hostPlateInstallation=host_rows,authoredCableApproachClear=True,cableScope=cable['scope'])
    return result


def check_dual_world(case,children):
    by_id={meta['id']:child for child,meta in zip(children,case['components'])}
    metadata={meta['id']:meta for meta in case['components']}
    assert metadata['manual-toggle-switch']['placement']=={'translation':[-90,0,0],'rotation':[0,0,90]}, 'Manual switch must be left in the final world frame'
    assert metadata['drive-servo']['placement']=={'translation':[-28,0,-15.2],'rotation':[0,0,-180]}, 'Servo source axes differ in the final world frame'
    assert metadata['toggle-switch']['placement']=={'translation':[0,0,0],'rotation':[0,0,90]}, 'Driven switch must remain at the right-hand datum'
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
            assert base.isInside(App.Vector(x,y,7.2),1e-7,True)==retained, ('Engraved legend content differs',index+1,x,y)
            assert base.isInside(App.Vector(x,y,6.89),1e-7,True), 'Engraving cuts below its Z6.9 floor'
            if not retained:assert not base.isInside(App.Vector(x,y,6.91),1e-7,True)
        slab=Part.makeBox(24.4,6.2,0.7,App.Vector(cx-12.2,-39.1,6.8))
        removed=slab.Volume-volume(base.common(slab))
        assert abs(removed-expected_removed)<1e-4, ('Engraving removed volume differs',index+1,removed,expected_removed)
        legends.append({'text':f'ARM {index+1}','centre':[cx,-36],'depthMm':0.6,'absoluteFloorZ':6.9,'removedVolumeMm3':removed,'strokeCounterAndSpaceProbes':8})
    assert abs(planar_area(base,6.9)-(29.5485+31.31025)/0.6)<1e-4, 'Legend floor faces differ from Z6.9'
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
                assert len(case['components']) == (26 if mode=='parallel-dual' else 20), 'Split parallel mechanism must retain six printed details, four common M3 ties and four source-disc M3 screws without underside nuts'
                assert sum('PETG' in item['manufacturing']['material'] for item in manufactured) == 4
                assert sum('TPU' in item['manufacturing']['material'] for item in manufactured) == (3 if mode=='parallel-dual' else 2)
                servo = next(item for item in case['components'] if item['libraryId'] == 'bus-servo')
                toggle = next(item for item in case['components'] if item['libraryId'] == 'panel-switch')
                assert servo['placement']['rotation'] == ([0,0,-180] if mode=='parallel-dual' else [0,0,-90]) and toggle['placement']['rotation'] == ([0,0,90] if mode=='parallel-dual' else [0,0,180]), 'Parallel source axes differ'
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
                       fcstdRoundtrip=True, inheritedServoInternalContactChecked=False,
                       discModificationInternalFitChecked=bool(row.get('rockerDiscSandwich')))
        except Exception as error:
            row['error'] = str(error)
        finally:
            if doc and doc.Name in App.listDocuments():
                App.closeDocument(doc.Name)
        save_row(row)
sys.exit(bool(report['failed']))
