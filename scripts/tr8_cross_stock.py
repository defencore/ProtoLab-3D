"""Strict optional reuse of a native-contained continuous cross-channel proof.

No structural frame pair is covered here. Every shape used by a current case is
matched to the generated emitter's exact rigid placement, then its local source
is freshly contained in the certified swept boxes. Their separations are also
recomputed, so this replaces redundant Booleans with a stronger all-angle proof.
"""
import hashlib
import itertools
import json
import math
from pathlib import Path
import sys
import FreeCAD as App
import Part


def digest(value):
    return hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()


def box_corners(box):
    return itertools.product(*zip(*box))


def quarter_box(box,index,radius):
    cosine=(1,0,-1,0)[index]
    sine=(0,1,0,-1)[index]
    points=[(x,cosine*y-sine*z+cosine*radius,sine*y+cosine*z+sine*radius)
            for x,y,z in box_corners(box)]
    return [[min(p[a] for p in points) for a in range(3)],
            [max(p[a] for p in points) for a in range(3)]]


def box_gap(first,second):
    return max(max(first[0][i]-second[1][i],second[0][i]-first[1][i]) for i in range(3))


def inside_box(shape,box):
    b=shape.BoundBox
    low=(b.XMin,b.YMin,b.ZMin)
    high=(b.XMax,b.YMax,b.ZMax)
    return all(low[i]>=box[0][i] and high[i]<=box[1][i] for i in range(3))


def canonical_geometry_and_placement(shape):
    # BRep text includes mutable OCC validity-check flags. Resetting only the
    # top-level placement normalizes those flags without changing any geometry.
    # Keep its exact original matrix separately; no placement tolerance is used.
    matrix=tuple(shape.Placement.toMatrix().A)
    unlocated=shape.copy()
    unlocated.Placement=App.Placement()
    return digest(unlocated.exportBrepToString()),matrix


class CrossStockGuard:
    def __init__(self,directory):
        self.directory=Path(directory)
        self.certificates={}
        self.contained={}
        self.frame_contacts={}
        self.world_envelopes={}
        self.frame_statistics={}
        self.runtime=digest(Path(sys.executable).read_bytes())

    def _certificate(self,specification):
        paths={key:(self.directory/specification[key]).resolve() for key in ['report','cases','audit']}
        proof_hash=digest(paths['report'].read_bytes())
        if proof_hash in self.certificates:
            return self.certificates[proof_hash]
        proof=json.loads(paths['report'].read_text())
        cases=json.loads(paths['cases'].read_text())
        audit=json.loads(paths['audit'].read_text())
        assert proof['passed'] and not proof['unresolvedPairs'],'Continuous stock proof did not pass.'
        assert proof['arrangement']=='radial' and proof['tierMm']==0,'Only the certified radial layout is supported.'
        assert proof['freecad']=='.'.join(App.Version()[:3]) and proof['runtimeSha256']==self.runtime,'Stock proof used a different native runtime.'
        verifier=specification.get('verifierScript','verify-tr8-quad-swept-stock.py')
        assert verifier in ['verify-tr8-quad-swept-stock.py','verify-tr8-quad-mini-swept-stock.py'],'Unknown continuous stock verifier.'
        assert proof['scriptSha256']==digest(Path(__file__).with_name(verifier).read_bytes()),'Stock proof script changed.'
        assert proof['casesSha256']==digest(paths['cases'].read_bytes())==audit['casesSha256'],'Prototype cases changed.'
        assert proof['nativeAuditSha256']==digest(paths['audit'].read_bytes()),'Prototype audit changed.'
        assert audit['failed']==0 and audit['passed']>=3,'Audit all three physical prototype poses first.'
        assert audit['freecad']==proof['freecad']
        neutral=next(case for case in cases if case['mode']=='full' and case['parameters']['outputAngle']==0)
        assert proof['nativeNeutralSha256']==digest(paths['cases'].with_name(neutral['name']+'.FCStd').read_bytes()),'Native containment input changed.'
        full_cases={float(case['parameters']['outputAngle']):case for case in cases if case['mode']=='full'}
        for case in full_cases.values():
            row=next(row for row in audit['cases'] if row['name']==case['name'])
            assert row['passed'] and row['codeSha256']==digest(case['script'])
        assert {-20.0,0.0,20.0}.issubset(full_cases)
        identities={piece['id'] for piece in neutral['billOfMaterials']['components']}
        cells=proof['stockCells']
        assert {cell['id'] for cell in cells}==identities,'Stock proof occurrence set differs.'
        assert {row['id'] for row in proof['containment']}==identities
        assert all(abs(row['escapedMm3'])<=1e-6 for row in proof['containment'])
        for cell in cells:
            box=cell['sweep']
            assert len(box)==2 and all(len(point)==3 for point in box)
            assert all(math.isfinite(v) for point in box for v in point)
            assert all(box[1][axis]>box[0][axis] for axis in range(3))
        radius=float(proof['radiusMm'])
        minimum=math.inf
        checks=0
        for a,b in itertools.combinations(range(4),2):
            for first in cells:
                aa=quarter_box(first['sweep'],a,radius)
                for second in cells:
                    gap=box_gap(aa,quarter_box(second['sweep'],b,radius))
                    assert gap>0,'Certified stock boxes no longer separate.'
                    minimum=min(minimum,gap)
                    checks+=1
        assert checks==proof['checkedCellPairs']
        assert abs(minimum-proof['minSeparatingCoordinateGapMm'])<1e-8
        envelopes={}
        for identity in identities:
            boxes=[cell['sweep'] for cell in cells if cell['id']==identity]
            shapes=[Part.makeBox(*(box[1][i]-box[0][i] for i in range(3)),App.Vector(*box[0])) for box in boxes]
            union=shapes[0]
            for shape in shapes[1:]:
                union=union.fuse(shape)
            assert not union.isNull() and union.isValid() and union.isClosed()
            envelopes[identity]=(boxes,union)
        value=dict(proof=proof,hash=proof_hash,cases=full_cases,envelopes=envelopes,paths=paths)
        self.certificates[proof_hash]=value
        return value

    def check(self,case,scope,shapes,metadata,world_hashes):
        self.world_envelopes={}
        self.frame_statistics=dict(freshEnvelopeFrameChecks=0,reusedExactEnvelopeFrameChecks=0,
            zeroContactsCertified=0,positiveEnvelopeFallbacks=0,invalidOrFailedEnvelopeFallbacks=0,
            nonzeroContainmentFallbacks=0,
            policy='Fresh validated swept-envelope versus exact actual frame BRep; only exact zero skips the actual-shape Boolean. Positive, invalid or failed intersections fall through. Cache keys include source proof, world envelope and exact frame BRep.')
        specification=case.get('crossChannelStockProof')
        if not specification:
            return set(),None
        certificate=self._certificate(specification)
        proof=certificate['proof']
        for field in ['crankRadius','pivot','screwAxisZ','screwLead']:
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
            angle=float(mount['angle'])
            assert proof['outputAngleIntervalDegrees'][0]<=angle<=proof['outputAngleIntervalDegrees'][1]
            local_case=certificate['cases'][angle]
            source=local_case['source'] if case['mode']=='full' else local_case['nominalSource']
            assert json.dumps(source,ensure_ascii=False) in case['source'],'Current native source does not instantiate the certified prototype.'
            assert source in scope['_quad_cache'],'Emitter did not evaluate the certified local source.'
            local=scope['_quad_cache'][source]
            local_shapes=local['components']
            local_records=local['component_metadata']
            assert len(local_shapes)==len(local_records)
            identities={record['AssemblyOccurrenceId'] for record in local_records}
            assert identities==set(certificate['envelopes'])
            hashes=tuple(canonical_geometry_and_placement(shape) for shape in local_shapes)
            cache_key=(certificate['hash'],digest(source),hashes)
            if cache_key in self.contained:
                cached_count+=1
            else:
                escaped_values=[]
                for shape,record in zip(local_shapes,local_records):
                    assert not shape.isNull() and shape.isValid() and shape.isClosed() and shape.Volume>0
                    identity=record['AssemblyOccurrenceId']
                    boxes,envelope=certificate['envelopes'][identity]
                    if any(inside_box(shape,box) for box in boxes):
                        methods['native-conservative-bounds']=methods.get('native-conservative-bounds',0)+1
                        escaped=0
                    else:
                        residual=shape.cut(envelope)
                        escaped=0 if residual.isNull() else residual.Volume
                        methods['native-exact-envelope-cut']=methods.get('native-exact-envelope-cut',0)+1
                    assert abs(escaped)<=1e-7,('Current native solid escapes its continuous stock envelope',identity,escaped)
                    maximum_escape=max(maximum_escape,abs(escaped))
                    escaped_values.append(escaped)
                self.contained[cache_key]=tuple(escaped_values)
                fresh_count+=1
            placed=[i for i,record in enumerate(metadata) if record.get('QuadChannel')==mount['id']]
            assert len(placed)==len(local_shapes),'Mounted local component count changed.'
            mounted_envelopes={}
            for current,raw,record,escaped in zip(placed,local_shapes,local_records,self.contained[cache_key]):
                identity=record['AssemblyOccurrenceId']
                assert metadata[current]['PrototypeOccurrenceId']==identity
                assert metadata[current]['AssemblyOccurrenceId']==mount['id']+'-'+identity
                expected_shape=raw.copy()
                expected_shape.rotate(App.Vector(),App.Vector(1,0,0),clock)
                expected_shape.translate(App.Vector(*mount['origin']))
                if digest(expected_shape.exportBrepToString())!=world_hashes[current]:
                    assert canonical_geometry_and_placement(expected_shape)==canonical_geometry_and_placement(shapes[current]),('Actual native rigid mount differs',mount['id'],identity)
                    canonical_mounts+=1
                if escaped==0:
                    if identity not in mounted_envelopes:
                        envelope=certificate['envelopes'][identity][1].copy()
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

    def proves_frame_empty(self,first,second,shapes,metadata,world_hashes):
        """A fresh conservative broad phase; never waive a positive contact."""
        if first in self.world_envelopes and not metadata[second].get('QuadChannel'):
            channel,frame=first,second
        elif second in self.world_envelopes and not metadata[first].get('QuadChannel'):
            channel,frame=second,first
        else:
            return False
        prepared,source_hash=self.world_envelopes[channel]
        if prepared is None:
            self.frame_statistics['invalidOrFailedEnvelopeFallbacks']+=1
            return False
        envelope,envelope_identity=prepared
        key=(source_hash,envelope_identity,metadata[frame]['AssemblyOccurrenceId'],world_hashes[frame])
        if key in self.frame_contacts:
            result=self.frame_contacts[key]
            self.frame_statistics['reusedExactEnvelopeFrameChecks']+=1
        else:
            self.frame_statistics['freshEnvelopeFrameChecks']+=1
            try:
                common=envelope.common(shapes[frame])
                if common.isNull():
                    result='zero'
                elif not common.isValid() or not math.isfinite(common.Volume) or common.Volume<0:
                    result='invalid'
                else:
                    result='zero' if common.Volume==0 else 'positive'
            except Exception:
                result='invalid'
            self.frame_contacts[key]=result
        if result=='zero':
            self.frame_statistics['zeroContactsCertified']+=1
            return True
        key='positiveEnvelopeFallbacks' if result=='positive' else 'invalidOrFailedEnvelopeFallbacks'
        self.frame_statistics[key]+=1
        return False
