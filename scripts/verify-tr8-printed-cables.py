import sys,json,math,time,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
out=Path('test-results/tr8-quad-geared-rocker-lightened-cables');d=json.loads((out/'printed-capture.json').read_text());start=time.monotonic();selected=sys.argv[1] if len(sys.argv)>1 else None;reportName=('printed-native-report-'+selected+'.json') if selected else 'printed-native-report.json';r={'passed':False,'scope':'Actual public native PETG factory bodies; exact route clearance follows in a separate witness report.','families':[]};cache={}
def save(stage):r['stage']=stage;r['elapsedSeconds']=time.monotonic()-start;(out/reportName).write_text(json.dumps(r,indent=2)+'\n');print(stage,flush=True)
try:
 for f,h in dict(d['sources'],**d['preserved']).items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,('Stale source',f)
 for family in d['families']:
  if selected and family['motor']!=selected:continue
  dest=out/'native-printed'/family['motor'];dest.mkdir(parents=True,exist_ok=True);fr={'motor':family['motor'],'parts':[]};r['families'].append(fr)
  for piece in family['pieces']:
   save('building '+family['motor']+' '+piece['id']);scope={'App':App,'Part':Part,'math':math,'_quad_rocker_cache':cache};exec(piece['source'],scope);s=scope['components'][0];assert s.isValid()and s.isClosed()and len(s.Solids)==1,piece['id'];s.exportBrep(str(dest/(piece['id']+'.brep')))
   before=Part.Shape();before.read(str(Path('test-results/tr8-quad-geared-rocker-five-stand/native-shapes')/family['motor']/(piece['id']+'.brep')))
   fr['parts'].append({'id':piece['id'],'valid':True,'closed':True,'singleSolid':True,'beforeVolumeMm3':before.Volume,'afterVolumeMm3':s.Volume,'netVolumeLossMm3':before.Volume-s.Volume})
   if family['motor']=='surpass-2838-3700kv'and piece['id']=='cover-section-1':s.exportStl(str(out/'cover-section-1.stl'));print('REVIEW_STL '+str(out/'cover-section-1.stl'),flush=True)
   save(family['motor']+' '+piece['id']+' valid one-body saved')
  fr['completed']=True
 for f,h in d['sources'].items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,('Source changed during body build',f)
 r['passed']=True;save('selected actual PETG bodies valid and saved')
except BaseException as e:r['error']=str(e);save('FAILED');raise
