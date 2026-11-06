import sys,math,json,hashlib,importlib.util,re
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
spec=importlib.util.spec_from_file_location('motion','scripts/add-tr8-quad-motion.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base=Path('test-results/tr8-quad-actuator');docs=[];bodies=[];count=0;numeric=m.re.compile(r'[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$')
for name in ['quad-full-neutral','quad-full-motion']:
 d=App.openDocument(str((base/(name+'.FCStd')).resolve()));docs.append(d);root=next(o for o in d.RootObjects if getattr(o,'PartId',None)==m.PART_ID);rows={}
 for ob in m.features(root):
  text=m.local_body(ob).exportBrepToString()
  for token in text.split():
   assert token.lower() not in ['nan','inf','infinity','+inf','-inf','+infinity','-infinity']
   if numeric.fullmatch(token):assert math.isfinite(float(token));count+=1
  rows[ob.ComponentIndex]=[text,ob.AssemblyOccurrenceId,ob.Label,list(ob.SourceRGB)]
 bodies.append(rows)
assert bodies[0].keys()==bodies[1].keys();stats=[]
for i in bodies[0]:
 a,b=bodies[0][i],bodies[1][i];assert a[1:]==b[1:];stats.append(m.verify_serialized_body(a[0],b[0]))
report=dict(passed=True,components=len(stats),numericTokensVerifiedFinite=count,changedComponents=sum(s['changedNumericTokens']>0 for s in stats),maxAbsoluteDelta=max(s['maxAbsoluteDelta'] for s in stats),maxRelativeDelta=max(s['maxRelativeDelta'] for s in stats),relativeSerializationBound=5e-15,sourceSha256=hashlib.sha256((base/'quad-full-neutral.FCStd').read_bytes()).hexdigest(),motionSha256=hashlib.sha256((base/'quad-full-motion.FCStd').read_bytes()).hexdigest(),scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),freecad='.'.join(App.Version()[:3]))
(base/'motion-body-persistence.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
for d in docs:App.closeDocument(d.Name)
