"""Subtractive release change: inherit six-pose non-interference only after a native subset proof."""
import sys,json,hashlib,time
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part,math
out=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-quad-geared-rocker-covers-final');d=json.loads((out/'release-capture.json').read_text());started=time.monotonic()
r={'passed':False,'scope':'Native subset/validity proof for the four revised pocket sections;111 other geometry keys unchanged. Six-pose fit is inherited through material subtraction.','families':[],'sources':d['sources']}
def save():r['elapsedSeconds']=time.monotonic()-started;(out/'release-subset-native-report.json').write_text(json.dumps(r,indent=2)+'\n')
try:
 for path,h in dict(d['sources'],**d['preserved']).items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==h,('Stale source',path)
 for row in d['poses']:
  folder=out/'native-shapes'/row['motor'];archive=folder/'pre-release-fix';archive.mkdir(exist_ok=True)
  scope={'App':App,'Part':Part,'math':math};exec(row['source'],scope);entries=[]
  for new,meta in zip(scope['components'],scope['component_metadata']):
   key=meta['AssemblyOccurrenceId'];old=Part.Shape();old.read(str(folder/(key+'.brep')))
   assert len(new.Solids)==1 and new.isValid() and new.isClosed(),('Invalid release section',key)
   added=abs(new.cut(old).Volume);removed=abs(old.cut(new).Volume);assert added<1e-5,('Non-subtractive release change',key,added)
   if not (archive/(key+'.brep')).exists():old.exportBrep(str(archive/(key+'.brep')))
   new.exportBrep(str(folder/(key+'.brep')));entries.append({'id':key,'validClosedSingleSolid':True,'addedVolume':added,'removedVolume':removed,'volume':new.Volume})
  (folder/'row.json').write_text(json.dumps({k:v for k,v in row.items() if k!='source'},indent=2)+'\n');r['families'].append({'motor':row['motor'],'sections':entries,'unchangedOtherGeometryKeys':111});save();print(row['motor']+' native subset passed',flush=True)
 r['passed']=True;save()
except BaseException as e:r['error']=str(e);save();raise
