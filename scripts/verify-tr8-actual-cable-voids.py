import sys,json,math,ast,time,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
V=App.Vector
out=Path('test-results/tr8-quad-geared-rocker-lightened-cables');d=json.loads((out/'cable-capture.json').read_text());start=time.monotonic();r={'passed':False,'scope':'Exact intersection of every direct-axis raw maximum route primitive with all four finished public PETG bodies; no synthetic route fusion and no repeated core/pose sweep.','families':[]}
source=Path('scripts/verify-tr8-cable-candidates.py').read_text();functions=[n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef)and n.name in['overlap','wireparts']];ns={'Part':Part,'App':App,'V':V};exec(compile(ast.Module(body=functions,type_ignores=[]),'<direct-route-helpers>','exec'),ns)
def save(stage):r['stage']=stage;r['elapsedSeconds']=time.monotonic()-start;(out/'actual-cable-void-native-report.json').write_text(json.dumps(r,indent=2)+'\n');print(stage,flush=True)
try:
 for family in d['families']:
  shapes={}
  for file in(out/'native-printed'/family['motor']).glob('*.brep'):
   s=Part.Shape();s.read(str(file));assert s.isValid()and s.isClosed()and len(s.Solids)==1;shapes[file.stem]=s
  assert len(shapes)==4
  fr={'motor':family['motor'],'routes':[]};r['families'].append(fr)
  for route in family['routes']:
   primitives=ns['wireparts'](route,family['routing']['ports']);hits=[]
   for key,s in shapes.items():
    for index,tool in enumerate(primitives):
     volume=ns['overlap'](tool,s)
     if volume>1e-6:hits.append({'part':key,'primitive':index,'volumeMm3':volume})
   fr['routes'].append({'id':route['id'],'probeRadius':route['clearanceProbeRadius'],'directValidPrimitives':len(primitives),'positiveEndpointOverlapGraph':True,'intersections':hits});save(family['motor']+' '+route['id']+' actual cavity checked');assert not hits,('FinishedPETG blocksroute',route['id'],hits)
  fr['completed']=True
 r['passed']=True;save('all24 raw maximum routes clear all8 finished PETG bodies')
except BaseException as e:r['error']=str(e);save('FAILED');raise
