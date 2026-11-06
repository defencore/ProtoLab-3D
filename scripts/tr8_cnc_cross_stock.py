"""CNC-family-only tier-aware continuous source guard.

Old released actuator verifiers are deliberately unchanged. Each tier has its own
native source and envelope; no axial union erases the staggered separation.
"""
import itertools,json,math
from pathlib import Path
import sys
import FreeCAD as App
import Part
from tr8_cross_stock import CrossStockGuard,digest,quarter_box,box_gap,inside_box,canonical_geometry_and_placement

EPS=1e-5

def cylinder(cell,padding=EPS):
 base=App.Vector(*cell['base']);tip=App.Vector(*cell['tip']);axis=tip-base;length=axis.Length;axis.normalize()
 return Part.makeCylinder(cell['radius']+padding,length+2*padding,base-axis*padding,axis)

def frame_envelope(cells,neutral,configuration,travel):
 if configuration['libraryId']=='flanged-ball-bearing':
  p=configuration['parameters'];w=p['width'];f=p['flangeWidth']
  result=Part.makeCylinder(p['outer']/2+EPS,w+2*EPS,App.Vector(0,0,-w/2-EPS))
  result=result.fuse(Part.makeCylinder(p['flangeOuter']/2+EPS,f+2*EPS,App.Vector(0,0,w/2-f-EPS)))
  for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],configuration['placement']['rotation']):
   if angle:result.rotate(App.Vector(),axis,angle)
  result.translate(App.Vector(*configuration['placement']['translation']));return result
 shapes=[]
 for item in cells:
  cell=item['stock'];motion=item['motion'];shape=None
  if cell['kind']=='cylinder':
   if motion=='invariant':shape=cylinder(cell)
   elif motion=='slide' and abs(abs(cell['axis'][0])-1)<1e-7:
    direction=App.Vector(*cell['axis']);base=App.Vector(*cell['base'])-direction*travel;tip=App.Vector(*cell['tip'])+direction*travel
    shape=cylinder(dict(cell,base=[base.x,base.y,base.z],tip=[tip.x,tip.y,tip.z]))
   elif motion=='output' and abs(abs(cell['axis'][1])-1)<1e-7 and abs(cell['base'][0]-neutral)<1e-8 and abs(cell['base'][2])<1e-8:shape=cylinder(cell)
  if shape is None:
   box=item['sweep'];shape=Part.makeBox(*(box[1][a]-box[0][a] for a in range(3)),App.Vector(*box[0]))
  shapes.append(shape)
 result=shapes[0]
 for shape in shapes[1:]:result=result.fuse(shape)
 return result

class CncCrossStockGuard(CrossStockGuard):
 def _certificate(self,specification):
  assert specification.get('kind')=='cnc-family'
  paths={key:(self.directory/specification[key]).resolve() for key in ['report','cases','audit']}
  proof_hash=digest(paths['report'].read_bytes())
  if proof_hash in self.certificates:return self.certificates[proof_hash]
  proof=json.loads(paths['report'].read_text());cases=json.loads(paths['cases'].read_text());audit=json.loads(paths['audit'].read_text())
  assert proof['schemaVersion']==2 and proof['passed'] and proof['independentChannelAngles'] and not proof['unresolvedPairs']
  assert proof['freecad']=='.'.join(App.Version()[:3]) and proof['runtimeSha256']==self.runtime
  assert proof['scriptSha256']==digest(Path(__file__).with_name('verify-tr8-cnc-swept-stock.py').read_bytes())
  assert proof['casesSha256']==digest(paths['cases'].read_bytes())==audit['casesSha256']
  assert proof['nativeAuditSha256']==digest(paths['audit'].read_bytes()) and audit['failed']==0 and audit['passed']==len(cases)
  local_cases={};envelopes={};frame_envelopes={}
  for case in cases:
   key=(float(case['kinematics']['neutralNutX']),float(case['parameters']['outputAngle']))
   assert key not in local_cases;local_cases[key]=case
   row=next(r for r in audit['cases'] if r['name']==case['name']);assert row['passed'] and row['codeSha256']==digest(case['script'])
  for tier in proof['tiers']:
   neutral=float(tier['neutralNutX']);assert all((neutral,angle) in local_cases for angle in [-20,0,20])
   assert tier['nativeNeutralSha256']==digest(paths['cases'].with_name(tier['nativeNeutralFile']).read_bytes())
   case=local_cases[(neutral,0)];configurations={c['id']:c for c in case['billOfMaterials']['components']}
   cells=tier['stockCells'];identities={c['id'] for c in cells}
   assert identities==set(configurations)=={r['id'] for r in tier['containment']}
   assert all(abs(r['escapedMm3'])<=1e-6 for r in tier['containment'])
   envelopes[neutral]={};frame_envelopes[neutral]={}
   for identity in identities:
    own=[c for c in cells if c['id']==identity];boxes=[c['sweep'] for c in own]
    shapes=[]
    for box in boxes:
     assert len(box)==2 and all(len(p)==3 for p in box) and all(math.isfinite(v) for p in box for v in p)
     assert all(box[1][a]>box[0][a] for a in range(3))
     shapes.append(Part.makeBox(*(box[1][a]-box[0][a] for a in range(3)),App.Vector(*box[0])))
    combined=shapes[0]
    for shape in shapes[1:]:combined=combined.fuse(shape)
    assert combined.isValid() and combined.isClosed() and combined.Volume>0
    envelopes[neutral][identity]=(boxes,combined)
    try:
     candidate=frame_envelope(own,neutral,configurations[identity],proof['kinematics']['crankRadius']*math.tan(math.radians(20)))
     assert candidate.isValid() and candidate.isClosed() and candidate.Volume>0
    except Exception:candidate=combined
    frame_envelopes[neutral][identity]=candidate
  minimum=math.inf;checks=0
  for a,b in itertools.combinations(range(4),2):
   ca,cb=proof['channels'][a],proof['channels'][b]
   assert ca['neutralNutX']==proof['layout']['outputStations'][a] and cb['neutralNutX']==proof['layout']['outputStations'][b]
   for first in ca['stockCells']:
    for second in cb['stockCells']:
     gap=box_gap(quarter_box(first['sweep'],a,proof['radiusMm']),quarter_box(second['sweep'],b,proof['radiusMm']))
     assert gap>0,'CNC tier-specific stocks no longer separate.'
     minimum=min(minimum,gap);checks+=1
  assert checks==proof['checkedCellPairs'] and abs(minimum-proof['minSeparatingCoordinateGapMm'])<1e-8
  assert abs(proof['layout']['screwPitchRadius']-proof['layout']['diameter']/4)<1e-10
  assert abs(proof['radiusMm']**2+proof['kinematics']['screwAxisZ']**2-proof['layout']['screwPitchRadius']**2)<1e-8
  value=dict(proof=proof,hash=proof_hash,cases=local_cases,envelopes=envelopes,frame_envelopes=frame_envelopes,paths=paths)
  self.certificates[proof_hash]=value;return value

 def check(self,case,scope,shapes,metadata,world_hashes):
     self.world_envelopes={}
     if not hasattr(self,'tight_coverage_cache'):self.tight_coverage_cache={}
     self.frame_statistics=dict(freshEnvelopeFrameChecks=0,reusedExactEnvelopeFrameChecks=0,
         zeroContactsCertified=0,positiveEnvelopeFallbacks=0,invalidOrFailedEnvelopeFallbacks=0,
         nonzeroContainmentFallbacks=0,tightLocalEnvelopeOccurrences=0,tightLocalEnvelopeFallbacks=0,
         policy='Fresh validated swept-envelope versus exact actual frame BRep; only exact zero skips the actual-shape Boolean. Positive, invalid or failed intersections fall through. Cache keys include source proof, world envelope and exact frame BRep.')
     specification=case.get('crossChannelStockProof')
     if not specification:
         return set(),None
     certificate=self._certificate(specification)
     proof=certificate['proof']
     assert case['frameLayout']==proof['layout'],'CNC layout changed.'
     for field in ['crankRadius','screwAxisZ','screwLead']:
         assert case['kinematics'][field]==proof['kinematics'][field],('Stock kinematics changed',field)
     mounts=case['channelPlacements']
     assert [mount['id'] for mount in mounts]==list('abcd')
     radius=proof['radiusMm']
     channels=set()
     fresh_count=0
     cached_count=0
     maximum_escape=0
     canonical_mounts=0
     methods={}
     for index,mount in enumerate(mounts):
         clock=proof['commonClockDegrees']+index*90
         assert abs(mount['clock']-clock)<1e-10
         expected=(0,radius*math.cos(math.radians(clock)),radius*math.sin(math.radians(clock)))
         assert max(abs(a-b) for a,b in zip(expected,mount['origin']))<1e-9,'Channel origins differ from the certified radial mount.'
         neutral=float(mount['neutralNutX'])
         assert neutral==proof['layout']['outputStations'][index]
         envelopes=certificate['envelopes'][neutral]
         angle=float(mount['angle'])
         assert proof['outputAngleIntervalDegrees'][0]<=angle<=proof['outputAngleIntervalDegrees'][1]
         local_case=certificate['cases'][(neutral,angle)]
         source=local_case['source'] if case['mode']=='full' else local_case['nominalSource']
         assert json.dumps(source,ensure_ascii=False) in case['source'],'Current native source does not instantiate the certified prototype.'
         assert source in scope['_cnc_cache'],'Emitter did not evaluate the certified local source.'
         local=scope['_cnc_cache'][source]
         local_shapes=local['components']
         local_records=local['component_metadata']
         assert len(local_shapes)==len(local_records)
         identities={record['AssemblyOccurrenceId'] for record in local_records}
         assert identities==set(envelopes)
         hashes=tuple(canonical_geometry_and_placement(shape) for shape in local_shapes)
         cache_key=(certificate['hash'],digest(source),hashes)
         if cache_key in self.contained:
             cached_count+=1
         else:
             escaped_values=[]
             for shape,record in zip(local_shapes,local_records):
                 assert not shape.isNull() and shape.isValid() and shape.isClosed() and shape.Volume>0
                 identity=record['AssemblyOccurrenceId']
                 boxes,envelope=envelopes[identity]
                 if any(inside_box(shape,box) for box in boxes):
                     methods['native-conservative-bounds']=methods.get('native-conservative-bounds',0)+1
                     escaped=0
                 else:
                     residual=shape.cut(envelope)
                     assert residual.isNull() or residual.isValid(),'Invalid native containment Boolean.'
                     escaped=0 if residual.isNull() else residual.Volume
                     methods['native-exact-envelope-cut']=methods.get('native-exact-envelope-cut',0)+1
                 assert abs(escaped)<=1e-7,('Current native solid escapes its continuous stock envelope',identity,escaped)
                 maximum_escape=max(maximum_escape,abs(escaped))
                 escaped_values.append(escaped)
             self.contained[cache_key]=tuple(escaped_values)
             fresh_count+=1
         if cache_key not in self.tight_coverage_cache:
             choices={}
             for identity in identities:
                 candidate=certificate['frame_envelopes'][neutral][identity]
                 members=[shape for shape,record in zip(local_shapes,local_records) if record['AssemblyOccurrenceId']==identity]
                 try:
                     residual=Part.makeCompound(members).cut(candidate)
                     choices[identity]=residual.isNull() or (residual.isValid() and math.isfinite(residual.Volume) and residual.Volume==0)
                 except Exception:choices[identity]=False
             self.tight_coverage_cache[cache_key]=choices
         choices=self.tight_coverage_cache[cache_key]
         self.frame_statistics['tightLocalEnvelopeOccurrences']+=sum(choices.values())
         self.frame_statistics['tightLocalEnvelopeFallbacks']+=sum(not value for value in choices.values())
         placed=[i for i,record in enumerate(metadata) if record.get('QuadChannel')==mount['id']]
         assert len(placed)==len(local_shapes),'Mounted local component count changed.'
         mounted_envelopes={}
         for current,raw,record,escaped in zip(placed,local_shapes,local_records,self.contained[cache_key]):
             identity=record['AssemblyOccurrenceId']
             assert metadata[current]['PrototypeOccurrenceId']==identity
             assert float(metadata[current]['NeutralNutX'])==neutral
             assert metadata[current]['AssemblyOccurrenceId']==mount['id']+'-'+identity
             expected_shape=raw.copy()
             expected_shape.rotate(App.Vector(),App.Vector(1,0,0),clock)
             expected_shape.translate(App.Vector(*mount['origin']))
             if digest(expected_shape.exportBrepToString())!=world_hashes[current]:
                 assert canonical_geometry_and_placement(expected_shape)==canonical_geometry_and_placement(shapes[current]),('Actual native rigid mount differs',mount['id'],identity)
                 canonical_mounts+=1
             if escaped==0:
                 if identity not in mounted_envelopes:
                     # EVERY native child was contained with valid exact-zero
                     # escape before this tighter current-source broad phase.
                     envelope=(certificate['frame_envelopes'][neutral][identity] if choices[identity] else envelopes[identity][1]).copy()
                     envelope.rotate(App.Vector(),App.Vector(1,0,0),clock)
                     envelope.translate(App.Vector(*mount['origin']))
                     try:
                         usable=envelope.isValid() and envelope.isClosed() and envelope.Volume>0
                     except Exception:
                         usable=False
                     mounted_envelopes[identity]=(envelope,canonical_geometry_and_placement(envelope)) if usable else None
                 self.world_envelopes[current]=(mounted_envelopes[identity],certificate['hash'])
             else:
                 self.frame_statistics['nonzeroContainmentFallbacks']+=1
         channels.add(mount['id'])
     return channels,dict(report=str(certificate['paths']['report']),reportSha256=certificate['hash'],
         guardScriptSha256=digest(Path(__file__).read_bytes()),nativeContainmentToleranceMm3=1e-7,casesSha256=proof['casesSha256'],nativeAuditSha256=proof['nativeAuditSha256'],
         recomputedSeparatingBoxPairs=proof['checkedCellPairs'],minimumCoordinateGapMm=proof['minSeparatingCoordinateGapMm'],
         freshContainedLocalSources=fresh_count,reusedExactlyHashedContainedSources=cached_count,
         containmentMethods=methods,maxNativeEnvelopeEscapeMm3=maximum_escape,
         normalizedOccAnalysisFlagMounts=canonical_mounts,
         policy='Skip only cross-channel pairs after source/runtime/report/mount guards, recomputed continuous box separation, fresh native containment, byte-identical unlocated geometry and exact placement matrices; OCC analysis flags are not geometry. Every structural frame pair remains fresh.')
