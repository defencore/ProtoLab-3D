import sys,json,math,time,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
V=App.Vector
out=Path('test-results/tr8-quad-geared-rocker-lightened-cables');d=json.loads((out/'metal-capture.json').read_text());start=time.monotonic();r={'passed':False,'scope':'Six modified metal parts: valid single bodies, panel subtraction,3mm relief lands, unchanged welding-slot/Z envelopes, native custom-part volume deltas.','families':[]}
def save(stage):r['stage']=stage;r['elapsedSeconds']=time.monotonic()-start;(out/'metal-native-report.json').write_text(json.dumps(r,indent=2)+'\n');print(stage,flush=True)
def matrix(e):
 m=App.Matrix()
 for a in range(4):
  for b in range(4):setattr(m,'A'+str(a+1)+str(b+1),e[a+4*b])
 return m
def paneltool(t,z0,z1,radius):
 a=Part.makeCylinder(radius,2.8,V(15.6,t,z0),V(1,0,0))
 if z1>z0:a=a.fuse(Part.makeCylinder(radius,2.8,V(15.6,t,z1),V(1,0,0))).fuse(Part.makeBox(2.8,2*radius,z1-z0,V(15.6,t-radius,z0)))
 return a
features=[('circle',x['id'],x['center'][0],x['center'][1],x['center'][1],x['radius'])for x in d['panelCircles']]+[('slot',x['id'],x['t'],x['from'],x['to'],x['radius'])for x in d['panelSlots']]
try:
 for f,h in d['sources'].items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,('Stale frozen metal',f)
 for family in d['families']:
  motor=family['motor'];scope={'App':App,'Part':Part,'math':math};exec(family['source'],scope);shapes={meta['AssemblyOccurrenceId']:s for meta,s in zip(scope['component_metadata'],scope['components'])};assert len(shapes)==6
  dest=out/'native-metal'/motor;dest.mkdir(parents=True,exist_ok=True);fr={'motor':motor,'parts':[],'panelLands':[],'discLands':[]};r['families'].append(fr)
  for key,s in shapes.items():
   assert s.isValid()and s.isClosed()and len(s.Solids)==1,('Invalid metal',key);old=Part.Shape();old.read(str(Path('test-results/tr8-quad-geared-rocker-five-stand/native-shapes')/motor/(key+'.brep')));added=abs(s.cut(old).Volume);removed=abs(old.cut(s).Volume)
   row={'id':key,'validClosedSingleSolid':True,'beforeVolumeMm3':old.Volume,'afterVolumeMm3':s.Volume,'addedVolumeMm3':added,'removedVolumeMm3':removed,'netVolumeLossMm3':old.Volume-s.Volume};fr['parts'].append(row);assert row['netVolumeLossMm3']>0
   if key.endswith('-case-panel'):
    assert added<1e-5,('Non-subtractive panel',key,added);assert abs(row['netVolumeLossMm3']-family['values']['panels']['nominalRemovedVolumePerPanel'])<.02,('Unexpected panel volume loss',key,row)
   else:
    inside=d['fixed']['panelHigh']-d['fixed']['endTongueLength'];lo,hi=(inside,inside+3)if key.startswith('upper')else(-inside-3,-inside);assert abs(s.BoundBox.ZMin-lo)<1e-6 and abs(s.BoundBox.ZMax-hi)<1e-6,('DiscZchanged',key)
    row['occupiedZ']=[s.BoundBox.ZMin,s.BoundBox.ZMax]
   s.exportBrep(str(dest/(key+'.brep')))
  save(motor+' six metal bodies and volume deltas passed')
  # Every real panel occurrence; annular/capsule bands preserve3mm around all reliefs.
  for index,e in enumerate(d['panelFrames']):
   s=shapes['abcd'[index]+'-case-panel']
   for kind,name,t,z0,z1,radius in features:
    stock=paneltool(t,z0,z1,radius+3).cut(paneltool(t,z0,z1,radius));stock.transformShape(matrix(e));ratio=s.common(stock).Volume/stock.Volume;assert ratio>.999,('Panel relief land lost','abcd'[index],name,ratio);fr['panelLands'].append({'panel':'abcd'[index],'id':name,'threeMmStockRatio':ratio})
  for end,e in zip(['upper','lower'],d['endDiscFrames']):
   s=shapes[end+'-end-disc'];frame=matrix(e)
   for feature in family['discCircles']:
    x,y=feature['center'];rad=feature['radius'];outer=Part.makeCylinder(rad+3,2.8,V(x,y,.1));inner=Part.makeCylinder(rad,2.8,V(x,y,.1));band=outer.cut(inner);band.transformShape(frame);ratio=s.common(band).Volume/band.Volume;assert ratio>.999,('Disc relief land lost',end,feature['id'],ratio);fr['discLands'].append({'end':end,'id':feature['id'],'threeMmStockRatio':ratio})
   for n in[-17,17]:
    lo,hi=-(50-3.15)/2,(50-3.15)/2;void=Part.makeBox(3.15,hi-lo,3.2,V(n-1.575,lo,-.1)).fuse(Part.makeCylinder(1.575,3.2,V(n,lo,-.1))).fuse(Part.makeCylinder(1.575,3.2,V(n,hi,-.1)));void.transformShape(frame);assert abs(s.common(void).Volume)<1e-6,('Weldslotclosed',end,n)
  fr['completed']=True;save(motor+' all actual3mm relief lands and weld slots passed')
 for f,h in d['sources'].items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,('Metal sourcechanged',f)
 r['passed']=True;save('frozen metal proof passed')
except BaseException as e:r['error']=str(e);save('FAILED');raise
