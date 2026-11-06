"""Verify current mini laser outputs, native blanks and machining schedules."""
import sys,json,math,re,hashlib,time,csv,xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
folder=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-quad-mini-actuator').resolve();started=time.perf_counter()
digest=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
expectedpath=folder/'fabrication-expectations.json';expected=json.loads(expectedpath.read_text())
diameter=expected['frame']['discDiameter']
manifestpath=folder/'TR8-quad-mini-laser-manifest.json';manifest=json.loads(manifestpath.read_text())
assert manifest['mainPlateProfiles']==expected['signature']
assert len(manifest['parts'])==12 and sum(p['quantity'] for p in manifest['parts'])==19
assert sum(p['id'] in ['motor','fixed','end'] for p in manifest['parts'])==3 and all(p['thickness']==3 for p in manifest['parts'])
assert next(p for p in manifest['parts'] if p['id']=='pinned-fork')['quantity']==8
assert manifest['units']=='mm' and manifest['scale']=='1:1'
vec=lambda p:App.Vector(p[0],p[1],0)
close=lambda a,b:(a-b).Length<1e-6

def connected_wires(edges):
 remaining=[e.copy() for e in edges];wires=[]
 while remaining:
  selected=[remaining.pop(0)];start=selected[0].Vertexes[0].Point;end=selected[-1].Vertexes[-1].Point
  while not close(start,end):
   found=False
   for i,e in enumerate(remaining):
    if close(e.Vertexes[0].Point,end):selected.append(remaining.pop(i));found=True;break
    if close(e.Vertexes[-1].Point,end):
     e=remaining.pop(i);e.reverse();selected.append(e);found=True;break
   assert found,'Open laser contour'
   end=selected[-1].Vertexes[-1].Point
  wire=Part.Wire(selected);assert wire.isClosed();wires.append(wire)
 return wires

def cut_face(wires):
 faces=sorted([Part.Face(w) for w in wires],key=lambda x:x.Area,reverse=True)
 assert faces and all(f.isValid() for f in faces)
 face=faces[0]
 for hole in faces[1:]:face=face.cut(hole)
 assert face.isValid() and len(face.Faces)==1
 return face

def dxf_read(path):
 lines=path.read_text().splitlines();assert len(lines)%2==0
 pairs=[(int(lines[i]),lines[i+1]) for i in range(0,len(lines),2)]
 unit=next(v for i,(k,v) in enumerate(pairs) if k==9 and v=='$INSUNITS' for k,v in pairs[i+1:i+2]);assert unit=='4'
 edges=[];wires=[];entities=[];section=False;i=0
 while i<len(pairs):
  code,name=pairs[i]
  if code==2 and name=='ENTITIES':section=True;i+=1;continue
  if section and code==0 and name=='ENDSEC':break
  if section and code==0:
   j=i+1
   while j<len(pairs) and pairs[j][0]!=0:j+=1
   e={k:v for k,v in pairs[i+1:j]};entities.append({'type':name,**e})
   f=lambda k:float(e[k])
   if name=='LINE':edges.append(Part.makeLine(vec([f(10),f(20)]),vec([f(11),f(21)])))
   elif name=='CIRCLE':wires.append(Part.Wire([Part.makeCircle(f(40),vec([f(10),f(20)]))]))
   elif name=='ARC':
    start,end=math.radians(f(50)),math.radians(f(51));end=start+(end-start)%(2*math.pi);middle=(start+end)/2
    point=lambda a:vec([f(10)+f(40)*math.cos(a),f(20)+f(40)*math.sin(a)])
    edges.append(Part.Arc(point(start),point(middle),point(end)).toShape())
   else:raise ValueError('Unexpected DXF entity '+name)
   i=j;continue
  i+=1
 wires+=connected_wires(edges)
 return cut_face(wires),entities,len(wires)

def svg_arc(start,end,r,large,sweep):
 dx,dy=end[0]-start[0],end[1]-start[1];length=math.hypot(dx,dy);assert length>1e-8 and length<=2*r+1e-7
 h=math.sqrt(max(0,r*r-length*length/4));mid=[(start[0]+end[0])/2,(start[1]+end[1])/2]
 for sign in [-1,1]:
  center=[mid[0]+sign*(-dy/length)*h,mid[1]+sign*(dx/length)*h]
  a=math.atan2(start[1]-center[1],start[0]-center[0]);b=math.atan2(end[1]-center[1],end[0]-center[0]);delta=(b-a)%(2*math.pi) if sweep else -((a-b)%(2*math.pi))
  if bool(abs(delta)>math.pi+1e-7)==bool(large):
   middle=[center[0]+r*math.cos(a+delta/2),center[1]+r*math.sin(a+delta/2)]
   return Part.Arc(vec(start),vec(middle),vec(end)).toShape()
 raise ValueError('Invalid SVG circular arc')

def svg_read(path):
 root=ET.parse(path).getroot();view=list(map(float,root.attrib['viewBox'].split()));width=float(root.attrib['width'].removesuffix('mm'));height=float(root.attrib['height'].removesuffix('mm'))
 assert abs(width-view[2])<1e-9 and abs(height-view[3])<1e-9
 wires=[];circlecount=0
 for node in root.iter():
  kind=node.tag.split('}')[-1]
  if kind=='circle':
   wires.append(Part.Wire([Part.makeCircle(float(node.attrib['r']),vec([float(node.attrib['cx']),float(node.attrib['cy'])]))]));circlecount+=1
  elif kind=='path':
   tokens=re.findall(r'[MLAZ]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?',node.attrib['d']);i=0;edges=[];start=current=None
   while i<len(tokens):
    command=tokens[i];i+=1
    if command=='M':
     if edges:wires+=connected_wires(edges);edges=[]
     start=current=[float(tokens[i]),float(tokens[i+1])];i+=2
    elif command=='L':
     point=[float(tokens[i]),float(tokens[i+1])];i+=2
     if math.dist(current,point)>1e-8:edges.append(Part.makeLine(vec(current),vec(point)))
     current=point
    elif command=='A':
     rx,ry,rotation,large,sweep,x,y=map(float,tokens[i:i+7]);i+=7;assert abs(rx-ry)<1e-8 and rotation==0
     point=[x,y];edges.append(svg_arc(current,point,rx,int(large),int(sweep)));current=point
    elif command=='Z':
     if math.dist(current,start)>1e-8:edges.append(Part.makeLine(vec(current),vec(start)))
     wires+=connected_wires(edges);edges=[];current=start
    else:raise ValueError('Unexpected SVG path command '+command)
   if edges:wires+=connected_wires(edges)
 face=cut_face(wires)
 group=next(n for n in root.iter() if n.tag.split('}')[-1]=='g');transform=group.attrib['transform'];assert 'scale(1,-1)' in transform or 'scale(1 -1)' in transform
 translate=re.search(r'translate\(([^)]+)\)',transform);tx,ty=map(float,translate.group(1).replace(',',' ').split()) if translate else (0,0)
 bb=face.BoundBox
 assert bb.XMin+tx>=view[0]-1e-6 and bb.XMax+tx<=view[0]+view[2]+1e-6
 assert -bb.YMax+ty>=view[1]-1e-6 and -bb.YMin+ty<=view[1]+view[3]+1e-6
 return face,len(wires),{'physicalWidthMm':width,'physicalHeightMm':height,'oneDrawingUnitPerMillimetre':True,'withinViewport':True,'circles':circlecount}

def transform(shape,translation,rotation):
 for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):
  if angle:shape.rotate(App.Vector(),axis,angle)
 shape.translate(App.Vector(*translation));return shape
macropath=folder/'TR8-quad-mini-laser-blanks.FCMacro';scope={'App':App,'Part':Part,'math':math};exec(macropath.read_text(),scope);doc=scope['doc'];objects={o.Name:o for o in doc.Objects if hasattr(o,'Shape')};assert len(objects)==19
records=[];pilots=0;roundOuter=0;forkPilots=0;macroVerified=0
for row in expected['analytical']:
 identity=row['id'];thickness=row['thickness'];dxfpath=folder/f'TR8-quad-mini-{identity}-{thickness}mm.dxf';svgpath=dxfpath.with_suffix('.svg')
 dxf,entities,wirecount=dxf_read(dxfpath);svg,svgwires,svgmeta=svg_read(svgpath)
 pairdiff=dxf.cut(svg).Area+svg.cut(dxf).Area;assert pairdiff<1e-6,(identity,'DXF/SVG',pairdiff)
 analyticalscope={'App':App,'Part':Part,'math':math,'_pl_transform':transform};exec(row['flatCutSource'],analyticalscope);analytical=analyticalscope['shape'];assert analytical.isValid() and analytical.isClosed() and len(analytical.Solids)==1
 exported=dxf.extrude(App.Vector(0,0,thickness));assert exported.isValid() and exported.isClosed() and len(exported.Solids)==1
 diff=exported.cut(analytical).Volume+analytical.cut(exported).Volume;assert diff<1e-5,(identity,'analytic',diff)
 placementChecks=[]
 for placement in row['nativePlacements']:
  blank=objects[placement['name']].Shape.copy()
  assert blank.isValid() and blank.isClosed() and len(blank.Solids)==1
  for frame in placement['chain']:
   blank.translate(-App.Vector(*frame['translation']))
   for axis,angle in reversed(list(zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],frame['rotation']))):
    if angle:blank.rotate(App.Vector(),axis,-angle)
  if row['kind']=='cheek':
   blank.translate(App.Vector(0,-row['sheetLowY'],0));blank.rotate(App.Vector(),App.Vector(1,0,0),-90);blank.translate(App.Vector(0,0,thickness))
  nativeDiff=blank.cut(analytical).Volume+analytical.cut(blank).Volume;assert nativeDiff<1e-5,(identity,'nativeBlankMacro',nativeDiff)
  placementChecks.append({'name':placement['name'],'symmetricDifferenceMm3':nativeDiff});macroVerified+=1
 circles=[e for e in entities if e['type']=='CIRCLE'];pilotCount=sum(abs(float(e[40])-(6.4 if row['kind']=='main' else 4.9))<1e-7 for e in circles) if row['kind']!='fork' else 0;pilots+=pilotCount
 isround=row['kind']=='main' and sum(abs(float(e[40])-diameter/2)<1e-7 and abs(float(e[10]))<1e-7 and abs(float(e[20]))<1e-7 for e in circles)==1
 roundOuter+=isround
 assert row['kind']!='main' or isround
 if row['kind']=='fork':
  assert sum(abs(float(e[40])-2.9)<1e-7 for e in circles)==1;forkPilots+=row['quantity']
 records.append({'id':identity,'kind':row['kind'],'quantity':row['quantity'],'thicknessMm':thickness,'pilotCount':pilotCount,'closedCutWires':wirecount,'svgClosedCutWires':svgwires,'svgScale':svgmeta,'roundMainOuterCircle':bool(isround),'nativeSingleClosedSolid':True,'volumeMm3':analytical.Volume,'dxfSvgSymmetricDifferenceMm2':pairdiff,'dxfAnalyticSymmetricDifferenceMm3':diff,'nativeMacroPlacementChecks':placementChecks,'dxfSha256':digest(dxfpath),'svgSha256':digest(svgpath)})
 print('verified',identity,'pilotCount',pilotCount,'vol',analytical.Volume,flush=True)
assert pilots==16 and forkPilots==8 and macroVerified==19 and roundOuter==3 and all(r['thicknessMm']==3 for r in records)
for row in expected['files']:assert digest(folder/row['name'])==row['sha256']
screwpath=folder/'TR8-quad-mini-screw-turning.json';screw=json.loads(screwpath.read_text());shaftpath=folder/'TR8-quad-mini-output-shaft-turning.json';shaft=json.loads(shaftpath.read_text())
assert screw['finishedLength']==52 and screw['blank']['starts']==4 and screw['blank']['pitch']==2 and screw['blank']['lead']==8
assert sorted(g['center'] for g in screw['grooves'])==[-20.8,-15.2,15.2,20.8]
assert any(s['from']==-14 and s['to']==14 and s['diameter']==8 for s in screw['stations'])
assert shaft['finishedEnds']==[-16,27.5] and abs(shaft['finishedLength']-43.5)<1e-9
assert sorted(g['center'] for g in shaft['grooves'])==[-14.4,14.4]
assert sorted(g['centerY'] for g in shaft['crossBores'])==[-8.05,8.05] and all(g['diameter']==2 for g in shaft['crossBores'])
assert shaft['pins']['quantityPerShaft']==2 and '2×10' in shaft['pins']['designation']
bom=list(csv.DictReader((folder/'TR8-quad-mini-component-list.csv').read_text().splitlines()));assert len(bom)==expected['bomOccurrenceCount'] and len({r['ID'] for r in bom})==len(bom)
report={'passed':True,'mainRoundDiscs':3,'mainDiscDiameterMm':diameter,'mainStockThicknessMm':3,'bearingCheeks':8,'cheekStockThicknessMm':3,'forkQuantity':8,'forkStockThicknessMm':3,'actualDxfSvgPairs':12,'bearingPilots':16,'pilotDiametersMm':{'screw':12.8,'output':9.8},'forkShaftPilots':8,'forkShaftPilotDiameterMm':5.8,'nativeMacroSingleClosedSolids':19,'machiningSchedulesPassed':True,'componentListOccurrences':len(bom),'mainProfileSignature':expected['signature'],'filesEqualCurrentPartApi':expected['files'],'parts':records,'provenance':{'expectationsSha256':digest(expectedpath),'manifestSha256':digest(manifestpath),'nativeMacroSha256':digest(macropath),'screwScheduleSha256':digest(screwpath),'shaftScheduleSha256':digest(shaftpath),'checkerSha256':digest(__file__)},'elapsedSeconds':time.perf_counter()-started}
(folder/'fabrication-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:report[k] for k in ['passed','mainRoundDiscs','bearingCheeks','actualDxfSvgPairs','bearingPilots','nativeMacroSingleClosedSolids','elapsedSeconds']}),flush=True)
App.closeDocument(doc.Name)
