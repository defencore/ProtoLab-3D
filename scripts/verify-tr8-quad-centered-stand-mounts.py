"""Selective new-section/fastener fit; never repeat unchanged core/core pairs."""
import ast,hashlib,json,math,re,sys,time
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
out=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-quad-geared-rocker-centered-stand')
data=json.loads((out/'capture.json').read_text())
geometry_sources={f:h for f,h in data['sources'].items() if not f.endswith(('/lib/fabrication.ts','/product.json'))}
for f,h in dict(geometry_sources,**data['preserved']).items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,('Changed geometry source',f)
base_ids=set(data['baseIds']);cache={};pair_cache={};started=time.monotonic()
report={'passed':False,'scope':'Only four changed panels and four PETG sections against existing core; both motors at0/±20degrees. Unchanged core/core pairs are not repeated.','captureSha256':hashlib.sha256((out/'capture.json').read_bytes()).hexdigest(),'sources':data['sources'],'poses':[]}
reference=json.loads(Path('test-results/tr8-quad-geared-rocker-stand-mounts/capture.json').read_text())
helpers=Path('test-results/tr8-quad-geared-rocker-plain-seat-final/verified-run-verifier.py').read_text()
functions=[n for n in ast.parse(helpers).body if isinstance(n,ast.FunctionDef) and n.name in ['valid','overlap','group','placement_rotation']]
ns={'App':App,'Part':Part,'math':math,'json':json};exec(compile(ast.Module(body=functions,type_ignores=[]),'<verified-native-functions>','exec'),ns)
def save(stage):
 report['elapsedSeconds']=time.monotonic()-started;report['stage']=stage;(out/'new-parts-native-report.json').write_text(json.dumps(report,indent=2)+'\n');print(stage,flush=True)
def save_neutral(row,records):
 folder=out/'native-shapes'/row['motor'];folder.mkdir(parents=True,exist_ok=True)
 for key,shape in records.items():shape.exportBrep(str(folder/(key+'.brep')))
 (folder/'row.json').write_text(json.dumps({k:v for k,v in row.items() if k!='source'},indent=2)+'\n')
 return str(folder)
try:
 for row in data['poses']:
  print('building '+row['motor']+' '+str(row['angle']),flush=True)
  scope={'App':App,'Part':Part,'math':math,'_quad_rocker_cache':cache};exec(row['source'],scope)
  records,children,metadata=ns['group'](scope,row)
  assert len(records)==115
  old=next(r for r in reference['poses'] if r['motor']==row['motor'] and r['angle']==row['angle']);old_items={i['id']:i for i in old['occurrences']}
  changed={i['id'] for i in row['occurrences'] if i['geometryKey']!=old_items[i['id']]['geometryKey']}
  allowed={i['id'] for i in row['occurrences'] if i['id'].endswith('-case-panel') or i['id'].startswith('cover-section-')}
  assert changed==allowed and len(changed)==8,('Unexpected changed parts',changed,allowed)
  section_ids=sorted(i for i in changed if i.startswith('cover-section-'))
  assert len(section_ids)==4 and all(len(records[k].Solids)==1 for k in section_ids)
  selected=changed;detail={'motor':row['motor'],'angle':row['angle'],'physicalOccurrences':len(records),'validNativeChildren':len(scope['components']),'changedParts':sorted(changed),'checkedPairs':0,'reusedPairs':0,'collisions':[]}
  report['poses'].append(detail);save('valid source built '+row['motor']+' '+str(row['angle']))
  for index,first in enumerate(row['occurrences']):
   for second in row['occurrences'][:index]:
    if first['id'] not in selected and second['id'] not in selected:continue
    key=tuple(sorted([first['geometryKey'],second['geometryKey']]))
    if key in pair_cache:v=pair_cache[key];detail['reusedPairs']+=1
    else:v=ns['overlap'](records[first['id']],records[second['id']]);pair_cache[key]=v
    detail['checkedPairs']+=1
    if v>1e-6:detail['collisions'].append([first['id'],second['id'],v]);print('CLASH '+str(detail['collisions'][-1]),flush=True)
  if row['angle']==0:detail['savedNeutralShapes']=save_neutral(row,records)
  detail['completed']=True;save('fit checked '+row['motor']+' '+str(row['angle']))
  if detail['collisions']:raise AssertionError(('New-part intersections',detail['collisions']))
 for f,h in dict(geometry_sources,**data['preserved']).items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,('Geometry source changed during fit',f)
 report['deferredMetadataFiles']=[f for f in data['sources'] if f not in geometry_sources]
 report['passed']=True;save('all selective six-pose intersections passed')
except BaseException as e:
 report['error']=str(e);save('FAILED');raise
