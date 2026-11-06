"""Bounded withdrawal regression after the0.5mm outer-radius increase."""
import sys,json,math,time
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as A,Part
V=A.Vector
out=Path(sys.argv[1]if len(sys.argv)>1 else'test-results/tr8-quad-geared-rocker-centered-stand');r={'passed':False,'scope':'Two unique section configurations per family at0.6mm critical release and80mm fully clear; opposite parts follow exact half-turn instances. Four cover screws removed.','routes':[]};start=time.monotonic()
def common(a,b):
 if any(min(getattr(a.BoundBox,k+'Max'),getattr(b.BoundBox,k+'Max'))-max(getattr(a.BoundBox,k+'Min'),getattr(b.BoundBox,k+'Min'))<1e-8 for k in'XYZ'):return 0.
 return abs(a.common(b).Volume)
def save():r['elapsedSeconds']=time.monotonic()-start;(out/'removal-regression-native-report.json').write_text(json.dumps(r,indent=2)+'\n')
try:
 for motor in['surpass-2838-3700kv','surpass-2845-3100kv']:
  s={}
  for f in(out/'native-shapes'/motor).glob('*.brep'):
   if f.stem.startswith('cover-bolt-'):continue
   x=Part.Shape();x.read(str(f));s[f.stem]=x
  for index in[0,1]:
   key='cover-section-'+str(index+1);axis=[V(1,0,0),V(0,1,0)][index];route={'motor':motor,'section':key,'stations':[]};r['routes'].append(route)
   for offset in[.6,80]:
    moving=s[key].copy();moving.translate(axis*offset);hits=[]
    for name,shape in s.items():
     if name==key:continue
     volume=common(moving,shape)
     if volume>1e-6:hits.append([name,volume])
    route['stations'].append({'offset':offset,'collisions':hits});assert not hits,(motor,key,offset,hits)
   print(motor+' '+key+' release passed',flush=True);save()
 r['passed']=True;save()
except BaseException as e:r['error']=str(e);save();raise
