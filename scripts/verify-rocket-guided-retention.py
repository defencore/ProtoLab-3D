"""Native expected-contact probes, separate from collision-free assembly motions."""
import sys,json,hashlib,math
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
specfile=Path(sys.argv[1]);folder=Path(sys.argv[2]);output=Path(sys.argv[3])
spec=json.loads(specfile.read_text());settings=spec['retentionProbes']
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for binding in spec['sourceBindings']['files']:
 assert digest(Path(binding['path']))==binding['sha256'],'Stale specification source: '+binding['path']
shapes={};breps={}
for id in spec['liveOccurrenceIds']:
 file=folder/(id+'.brep');s=Part.Shape();s.read(str(file))
 assert s.isValid() and s.isClosed() and s.Solids and s.Volume>0,id
 shapes[id]=s;breps[id]=digest(file)
def substantial(a,b):
 return all(min(getattr(a,k+'Max'),getattr(b,k+'Max'))-max(getattr(a,k+'Min'),getattr(b,k+'Min'))>1e-7 for k in ['X','Y','Z'])
def overlap(a,b):
 if not substantial(a.BoundBox,b.BoundBox):return 0
 return max(0,a.common(b).Volume)
tolerance=settings['overlapVolume'];distances=sorted(set(abs(x) for x in settings['signedDistances']))
report={'validatorSHA256':digest(Path(__file__)),'specificationSHA256':digest(specfile),'sourceBreps':breps,'groups':[],'scope':settings['scope']}
for group in settings['groups']:
 moving=group['movingIds'];obstacles=group['obstacleIds'];assert not set(moving)&set(obstacles)
 static=[]
 for mid in moving:
  for oid in obstacles:
   v=overlap(shapes[mid],shapes[oid])
   if v>tolerance:static.append({'movingId':mid,'obstacleId':oid,'overlapVolume':v})
 row={'id':group['id'],'staticInterference':static,'directions':[]}
 for axis in range(3):
  for sign in [-1,1]:
   first=None
   for distance in distances:
    delta=[0,0,0];delta[axis]=distance*sign;hits=[]
    for mid in moving:
     shifted=shapes[mid].copy();shifted.translate(App.Vector(*delta))
     for oid in obstacles:
      v=overlap(shifted,shapes[oid])
      if v>tolerance:hits.append({'movingId':mid,'obstacleId':oid,'overlapVolume':v})
    if hits:first={'distance':distance,'contacts':hits};break
   row['directions'].append({'axis':'xyz'[axis],'sign':sign,'firstObservedBlock':first,'passed':first is not None and not static})
 row['passed']=not static and all(x['passed'] for x in row['directions'])
 report['groups'].append(row);print(json.dumps({'id':row['id'],'passed':row['passed'],'unblocked':[x['axis']+str(x['sign']) for x in row['directions'] if not x['passed']]}),flush=True)
report['passed']=all(x['passed'] for x in report['groups'])
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'output':str(output),'passed':report['passed'],'groups':len(report['groups'])}),flush=True)

sys.exit(0 if report["passed"] else 1)
