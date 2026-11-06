"""Independent native assembly and provisional panel-fit fixture.

The earlier R6 nominal taper remains a reference. The declared plate band follows
its physical trial; a separate finite front-stock difference applies only to the
requested ring/cushion extension. The full case has not been re-measured.
"""
import json
import math
from pathlib import Path
import runpy

import FreeCAD as App
import Part


def rounded_wire(width, height, radius, centre, z):
    x, y = centre[0] - width / 2, centre[1] - height / 2
    right, top = x + width, y + height
    point = lambda xx, yy: App.Vector(xx, yy, z)
    arc = lambda xx, yy, start, end: Part.makeCircle(
        radius, point(xx, yy), App.Vector(0, 0, 1), start, end)
    return Part.Wire([
        Part.makeLine(point(x + radius, y), point(right - radius, y)),
        arc(right - radius, y + radius, 270, 360),
        Part.makeLine(point(right, y + radius), point(right, top - radius)),
        arc(right - radius, top - radius, 0, 90),
        Part.makeLine(point(right - radius, top), point(x + radius, top)),
        arc(x + radius, top - radius, 90, 180),
        Part.makeLine(point(x, top - radius), point(x, y + radius)),
        arc(x + radius, y + radius, 180, 270),
    ])


def enclosure_fixture(data, closed=True):
    centre, radius = data['centre'], data['cornerRadius']
    bottom = rounded_wire(*data['bottomOpening'], radius, centre, data['innerFloorZ'])
    top = rounded_wire(*data['topOpening'], radius, centre, data['grooveFloorZ'])
    cavity = Part.makeLoft([bottom, top], True, True)
    groove_face = Part.Face(rounded_wire(
        *data['grooveSize'][:2], radius, centre, data['grooveFloorZ']))
    groove = groove_face.extrude(App.Vector(0, 0, data['grooveSize'][2]))
    if closed:
        lid = Part.Face(rounded_wire(
            *data['topOpening'], radius, centre, data['rimZ']))
        lid = lid.extrude(App.Vector(0, 0, data['lidCeilingZ'] - data['rimZ']))
    else:
        # An opened lid imposes no assumed XY envelope above the body's rim.
        lid = Part.makeBox(1000, 1000, 1000, App.Vector(-500, -500, data['rimZ']))
    allowed = cavity.fuse(groove).fuse(lid)
    assert allowed.isValid() and allowed.isClosed() and allowed.Volume > 0
    ledge = groove_face.extrude(App.Vector(0, 0, -.05)).cut(cavity)
    return allowed, ledge


def point_inside(data, x, y, z, closed):
    tolerance = 1e-7
    if z < data['innerFloorZ'] - tolerance:
        return False
    if z <= data['grooveFloorZ'] + tolerance:
        fraction = min(1, max(0, (data['grooveFloorZ'] - z) / data['bodyDepth']))
        width, height = [a + (b - a) * fraction
                         for a, b in zip(data['topOpening'], data['bottomOpening'])]
    elif z <= data['rimZ'] + tolerance:
        width, height = data['grooveSize'][:2]
    else:
        if not closed:
            return True
        if z > data['lidCeilingZ'] + tolerance:
            return False
        width, height = data['topOpening']
    radius = data['cornerRadius']
    cx, cy = data['centre']
    dx = max(0, abs(x - cx) - (width / 2 - radius))
    dy = max(0, abs(y - cy) - (height / 2 - radius))
    return (abs(x-cx) <= width/2+tolerance and abs(y-cy) <= height/2+tolerance
            and dx*dx+dy*dy <= radius*radius+tolerance)


def box_inside(data, bounds, closed):
    heights = [bounds.ZMin, bounds.ZMax]
    for height in [data['grooveFloorZ'], data['rimZ'], data['lidCeilingZ']]:
        heights.extend(z for z in [height-1e-6, height+1e-6]
                       if bounds.ZMin < z < bounds.ZMax)
    # Every section is a convex rounded rectangle. Testing all box corners at
    # band boundaries proves containment; failed bounds receive an exact cut.
    return all(point_inside(data, x, y, z, closed)
               for x in [bounds.XMin, bounds.XMax]
               for y in [bounds.YMin, bounds.YMax] for z in heights)


def working_panel_fit_region(data):
    """An explicitly provisional, one-component region, never a new cavity."""
    fit = data['workingPanelFit']
    assert fit['componentId'] == 'parallel-base'
    assert fit['status'] == 'provisional-physical-fit-prototype'
    assert fit['testedAt'] == 'assembled-height-below-shelf'
    assert fit['cornerRadiusMeasured'] is False and fit['fullTaperReMeasured'] is False
    assert list(fit['centre']) == list(data['centre'])
    assert list(fit['outerSize']) == list(data['panelSize'])
    assert fit['cornerRadius'] == data['panelCornerRadius']
    assert fit['minZ'] == data['panelBottomZ'] and fit['maxZ'] == data['panelTopZ']
    region = Part.Face(rounded_wire(*fit['outerSize'], fit['cornerRadius'],
                                    fit['centre'], fit['minZ'])).extrude(
                                        App.Vector(0, 0, fit['maxZ']-fit['minZ']))
    assert region.isValid() and region.isClosed() and len(region.Solids) == 1
    return fit, region


def working_ring_fit_regions(data):
    """Only the requested new-minus-reference front stock, for two named prints."""
    fit=data['workingRingFit']
    assert fit['status']=='provisional-user-requested-front-edge-extension'
    assert fit['componentIds']==[data['ringId'],data['gasketId']]
    assert fit['direction']==[0,-1,0]and fit['extensionMm']==1
    assert fit['fixedMountingAxes']==data['mountingAxes']==[[7,7],[7,143],[207,7],[207,143]]
    assert fit['referenceCentre']==data['centre']==[107,75]
    assert fit['referenceOuterSize']==data['referenceRingOuterSize']==[217.4,153.4]
    assert fit['extendedCentre']==data['ringCentre']==[107,74.5]
    assert fit['extendedOuterSize']==data['ringOuterSize']==[217.4,154.4]
    assert data['topOpening']==[214,150]and data['bottomOpening']==[208,142]and data['grooveSize']==[218,154,2]
    assert data['skirtBottomZ']==data['panelTopZ']==7.5 and data['ringFlangeBottomZ']==18.9 and data['ringFlangeTopZ']==20.3
    assert data['gasketBottomZ']==18.5 and data['gasketTopZ']==18.9 and data['cavitySideClearance']==.3
    def flange(extended,lo,hi):
        size=fit['extendedOuterSize']if extended else fit['referenceOuterSize']
        centre=fit['extendedCentre']if extended else fit['referenceCentre']
        return Part.Face(rounded_wire(*size,data['ringCornerRadius'],centre,lo)).extrude(App.Vector(0,0,hi-lo))
    def skirt(extension):
        wires=[];inset=data['cavitySideClearance']
        for z in [data['skirtBottomZ'],data['skirtTopZ']]:
            depth=data['grooveFloorZ']-z
            width=data['topOpening'][0]-(data['topOpening'][0]-data['bottomOpening'][0])*depth/data['bodyDepth']-2*inset
            height=data['topOpening'][1]-(data['topOpening'][1]-data['bottomOpening'][1])*depth/data['bodyDepth']-2*inset+extension
            centre=[data['centre'][0],data['centre'][1]-extension/2]
            wires.append(rounded_wire(width,height,data['cornerRadius']-inset,centre,z))
        return Part.makeLoft(wires,True,True)
    front_skirt=skirt(1).cut(skirt(0))
    front_flange=flange(True,data['ringFlangeBottomZ'],data['ringFlangeTopZ']).cut(flange(False,data['ringFlangeBottomZ'],data['ringFlangeTopZ']))
    front_pad=flange(True,data['gasketBottomZ'],data['gasketTopZ']).cut(flange(False,data['gasketBottomZ'],data['gasketTopZ']))
    regions={data['ringId']:Part.makeCompound([front_skirt,front_flange]),data['gasketId']:front_pad}
    assert all(s.isValid()and s.isClosed()and s.Volume>0 for s in regions.values())
    return fit,regions


def component_containment(data, records, shapes, closed=True, mounting=None):
    allowed, _ = enclosure_fixture(data, closed)
    fit, working_region = working_panel_fit_region(data)
    ring_fit,ring_regions=working_ring_fit_regions(data)
    assert sum(record['id'] == fit['componentId'] for record in records) == 1
    assert all(sum(record['id']==id for record in records)==1 for id in ring_regions)
    working_study = None
    ring_studies=[]
    violations = []
    regions = (runpy.run_path(str(Path(__file__).with_name('case-panel-wall-mount-fixture.py')))
               ['external_hardware_regions'](mounting) if mounting is not None else {})
    assert set(regions) <= {record['id'] for record in records}, 'Missing declared exterior hardware'
    exterior = []
    exact_cuts = 0
    for record, shape in zip(records, shapes):
        if box_inside(data, shape.BoundBox, closed) and record['id'] != fit['componentId']and record['id']not in ring_regions:
            continue
        volume = 0
        original_outside = 0
        # A supplied multipart board can contain hundreds of original solids.
        # Only solids whose enclosing boxes fail need an exact native Boolean.
        for solid in shape.Solids:
            if not box_inside(data, solid.BoundBox, closed):
                exact_cuts += 1
                outside = solid.cut(allowed)
                if outside.isNull():
                    continue
                original_outside += outside.Volume
                if record['id'] in regions:
                    outside = outside.cut(regions[record['id']]['shape'])
                if record['id'] == fit['componentId']:
                    outside = outside.cut(working_region)
                if record['id']in ring_regions:
                    outside=outside.cut(ring_regions[record['id']])
                volume += 0 if outside.isNull() else outside.Volume
        if record['id'] == fit['componentId']:
            working_study = {
                'componentId': fit['componentId'], 'status': fit['status'],
                'volumeUnit': 'mm3',
                'previousNominalOutsideVolume': original_outside,
                'residualOutsideWorkingRegion': volume,
                'nominalReferenceContained': original_outside <= .001,
                'passed': volume <= .001,
            }
        if record['id']in ring_regions:
            ring_studies.append({'componentId':record['id'],'status':ring_fit['status'],'volumeUnit':'mm3','previousNominalOutsideVolume':original_outside,'residualOutsideRequestedFrontRegion':volume,'frontOnlyPermissionVolumeMm3':ring_regions[record['id']].Volume,'nominalReferenceContained':original_outside<=.001,'passed':volume<=.001})
        if record['id'] in regions:
            permission = regions[record['id']]
            exterior.append({'id': record['id'], 'mountId': permission['mountId'],
                             'role': permission['role'],
                             'outsideOriginalCavityVolumeMm3': original_outside,
                             'outsideAssignedFiniteZoneMm3': volume,
                             'passed': volume <= .001})
        if volume > .001:
            row = {'id': record['id'], 'outsideVolumeMm3': volume}
            violations.append(row)
            print('NATIVE_CASE_FIT_VIOLATION=' + json.dumps(row), flush=True)
    assert len(exterior) == len(regions), 'Exterior permission did not cross the measured cavity boundary'
    assert working_study is not None
    assert {r['componentId']for r in ring_studies}==set(ring_regions)
    ring_study={'passed':all(r['passed']for r in ring_studies),'componentIds':ring_fit['componentIds'],'direction':ring_fit['direction'],'extensionMm':1,'regions':'Only new-minus-reference outer skirt/flange stock for the ring, and new-minus-reference outer stock for its TPU cushion. No permission is shared with other components.','components':ring_studies}
    return violations, exact_cuts, exterior, working_study,ring_study


def audit_ring_wall_mounting(data,records,shapes):
    """Nine actual printed hole stacks and complete straight tool withdrawal paths."""
    by_id={r['id']:s for r,s in zip(records,shapes)};m=data['ringWallMounting'];installation=m['installation']
    assert m['hostId']==data['ringId']and len(m['holes'])==9
    assert m['boreDiameterMm']==3.4 and m['countersinkDiameterMm']==6.2 and m['countersinkAngleDegrees']==90 and m['countersinkDepthMm']==1.4
    assert m['padThicknessMm']==5 and m['padWidthMm']==10 and m['minimumCylindricalWebMm']>=3.4
    assert m['minimumSideEdgeLandMm']>=1.9 and m['minimumTopEdgeLandMm']>=1.2
    assert installation['removedComponentIds']==['case-battery-pack-1','case-battery-pack-2']
    assert [installation[k]for k in ['shaftDiameterMm','shaftLengthMm','handleDiameterMm','handleLengthMm','engagementTravelMm']]==[6,20,8,20,5]
    assert [(r['side'],r['alongMm'])for r in m['holes']]==[('left',15),('left',134),('right',107.75),('right',64),('front',145),('front',17),('rear',20),('rear',107),('rear',194)]
    host=by_id[m['hostId']];cavity=enclosure_fixture(data,False)[0];failures=[];rows=[]
    def positive_common(a,b):
        if any(min(getattr(a.BoundBox,d+'Max'),getattr(b.BoundBox,d+'Max'))-max(getattr(a.BoundBox,d+'Min'),getattr(b.BoundBox,d+'Min'))<1e-7 for d in'XYZ'):return 0
        return abs(a.common(b).Volume)
    for r in m['holes']:
        p=App.Vector(*r['headFace']);out=App.Vector(*r['outward']);inward=-out
        assert abs(out.Length-1)<1e-7 and out.z==0 and p.z==16
        assert abs((App.Vector(*r['wallPoint'])-p).dot(out)-5)<1e-7
        lateral=App.Vector(-out.y,out.x,0);vertical=App.Vector(0,0,1)
        def cylinder(radius,lo,hi):return Part.makeCylinder(radius,hi-lo,p+out*lo,out)
        def annulus(inner,outer,lo,hi):return cylinder(outer,lo,hi).cut(cylinder(inner,lo-.01,hi+.01))
        def local_box(lo,hi):
            vertices=[p+out*lo[0]+lateral*t+vertical*z for t,z in [(lo[1],lo[2]),(hi[1],lo[2]),(hi[1],hi[2]),(lo[1],hi[2])]]
            return Part.Face(Part.makePolygon(vertices+[vertices[0]])).extrude(out*(hi[0]-lo[0]))
        blocked_bore=positive_common(cylinder(1.69,.01,5.5),host)
        cone=Part.makeCone(3.09,1.69,1.4,p,out);blocked_cone=positive_common(cone,host)
        taper=[]
        for depth in [.15,.7,1.2]:
            radius=3.1-depth;probe=annulus(radius+.05,radius+.12,depth-.02,depth+.02);missing=probe.cut(host).Volume
            taper.append({'depthMm':depth,'nominalRadiusMm':radius,'missingTaperWallMm3':missing,'passed':missing<1e-5})
        web=annulus(1.75,2.5,1.405,4.795);missing_web=web.cut(host).Volume
        top=local_box([.1,-.4,3.15],[4.8,.4,4.25]);missing_top=top.cut(host).Volume
        sides=[]
        for lo,hi in [(-4.95,-3.15),(3.15,4.95)]:
            solid=local_box([.1,lo,-.4],[4.8,hi,.4]);missing=solid.cut(host).Volume
            sides.append({'minimumSideLandMm':1.9,'interiorWitnessWidthMm':hi-lo,'missingLandMm3':missing,'passed':missing<1e-5})
        shaft=Part.makeCylinder(3,25,p,inward)
        handle=Part.makeCylinder(4,25,p+inward*20,inward)
        hits=[];checked=[]
        for id,target in by_id.items():
            if id in installation['removedComponentIds']:continue
            checked.append(id)
            for name,tool in [('shaft',shaft),('handle',handle)]:
                volume=positive_common(tool,target)
                if volume>.001:hits.append({'partId':id,'toolMember':name,'overlapMm3':volume})
        outside=Part.makeCompound([shaft,handle]).cut(cavity).Volume
        passed=blocked_bore<1e-5 and blocked_cone<1e-5 and all(q['passed']for q in taper+sides)and missing_web<1e-5 and missing_top<1e-5 and not hits and outside<.001
        row={'id':r['id'],'side':r['side'],'headFace':r['headFace'],'wallPoint':r['wallPoint'],'outward':r['outward'],'passed':passed,'blockedBoreMm3':blocked_bore,'blockedCountersinkMm3':blocked_cone,'countersinkTaperWalls':taper,'minimumCylindricalWebMm':3.4,'missingCylindricalWebMm3':missing_web,'minimumTopEdgeLandMm':1.2,'missingTopLandMm3':missing_top,'sideLands':sides,'driver':{'passed':not hits and outside<.001,'installationStage':installation['stage'],'removedComponentIds':installation['removedComponentIds'],'checkedComponentIds':checked,'shaftDiameterMm':6,'shaftLengthMm':20,'handleDiameterMm':8,'handleLengthMm':20,'continuousInwardTravelMm':5,'sweptShaftLengthMm':25,'sweptHandleLengthMm':25,'collisions':hits,'outsideNominalOpenCavityMm3':outside}}
        rows.append(row)
        if not passed:failures.append(row)
    roots=[];reinforcement=data['postReinforcement'];assert reinforcement['architecture']=='two-wall-full-height-T-roots'
    assert reinforcement['ribWidthMm']>=4 and reinforcement['reachMm']>=12 and reinforcement['minimumPostLapMm']>=4.2
    assert reinforcement['bottomZ']==7.5 and reinforcement['topZ']==20.3
    # An analytic contour inset by0.03mm stays inside the source's polygonal
    # outer wall. The probe never borrows material from the case or gasket.
    inset=data['cavitySideClearance']+.03;wires=[]
    for z in [data['skirtBottomZ'],data['skirtTopZ']]:
        depth=data['grooveFloorZ']-z
        width=data['topOpening'][0]-(data['topOpening'][0]-data['bottomOpening'][0])*depth/data['bodyDepth']-2*inset
        height=data['topOpening'][1]-(data['topOpening'][1]-data['bottomOpening'][1])*depth/data['bodyDepth']-2*inset+1
        wires.append(rounded_wire(width,height,data['cornerRadius']-inset,data['ringCentre'],z))
    stock=Part.makeLoft(wires,True,True).fuse(Part.Face(rounded_wire(data['ringOuterSize'][0]-.06,data['ringOuterSize'][1]-.06,data['ringCornerRadius']-.03,data['ringCentre'],data['ringFlangeBottomZ'])).extrude(App.Vector(0,0,data['ringFlangeThickness'])))
    bores=[]
    for x,y in data['mountingAxes']:
        bores.extend([Part.makeCylinder(1.72,22,App.Vector(x,y,1.4)),Part.makeCylinder(3.12,3.3,App.Vector(x,y,data['screwUnderHeadZ']-.02))])
    for i,(x,y)in enumerate(data['mountingAxes']):
        members=[];reach=reinforcement['reachMm'];radius=data['postRadius']
        bounds=[([x-reach if x<107 else x-radius,y-1.98,7.52],[x+radius if x<107 else x+reach,y+1.98,20.28]),([x-1.98,y-reach if y<75 else y-radius,7.52],[x+1.98,y+radius if y<75 else y+reach,20.28])]
        for name,(lo,hi)in zip(['x-root','y-root'],bounds):
            expected=Part.makeBox(*(hi[j]-lo[j]for j in range(3)),App.Vector(*lo)).common(stock)
            for cutter in bores:expected=expected.cut(cutter)
            assert expected.Volume>100
            missing=expected.cut(host).Volume;ok=missing<1e-5
            members.append({'direction':name,'passed':ok,'nominalRibWidthMm':4,'verifiedInteriorRibWidthMm':3.96,'minimumPostLapMm':4.2,'bottomZ':7.5,'topZ':20.3,'expectedClippedRootVolumeMm3':expected.Volume,'missingRootVolumeMm3':missing})
        passed=all(q['passed']for q in members);row={'id':f'ring-post-root-{i+1}','axisPoint':[x,y],'passed':passed,'members':members};roots.append(row)
        if not passed:failures.append(row)
    return {'passed':not failures,'hostId':m['hostId'],'holes':rows,'postReinforcement':roots,'screwLengthSelected':False,'driveSelected':False,'casePilotDiameterSelected':False,'caseThreadEngagementVerified':False,'failures':failures,'limits':'Actual3.4mm printed passages,90degree countersink walls, complete local webs and both full-height post roots are checked. All nine compact-tool paths include their exact continuous5mm axial sweep against every installed component including the ring, removing only the two batteries, and stay inside the unchanged nominal open cavity. This does not select a self-tapper length, drive or case pilot; wall grip, fingers, arbitrary tools, molded exterior features and ingress performance remain unverified.'}


def audit_case_fit(data, records, shapes, closed=True, mounting=None):
    _, ledge = enclosure_fixture(data, closed)
    violations, exact_cuts, exterior, working_study,ring_study = component_containment(data, records, shapes, closed, mounting)
    by_id = {record['id']: shape for record, shape in zip(records, shapes)}
    ring_mounts=audit_ring_wall_mounting(data,records,shapes)
    if not ring_mounts['passed']:violations.append({'id':'ring-wall-mounting','failures':ring_mounts['failures']})

    seating_overlaps = {}

    def seated_area(name, moving, receiving):
        initial = moving.common(receiving).Volume
        seating_overlaps[name] = initial
        if initial > .001:
            violations.append({'contact': name, 'initialOverlapMm3': initial})
        lowered = moving.copy()
        lowered.translate(App.Vector(0, 0, -.01))
        return (lowered.common(receiving).Volume-initial) / .01

    ring = by_id[data['ringId']]
    pad = by_id[data['gasketId']]
    plate = by_id['parallel-base']
    contacts = {
        'adapterOnPanel': seated_area('adapterOnPanel', ring, plate),
        'adapterOnTpuPad': seated_area('adapterOnTpuPad', ring, pad),
        'tpuPadOnCaseLedge': seated_area('tpuPadOnCaseLedge', pad, ledge),
    }
    for name, area in contacts.items():
        if area <= .05:
            violations.append({'contact': name, 'areaMm2': area})
    highest = max(shape.BoundBox.ZMax for shape in shapes)
    lowest = min(shape.BoundBox.ZMin for shape in shapes)
    return {
        'passed': not violations,
        'validationScope': 'assembly-and-provisional-working-panel-fit',
        'fullCaseFitVerified': False,
        'workingPanelFit': data['workingPanelFit'],
        'workingPanelFitStudy': working_study,
        'workingRingFit':data['workingRingFit'],
        'workingRingFitStudy':ring_study,
        'cornerRadiusMm': data['cornerRadius'],
        'cornerRadiusApproximate': data['cornerRadiusApproximate'],
        'bodyDepthMm': data['bodyDepth'],
        'grooveFloorZ': data['grooveFloorZ'],
        'floorZ': data['innerFloorZ'],
        'lidCeilingZ': data['lidCeilingZ'],
        'closedLidStudy': closed,
        'floorClearanceMm': lowest-data['innerFloorZ'],
        'lidRoofClearanceMm': data['lidCeilingZ']-highest if closed else None,
        'measuredSeatingAreasMm2': contacts,
        'gasketFootprintAreaMm2':pad.Volume/data['gasketThickness'],
        'ringWallMounting':ring_mounts,
        'initialSeatingOverlapMm3': seating_overlaps,
        'exactNativeCuts': exact_cuts,
        'authorizedExteriorHardware': exterior,
        'violations': violations,
        'limits': 'The earlier nominal taper and inferred R6 corners remain reference data. The physical plate trial permits only its declared working-height band. The separately requested1mm ring/cushion front extension permits only each named part\'s finite new-minus-reference outer stock; nominal mismatch is reported and does not establish a larger measured case. All other components and material outside those component-specific regions retain the original cavity checks. Explicit side screws, washers and seals remain limited to finite per-ID exterior zones. Local nominal4mm wall coupons and drilled ports are checked separately. New boss gaps, lid ribs and molded case features remain unmeasured; full real-case fit is not verified. Remove the installed wall fixings before lifting the insert for bench service.',
    }
