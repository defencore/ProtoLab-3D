"""Package only mutually matching CAD, mesh, validation and preview artifacts."""
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import zipfile

root=Path(__file__).resolve().parent.parent
output=Path(sys.argv[1])if len(sys.argv)>1 else root/'test-results/servo-toggle-case-panel'
def read(name):return json.loads((output/name).read_text())
def digest(name):return hashlib.sha256((output/name).read_bytes()).hexdigest()
components=read('case-panel-components.json');source=components['codeSha256']
assert digest('case-panel-source.FCMacro')==source,'generated CAD source checksum differs'
records=components['components'];prints={r['id']for r in records if r['supply']=='manufactured'}
assert len(records)==163 and len({r['id']for r in records})==163
families=components['mechanicalStructure']['printFamilies']
adapter_ids={f'case-electronics-{name}-adapter'for name in ['hat','heltec','adc','buck-1','buck-2','filter-1','filter-2']}
assert {key:value for key,value in families.items()if key!='electronicsAdapters'}=={'panel':['parallel-base'],'cassette':['case-top-bridge'],'lowerAssembly':['case-lower-body','case-lower-cradle'],'clipAssembly':['case-test-clip-carrier','case-pwm-backing']}
assert len(families['electronicsAdapters'])==7 and set(families['electronicsAdapters'])==adapter_ids
core_prints={part for family in families.values()for part in family}
assert core_prints<=prints
assert len(prints)==28 and len(core_prints)==13
baseline_source='627b1de3a9f27347c567af7829518cf7328e7bb5b1f784e29e981316bda7dc37'
baseline_output=root/'test-results/servo-toggle-case-panel-backups/627b1de3-complete-release/output'
baseline_components=json.loads((baseline_output/'case-panel-components.json').read_text())
assert baseline_components['codeSha256']==baseline_source
assert hashlib.sha256((baseline_output/'case-panel-source.FCMacro').read_bytes()).hexdigest()==baseline_source
baseline_meshes={r['id']:r for r in json.loads((baseline_output/'print-mesh-validation.json').read_text())}
baseline_prints=set(baseline_meshes)
baseline_core={part for family in baseline_components['mechanicalStructure']['printFamilies'].values()for part in family}
assert len(baseline_prints)==28 and len(baseline_core)==13
for id,row in baseline_meshes.items():
    assert hashlib.sha256((baseline_output/row['file']).read_bytes()).hexdigest()==row['sha256']
allowed_changed_existing={'case-lower-cradle','case-fit-seat-ring','case-panel-gasket'}
assert prints==baseline_prints,'this reinforcement adds or retires no printable parts'
changed={id for id in prints if digest(id+'.stl')!=baseline_meshes[id]['sha256']}
assert changed==allowed_changed_existing,(changed,'unexpected print change set')
for id in prints-allowed_changed_existing:
    assert digest(id+'.stl')==baseline_meshes[id]['sha256'],(id,'unrequested printed geometry changed')
assert len(prints-allowed_changed_existing)==25
assert digest('case-top-bridge.stl')=='b5f54371437ec46721099d4367cd19b46d55e394f27127ae9997464311532e98'
assert digest('parallel-base.stl')=='9104f2041ed61f54c24be26b376a8c76535b99e486650de6266a1eef489cfe97'
assert components['layout']==baseline_components['layout'],'faceplate and control datums must be retained'
case_fit=components['caseEnvelope'];old_fit=baseline_components['caseEnvelope']
ring_fit=case_fit['workingRingFit']
changed_fit_keys={'ringOuterSize','ringCentre','ringFrontExtensionMm','referenceRingOuterSize','workingRingFit','gasketInnerOpening','gasketInnerCentre','ringWallMounting','postReinforcement'}
for key,value in old_fit.items():
    if key not in changed_fit_keys:assert case_fit[key]==value,(key,'unrequested case datum change')
assert set(case_fit)==set(old_fit)|changed_fit_keys
assert case_fit['ringOuterSize']==[217.4,154.4]and case_fit['ringCentre']==[107,74.5]
assert case_fit['ringFrontExtensionMm']==1 and case_fit['referenceRingOuterSize']==[217.4,153.4]
assert case_fit['gasketInnerOpening']==[214,151]and case_fit['gasketInnerCentre']==[107,74.5]
assert case_fit['mountingAxes']==old_fit['mountingAxes']and case_fit['screwUnderHeadZ']==17.1
ring_mounting=case_fit['ringWallMounting']
assert ring_mounting['hostId']=='case-fit-seat-ring'and len(ring_mounting['holes'])==9
assert ring_mounting['boreDiameterMm']==3.4 and ring_mounting['countersinkDiameterMm']==6.2
assert ring_mounting['countersinkAngleDegrees']==90 and ring_mounting['countersinkDepthMm']==1.4
assert ring_mounting['padThicknessMm']==5 and ring_mounting['padWidthMm']==10
expected_along={'left':[15,134],'right':[107.75,64],'front':[145,17],'rear':[20,107,194]}
for side,positions in expected_along.items():
    assert [h['alongMm']for h in ring_mounting['holes']if h['side']==side]==positions
assert all(h['headFace'][2]==16 for h in ring_mounting['holes'])
assert ring_mounting['installation']['removedComponentIds']==['case-battery-pack-1','case-battery-pack-2']
assert ring_mounting['installation']['shaftDiameterMm']==6 and ring_mounting['installation']['shaftLengthMm']==20
assert ring_mounting['installation']['handleDiameterMm']==8 and ring_mounting['installation']['handleLengthMm']==20
assert ring_mounting['installation']['engagementTravelMm']==5
modular=components['mechanicalStructure']['modularElectronics']
expected_boards={'case-servo-driver-hat','case-heltec-v4','case-adc-cjmcu1220','case-buck-1','case-buck-2','case-lc-filter-1','case-lc-filter-2'}
assert modular['moduleCount']==len(modular['adapters'])==7
assert {a['id']for a in modular['adapters']}==adapter_ids
assert {a['boardId']for a in modular['adapters']}==expected_boards
assert sum(a['orientation']=='vertical'for a in modular['adapters'])==2
anchors=[p for a in modular['adapters']for p in a['anchors']]
assert len(anchors)==15 and len({p['nodeId']for p in anchors})==15
assert {r['id']for r in records}=={r['id']for r in baseline_components['components']}
assert modular==baseline_components['mechanicalStructure']['modularElectronics']
assert modular['grid']['pitchMm']==20 and modular['grid']['origin']==[10,10]
assert modular['grid']['nodeCount']==len(modular['grid']['nodes'])==49
assert modular['grid']['boreDiameterMm']==3.4 and modular['grid']['nodeDiameterMm']==9.6
assert modular['grid']['bearingWebThicknessMm']==2.9 and modular['fastening']['adapterFootWebMm']==2
assert modular['fastening']['fullNutEngagementMm']==2.4 and modular['fastening']['tipPastNutMm']==.7
assert set(modular['grid']['reservedRegions'])=={'batteryBank','brassAxes','shieldBond','xt60ReactionPier'}
assert {s['componentId']for s in components['electronicsRetention']['supportSeats']}==adapter_ids
rows=read('print-mesh-validation.json')
assert {r['id']for r in rows}==prints
for row in rows:
    assert row['sourceCodeSha256']==source
    assert row['closed'] and row['solids']==1 and row['flatBedContactAreaMm2']>1
    assert abs(row['min'][2])<1e-6,'print bed must be Z=0'
    assert row['sha256']==digest(row['file'])
    if row['id']=='case-lower-cradle':
        assert components['mechanicalStructure']['printRotations'][row['id']]==[180,0,0]
        assert row['printRotationDegrees']==[180,0,0]and abs(row['operatorBedPlaneZ']-1.5)<1e-7
        assert len(row['normalizationTranslationMm'])==3 and set(row['operatorBounds'])=={'min','max'}
        assert abs(row['operatorBounds']['min'][2]+49.5)<1e-6 and abs(row['operatorBounds']['max'][2]-1.5)<1e-6
        assert abs(row['dimensionsMm'][2]-51)<1e-5,'four-post cradle must print inverted at 51 mm height'
    if row['id']=='case-pwm-keeper':
        assert row['flatBedContactAreaMm2']>=150 and abs(row['dimensionsMm'][2]-1.5)<1e-5
reports={name:read(name)for name in['native-export-validation.json','native-intersections.json','native-case-fit-validation.json','native-retention-validation.json','native-motion-validation.json','native-structure-validation.json','native-wall-mount-validation.json','native-print-volume-comparison.json','native-preserved-mesh-validation.json']}
for name,report in reports.items():assert report['sourceCodeSha256']==source,(name,'stale source')
assert reports['native-export-validation.json']['stepRoundtrip'] and reports['native-export-validation.json']['fcstdRoundtrip']
assert reports['native-export-validation.json']['assemblyComponents']==len(records)
assert reports['native-export-validation.json']['printCount']==len(prints)
assert reports['native-export-validation.json']['fcstdValidationByteCopy'] is True
assert reports['native-export-validation.json']['fcstdSha256']==digest('servo-toggle-case-panel.FCStd')
assert digest('servo-toggle-case-panel.FCStd')==digest('case-panel-native-validation.FCStd')
preservation=reports['native-preserved-mesh-validation.json']
assert preservation['passed']and preservation['canonicalFilesNotResaved']is True
assert preservation['baselineSourceCodeSha256']==baseline_source
assert preservation['currentCanonicalSha256']==digest('servo-toggle-case-panel.FCStd')
assert preservation['baselineCanonicalSha256']==hashlib.sha256((baseline_output/'servo-toggle-case-panel.FCStd').read_bytes()).hexdigest()
assert preservation['preservedManifestSha256']==digest('print-mesh-validation.json')
assert len(preservation['preservedMeshes'])==1
preserved=preservation['preservedMeshes'][0]
assert preserved['id']=='case-electronics-hat-adapter'and preserved['file']==preserved['id']+'.stl'
assert preserved['physicalParametersAndPlacementIdentical']is True and len(preserved['physicalAstSha256'])==64
native_identity=preserved['nativeSolidEquivalence']
assert native_identity['passed']and native_identity['xorVolumeThresholdMm3']<=1e-7
assert native_identity['baselineOnlyVolumeMm3']<1e-7 and native_identity['currentOnlyVolumeMm3']<1e-7
assert abs(native_identity['baselineVolumeMm3']-native_identity['currentVolumeMm3'])<1e-7
assert native_identity['maximumBoundsDeltaMm']<1e-9
triangle_change=preserved['triangulationDifference']
assert triangle_change['exactTriangleSurfaceEquality']is False
assert triangle_change['sameFourVertexCoordinates']and triangle_change['sameDirectedOuterBoundary']
assert triangle_change['changedOldFacetCount']==triangle_change['changedGeneratedFacetCount']==2
assert triangle_change['float32QuadPlanarityErrorMm']<1e-5 and triangle_change['float32QuadTetrahedronVolumeMm3']<1e-6
assert preserved['baselineArtifact']['sha256']==preserved['savedCurrentArtifactSha256']==digest(preserved['file'])==baseline_meshes[preserved['id']]['sha256']
assert preserved['preservedBaselineNativeReadback']==preserved['savedCurrentNativeMeshReadback']
saved_mesh=preserved['savedCurrentNativeMeshReadback']
assert saved_mesh['closed']and saved_mesh['connectedComponents']==1 and saved_mesh['facets']==9572
assert saved_mesh['min']==[0,0,0]and saved_mesh['sha256']==digest(preserved['file'])
assert triangle_change['unchangedFacetCount']+2==saved_mesh['facets']
preserved_rows=[row for row in rows if 'preservationRelation'in row]
assert len(preserved_rows)==1 and preserved_rows[0]['id']==preserved['id']
preserved_row=preserved_rows[0]
assert preserved_row['preservationRelation']=='unchanged-native-geometry-preserved-baseline-stl'
assert preserved_row['preservationProof']=='native-preserved-mesh-validation.json'
assert preserved_row['preservedFromSourceCodeSha256']==baseline_source
assert preserved_row['generatedStlSha256']==preserved['generatedArtifact']['sha256']
for key in ['closed','facets','dimensionsMm','min','max','sha256']:
    assert preserved_row[key]==saved_mesh[key],(key,'preserved mesh readback differs')
assert not reports['native-intersections.json']['unintendedIntersections']
assert not reports['native-export-validation.json']['intersections']
assert all(reports[name]['passed']for name in['native-case-fit-validation.json','native-retention-validation.json','native-motion-validation.json','native-structure-validation.json','native-wall-mount-validation.json'])
assert len(reports['native-motion-validation.json']['checkpoints'])==5
motion=reports['native-motion-validation.json']
for report in [reports['native-export-validation.json'],motion]:
    assert report['fullCaseFitVerified']is False
    assert report['caseFitValidationScope']=='assembly-and-provisional-working-panel-fit'
    assert report['workingPanelFit']==components['caseEnvelope']['workingPanelFit']
assert motion['structure']['passed']
assert 'validationRelation' not in motion,'This redesign requires a fresh full five-state native audit.'
hat_loading=motion['hatNutLoading']
assert len(hat_loading)==4 and {r['id']for r in hat_loading}=={f'case-electronics-hat-nut-{n}'for n in range(1,5)}
for row in hat_loading:
    assert row['passed']and row['adapterId']=='case-electronics-hat-adapter'
    assert row['stage']=='detached adapter on bench before PCB installation'
    assert row['outwardDirection']==[0,1,0]and row['travelMm']>=10
    assert row['continuousConservativeSweepOverlapMm3']<1e-5
for retention in [reports['native-retention-validation.json'],reports['native-export-validation.json']['retention'],motion['retention']]:
    packing=retention['modulePackingReserves']
    assert packing['passed']and len(packing['checks'])==5
    packing_hosts=expected_boards-{'case-servo-driver-hat','case-heltec-v4'}
    assert {r['hostId']for r in packing['checks']}==packing_hosts
    for row in packing['checks']:
        adapter=next(a for a in modular['adapters']if a['boardId']==row['hostId'])
        own={row['hostId'],adapter['id'],*[a[k]for a in adapter['anchors']for k in ['screwId','nutId']]}
        own.update(k['id']for k in components['electronicsRetention']['keepers']if row['hostId']in k['hosts'])
        assert row['passed']and not row['violations']and row['ownAdapterId']==adapter['id']
        assert set(row['ownMountExcludedIds'])==own and 'case-lower-body'not in own
        assert row['checkedOtherComponentCount']==len(records)-len(own)
    paths=retention['keeperReleasePaths']
    expected_paths={'case-electronics-buck-2-keeper':3,'case-electronics-heltec-keeper':1}
    assert len(paths)==2 and {path['componentId']for path in paths}==set(expected_paths)
    for path in paths:
        assert path['passed']and path['actualKeeperOutsideSourceBoxesMm3']<1e-6 and path['endAboveBodyClearanceMm']>=.3
        assert len(path['segments'])==expected_paths[path['componentId']]
        end=[0,0,0]
        for segment in path['segments']:
            assert segment['passed']and not segment['violations']
            assert segment['startTranslation']==end
            assert all(value<1e-6 for value in segment['actualEndpointsOutsideSweepMm3'])
            end=segment['endTranslation']
    access=retention['batteryVerticalAccess']
    assert access['passed']and len(access['checks'])==2
    for row in access['checks']:
        assert row['passed']and abs(row['packHeightMm']-74)<1e-6 and row['travelMm']>=75
        assert row['actualPackOutsideStartPrismMm3']<1e-6 and row['actualLiftedPackOutsideSweepMm3']<1e-6
        assert not row['violations']and row['checkedOtherComponentCount']==len(records)-1
    lanes=retention['optionalTieLanes']
    assert len(lanes)==6 and all(row['passed']for row in lanes)
    for row in lanes:
        assert row['blockedSlotVolumeMm3']<.001 and not row['violations']
        assert row['fullLoopCheckedComponentCount']==len(records)
        assert len(row['edgeLandProbes'])==3 and all(p['passed']and p['outsidePrintedVolumeMm3']<1e-5 for p in row['edgeLandProbes'])
        assert row['minimumAdjacentSlotLandMm']>=2.6-1e-6 and row['minimumFloorRootLandMm']>=1.5
    assert retention['completeElectronicsTieLoops']==11 and retention['completeMechanicalTieLoops']==6
    pwm=retention['pwmService'];assert pwm['passed']and not pwm['violations']
    carrier=pwm['carrierRelease'];assert carrier['passed']and carrier['translation']==[0,0,60]and carrier['endpointAboveLowerBodyMm']>=1
    assert set(carrier['movedComponentIds'])=={'case-test-clip-carrier','case-test-clip-red','case-test-clip-black','case-pwm-mosfet','case-pwm-keeper','case-pwm-backing'}
    assert set(carrier['releasedTieIds'])=={'clip-carrier-retention-1','clip-carrier-retention-2'}
    assert len(carrier['retainedTieIds'])==4 and 'case-lower-body'in carrier['checkedFixedIds']and not carrier['violations']
    assert all(row['id']in carrier['checkedFixedIds']for row in components['mechanicalStructure']['brassSupports']['supports'])
    assert carrier['sourceSweepProofs']and all(row['sweepMembers']>=1 and row['ignoredDegenerateVolumeMm3']<.0001 for row in carrier['sourceSweepProofs'])
    keeper=pwm['keeperRelease'];assert keeper['passed']and keeper['actualPartOutsideSourceBoxesMm3']<1e-6
    assert set(keeper['retainedTargetIds'])=={'case-test-clip-carrier','case-test-clip-red','case-test-clip-black','case-pwm-mosfet','case-pwm-backing'}
    assert set(keeper['retainedClipTieIds'])=={'clip-housing-retention-1','clip-housing-retention-2'}
    assert len(keeper['segments'])==3 and all(row['passed']and not row['violations']for row in keeper['segments'])
    assert [row['translation']for row in keeper['segments']]==[[0,.5,0],[0,0,-15],[45,0,0]]
    backing=pwm['backingRelease']
    assert backing['passed']and backing['componentId']=='case-pwm-backing'and backing['actualPartOutsideSourceBoxesMm3']<1e-6
    assert set(backing['retainedTargetIds'])=={'case-test-clip-carrier','case-test-clip-red','case-test-clip-black'}
    assert set(backing['retainedClipTieIds'])=={'clip-housing-retention-1','clip-housing-retention-2'}
    assert [row['translation']for row in backing['segments']]==[[0,0,-3],[0,-15,0]]
    start=[0,0,0]
    for row in backing['segments']:
        assert row['passed']and not row['violations']and row['startTranslation']==start
        assert all(value<1e-6 for value in row['actualEndpointsOutsideSweepMm3'])
        start=row['endTranslation']
for structure in [reports['native-structure-validation.json'],reports['native-export-validation.json']['structure'],motion['structure']]:
    modular_proof=structure['modularElectronics']
    assert modular_proof['passed']and not modular_proof['failures']
    grid_proof=modular_proof['grid'];assert grid_proof['passed']and grid_proof['allUsableRasterNodesDeclared']
    assert grid_proof['nodeCount']==len(grid_proof['nodes'])==49 and grid_proof['pitchMm']==20 and grid_proof['origin']==[10,10]
    assert grid_proof['usedNodeCount']==15 and grid_proof['unusedNodeCount']==34
    assert {r['id']for r in grid_proof['nodes']}=={r['id']for r in modular['grid']['nodes']}
    for row in grid_proof['nodes']:
        assert row['passed']and row['blockedBoreMm3']<1e-5 and row['blockedHeadRecessMm3']<1e-5
        assert row['missingBearingWebMm3']<1e-5 and abs(row['actualWebThicknessMm']-2.9)<1e-7
    assert modular_proof['noIntegralPcbMounts']['passed']and modular_proof['noIntegralPcbMounts']['unexpectedBodyMaterialMm3']<1e-5
    assert len(modular_proof['adapters'])==7 and {r['id']for r in modular_proof['adapters']}==adapter_ids
    for row in modular_proof['adapters']:
        assert row['passed']and row['boardId']in expected_boards
        source_adapter=next(a for a in modular['adapters']if a['id']==row['id'])
        assert len(row['anchors'])==len(source_adapter['anchors'])
        for anchor in row['anchors']:
            assert anchor['passed']and anchor['missingAdapterFootWebMm3']<1e-5 and anchor['missingScrewHeadBearingWebMm3']<1e-5
            assert anchor['screwHeadBearingAreaMm2']>=12.5 and anchor['initialHeadBearingOverlapMm3']<.001
            assert anchor['footBearingAreaMm2']>=50 and anchor['initialBearingOverlapMm3']<.001
            assert anchor['nutBearingAreaMm2']>=10 and anchor['fullNutEngagementMm']>=2.4-1e-6 and anchor['tipPastNutMm']>=.7-1e-6
            assert anchor['screwHeadAboveFloorMm']>=.1-1e-6 and anchor['loadingBlockedMm3']<1e-5
            assert anchor['antiRotationTrialDegrees']==30 and anchor['antiRotationOverlapMm3']>.001
            assert anchor['minimumFullHexWallDepthMm']>=1.2 and anchor['missingFullHexWallMm3']<1e-5
            assert anchor['unfastenedAxialRetentionClaimed']is False and not anchor['toolApproachViolations']
        assert len(row['loadPathProbes'])>=2 and all(r['passed']and r['outsideAdapterVolumeMm3']<1e-5 and r['minimumWidthMm']>=2.4 and r['actualProbeWidthMm']>=r['minimumWidthMm']-1e-6 and r['probeDepthMm']>=.5 for r in row['loadPathProbes'])
    hat_mounts=modular_proof['hatBoardMounts']
    assert len(hat_mounts)==4 and {r['id']for r in hat_mounts}=={f'case-electronics-hat-screw-{n}'for n in range(1,5)}
    for row in hat_mounts:
        assert row['passed']and row['nutToAdapterRoofBearingAreaMm2']>=10 and row['initialNutRoofOverlapMm3']<.001
        assert row['washerToPcbBearingAreaMm2']>=12 and row['initialWasherPcbOverlapMm3']<.001
        assert row['headToWasherBearingAreaMm2']>=9 and row['fullNutEngagementMm']>=2-1e-6
        assert row['tailBeyondNutMm']>=.6-1e-6 and row['tipAboveGridNodeMm']>.5
    relocation=modular_proof['relocationStudies'];assert relocation['passed']and not relocation['failures']and len(relocation['trials'])==2
    assert all(r['passed']for r in relocation['trials'])
    witnesses=structure['webWitnesses'];declared_witnesses=components['mechanicalStructure']['webWitnesses']
    assert len(witnesses)==len(declared_witnesses)==14 and {row['id']for row in witnesses}=={row['id']for row in declared_witnesses}
    assert all(row['passed']and row['outsideVolumeMm3']<1e-5 and row['widthMm']>0 for row in witnesses)
    assert {'carrier-ladder-main-root','carrier-ladder-front-rib','carrier-ladder-rear-rib','carrier-ladder-seat-root'}<={row['id']for row in witnesses}
    shoulder=next(row for row in structure['bearings']if row['id']=='lower-panel-shoulder')
    assert shoulder['passed']and shoulder['movingIds']==['case-lower-cradle','case-lower-body']
    assert shoulder['minimumAreaMm2']==500 and shoulder['areaMm2']>=500 and shoulder['shiftedMemberOverlapMm3']<.001
    assert {row['partId']for row in shoulder['contactAreaByPart']}=={'case-lower-cradle','case-lower-body'}
    assert all(row['initialOverlapMm3']<.001 for row in shoulder['contactAreaByPart'])
    assert abs(sum(row['areaMm2']for row in shoulder['contactAreaByPart'])-shoulder['areaMm2'])<1e-5
    apron=structure['panelBearingApron'];apron_source=components['mechanicalStructure']['panelBearingApron']
    assert apron['passed']and not apron['failures']and apron['partId']=='case-lower-cradle'and apron['fixedId']=='parallel-base'
    assert abs(apron['planeZ']-1.5)<1e-7 and abs(apron['thicknessMm']-3)<1e-7
    assert apron_source['partId']==apron['partId']and apron_source['fixedId']==apron['fixedId']
    declared_regions={row['id']:row for row in apron_source['regions']}
    expected_region_ids={'front-arm1','front-servo','front-arm2','rear-arm1','rear-servo','rear-arm2','left-front','left-rear'}
    assert len(apron['regions'])==len(declared_regions)==8 and set(declared_regions)==expected_region_ids
    assert {row['id']for row in apron['regions']}==expected_region_ids
    for row in apron['regions']:
        declared=declared_regions[row['id']]
        assert row['passed']and row['initialOverlapMm3']<.001
        assert row['minimumAreaMm2']==declared['minimumAreaMm2']and row['contactAreaMm2']>=row['minimumAreaMm2']
        land=row['straightLand']
        assert land['passed']and land['minimumWidthMm']==declared['minimumStraightLandWidthMm']and land['minimumWidthMm']>=3.5
        assert land['declaredWidthMm']>=land['minimumWidthMm']-1e-7
        assert land['actualBearingWidthMm']>=land['minimumWidthMm']-1e-5 and abs(land['actualBearingWidthMm']-land['declaredWidthMm'])<1e-4
        assert land['actualBearingAreaMm2']>=.999*land['expectedAreaMm2']and land['expectedAreaMm2']>0
        assert land['missingFullThicknessVolumeMm3']<1e-5 and land['unbackedContactVolumeMm3']<1e-5
        assert len(row['roots'])==len(declared['rootProbes'])and len(row['roots'])>=1
        for root_probe,authored in zip(row['roots'],declared['rootProbes']):
            assert root_probe['passed']and root_probe['min']==authored['min']and root_probe['max']==authored['max']and root_probe['missingVolumeMm3']<1e-5
        profile=row['coverage']
        assert profile['passed']and profile['axis']==declared['coverageAxis']and profile['cellWidthMm']==declared['cellWidthMm']==1
        assert profile['minimumWidthMm']==declared['minimumBearingWidthMm']and profile['minimumWidthMm']>=1.5
        assert profile['minimumCoverageFraction']==declared['minimumCoverageFraction']and profile['minimumCoverageFraction']>=.98
        assert profile['actualCoverageFraction']>=profile['minimumCoverageFraction']
        assert profile['maximumAllowedGapMm']==declared['maximumGapMm']and profile['maximumAllowedGapMm']<=1
        assert profile['actualMaximumGapMm']<=profile['maximumAllowedGapMm']+1e-7
        axis=0 if profile['axis']=='x'else 1
        assert len(profile['cells'])==round(declared['contactBox']['max'][axis]-declared['contactBox']['min'][axis])
        assert all(cell['widthMm']>0 and abs(cell['contactAreaMm2']/cell['widthMm']-cell['effectiveBearingWidthMm'])<1e-5 for cell in profile['cells'])
        total_span=declared['contactBox']['max'][axis]-declared['contactBox']['min'][axis];good_span=0;gap_span=0;max_gap=0
        for index,cell in enumerate(profile['cells']):
            assert abs(cell['min']-(declared['contactBox']['min'][axis]+index))<1e-7 and abs(cell['max']-cell['min']-cell['widthMm'])<1e-7
            assert abs(cell['widthMm']-1)<1e-7
            assert cell['passed']==(cell['effectiveBearingWidthMm']>=profile['minimumWidthMm']-1e-5)
            if cell['passed']:good_span+=cell['widthMm'];gap_span=0
            else:gap_span+=cell['widthMm'];max_gap=max(max_gap,gap_span)
        assert abs(good_span/total_span-profile['actualCoverageFraction'])<1e-7 and abs(max_gap-profile['actualMaximumGapMm'])<1e-7
        expected_land_area=(declared['straightLandProbe']['max'][0]-declared['straightLandProbe']['min'][0])*(declared['straightLandProbe']['max'][1]-declared['straightLandProbe']['min'][1])
        assert abs(land['expectedAreaMm2']-expected_land_area)<1e-7
    assert apron['network']['passed']and apron['network']['solids']==1
    assert apron['network']['min']==apron_source['networkRegion']['min']and apron['network']['max']==apron_source['networkRegion']['max']
    assert apron['network']['minimumVolumeMm3']==apron_source['networkRegion']['minimumVolumeMm3']and apron['network']['volumeMm3']>=apron['network']['minimumVolumeMm3']
    assert len(apron['terminalReserves'])==2 and all(row['passed']for row in apron['terminalReserves'])
    assert {row['id']for row in apron['terminalReserves']}=={'arm1-terminal-corridor','arm2-terminal-corridor'}
    for terminal in apron['terminalReserves']:
        name=terminal['id'].split('-')[0];x,y=components['layout'][name]
        assert terminal['scope']=='front-toe-adjacent-apron-only'and terminal['occupiedVolumeMm3']<1e-5 and terminal['qualification']
        assert terminal['min']==[x-9.2,10,-1.5]and terminal['max']==[x+9.2,13,1.5]
        assert terminal['nominalWholeCorridor']=={'min':[x-9.2,y-25,-6],'max':[x+9.2,y-5,2]}
        assert abs(terminal['nominalWholeCorridorOccupiedVolumeMm3']-(6 if name=='arm1'else 96))<1e-4
    assert apron['contactRegionDoubleCountMm3']<.001
    assert abs(sum(row['contactAreaMm2']for row in apron['regions'])-apron['totalRegionalContactAreaMm2'])<1e-5
    split=structure['lowerSplit']
    assert split['passed']and not split['failures']and split['independentPrintableSolids']==2
    assert split['trayId']=='case-lower-body'and split['cradleId']=='case-lower-cradle'
    assert split['attachment']=='four-main-brass-post-capture'and abs(split['capturePlaneZ']+49.5)<1e-7
    assert not({'joints','keys','railContacts','seamZ'}&set(split))
    assert not any(row['id'].startswith('case-lower-seam-')for row in records)
    floor=split['floorContainment']
    assert floor['passed']and floor['sizeMm']==[206.8,141.2]and floor['cornerRadiusMm']==6
    assert floor['entireTrayOutsideExtrudedFloorFootprintMm3']<1e-5 and floor['nominalCaseContainmentCheckedSeparately']
    assert len(floor['brassRootFootprints'])==24 and all(row['passed']and row['outsideFloorFootprintMm3']<1e-5 for row in floor['brassRootFootprints'])
    capture=structure['fourPostCapture'];capture_source=components['mechanicalStructure']['fourPostCapture']
    assert capture['passed']and not capture['failures']and capture['retainedWhenLidRemoved']is True
    assert capture_source['retainedWhenLidRemoved']is True
    assert abs(capture_source['capturePlaneZ']+49.5)<1e-7 and abs(capture_source['brassSeatZ']+47.5)<1e-7 and abs(capture_source['headSeatZ']+52.4)<1e-7
    assert len(capture['posts'])==len(capture_source['posts'])==4
    support=capture['carrierSupport'];declared_support=components['mechanicalStructure']['fourPostCapture']['carrierSupport']
    assert support['passed']and not support['failures']and support['architecture']=='straight-bed-rooted-ladder'
    assert support['partId']=='case-lower-cradle'and support['carrierId']=='case-test-clip-carrier'
    assert support['printRotationDegrees']==[180,0,0]and support['printBedPlaneZ']==1.5 and support['minimumMemberThicknessMm']>=3.5
    assert len(support['fullMembers'])==4 and {row['id']for row in support['fullMembers']}=={'main-spine','seat-spine','cross-rib-1','cross-rib-2'}
    for row in support['fullMembers']:
     assert row['passed']and row['missingFullMemberVolumeMm3']<1e-5 and row['actualDeclaredThicknessMm']>=row['minimumMemberThicknessMm']-1e-7
     assert row['min'][2]==-12 and row['max'][2]==1.5 and row['max'][0]<=149.5+1e-7
    assert len(support['sections'])==4
    for row,minimum in zip(support['sections'],[54,54,58.05,47.25]):
     assert row['passed']and row['solids']==1 and row['actualAreaMm2']>=row['minimumAreaMm2']-1e-5 and row['minimumAreaMm2']>=minimum-1e-7
     assert row['missingFullSectionVolumeMm3']<1e-5
    for field in ['mainWallLapProbes','seatWallLapProbes']:
     assert len(support[field])==2
     assert all(row['passed']and row['missingLapVolumeMm3']<1e-5 for row in support[field])
    assert len(support['bedContactPatches'])==4
    for row in support['bedContactPatches']:
     assert row['passed']and row['expectedBedAreaMm2']>=25 and row['actualCoplanarBedAreaMm2']>=row['expectedBedAreaMm2']-1e-5
     assert row['missingBedRootVolumeMm3']<1e-5 and row['max'][2]==1.5
    assert len(support['connectedDepthSlices'])==5
    assert all(row['passed']and row['solids']==1 and row['actualAreaMm2']>=383.6-1e-5 for row in support['connectedDepthSlices'])
    assert set(support['retainedBrassSupportIds'])==set(declared_support['retainedBrassSupportIds'])=={f'case-brass-carrier-{i}'for i in range(1,5)}
    declared_posts={row['id']:row for row in capture_source['posts']}
    assert {row['id']for row in capture['posts']}==set(declared_posts)
    assert {tuple(row['axisPoint'][:2])for row in declared_posts.values()}=={(61,15),(61,55),(106,15),(106,55)}
    for post in capture['posts']:
        declared=declared_posts[post['id']]
        assert post['passed']and not post['failures']and post['brassId']==declared['brassId']and post['bottomScrewId']==declared['bottomScrewId']
        expected_contacts={'foot-to-tray':('case-lower-cradle','case-lower-body',50),'brass-to-foot':(post['brassId'],'case-lower-cradle',12),'head-to-tray':(post['bottomScrewId'],'case-lower-body',12)}
        assert len(post['contacts'])==3 and {row['id']for row in post['contacts']}==set(expected_contacts)
        for row in post['contacts']:
            moving,fixed,minimum=expected_contacts[row['id']]
            assert row['passed']and row['movingId']==moving and row['fixedId']==fixed
            assert row['initialOverlapMm3']<.001 and row['actualBearingAreaMm2']>=row['minimumAreaMm2']>=minimum
        webs=post['clampedWebParts']
        assert len(webs)==2 and [row['partId']for row in webs]==['case-lower-body','case-lower-cradle']
        for row,(lo,hi,thickness)in zip(webs,[(-52.4,-49.5,2.9),(-49.5,-47.5,2)]):
            assert row['passed']and row['annularProbeOutsideMm3']<1e-5
            assert abs(row['minZ']-lo)<1e-7 and abs(row['maxZ']-hi)<1e-7 and abs(row['minimumThicknessMm']-thickness)<1e-7
            assert abs(row['actualMinimumZ']-lo)<1e-6 and abs(row['actualMaximumZ']-hi)<1e-6 and abs(row['actualThicknessMm']-thickness)<1e-6
        assert abs(post['totalClampedWebThicknessMm']-4.9)<1e-6
        probe_groups={'sleeveWallProbes':3,'slotEdgeProbes':2,'closedEndProbes':2,'jointRootProbes':2,'upperRootProbes':2,'footRootProbes':2}
        assert len(post['loadPathProbes'])==sum(probe_groups.values())
        for group,count in probe_groups.items():
            probes=[row for row in post['loadPathProbes']if row['group']==group]
            assert len(probes)==count and {row['index']for row in probes}==set(range(count))and len(declared[group])==count
            for row in probes:
                assert row['passed']and row['partId']=='case-lower-cradle'and row['outsideCradleMm3']<1e-5
                assert row['min']==declared[group][row['index']]['min']and row['max']==declared[group][row['index']]['max']
        slot=post['cleaningSlot'];slot_source=declared['cleaningSlot']
        assert slot['passed']and slot['blockedCradleMm3']<.001 and slot['widthMm']==2.4
        assert all(slot[key]==slot_source[key]for key in ['min','max','outward','widthMm'])
        assert slot['min'][2]==-47.5 and slot['max'][2]==-19.7 and post['footBoreBlockedMm3']<.001
        registration=post['socketRegistration'];reg_source=declared['socketRegistration']
        assert registration['passed']and abs(registration['engagementMm']-49)<1e-7
        assert registration['blockedRouteMm3']<.001 and registration['actualMetalOutsideAF5Mm3']<1e-5
        assert registration['gapAppliesToRetainedWallSegmentsOnly']is True and registration['flatNormalGapUpperBoundMm']<=.151
        assert registration['gapScope']==reg_source['wallGapScope']
        flat_rows=registration['wallAndMetalProbes'];assert len(flat_rows)==6 and {row['face']for row in flat_rows}==set(range(6))
        for row in flat_rows:
            assert row['passed']and row['outsideActualMetalMm3']<1e-5 and len(row['retainedWallSegments'])==1
            span=row['retainedWallSegments'][0];expected_min=-19.55 if row['face']==slot_source['facingFlatIndex']else -47.35
            assert span['passed']and span['outsideCradleMm3']<1e-5 and abs(span['minZ']-expected_min)<1e-7 and abs(span['maxZ']-1.35)<1e-7
        for study in [registration,post['newExtensionRegistration']]:
            moves=study['blockedTransverseMoves']
            assert study['passed']and len(moves)==4 and {tuple(row['translation'])for row in moves}=={(.4,0,0),(-.4,0,0),(0,.4,0),(0,-.4,0)}
            assert all(row['passed']and row['overlapCradleMm3']>.001 for row in moves)
        extension=post['newExtensionRegistration']
        assert extension['minZ']==-47.5 and extension['maxZ']==-19.7 and extension['actualMetalVolumeMm3']>0 and extension['initialOverlapMm3']<.001
        retained=post['lidIndependentCapture']
        assert retained['passed']and set(retained['removedIds'])=={row['lidScrewId']for row in declared_posts.values()}
        assert set(retained['retainedIds'])=={id for row in declared_posts.values()for id in row['retainedComponentIds']}
        assert len(retained['trials'])==2 and {row['direction']for row in retained['trials']}=={'up','down'}
        for row in retained['trials']:
            up=row['direction']=='up';minimum=12 if up else 50
            assert row['passed']and row['target']==(post['brassId']if up else 'case-lower-body')
            assert row['translation']==[0,0,.01 if up else -.01]and row['initialOverlapMm3']<.001
            assert row['blockingAreaMm2']>=row['minimumAreaMm2']>=minimum and row['blockingOverlapMm3']>.001
    assert structure['frameNetworks']and all(r['passed']and r['solids']==1 for r in structure['frameNetworks']),'missing connected upper-frame proof'
    registers=structure['carrierBrassRegisters']
    assert registers['passed']and not registers['failures']and len(registers['registers'])==4
    assert len(structure['registrations'])==2 and all(r['passed']for r in structure['registrations'])
    for row in registers['registers']:
        assert row['passed']and not row['failures']and abs(row['engagementMm']-2.5)<1e-6
        assert row['socketAcrossFlatsMm']==5.3 and row['metalAcrossFlatsMm']==5
        assert row['actualMetalOutsideAF5Mm3']<1e-5 and row['blockedSocketVolumeMm3']<1e-5 and row['initialOverlapMm3']<.001
        assert row['flatNormalGapUpperBoundMm']<=.151 and row['maximumTransverseGapMm']<=.174
        for field in ['wallProbes','actualMetalFlatProbes']:
            assert len(row[field])==6 and all(r['passed']for r in row[field])
        assert len(row['blockedLateralMoves'])==4 and all(r['passed']and r['overlapCarrierVolumeMm3']>.001 for r in row['blockedLateralMoves'])
    for field,count in [('boardSeats',20),('mechanismAxialSeats',4),('mechanismGuides',12)]:
        assert len(structure[field])==count and all(r['passed']for r in structure[field]),(field,'incomplete adopted-source seating proof')
    assert sum(row['hostId']=='drive-servo'for row in structure['mechanismGuides'])==4
    bank=structure['batteryPockets']
    assert bank['passed']and bank['wallCount']==5 and bank['guideCount']==4
    for field,count in [('continuityProbes',9),('rootProbes',9),('seatProbes',2)]:
        assert len(bank[field])==count and all(row['passed']and row['outsideBodyVolumeMm3']<1e-5 for row in bank[field])
    assert bank['wallThicknessMm']>=1.6 and abs(bank['seatThicknessMm']-2.4)<1e-7 and abs(bank['wallTopZ']-1.5)<1e-7
    assert bank['initialPanelOverlapMm3']<.001 and bank['panelBearingAreaMm2']>=bank['minimumPanelBearingAreaMm2']>=250
    reaction=bank['connectorReaction'];assert reaction['passed']
    for field in ['seats','panelSeats','roots']:
        assert len(reaction[field])==3 and all(row['passed']and row['outsideBodyVolumeMm3']<1e-5 for row in reaction[field])
        if field!='roots':assert all(row['initialOverlapMm3']<.001 and row['contactAreaMm2']>=row['minimumBearingAreaMm2']for row in reaction[field])
    guard=structure['guardSweep']
    assert guard['passed']and len(guard['checks'])==1 and guard['checks'][0]['id']=='manual-toggle-switch'
    assert guard['checks'][0]['anglesDegrees']==list(range(70))and not guard['checks'][0]['violations']
    brass=structure['brassSupports']
    assert brass['passed']and len(brass['supports'])==8 and not brass['failures']
    assert all(sum(r['role']==role for r in brass['supports'])==4 for role in ['main','carrier'])
    for row in brass['supports']:
        assert row['passed']and not row['failures']and row['acrossFlatsMm']==5
        assert row['bodyLengthMm']==(50 if row['role']=='main'else 40)
        assert row['bottomBearingAreaMm2']>=row['minimumBearingAreaMm2']>=12
        assert row['topBearingAreaMm2']>=row['minimumBearingAreaMm2']
        assert row['initialFloorOverlapMm3']<.001 and row['initialBottomBearingOverlapMm3']<.001 and row['initialUpperOverlapMm3']<.001
        assert row['floorWebThicknessMm']>=2.89 and row['annularFloorWebOutsideMm3']<1e-5
        assert row['bottomHeadBearingAreaMm2']>=12 and row['headBottomZ']>=components['electronics']['floorBottom']+.09
        main=row['role']=='main'
        expected_parts=['case-lower-body','case-lower-cradle']if main else['case-lower-body']
        assert row['bottomBearingPartId']==expected_parts[-1]and row['clampedPartIds']==expected_parts
        webs=row['clampedWebParts'];assert len(webs)==len(expected_parts)and [w['partId']for w in webs]==expected_parts
        expected_spans=[(-52.4,-49.5,2.9),(-49.5,-47.5,2)]if main else[(-52.4,-49.5,2.9)]
        for web,(lo,hi,minimum)in zip(webs,expected_spans):
            assert web['passed']and web['annularProbeOutsideMm3']<1e-5
            assert abs(web['minZ']-lo)<1e-7 and abs(web['maxZ']-hi)<1e-7 and abs(web['minimumThicknessMm']-minimum)<1e-7
            assert abs(web['actualMinimumZ']-lo)<1e-6 and abs(web['actualMaximumZ']-hi)<1e-6 and abs(web['actualThicknessMm']-minimum)<1e-6
        assert abs(row['totalClampedWebThicknessMm']-(4.9 if main else 2.9))<1e-6
        roots=row['rootProbes'];assert len(roots)==(4 if main else 2)
        assert all(p['passed']and p['partId']in expected_parts and p['outsidePrintedVolumeMm3']<1e-5 for p in roots)
        assert all(sum(p['partId']==id for p in roots)==2 for id in expected_parts)
        assert abs(row['bottomSeatZ']-(-47.5 if main else -49.5))<1e-7 and abs(row['topSeatZ']-(2.5 if main else -9.5))<1e-7
        assert abs(row['bottomScrew']['nominalReachMm']-(3.1 if main else 5.1))<1e-6
        assert row['bottomScrew']['minimumUsableFemaleDepthMm']==(3.5 if main else 5.5)
        assert bool(row['topScrew'])==main
        if main:assert abs(row['topScrew']['nominalReachMm']-3.2)<1e-6
        for screw in [row['bottomScrew'],*([row['topScrew']]if row['topScrew']else [])]:
            assert screw['nominalReachMm']>=3-1e-6 and screw['minimumBottomClearanceMm']>=.29
        driver=row['bottomDriver']
        assert driver['passed']and driver['acrossFlatsMm']==2.5 and not driver['violations']and driver['checkedComponentCount']==len(records)
        assert row['retainedComponentIds']==[row['id'],row['bottomScrew']['id']]
        assert row['removedBeforeWithdrawalIds']==([row['topScrew']['id']]if main else[])
    connectors=structure['connectorMounting']
    assert connectors['passed']and len(connectors['inserts'])==4 and not connectors['failures']
    for row in connectors['inserts']:
        assert row['passed']and row['ownedByPurchasedConnector']and not row['internalHostIntersections']
        assert row['actualInsertOutsideAdoptedEnvelopeMm3']<1e-6 and row['adoptedEnvelopeOutsideActualInsertMm3']<1e-6
        assert abs(row['adoptedInsertOverlapMm']-2)<1e-6 and abs(row['adoptedInsertDepthMm']-2)<1e-6
        assert abs(row['reachBelowFlangeFrontMm']-4.5)<1e-6 and abs(row['rearTipProjectionMm']-.5)<1e-6
        assert row['headBearingAreaMm2']>=8 and row['flangePanelBearingAreaMm2']>=8 and row['insertHousingBearingAreaMm2']>=8
        assert row['panelBearingWebMm']>=1.5-1e-6 and row['panelWebOutsideMm3']<1e-5
        assert row['initialHostPanelOverlapMm3']<.001 and row['blockedCounterboreMm3']<.001
        assert row['topDriverApproach']['passed']and not row['topDriverApproach']['violations']
        assert row['panelBoreDiameterMm']==3 and row['blockedPanelBoreMm3']<.001
    assert len(connectors['matingAccess'])==2 and all(r['passed']and not r['violations']for r in connectors['matingAccess'])
    pwm=structure['pwmSupport'];assert pwm['passed']and not pwm['failures']
    assert pwm['roofWebThicknessMm']>=3.8-1e-6 and pwm['roofProbe']['passed']and pwm['roofProbe']['outsideCarrierVolumeMm3']<1e-5
    assert pwm['wallProbes']and pwm['rootProbes']
    assert all(row['passed']and row['outsideCarrierVolumeMm3']<1e-5 for field in ['wallProbes','rootProbes']for row in pwm[field])
    assert len(pwm['supportSeats'])==2 and all(row['passed']and row['actualContactAreaMm2']>=row['minimumAreaMm2']and row['initialOverlapMm3']<.001 for row in pwm['supportSeats'])
    assert len(pwm['wireReserves'])==2 and all(row['passed']and not row['violations']and row['checkedComponentCount']==len(records)for row in pwm['wireReserves'])
    assert set(pwm['fullTieIds'])=={'pwm-wall-retention-1','pwm-wall-retention-2'}
    joint=pwm['joint']
    assert joint['passed']and not joint['failures']and joint['backingId']=='case-pwm-backing'and joint['carrierId']=='case-test-clip-carrier'
    assert joint['nominalEngagementMm']>=2.1-1e-6 and joint['minimumRetainedEngagementMm']>=1.8-1e-6 and joint['maximumTiedWallWithdrawalMm']<=.3+1e-6
    assert joint['actualTongueOutsideMm3']<1e-5 and joint['blockedReceiverMm3']<.001 and joint['initialOverlapMm3']<.001
    assert joint['receiverRoofThicknessMm']>=2.8-1e-6 and joint['shoulderBearingAreaMm2']>=30
    assert joint['receiverRoofProbes']and all(row['passed']and row['outsideCarrierMm3']<1e-5 for row in joint['receiverRoofProbes'])
    assert len(joint['shoulderProbes'])==2 and all(row['passed']and max(row['outsideBackingMm3'],row['outsideCarrierMm3'])<1e-5 for row in joint['shoulderProbes'])
    assert len(joint['transverseBlocking'])==4 and all(row['passed']and row['overlapCarrierMm3']>.001 for row in joint['transverseBlocking'])
    assert len(joint['tieCapture'])==2
    for row in joint['tieCapture']:
        assert row['passed']and row['nominalLoopCarrierOverlapMm3']<.001 and row['worstShiftedLoopCarrierOverlapMm3']<.001
        assert row['upperBandTravelStopOverlapMm3']>.001 and row['backingDownTrialAgainstWorstLowerBandMm3']>.001 and abs(row['nominalWallToLowerBandGapMm'])<1e-6
for mounts in [reports['native-wall-mount-validation.json'],reports['native-export-validation.json']['wallMounts'],motion['wallMounts']]:
    assert mounts['passed']and len(mounts['mounts'])==7 and all(r['passed']for r in mounts['mounts'])
    assert mounts['workingRingFit']==ring_fit and mounts['workingRingFitStudy']['passed']
    assert all(r['residualOutsideRequestedFrontRegion']<.001 for r in mounts['workingRingFitStudy']['components'])
    ring_coupon_count=0
    assert mounts['fullCaseFitVerified']is False
    assert mounts['workingPanelFit']==components['caseEnvelope']['workingPanelFit']
    assert mounts['workingPanelFitStudy']['passed']and mounts['workingPanelFitStudy']['residualOutsideWorkingRegion']<.001
    assert not mounts['outsideCavityViolations'] and mounts['requiresMeasuredCaseWall'] is False
    assert mounts['ribNetworks']and all(r['passed']and r['solids']==1 for r in mounts['ribNetworks'])
    assert len(mounts['toolReserves'])==2 and all(r['passed']for r in mounts['toolReserves'])
    exterior=mounts['authorizedExteriorHardware']
    assert len(exterior)==21 and len({row['id']for row in exterior})==21
    assert all(sum(row['role']==role for row in exterior)==7 for role in ['screw','washer','seal'])
    assert all(row['passed']and row['outsideAssignedFiniteZoneMm3']<.001 for row in exterior)
    for row in mounts['mounts']:
        assert row['rootJointProbe']['min'][2]<1.5<row['rootJointProbe']['max'][2]
        assert abs(row['nominalReferenceGapMm']-.2)<=.01 and row['actualBossGapMeasured']is False
        assert len(row['retainingCheeks'])==2 and all(r['passed']for r in row['retainingCheeks'])
        assert len(row['antiRotation'])==2 and all(r['passed']for r in row['antiRotation'])
        assert row['wholeNutBeyondMouthGapMm']>=row['minimumStartGapMm']
        assert row['continuousNutSweep']['actualNutOutsideEnvelopeMm3']<1e-6
        assert row['continuousNutSweep']['transformedNativeYMatchesOutward']is True
        assert row['continuousNutSweep']['method']=='Conservative filled outer-hex planar Minkowski prism'
        stack=row['exteriorStack']
        assert stack['passed']and stack['normalWallThicknessMm']==4 and stack['drilledPortDiameterMm']==3.4
        assert stack['fullNutEngagement']and stack['tailBeyondNutMm']>=.5 and stack['recessedTailMm']>=.49
        assert not stack['residualWallViolations']and not stack['externalTool']['violations']
        assert stack['fullRealWallFitVerified']is False
        for conflict in stack['nominalWallCouponIntersections']:
            assert conflict['id']=='parallel-base'and conflict['status']=='previous-nominal-reference-mismatch'
            assert conflict['passed']and conflict['residualOutsideWorkingRegion']<.001
        ring_conflicts=stack['nominalRingFitIntersections']
        assert len(ring_conflicts)==(1 if row['side']=='front'else 0)
        for conflict in ring_conflicts:
            assert conflict['id']=='case-fit-seat-ring'and conflict['status']==ring_fit['status']
            assert conflict['passed']and conflict['previousNominalOutsideVolume']>.001
            assert conflict['residualOutsideRequestedFrontRegion']<.001
            ring_coupon_count+=1
        assert len(stack['finiteZones'])==3 and all(r['passed']for r in stack['finiteZones'])
        assert set(row['nutEntryRemovedIds'])=={entry['id']for entry in exterior}
        loading=row['loadingWellInsertion']
        assert loading['passed']and loading['transformedNativeXMatchesOutward']
        assert loading['actualStartHostOverlapMm3']<.001
        assert loading['wholeNutBeyondWellMouthGapMm']>=loading['minimumStartGapMm']
        assert not loading['violations']and 'parallel-base'not in loading['removedIds']
    assert ring_coupon_count==2
baseline_fit=json.loads((baseline_output/'native-case-fit-validation.json').read_text())
for fit in [reports['native-case-fit-validation.json'],*motion['caseFit']]:
    assert set(fit['measuredSeatingAreasMm2'])==set(baseline_fit['measuredSeatingAreasMm2'])
    contacts=fit['measuredSeatingAreasMm2'];gasket_area=fit['gasketFootprintAreaMm2']
    assert contacts['adapterOnPanel']>=baseline_fit['measuredSeatingAreasMm2']['adapterOnPanel']-1e-5
    assert contacts['adapterOnTpuPad']>=.99*gasket_area
    gasket_study=next(r for r in fit['workingRingFitStudy']['components']if r['componentId']=='case-panel-gasket')
    expected_nominal_seat=gasket_area-gasket_study['previousNominalOutsideVolume']/case_fit['gasketThickness']
    assert abs(contacts['tpuPadOnCaseLedge']-expected_nominal_seat)<.05
    assert contacts['tpuPadOnCaseLedge']>=.8*baseline_fit['measuredSeatingAreasMm2']['tpuPadOnCaseLedge']

    assert fit['fullCaseFitVerified']is False and fit['validationScope']=='assembly-and-provisional-working-panel-fit'
    assert fit['workingPanelFit']==components['caseEnvelope']['workingPanelFit']
    study=fit['workingPanelFitStudy']
    assert study['passed']and study['componentId']=='parallel-base'and study['status']=='provisional-physical-fit-prototype'
    assert study['previousNominalOutsideVolume']>.001 and study['nominalReferenceContained']is False
    assert study['residualOutsideWorkingRegion']<.001
    assert len(fit['authorizedExteriorHardware'])==21
    assert all(row['passed']and row['outsideAssignedFiniteZoneMm3']<.001 for row in fit['authorizedExteriorHardware'])
record_ids={r['id']for r in records}
ring_fit=case_fit['workingRingFit']
def audit_ring_mounting_proof(fit):
 proof=fit['ringWallMounting']
 assert proof['passed']and not proof['failures']and proof['hostId']=='case-fit-seat-ring'
 assert proof['screwLengthSelected']is False and proof['driveSelected']is False
 assert proof['casePilotDiameterSelected']is False and proof['caseThreadEngagementVerified']is False
 assert len(proof['holes'])==9 and {r['id']for r in proof['holes']}=={r['id']for r in ring_mounting['holes']}
 for row in proof['holes']:
  declared=next(r for r in ring_mounting['holes']if r['id']==row['id'])
  for key in ['side','headFace','wallPoint','outward']:assert row[key]==declared[key],(row['id'],key)
  assert row['passed']and row['blockedBoreMm3']<1e-5 and row['blockedCountersinkMm3']<1e-5
  assert row['minimumCylindricalWebMm']>=3.4 and row['missingCylindricalWebMm3']<1e-5
  assert row['minimumTopEdgeLandMm']>=1.2 and row['missingTopLandMm3']<1e-5
  taper=row['countersinkTaperWalls'];assert len(taper)==3
  for wall,depth in zip(taper,[.15,.7,1.2]):
   assert wall['passed']and wall['depthMm']==depth and abs(wall['nominalRadiusMm']-(3.1-depth))<1e-7
   assert wall['missingTaperWallMm3']<1e-5
  assert len(row['sideLands'])==2
  assert all(r['passed']and r['minimumSideLandMm']>=1.9 and r['interiorWitnessWidthMm']>=1.8-1e-7 and r['missingLandMm3']<1e-5 for r in row['sideLands'])
  driver=row['driver'];assert driver['passed']and not driver['collisions']and driver['outsideNominalOpenCavityMm3']<.001
  assert driver['installationStage']==ring_mounting['installation']['stage']
  assert driver['removedComponentIds']==['case-battery-pack-1','case-battery-pack-2']
  assert len(driver['checkedComponentIds'])==161 and set(driver['checkedComponentIds'])==record_ids-set(driver['removedComponentIds'])
  assert proof['hostId']in driver['checkedComponentIds']
  assert [driver[k]for k in ['shaftDiameterMm','shaftLengthMm','handleDiameterMm','handleLengthMm','continuousInwardTravelMm','sweptShaftLengthMm','sweptHandleLengthMm']]==[6,20,8,20,5,25,25]
 roots=proof['postReinforcement'];assert len(roots)==4
 assert {tuple(row['axisPoint'])for row in roots}=={tuple(xy)for xy in case_fit['mountingAxes']}
 for root in roots:
  assert root['passed']and len(root['members'])==2 and {m['direction']for m in root['members']}=={'x-root','y-root'}
  for member in root['members']:
   assert member['passed']and member['nominalRibWidthMm']>=4 and member['verifiedInteriorRibWidthMm']>=3.96
   assert member['minimumPostLapMm']>=4.2 and member['bottomZ']==7.5 and member['topZ']==20.3
   assert member['expectedClippedRootVolumeMm3']>100 and member['missingRootVolumeMm3']<1e-5
 assert math.isfinite(fit['gasketFootprintAreaMm2'])and fit['gasketFootprintAreaMm2']>1000

export=reports['native-export-validation.json']
assert export['fullCaseFitVerified']is False and motion['fullCaseFitVerified']is False
fit_consumers=[reports['native-case-fit-validation.json'],export,*motion['caseFit']]
assert len(fit_consumers)==7
for fit in fit_consumers:
 audit_ring_mounting_proof(fit)
 if fit is not export:
  for contact in ['adapterOnPanel','adapterOnTpuPad','tpuPadOnCaseLedge']:
   assert fit['measuredSeatingAreasMm2'][contact]>.05 and fit['initialSeatingOverlapMm3'][contact]<.001
 assert fit['fullCaseFitVerified']is False and fit['workingPanelFit']==case_fit['workingPanelFit']
 assert fit['workingPanelFitStudy']['passed']and fit['workingPanelFitStudy']['residualOutsideWorkingRegion']<.001
 assert fit['workingRingFit']==ring_fit
 ring_study=fit['workingRingFitStudy']
 assert ring_study['passed']and ring_study['componentIds']==ring_fit['componentIds']and ring_study['direction']==[0,-1,0]and ring_study['extensionMm']==1
 assert len(ring_study['components'])==2 and {row['componentId']for row in ring_study['components']}==set(ring_fit['componentIds'])
 for row in ring_study['components']:
  assert row['passed']and row['status']==ring_fit['status']and row['residualOutsideRequestedFrontRegion']<.001
  assert row['frontOnlyPermissionVolumeMm3']>0 and row['previousNominalOutsideVolume']>=row['residualOutsideRequestedFrontRegion']-1e-6

fixture_paths=['scripts/case-panel-native-fixture.py','scripts/case-panel-retention-fixture.py','scripts/case-panel-structure-fixture.py','scripts/case-panel-wall-mount-fixture.py','scripts/export-servo-toggle-case-panel.py','tests/servo-toggle-case-panel.test.ts','scripts/servo-toggle-case-panel-volume-baseline.json']
fixture_rows=[]
for relative in fixture_paths:
    file=root/relative;sha=hashlib.sha256(file.read_bytes()).hexdigest();name=file.name
    consumers=[r['fixtureCodeSha256'][name]for r in [reports['native-export-validation.json'],motion]if name in r['fixtureCodeSha256']]
    assert consumers and all(value==sha for value in consumers),(relative,'validation fixture changed after native checks')
    archived='validation-'+name;shutil.copyfile(file,output/archived)
    fixture_rows.append({'file':archived,'sourceRelativePath':relative,'sha256':sha})
(output/'native-validation-fixtures.json').write_text(json.dumps({'sourceCodeSha256':source,'fixtures':fixture_rows},indent=2)+'\n')
preservation_scripts=[]
for relative,proof_key in [('scripts/preserve-case-panel-print-meshes.py','scriptSha256'),('scripts/stage-servo-toggle-case-panel.py','physicalFingerprintScriptSha256')]:
    file=root/relative
    assert hashlib.sha256(file.read_bytes()).hexdigest()==preservation[proof_key],(relative,'preserved mesh proof code changed')
    archived='validation-'+file.name
    shutil.copyfile(file,output/archived)
    preservation_scripts.append(archived)
preservation_evidence=[]
for original,name,proof_key in [(Path('/tmp/case-panel-strengthening-final-input.json'),'preserved-mesh-current-input.json','currentInputSha256'),(Path('/tmp/case-panel-strengthening-reviewed-change-contract.json'),'preserved-mesh-change-contract.json','reviewedChangeContractSha256')]:
    evidence=output/name if(output/name).exists()else original
    assert hashlib.sha256(evidence.read_bytes()).hexdigest()==preservation[proof_key],(name,'mesh preservation input changed')
    if evidence!=output/name:shutil.copyfile(evidence,output/name)
    preservation_evidence.append(name)
preserved_input=read('preserved-mesh-current-input.json')
preserved_contract=read('preserved-mesh-change-contract.json')
assert preserved_input['codeSha256']==source and preserved_input['components']==components['components']
assert hashlib.sha256(preserved_input['script'].encode()).hexdigest()==source
assert preserved_contract['sourceCodeSha256']==source and preserved_contract['baselineSourceCodeSha256']==baseline_source
assert set(preserved_contract['preservedPrintIds'])==prints-allowed_changed_existing
generated=preserved['generatedArtifact']
archive_sources=[(Path(generated['archiveFile']),generated['sha256']),(Path(generated['manifestArchiveFile']),preservation['generatedManifestSha256'])]
archive_folder=Path(generated['archiveFile']).parent
for label,sha in native_identity['exportedBrepSha256'].items():
    archive_sources.append((archive_folder/(preserved['id']+'.'+label+'.brep'),sha))
for original,sha in archive_sources:
    evidence=output/original.name if(output/original.name).exists()else original
    assert hashlib.sha256(evidence.read_bytes()).hexdigest()==sha,(original.name,'mesh preservation evidence changed')
    if evidence!=output/original.name:shutil.copyfile(evidence,output/original.name)
    preservation_evidence.append(original.name)
generated_manifest=read(Path(generated['manifestArchiveFile']).name)
generated_row=next(row for row in generated_manifest if row['id']==preserved['id'])
assert generated_row['sourceCodeSha256']==source and generated_row['sha256']==generated['sha256']
original=Path(generated['rowArchiveFile'])
row_evidence=output/original.name if(output/original.name).exists()else original
assert json.loads(row_evidence.read_text())==generated_row
if row_evidence!=output/original.name:shutil.copyfile(row_evidence,output/original.name)
preservation_evidence.append(original.name)
native=read('case-panel-native-preview-provenance.json')
assert native['sourceCodeSha256']==source
assert native['workingPanelFit']==components['caseEnvelope']['workingPanelFit']
assert native['sourceFcstd']=='servo-toggle-case-panel.FCStd'
assert native['sourceFcstdSha256']==digest(native['sourceFcstd'])
for item in native['images']:
    assert item['sha256']==digest(item['file'])
    assert item['rawSha256']==digest(item['rawFile'])
assert native['fullCaseFitVerified']is False
metadata_file='case-panel-inspection-provenance.json'
metadata=read(metadata_file)
assert Path(metadata['file']).name==metadata['file']=='case-panel-inspection.glb'
assert metadata['sha256']==digest(metadata['file'])
assert (output/metadata['file']).read_bytes().startswith(b'glTF'),'incorrect GLB container'
assert metadata['sourceCodeSha256']==source
assert metadata['workingPanelFit']==components['caseEnvelope']['workingPanelFit']
assert metadata['fullCaseFitVerified']is False
assert metadata['sourceFcstd']==native['sourceFcstd']
assert metadata['sourceFcstdSha256']==native['sourceFcstdSha256']
assert metadata['coordinateSystem']=='operator XYZ, Z-up'
assert metadata['numericLengthUnit']=='mm'and metadata['scaleToMillimetres']==1
assert metadata['gltfExportYUp']is False
assert metadata['componentCount']==len(records)
assert set(metadata['componentParentNames'])=={r['id']for r in records}
for proof in [metadata,native]:
    for key,expected in [('operatorLayout',components['layout']),('caseEnvelope',case_fit),('batteryPockets',components['mechanicalStructure']['batteryPockets']),('brassSupports',components['mechanicalStructure']['brassSupports']),('pwmSupport',components['mechanicalStructure']['pwmSupport']),('lowerSplit',components['mechanicalStructure']['lowerSplit']),('fourPostCapture',components['mechanicalStructure']['fourPostCapture']),('panelBearingApron',components['mechanicalStructure']['panelBearingApron']),('modularElectronics',modular),('printFamilies',families),('connectorMounting',components['connectorMounting']),('optionalTieLanes',components['electronicsRetention']['optionalTieLanes'])]:
        assert proof[key]==expected,(key,'stale inspection metadata')
assets=[metadata['file'],metadata_file]
optional=[]
slicer_reports=[]
for comparison_file,profile_prefix in [('native-slicer-comparison.json','reference-slicer-'),('native-slicer-normal-support-comparison.json','reference-slicer-normal-support-'),('native-slicer-arachne-tree-comparison.json','reference-slicer-arachne-tree-')]:
    slicer=output/comparison_file
    if not slicer.exists():continue
    comparison=read(comparison_file)
    slicer_reports.append((comparison_file,comparison))
    assert comparison['sourceCodeSha256']==source,'stale slicer comparison'
    assert comparison['baselineSourceCodeSha256']==baseline_source
    current=[r for r in comparison['parts']if r['revision']=='current']
    baseline=[r for r in comparison['parts']if r['revision']=='baseline']
    assert len(current)==len(core_prints)and {r['id']for r in current}==core_prints
    assert len(baseline)==len(baseline_core)and {r['id']for r in baseline}==baseline_core
    assert set(comparison['currentPartIds'])==core_prints and set(comparison['baselinePartIds'])==baseline_core
    for row in current:
        assert Path(row['stlFile']).name==row['id']+'.stl' and row['stlSha256']==digest(Path(row['stlFile']).name), 'slicer input differs from shipped mesh'
    for row in baseline:
        assert row['stlSha256']==baseline_meshes[row['id']]['sha256'],'slicer baseline differs from delivered627 mesh'
    for role in ['machine','process','filament']:
        profile=profile_prefix+role+'.json'
        assert digest(profile)==comparison['slicer']['profileSha256'][role], 'reference slicer profile checksum differs'
        optional.append(profile)
    optional.append(slicer.name)
if slicer_reports:
    primary=next(report for name,report in slicer_reports if name=='native-slicer-comparison.json')
    assert all(primary['currentTotals']['estimatedSeconds']<=report['currentTotals']['estimatedSeconds']+.01 for _,report in slicer_reports),'primary reference process is not the fastest measured core-assembly process'
for support_file,matched_file in [('native-support-comparison.json','native-slicer-normal-support-comparison.json'),('native-support-arachne-tree-comparison.json','native-slicer-arachne-tree-comparison.json')]:
    if (output/support_file).exists():
        support=read(support_file)
        assert support['sourceCodeSha256']==source,'stale support comparison'
        assert support['baselineSourceCodeSha256']==baseline_source
        current=[r for r in support['parts']if r['revision']=='current']
        baseline=[r for r in support['parts']if r['revision']=='baseline']
        assert len(current)==len(prints)and {r['id']for r in current}==prints
        assert len(baseline)==len(baseline_prints)and {r['id']for r in baseline}==baseline_prints
        assert set(support['currentPrintIds'])==prints and set(support['baselinePrintIds'])==baseline_prints
        for row in current:
            assert row['stlSha256']==digest(row['id']+'.stl'),'support comparison differs from shipped mesh'
        for row in baseline:
            assert row['stlSha256']==baseline_meshes[row['id']]['sha256'],'support baseline differs from delivered627 mesh'
        for revision,rows_to_sum in [('current',current),('baseline',baseline)]:
            for key in ['supportFilamentGrams','totalFilamentGrams','totalEstimatedSeconds']:
                assert all(r[key]>=0 for r in rows_to_sum)
                assert abs(sum(r[key]for r in rows_to_sum)-support[revision+'Totals'][key])<.001
        normal=next(report for name,report in slicer_reports if name==matched_file)
        assert support['baselineSourceCodeSha256']==normal['baselineSourceCodeSha256']
        assert support['slicer']['profileSha256']==normal['slicer']['profileSha256']
        optional.append(support_file)
recommended_file='native-support-recommended-comparison.json'
if (output/recommended_file).exists():
    recommendation=read(recommended_file)
    assert recommendation['sourceCodeSha256']==source
    processes={'normal':read('native-support-comparison.json'),'arachne-tree':read('native-support-arachne-tree-comparison.json')}
    assert recommendation['baselineSourceCodeSha256']==processes['normal']['baselineSourceCodeSha256']
    assert recommendation['profileSets']=={key:value['slicer']['profileSha256']for key,value in processes.items()}
    for revision in ['baseline','current']:
        rr=[r for r in recommendation['parts']if r['revision']==revision]
        expected=prints if revision=='current'else baseline_prints
        assert len(rr)==len(expected)and {r['id']for r in rr}==expected
        for row in rr:
            process=row['process']
            assert process in processes and (revision=='current'or process=='normal')
            assert row['profileSha256']==recommendation['profileSets'][process]
            reference=next(r for r in processes[process]['parts']if r['revision']==revision and r['id']==row['id'])
            assert row['stlSha256']==reference['stlSha256']
            for key in ['supportFilamentGrams','totalFilamentGrams','totalEstimatedSeconds']:
                assert abs(row[key]-reference[key])<.000001
        for key in ['supportFilamentGrams','totalFilamentGrams','totalEstimatedSeconds']:
            assert abs(sum(r[key]for r in rr)-recommendation[revision+'Totals'][key])<.001
    optional.append(recommended_file)
images=list(dict.fromkeys(name for item in native['images']for name in[item['file'],item['rawFile']]))
assert len(native['images'])==10 and len(images)==20
assert all(Path(name).name==name for name in images)
assert {'case-panel-preview.png','case-panel-side-preview.png','case-panel-underside-preview.png','case-panel-upper-cassette-preview.png','case-panel-lower-body-preview.png','case-panel-wall-mount-preview.png','case-panel-xt60-preview.png','case-panel-split-preview.png','case-panel-module-adapters-preview.png','case-panel-seat-ring-preview.png'}<={item['file']for item in native['images']}
for name in images:assert (output/name).read_bytes().startswith(b'\x89PNG\r\n\x1a\n'),(name,'incorrect image container')
preview={'sourceCodeSha256':source,'sourceFcstdSha256':native['sourceFcstdSha256'],'previewBasis':'Source-bound native CAD renders and inspection GLB; browser display was not observed.','nativeCadViewsVerified':10,'browserDisplayObserved':False,'fullCaseFitVerified':False,'workingPanelFit':components['caseEnvelope']['workingPanelFit'],'nativeProvenanceSha256':digest('case-panel-native-preview-provenance.json'),'inspectionMetadataSha256':digest(metadata_file),'glbSha256':metadata['sha256']}
(output/'native-preview-validation.json').write_text(json.dumps(preview,indent=2)+'\n')
# Only superseded generated proof files are removed; the previous release is backed up.
for obsolete in ['native-motion-revision-proof.json','native-motion-baseline.json','native-motion-baseline.log','native-motion-baseline-progress.jsonl','native-motion-baseline-test.ts','native-motion-baseline-input.json','native-panel-resize-validation.json','case-electronics-quiet-keeper.stl']:
    (output/obsolete).unlink(missing_ok=True)
shutil.copyfile(root/'src/parts/servo-toggle-actuator/GUIDE.md',output/'GUIDE.md')
names=['case-panel-source.FCMacro','servo-toggle-case-panel.FCStd','servo-toggle-case-panel.step','case-panel-operator-layout.svg','case-panel-underside-layout.svg','case-side-clearance.svg','case-wall-mount-layout.svg','case-electronics-grid-layout.svg','case-seat-ring-mount-layout.svg','PRINT-KIT-README.txt','ASSEMBLY-UA.txt','GUIDE.md','case-panel-manufacturing.json','print-mesh-validation.json','native-validation-fixtures.json',*[r['file']for r in fixture_rows],*preservation_scripts,*preservation_evidence,*reports,*optional,*images,*assets,'case-panel-native-preview-provenance.json','native-preview-validation.json',*[row['file']for row in rows]]
assert len(names)==len(set(names))
archive=output/'servo-toggle-case-panel-print-kit.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as kit:
    for name in names:kit.write(output/name,name)
with zipfile.ZipFile(archive)as kit:
    assert set(kit.namelist())==set(names)
    for name in names:assert kit.read(name)==(output/name).read_bytes(),name
print(json.dumps({'sourceCodeSha256':source,'components':len(records),'prints':len(prints),'entries':len(names),'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
