"""Execute the exact exported component programs/poses; cache only matching program hashes."""
import sys,json,hashlib,re,math,time,textwrap
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
out=Path('test-results/ov9281-camera-variants');cases=json.loads((out/'variants.json').read_text());cache=out/'native-cache';cache.mkdir(exist_ok=True)
selected=sys.argv[1:] or ['ov9281','dual']
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def substantial(a,b):
 return all(min(getattr(a,k+'Max'),getattr(b,k+'Max'))-max(getattr(a,k+'Min'),getattr(b,k+'Min'))>0.001 for k in ['X','Y','Z'])
for case in cases:
 if case['setup'] not in selected:continue
 setup=case['setup'];macro=(out/case['macro']).read_text();digest=sha(macro)
 blocks=re.findall(r'component, local_metadata = _pl_component\(([^\n]*)\)\n(.*?)        local_metadata = _pl_placed_metadata',macro,re.S)
 assert len(blocks)==len(case['components']),(len(blocks),len(case['components']))
 print('Building',setup,flush=True);shapes={};report={'setup':setup,'macroSHA256':digest,'invalid':[],'printedMultibody':[],'overlaps':[],'reserves':{},'routes':case['routes'],'programs':{}}
 folder=out/setup;folder.mkdir(exist_ok=True)
 for meta,(literal,pose) in zip(case['components'],blocks):
  id=meta['id'];source=json.loads(literal);pose=textwrap.dedent(pose);key=sha(source+'\n'+pose);path=cache/(key+'.brep')
  if path.exists():s=Part.Shape();s.read(str(path))
  else:
   ns={'App':App,'Part':Part,'math':math};exec(source,ns);s=ns['shape'];ns['component']=s;exec(pose,ns);s.exportBrep(str(path))
  shapes[id]=s;report['programs'][id]=key;s.exportBrep(str(folder/(id+'.brep')))
  if not s.isValid() or not s.isClosed() or not s.Solids or s.Volume<=0:report['invalid'].append(id)
  if meta.get('printed') and len(s.Solids)!=1:report['printedMultibody'].append([id,len(s.Solids)])
 print('Topology',report['invalid'],report['printedMultibody'],flush=True)
 ids=list(shapes);checked=0
 for i,id in enumerate(ids):
  a=shapes[id]
  for other in ids[i+1:]:
   b=shapes[other]
   if not substantial(a.BoundBox,b.BoundBox):continue
   checked+=1;v=a.common(b).Volume
   if v>0.01:report['overlaps'].append([id,other,round(v,5)])
 report['exactPairChecks']=checked;print('Overlaps',report['overlaps'],flush=True)
 ns={'App':App,'Part':Part};exec((out/(setup+'-reserves.py')).read_text(),ns)
 ribbons=[(name,shape) for name,shape in ns.items() if name.startswith('csi_')]
 for i,(name,a) in enumerate(ribbons):
  for other,b in ribbons[i+1:]:
   v=a.common(b).Volume
   if v>0.01:report['overlaps'].append([name,other,round(v,5)])
 for name,reserve in ns.copy().items():
  if name!='ethernet' and not name.startswith('csi_'):continue
  hits=[]
  for id,s in shapes.items():
   if not substantial(reserve.BoundBox,s.BoundBox):continue
   v=reserve.common(s).Volume
   if v>0.01:hits.append([id,round(v,5)])
  report['reserves'][name]=hits
 print('Reserves',report['reserves'],flush=True)
 assert sha((out/case['macro']).read_text())==digest,'Source changed during audit; rerun.'
 report['passed']=not any([report['invalid'],report['printedMultibody'],report['overlaps'],any(report['reserves'].values()),any(r['slack']<0 for r in report['routes'])])
 (out/(setup+'-report.json')).write_text(json.dumps(report,indent=2));print(setup,'PASS' if report['passed'] else 'FAIL',flush=True)
