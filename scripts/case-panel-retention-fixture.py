"""Source-geometry studies for assumed nylon ties and exterior foil, not electrical ratings."""
import math
import FreeCAD as App
import Part


def placed(shape, pose):
    shape=shape.copy()
    for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],pose['rotation']):
        if angle:shape.rotate(App.Vector(),axis,angle)
    shape.translate(App.Vector(*pose['at']))
    return shape


def audit_battery_vertical_access(case, shapes, overlap):
    """Continuous source-derived pack envelope, with no intervening lift samples."""
    records = case['components']
    by_id = {row['id']: shape for row, shape in zip(records, shapes)}
    rows = []
    for number in [1, 2]:
        id = 'case-battery-pack-' + str(number)
        pack = by_id[id]
        bounds = pack.BoundBox
        assert abs(bounds.XLength-88) < 1e-6 and abs(bounds.YLength-24) < 1e-6
        assert abs(bounds.ZLength-74) < 1e-6, (id, 'full adopted pack height', bounds.ZLength)
        bottom = [face for face in pack.Faces if face.Vertexes
                  and all(abs(vertex.Point.z-bounds.ZMin) < 1e-7 for vertex in face.Vertexes)]
        assert len(bottom) == 1, (id, 'unique complete bottom footprint', len(bottom))
        footprint = Part.Face(bottom[0].OuterWire)
        start_prism = footprint.extrude(App.Vector(0, 0, bounds.ZLength))
        assert start_prism.isValid() and start_prism.isClosed() and len(start_prism.Solids) == 1
        actual_outside = pack.cut(start_prism).Volume
        assert actual_outside < 1e-6
        assert abs(start_prism.Volume-pack.Volume) < 1e-5, (id, 'pack must be the declared vertical source prism')
        travel = 75
        sweep = footprint.extrude(App.Vector(0, 0, bounds.ZLength+travel))
        lifted = pack.copy()
        lifted.translate(App.Vector(0, 0, travel))
        endpoint_outside = lifted.cut(sweep).Volume
        assert sweep.isValid() and sweep.isClosed() and len(sweep.Solids) == 1
        assert endpoint_outside < 1e-6
        violations = []
        for record, target in zip(records, shapes):
            if record['id'] == id:
                continue
            volume = abs(overlap(sweep, target))
            if volume >= .001:
                violations.append({'target': record['id'], 'overlapMm3': volume})
        rows.append({'id': id, 'passed': not violations,
                     'method': 'Exact source bottom-footprint extrusion through the complete pack and continuous vertical travel',
                     'packHeightMm': bounds.ZLength, 'travelMm': travel,
                     'footprintAreaMm2': footprint.Area, 'sweptVolumeMm3': sweep.Volume,
                     'actualPackOutsideStartPrismMm3': actual_outside,
                     'actualLiftedPackOutsideSweepMm3': endpoint_outside,
                     'checkedOtherComponentCount': len(records)-1, 'violations': violations})
    return {'passed': len(rows) == 2 and all(row['passed'] for row in rows),
            'checks': rows,
            'limits': 'Open-case vertical insertion/extraction of the adopted 88 x24 x74 mm supplier envelope. Leads, pull-ribbon thickness and measured wrapped-pack variation remain unmodeled.'}


def audit_retention(case, shapes, overlap, case_fit):
    records=case['components'];m=case['electronics']
    index={r['id']:i for i,r in enumerate(records)}
    checks=[]
    hat=shapes[index['case-servo-driver-hat']]
    assert len(hat.Solids)==361,'HAT source-solid ordering changed'
    socket=hat.Solids[137]
    expected=placed(Part.makeBox(14.00000077683664,9.400000049488263,14.59999981859765,
        App.Vector(-28.5940410276355,-13.551980074049368,-3.60000348467586)),m['hat']).BoundBox
    assert all(abs(getattr(socket.BoundBox,key)-getattr(expected,key))<1e-5 for key in['XMin','YMin','ZMin','XMax','YMax','ZMax']),'HAT XT60 source137 changed'
    bay_parts=[socket]
    for reserve in case['electronicsAccess']['reserves']:
        if reserve['scope']=='installed':
            lo,hi=reserve['min'],reserve['max']
            bay_parts.append(Part.makeBox(*(hi[i]-lo[i] for i in range(3)),App.Vector(*lo)))
    bb=Part.makeCompound(bay_parts).BoundBox
    bay=Part.makeBox(bb.XLength,bb.YLength,bb.ZLength,App.Vector(bb.XMin,bb.YMin,bb.ZMin))
    gaps=[{'target':record['id'],'clearanceMm':bay.distToShape(shape)[0]}
          for record,shape in zip(records,shapes)if record['supply']=='manufactured']
    nearest=min(gaps,key=lambda row:row['clearanceMm'])
    checks.append({'id':'hat-socket-plug-and-lead-service-bay','passed':nearest['clearanceMm']>=3-1e-6,
                   'requiredMinimumMm':3,'minimumPrintedClearance':nearest,
                   'actualSocketToBodyClearanceMm':socket.distToShape(shapes[index['case-lower-body']])[0],
                   'bayMin':[bb.XMin,bb.YMin,bb.ZMin],'bayMax':[bb.XMax,bb.YMax,bb.ZMax],
                   'violations':[row for row in gaps if row['clearanceMm']<3-1e-6]})
    import json
    print('NATIVE_HAT_CONNECTION_BAY='+json.dumps(checks[-1]),flush=True)
    def clear(label,probe):
        violations=[]
        for record,target in zip(records,shapes):
            volume=overlap(probe,target)
            if volume>.001:violations.append({'target':record['id'],'volumeMm3':volume})
        checks.append({'id':label,'passed':not violations,'violations':violations})
        if violations:print('NATIVE_RETENTION_INTERSECTION='+json.dumps(checks[-1]),flush=True)
    def loop_probe(row):
        parts=[box_segment(v)for v in row['segments']]
        loop=parts[0].multiFuse(parts[1:]).removeSplitter()
        assert loop.isValid()and loop.isClosed()and len(loop.Solids)==1,(row['id'],'tie loop disconnected')
        return placed(loop,row['frame'])
    def box_segment(v):
        return Part.makeBox(*(v['max'][i]-v['min'][i]for i in range(3)),App.Vector(*v['min']))
    packing=audit_board_packing_reserves(case,shapes,overlap)
    checks.extend(packing['checks'])
    for row in case['electronicsRetention']['ties']:
        clear('electronics-full-tie-'+row['id'],loop_probe(row))
    for row in case['mechanicalStructure']['ties']:
        clear('mechanical-full-tie-'+row['id'],loop_probe(row))
    optional_lanes=[]
    for row in case['electronicsRetention']['optionalTieLanes']:
        probe=placed(box_segment(row['slotBox']),row['frame'])
        substrate=shapes[index[row['componentId']]]
        blocked=overlap(probe,substrate)
        lands=[]
        for land in row['edgeLandProbes']:
            witness=box_segment(land);missing=witness.cut(substrate).Volume
            lands.append({'min':land['min'],'max':land['max'],'outsidePrintedVolumeMm3':missing,'passed':missing<1e-5})
        assert len(lands)==3 and row['minimumAdjacentSlotLandMm']>=2.6-1e-6 and row['minimumFloorRootLandMm']>=1.5
        loop=loop_probe(row);violations=[]
        for record,target in zip(records,shapes):
            volume=overlap(loop,target)
            if volume>.001:violations.append({'target':record['id'],'volumeMm3':volume})
        passed=blocked<.001 and all(r['passed']for r in lands)and not violations
        optional_lanes.append({'id':row['id'],'componentId':row['componentId'],'hostId':row['hostId'],'passed':passed,'blockedSlotVolumeMm3':blocked,'edgeLandProbes':lands,'minimumAdjacentSlotLandMm':row['minimumAdjacentSlotLandMm'],'minimumFloorRootLandMm':row['minimumFloorRootLandMm'],'fullLoopCheckedComponentCount':len(records),'violations':violations,'basis':row['basis']})
        checks.append({'id':'optional-full-tie-'+row['id'],'passed':passed,'blockedSlotVolumeMm3':blocked,'edgeLandProbes':lands,'violations':violations})
    # Maximum two-layer seam:0.15 mm/layer. Foil is trimmed back1mm at all open notches.
    x0,y0=m['quietPodMin'];x1,y1=m['quietPodMax'];tape=m['foilLayerMax']*m['foilSeamLayers'];bottom=m['floorTop']+1;top=m['quietPodRoof']+1.5
    foil=Part.makeBox(x1-x0+2*tape,y1-y0+2*tape,top-bottom+tape,App.Vector(x0-tape,y0-tape,bottom)).cut(Part.makeBox(x1-x0,y1-y0,top-bottom+.1,App.Vector(x0,y0,bottom-.05)))
    for interval in[m['spiEntryY'],m['filteredSupplyEntryY']]:foil=foil.cut(Part.makeBox(6,interval[1]-interval[0]+2,9,App.Vector(x0-2,interval[0]-1,m['floorTop']-.1)))
    entry=m['analogueRearEntry'];foil=foil.cut(Part.makeBox(entry['width']+2,6,9,App.Vector(entry['centre'][0]-entry['width']/2-1,y1-3,m['floorTop']-.1)))
    violations=[]
    for record,target in zip(records,shapes):
        if record['id']=='case-electronics-analogue-hood':continue
        volume=overlap(foil,target)
        if volume>.001:violations.append({'target':record['id'],'volumeMm3':volume})
    if not case_fit['box_inside'](case['caseEnvelope'],foil.BoundBox,True):
        volume=foil.cut(case_fit['enclosure_fixture'](case['caseEnvelope'])[0]).Volume
        if volume>.001:violations.append({'target':'case-cavity','volumeMm3':volume})
    checks.append({'id':'exterior-foil-two-layer-study','passed':not violations,'violations':violations})
    # Open-bottom notches release three assumed diameter3mm insulated bundles without threading.
    hood=shapes[index['case-electronics-analogue-hood']]
    wires=[Part.makeCylinder(1.5,6,App.Vector(x0-2,y,m['floorTop']+3.5),App.Vector(1,0,0))for y in[sum(m['spiEntryY'])/2,sum(m['filteredSupplyEntryY'])/2]]
    wires += [Part.makeCylinder(1.5,6,App.Vector(m['analogueRearEntry']['centre'][0],y1-3,m['floorTop']+3.5),App.Vector(0,1,0))]
    moving_hood_ids={'case-electronics-analogue-hood','case-electronics-shield-bond-screw','case-electronics-shield-bond-nut','case-electronics-shield-bond-washer'}
    moving_hood=Part.makeCompound([shape for record,shape in zip(records,shapes)if record['id']in moving_hood_ids])
    bench_ids={'case-lower-body','case-lower-cradle','case-pwm-backing','case-servo-driver-hat','case-heltec-v4','case-adc-cjmcu1220','case-buck-1','case-buck-2','case-lc-filter-1','case-lc-filter-2',
               'case-test-clip-carrier','case-test-clip-red','case-test-clip-black','case-pwm-mosfet','case-pwm-keeper',
               *[id for row in case['mechanicalStructure']['brassSupports']['supports']for id in row['retainedComponentIds']]}
    pwm_release=audit_pwm_release(case,shapes,overlap,{id for id in index if id in bench_ids or id.startswith('case-electronics-')},loop_probe)
    checks.append({'id':'pwm-carrier-and-keeper-service','passed':pwm_release['passed'],'violations':pwm_release['violations']})
    for lift in[0,1,3,5,8,20,30]:
        moved=hood.copy();moved.translate(App.Vector(0,0,lift))
        bench_hood=moving_hood.copy();bench_hood.translate(App.Vector(0,0,lift))
        for record,target in zip(records,shapes):
            if record['id']in moving_hood_ids:continue
            if record['id']in bench_ids or record['id'].startswith('case-electronics-'):
                assert overlap(bench_hood,target)<.001,(lift,record['id'],'hood cannot lift on detached body')
        for number,wire in enumerate(wires):
            assert overlap(moved,wire)<.001,(lift,number,'wire bundle captured by hood')
    for row in case['electronicsRetention']['serviceSweeps']:
        sweep_parts=[box_segment(b)for b in row['boxes']];sweep=sweep_parts[0].multiFuse(sweep_parts[1:]).removeSplitter()
        violations=[]
        for record,target in zip(records,shapes):
            id=record['id']
            if id==row['componentId']or id in moving_hood_ids:continue
            if id not in bench_ids and not id.startswith('case-electronics-'):continue
            volume=overlap(sweep,target)
            if volume>.001:violations.append({'target':id,'volumeMm3':volume})
        checks.append({'id':row['id']+'-continuous-sweep','passed':not violations,'translation':row['translation'],'basis':row['basis'],'violations':violations})
    path_results = []
    for path in case['electronicsRetention']['keeperPaths']:
        actual = shapes[index[path['componentId']]]
        source_boxes = [box_segment(bounds) for bounds in path['sourceBoxes']]
        assert source_boxes and all(shape.isValid() and shape.Volume > 0 for shape in source_boxes)
        source = Part.makeCompound(source_boxes)
        missing_source = actual.cut(source).Volume
        assert missing_source < 1e-6, (path['id'], 'actual keeper outside its declared source boxes', missing_source)
        cumulative = [0, 0, 0]
        segments = []
        for number, segment in enumerate(path['segments']):
            start, shift = segment['startTranslation'], segment['translation']
            assert all(abs(a-b) < 1e-7 for a,b in zip(start, cumulative)), (path['id'], 'disconnected release path', number)
            assert sum(abs(value) > 1e-7 for value in shift) == 1, (path['id'], 'one-axis source-box sweep required')
            end = [start[axis]+shift[axis] for axis in range(3)]
            sweep_boxes = [box_segment({
                'min': [bounds['min'][axis]+min(start[axis], end[axis]) for axis in range(3)],
                'max': [bounds['max'][axis]+max(start[axis], end[axis]) for axis in range(3)],
            }) for bounds in path['sourceBoxes']]
            swept = Part.makeCompound(sweep_boxes)
            endpoint_missing = []
            for translation in [start, end]:
                endpoint = actual.copy()
                endpoint.translate(App.Vector(*translation))
                missing = endpoint.cut(swept).Volume
                assert missing < 1e-6, (path['id'], number, 'source endpoint outside complete sweep', missing)
                endpoint_missing.append(missing)
            violations = []
            for record, target in zip(records, shapes):
                id = record['id']
                if id == path['componentId'] or id in moving_hood_ids:
                    continue
                if id not in bench_ids and not id.startswith('case-electronics-'):
                    continue
                # Independent members avoid fragile Boolean fuses. Summing is
                # conservative where two swept source boxes overlap each other.
                volume = sum(abs(overlap(member, target)) for member in sweep_boxes)
                if volume >= .001:
                    violations.append({'target': id, 'conservativeOverlapMm3': volume})
            segments.append({'index': number, 'startTranslation': start, 'translation': shift,
                             'endTranslation': end, 'sweptBoxCount': len(sweep_boxes),
                             'actualEndpointsOutsideSweepMm3': endpoint_missing,
                             'passed': not violations, 'violations': violations})
            cumulative = end
        released = actual.copy()
        released.translate(App.Vector(*cumulative))
        final_clearance = released.BoundBox.ZMin-shapes[index['case-lower-body']].BoundBox.ZMax
        passed = bool(segments) and all(row['passed'] for row in segments) and final_clearance >= .3
        row = {'id': path['id'], 'componentId': path['componentId'], 'passed': passed,
               'method': 'Conservative source-box axis-aligned Minkowski sweeps through a connected ordered path',
               'actualKeeperOutsideSourceBoxesMm3': missing_source, 'segments': segments,
               'finalMinimumZ': released.BoundBox.ZMin,
               'lowerBodyMaximumZ': shapes[index['case-lower-body']].BoundBox.ZMax,
               'endAboveBodyClearanceMm': final_clearance,
               'prerequisites': path['prerequisites']}
        path_results.append(row)
        checks.append(row)
    # With the hood released on the bench, each low keeper has a straight escape.
    keeper_ids={r['id']for r in case['electronicsRetention']['keepers']}
    hood_group=moving_hood_ids
    for row in case['electronicsRetention']['keepers']:
        if row['id']=='case-electronics-analogue-hood':continue
        if 'pathId' in row:
            matched = [path for path in path_results if path['id'] == row['pathId'] and path['componentId'] == row['id']]
            assert len(matched) == 1, (row['id'], 'missing complete connected release-path proof')
            continue
        violations=[]
        for lift in[0,.5,2,5,10,25]:
            moved=shapes[index[row['id']]].copy();moved.translate(App.Vector(*[v*lift for v in row['direction']]))
            for record,target in zip(records,shapes):
                id=record['id']
                if id==row['id']or id in hood_group:continue
                if id not in bench_ids and not id.startswith('case-electronics-'):continue
                volume=overlap(moved,target)
                if volume>.001:violations.append({'liftMm':lift,'target':id,'volumeMm3':volume})
        checks.append({'id':row['id']+'-bench-release','passed':not violations,'direction':row['direction'],'violations':violations})
    battery_access = audit_battery_vertical_access(case, shapes, overlap)
    return {'passed':all(c['passed']for c in checks)and battery_access['passed'],'modulePackingReserves':packing,'keeperReleasePaths':path_results,'batteryVerticalAccess':battery_access,'optionalTieLanes':optional_lanes,'pwmService':pwm_release,'completeElectronicsTieLoops':len(case['electronicsRetention']['ties']),'completeMechanicalTieLoops':len(case['mechanicalStructure']['ties']),'tieWidthMm':2.5,'tieThicknessMm':1,
            'foilLayerMaxMm':m['foilLayerMax'],'foilSeamLayers':m['foilSeamLayers'],
            'foilSetbackAtEntriesMm':1,'openBottomHoodWireBundleDiameterMm':3,
            'hoodWireReleaseLiftsMm':[0,1,3,5,8,20,30], 'checks':checks,
            'limits':'Provisional geometry for unselected nylon ties, foil and insulated wire bundles. No physical wires/ties/foil occurrences, electrical bond, material strength, bend radius or EMI attenuation is established. Inspect actual parts and qualified contact lands.'}


def audit_pwm_release(case,shapes,overlap,bench_ids,loop_probe):
    """Two explicit assembly stages; neither path removes an obstructing source clip."""
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    data=case['mechanicalStructure']['pwmSupport'];carrier=data['carrierPath'];keeper=data['keeperPath']
    ties={r['id']:r for r in case['mechanicalStructure']['ties']}
    moved=set(carrier['movedComponentIds'])
    assert moved=={'case-test-clip-carrier','case-pwm-backing','case-test-clip-red','case-test-clip-black','case-pwm-mosfet','case-pwm-keeper'}
    assert carrier['assemblyStage']=='detached-lower-body-on-bench'and carrier['translation']==[0,0,60]
    assert set(carrier['releasedTieIds'])=={'clip-carrier-retention-1','clip-carrier-retention-2'}
    retained=set(carrier['retainedTieIds']);assert len(retained)==4
    assert retained|set(carrier['releasedTieIds'])==set(ties)
    fixed={id:by_id[id]for id in bench_ids-moved}
    assert {'case-lower-body','case-lower-cradle'}<=set(fixed)and all(row['id']in fixed for row in case['mechanicalStructure']['brassSupports']['supports'])
    moving={id:by_id[id]for id in moved}
    moving.update({id:loop_probe(ties[id])for id in retained})
    vector=App.Vector(*carrier['translation']);violations=[];proofs=[]
    for id,shape in moving.items():
        for solid_number,solid in enumerate(shape.Solids):
            b=solid.BoundBox
            envelope=Part.makeBox(b.XLength,b.YLength,b.ZLength+vector.z,App.Vector(b.XMin,b.YMin,b.ZMin))
            candidates={target_id:target for target_id,target in fixed.items()if overlap(envelope,target)>.001}
            if not candidates:
                proofs.append({'id':id,'sourceSolid':solid_number,'method':'Conservative complete source-solid swept bounding prism','sweepMembers':1,'ignoredDegenerateVolumeMm3':0})
                continue
            # A translated solid is covered by its initial volume plus every
            # boundary face extruded along the full translation. Members stay
            # independent, so no fragile fuse can hide a positive common.
            members=[solid];ignored=0
            for face_number,face in enumerate(solid.Faces):
                swept=face.extrude(vector);volume=abs(swept.Volume)
                if volume>1e-7 and swept.Solids:
                    assert swept.isValid()and swept.isClosed(),(id,solid_number,face_number,'invalid continuous carrier sweep')
                    for member in swept.Solids:
                        if member.Volume<0:member.reverse()
                        assert member.Volume>0
                        members.append(member)
                else:ignored+=volume
            assert ignored<.0001,(id,'non-negligible degenerate carrier sweep',ignored)
            for number,member in enumerate(members):
                for target_id,target in candidates.items():
                    volume=overlap(member,target)
                    if volume>.001:violations.append({'stage':'carrier-release','id':id,'sourceSolid':solid_number,'sweepMember':number,'target':target_id,'volumeMm3':volume})
            proofs.append({'id':id,'sourceSolid':solid_number,'method':'Actual source solid plus independent extruded boundary-face volumes','sweepMembers':len(members),'ignoredDegenerateVolumeMm3':ignored})
    minimum_end=min(s.BoundBox.ZMin+vector.z for s in moving.values())
    clearance=minimum_end-by_id['case-lower-body'].BoundBox.ZMax
    carrier_passed=not violations and clearance>=1
    carrier_row={'id':carrier['id'],'passed':carrier_passed,'assemblyStage':carrier['assemblyStage'],'movedComponentIds':sorted(moved),'releasedTieIds':carrier['releasedTieIds'],'retainedTieIds':sorted(retained),'translation':carrier['translation'],'checkedFixedIds':sorted(fixed),'sourceSweepProofs':proofs,'endpointAboveLowerBodyMm':clearance,'violations':list(violations)}
    clip_ties=retained-{r['id']for r in data['ties']}
    assert clip_ties=={'clip-housing-retention-1','clip-housing-retention-2'}
    def raw_box(b):return Part.makeBox(*(b['max'][i]-b['min'][i]for i in range(3)),App.Vector(*b['min']))
    def bench_path(path,expected_targets,stage):
        assert path['assemblyStage']=='populated-carrier-detached-on-bench'and path['carrierReleasePathId']==carrier['id']
        target_ids=set(path['retainedTargetIds']);assert target_ids==expected_targets
        targets={id:by_id[id]for id in target_ids};targets.update({id:loop_probe(ties[id])for id in clip_ties})
        actual=by_id[path['componentId']];source=Part.makeCompound([raw_box(b)for b in path['sourceBoxes']]);outside=actual.cut(source).Volume
        assert outside<1e-6,(stage,'source boxes do not contain actual part',outside)
        steps=[];start=[0,0,0]
        for step in path['segments']:
            assert step['startTranslation']==start
            translation=step['translation'];assert sum(abs(v)>1e-9 for v in translation)==1
            end=[start[i]+translation[i]for i in range(3)];hits=[];members=[]
            for number,b in enumerate(path['sourceBoxes']):
                lo=[b['min'][i]+min(start[i],end[i])for i in range(3)];hi=[b['max'][i]+max(start[i],end[i])for i in range(3)]
                swept=raw_box({'min':lo,'max':hi});members.append(swept)
                for id,target in targets.items():
                    volume=overlap(swept,target)
                    if volume>.001:hits.append({'sourceBox':number,'target':id,'volumeMm3':volume})
            sweep=Part.makeCompound(members);endpoint_missing=[]
            for shift in [start,end]:
                endpoint=actual.copy();endpoint.translate(App.Vector(*shift));missing=endpoint.cut(sweep).Volume
                assert missing<1e-6,(stage,'actual endpoint outside continuous swept source envelope',missing)
                endpoint_missing.append(missing)
            steps.append({'passed':not hits,'startTranslation':start,'translation':translation,'endTranslation':end,'actualEndpointsOutsideSweepMm3':endpoint_missing,'violations':hits})
            violations.extend({'stage':stage,**r}for r in hits);start=end
        return {'passed':carrier_passed and all(r['passed']for r in steps),'componentId':path['componentId'],'assemblyStage':path['assemblyStage'],'carrierReleasePathId':carrier['id'],'actualPartOutsideSourceBoxesMm3':outside,'retainedTargetIds':sorted(target_ids),'retainedClipTieIds':sorted(clip_ties),'segments':steps,'prerequisites':path['prerequisites']}
    keeper_row=bench_path(keeper,moved-{keeper['componentId']},'keeper-release')
    backing=data['backingPath'];assert backing['componentId']=='case-pwm-backing'
    backing_row=bench_path(backing,{'case-test-clip-carrier','case-test-clip-red','case-test-clip-black'},'backing-release')
    assert len(keeper_row['segments'])==3 and len(backing_row['segments'])==2
    return {'passed':carrier_passed and keeper_row['passed']and backing_row['passed'],'carrierRelease':carrier_row,'keeperRelease':keeper_row,'backingRelease':backing_row,'violations':violations,'limits':'Disconnect leads and remove the populated lower assembly before releasing the two carrier ties. The entire carrier/backing/clips/PWM/keeper then clears actual brass/tray/cradle targets. On that detached carrier the keeper has its three-leg path; after removing the PWM module and keeper, the backing has a separate down-then-out path. Both actual clips and their ties remain strict bench targets.'}


def audit_board_packing_reserves(case,shapes,overlap):
    """Provisional board/lead cubes remain clear of every other module and universal base."""
    m=case['electronics'];modular=case['mechanicalStructure']['modularElectronics']
    by_id={r['id']:s for r,s in zip(case['components'],shapes)}
    descriptors=[('case-adc-cjmcu1220',m['adc'],m['adcReserve'])]
    descriptors.extend(('case-buck-'+str(i+1),pose,m['buckReserve'])for i,pose in enumerate(m['bucks']))
    descriptors.extend(('case-lc-filter-'+str(i+1),pose,m['filterReserve'])for i,pose in enumerate(m['filters']))
    checks=[]
    for id,pose,size in descriptors:
        adapter=next(a for a in modular['adapters']if a['boardId']==id)
        own={id,adapter['id'],*[a[k]for a in adapter['anchors']for k in ['screwId','nutId']]}
        own.update(k['id']for k in case['electronicsRetention']['keepers']if id in k['hosts'])
        assert 'case-lower-body'not in own
        probe=placed(Part.makeBox(*size,App.Vector(-size[0]/2,-size[1]/2,0)),pose)
        violations=[]
        for target_id,target in by_id.items():
            if target_id in own:continue
            volume=overlap(probe,target)
            if volume>.001:violations.append({'id':target_id,'overlapMm3':volume})
        checks.append({'id':'packing-reserve-'+id,'hostId':id,'ownAdapterId':adapter['id'],'ownMountExcludedIds':sorted(own),'checkedOtherComponentCount':len(by_id)-len(own),'passed':not violations,'violations':violations})
    return {'passed':all(r['passed']for r in checks),'checks':checks,'scope':'Provisional layout envelopes, not physical headers or measured leads. Only the host board and its own small adapter, anchor hardware and keeper are excluded as the adopted supporting assembly; all other adapters, electronics and the universal tray remain strict targets. Exact board intersections and full retaining loops are separate checks.'}
