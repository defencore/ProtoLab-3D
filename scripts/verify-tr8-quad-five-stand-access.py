"""Actual native stand-tap stock, pilot continuity, screw intrusion and PETG/tool access."""
import sys,json,math,time,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as A,Part
V=A.Vector
out=Path(sys.argv[1]if len(sys.argv)>1 else'test-results/tr8-quad-geared-rocker-five-stand');d=json.loads((out/'capture.json').read_text());started=time.monotonic()
r={'passed':False,'scope':'All20stand mounting axes in both motor families; actual threaded-panel stock, open pilots, PETG passages and bounded0.5mm inboard screw projection. External stand/fastener selection is not modeled.','sources':d['sources'],'families':[]}
def save(stage):r['stage']=stage;r['elapsedSeconds']=time.monotonic()-started;(out/'stand-access-native-report.json').write_text(json.dumps(r,indent=2)+'\n');print(stage,flush=True)
def common(a,b):
 if any(min(getattr(a.BoundBox,k+'Max'),getattr(b.BoundBox,k+'Max'))-max(getattr(a.BoundBox,k+'Min'),getattr(b.BoundBox,k+'Min'))<1e-8 for k in'XYZ'):return 0.
 return abs(a.common(b).Volume)
def cyl(radius,length,point,axis):return Part.makeCylinder(radius,length,point,axis)
try:
 fresh=json.loads((out/'release-capture.json').read_text()) if (out/'release-capture.json').exists() else d
 r['sources']=fresh['sources']
 for path,h in dict(fresh['sources'],**fresh['preserved']).items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==h,('Stale source',path)
 for motor in['surpass-2838-3700kv','surpass-2845-3100kv']:
  folder=out/'native-shapes'/motor;row=json.loads((folder/'row.json').read_text());s={}
  for f in folder.glob('*.brep'):
   shape=Part.Shape();shape.read(str(f));s[f.stem]=shape
  family={'motor':motor,'standAxes':[],'envelope':[]};r['families'].append(family)
  side=next(f for f in cyl(100,200,V(0,0,-100),V(0,0,1)).Faces if type(f.Surface).__name__=='Cylinder')
  for key in[k for k in s if k.startswith('cover-')or k.endswith('-end-disc')]:
   radius=100-s[key].distToShape(side)[0];assert radius<=row['values']['outerRadius']+1e-5,(key,radius);family['envelope'].append({'id':key,'maximumRadius':radius})
  for station in d['standMountStations']:
   p=V(*station['plateFace']);a=V(*station['axis']);inside=p-a*3;panel='abcd'[station['panelIndex']]+'-case-panel';shape=s[panel]
   pilot=cyl(1.,3.2,inside-a*.1,a);assert common(pilot,shape)<1e-7,('Closed pilot',station['id'])
   stock=cyl(2.5,2.8,inside+a*.1,a).cut(cyl(1.65,2.8,inside+a*.1,a));ratio=common(stock,shape)/stock.Volume;assert ratio>.999,('Incomplete tap land',station['id'],ratio)
   tool=cyl(1.65,70,p+a*.05,a);extension=cyl(1.5,.5,inside-a*.5,a);headPoint=p+a*(row['values']['outerRadius']+.1-p.dot(a));head=cyl(2.75,3,headPoint,a);hits=[]
   for key,other in s.items():
    if key==panel:continue
    v=common(tool,other);w=common(extension,other);h=common(head,other)
    if max(v,w,h)>1e-6:hits.append([key,v,w,h])
   assert not hits,('Stand screw/driver blocked',station['id'],hits)
   family['standAxes'].append({'id':station['id'],'panel':panel,'pilotOpen':True,'surroundingAnnularStockRatio':ratio,'stockOuterRadius':2.5,'stockInnerRadius':1.65,'fullDepthStockLength':2.8,'shankRadius':1.65,'headEnvelopeRadius':2.75,'headOutwardCoordinate':row['values']['outerRadius']+.1,'headOutsidePlastic':True,'inboardProjection':.5,'collisions':hits})
  family['validSingleSolidSections']=all(s['cover-section-'+str(i+1)].isValid()and s['cover-section-'+str(i+1)].isClosed()and len(s['cover-section-'+str(i+1)].Solids)==1 for i in range(4));assert family['validSingleSolidSections'];save(motor+' all20stand axes passed')
 r['passed']=True;save('all stand taps, stock, insertion and tool passages passed')
except BaseException as e:r['error']=str(e);save('FAILED');raise
