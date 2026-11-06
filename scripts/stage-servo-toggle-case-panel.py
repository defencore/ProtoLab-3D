"""Focused native preflight with exact per-component cache and baseline reuse.

Only identical geometric component AST blocks inherit prior physical checks. Changed parts
are built, checked against every current partner, tessellated, and saved as BReps.
This staging report does not replace the final full-state/document export audit.
"""
import argparse
import ast
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import sys
sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import MeshPart


def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def assembly_blocks(source):
    tree=ast.parse(source)
    function=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='_protolab_create')
    body=next(n for n in function.body if isinstance(n,ast.Try)).body
    def component(node):
        return isinstance(node,ast.Assign)and isinstance(node.value,ast.Call)and isinstance(node.value.func,ast.Name)and node.value.func.id=='_pl_component'
    start=next(i for i,n in enumerate(body)if component(n))
    prefix=body[:start];blocks=[];current=[]
    for node in body[start:]:
        if isinstance(node,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='shape'for t in node.targets):
            if current:blocks.append(current)
            break
        if component(node)and current:blocks.append(current);current=[]
        current.append(node)
    assert blocks
    for node in prefix:
        if isinstance(node,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='_pl_component_cache'for t in node.targets):node.value=ast.Name(id='_case_panel_cache',ctx=ast.Load())
    return prefix,blocks


def fingerprint(block):
    physical=[]
    for node in block:
        if isinstance(node,ast.Assign):
            names=[n.id for target in node.targets for n in ast.walk(target)if isinstance(n,ast.Name)]
            if 'component'in names:physical.append(node)
            else:assert names==['local_metadata'],('Unrecognized component assignment',names)
        elif isinstance(node,ast.Expr)and isinstance(node.value,ast.Call)and isinstance(node.value.func,ast.Attribute)and isinstance(node.value.func.value,ast.Name):
            owner=node.value.func.value.id
            if owner=='component':
                assert node.value.func.attr in ['rotate','translate'],'Unrecognized geometric component operation'
                physical.append(node)
            else:assert owner in ['components','component_metadata']and node.value.func.attr=='append'
        else:assert isinstance(node,ast.If)and not node.orelse and all(isinstance(n,ast.Raise)for n in node.body),'Unrecognized native component block'
    return hashlib.sha256(ast.dump(ast.Module(body=physical,type_ignores=[])).encode()).hexdigest()


def bounds(shape):
    b=shape.BoundBox
    return {'min':[b.XMin,b.YMin,b.ZMin],'max':[b.XMax,b.YMax,b.ZMax]}


def boxes_overlap(a,b):
    return all(min(getattr(a,d+'Max'),getattr(b,d+'Max'))-max(getattr(a,d+'Min'),getattr(b,d+'Min'))>=1e-6 for d in 'XYZ')


def common_detail(a,b):
    if not boxes_overlap(a.BoundBox,b.BoundBox):return 0,[]
    aa,bb=a.Solids,b.Solids
    rows=[]
    if max(len(aa),len(bb))>=32:
        for i,x in enumerate(aa):
            xb=x.BoundBox
            for j,y in enumerate(bb):
                if not boxes_overlap(xb,y.BoundBox):continue
                common=x.common(y);volume=common.Volume
                if volume>1e-8:rows.append({'firstSolid':i,'secondSolid':j,'volumeMm3':volume,**bounds(common)})
        return sum(r['volumeMm3']for r in rows),rows
    common=a.common(b);volume=common.Volume
    return volume,[{'volumeMm3':volume,**bounds(common)}]if volume>1e-8 else []


parser=argparse.ArgumentParser()
parser.add_argument('input')
parser.add_argument('--baseline',required=True)
parser.add_argument('--seed',required=True)
parser.add_argument('--cache',required=True)
parser.add_argument('--output',default='/tmp/case-panel-native-stage')
parser.add_argument('--ids',help='Optional comma-separated component subset; defaults to all current parts.')
parser.add_argument('--pair-proof-input',help='Optional preceding immutable candidate whose complete installed-pair proof may be reused.')
parser.add_argument('--pair-proof-report',help='Its complete stage report; structural failure does not invalidate separately clear installed pairs.')
args=parser.parse_args()
case=json.loads(Path(args.input).read_text());assert hashlib.sha256(case['script'].encode()).hexdigest()==case['codeSha256']
base=Path(args.baseline);old=json.loads((base/'case-panel-components.json').read_text());old_source=(base/'case-panel-source.FCMacro').read_text()
assert hashlib.sha256(old_source.encode()).hexdigest()==old['codeSha256']
old_report=json.loads((base/'native-export-validation.json').read_text())
assert old_report['sourceCodeSha256']==old['codeSha256']and not old_report['intersections']and old_report['stepRoundtrip']and old_report['fcstdRoundtrip']
prefix,blocks=assembly_blocks(case['script']);_,old_blocks=assembly_blocks(old_source)
assert len(blocks)==len(case['components'])and len(old_blocks)==len(old['components'])
old_fingerprints={r['id']:fingerprint(block)for r,block in zip(old['components'],old_blocks)}
changed={r['id']for r,block in zip(case['components'],blocks)if old_fingerprints.get(r['id'])!=fingerprint(block)}
candidate_pair_keys={};candidate_pair_binding=None
assert bool(args.pair_proof_input)==bool(args.pair_proof_report)
if args.pair_proof_input:
    proof_input=Path(args.pair_proof_input);proof_report=Path(args.pair_proof_report)
    prior=json.loads(proof_input.read_text());proof=json.loads(proof_report.read_text())
    assert hashlib.sha256(prior['script'].encode()).hexdigest()==prior['codeSha256']==proof['sourceCodeSha256']
    assert proof['selectedComponentCount']==len(prior['components'])
    assert {r['id']for r in proof['parts']}=={r['id']for r in prior['components']}
    assert proof['checkedPairs']+proof['inheritedIdenticalComponentPairs']==len(prior['components'])*(len(prior['components'])-1)//2
    assert not proof['intersections']and all(row['closed']for row in proof['meshes'])
    _,prior_blocks=assembly_blocks(prior['script']);assert len(prior_blocks)==len(prior['components'])
    candidate_pair_keys={r['id']:fingerprint(block)for r,block in zip(prior['components'],prior_blocks)}
    candidate_pair_binding={'input':str(proof_input),'inputSha256':digest(proof_input),'report':str(proof_report),'reportSha256':digest(proof_report),'sourceCodeSha256':prior['codeSha256'],'scope':'Installed clear pairs only; both complete component ASTs, including placements, must match. Separate failed structural results are never inherited.'}
current_pair_keys={r['id']:fingerprint(block)for r,block in zip(case['components'],blocks)}
selected=set(args.ids.split(','))if args.ids else {r['id']for r in case['components']}
assert selected<={r['id']for r in case['components']}
output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
cache_dir=Path(args.cache);cache_dir.mkdir(parents=True,exist_ok=True)
seed=Path(args.seed);manifest=json.loads((seed/'manifest.json').read_text())
needed={block[0].value.args[0].value for r,block in zip(case['components'],blocks)if r['id']in selected}
entries={};cache={};invalid=[]
for entry in manifest['entries']:
    if entry['source']not in needed:continue
    source_file=seed/entry['file'];assert digest(source_file)==entry['sha256']
    shape=Part.Shape();shape.read(str(source_file))
    assert len(shape.Solids)==entry['solids']and len(shape.Faces)==entry['faces']
    assert abs(shape.Volume-entry['volumeMm3'])<=max(1e-7,abs(entry['volumeMm3'])*1e-9)
    cache[entry['source']]=(shape,entry['metadata'],entry['labels']);entries[entry['source']]=entry
    destination=cache_dir/entry['file']
    if source_file.resolve()!=destination.resolve():shutil.copyfile(source_file,destination)


class Cache(dict):
    def __setitem__(self,source,value):
        shape,metadata,labels=value
        file=cache_dir/(hashlib.sha256(source.encode()).hexdigest()+'.brep')
        shape.exportBrep(str(file))
        valid=shape.isValid()and shape.isClosed()and shape.Volume>0
        entry={'source':source,'file':file.name,'sha256':digest(file),'volumeMm3':shape.Volume,'solids':len(shape.Solids),'faces':len(shape.Faces),'metadata':metadata,'labels':labels,'valid':valid}
        if valid:entries[source]=entry
        else:invalid.append({'nativeSourceSha256':hashlib.sha256(source.encode()).hexdigest(),'cacheBrep':str(file),'solids':len(shape.Solids),'valid':False,**bounds(shape)})
        super().__setitem__(source,value)
        persist()


def persist():
    (cache_dir/'manifest.json').write_text(json.dumps({'sourceCodeSha256':case['codeSha256'],'complete':False,'entries':list(entries.values())}))


cache=Cache(cache);persist()
env={'App':App,'Part':Part,'math':math,'_case_panel_cache':cache}
exec(compile(ast.fix_missing_locations(ast.Module(body=prefix,type_ignores=[])),'<native-stage-prefix>','exec'),env)
records=[];shapes=[];rows=[];meshes=[]
for r,block in zip(case['components'],blocks):
    if r['id']not in selected:continue
    print('STAGE_BUILD='+r['id'],flush=True)
    try:exec(compile(ast.fix_missing_locations(ast.Module(body=block,type_ignores=[])),'<native-stage-'+r['id']+'>','exec'),env)
    except Exception as error:
        report={'passed':False,'sourceCodeSha256':case['codeSha256'],'errorComponent':r['id'],'error':str(error),'invalidNativeSources':invalid}
        (output/'stage-validation.json').write_text(json.dumps(report,indent=2)+'\n');raise
    shape=env['components'][-1]
    if r['id']in changed:
        assert shape.isValid()and shape.isClosed()and shape.Volume>0,r['id']
        if r['supply']=='manufactured':assert len(shape.Solids)==1,(r['id'],'disconnected printable')
        shape.exportBrep(str(output/(r['id']+'.brep')))
    records.append(r);shapes.append(shape)
    rows.append({'id':r['id'],'changed':r['id']in changed,'volumeMm3':shape.Volume,'solids':len(shape.Solids),**bounds(shape)})
    print('STAGE_PART='+json.dumps(rows[-1]),flush=True)
    if r['supply']=='manufactured'and r['id']in changed:
        mesh=MeshPart.meshFromShape(Shape=shape,LinearDeflection=.04,AngularDeflection=.12,Relative=False)
        meshes.append({'id':r['id'],'closed':mesh.isSolid(),'facets':mesh.CountFacets})
        if not mesh.isSolid():mesh.write(str(output/(r['id']+'.diagnostic.stl')))
intersections=[];checked=0;inherited=0;inherited_candidate=0
for i,a in enumerate(shapes):
    for j in range(i+1,len(shapes)):
        if not({records[i]['id'],records[j]['id']}&changed):inherited+=1;continue
        ids=[records[i]['id'],records[j]['id']]
        if candidate_pair_keys and all(candidate_pair_keys.get(id)==current_pair_keys[id]for id in ids):
            inherited+=1;inherited_candidate+=1;continue
        volume,detail=common_detail(a,shapes[j]);checked+=1
        if volume>.001:
            row={'first':records[i]['id'],'second':records[j]['id'],'volumeMm3':volume,'commonParts':detail}
            intersections.append(row);print('STAGE_INTERSECTION='+json.dumps(row),flush=True)
report={'passed':not intersections and all(m['closed']for m in meshes),'sourceCodeSha256':case['codeSha256'],'baselineSourceCodeSha256':old['codeSha256'],'selectedComponentCount':len(records),'changedComponentIds':sorted(changed),'checkedPairs':checked,'inheritedIdenticalComponentPairs':inherited,'parts':rows,'meshes':meshes,'intersections':intersections,'limits':'Staged rest-pose geometry, with exact native/component-AST baseline reuse. Final full moving-state, structural, retention and document/STL roundtrip checks remain mandatory.'}
if candidate_pair_binding:report['candidateInstalledPairReuse']={**candidate_pair_binding,'inheritedPairs':inherited_candidate}
if len(records)==len(case['components']):
    import runpy
    structure=runpy.run_path(str(Path(__file__).with_name('case-panel-structure-fixture.py')))['audit_structure'](case,shapes,lambda a,b:common_detail(a,b)[0])
    (output/'native-structure-validation.json').write_text(json.dumps({'sourceCodeSha256':case['codeSha256'],**structure},indent=2)+'\n')
    report['structure']=structure;report['passed']=report['passed']and structure['passed']
(output/'stage-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('STAGE_COMPLETE='+json.dumps({k:report[k]for k in ['passed','sourceCodeSha256','selectedComponentCount','changedComponentIds','checkedPairs','inheritedIdenticalComponentPairs']}),flush=True)
sys.exit(0 if report['passed']else 1)
