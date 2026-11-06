"""Independent continuous-shell and PCB load-path probes, in operator millimetres.

Native geometry and contact areas establish the adopted model's load paths; they
are not strength, supplier contact-land or actual solder-pad qualifications.
"""
import json
import math
import FreeCAD as App
import Part


def box(bounds):
    return Part.makeBox(*(bounds['max'][i]-bounds['min'][i] for i in range(3)),App.Vector(*bounds['min']))


def local_common(first, second):
    """Crop original multipart boards before exact contact Booleans."""
    bb=second.BoundBox
    solids=[s for s in first.Solids if all(min(getattr(s.BoundBox,d+'Max'),getattr(bb,d+'Max'))-max(getattr(s.BoundBox,d+'Min'),getattr(bb,d+'Min'))>1e-8 for d in 'XYZ')]
    if not solids:return Part.Shape()
    return Part.makeCompound([s.common(second) for s in solids])


def audit_structure(case, shapes, overlap):
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    structure=case['mechanicalStructure'];retention=case['electronicsRetention']
    sections=[];networks=[];webs=[];bearings=[];registrations=[];seats=[];failures=[]
    adapter_roots={r['id']:r['seatRootZ']for r in structure['modularElectronics']['adapters']}
    def check(passed,label,**data):
        if not passed:
            row={'id':label,**data};failures.append(row)
            print('NATIVE_STRUCTURE_FAILURE='+json.dumps(row),flush=True)
    for r in structure['sections']:
        slab=Part.makeBox(r['max'][0]-r['min'][0],r['max'][1]-r['min'][1],.1,App.Vector(*r['min'],r['z']-.05))
        section=by_id[r['partId']].common(slab)
        # Short source-fitted pads may be isolated in a horizontal section while
        # their lower load paths remain joined to the floor. The outer shell's
        # continuity is measured separately from those explicitly probed pads.
        for excluded in r.get('exclude',[]):section=section.cut(box(excluded))
        connected=r.get('requireConnected',True)
        row={'id':r['id'],'zMm':r['z'],'solids':len(section.Solids),'areaMm2':section.Volume/.1,'requiredAreaMm2':r['minimumAreaMm2'],'requiresConnected':connected,'excludedGuideProbeBoxes':r.get('exclude',[])}
        row['passed']=section.isValid()and section.isClosed()and(not connected or row['solids']==1)and row['areaMm2']>=r['minimumAreaMm2']
        sections.append(row);check(row['passed'],r['id'],**{k:v for k,v in row.items()if k not in ['id','passed']})
    assert structure['networkRegions'],'A control-shell network above the floor must be explicitly probed.'
    for r in structure['networkRegions']:
        assert r['min'][2]>case['electronics']['floorTop']+1,'The frame proof must not join through the electronics floor.'
        network=by_id[r['partId']].common(box(r))
        for excluded in r.get('exclude',[]):network=network.cut(box(excluded))
        components=[]
        for solid in network.Solids:
            b=solid.BoundBox;components.append({'volumeMm3':solid.Volume,'min':[b.XMin,b.YMin,b.ZMin],'max':[b.XMax,b.YMax,b.ZMax]})
        passed=network.isValid()and network.isClosed()and len(network.Solids)==1 and network.Volume>=r['minimumVolumeMm3']
        row={'id':r['id'],'passed':passed,'cropMin':r['min'],'cropMax':r['max'],'volumeMm3':network.Volume,'minimumVolumeMm3':r['minimumVolumeMm3'],'solids':len(network.Solids),'components':components,'excludedIndependentFeatures':r.get('exclude',[])}
        networks.append(row);check(passed,r['id'],components=components,volumeMm3=network.Volume)
    for r in structure['webWitnesses']:
        probe=box(r);missing=probe.cut(by_id[r['partId']]).Volume
        row={'id':r['id'],'widthMm':min(r['max'][i]-r['min'][i]for i in range(2)),'outsideVolumeMm3':missing,'passed':missing<1e-5}
        webs.append(row);check(row['passed'],r['id'],outsideVolumeMm3=missing)
    for r in structure['bearings']:
        ids=r['movingIds']if 'movingIds'in r else[r['movingId']]
        if r['id']=='lower-panel-shoulder':
            assert set(ids)=={'case-lower-cradle','case-lower-body'}and len(ids)==2 and r['minimumAreaMm2']>=500
        else:assert len(ids)==1
        fixed=by_id[r['fixedId']];distance=App.Vector(*r['shift']).Length;members=[];contacts=[]
        for id in ids:
            moving=by_id[id];assert moving.isValid()and moving.isClosed()
            if r['id']=='lower-panel-shoulder':assert len(moving.Solids)==1,(id,'independent lower printable')
            before=overlap(moving,fixed);shifted=moving.copy();shifted.translate(App.Vector(*r['shift']))
            contacts.append({'partId':id,'initialOverlapMm3':before,'areaMm2':(overlap(shifted,fixed)-before)/distance});members.append(shifted)
        double_count=sum(overlap(first,second)for i,first in enumerate(members)for second in members[i+1:])
        before=sum(row['initialOverlapMm3']for row in contacts);area=sum(row['areaMm2']for row in contacts)
        row={'id':r['id'],'movingIds':ids,'contactAreaByPart':contacts,'areaMm2':area,'minimumAreaMm2':r['minimumAreaMm2'],'initialOverlapMm3':before,'shiftedMemberOverlapMm3':double_count,'passed':all(row['initialOverlapMm3']<.001 for row in contacts)and double_count<.001 and area>=r['minimumAreaMm2']}
        bearings.append(row);check(row['passed'],r['id'],areaMm2=area,initialOverlapMm3=before)
    for r in structure['registrations']:
        probe=box(r['probe']);key=by_id[r['partId']].common(probe);mate=by_id[r['matingId']]
        missing=probe.cut(by_id[r['partId']]).Volume;initial=overlap(key,mate)
        row={'id':r['id'],'engagementMm':r['engagementMm'],'occupiedProbeVolumeMm3':key.Volume,'missingProbeVolumeMm3':missing,'matingOverlapMm3':initial,'passed':key.Volume>0 and missing<1e-5 and initial<.001 and r['engagementMm']>=1.3}
        registrations.append(row);check(row['passed'],r['id'],missingProbeVolumeMm3=missing,matingOverlapMm3=initial)
    insertion=[]
    if all(id in by_id for id in ['case-top-bridge','parallel-base','case-lower-body']):
        for lift in [0,.25,1,3,6,15]:
            moved=by_id['case-top-bridge'].copy();moved.translate(App.Vector(0,0,lift))
            targets=[]
            for id in ['parallel-base','case-lower-body','case-lower-cradle']:
                if id not in by_id:continue
                volume=overlap(moved,by_id[id]);targets.append({'target':id,'overlapMm3':volume})
                check(volume<.001,'front-insert-cassette-'+str(lift),target=id,overlapMm3=volume)
            insertion.append({'liftMm':lift,'passed':all(r['overlapMm3']<.001 for r in targets),'targets':targets})
    axial=[];guides=[]
    for r in structure['mechanismAxialSeats']:
        target=by_id[r['partId']];host=by_id[r['hostId']];contact=box(r['contactBox']);moved=local_common(host,contact);moved.translate(App.Vector(*[-v*.01 for v in r['normal']]))
        area=overlap(moved,target)/.01;passed=area>=r['minimumAreaMm2']
        row={'id':r['id'],'partId':r['partId'],'contactAreaMm2':area,'minimumAreaMm2':r['minimumAreaMm2'],'passed':passed};axial.append(row);check(passed,r['id'],contactAreaMm2=area)
    for r in structure['mechanismGuides']:
        land=by_id[r['partId']].common(box(r['probe']));gap=by_id[r['hostId']].distToShape(land)[0]if land.Volume>0 else None
        passed=land.Volume>=r['minimumPrintedVolumeMm3']and gap is not None and abs(gap-r['nominalGapMm'])<=r['gapToleranceMm']
        row={'id':r['id'],'partId':r['partId'],'hostId':r['hostId'],'clearanceMm':gap,'nominalClearanceMm':r['nominalGapMm'],'printedProbeVolumeMm3':land.Volume,'passed':passed};guides.append(row);check(passed,r['id'],clearanceMm=gap,printedProbeVolumeMm3=land.Volume)
    for r in retention['supportSeats']:
        assert r['componentId']in adapter_roots,('Board-specific support remains in the universal tray',r['id'],r['componentId'])
        body=by_id[r['componentId']];host=by_id[r['hostId']];normal=r['normal'];axis=max(range(3),key=lambda i:abs(normal[i]));sign=1 if normal[axis]>0 else -1
        assert abs(abs(normal[axis])-1)<1e-6 and sum(abs(normal[i])for i in range(3)if i!=axis)<1e-6
        contact=box(r['contactBox']);crop=local_common(host,contact);pushed=crop.copy();pushed.translate(App.Vector(*[-v*.01 for v in normal]))
        area=overlap(pushed,body)/.01
        # Broad material behind the final short contact cap, before a PCB is fitted.
        p=r['plinthBox'];plinth=body.common(box(p));backing=[]
        surface=sum(r['contactBox'][side][axis]for side in['min','max'])/2
        far=p['min'][axis]if sign>0 else p['max'][axis]
        for depth in sorted(set([.4,max(.4,abs(surface-far)/2),max(.4,abs(surface-far)-.1)])):
            z=surface-sign*depth
            if not p['min'][axis]+.01<z<p['max'][axis]-.01:continue
            lo=list(p['min']);hi=list(p['max']);lo[axis]=z-.025;hi[axis]=z+.025
            cross=body.common(box({'min':lo,'max':hi}));backing.append({'depthBehindContactMm':depth,'areaMm2':cross.Volume/.05,'solids':len(cross.Solids)})
        root_z=adapter_roots[r['componentId']]
        continuous=plinth.isValid()and plinth.isClosed()and len(plinth.Solids)==1 and plinth.BoundBox.ZMin<=root_z+.05
        minimum_area=max(.5,.5*math.prod(r['contactBox']['max'][i]-r['contactBox']['min'][i]for i in range(3)if i!=axis))
        passed=area>=minimum_area and continuous and bool(backing)and all(x['areaMm2']>=16 for x in backing)
        row={'id':r['id'],'componentId':r['componentId'],'contactAreaMm2':area,'minimumContactAreaMm2':minimum_area,'connectedPlinthToAdapterRoot':continuous,'adapterRootZ':root_z,'backingSections':backing,'passed':passed,'basis':r['basis']}
        seats.append(row);check(passed,r['id'],contactAreaMm2=area,connectedPlinthToAdapterRoot=continuous,backingSections=backing)
    bank=structure['batteryPockets']
    assert bank['componentId']=='case-lower-body' and bank['wallThicknessMm']>=1.6
    assert len(bank['walls'])==5 and len(bank['guides'])==4
    assert len(bank['continuityProbes'])==len(bank['rootProbes'])==9 and len(bank['seatProbes'])==2
    assert abs(bank['wallTopZ']-1.5)<1e-7 and abs(bank['seatThicknessMm']-2.4)<1e-7
    battery_probes={}
    for group in ['continuityProbes','rootProbes','seatProbes']:
        rows=[]
        for probe in bank[group]:
            solid=box(probe)
            missing=solid.cut(by_id[bank['componentId']]).Volume
            passed=missing<1e-5
            rows.append({'id':probe['id'],'passed':passed,'min':probe['min'],'max':probe['max'],'probeVolumeMm3':solid.Volume,'outsideBodyVolumeMm3':missing})
            check(passed,probe['id'],outsideBodyVolumeMm3=missing)
        battery_probes[group]=rows
    all_walls=bank['walls']+bank['guides']
    minimum=[min(row['min'][axis]for row in all_walls)for axis in range(2)]
    maximum=[max(row['max'][axis]for row in all_walls)for axis in range(2)]
    top_probe=Part.makeBox(maximum[0]-minimum[0],maximum[1]-minimum[1],.01,App.Vector(*minimum,bank['wallTopZ']-.01))
    top_land=by_id[bank['componentId']].common(top_probe)
    assert top_land.isValid()and top_land.isClosed()and top_land.Volume>0
    initial=overlap(top_land,by_id['parallel-base'])
    top_land.translate(App.Vector(0,0,.01))
    area=overlap(top_land,by_id['parallel-base'])/.01
    bearing_passed=initial<.001 and area>=bank['minimumPanelBearingAreaMm2']
    check(bearing_passed,'battery-pocket-panel-bearing',areaMm2=area,initialOverlapMm3=initial)
    battery_pockets={'passed':bearing_passed and all(row['passed']for rows in battery_probes.values()for row in rows),
                     'wallThicknessMm':bank['wallThicknessMm'],'seatThicknessMm':bank['seatThicknessMm'],'wallTopZ':bank['wallTopZ'],
                     'wallCount':len(bank['walls']),'guideCount':len(bank['guides']),**battery_probes,
                     'panelBearingAreaMm2':area,'minimumPanelBearingAreaMm2':bank['minimumPanelBearingAreaMm2'],'initialPanelOverlapMm3':initial}
    reaction=bank['connectorReaction'];reaction_rows={}
    for field in ['seats','panelSeats','roots']:
        checked=[]
        assert len(reaction[field])==3
        for r in reaction[field]:
            probe=box(r);missing=probe.cut(by_id[bank['componentId']]).Volume
            row={'id':r['id'],'outsideBodyVolumeMm3':missing,'passed':missing<1e-5}
            if field!='roots':
                land=by_id[bank['componentId']].common(probe)
                target=by_id[r['hostId']]if field=='seats'else by_id['parallel-base']
                initial=overlap(land,target);land.translate(App.Vector(0,0,.01))
                area=overlap(land,target)/.01
                minimum=r['minimumBearingAreaMm2']if field=='seats'else .95*(r['max'][0]-r['min'][0])*(r['max'][1]-r['min'][1])
                row.update(contactAreaMm2=area,minimumBearingAreaMm2=minimum,initialOverlapMm3=initial)
                row['passed']=row['passed']and initial<.001 and area>=minimum
            checked.append(row);check(row['passed'],r['id'],**{k:v for k,v in row.items()if k not in ['id','passed']})
        reaction_rows[field]=checked
    reaction_rows['passed']=all(row['passed']for field in ['seats','panelSeats','roots']for row in reaction_rows[field])
    battery_pockets['connectorReaction']=reaction_rows
    battery_pockets['passed']=battery_pockets['passed']and reaction_rows['passed']
    brass=audit_brass_supports(case,shapes,overlap)
    check(brass['passed'],'all-brass-support-stacks',failures=brass['failures'])
    connector_mounting=audit_connector_mounting(case,shapes,overlap)
    check(connector_mounting['passed'],'all-xt60-embedded-mounts',failures=connector_mounting['failures'])
    pwm=audit_pwm_support(case,shapes,overlap)
    check(pwm['passed'],'continuous-pwm-wall-and-bearing',failures=pwm['failures'])
    carrier_registers=audit_carrier_brass_registers(case,shapes,overlap)
    check(carrier_registers['passed'],'four-carrier-brass-socket-registers',failures=carrier_registers['failures'])
    split=audit_lower_split(case,shapes,overlap)
    check(split['passed'],'two-part-lower-assembly-joint',failures=split['failures'])
    capture=audit_four_post_capture(case,shapes,overlap)
    check(capture['passed'],'four-post-lid-independent-capture',failures=capture['failures'])
    apron=audit_panel_bearing_apron(case,shapes,overlap)
    check(apron['passed'],'balanced-panel-bearing-apron',failures=apron['failures'])
    modular=audit_modular_electronics(case,shapes,overlap)
    check(modular['passed'],'universal-grid-and-seven-removable-board-adapters',failures=modular['failures'])
    return {'passed':not failures,'modularElectronics':modular,'panelBearingApron':apron,'fourPostCapture':capture,'sections':sections,'frameNetworks':networks,'webWitnesses':webs,'bearings':bearings,'registrations':registrations,'carrierBrassRegisters':carrier_registers,'lowerSplit':split,'boardSeats':seats,'mechanismAxialSeats':axial,'mechanismGuides':guides,'batteryPockets':battery_pockets,'brassSupports':brass,'connectorMounting':connector_mounting,'pwmSupport':pwm,'frontInsertionCheckpoints':insertion,'failures':failures,'limits':'Each lower print and board adapter must independently be one valid closed solid. Every universal node, actual M3 stack, board-bearing root and two real adapter relocations are checked separately. The four retained bottom clamps establish actual per-part web continuity, bearing and lid-independent capture; a joined compound cannot replace those checks. Eight disjoint actual panel-bearing regions additionally require broad lands, finite roots and continuous contact distribution. The cropped upper-frame network connects above the floor. Contact and guide probes remain independent. No material-strength or supplier thread rating is inferred.'}


def audit_panel_bearing_apron(case,shapes,overlap):
    """Prove local plate contact, continuous distribution and rooted 3 mm apron lands."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    data=case['mechanicalStructure']['panelBearingApron'];rows=[];failures=[];contacts=[]
    assert data['partId']=='case-lower-cradle'and data['fixedId']=='parallel-base'
    assert abs(data['planeZ']-1.5)<1e-7 and abs(data['thicknessMm']-3)<1e-7
    expected=['front-arm1','front-servo','front-arm2','rear-arm1','rear-servo','rear-arm2','left-front','left-rear']
    assert [r['id']for r in data['regions']]==expected
    minimum_areas=[130,200,140,120,200,115,60,50]
    moving=by_id[data['partId']];fixed=by_id[data['fixedId']];plane=data['planeZ']
    assert moving.isValid()and moving.isClosed()and len(moving.Solids)==1
    def volume(shape):return 0 if shape.isNull()else abs(shape.Volume)
    def check(passed,id,**extra):
        if not passed:failures.append({'id':id,**extra})
    for r,minimum in zip(data['regions'],minimum_areas):
        assert r['minimumAreaMm2']>=minimum and r['shift']==[0,0,.01]
        assert r['coverageAxis']in['x','y']and 0<r['cellWidthMm']<=1
        assert r['minimumBearingWidthMm']>=1.5 and r['minimumCoverageFraction']>=.98 and 0<=r['maximumGapMm']<=1
        assert r['minimumStraightLandWidthMm']>=3.5
        bounds=r['contactBox'];assert bounds['min'][2]<plane<bounds['max'][2]
        axis=0 if r['coverageAxis']=='x'else 1;cross=1-axis;distance=r['shift'][2]
        crop=moving.common(box(bounds));initial=overlap(crop,fixed)
        shifted=crop.copy();shifted.translate(App.Vector(*r['shift']))
        contact=shifted.common(fixed);contacts.append(contact)
        area=volume(contact)/distance
        # Finite stripes integrate actual curved/native contact, rather than
        # relying on point samples or a declared outline's area.
        cells=[];start=bounds['min'][axis];end=bounds['max'][axis];position=start;good=0;gap=0;maximum_gap=0
        while position<end-1e-8:
            stop=min(position+r['cellWidthMm'],end);width=stop-position
            lo=list(bounds['min']);hi=list(bounds['max']);lo[axis]=position;hi[axis]=stop
            lo[2]=plane-1e-4;hi[2]=plane+distance+1e-4
            cell_area=volume(contact.common(box({'min':lo,'max':hi})))/distance
            effective=cell_area/width;passed=effective>=r['minimumBearingWidthMm']-1e-5
            if passed:good+=width;gap=0
            else:gap+=width;maximum_gap=max(maximum_gap,gap)
            cells.append({'min':position,'max':stop,'widthMm':width,'contactAreaMm2':cell_area,'effectiveBearingWidthMm':effective,'passed':passed})
            position=stop
        fraction=good/(end-start)
        coverage={'passed':fraction>=r['minimumCoverageFraction']-1e-8 and maximum_gap<=r['maximumGapMm']+1e-8,'axis':r['coverageAxis'],'cellWidthMm':r['cellWidthMm'],'minimumWidthMm':r['minimumBearingWidthMm'],'minimumCoverageFraction':r['minimumCoverageFraction'],'actualCoverageFraction':fraction,'maximumAllowedGapMm':r['maximumGapMm'],'actualMaximumGapMm':maximum_gap,'cells':cells}
        land=r['straightLandProbe'];land_width=land['max'][cross]-land['min'][cross]
        assert land_width>=r['minimumStraightLandWidthMm']-1e-7
        assert all(bounds['min'][a]<=land['min'][a]<land['max'][a]<=bounds['max'][a]for a in range(2))
        lo=list(land['min']);hi=list(land['max']);lo[2]=plane-data['thicknessMm'];hi[2]=plane
        full_land=box({'min':lo,'max':hi});missing=volume(full_land.cut(moving))
        lo[2]=plane;hi[2]=plane+distance
        expected_skin=box({'min':lo,'max':hi});unbacked=volume(expected_skin.cut(contact))
        expected_area=(land['max'][0]-land['min'][0])*(land['max'][1]-land['min'][1])
        land_area=overlap(contact,expected_skin)/distance
        actual_width=land_area/(land['max'][axis]-land['min'][axis])
        straight={'passed':missing<1e-5 and unbacked<1e-5 and land_area>=expected_area-1e-4 and actual_width>=r['minimumStraightLandWidthMm']-1e-5,'declaredWidthMm':land_width,'actualBearingWidthMm':actual_width,'minimumWidthMm':r['minimumStraightLandWidthMm'],'actualBearingAreaMm2':land_area,'expectedAreaMm2':expected_area,'missingFullThicknessVolumeMm3':missing,'unbackedContactVolumeMm3':unbacked}
        roots=[]
        assert r['rootProbes']
        for probe in r['rootProbes']:
            missing_root=volume(box(probe).cut(moving));roots.append({'passed':missing_root<1e-5,'min':probe['min'],'max':probe['max'],'missingVolumeMm3':missing_root})
        if r['id']in['front-arm1','front-arm2']:
            # The broad bypass must join the toe to the servo-side shoulder;
            # the separate narrow remnant beside the terminal is insufficient.
            bridge=r['rootProbes'][-1]
            assert min(bridge['max'][a]-bridge['min'][a]for a in range(2))>=3
            assert bridge['min'][1]<10<bridge['max'][1]and bridge['min'][2]<0<bridge['max'][2]
        passed=initial<.001 and area>=r['minimumAreaMm2']and coverage['passed']and straight['passed']and all(v['passed']for v in roots)
        row={'id':r['id'],'passed':passed,'contactAreaMm2':area,'minimumAreaMm2':r['minimumAreaMm2'],'initialOverlapMm3':initial,'straightLand':straight,'roots':roots,'coverage':coverage};rows.append(row)
        check(passed,r['id'],contactAreaMm2=area,coveragePassed=coverage['passed'],straightLandPassed=straight['passed'],rootsPassed=all(v['passed']for v in roots))
    double_count=sum(overlap(first,second)for i,first in enumerate(contacts)for second in contacts[i+1:])
    check(double_count<1e-5,'disjoint-regional-contact',overlapMm3=double_count)
    region=data['networkRegion'];assert region['partId']==data['partId']and region['min'][2]>case['electronics']['floorTop']+1
    cropped=moving.common(box(region));network={'passed':cropped.isValid()and cropped.isClosed()and len(cropped.Solids)==1 and cropped.Volume>=region['minimumVolumeMm3'],'solids':len(cropped.Solids),'volumeMm3':volume(cropped),'minimumVolumeMm3':region['minimumVolumeMm3'],'min':region['min'],'max':region['max']}
    check(network['passed'],'rooted-apron-network',solids=network['solids'],volumeMm3=network['volumeMm3'])
    terminals=[]
    assert len(data['outwardToes'])==2
    for name,toe in zip(['arm1','arm2'],data['outwardToes']):
        x,y=case['layout'][name]
        assert abs(toe['max'][1]-(y-25))<1e-7
        # The unchanged fitted receiving shoulders legitimately occupy parts
        # of the much larger nominal terminal-cutter box. Check the new apron
        # at its actual toe-to-corridor interface, not that unrelated material.
        reserve={'min':[x-9.2,toe['max'][1],plane-data['thicknessMm']],'max':[x+9.2,toe['max'][1]+data['thicknessMm'],plane]}
        whole={'min':[x-9.2,y-25,-6],'max':[x+9.2,y-5,2]}
        occupied=overlap(moving,box(reserve));retained=overlap(moving,box(whole))
        row={'id':name+'-terminal-corridor','passed':occupied<1e-5,'scope':'front-toe-adjacent-apron-only','min':reserve['min'],'max':reserve['max'],'occupiedVolumeMm3':occupied,'nominalWholeCorridor':whole,'nominalWholeCorridorOccupiedVolumeMm3':retained,'qualification':'The full nominal box includes accepted source-fitted receiving shoulders. Whole-component installed and service checks remain strict; this new finite reserve proves the apron does not fill its toe-adjacent terminal opening.'};terminals.append(row)
        check(row['passed'],row['id'],occupiedVolumeMm3=occupied)
    return {'passed':not failures,'partId':data['partId'],'fixedId':data['fixedId'],'planeZ':plane,'thicknessMm':data['thicknessMm'],'regions':rows,'network':network,'terminalReserves':terminals,'contactRegionDoubleCountMm3':double_count,'totalRegionalContactAreaMm2':sum(r['contactAreaMm2']for r in rows),'failures':failures,'limits':'Native geometric bearing and load paths only. Finite 1 mm contact stripes assess continuity; separate full-thickness straight lands prove at least 3.5 mm width. The finite toe-adjacent terminal reserves remain empty; the larger nominal cutter boxes also contain unchanged fitted receiving shoulders and are not claimed empty. The cropped network cannot join through the floor. No strength, preload or material rating is inferred.'}


def annular_web_probe(row, target, expected_axis):
    """Measure one named printed web without attributing adjacent parts' material."""
    probe=row['annularProbe'];x,y,_=probe['axisPoint'];lo,hi=probe['minZ'],probe['maxZ']
    assert [x,y]==list(expected_axis[:2]),'Annular web probe must use its actual support axis'
    outer,inner,inset=probe['outerRadiusMm'],probe['innerRadiusMm'],probe['insetMm']
    assert abs(lo-row['minZ'])<1e-7 and abs(hi-row['maxZ'])<1e-7
    assert abs(outer-2.4)<1e-7 and abs(inner-1.7)<1e-7 and abs(inset-.01)<1e-7
    solid=Part.makeCylinder(outer,hi-lo-2*inset,App.Vector(x,y,lo+inset)).cut(Part.makeCylinder(inner,hi-lo+.02,App.Vector(x,y,lo-.01)))
    missing=solid.cut(target).Volume
    # A narrower radial annulus independently measures both actual end planes.
    crop=Part.makeCylinder(outer-.02,hi-lo+.2,App.Vector(x,y,lo-.1)).cut(Part.makeCylinder(inner+.02,hi-lo+.22,App.Vector(x,y,lo-.11)))
    actual=target.common(crop);thickness=actual.BoundBox.ZLength if actual.Volume>0 else 0
    actual_min=actual.BoundBox.ZMin if actual.Volume>0 else None
    actual_max=actual.BoundBox.ZMax if actual.Volume>0 else None
    passed=missing<1e-5 and thickness>=row['minimumThicknessMm']-1e-6 and actual_min is not None and abs(actual_min-lo)<1e-6 and abs(actual_max-hi)<1e-6
    return {'partId':row['partId'],'passed':passed,'minZ':lo,'maxZ':hi,'minimumThicknessMm':row['minimumThicknessMm'],'actualMinimumZ':actual_min,'actualMaximumZ':actual_max,'actualThicknessMm':thickness,'annularProbeOutsideMm3':missing}


def audit_lower_split(case,shapes,overlap):
    """Independent print topology and entire-tray footprint, without obsolete seam hardware."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    data=case['mechanicalStructure']['lowerSplit'];failures=[]
    assert data['attachment']=='four-main-brass-post-capture'
    assert data['trayId']=='case-lower-body'and data['cradleId']=='case-lower-cradle'
    assert not({'joints','keys','railContacts','seamZ'}&set(data))
    assert not any(id.startswith('case-lower-seam-')for id in by_id)
    for id in [data['trayId'],data['cradleId']]:
        shape=by_id[id]
        assert shape.isValid()and shape.isClosed()and len(shape.Solids)==1,(id,'independent printable topology')
    tray=by_id[data['trayId']]
    footprint=data['floorFootprint'];width,height=footprint['size'];cx,cy=footprint['centre'];radius=footprint['cornerRadius']
    assert abs(width-206.8)<1e-7 and abs(height-141.2)<1e-7 and radius==6
    z=footprint['bottomZ'];depth=tray.BoundBox.ZMax-z+.1
    horizontal=Part.makeBox(width,height-2*radius,depth,App.Vector(cx-width/2,cy-height/2+radius,z))
    vertical=Part.makeBox(width-2*radius,height,depth,App.Vector(cx-width/2+radius,cy-height/2,z))
    corners=[Part.makeCylinder(radius,depth,App.Vector(cx+sx*(width/2-radius),cy+sy*(height/2-radius),z))for sx in[-1,1]for sy in[-1,1]]
    outline=horizontal.multiFuse([vertical,*corners]).removeSplitter()
    outside=tray.cut(outline).Volume;roots=[]
    for support in case['mechanicalStructure']['brassSupports']['supports']:
        for probe in support['rootProbes']:
            projected=box({'min':[probe['min'][0],probe['min'][1],z],'max':[probe['max'][0],probe['max'][1],z+.1]})
            missing=projected.cut(outline).Volume;ok=missing<1e-5
            roots.append({'supportId':support['id'],'partId':probe['partId'],'outsideFloorFootprintMm3':missing,'passed':ok})
    floor_passed=outside<1e-5 and all(row['passed']for row in roots)
    floor_row={'passed':floor_passed,'sizeMm':footprint['size'],'centre':footprint['centre'],'cornerRadiusMm':radius,'entireTrayOutsideExtrudedFloorFootprintMm3':outside,'extrusionMinimumZ':z,'extrusionMaximumZ':z+depth,'brassRootFootprints':roots,'nominalCaseContainmentCheckedSeparately':True}
    if not floor_passed:failures.append({'id':'contained-uniform-lower-floor',**floor_row})
    return {'passed':not failures,'trayId':data['trayId'],'cradleId':data['cradleId'],'attachment':data['attachment'],'capturePlaneZ':data['capturePlaneZ'],'independentPrintableSolids':2,'floorContainment':floor_row,'failures':failures,'limits':'Each print is independently closed and connected. Four-post capture is proved separately from whole-tray containment; the nominal case containment remains strict.'}


def audit_carrier_support_ladder(case,shapes,overlap):
    """Full members and print-bed roots replace the former thin diagonal witnesses."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    data=case['mechanicalStructure']['fourPostCapture']['carrierSupport']
    assert data['architecture']=='straight-bed-rooted-ladder'
    assert data['partId']=='case-lower-cradle'and data['carrierId']=='case-test-clip-carrier'
    assert case['mechanicalStructure']['printRotations'][data['partId']]==[180,0,0]
    assert abs(data['printBedPlaneZ']-1.5)<1e-7 and abs(data['positiveBearingPlaneZ']+12)<1e-7
    assert abs(data['fullDepthMm']-13.5)<1e-7 and data['minimumMemberThicknessMm']>=3.5
    assert data['mainWallLapMm']>=3 and data['maxX']<=149.5
    assert len(data['crossRibs'])==2 and len(data['sections'])==4
    assert len(data['bedContactPatches'])==4 and len(data['mainWallLapProbes'])==len(data['seatWallLapProbes'])==2
    assert set(data['retainedBrassSupportIds'])=={f'case-brass-carrier-{i}'for i in range(1,5)}
    assert all(id in by_id for id in data['retainedBrassSupportIds'])
    target=by_id[data['partId']];failures=[]
    def check(passed,id,**extra):
        if not passed:failures.append({'id':id,**extra})
    members=[]
    declarations=[('main-spine',data['rootWall'],0,4.3),('seat-spine',data['seatWall'],0,3.5),*[(f'cross-rib-{i+1}',r,1,4)for i,r in enumerate(data['crossRibs'])]]
    for id,r,axis,minimum in declarations:
        assert abs(r['min'][2]+12)<1e-7 and abs(r['max'][2]-1.5)<1e-7
        width=r['max'][axis]-r['min'][axis]
        assert width>=minimum-1e-7 and r['max'][0]<=149.5+1e-7
        solid=box(r);missing=solid.cut(target).Volume
        passed=missing<1e-5
        members.append({'id':id,'passed':passed,'min':r['min'],'max':r['max'],'minimumMemberThicknessMm':minimum,'actualDeclaredThicknessMm':width,'fullMemberVolumeMm3':solid.Volume,'missingFullMemberVolumeMm3':missing})
        check(passed,id,missingFullMemberVolumeMm3=missing)
    sections=[]
    minimum_sections=[54,54,58.05,47.25]
    for r,minimum in zip(data['sections'],minimum_sections):
        axis={'x':0,'y':1}[r['normal']]
        thickness=r['max'][axis]-r['min'][axis]
        assert .1<=thickness<=.25 and r['minimumAreaMm2']>=minimum-1e-7
        assert abs(r['min'][2]+12)<1e-7 and abs(r['max'][2]-1.5)<1e-7
        section=target.common(box(r));area=section.Volume/thickness
        missing=box(r).cut(target).Volume
        passed=section.isValid()and section.isClosed()and len(section.Solids)==1 and area>=r['minimumAreaMm2']-1e-5 and missing<1e-5
        row={'id':r['id'],'passed':passed,'normal':r['normal'],'min':r['min'],'max':r['max'],'sectionThicknessMm':thickness,'actualAreaMm2':area,'minimumAreaMm2':r['minimumAreaMm2'],'missingFullSectionVolumeMm3':missing,'solids':len(section.Solids)}
        sections.append(row);check(passed,r['id'],actualAreaMm2=area,missingFullSectionVolumeMm3=missing)
    laps={}
    for field in ['mainWallLapProbes','seatWallLapProbes']:
        rows=[]
        for i,r in enumerate(data[field]):
            assert min(r['max'][j]-r['min'][j]for j in range(2))>=2.8-1e-7
            if field=='mainWallLapProbes':assert r['max'][2]-r['min'][2]>=13
            else:assert r['min'][2]<=-13 and r['max'][2]>=-10.1 and r['min'][2]<data['seatWall']['min'][2]<r['max'][2]
            missing=box(r).cut(target).Volume;passed=missing<1e-5
            rows.append({'passed':passed,'min':r['min'],'max':r['max'],'missingLapVolumeMm3':missing})
            check(passed,field+'-'+str(i+1),missingLapVolumeMm3=missing)
        laps[field]=rows
    bed=[]
    plane=data['printBedPlaneZ']
    for i,r in enumerate(data['bedContactPatches']):
        assert abs(r['max'][2]-plane)<1e-7 and abs(r['min'][2]-(plane-.1))<1e-7
        expected=(r['max'][0]-r['min'][0])*(r['max'][1]-r['min'][1]);assert expected>=25
        region=box(r);missing=region.cut(target).Volume
        face_area=sum(f.common(region).Area for f in target.Faces if f.BoundBox.ZLength<1e-7 and abs(f.BoundBox.ZMin-plane)<1e-7)
        passed=missing<1e-5 and face_area>=expected-1e-5
        bed.append({'passed':passed,'min':r['min'],'max':r['max'],'expectedBedAreaMm2':expected,'actualCoplanarBedAreaMm2':face_area,'missingBedRootVolumeMm3':missing})
        check(passed,'bed-root-'+str(i+1),actualCoplanarBedAreaMm2=face_area,missingBedRootVolumeMm3=missing)
    slices=[]
    for z in [-11.8,-8,-4,0,1.4]:
        cropped=target.common(box({'min':[134.7,12,z-.025],'max':[149.5,54,z+.025]}))
        area=cropped.Volume/.05;passed=cropped.isValid()and cropped.isClosed()and len(cropped.Solids)==1 and area>=383.6-1e-5
        slices.append({'zMm':z,'passed':passed,'actualAreaMm2':area,'minimumAreaMm2':383.6,'solids':len(cropped.Solids)})
        check(passed,'connected-ladder-layer-'+str(z),actualAreaMm2=area,solids=len(cropped.Solids))
    return {'passed':not failures,'partId':data['partId'],'carrierId':data['carrierId'],'architecture':data['architecture'],'printRotationDegrees':[180,0,0],'printBedPlaneZ':plane,'minimumMemberThicknessMm':data['minimumMemberThicknessMm'],'fullMembers':members,'sections':sections,**laps,'bedContactPatches':bed,'connectedDepthSlices':slices,'retainedBrassSupportIds':data['retainedBrassSupportIds'],'failures':failures,'limits':'Finite full members, their four measured sections, actual coplanar bed faces and both connection laps establish this geometric support path. Local ladder material starts directly on the inverted print bed; supports elsewhere in the cradle are assessed separately. Existing carrier bearing, keys, complete ties, four metal supports and full clip motion remain independent strict checks. No support-removal force or printed material strength rating is inferred.'}


def audit_four_post_capture(case,shapes,overlap):
    """Four actual bottom clamps capture the cradle even with all lid screws removed."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    supports={r['id']:r for r in case['mechanicalStructure']['brassSupports']['supports']if r['role']=='main'}
    data=case['mechanicalStructure']['fourPostCapture'];posts=data['posts'];rows=[];failures=[]
    assert len(posts)==len(supports)==4 and {r['brassId']for r in posts}==set(supports)
    assert data['retainedWhenLidRemoved']is True and abs(data['capturePlaneZ']+49.5)<1e-7
    assert data['trayId']=='case-lower-body'and data['cradleId']=='case-lower-cradle'
    def hex_prism(af,clock,x,y,z,height):
        radius=af/math.sqrt(3);points=[App.Vector(x+radius*math.cos(math.radians(clock+i*60)),y+radius*math.sin(math.radians(clock+i*60)),z)for i in range(6)]
        return Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,height))
    def flat_prism(x,y,z,height,angle,near,far,halfspan):
        nx,ny=math.cos(angle),math.sin(angle);tx,ty=-ny,nx
        points=[App.Vector(x+nx*r+tx*t,y+ny*r+ty*t,z)for r,t in [(near,-halfspan),(far,-halfspan),(far,halfspan),(near,halfspan)]]
        return Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,height))
    for r in posts:
        errors=[]
        def require(ok,label,**details):
            if not ok:errors.append({'check':label,**details})
        support=supports[r['brassId']];tray=by_id[r['trayId']];cradle=by_id[r['cradleId']];metal=by_id[r['brassId']]
        x,y,plane=r['axisPoint'];assert r['axis']==[0,0,1]and r['trayId']==data['trayId']and r['cradleId']==data['cradleId']
        assert [x,y]==support['axisPoint'][:2]and abs(plane+49.5)<1e-7
        assert abs(r['brassSeatZ']+47.5)<1e-7 and abs(r['headSeatZ']+52.4)<1e-7
        assert r['retainedComponentIds']==[r['brassId'],r['bottomScrewId']]and r['removedBeforeWithdrawalIds']==[r['lidScrewId']]
        assert set(r['retainedComponentIds'])<=set(by_id)and r['lidScrewId']in by_id
        assert support['bottomBearingPartId']==r['cradleId']and support['clampedPartIds']==[r['trayId'],r['cradleId']]
        assert len(r['contacts'])==3 and {c['id']for c in r['contacts']}=={'foot-to-tray','brass-to-foot','head-to-tray'}
        expected_contacts={'foot-to-tray':(r['cradleId'],r['trayId'],-49.5,50),'brass-to-foot':(r['brassId'],r['cradleId'],-47.5,12),'head-to-tray':(r['bottomScrewId'],r['trayId'],-52.4,12)}
        contacts=[]
        for c in r['contacts']:
            moving_id,fixed_id,contact_z,minimum=expected_contacts[c['id']]
            assert c['movingId']==moving_id and c['fixedId']==fixed_id and abs(c['planeZ']-contact_z)<1e-7 and c['minimumAreaMm2']>=minimum
            moving=by_id[moving_id].common(box(c['contactBox']));fixed=by_id[fixed_id]
            initial=overlap(moving,fixed);moved=moving.copy();moved.translate(App.Vector(*c['shift']))
            distance=App.Vector(*c['shift']).Length;assert abs(distance-.01)<1e-7
            area=overlap(moved,fixed)/distance;ok=initial<.001 and area>=c['minimumAreaMm2']
            contacts.append({'id':c['id'],'movingId':moving_id,'fixedId':fixed_id,'passed':ok,'initialOverlapMm3':initial,'actualBearingAreaMm2':area,'minimumAreaMm2':c['minimumAreaMm2']})
            require(ok,'actual-sequential-clamp-contact',contact=c['id'],areaMm2=area,initialOverlapMm3=initial)
        assert len(r['webAnnuli'])==2 and [w['partId']for w in r['webAnnuli']]==[r['trayId'],r['cradleId']]
        webs=[annular_web_probe(w,by_id[w['partId']],r['axisPoint'])for w in r['webAnnuli']]
        assert abs(r['webAnnuli'][0]['minimumThicknessMm']-2.9)<1e-7 and abs(r['webAnnuli'][1]['minimumThicknessMm']-2)<1e-7
        combined=sum(w['actualThicknessMm']for w in webs)
        require(all(w['passed']for w in webs)and combined>=4.9-1e-6,'two-named-continuous-clamped-webs',webs=webs,combinedActualThicknessMm=combined)
        probes=[]
        assert len(r['sleeveWallProbes'])==3 and all(len(r[field])==2 for field in ['slotEdgeProbes','closedEndProbes','jointRootProbes','upperRootProbes','footRootProbes'])
        for p in r['jointRootProbes']:assert p['min'][2]<case['mechanicalStructure']['lowerSplit']['fittedCradleBaseZ']<p['max'][2]
        for field in ['sleeveWallProbes','slotEdgeProbes','closedEndProbes','jointRootProbes','upperRootProbes','footRootProbes']:
            for index,p in enumerate(r[field]):
                missing=box(p).cut(cradle).Volume;ok=missing<1e-5
                probes.append({'group':field,'index':index,'partId':r['cradleId'],'min':p['min'],'max':p['max'],'outsideCradleMm3':missing,'passed':ok})
                require(ok,'finite-full-post-load-path',group=field,index=index,outsideCradleMm3=missing)
        bore=Part.makeCylinder(r['boreDiameterMm']/2,2,App.Vector(x,y,plane));bore_blocked=overlap(bore,cradle)
        require(abs(r['boreDiameterMm']-3.4)<1e-7 and bore_blocked<.001,'clear-foot-screw-bore',blockedVolumeMm3=bore_blocked)
        slot=r['cleaningSlot'];side=-1 if x<83.5 else 1
        expected_min=[x+(-4.6 if side<0 else 1.8),y-1.2,-47.5]
        expected_max=[x+(-1.8 if side<0 else 4.6),y+1.2,-19.7]
        assert all(abs(slot['min'][i]-expected_min[i])<1e-7 and abs(slot['max'][i]-expected_max[i])<1e-7 for i in range(3))
        assert slot['outward']==[side,0,0]and abs(slot['widthMm']-2.4)<1e-7 and slot['facingFlatIndex']==(2 if side<0 else 5)
        slot_blocked=overlap(box(slot),cradle)
        require(slot_blocked<.001,'continuous-print-cleaning-slot',blockedCradleMm3=slot_blocked)
        reg=r['socketRegistration'];lo,hi=reg['minZ'],reg['maxZ'];height=hi-lo
        assert reg['partId']==r['cradleId']and reg['supportId']==r['brassId']and reg['axisPoint']==[x,y,lo]
        assert abs(lo+47.5)<1e-7 and abs(hi-1.5)<1e-7 and abs(height-reg['engagementMm'])<1e-7 and height>=49-1e-7
        assert abs(reg['acrossFlatsMm']-5.3)<1e-7 and reg['hexClockDegrees']==30 and abs(reg['blockingTranslationMm']-.4)<1e-7
        socket=hex_prism(reg['acrossFlatsMm'],reg['hexClockDegrees'],x,y,lo,height)
        actual=metal.common(Part.makeBox(8,8,height,App.Vector(x-4,y-4,lo)))
        outside=actual.cut(hex_prism(5,reg['hexClockDegrees'],x,y,lo,height)).Volume
        blocked=overlap(socket,cradle);registration_initial=overlap(actual,cradle)
        require(actual.Volume>0 and actual.isValid()and actual.isClosed()and outside<1e-5 and blocked<.001 and registration_initial<.001,'actual-metal-in-continuous-hex-route',actualMetalOutsideAF5Mm3=outside,blockedRouteMm3=blocked,initialOverlapMm3=registration_initial)
        wall_rows=[]
        segments=reg['wallProbeSegments'];assert len(segments)==6 and {q['face']for q in segments}==set(range(6))
        for declaration in segments:
            index=declaration['face'];angle=math.radians(reg['hexClockDegrees']+30+index*60)
            assert len(declaration['segments'])==1
            wall_segments=[]
            for span in declaration['segments']:
                expected_min=-19.55 if index==slot['facingFlatIndex']else -47.35
                assert abs(span['minZ']-expected_min)<1e-7 and abs(span['maxZ']-1.35)<1e-7
                wall=flat_prism(x,y,span['minZ'],span['maxZ']-span['minZ'],angle,2.651,2.801,.5)
                missing=wall.cut(cradle).Volume;ok=missing<1e-5
                wall_segments.append({'minZ':span['minZ'],'maxZ':span['maxZ'],'passed':ok,'outsideCradleMm3':missing})
                require(ok,'retained-source-receiving-flat-wall',face=index,minZ=span['minZ'],maxZ=span['maxZ'],outsideCradleMm3=missing)
            outer=flat_prism(x,y,lo+.15,height-.3,angle,2.47,2.5,.5);metal_missing=outer.cut(actual).Volume
            ok=all(q['passed']for q in wall_segments)and metal_missing<1e-5
            wall_rows.append({'face':index,'passed':ok,'retainedWallSegments':wall_segments,'outsideActualMetalMm3':metal_missing})
            require(metal_missing<1e-5,'actual-full-height-metal-flat',face=index,outsideActualMetalMm3=metal_missing)
        moves=[]
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            shift=[dx*.4,dy*.4,0];moved=actual.copy();moved.translate(App.Vector(*shift));v=overlap(moved,cradle);ok=v>.001
            moves.append({'translation':shift,'overlapCradleMm3':v,'passed':ok});require(ok,'registered-post-blocks-transverse-motion',translation=shift,overlapMm3=v)
        extension_hi=case['mechanicalStructure']['lowerSplit']['fittedCradleBaseZ']
        assert lo<extension_hi<hi
        extension=actual.common(Part.makeBox(8,8,extension_hi-lo,App.Vector(x-4,y-4,lo)))
        extension_initial=overlap(extension,cradle);extension_moves=[]
        require(extension.Volume>0 and extension_initial<.001,'actual-new-extension-metal',initialOverlapMm3=extension_initial)
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            shift=[dx*.4,dy*.4,0];moved=extension.copy();moved.translate(App.Vector(*shift));v=overlap(moved,cradle);ok=v>.001
            extension_moves.append({'translation':shift,'overlapCradleMm3':v,'passed':ok})
            require(ok,'new-extension-registers-without-upper-socket',translation=shift,overlapMm3=v)
        foot=cradle.common(box(r['footBounds']));assert foot.Volume>0 and foot.isValid()and foot.isClosed()
        capture=[]
        for label,dz,target_id,minimum in [('up',.01,r['brassId'],12),('down',-.01,r['trayId'],50)]:
            target=by_id[target_id];initial=overlap(foot,target);moved=foot.copy();moved.translate(App.Vector(0,0,dz))
            v=overlap(moved,target);ok=initial<.001 and v/abs(dz)>=minimum
            capture.append({'direction':label,'translation':[0,0,dz],'target':target_id,'initialOverlapMm3':initial,'blockingOverlapMm3':v,'blockingAreaMm2':v/abs(dz),'minimumAreaMm2':minimum,'passed':ok})
            require(ok,'lid-independent-positive-foot-capture',direction=label,target=target_id,overlapMm3=v)
        row={'id':r['id'],'passed':not errors,'brassId':r['brassId'],'bottomScrewId':r['bottomScrewId'],'contacts':contacts,'clampedWebParts':webs,'totalClampedWebThicknessMm':combined,'loadPathProbes':probes,'cleaningSlot':{'passed':slot_blocked<.001,'min':slot['min'],'max':slot['max'],'widthMm':slot['widthMm'],'outward':slot['outward'],'blockedCradleMm3':slot_blocked,'stage':'Separate printed cradle before metal installation; the complete foot and original upper collar remain closed.'},'footBoreBlockedMm3':bore_blocked,'socketRegistration':{'passed':blocked<.001 and registration_initial<.001 and outside<1e-5 and all(q['passed']for q in wall_rows+moves),'engagementMm':height,'blockedRouteMm3':blocked,'actualMetalOutsideAF5Mm3':outside,'flatNormalGapUpperBoundMm':.151,'gapScope':reg['wallGapScope'],'gapAppliesToRetainedWallSegmentsOnly':True,'wallAndMetalProbes':wall_rows,'blockedTransverseMoves':moves},'newExtensionRegistration':{'passed':extension_initial<.001 and all(q['passed']for q in extension_moves),'minZ':lo,'maxZ':extension_hi,'actualMetalVolumeMm3':extension.Volume,'initialOverlapMm3':extension_initial,'blockedTransverseMoves':extension_moves},'lidIndependentCapture':{'passed':all(q['passed']for q in capture),'removedIds':[q['lidScrewId']for q in posts],'retainedIds':[q for p in posts for q in p['retainedComponentIds']],'trials':capture},'failures':errors}
        rows.append(row)
        if errors:failures.append({'id':r['id'],'failures':errors})
    carrier=audit_carrier_support_ladder(case,shapes,overlap)
    if not carrier['passed']:failures.append({'id':'bed-rooted-carrier-support','failures':carrier['failures']})
    return {'passed':not failures,'posts':rows,'carrierSupport':carrier,'retainedWhenLidRemoved':True,'failures':failures,'limits':'Actual named tray and cradle webs, brass-end bearing and bottom-head bearing form the capture stack. Small up/down foot trials use only the retained actual metal and tray as blockers, with every lid screw removed. The separate carrier-support audit requires complete bed-rooted members and broad laps. These geometric load paths do not qualify material strength, tightening torque or unmeasured thread depth.'}


def audit_carrier_brass_registers(case,shapes,overlap):
    """Actual AF5 ends in four AF5.3 sockets, with finite surrounding walls."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    supports={r['id']:r for r in case['mechanicalStructure']['brassSupports']['supports']if r['role']=='carrier'}
    declared=case['mechanicalStructure']['carrierBrassRegisters'];rows=[];failures=[]
    assert len(declared)==len(supports)==4 and {r['supportId']for r in declared}==set(supports)
    def hex_prism(af,clock,x,y,z,height):
        radius=af/math.sqrt(3)
        points=[App.Vector(x+radius*math.cos(math.radians(clock+i*60)),y+radius*math.sin(math.radians(clock+i*60)),z)for i in range(6)]
        return Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,height))
    def flat_prism(x,y,z,height,angle,near,far,halfspan):
        nx,ny=math.cos(angle),math.sin(angle);tx,ty=-ny,nx
        points=[App.Vector(x+nx*r+tx*t,y+ny*r+ty*t,z)for r,t in [(near,-halfspan),(far,-halfspan),(far,halfspan),(near,halfspan)]]
        return Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,height))
    for r in declared:
        errors=[]
        def require(ok,label,**data):
            if not ok:errors.append({'check':label,**data})
        s=supports[r['supportId']];metal=by_id[r['supportId']];receiver=by_id[r['partId']]
        assert r['partId']=='case-test-clip-carrier'
        x,y,_=r['axisPoint'];lo,hi=r['minZ'],r['maxZ'];height=hi-lo;clock=r['hexClockDegrees']
        assert r['axisPoint'][:2]==s['axisPoint'][:2]and abs(hi-s['topSeatZ'])<1e-7
        assert abs(r['axisPoint'][2]-lo)<1e-7
        assert abs(height-r['engagementMm'])<1e-7 and height>=2.5-1e-7
        assert abs(r['acrossFlatsMm']-5.3)<1e-7 and abs(s['acrossFlatsMm']-5)<1e-7
        assert 0<r['maximumTransverseGapMm']<=.174 and .399999<=r['blockingTranslationMm']<=.400001
        socket=hex_prism(r['acrossFlatsMm'],clock,x,y,lo,height)
        nominal_metal=hex_prism(s['acrossFlatsMm'],clock,x,y,lo,height)
        actual=metal.common(Part.makeBox(8,8,height,App.Vector(x-4,y-4,lo)))
        require(actual.isValid()and actual.isClosed()and actual.Volume>0,'actual-engaged-metal')
        outside=actual.cut(nominal_metal).Volume;blocked=overlap(socket,receiver);initial=overlap(actual,receiver)
        require(outside<1e-5 and blocked<.001 and initial<.001,'matching-clear-hex-socket',actualMetalOutsideAF5Mm3=outside,blockedSocketMm3=blocked,initialOverlapMm3=initial)
        # Six wall strips bound flat-normal clearance. Their radius also bounds
        # the worst cardinal clearance, which is larger by 1/cos(30 degrees).
        bound=min(.151,r['maximumTransverseGapMm']*math.cos(math.pi/6))
        nominal_gap=(r['acrossFlatsMm']-s['acrossFlatsMm'])/2
        require(nominal_gap<=bound+1e-7,'declared-clearance-bound')
        walls=[];metal_flats=[]
        for index in range(6):
            angle=math.radians(clock+30+index*60)
            wall=flat_prism(x,y,lo+.15,height-.3,angle,s['acrossFlatsMm']/2+bound,s['acrossFlatsMm']/2+bound+.15,.75)
            missing=wall.cut(receiver).Volume;ok=missing<1e-5
            walls.append({'face':index,'outsideCarrierVolumeMm3':missing,'passed':ok})
            require(ok,'finite-socket-wall',face=index,outsideCarrierVolumeMm3=missing)
            outer=flat_prism(x,y,lo+.15,height-.3,angle,s['acrossFlatsMm']/2-.03,s['acrossFlatsMm']/2,.75)
            missing=outer.cut(actual).Volume;ok=missing<1e-5
            metal_flats.append({'face':index,'outsideActualMetalVolumeMm3':missing,'passed':ok})
            require(ok,'actual-AF5-outer-flat',face=index,outsideActualMetalVolumeMm3=missing)
        blocked_moves=[]
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            shift=[dx*r['blockingTranslationMm'],dy*r['blockingTranslationMm'],0]
            moved=actual.copy();moved.translate(App.Vector(*shift));volume=overlap(moved,receiver);ok=volume>.001
            blocked_moves.append({'translation':shift,'overlapCarrierVolumeMm3':volume,'passed':ok})
            require(ok,'socket-blocks-lateral-withdrawal',translation=shift,overlapCarrierVolumeMm3=volume)
        row={'id':r['id'],'supportId':r['supportId'],'partId':r['partId'],'passed':not errors,'engagementMm':height,'socketAcrossFlatsMm':r['acrossFlatsMm'],'metalAcrossFlatsMm':s['acrossFlatsMm'],'hexClockDegrees':clock,'actualMetalOutsideAF5Mm3':outside,'blockedSocketVolumeMm3':blocked,'initialOverlapMm3':initial,'flatNormalGapUpperBoundMm':bound,'nominalFlatNormalGapMm':nominal_gap,'maximumTransverseGapMm':r['maximumTransverseGapMm'],'wallProbes':walls,'actualMetalFlatProbes':metal_flats,'blockedLateralMoves':blocked_moves,'failures':errors}
        rows.append(row)
        if errors:failures.append({'id':r['id'],'failures':errors})
    return {'passed':not failures,'registers':rows,'failures':failures,'limits':'Finite socket walls and actual source-metal engagement prove nominal geometric registration; existing brass end-bearing and screw-depth checks remain separate. No material-strength or delivered-stock tolerance rating is inferred.'}


def audit_brass_supports(case,shapes,overlap):
    """Eight actual metal load paths, clamped floor webs and bottom driver approaches."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    records={r['id']:r for r in case['components']}
    supports=case['mechanicalStructure']['brassSupports']['supports']
    expected={id for id in by_id if id.startswith('case-brass-')and not id.startswith('case-brass-bottom-screw-')}
    failures=[];rows=[]
    def check(ok,id,**data):
        if not ok:failures.append({'id':id,**data})
    check(len(supports)==len(expected)==8 and {r['id']for r in supports}==expected,'eight-complete-brass-supports')
    check(sum(r['role']=='main'for r in supports)==sum(r['role']=='carrier'for r in supports)==4,'four-main-four-carrier-supports')
    for r in supports:
        errors=[]
        def require(ok,label,**data):
            if not ok:errors.append({'check':label,**data})
        assert r['axis']==[0,0,1],(r['id'],'only the declared vertical support frame is adopted')
        metal=by_id[r['id']];floor=by_id[r['floorPartId']];bottom_bearing=by_id[r['bottomBearingPartId']];upper=by_id[r['upperPartId']]
        x,y=r['axisPoint'][:2];lo,hi=r['bottomSeatZ'],r['topSeatZ'];bb=metal.BoundBox
        require(abs(bb.ZMin-lo)<1e-6 and abs(bb.ZMax-hi)<1e-6 and abs(hi-lo-r['bodyLengthMm'])<1e-7,'stock-length-and-seats')
        require(abs(r['acrossFlatsMm']-5)<1e-7,'confirmed-AF5')
        # A thin actual end slice retains the source bore and hex outline.
        lower=metal.common(Part.makeBox(10,10,.01,App.Vector(x-5,y-5,lo)))
        higher=metal.common(Part.makeBox(10,10,.01,App.Vector(x-5,y-5,hi-.01)))
        require(lower.Volume>0 and higher.Volume>0,'actual-metal-end-slices')
        initial_floor=overlap(metal,floor);initial_bottom=overlap(metal,bottom_bearing);initial_upper=overlap(metal,upper)
        lower.translate(App.Vector(0,0,-.01));higher.translate(App.Vector(0,0,.01))
        lower_area=overlap(lower,bottom_bearing)/.01;upper_area=overlap(higher,upper)/.01
        require(initial_floor<.001 and initial_bottom<.001 and initial_upper<.001,'zero-initial-load-part-overlap',floorMm3=initial_floor,bottomBearingMm3=initial_bottom,upperMm3=initial_upper)
        require(lower_area>=r['minimumBearingAreaMm2']and upper_area>=r['minimumBearingAreaMm2'],'actual-two-end-bearing',bottomAreaMm2=lower_area,topAreaMm2=upper_area)
        bottom_id=r['bottomScrewId'];bottom=by_id[bottom_id];params=records[bottom_id]['parameters'];sb=bottom.BoundBox
        head_seat=sb.ZMin+params['headHeight'];reach=sb.ZMax-lo;depth=r['minimumUsableFemaleDepthMm'];clearance=depth-reach
        require(abs(head_seat-r['bottomHeadSeatZ'])<1e-6 and abs(params['length']-8)<1e-7,'bottom-stock-screw-and-underhead')
        require(reach>=3-1e-6 and clearance>=.29,'bottom-nominal-thread-reach',reachMm=reach,minimumUsableDepthMm=depth,bottomClearanceMm=clearance)
        web_thickness=lo-head_seat
        expected_parts=[r['floorPartId'],'case-lower-cradle']if r['role']=='main'else[r['floorPartId']]
        assert r['clampedPartIds']==expected_parts and [w['partId']for w in r['webParts']]==expected_parts
        assert r['bottomBearingPartId']==expected_parts[-1]
        require(web_thickness>=r['minimumFloorWebMm']-1e-6 and web_thickness>=2.8,'combined-clamped-web-thickness',actualMm=web_thickness)
        cursor=head_seat
        for w in r['webParts']:
            assert abs(w['minZ']-cursor)<1e-7
            cursor=w['maxZ']
        assert abs(cursor-lo)<1e-7
        if r['role']=='main':
            assert len(r['webParts'])==2 and abs(r['webParts'][0]['maxZ']+49.5)<1e-7
            assert abs(r['webParts'][0]['minimumThicknessMm']-2.9)<1e-7 and abs(r['webParts'][1]['minimumThicknessMm']-2)<1e-7
        webs=[annular_web_probe(w,by_id[w['partId']],r['axisPoint'])for w in r['webParts']]
        missing_web=sum(w['annularProbeOutsideMm3']for w in webs)
        actual_combined=sum(w['actualThicknessMm']for w in webs)
        require(all(w['passed']for w in webs)and abs(actual_combined-web_thickness)<1e-6,'continuous-named-clamped-webs',parts=webs,totalActualThicknessMm=actual_combined)
        head=bottom.common(Part.makeBox(10,10,.01,App.Vector(x-5,y-5,head_seat-.01)));head.translate(App.Vector(0,0,.01))
        head_area=overlap(head,floor)/.01
        require(head_area>=r['minimumBearingAreaMm2'],'actual-bottom-head-bearing',areaMm2=head_area)
        require(sb.ZMin>=case['electronics']['floorBottom']+.09,'recessed-bottom-head',headBottomZ=sb.ZMin,floorBottomZ=case['electronics']['floorBottom'])
        roots=[]
        for probe in r['rootProbes']:
            assert probe['partId']in r['clampedPartIds']
            solid=box(probe);missing=solid.cut(by_id[probe['partId']]).Volume;passed=missing<1e-5
            roots.append({'partId':probe['partId'],'min':probe['min'],'max':probe['max'],'outsidePrintedVolumeMm3':missing,'passed':passed})
            require(passed,'finite-pedestal-root',missingVolumeMm3=missing)
        top_row=None
        if 'topScrewId'in r:
            top_id=r['topScrewId'];top=by_id[top_id];tp=records[top_id]['parameters'];tb=top.BoundBox
            top_reach=hi-tb.ZMin;top_clearance=depth-top_reach
            require(abs(tp['length']-15)<1e-7 and top_reach>=3-1e-6 and top_clearance>=.29,'top-stock-screw-engagement',reachMm=top_reach,bottomClearanceMm=top_clearance)
            top_row={'id':top_id,'nominalReachMm':top_reach,'minimumUsableFemaleDepthMm':depth,'minimumBottomClearanceMm':top_clearance}
        else:require(r['role']=='carrier','carrier-only-unfastened-top-register')
        tool=r['toolReserve'];radius=tool['acrossFlatsMm']/math.sqrt(3)
        points=[App.Vector(x+radius*math.cos(math.radians(tool['clockDegrees']+i*60)),y+radius*math.sin(math.radians(tool['clockDegrees']+i*60)),tool['minZ'])for i in range(6)]
        driver=Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,tool['maxZ']-tool['minZ']))
        require(tool['maxZ']>sb.ZMin+.8 and tool['minZ']<case['electronics']['floorBottom']-10,'finite-driver-reach')
        removed=set(tool['removedIds']);require(not removed,'bottom-driver-on-complete-detached-insert')
        tool_violations=[]
        for target_id,target in by_id.items():
            if target_id in removed:continue
            volume=overlap(driver,target)
            if volume>.001:tool_violations.append({'target':target_id,'volumeMm3':volume})
        require(not tool_violations,'continuous-bottom-hex-driver',violations=tool_violations)
        require(set(r['retainedComponentIds'])=={r['id'],bottom_id},'retained-brass-service-components')
        require(set(r['removedBeforeWithdrawalIds'])==({r['topScrewId']}if 'topScrewId'in r else set()),'source-declared-release-fasteners')
        row={'id':r['id'],'role':r['role'],'passed':not errors,'bottomSeatZ':lo,'topSeatZ':hi,'bodyLengthMm':r['bodyLengthMm'],'acrossFlatsMm':r['acrossFlatsMm'],'bottomBearingAreaMm2':lower_area,'topBearingAreaMm2':upper_area,'minimumBearingAreaMm2':r['minimumBearingAreaMm2'],'initialFloorOverlapMm3':initial_floor,'initialBottomBearingOverlapMm3':initial_bottom,'bottomBearingPartId':r['bottomBearingPartId'],'initialUpperOverlapMm3':initial_upper,'floorWebThicknessMm':webs[0]['actualThicknessMm'],'clampedPartIds':r['clampedPartIds'],'clampedWebParts':webs,'totalClampedWebThicknessMm':actual_combined,'annularFloorWebOutsideMm3':missing_web,'bottomHeadBearingAreaMm2':head_area,'headBottomZ':sb.ZMin,'bottomScrew':{'id':bottom_id,'nominalReachMm':reach,'minimumUsableFemaleDepthMm':depth,'minimumBottomClearanceMm':clearance,'femaleDepthStatus':r['femaleDepthStatus']},'topScrew':top_row,'rootProbes':roots,'bottomDriver':{'passed':not tool_violations,'acrossFlatsMm':tool['acrossFlatsMm'],'minZ':tool['minZ'],'maxZ':tool['maxZ'],'checkedComponentCount':len(by_id)-len(removed),'violations':tool_violations},'retainedComponentIds':r['retainedComponentIds'],'removedBeforeWithdrawalIds':r['removedBeforeWithdrawalIds'],'failures':errors}
        rows.append(row)
        check(row['passed'],r['id'],failures=errors)
    return {'passed':not failures,'supports':rows,'failures':failures,'sequence':'Fasten the named printed tray and captured cradle feet on the detached insert. The measured case shell is absent during underside driver access; no new exterior case clearance is authorized. All heads stay within the original printed-floor envelope. FF40 depth is user-confirmed; FF50 depth is an adopted assembly requirement, not a supplier measurement.'}


def audit_connector_mounting(case,shapes,overlap):
    """Actual top screws, underside flange seats and connector-owned inserts."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    records={r['id']:r for r in case['components']}
    metadata=case['connectorMounting'];rows=[];failures=[];mating=[]
    assert len(metadata['inserts'])==len({r['id']for r in metadata['inserts']})==4
    panel=by_id['parallel-base']
    for r in metadata['inserts']:
        errors=[]
        def require(ok,label,**data):
            if not ok:errors.append({'check':label,**data})
        assert r['insertionDirection']==[0,0,-1]
        x,y=r['axis'];z0,z1=r['minimumZ'],r['maximumZ'];height=z1-z0
        expected=Part.makeCylinder(r['outerDiameterMm']/2,height,App.Vector(x,y,z0)).cut(Part.makeCylinder(r['boreDiameterMm']/2,height+.02,App.Vector(x,y,z0-.01)))
        host=by_id[r['hostId']];candidates=[]
        for number,solid in enumerate(host.Solids):
            b=solid.BoundBox
            if abs(b.ZMin-z0)>1e-6 or abs(b.ZMax-z1)>1e-6:continue
            if abs((b.XMin+b.XMax)/2-x)>1e-6 or abs((b.YMin+b.YMax)/2-y)>1e-6:continue
            if abs(solid.Volume-expected.Volume)>1e-5:continue
            if solid.cut(expected).Volume<1e-6 and expected.cut(solid).Volume<1e-6:candidates.append((number,solid))
        assert len(candidates)==1,(r['id'],'exactly one connector-owned adopted metal insert',len(candidates))
        number,insert=candidates[0];others=[s for i,s in enumerate(host.Solids)if i!=number]
        internal=[{'sourceSolid':i,'volumeMm3':overlap(insert,s)}for i,s in enumerate(host.Solids)if i!=number and overlap(insert,s)>.001]
        require(not internal,'receiving-cavity-and-host-internals',violations=internal)
        require(r['id']not in by_id,'owned-insert-is-not-a-loose-BOM-occurrence')
        screw_id=r['screwId'];screw=by_id[screw_id];p=records[screw_id]['parameters'];sb=screw.BoundBox
        underhead=sb.ZMax-p['headHeight'];tip=sb.ZMin
        require(abs(underhead-r['screwUnderheadZ'])<1e-6 and abs(sb.ZMax-r['screwHeadTopZ'])<1e-6 and abs(tip-r['screwTipZ'])<1e-6,'top-down-source-screw-datums')
        require(abs(p['diameter']-2.5)<1e-7 and p['length']==r['screwLengthMm']==6 and p['head']=='button'and abs(p['headSize']-4.7)<1e-7 and abs(p['headHeight']-1.5)<1e-7 and p['drive']=='star','ETTINGER-M2.5x6-button-T8-adopted-execution')
        metal_overlap=max(0,min(underhead,z1)-max(tip,z0));reach=r['flangeFrontZ']-tip;tail=z0-tip
        require(abs(metal_overlap-r['adoptedInsertOverlapMm'])<1e-6 and abs(metal_overlap-height)<1e-6,'complete-adopted-metal-overlap',overlapMm=metal_overlap)
        require(abs(reach-r['screwReachBelowFlangeFrontMm'])<1e-6 and abs(tail-r['screwProjectionPastInsertRearMm'])<1e-6 and tail>=.5-1e-6,'distinct-flange-reach-and-free-tail')
        require(abs(sb.ZMax-case['layout']['panelTop'])<1e-6 and abs(host.BoundBox.ZMax-r['matingMouthZ'])<1e-6,'head-and-source-mouth-flush-with-panel-front')
        require(overlap(screw,insert)<.001,'shaft-clears-smooth-adopted-metal-bore')
        initial=overlap(host,panel);require(initial<.001,'actual-host-panel-nonintersection',volumeMm3=initial)
        head=screw.common(Part.makeBox(8,8,.01,App.Vector(x-4,y-4,underhead)));head.translate(App.Vector(0,0,-.01))
        head_area=overlap(head,panel)/.01;require(head_area>=8,'actual-head-on-counterbore-shelf',areaMm2=head_area)
        front=r['flangeFrontZ'];flange=host.common(Part.makeBox(8,8,.01,App.Vector(x-4,y-4,front-.01)));flange.translate(App.Vector(0,0,.01))
        flange_area=overlap(flange,panel)/.01;require(flange_area>=8,'actual-flange-front-to-pocket-ceiling',areaMm2=flange_area)
        retained=insert.copy();retained.translate(App.Vector(0,0,.01))
        insert_area=overlap(retained,Part.makeCompound(others))/.01
        require(insert_area>=8,'insert-cap-to-actual-receiving-housing',areaMm2=insert_area)
        assert r['panelBoreDiameterMm']==3
        bottom,top=r['panelBearingWebMinimumZ'],r['panelBearingWebMaximumZ'];web=top-bottom
        require(abs(web-r['panelBearingWebThicknessMm'])<1e-7 and web>=1.5-1e-6 and abs(top-underhead)<1e-6 and abs(bottom-front)<1e-6,'declared-remaining-web-datums')
        bore=Part.makeCylinder(r['panelBoreDiameterMm']/2-.01,web+.02,App.Vector(x,y,bottom-.01));blocked_bore=overlap(bore,panel)
        require(blocked_bore<.001,'actual-shank-passage',blockedVolumeMm3=blocked_bore)
        ring=Part.makeCylinder(p['headSize']/2-.05,web-.02,App.Vector(x,y,bottom+.01)).cut(Part.makeCylinder(r['panelBoreDiameterMm']/2+.01,web,App.Vector(x,y,bottom)))
        missing=ring.cut(panel).Volume;require(missing<1e-5,'continuous-actual-head-bearing-web',missingVolumeMm3=missing)
        cb0,cb1=r['counterboreBottomZ'],r['counterboreTopZ']
        counterbore=Part.makeCylinder(r['counterboreDiameterMm']/2-.01,cb1-cb0-.002,App.Vector(x,y,cb0+.001))
        cb_blocked=overlap(counterbore,panel);require(cb_blocked<.001,'actual-top-counterbore-clearance',blockedVolumeMm3=cb_blocked)
        driver=Part.makeCylinder(r['minimumTopDriverRadiusMm'],r['topDriverTravelMm'],App.Vector(x,y,sb.ZMax+.001))
        violations=[]
        for target_id,target in by_id.items():
            if target_id==screw_id:continue
            volume=overlap(driver,target)
            if volume>.001:violations.append({'target':target_id,'volumeMm3':volume})
        require(not violations,'continuous-top-head-approach',violations=violations)
        row={'id':r['id'],'hostId':r['hostId'],'pieceLabel':r['pieceLabel'],'sourceSolidIndex':number,'passed':not errors,'ownedByPurchasedConnector':True,'actualInsertOutsideAdoptedEnvelopeMm3':insert.cut(expected).Volume,'adoptedEnvelopeOutsideActualInsertMm3':expected.cut(insert).Volume,'internalHostIntersections':internal,'screwId':screw_id,'underheadZ':underhead,'headTopZ':sb.ZMax,'tipZ':tip,'reachBelowFlangeFrontMm':reach,'adoptedInsertOverlapMm':metal_overlap,'adoptedInsertDepthMm':height,'rearTipProjectionMm':tail,'headBearingAreaMm2':head_area,'flangePanelBearingAreaMm2':flange_area,'insertHousingBearingAreaMm2':insert_area,'initialHostPanelOverlapMm3':initial,'panelBearingWebMm':web,'panelBoreDiameterMm':r['panelBoreDiameterMm'],'blockedPanelBoreMm3':blocked_bore,'blockedCounterboreMm3':cb_blocked,'panelWebOutsideMm3':missing,'topDriverApproach':{'passed':not violations,'radiusMm':r['minimumTopDriverRadiusMm'],'travelMm':r['topDriverTravelMm'],'checkedOtherComponentCount':len(by_id)-1,'violations':violations},'failures':errors}
        rows.append(row)
        if errors:failures.append({'id':r['id'],'failures':errors})
    access=metadata['matingAccess']
    expected_centres={f'case-power-connector-{i+1}':xy for i,xy in enumerate(case['layout']['connectors'])}
    for host_id in sorted({r['hostId']for r in metadata['inserts']}):
        pose=records[host_id]['placement'];w,h=access['bodyWidthMm'],access['bodyHeightMm'];bevel=h*.25
        expected_xy=expected_centres[host_id]
        assert all(abs(a-b)<1e-7 for a,b in zip(pose['translation'][:2],expected_xy)),'Mating probe must use normalized operator placement'
        points=[[-w/2,-h/2],[w/2-bevel,-h/2],[w/2,-h/2+bevel],[w/2,h/2-bevel],[w/2-bevel,h/2],[-w/2,h/2]]
        vertices=[App.Vector(x,y,access['channelBottomZ'])for x,y in points];vertices.append(vertices[0])
        probe=Part.Face(Part.makePolygon(vertices)).extrude(App.Vector(0,0,access['channelTopZ']-access['channelBottomZ']))
        assert pose['rotation'][:2]==[0,0]
        probe.rotate(App.Vector(0,0,0),App.Vector(0,0,1),pose['rotation'][2]);probe.translate(App.Vector(*pose['translation'][:2],0))
        for shape in [probe,by_id[host_id]]:
            bb=shape.BoundBox
            assert abs((bb.XMin+bb.XMax)/2-expected_xy[0])<1e-6 and abs((bb.YMin+bb.YMax)/2-expected_xy[1])<1e-6,'Mating probe/source host centre differs from declared cutout'
        violations=[]
        for target_id,target in by_id.items():
            if target_id==host_id:continue
            volume=overlap(probe,target)
            if volume>.001:violations.append({'target':target_id,'volumeMm3':volume})
        item={'hostId':host_id,'passed':not violations,'operatorCentreXY':expected_xy,'checkedOtherComponentCount':len(by_id)-1,'channelBottomZ':access['channelBottomZ'],'channelTopZ':access['channelTopZ'],'violations':violations,'limits':access['basis']};mating.append(item)
        if violations:failures.append({'id':host_id+'-nominal-mating-body-channel','violations':violations})
    return {'passed':not failures,'inserts':rows,'matingAccess':mating,'failures':failures,'ownership':metadata['ownership'],'limits':metadata['limits']}


def audit_pwm_support(case,shapes,overlap):
    """Separate keyed wall, real PCB contacts and tie-captured withdrawal limit."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    data=case['mechanicalStructure']['pwmSupport'];body=by_id[data['componentId']];carrier=by_id[data['carrierId']];host=by_id[data['hostId']]
    assert data['componentId']=='case-pwm-backing'and data['carrierId']=='case-test-clip-carrier'
    failures=[];probes={};contacts=[];wires=[]
    for field in ['wallProbes','rootProbes']:
        rows=[]
        for r in data[field]:
            witness=box(r);missing=witness.cut(body).Volume
            passed=missing<1e-5;rows.append({'min':r['min'],'max':r['max'],'passed':passed,'outsideCarrierVolumeMm3':missing})
            if not passed:failures.append({'check':field,'outsideCarrierVolumeMm3':missing})
        assert rows,(field,'PWM wall and its carrier joint need finite probes')
        probes[field]=rows
    for r in data['supportSeats']:
        contact=local_common(host,box(r['contactBox']));contact.translate(App.Vector(*[.01*v for v in r['normal']]))
        area=overlap(contact,by_id[r['componentId']])/.01
        initial=overlap(host,by_id[r['componentId']]);passed=initial<.001 and area>=r['minimumAreaMm2']
        contacts.append({'id':r['id'],'componentId':r['componentId'],'passed':passed,'actualContactAreaMm2':area,'minimumAreaMm2':r['minimumAreaMm2'],'initialOverlapMm3':initial,'approachNormal':r['normal']})
        if not passed:failures.append({'check':r['id'],'actualContactAreaMm2':area,'initialOverlapMm3':initial})
    assert len(contacts)==2
    for r in data['wireReserves']:
        reserve=box(r);violations=[]
        for id,target in by_id.items():
            volume=overlap(reserve,target)
            if volume>.001:violations.append({'target':id,'volumeMm3':volume})
        passed=not violations;wires.append({'id':r['id'],'passed':passed,'min':r['min'],'max':r['max'],'checkedComponentCount':len(by_id),'violations':violations})
        if not passed:failures.append({'check':r['id'],'violations':violations})
    assert len(wires)==2
    hb=host.BoundBox;roof_thickness=case['layout']['testClipSeatZ']-hb.ZMax
    cx=(hb.XMin+hb.XMax)/2;cy=(hb.YMin+hb.YMax)/2
    roof_bounds={'min':[cx-3,cy-1,hb.ZMax+.01],'max':[cx+3,cy+1,case['layout']['testClipSeatZ']-.01]}
    roof=box(roof_bounds);roof_missing=roof.cut(carrier).Volume
    if roof_thickness<3.8-1e-6 or roof_missing>1e-5:failures.append({'check':'finite-pwm-pocket-roof','thicknessMm':roof_thickness,'outsideCarrierVolumeMm3':roof_missing})
    ties={r['id']:r for r in case['mechanicalStructure']['ties']}
    assert len(data['ties'])==2 and all(ties[r['id']]==r for r in data['ties'])
    joint=data['joint'];joint_errors=[]
    def require(ok,label,**details):
        if not ok:joint_errors.append({'check':label,**details})
    assert joint['backingId']==data['componentId']and joint['carrierId']==data['carrierId']
    assert joint['shoulderZ']==-12 and joint['upperBandSegmentIndex']==3 and joint['lowerBandSegmentIndex']==2
    tongue_probe=box(joint['tongue']);tongue=body.common(tongue_probe)
    tongue_missing=tongue_probe.cut(body).Volume;receiver_blocked=overlap(box(joint['receiver']),carrier);initial=overlap(body,carrier)
    engagement=tongue.BoundBox.ZMax-joint['shoulderZ']
    require(tongue_missing<1e-5 and receiver_blocked<.001 and initial<.001,'actual-key-and-clear-blind-receiver',missingTongueMm3=tongue_missing,blockedReceiverMm3=receiver_blocked,initialOverlapMm3=initial)
    require(abs(engagement-joint['nominalEngagementMm'])<1e-6 and engagement>=2.1-1e-6,'actual-tongue-engagement',engagementMm=engagement)
    roof_skin=joint['roofTopZ']-joint['roofBottomZ'];roof_rows=[]
    require(roof_skin>=joint['minimumRoofThicknessMm']and roof_skin>=2.8-1e-6,'separate-key-receiver-roof-thickness',actualMm=roof_skin)
    for probe in joint['roofProbes']:
        missing=box(probe).cut(carrier).Volume;ok=missing<1e-5;roof_rows.append({**probe,'passed':ok,'outsideCarrierMm3':missing})
        require(ok,'continuous-key-receiver-roof',outsideCarrierMm3=missing)
    shoulder_crop=body.common(Part.makeBox(40,10,.01,App.Vector(161,25,joint['shoulderZ']-.01)))
    shoulder_crop.translate(App.Vector(*joint['shoulderBearingShift']));shoulder_area=overlap(shoulder_crop,carrier)/App.Vector(*joint['shoulderBearingShift']).Length
    require(shoulder_area>=joint['minimumShoulderBearingAreaMm2']and shoulder_area>=30,'actual-shoulder-bearing',areaMm2=shoulder_area)
    shoulder_rows=[]
    for probe in joint['shoulderProbes']:
        low={'min':list(probe['min']),'max':list(probe['max'])};low['max'][2]=joint['shoulderZ']
        high={'min':list(probe['min']),'max':list(probe['max'])};high['min'][2]=joint['shoulderZ']
        missing_low=box(low).cut(body).Volume;missing_high=box(high).cut(carrier).Volume;ok=max(missing_low,missing_high)<1e-5
        shoulder_rows.append({**probe,'passed':ok,'outsideBackingMm3':missing_low,'outsideCarrierMm3':missing_high});require(ok,'two-finite-shoulder-load-paths',outsideBackingMm3=missing_low,outsideCarrierMm3=missing_high)
    blocked=[]
    for shift in joint['transverseBlockingTranslations']:
        moved=tongue.copy();moved.translate(App.Vector(*shift));volume=overlap(moved,carrier);ok=volume>.001
        blocked.append({'translation':shift,'overlapCarrierMm3':volume,'passed':ok});require(ok,'tongue-blocks-transverse-movement',translation=shift,overlapCarrierMm3=volume)
    assert len(blocked)==4 and {tuple(v)for v in joint['transverseBlockingTranslations']}=={(.5,0,0),(-.5,0,0),(0,.5,0),(0,-.5,0)}
    maximum_travel=joint['maximumTiedWallWithdrawalMm'];retained_engagement=engagement-maximum_travel
    assert joint['worstTieTranslation']==[0,0,-.3]and joint['tieTravelBlockingTranslation']==[0,0,-.31]and joint['tiedWithdrawalTrial']==[0,0,-.5]
    assert abs(joint['maximumTieDownwardChannelTravelMm']-.3)<1e-7 and abs(maximum_travel-.3)<1e-7 and joint['nominalWallToLowerBandGapMm']==0
    require(retained_engagement>=joint['minimumRetainedEngagementMm']-1e-6 and retained_engagement>=1.8-1e-6,'worst-total-travel-retains-tongue',actualMm=retained_engagement)
    band_checks=[]
    for id in joint['retainedTieIds']:
        row=ties[id];assert row['frame']=={'at':[0,0,0],'rotation':[0,0,0]}
        parts=[box(b)for b in row['segments']];nominal=sum(overlap(part,carrier)for part in parts)
        shifted=[]
        for part in parts:
            moved=part.copy();moved.translate(App.Vector(*joint['worstTieTranslation']));shifted.append(moved)
        worst=sum(overlap(part,carrier)for part in shifted)
        upper=parts[joint['upperBandSegmentIndex']].copy();upper.translate(App.Vector(*joint['tieTravelBlockingTranslation']));stop=overlap(upper,carrier)
        lower=shifted[joint['lowerBandSegmentIndex']];wall=body.copy();wall.translate(App.Vector(*joint['tiedWithdrawalTrial']));capture=overlap(wall,lower)
        lower_top=row['segments'][joint['lowerBandSegmentIndex']]['max'][2]
        gap=body.BoundBox.ZMin-lower_top
        ok=nominal<.001 and worst<.001 and stop>.001 and capture>.001 and abs(lower_top-joint['nominalLowerBandTopZ'])<1e-7 and abs(gap-joint['nominalWallToLowerBandGapMm'])<1e-7
        band_checks.append({'id':id,'passed':ok,'nominalLoopCarrierOverlapMm3':nominal,'worstShiftedLoopCarrierOverlapMm3':worst,'upperBandTravelStopOverlapMm3':stop,'backingDownTrialAgainstWorstLowerBandMm3':capture,'nominalWallToLowerBandGapMm':gap})
        require(ok,'actual-loop-travel-stop-and-wall-capture',**band_checks[-1])
    assert len(band_checks)==2 and set(joint['retainedTieIds'])=={r['id']for r in data['ties']}
    joint_report={'passed':not joint_errors,'backingId':data['componentId'],'carrierId':data['carrierId'],'nominalEngagementMm':engagement,'minimumRetainedEngagementMm':retained_engagement,'maximumTiedWallWithdrawalMm':maximum_travel,'actualTongueOutsideMm3':tongue_missing,'blockedReceiverMm3':receiver_blocked,'initialOverlapMm3':initial,'receiverRoofThicknessMm':roof_skin,'receiverRoofProbes':roof_rows,'shoulderBearingAreaMm2':shoulder_area,'shoulderProbes':shoulder_rows,'transverseBlocking':blocked,'tieCapture':band_checks,'failures':joint_errors}
    failures.extend(joint_errors)
    return {'passed':not failures,**probes,'supportSeats':contacts,'wireReserves':wires,'roofWebThicknessMm':roof_thickness,'roofProbe':{**roof_bounds,'partId':data['carrierId'],'outsideCarrierVolumeMm3':roof_missing,'passed':roof_missing<1e-5 and roof_thickness>=3.8-1e-6},'joint':joint_report,'fullTieIds':[r['id']for r in data['ties']],'failures':failures,'limits':'The separate backing is a keyed, shoulder-bearing part captured by the two declared complete nylon loops; actual loop-channel travel is included in retained engagement. Existing 3.8 mm module-pocket roof and separate 2.8 mm key-receiver roof are both checked. PCB bearing remains an adopted envelope, not supplier-qualified pressure lands. Full tie and disassembly paths are independently checked in retention.'}


def audit_guard_sweep(case,shapes,overlap):
    """Actual SAC cover geometry, opening about its original transformed hinge."""
    by_id={r['id']:(r,s)for r,s in zip(case['components'],shapes)}
    checks=[]
    for id in ['manual-toggle-switch']:
        record,host=by_id[id];source=host.childShapes()
        assert len(source)==14,(id,'SAC source component order changed')
        cover=source[13]
        origin=record['placement']['translation'];angles=record['placement']['rotation']
        rotation=App.Rotation(App.Vector(0,0,1),angles[2])
        hinge=rotation.multVec(App.Vector(15.5,0,14.7))+App.Vector(*origin)
        axis=rotation.multVec(App.Vector(0,1,0))
        initial=69 if record['parameters'].get('guard')=='open'else 0
        failures=[]
        for angle in range(70):
            moving=cover.copy();moving.rotate(hinge,axis,angle-initial)
            for target_record,target in zip(case['components'],shapes):
                if target_record['id']==id:continue
                volume=overlap(moving,target)
                if volume>.001:failures.append({'angleDegrees':angle,'target':target_record['id'],'volumeMm3':volume})
        row={'id':id,'passed':not failures,'hinge':[hinge.x,hinge.y,hinge.z],'axis':[axis.x,axis.y,axis.z],'anglesDegrees':list(range(70)),'violations':failures}
        checks.append(row)
        if failures:print('NATIVE_GUARD_SWEEP_FAILURE='+json.dumps(row),flush=True)
    return {'passed':all(r['passed']for r in checks),'checks':checks,'limits':'SAC source drawing opening0..69 degrees. Own source hinge internals remain part of the supplier model; no spring torque or measured travel is inferred.'}


def audit_honeycomb(case,shapes,overlap):
    """Check actual hex polygons and native clear-cell volumes, independent of packing code."""
    data=case['electronicsHoneycomb'];m=case['electronics'];body=next(s for r,s in zip(case['components'],shapes)if r['id']=='case-lower-body')
    faces=[];occupied=[];quiet=[]
    x0,y0=m['quietPodMin'];x1,y1=m['quietPodMax'];z=m['floorBottom']+.01
    q=Part.Face(Part.makePolygon([App.Vector(x,y,z)for x,y in[(x0,y0),(x1,y0),(x1,y1),(x0,y1),(x0,y0)]]))
    for i,cell in enumerate(data['cells']):
        assert 8<=cell['flat']<=24 and len(cell['points'])==6
        vertices=[App.Vector(*xy,z)for xy in cell['points']];face=Part.Face(Part.makePolygon(vertices+[vertices[0]]));faces.append(face)
        probe=face.extrude(App.Vector(0,0,m['floorTop']-m['floorBottom']-.02));volume=overlap(probe,body)
        if volume>.001:occupied.append({'cell':i,'blockedVolumeMm3':volume})
        area=face.common(q).Area
        if area>1e-6:quiet.append({'cell':i,'quietFloorIntrusionAreaMm2':area})
    minimum=float('inf')
    for i,first in enumerate(faces):
        a=first.BoundBox
        for second in faces[i+1:]:
            b=second.BoundBox
            lower=sum(max(0,getattr(a,d+'Min')-getattr(b,d+'Max'),getattr(b,d+'Min')-getattr(a,d+'Max'))**2 for d in 'XY')**.5
            if lower>=minimum:continue
            minimum=min(minimum,first.distToShape(second)[0])
    return {'passed':not occupied and not quiet and minimum>=2.6-1e-6,'cellCount':len(faces),'flatSizesMm':sorted(set(c['flat']for c in data['cells'])),'minimumActualWebMm':minimum,'requiredMinimumWebMm':2.6,'blockedCells':occupied,'quietFloorIntrusions':quiet,'limits':'Exact native adopted polygon cuts. Existing intentional tie ports remain; no slicer or material-strength qualification.'}


def audit_modular_electronics(case,shapes,overlap):
    """Actual universal-node material, bolted adapter interfaces and bare-base relocations."""
    data=case['mechanicalStructure']['modularElectronics'];g=data['grid'];m=case['electronics']
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    records={r['id']:r for r in case['components']};body=by_id['case-lower-body'];failures=[]
    def check(ok,id,**details):
        if not ok:failures.append({'id':id,**details})
        return ok
    def volume(shape):return 0 if shape.isNull()else abs(shape.Volume)
    def annulus(xy,lo,hi,outer=4.5,inner=1.75):
        return Part.makeCylinder(outer,hi-lo,App.Vector(*xy,lo)).cut(Part.makeCylinder(inner,hi-lo+.02,App.Vector(*xy,lo-.01)))
    def material(probe,target):return volume(probe.cut(target))
    def cylinder(xy,lo,hi,r):return Part.makeCylinder(r,hi-lo,App.Vector(*xy,lo))
    def hull(points):
        points=sorted(set(points))
        def turn(a,b,c):return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        lower=[];upper=[]
        for p in points:
            while len(lower)>1 and turn(lower[-2],lower[-1],p)<=1e-9:lower.pop()
            lower.append(p)
        for p in reversed(points):
            while len(upper)>1 and turn(upper[-2],upper[-1],p)<=1e-9:upper.pop()
            upper.append(p)
        return lower[:-1]+upper[:-1]
    assert data['moduleCount']==len(data['adapters'])==7
    assert sorted(a['orientation']for a in data['adapters']).count('vertical')==2
    assert g['pitchMm']==20 and g['origin']==[10,10]and g['boreDiameterMm']==3.4
    assert abs(g['floorBottomZ']+55.5)<1e-7 and abs(g['nodeTopZ']+49.5)<1e-7
    assert abs(g['headSeatZ']+52.4)<1e-7 and abs(g['nodeTopZ']-g['headSeatZ']-2.9)<1e-7
    assert data['fastening']['noHardwareBelowFloor']and data['fastening']['floorLoadWebMm']==2.9
    assert data['fastening']['adapterFootWebMm']==2 and data['fastening']['fullNutEngagementMm']==2.4
    assert set(g['reservedRegions'])=={'batteryBank','brassAxes','shieldBond','xt60ReactionPier'},'The grid must not omit nodes for individual PCBs'
    nodes={r['id']:r for r in g['nodes']};xy_nodes={tuple(r['centre']):r for r in g['nodes']}
    assert len(nodes)==len(xy_nodes)==g['nodeCount']and len(nodes)>=30
    footprint=case['mechanicalStructure']['lowerSplit']['floorFootprint'];r=g['nodeDiameterMm']/2
    lo=[footprint['centre'][i]-footprint['size'][i]/2 for i in range(2)]
    hi=[footprint['centre'][i]+footprint['size'][i]/2 for i in range(2)]
    reserved=g['reservedRegions'];bank=reserved['batteryBank'];expected=[]
    # Enumerate the entire usable raster from the fixed floor and structural exclusions,
    # so an omitted node cannot silently follow a PCB-specific footprint or tie lane.
    for ix in range(math.floor((lo[0]-g['origin'][0])/g['pitchMm'])-1,math.ceil((hi[0]-g['origin'][0])/g['pitchMm'])+2):
        for iy in range(math.floor((lo[1]-g['origin'][1])/g['pitchMm'])-1,math.ceil((hi[1]-g['origin'][1])/g['pitchMm'])+2):
            xy=[g['origin'][0]+ix*g['pitchMm'],g['origin'][1]+iy*g['pitchMm']]
            if any(xy[i]-r-.4<lo[i]or xy[i]+r+.4>hi[i]for i in range(2)):continue
            if all(bank['min'][i]-r<xy[i]<bank['max'][i]+r for i in range(2)):continue
            pier=reserved['xt60ReactionPier']
            if all(pier['min'][i]-r<xy[i]<pier['max'][i]+r for i in range(2)):continue
            if any(math.dist(xy,row['centre'])<row['exclusionRadiusMm']for row in reserved['brassAxes']):continue
            if math.dist(xy,reserved['shieldBond']['centre'])<reserved['shieldBond']['exclusionRadiusMm']:continue
            expected.append(tuple(xy))
    check(set(expected)==set(xy_nodes),'complete-structural-only-raster',missing=[list(p)for p in sorted(set(expected)-set(xy_nodes))],unexpected=[list(p)for p in sorted(set(xy_nodes)-set(expected))])
    grid_rows=[]
    for node in g['nodes']:
        xy=node['centre'];assert all(abs((xy[i]-g['origin'][i])/g['pitchMm']-round((xy[i]-g['origin'][i])/g['pitchMm']))<1e-8 for i in range(2))
        bore=cylinder(xy,g['floorBottomZ']-.1,g['nodeTopZ']+.1,1.65)
        head=cylinder(xy,g['floorBottomZ']-.1,g['headSeatZ']-.01,g['headRecessDiameterMm']/2-.02)
        web=annulus(xy,g['headSeatZ']+.01,g['nodeTopZ']-.01)
        blocked=overlap(bore,body);head_blocked=overlap(head,body);missing=material(web,body)
        row={'id':node['id'],'centre':xy,'blockedBoreMm3':blocked,'blockedHeadRecessMm3':head_blocked,'missingBearingWebMm3':missing,'actualWebThicknessMm':g['nodeTopZ']-g['headSeatZ']}
        row['passed']=check(blocked<1e-5 and head_blocked<1e-5 and missing<1e-5,node['id'],**{k:v for k,v in row.items()if k!='id'})
        grid_rows.append(row)
    # Above the common3mm floor, only identical grid nodes and permanent battery,
    # XT60, brass and hood registers may remain. Old board-specific plinths or walls
    # cannot hide merely because their default board was moved onto an adapter.
    allowed=[Part.makeBox(footprint['size'][0]+.02,footprint['size'][1]+.02,m['floorTop']-m['floorBottom']+.02,App.Vector(lo[0]-.01,lo[1]-.01,m['floorBottom']-.01))]
    allowed.extend(cylinder(n['centre'],m['floorTop']-.01,g['nodeTopZ']+.01,r+.01)for n in g['nodes'])
    for s in case['mechanicalStructure']['brassSupports']['supports']:
        allowed.append(cylinder(s['axisPoint'][:2],m['floorBottom']-.01,s['bottomSeatZ']+(1.41 if s['role']=='carrier' else -1.99),4.51 if s['role']=='main' else 3.81))
    allowed.extend([
        Part.makeBox(bank['max'][0]-bank['min'][0]+.02,bank['max'][1]-bank['min'][1]+.02,57.02,App.Vector(bank['min'][0]-.01,bank['min'][1]-.01,m['floorBottom']-.01)),
        Part.makeBox(95.02,64.52,3.62,App.Vector(17.49,75.49,m['floorBottom']-.01)),
        Part.makeBox(3.02,64.52,57.02,App.Vector(17.49,75.49,m['floorBottom']-.01)),
        Part.makeBox(13.02,3.02,57.02,App.Vector(7.49,107.74,m['floorBottom']-.01)),
    ])
    for x in [m['quietPodMin'][0]+1.8,m['quietPodMax'][0]-3]:
        allowed.append(Part.makeBox(1.22,m['quietPodMax'][1]-m['quietPodMin'][1]-5.98,1.42,App.Vector(x-.01,m['quietPodMin'][1]+2.99,m['floorTop']-.01)))
    unexpected=volume(body.cut(Part.makeCompound(allowed)))
    check(unexpected<1e-5,'no-integral-pcb-specific-mounts',unexpectedBodyMaterialMm3=unexpected)
    expected_boards={'case-servo-driver-hat','case-heltec-v4','case-buck-1','case-buck-2','case-adc-cjmcu1220','case-lc-filter-1','case-lc-filter-2'}
    assert {a['boardId']for a in data['adapters']}==expected_boards
    assert len({a['id']for a in data['adapters']})==7
    assert {r['componentId']for r in case['electronicsRetention']['supportSeats']}=={a['id']for a in data['adapters']}
    used=[];adapter_rows=[]
    for a in data['adapters']:
        adapter=by_id[a['id']];assert records[a['id']]['supply']=='manufactured'
        assert adapter.isValid()and adapter.isClosed()and len(adapter.Solids)==1
        assert len(a['anchors'])>=(3 if a['boardId']=='case-servo-driver-hat' else 2)
        if a['boardId']=='case-servo-driver-hat':
            p0,p1,p2=[p['axisPoint']for p in a['anchors'][:3]]
            assert abs((p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]))/2>=300,'HAT requires a broad non-collinear three-point fixing pattern'
        assert max(math.dist(u['axisPoint'][:2],v['axisPoint'][:2])for u in a['anchors']for v in a['anchors'])>=20-1e-7
        anchor_rows=[]
        for anchor in a['anchors']:
            node=nodes[anchor['nodeId']];xy=node['centre'];used.append(anchor['nodeId'])
            assert list(anchor['axisPoint'][:2])==list(xy)and abs(anchor['axisPoint'][2]-g['nodeTopZ'])<1e-7
            screw=by_id[anchor['screwId']];nut=by_id[anchor['nutId']]
            sb=screw.BoundBox;nb=nut.BoundBox;sp=records[anchor['screwId']]['parameters'];np=records[anchor['nutId']]['parameters']
            assert sp['diameter']==3 and sp['length']==8 and sp['headHeight']==3 and np['bore']==3 and np['height']==2.4
            under=sb.ZMin+sp['headHeight'];tip=sb.ZMax
            foot=annulus(xy,anchor['footBottomZ']+.01,anchor['footTopZ']-.01)
            missing_foot=material(foot,adapter)
            head_land=annulus(xy,under+.01,under+.04,2.7,1.75)
            missing_head=material(head_land,body)
            screw_land=screw.common(annulus(xy,under-.02,under,2.7,1.75));head_initial=overlap(screw_land,body);screw_land=screw_land.copy();screw_land.translate(App.Vector(0,0,.02));head_area=overlap(screw_land,body)/.02
            bearing_land=body.common(annulus(xy,g['nodeTopZ']-.02,g['nodeTopZ']))
            bearing_initial=overlap(bearing_land,adapter);bearing_land=bearing_land.copy();bearing_land.translate(App.Vector(0,0,.02));bearing=overlap(bearing_land,adapter)/.02
            nut_land=nut.common(Part.makeBox(12,12,.02,App.Vector(xy[0]-6,xy[1]-6,nb.ZMin)));nut_land=nut_land.copy();nut_land.translate(App.Vector(0,0,-.02));nut_area=overlap(nut_land,adapter)/.02
            axial=abs(under-g['headSeatZ'])<1e-6 and abs(tip-anchor['screwTipZ'])<1e-6 and sb.ZMin>=g['floorBottomZ']+.099999
            engagement=min(tip,nb.ZMax)-max(under,nb.ZMin);tail=tip-nb.ZMax
            # Top-loaded ordinary hex nut pockets provide rotation restraint. They
            # intentionally do not claim retention when the screw is removed.
            middle_wires=nut.slice(App.Vector(0,0,1),(nb.ZMin+nb.ZMax)/2)
            outer_wire=max(middle_wires,key=lambda w:Part.Face(w).Area)
            outer=hull([(v.Point.x,v.Point.y)for v in outer_wire.Vertexes]);assert len(outer)==6,'Actual nut midsection must have six exterior flats'
            key_depth=a['nutPockets']['minimumFullHexWallDepthMm'];assert key_depth>=1.2 and a['nutPockets']['axialCaptureWhenUnfastened']is False
            inner=[(xy[0]+(x-xy[0])*(anchor['nutPocketAcrossFlatsMm']+.02)/anchor['nutAcrossFlatsMm'],xy[1]+(y-xy[1])*(anchor['nutPocketAcrossFlatsMm']+.02)/anchor['nutAcrossFlatsMm'])for x,y in outer]
            inner_wire=Part.makePolygon([App.Vector(x,y,nb.ZMin+.01)for x,y in inner]+[App.Vector(*inner[0],nb.ZMin+.01)])
            key_ring=cylinder(xy,nb.ZMin+.01,nb.ZMin+key_depth-.01,4.5).cut(Part.Face(inner_wire).extrude(App.Vector(0,0,key_depth-.02)))
            missing_hex_wall=material(key_ring,adapter)
            wire=Part.makePolygon([App.Vector(x,y,nb.ZMin)for x,y in outer]+[App.Vector(*outer[0],nb.ZMin)])
            loading=Part.Face(wire).extrude(App.Vector(0,0,max(5,adapter.BoundBox.ZMax-nb.ZMin+3)))
            loading_blocked=overlap(loading,adapter)
            rotated=nut.copy();rotated.rotate(App.Vector(*xy,0),App.Vector(0,0,1),30);rotation_block=overlap(rotated,adapter)
            raised=nut.copy();raised.translate(App.Vector(0,0,1));raised_block=overlap(raised,adapter)
            # Accessible only after taking the insert out: the real case floor is
            # deliberately excluded from this underside bench-tool study.
            tool=cylinder(xy,sb.ZMin-25,sb.ZMin-.01,1.5);tool_hits=[]
            for id,target in by_id.items():
                if id==anchor['screwId']:continue
                if target.BoundBox.intersect(tool.BoundBox):
                    v=overlap(tool,target)
                    if v>.001:tool_hits.append({'id':id,'overlapMm3':v})
            ok=missing_foot<1e-5 and missing_head<1e-5 and head_initial<.001 and head_area>=12.5 and bearing_initial<.001 and bearing>=50 and nut_area>=10 and axial and engagement>=2.4-1e-6 and tail>=.699999 and loading_blocked<1e-5 and rotation_block>.001 and missing_hex_wall<1e-5 and not tool_hits
            row={'id':anchor['id'],'nodeId':anchor['nodeId'],'screwId':anchor['screwId'],'nutId':anchor['nutId'],'missingAdapterFootWebMm3':missing_foot,'missingScrewHeadBearingWebMm3':missing_head,'screwHeadBearingAreaMm2':head_area,'initialHeadBearingOverlapMm3':head_initial,'footBearingAreaMm2':bearing,'initialBearingOverlapMm3':bearing_initial,'nutBearingAreaMm2':nut_area,'fullNutEngagementMm':engagement,'tipPastNutMm':tail,'screwHeadAboveFloorMm':sb.ZMin-g['floorBottomZ'],'loadingBlockedMm3':loading_blocked,'antiRotationTrialDegrees':30,'antiRotationOverlapMm3':rotation_block,'minimumFullHexWallDepthMm':key_depth,'missingFullHexWallMm3':missing_hex_wall,'unfastenedAxialRetentionClaimed':False,'raisedNutOverlapMm3':raised_block,'toolApproachViolations':tool_hits,'passed':ok}
            anchor_rows.append(row);check(ok,anchor['id'],**{k:v for k,v in row.items()if k not in ['id','passed']})
        roots=[]
        for probe in a['loadPathProbes']:
            missing=material(box(probe),adapter);width=probe['minimumWidthMm'];actual_width=min(probe['max'][i]-probe['min'][i]for i in range(2));depth=probe['max'][2]-probe['min'][2];ok=missing<1e-5 and width>=2.4 and actual_width>=width-1e-6 and depth>=.5
            roots.append({'id':probe['id'],'outsideAdapterVolumeMm3':missing,'minimumWidthMm':width,'actualProbeWidthMm':actual_width,'probeDepthMm':depth,'passed':ok});check(ok,probe['id'],outsideAdapterVolumeMm3=missing,actualProbeWidthMm=actual_width)
        assert len(roots)>=2
        row={'id':a['id'],'boardId':a['boardId'],'orientation':a['orientation'],'anchors':anchor_rows,'loadPathProbes':roots,'passed':all(r['passed']for r in anchor_rows+roots)}
        adapter_rows.append(row)
    hat_adapter=by_id[next(a['id']for a in data['adapters']if a['boardId']=='case-servo-driver-hat')]
    hat=by_id['case-servo-driver-hat'];hat_stacks=[]
    for n in range(1,5):
        sid='case-electronics-hat-screw-'+str(n);nid='case-electronics-hat-nut-'+str(n);wid='case-electronics-hat-washer-'+str(n)
        screw,nut,washer=[by_id[id]for id in [sid,nid,wid]];sp=records[sid]['parameters'];sb,nb,wb=screw.BoundBox,nut.BoundBox,washer.BoundBox
        assert sp['diameter']==2.5 and sp['length']==8 and records[nid]['parameters']['height']==2
        xy=[(nb.XMin+nb.XMax)/2,(nb.YMin+nb.YMax)/2];under=sb.ZMax-sp['headHeight']
        nut_land=nut.common(Part.makeBox(10,10,.02,App.Vector(xy[0]-5,xy[1]-5,nb.ZMax-.02)));nut_initial=overlap(nut_land,hat_adapter);nut_land=nut_land.copy();nut_land.translate(App.Vector(0,0,.02));nut_area=overlap(nut_land,hat_adapter)/.02
        washer_land=washer.common(Part.makeBox(10,10,.02,App.Vector(xy[0]-5,xy[1]-5,wb.ZMin)));washer_initial=overlap(washer_land,hat);washer_land=washer_land.copy();washer_land.translate(App.Vector(0,0,-.02));washer_area=overlap(washer_land,hat)/.02
        head_land=screw.common(Part.makeBox(10,10,.02,App.Vector(xy[0]-5,xy[1]-5,under)));head_land.translate(App.Vector(0,0,-.02));head_area=overlap(head_land,washer)/.02
        engagement=min(under,nb.ZMax)-max(sb.ZMin,nb.ZMin);tail=nb.ZMin-sb.ZMin
        ok=nut_initial<.001 and washer_initial<.001 and nut_area>=10 and washer_area>=12 and head_area>=9 and engagement>=2-1e-6 and tail>=.599999 and abs(under-wb.ZMax)<1e-6 and sb.ZMin>g['nodeTopZ']+.5
        row={'id':sid,'nutId':nid,'washerId':wid,'nutToAdapterRoofBearingAreaMm2':nut_area,'initialNutRoofOverlapMm3':nut_initial,'washerToPcbBearingAreaMm2':washer_area,'initialWasherPcbOverlapMm3':washer_initial,'headToWasherBearingAreaMm2':head_area,'fullNutEngagementMm':engagement,'tailBeyondNutMm':tail,'tipAboveGridNodeMm':sb.ZMin-g['nodeTopZ'],'passed':ok}
        hat_stacks.append(row);check(ok,sid+'-actual-clamping-stack',**{k:v for k,v in row.items()if k not in ['id','passed']})
    check(len(used)==len(set(used)),'no-shared-adapter-fasteners',duplicatedNodeIds=sorted({n for n in used if used.count(n)>1}))
    relocations=audit_real_adapter_relocation(case,by_id,overlap,data)
    check(relocations['passed'],'actual-flat-adapter-translation-and-quarter-turn',failures=relocations['failures'])
    return {'passed':not failures,'grid':{'passed':all(r['passed']for r in grid_rows)and set(expected)==set(xy_nodes),'nodeCount':len(grid_rows),'pitchMm':g['pitchMm'],'origin':g['origin'],'allUsableRasterNodesDeclared':set(expected)==set(xy_nodes),'nodes':grid_rows,'usedNodeCount':len(set(used)),'unusedNodeCount':len(grid_rows)-len(set(used))},'noIntegralPcbMounts':{'passed':unexpected<1e-5,'unexpectedBodyMaterialMm3':unexpected},'adapters':adapter_rows,'hatBoardMounts':hat_stacks,'relocationStudies':relocations,'failures':failures,'limits':'Mechanical20mm mounting interchangeability only. All active and unused node bores and bearing webs are measured. The M3nuts are top-loaded antirotation seats; unfastened axial captivity is not claimed. The underside tool approach and two physical adapter relocation examples apply to a supported insert on the bench, with other electronic boards/adapters/hood removed. Every default installed component, harness reserve and complete tie remains subject to separate strict assembly checks. No force, material, electrical or EMI performance rating is inferred.'}


def audit_real_adapter_relocation(case,by_id,overlap,data):
    """Move the actual populated LC1 adapter onto two alternative legal raster pairs."""
    a=next(a for a in data['adapters']if a['boardId']=='case-lc-filter-1');g=data['grid'];origin=a['anchors'][0]['axisPoint'][:2]
    node_xy={tuple(n['centre']):n for n in g['nodes']}
    keepers=[r['id']for r in case['electronicsRetention']['keepers']if a['boardId']in r['hosts']]
    moving_ids={a['id'],a['boardId'],*keepers,*[r[k]for r in a['anchors']for k in ['screwId','nutId']]}
    board_ids={r['boardId']for r in data['adapters']}
    fixed_ids=[id for id in by_id if id not in board_ids and not id.startswith('case-electronics-')]
    assert 'case-lower-body'in fixed_ids and 'case-lower-cradle'in fixed_ids and all('case-battery-pack-'+str(n)in fixed_ids for n in[1,2])
    trials=[{'id':'lc1-translated-one-grid-step','angleDegrees':0,'destinationFirstAnchor':[origin[0]+g['pitchMm'],origin[1]]},
            {'id':'lc1-quarter-turn-at-another-bay','angleDegrees':90,'destinationFirstAnchor':[130,30]}]
    failures=[];rows=[]
    for trial in trials:
        angle=math.radians(trial['angleDegrees']);dest=trial['destinationFirstAnchor']
        def point(p):
            dx,dy=p[0]-origin[0],p[1]-origin[1]
            return [dest[0]+dx*math.cos(angle)-dy*math.sin(angle),dest[1]+dx*math.sin(angle)+dy*math.cos(angle)]
        def moved(shape):
            out=shape.copy();out.rotate(App.Vector(*origin,0),App.Vector(0,0,1),trial['angleDegrees']);out.translate(App.Vector(dest[0]-origin[0],dest[1]-origin[1],0));return out
        moving={id:moved(by_id[id])for id in moving_ids};adapter=moving[a['id']];anchors=[]
        for anchor in a['anchors']:
            xy=point(anchor['axisPoint']);rounded=tuple(round(v,6)for v in xy);assert rounded in node_xy,(trial['id'],'missing actual raster node',rounded)
            land=Part.makeCylinder(4.5,.02,App.Vector(*xy,g['nodeTopZ']-.02)).cut(Part.makeCylinder(1.75,.04,App.Vector(*xy,g['nodeTopZ']-.03)))
            land=by_id['case-lower-body'].common(land)
            initial=overlap(land,adapter);land=land.copy();land.translate(App.Vector(0,0,.02));area=overlap(land,adapter)/.02
            probe=Part.makeCylinder(1.65,anchor['footTopZ']-g['floorBottomZ']+.2,App.Vector(*xy,g['floorBottomZ']-.1));blocked_base=overlap(probe,by_id['case-lower-body']);blocked_adapter=overlap(probe,adapter)
            foot=Part.makeCylinder(4.5,1.98,App.Vector(*xy,g['nodeTopZ']+.01)).cut(Part.makeCylinder(1.75,2.02,App.Vector(*xy,g['nodeTopZ']-.01)))
            missing=foot.cut(adapter).Volume
            ok=area>=50 and initial<.001 and blocked_base<1e-5 and blocked_adapter<1e-5 and missing<1e-5
            anchors.append({'nodeId':node_xy[rounded]['id'],'axisPoint':xy,'actualFootBearingAreaMm2':area,'initialOverlapMm3':initial,'blockedBaseBoreMm3':blocked_base,'blockedAdapterBoreMm3':blocked_adapter,'missingFootWebMm3':missing,'passed':ok})
        violations=[]
        for id,shape in moving.items():
            for fixed in fixed_ids:
                target=by_id[fixed]
                if not shape.BoundBox.intersect(target.BoundBox):continue
                v=overlap(shape,target)
                if v>.001:violations.append({'movedId':id,'target':fixed,'overlapMm3':v})
        ok=all(r['passed']for r in anchors)and not violations
        row={**trial,'adapterId':a['id'],'movedComponentIds':sorted(moving_ids),'checkedFixedIds':fixed_ids,'anchors':anchors,'violations':violations,'passed':ok}
        rows.append(row)
        if not ok:failures.append({'id':trial['id'],'anchors':anchors,'violations':violations})
    return {'passed':not failures,'trials':rows,'failures':failures,'scope':'Actual populated LC1 adapter, its source board/keepers and itsM3hardware translated and rotated on the bare structural insert. Other board adapters, electronics and foil hood are removed for these interchangeability examples; this is not a qualification of arbitrary wiring, heat or analogue zoning after relocation.'}
