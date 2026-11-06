"""Check light web-control poses against already validated assembly BReps.

This reconstructs the two moving prints, the stock switch and the three-piece
metal friction clamp. Full assemblies are reconstructed independently by
verify-handheld-lora-controller.py.
"""
from datetime import datetime, timezone
import builtins
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import traceback

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
from freecad_tree import component_leaves

output=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/handheld-lora-body-models')
cases=[case for case in json.loads((output/'cases.json').read_text()) if case['parameters']['bodyModel']=='web-grip']
if os.environ.get('HANDHELD_WEB_PRESET_ID'):
    cases=[case for case in cases if case['presetId']==os.environ['HANDHELD_WEB_PRESET_ID']]
    assert len(cases)==1,'Requested web preset is not present exactly once'
assembly_report=output/os.environ.get('HANDHELD_ASSEMBLY_REPORT','validation.json')
report_file=output/os.environ.get('HANDHELD_WEB_REPORT_FILE','web-mechanism-validation.json')
report={'checkedAt':datetime.now(timezone.utc).isoformat(),'validatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'scope':'Moving prints, purchased switch and canonical metal-clamp reconstruction against matching saved assemblies; finite native material sections, continuous conservative slider assembly sweep and sampled operating poses. No friction force, load capacity, wear life or electrical lockout qualification.','cases':[],'passed':False}


def volume(shape):
    return 0 if shape.isNull() else shape.Volume


class HostCache:
    """Reuse exact local host BReps without changing any intersection set.

    A query Q strictly inside a box C satisfies Q intersect H = Q intersect
    (H intersect C). The integer cells and their padding affect cache reuse
    only; they never alter Q or the CAD. Unresolved crops and intersections
    use the original complete operands.
    """
    def __init__(self):
        self.hosts={}
        self.stats={'builds':0,'hits':0,'fallbacks':0,'direct':0,'cachedQueries':0,'cropFaces':[]}

    def register(self,shape,label):
        if len(shape.Faces)>=500:
            self.hosts[builtins.id(shape)]={'shape':shape,'label':label,'faces':len(shape.Faces),'regions':{}}

    def overlap(self,a,b):
        if not a.optimalBoundingBox(False,True).intersect(b.optimalBoundingBox(False,True)):
            return 0
        candidates=[(host,query) for host,query in [(a,b),(b,a)] if builtins.id(host) in self.hosts and self.hosts[builtins.id(host)]['shape'] is host]
        if not candidates:
            self.stats['direct']+=1
            return volume(a.common(b))
        host,query=max(candidates,key=lambda pair:self.hosts[builtins.id(pair[0])]['faces'])
        entry=self.hosts[builtins.id(host)]
        q=query.optimalBoundingBox(False,True)
        low=[math.floor(getattr(q,axis+'Min')/8)*8-1 for axis in ['X','Y','Z']]
        high=[math.ceil(getattr(q,axis+'Max')/8)*8+1 for axis in ['X','Y','Z']]
        assert all(math.isfinite(v) for v in low+high)
        assert all(getattr(q,axis+'Min')>lo and getattr(q,axis+'Max')<hi for axis,lo,hi in zip(['X','Y','Z'],low,high)),'Host cache does not strictly contain the complete query'
        key=tuple(low+high)
        if key not in entry['regions']:
            self.stats['builds']+=1
            try:
                region=Part.makeBox(*[b-a for a,b in zip(low,high)],App.Vector(*low))
                subset=host.common(region)
                if subset.isNull() or not subset.isValid() or (subset.Solids and (not subset.isClosed() or any(solid.Volume<=0 for solid in subset.Solids))) or (not subset.Solids and volume(subset)!=0):
                    raise ValueError('Unresolved native crop')
                entry['regions'][key]=subset
                self.stats['cropFaces'].append({'host':entry['label'],'full':entry['faces'],'cropped':len(subset.Faces)})
            except Exception:
                entry['regions'][key]=None
        else:
            self.stats['hits']+=1
        subset=entry['regions'][key]
        if subset is not None:
            try:
                result=subset.common(query)
                if not result.isNull() and not result.isValid():
                    raise ValueError('Unresolved native cropped intersection')
                self.stats['cachedQueries']+=1
                return volume(result)
            except Exception:
                pass
        self.stats['fallbacks']+=1
        return volume(a.common(b))


intersection_cache=None


def overlap(a,b):
    if intersection_cache is not None:
        return intersection_cache.overlap(a,b)
    if not a.optimalBoundingBox(False,True).intersect(b.optimalBoundingBox(False,True)):
        return 0
    return volume(a.common(b))


def valid(shape,label,one=True):
    assert not shape.isNull() and shape.isValid() and shape.isClosed() and shape.Volume>0,(label,'invalid moving native geometry')
    assert not one or len(shape.Solids)==1,(label,'disconnected moving print',len(shape.Solids))


def code_shape(code,stock=False,one=True):
    scope={'App':App,'Part':Part,'math':math}
    exec(code,scope)
    shape=scope['components'][0] if stock else scope['shape']
    valid(shape,'Generated moving component',one and not stock)
    return shape


def material_span(shape,probe,axis,label,minimum):
    """Measure a contiguous native section, rather than trusting design metadata.

    The volume/area result measures the native section's equivalent thickness.
    In addition, a centered rectangle of the required minimum thickness must be
    wholly filled. This allows the real rounded/sloping outer boundary without
    allowing separated islands or an oblique sliver to satisfy the requirement.
    """
    section=shape.common(probe)
    valid(section,label)
    bounds=section.optimalBoundingBox(False,False)
    probe_bounds=probe.optimalBoundingBox(False,False)
    area=probe.Volume/getattr(probe_bounds,axis+'Length')
    length=section.Volume/area
    sizes=[getattr(probe_bounds,a+'Length') for a in ['X','Y','Z']]
    origin=[getattr(probe_bounds,a+'Min') for a in ['X','Y','Z']]
    index=['X','Y','Z'].index(axis)
    sizes[index]=minimum-2e-6
    origin[index]=(getattr(bounds,axis+'Min')+getattr(bounds,axis+'Max'))/2-sizes[index]/2
    witness=Part.makeBox(*sizes,App.Vector(*origin))
    missing=max(0,witness.Volume-overlap(witness,shape))
    assert missing<max(1e-7,witness.Volume*1e-4),(label,'Minimum native section is interrupted or underfilled',minimum,missing)
    return length


def axial_section(shape,x,y,z0,z1,label,minimum):
    return material_span(shape,Part.makeBox(.06,.06,z1-z0,App.Vector(x-.03,y-.03,z0)),'Z',f'{label} at ({x}, {y})',minimum)


def strengthened_sections(slider,paddle,host):
    """Measure the actual broad load paths, including the former weak flange.

    Required dimensions are independent acceptance limits. They are deliberately
    not read from descriptive design metadata, and a filled finite native witness
    must support every measured section.
    """
    gate=[]
    for x in [-4,0,4]:
        for y in [-10.5,-8.8,-7.1]:
            thickness=axial_section(slider,x,y,0,9,'Solid sliding gate',3)
            assert thickness>=3-1e-5,('Sliding gate has a thin native section',x,y,thickness)
            gate.append({'localXY':[x,y],'thicknessMm':thickness})
    heels=[]
    for x in [-4,0,4]:
        thickness=axial_section(paddle,x,-8.5,0,12,'Broad paddle heel',3)
        assert thickness>=3-1e-5,('Paddle heel has a thin native section',x,thickness)
        heels.append({'localXY':[x,-8.5],'thicknessMm':thickness})
    flange=[]
    for x in [-6,6]:
        for y in [-3,0,3]:
            thickness=axial_section(paddle,x,y,0,12,'Captive paddle flange',3)
            assert thickness>=3-1e-5,('Paddle retaining flange is too thin',x,y,thickness)
            flange.append({'localXY':[x,y],'thicknessMm':thickness})
    webs=[]
    for sign in [-1,1]:
        for y in [-21,-18.5,-16]:
            probe=Part.makeBox(8,.06,.06,App.Vector(-12 if sign<0 else 4,y-.03,8-.03))
            width=material_span(slider,probe,'X','Solid slider side web',2.4)
            assert width>=2.4-1e-5,('Slider side web is too thin',sign,y,width)
            webs.append({'side':sign,'localY':y,'widthMm':width})
    thumb=[]
    for x in [-6.5,3.7]:
        for y in [-21,-18.5,-16]:
            thickness=axial_section(slider,x,y,8,15,'Supported thumb pad',2.4)
            assert thickness>=2.4-1e-5,('Slider thumb pad is too thin',x,y,thickness)
            thumb.append({'localXY':[x,y],'thicknessMm':thickness})
    rails=[]
    for x in [-5.5,2.7]:
        for y in [-25,-22.7,-20]:
            thickness=axial_section(host,x,y,6.6,9.2,'Fixed full-depth clamp rail',2.4)
            assert thickness>=2.4-1e-5,('Fixed clamp rail is too thin',x,y,thickness)
            rails.append({'localXY':[x,y],'thicknessMm':thickness})
    ceilings=[]
    for x in [-3.8,1]:
        thickness=axial_section(slider,x,-18.5,3.6,6.8,'Solid nut-pocket ceiling',3)
        assert thickness>=3-1e-5,('Nut pocket ceiling is too thin',x,thickness)
        ceilings.append({'localXY':[x,-18.5],'thicknessMm':thickness})
    capture=[]
    for x in [-6.2,6.2]:
        thickness=axial_section(host,x,0,8.8,13,'Full-depth paddle capture lip',3)
        assert thickness>=3-1e-5,('Paddle capture lip is too thin',x,thickness)
        capture.append({'localXY':[x,0],'thicknessMm':thickness})
    rear=[]
    for x in [-3.5,3.5]:
        for y in [-30,-24,-17]:
            thickness=axial_section(host,x,y,-3.25,-.55,'Closed rear track wall',2.4)
            assert thickness>=2.4-1e-5,('Rear track wall is too thin',x,y,thickness)
            rear.append({'localXY':[x,y],'thicknessMm':thickness})
    nose=[]
    for x in [-4,0,4]:
        thickness=axial_section(slider,x,-4.76,0,9,'Broad relocking cam nose',2.4)
        assert thickness>=2.4-1e-5,('Relocking cam has a thin native section',x,thickness)
        nose.append({'localXY':[x,-4.76],'thicknessMm':thickness})
    return {'solidGateSections':gate,'paddleHeelSections':heels,'paddleCaptureFlangeSections':flange,'sliderSideWebSections':webs,'supportedThumbPadSections':thumb,'fixedClampRailSections':rails,'nutPocketCeilingSections':ceilings,'paddleCaptureLipSections':capture,'closedRearTrackWallSections':rear,'solidRelockCamSections':nose}


def rounded_sweep(width,length,radius,back,depth,x,y):
    """A native rounded extrusion containing the authored polygonal perimeter."""
    shapes=[
        Part.makeBox(width-2*radius,length,depth,App.Vector(x-width/2+radius,y-length/2,back)),
        Part.makeBox(width,length-2*radius,depth,App.Vector(x-width/2,y-length/2+radius,back)),
    ]
    for sx in [-1,1]:
        for sy in [-1,1]:
            shapes.append(Part.makeCylinder(radius,depth,App.Vector(x+sx*(width/2-radius),y+sy*(length/2-radius),back)))
    return shapes[0].multiFuse(shapes[1:]).removeSplitter()


def slider_threading_envelope(distance=28,end_travel=8.4):
    """Conservative continuous sweep; the rail's C-shaped clearance stays open.

    Extending each convex extrusion along Y is its exact translational sweep.
    Filling the nut pocket, holes and shallow thumb grooves enlarges that sweep;
    proving the enlarged volume clear cannot miss a collision between samples.
    """
    y=-18.5-end_travel-distance/2
    shapes=[
        rounded_sweep(16,12.8+distance,1.6,-.4,7.1,-1.4,y),
        rounded_sweep(16,12.8+distance,1.6,9.35,2.5,-1.4,y),
        Part.makeBox(12.4,7.5+distance,3,App.Vector(-6.2,-12.2-end_travel-distance,2.6)),
        Part.makeBox(12.4,6.2+distance,3,App.Vector(-6.9,-12.5-end_travel-distance-3.1,2.6)),
    ]
    for x in [-8.1,5.3]:
        shapes.append(Part.makeBox(2.4,12.8+distance,5.65,App.Vector(x-1.2,y-(12.8+distance)/2,6.2)))
    result=shapes[0].multiFuse(shapes[1:]).removeSplitter()
    valid(result,'Continuous slider-and-nut threading envelope')
    return result


for case in cases:
    assembly_hash=case.get('assemblyCodeSHA256')
    if 'script' in case:
        actual_hash=hashlib.sha256(case['script'].encode()).hexdigest()
        assert assembly_hash is None or assembly_hash==actual_hash,'Supplied assembly hash differs from its generator'
        assembly_hash=actual_hash
    assert isinstance(assembly_hash,str) and len(assembly_hash)==64 and all(c in '0123456789abcdef' for c in assembly_hash),'Missing or invalid assembly generator hash'
    row={'presetId':case['presetId'],'name':case['name'],'passed':False,'assemblyCodeSHA256':assembly_hash}
    doc=None
    try:
        intersection_cache=HostCache()
        path=output/case.get('savedAssemblyFile',case['name']+'.FCStd')
        if not path.exists() and os.environ.get('HANDHELD_ALLOW_PREFLIGHT_SNAPSHOT'):
            path=output/(case['name']+'-physical-fit.FCStd')
            row['preflightSnapshotOnly']=True
        assembly_fcstd_sha=hashlib.sha256(path.read_bytes()).hexdigest()
        row.update(assemblyFCStdSHA256=assembly_fcstd_sha,nativeAssemblyFCStdFile=str(path.relative_to(output)))
        if not row.get('preflightSnapshotOnly'):
            audit_bytes=assembly_report.read_bytes()
            assembly_audit=json.loads(audit_bytes)
            saved=next(item for item in assembly_audit['cases'] if item['name']==case['name'])
            assert saved['passed'] and saved['codeSHA256']==row['assemblyCodeSHA256'],'Assembly has no matching passed native reconstruction'
            assert saved['fcstdSHA256']==assembly_fcstd_sha,'Saved native assembly differs from the validated file'
            native_validator_sha=hashlib.sha256(Path(__file__).with_name('verify-handheld-lora-controller.py').read_bytes()).hexdigest()
            assert assembly_audit['validatorSHA256']==native_validator_sha,'Saved native assembly was audited by a different validator source'
            row.update(nativeAssemblyAuditSHA256=hashlib.sha256(audit_bytes).hexdigest(),nativeAssemblyValidatorSHA256=native_validator_sha,nativeAssemblyAuditFile=str(assembly_report.relative_to(output)))
        doc=App.openDocument(str(path))
        roots=[obj for obj in doc.RootObjects if obj.TypeId=='App::Part']
        assert len(roots)==1
        root=roots[0]
        assert json.loads(root.Configuration)==case['parameters'],'Saved assembly configuration differs from motion fixtures'
        children = component_leaves(root)
        assert len(children)==len(case['components']),'Saved assembly component count differs from the fixtures'
        parts={expected['id']:child.Shape for child,expected in zip(children,case['components'])}
        m=case['webMotion']
        d=m['layout']
        assert d['slider']['axis'] in [[0,-1,0],[0,1,0]],'Unsupported selector axis'
        mirror_y=d['slider']['axis'][1]>0
        canonical_direction=d['slider']['axis'][1]*(-1 if mirror_y else 1)
        clamp_x=d['clamp']['localX']
        clamp_y=d['clamp']['localY']*(-1 if mirror_y else 1)
        assert canonical_direction==-1,'Selector axis was not normalized consistently'
        row['auditCoordinateNormalization']={'worldFrame':d['frame'],'localYMirrored':mirror_y,'canonicalTravelDirectionY':canonical_direction,'canonicalClampCenterXY':[clamp_x,clamp_y],'reason':'Use a canonical negative-Y loading side while preserving the actual geometry and all section limits'}
        rx,ry,rz=d['frame']['rotation']
        rotation=App.Rotation(App.Vector(0,0,1),rz).multiply(App.Rotation(App.Vector(0,1,0),ry)).multiply(App.Rotation(App.Vector(1,0,0),rx))
        frame=App.Placement(App.Vector(*d['frame']['origin']),rotation)
        def local(shape):
            shape=shape.copy()
            shape.transformShape(frame.inverse().toMatrix())
            if mirror_y:
                original_volume=shape.Volume
                original_solids=len(shape.Solids)
                shape=shape.mirror(App.Vector(0,0,0),App.Vector(0,1,0))
                valid(shape,'Audit coordinate reflection',False)
                assert abs(shape.Volume-original_volume)<max(1e-7,original_volume*1e-9) and len(shape.Solids)==original_solids,'Audit reflection changed native material'
            return shape
        local_parts={id:local(shape) for id,shape in parts.items()}
        base,lid=local_parts['base'],local_parts['lid']
        # Cropping only removes distant case faces; all moving parts remain inside this box.
        crop=Part.makeBox(22,60,25,App.Vector(-11,-40,-10))
        host=Part.makeCompound([base.common(crop),lid.common(crop)])
        assert host.isValid() and host.isClosed(),'Local housing crop is invalid'
        for label,shape in [('base',base),('lid',lid),('local housing',host)]:
            intersection_cache.register(shape,label)
        assert d['mechanism']=='captive-linear-friction-clamp','The fixtures describe a different mechanism'
        slider_data={(item['travel'],item['normalOffset']):item for item in m['sliders']}
        sliders={key:local(code_shape(item['code'])) for key,item in slider_data.items()}
        plungers={item['stroke']:local(code_shape(item['code'])) for item in m['plungers']}
        stocks={item['position']:local(code_shape(item['code'],True)) for item in m['stocks']}
        clamp=local(code_shape(m['clamp']['code'],one=False))
        clamp_ids=m['clamp']['ids']
        assert set(clamp_ids)=={'clamp-screw','clamp-washer','clamp-nut'}
        actual_clamp=Part.makeCompound([local(parts[id]) for id in clamp_ids])
        assert abs(clamp.Volume-actual_clamp.Volume)<1e-4 and clamp.Volume-overlap(clamp,actual_clamp)<1e-4,'Clamp fixture differs from the canonical saved hardware'
        for id,shape in [('web-slider',sliders[(0,0)]),('web-plunger',plungers[0]),('button-a',stocks['first'])]:
            actual=local(parts[id])
            assert abs(shape.Volume-actual.Volume)<1e-4 and shape.Volume-overlap(shape,actual)<1e-4,(id,'Pose fixture differs from saved assembly')
        sections=strengthened_sections(sliders[(0,0)],plungers[0],host)
        # The complete fixed rail must grow from the base. A lid-owned half
        # would collide with the closed slider loop during vertical closure.
        rail_root=Part.makeBox(4,.3,2.4,App.Vector(-6.3,-11.9,6.7))
        root_missing=max(0,rail_root.Volume-overlap(rail_root,base))
        assert root_missing<1e-5,('Fixed rail has no substantial base-owned root',root_missing)
        root_sections=[]
        for y in [-5,-8,-10.5]:
            width=material_span(base,Part.makeBox(11,.06,.06,App.Vector(-14,y-.03,7.97)),'X','Base-owned rail root sidewall',2.4)
            assert width>=2.4-1e-5,('Fixed rail root sidewall is too thin',y,width)
            root_sections.append({'localY':y,'continuousWidthMm':width})
        base_rail_sections=[]
        for x in [-5.5,2.7]:
            for y in [-25,-22.7,-20]:
                thickness=axial_section(base,x,y,6.6,9.2,'Base-owned full-depth clamp rail',2.4)
                assert thickness>=2.4-1e-5,('Fixed rail depends on lid material',x,y,thickness)
                base_rail_sections.append({'localXY':[x,y],'thicknessMm':thickness})
        sections['baseOwnedRailRoot']={'minimumFilledRootDimensionsMm':[4,.3,2.4],'missingMaterialMm3':root_missing,'sidewallSections':root_sections,'baseOnlyRailSections':base_rail_sections}
        def shifted(shape,x=0,y=0,w=0):
            result=shape.copy()
            result.translate(App.Vector(x,y,w))
            return result
        def at_travel(shape,travel,normal_offset=0):
            return shifted(shape,y=canonical_direction*travel,w=normal_offset)
        unlocked=8.4
        full_stroke=1.5
        take_up=.5
        assert d['paddle']['stroke']==full_stroke and d['paddle']['takeUp']==take_up,'Unexpected button travel or take-up'
        assert d['slider']['unlockedTravel']==unlocked and d['slider']['lockedTravel']==0,'Unexpected operating selector travel'
        released=plungers[0]
        unlocked_slider=sliders[(unlocked,0)]
        unlocked_clamp=at_travel(clamp,unlocked)
        crop_bounds=crop.optimalBoundingBox(False,False)
        moving_crop_margins=[]
        def check_moving_crop(label,shape):
            bounds=shape.optimalBoundingBox(False,True)
            margin=min(getattr(bounds,axis+'Min')-getattr(crop_bounds,axis+'Min') for axis in ['X','Y','Z'])
            margin=min(margin,*[getattr(crop_bounds,axis+'Max')-getattr(bounds,axis+'Max') for axis in ['X','Y','Z']])
            assert margin>=.5,('Host crop could omit an obstruction at a moving pose or capture probe',label,margin)
            moving_crop_margins.append({'fixture':label,'minimumBoundaryMarginMm':margin})
        for label,shape in [(f'slider {key}',shape) for key,shape in sliders.items()]+[(f'paddle {key}',shape) for key,shape in plungers.items()]+[('locked clamp',clamp),('unlocked clamp',unlocked_clamp)]:
            check_moving_crop(label,shape)
        row['localHostCrop']={'minMm':[-11,-40,-10],'maxMm':[11,20,15],'movingPoseMargins':moving_crop_margins,'captureProbeMaximumOffsetMm':.4,'assemblyInsertionUsesFullBase':True}
        actuator_candidates=[solid for solid in stocks['first'].Solids if abs(solid.optimalBoundingBox(False,False).XLength-9)<.03 and abs(solid.optimalBoundingBox(False,False).YLength-9)<.03 and abs(solid.optimalBoundingBox(False,False).ZMax-d['stock']['releasedCapW'])<.03]
        assert len(actuator_candidates)==1,'Cannot identify actual canonical green actuator'
        released_actuator=actuator_candidates[0]
        static_stock=[solid for solid in stocks['first'].Solids if solid.hashCode()!=released_actuator.hashCode()]
        strokes=[]
        for stroke,plunger in plungers.items():
            actuator=released_actuator.copy()
            switch_travel=max(0,stroke-d['paddle']['takeUp'])
            actuator.translate(App.Vector(0,0,-switch_travel))
            stock=Part.makeCompound(static_stock+[actuator])
            if abs(switch_travel-1)<1e-6:
                assert abs(stock.Volume-stocks['last'].Volume)<1e-5 and stock.Volume-overlap(stock,stocks['last'])<1e-5,'Computed actuator travel differs from the canonical pressed switch'
            interference={'housing':overlap(plunger,host),'unlockedSlider':overlap(plunger,unlocked_slider),'switch':overlap(plunger,stock),'clampHardware':overlap(plunger,unlocked_clamp)}
            assert max(interference.values())<1e-5,('Unlocked travel is obstructed',stroke,interference)
            gap=plunger.distToShape(actuator)[0]
            expected_gap=max(0,d['paddle']['takeUp']-stroke)
            assert abs(gap-expected_gap)<.015,('Plunger loses the intended take-up/contact relationship',stroke,gap,expected_gap)
            strokes.append({'strokeMm':stroke,'switchInspectionTravelMm':switch_travel,'actuatorGapMm':gap,'interferencesMm3':interference})
        assert abs(max(item['switchInspectionTravelMm'] for item in strokes)-1)<.01,'Full unlocked press does not reach the modeled stock inspection travel'
        sweeps=[]
        for (travel,normal_offset),slider in sliders.items():
            if normal_offset!=0 or not 0<=travel<=unlocked:
                continue
            moving_clamp=at_travel(clamp,travel)
            interference={'housing':overlap(slider,host),'releasedPlunger':overlap(slider,released),'stock':overlap(slider,stocks['first']),'clampInSlider':overlap(moving_clamp,slider),'clampInHousing':overlap(moving_clamp,host),'clampInPlunger':overlap(moving_clamp,released),'clampInSwitch':overlap(moving_clamp,stocks['first'])}
            assert max(interference.values())<1e-5,('Selector cannot slide through its full operating range',travel,interference)
            sweeps.append({'travelMm':travel,'interferencesMm3':interference})
        assert len(sweeps)==22
        bearing_float=[]
        for normal_offset in [-.1,0]:
            slider=sliders[(unlocked,normal_offset)]
            moving_nut=at_travel(local_parts['clamp-nut'],unlocked,normal_offset)
            backed_screw=at_travel(local_parts['clamp-screw'],unlocked,-normal_offset)
            seated_washer=at_travel(local_parts['clamp-washer'],unlocked)
            loose_clamp=Part.makeCompound([moving_nut,backed_screw,seated_washer])
            check_moving_crop(f'loosened clamp {normal_offset}',loose_clamp)
            interference={'housing':overlap(slider,host),'pressedPlunger':overlap(slider,plungers[full_stroke]),'loosenedClampInSlider':overlap(loose_clamp,slider),'loosenedClampInHousing':overlap(loose_clamp,host),'loosenedClampInPlunger':overlap(loose_clamp,plungers[full_stroke])}
            assert max(interference.values())<1e-5,('Unlocked guide clearance blocks the full press',normal_offset,interference)
            bearing_float.append({'sliderNormalOffsetMm':normal_offset,'interferencesMm3':interference})
        relocking=[]
        for normal_offset in [0,-.1]:
            poses=sorted([item for item in m['relock'] if item['normalOffset']==normal_offset],key=lambda item:item['travel'],reverse=True)
            assert len(poses)>=35 and poses[0]['travel']==unlocked and poses[-1]['travel']==0,'Relocking path omits the operating endpoints or dense cam samples'
            previous_stroke=take_up
            for pose in poses:
                plunger=local(code_shape(pose['plungerCode']))
                slider=local(code_shape(pose['sliderCode']))
                check_moving_crop(f'relock paddle {pose["travel"]}, {normal_offset}',plunger)
                check_moving_crop(f'relock slider {pose["travel"]}, {normal_offset}',slider)
                interference={'paddleInHousing':overlap(plunger,host),'sliderInHousing':overlap(slider,host),'camInPaddle':overlap(slider,plunger),'paddleInReleasedSwitch':overlap(plunger,stocks['first']),'sliderInReleasedSwitch':overlap(slider,stocks['first'])}
                assert max(interference.values())<1e-5,('The safety cannot relock after stock-spring return',pose['travel'],normal_offset,interference)
                assert pose['stroke']<=previous_stroke+1e-6,'The relocking cam pushes the paddle toward the actuator'
                previous_stroke=pose['stroke']
                actuator_gap=plunger.distToShape(released_actuator)[0]
                assert actuator_gap>=.004,('Relocking presses the stock actuator',pose['travel'],normal_offset,actuator_gap)
                cam_gap=plunger.distToShape(slider)[0]
                if pose['stroke']<take_up-.01:
                    assert cam_gap<=.015,('The claimed cam path does not contact the paddle',pose['travel'],normal_offset,cam_gap)
                if pose['travel']==0:
                    assert actuator_gap>=(.345 if normal_offset==0 else .245),'Relocked paddle has insufficient actuator separation'
                relocking.append({'travelMm':pose['travel'],'sliderNormalOffsetMm':normal_offset,'paddleStrokeMm':pose['stroke'],'releasedActuatorGapMm':actuator_gap,'camGapMm':cam_gap,'interferencesMm3':interference})
        stops=[]
        for travel in [-.4,8.8]:
            blocked=overlap(sliders[(travel,0)],host)
            assert blocked>.01,('Slider has no positive end stop',travel,blocked)
            stops.append({'travelMm':travel,'obstructionMm3':blocked})
        locked=[]
        for normal_offset in [-.1,0]:
            slider=sliders[(0,normal_offset)]
            assert overlap(slider,host)<1e-5 and overlap(slider,released)<1e-5,'Inward slider clearance is obstructed'
            for distance in [.3,1.0]:
                forced=shifted(released,w=-distance)
                blocked=overlap(forced,slider)
                assert blocked>.01,('Locked plunger can move past the gate',normal_offset,distance,blocked)
                stock_gap=forced.distToShape(released_actuator)[0]
                if distance==.3:
                    assert stock_gap>.19,('Gate engages too late to preserve the released take-up gap',normal_offset,stock_gap)
                locked.append({'sliderNormalOffsetMm':normal_offset,'forcedPlungerTravelMm':distance,'gateObstructionMm3':blocked,'remainingActuatorGapMm':stock_gap})
        bearing_probe=shifted(released,w=-.2)
        # Exclude the lead-in cam from the flat load-bearing area measurement.
        bearing_core=bearing_probe.common(Part.makeBox(20,6.8,12,App.Vector(-10,-12.2,0)))
        bearing_area=overlap(bearing_core,sliders[(0,0)])/.05
        assert bearing_area>=60,('Solid gate has insufficient actual bearing area',bearing_area)
        bearing_halves=[]
        for sign in [-1,1]:
            half=Part.makeBox(10,30,12,App.Vector(-10 if sign<0 else 0,-20,0))
            area=overlap(bearing_core.common(half),sliders[(0,0)])/.05
            assert area>=29.5,('One side of the broad bearing is under-supported',sign,area)
            bearing_halves.append({'side':sign,'bearingAreaMm2':area})
        capture=[]
        for travel in [0,unlocked]:
            for offset in [-.4,.1]:
                moving=shifted(sliders[(travel,0)],w=offset)
                blocked=overlap(moving,host)
                assert blocked>.01,('Slider is not normally captive',travel,offset,blocked)
                capture.append({'part':'slider','travelMm':travel,'offsetOutwardMm':offset,'obstructionMm3':blocked})
            for offset in [-.4,.4]:
                blocked=overlap(shifted(sliders[(travel,0)],x=offset),host)
                assert blocked>.01,('Slider can leave its lateral guide',travel,offset,blocked)
                capture.append({'part':'slider','travelMm':travel,'offsetLocalXMm':offset,'obstructionMm3':blocked})
        for axis,offset in [('W',.3),('X',-.4),('X',.4),('Y',-.4),('Y',.4)]:
            moving=shifted(released,**{axis.lower():offset})
            blocked=overlap(moving,host)
            assert blocked>.01,('Paddle can escape its guide',axis,offset,blocked)
            capture.append({'part':'plunger','axis':axis,'offsetMm':offset,'obstructionMm3':blocked})
        beyond=shifted(plungers[full_stroke],w=-.2)
        stop=overlap(beyond,host)
        assert stop>.01,('Unlocked paddle lacks its full-stroke housing stop',stop)
        assert d['paddle']['printedReturnFlexures'] is False,'Fragile printed return flexures are still present'
        assert abs(plungers[take_up].distToShape(released_actuator)[0])<.015,'The stock spring cannot reach the modeled contact-return position'
        nut=local_parts['clamp-nut']
        nut_keys=[]
        for angle in [-15,15,30]:
            turned=nut.copy()
            turned.rotate(App.Vector(clamp_x,clamp_y,0),App.Vector(0,0,1),angle)
            obstruction=overlap(turned,sliders[(0,0)])
            assert obstruction>.01,('Captive nut pocket does not resist rotation',angle,obstruction)
            nut_keys.append({'angleDegrees':angle,'obstructionMm3':obstruction})
        nut_loading=[]
        for offset in [-6,-4,-2,-1,-.3,0]:
            obstruction=overlap(shifted(nut,w=offset),sliders[(0,0)])
            assert obstruction<1e-5,('Nut cannot enter its rear-open pocket',offset,obstruction)
            nut_loading.append({'outwardOffsetMm':offset,'obstructionMm3':obstruction})
        clamp_bearings=[]
        washer=local_parts['clamp-washer']
        screw=local_parts['clamp-screw']
        for label,moving,target in [
            ('washer-on-fixed-rail',shifted(washer,w=-.05),host),
            ('nut-on-solid-ceiling',shifted(nut,w=.05),sliders[(0,0)]),
            ('screw-head-on-washer',shifted(washer,w=.05),screw),
        ]:
            area=overlap(moving,target)/.05
            assert area>=12,('Metal clamp has insufficient native bearing support',label,area)
            clamp_bearings.append({'interface':label,'finitePenetrationMm':.05,'bearingAreaMm2':area})
        engagement=min(d['clamp']['headSeatW'],nut.optimalBoundingBox(False,False).ZMax)-max(screw.optimalBoundingBox(False,False).ZMin,nut.optimalBoundingBox(False,False).ZMin)
        assert engagement>=3.99,('The M3 screw does not span the full nut height',engagement)
        # The switch and paddle enter vertically. The closed slider then threads
        # from the open tail onto its rail; the lid owns the removable end stop.
        switch_paddle=Part.makeCompound([released,stocks['first']])
        loading=[]
        excluded={'web-slider','web-plunger','button-a','lid',*clamp_ids}
        for lift in [i*.5 for i in range(72,-1,-1)]:
            moving=shifted(switch_paddle,x=lift)
            hits=[{'id':id,'volumeMm3':overlap(moving,shape)} for id,shape in local_parts.items() if id not in excluded and not id.startswith('lid-screw-') and overlap(moving,shape)>1e-5]
            assert not hits,('Released switch and paddle cannot be lowered into the base',lift,hits)
            loading.append({'liftZ':lift,'interferences':hits})
        envelope=slider_threading_envelope()
        threading_target=Part.makeCompound([base,released,stocks['first']])
        intersection_cache.register(threading_target,'continuous slider-threading host')
        continuous_hit=overlap(envelope,threading_target)
        assert continuous_hit<1e-5,('Continuous slider threading path is obstructed',continuous_hit)
        envelope_containment=[]
        threading=[]
        for distance in range(28,-1,-1):
            slider_nut=Part.makeCompound([at_travel(unlocked_slider,distance),at_travel(nut,unlocked+distance)])
            outside=max(0,slider_nut.Volume-overlap(slider_nut,envelope))
            assert outside<1e-5,('Continuous envelope does not contain the actual threaded parts',distance,outside)
            obstruction=overlap(slider_nut,threading_target)
            assert obstruction<1e-5,('Slider and captive nut cannot thread onto the open rail',distance,obstruction)
            threading.append({'sliderTravelMm':unlocked+distance,'obstructionMm3':obstruction})
            envelope_containment.append({'sliderTravelMm':unlocked+distance,'outsideEnvelopeMm3':outside})
        # Only the local hood is moved here; global USB/board/power lid fit is audited separately.
        hood=lid.common(crop)
        closing=[]
        for travel in [0,4.4,unlocked]:
            local_stack=Part.makeCompound([sliders[(travel,0)],released,stocks['first'],at_travel(clamp,travel)])
            for lift in [20,10,6,3,1,.3,0]:
                moving=hood.copy()
                moving.translate(App.Vector(lift,0,0))
                blocked=overlap(moving,local_stack)
                assert blocked<1e-5,('Lid hood blocks closure over the complete installed clamp and button stack',travel,lift,blocked)
                closing.append({'selectorTravelMm':travel,'completeClampInstalled':True,'liftZ':lift,'blockedVolumeMm3':blocked})
        fastener_loading=[]
        for id in ['clamp-washer','clamp-screw']:
            hardware=at_travel(local_parts[id],unlocked)
            targets=Part.makeCompound([base,lid,unlocked_slider,released,stocks['first'],at_travel(nut,unlocked)]+([at_travel(washer,unlocked)] if id=='clamp-screw' else []))
            intersection_cache.register(targets,'exterior hardware loading '+id)
            for offset in [12,8,4,2,1,.3,0]:
                obstruction=overlap(shifted(hardware,w=offset),targets)
                assert obstruction<1e-5,('Exterior clamp hardware cannot be inserted after lid closure',id,offset,obstruction)
                fastener_loading.append({'part':id,'outwardOffsetMm':offset,'obstructionMm3':obstruction})
        tool_access=[]
        for travel in [0,unlocked]:
            # The 1.9 mm inscribed tool core fits the canonical 2 mm hex socket.
            tool=Part.makeCylinder(.95,14,App.Vector(clamp_x,clamp_y+canonical_direction*travel,d['clamp']['headSeatW']+d['clamp']['headHeight']-.4))
            target=Part.makeCompound([base,lid,sliders[(travel,0)],released,stocks['first'],at_travel(clamp,travel)])
            obstruction=overlap(tool,target)
            assert obstruction<1e-5,('Recessed clamp screw has no straight tool approach',travel,obstruction)
            tool_access.append({'travelMm':travel,'inscribedToolDiameterMm':1.9,'obstructionMm3':obstruction})
        fixture_hashes=[hashlib.sha256(item['code'].encode()).hexdigest() for collection in ['plungers','sliders','stocks'] for item in m[collection]]+[hashlib.sha256(m['clamp']['code'].encode()).hexdigest()]+[hashlib.sha256(item[key].encode()).hexdigest() for item in m['relock'] for key in ['plungerCode','sliderCode']]
        row.update(passed=True,fixtureCodeSHA256s=fixture_hashes,strengthenedNativeSections=sections,unlockedTravel=strokes,selectorSweep=sweeps,unlockedGuideFloat=bearing_float,relockingAfterStockReturn=relocking,linearEndStops=stops,lockedStrokeProbes=locked,solidGateBearingAreaMm2=bearing_area,individualBearingHalfAreas=bearing_halves,captiveGuides=capture,fullStrokeStopObstructionMm3=stop,stockSpringReturn={'contactReturnStrokeMm':take_up,'capturedFreePlayMm':take_up,'printedFlexures':False,'forceAndLifeQualified':False},captiveNutRotationStops=nut_keys,captiveNutInsertion=nut_loading,metalClampNativeBearing=clamp_bearings,screwAxialNutSpanMm=engagement,stockAndPaddleVerticalInsertion=loading,sliderAndNutThreading=threading,continuousThreadingEnvelope={'obstructionMm3':continuous_hit,'actualPartContainment':envelope_containment,'scope':'Conservative full continuous translational sweep with holes and shallow grooves filled; fixed-rail C clearance retained'},lidHoodClosure=closing,exteriorClampHardwareInsertion=fastener_loading,clampToolApproach=tool_access)
    except Exception as error:
        row.update(error=str(error),traceback=traceback.format_exc())
    finally:
        if intersection_cache is not None:
            row['exactHostIntersectionCache']={**intersection_cache.stats,'cellSizeMm':8,'queryPaddingMm':1,'scope':'Exact host crops strictly contain the full query; no query, fixture, pass threshold or physical geometry is modified.'}
        intersection_cache=None
        if doc:
            App.closeDocument(doc.Name)
    report['cases'].append(row)
    report['diagnosticChecksPassed']=bool(report['cases']) and all(item['passed'] for item in report['cases'])
    report['passed']=report['diagnosticChecksPassed'] and not any(item.get('preflightSnapshotOnly') for item in report['cases'])
    report_file.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(row),flush=True)
sys.exit(not report['passed'])
