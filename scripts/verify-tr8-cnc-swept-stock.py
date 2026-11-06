"""Continuous cross-channel clearance from source-positive stocks, not pose sampling.

Every Full native solid is independently proved contained in its authored positive
stock. Subtractions cannot enlarge a stock. Analytic extrema bound each stock for
all independent output angles in [-20,20], including continuously rotating drive
parts. A separating world coordinate proves disjointness. The common 45 degree
mount clock is omitted only because one rigid rotation preserves every distance.
This certificate covers channels; the shared perforated frame is audited separately.
"""
import sys, json, math, hashlib, itertools, time
from pathlib import Path
sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App, Part

DIRECTORY = Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-quad-cnc-actuator/channel')
RADIUS = float(sys.argv[2]) if len(sys.argv)>2 else 20.25
TIER = float(sys.argv[3]) if len(sys.argv)>3 else 0
COLUMN_X_SPAN = (-56,26)
ARRANGEMENT = sys.argv[4] if len(sys.argv)>4 else 'radial'
assert ARRANGEMENT in ['radial','pinwheel']
EPS = 1e-5  # Explicit outward numerical stock padding, not a manufacturing fit.
A = math.radians(20)
LEVER_RADIUS = 10.0
SCREW_Z = 10.0
TRAVEL = LEVER_RADIUS*math.tan(A)
PIVOT = (10,0,0)
START=time.monotonic()
def vec(v): return App.Vector(*v)
def xyz(v): return [v.x,v.y,v.z]
def bounds(shape):
 b=shape.BoundBox
 return [[b.XMin,b.YMin,b.ZMin],[b.XMax,b.YMax,b.ZMax]]
def corners(b): return [list(p) for p in itertools.product(*zip(*b))]
def transform(translation=(0,0,0),rotation=(0,0,0)):
 q=App.Rotation()
 for axis,angle in zip([(1,0,0),(0,1,0),(0,0,1)],rotation): q=App.Rotation(vec(axis),angle).multiply(q)
 return App.Placement(vec(translation),q)
def box_cell(b): return dict(kind='box',points=corners(b),bounds=b)
def cyl_cell(radius,height,origin,axis,placement):
 base=placement.multVec(vec(origin)); direction=placement.Rotation.multVec(vec(axis))
 tip=base+direction*height
 return dict(kind='cylinder',radius=radius,base=xyz(base),tip=xyz(tip),axis=xyz(direction))
def cell_shape(cell,padding=0):
 if cell['kind']=='cylinder':
  base=vec(cell['base']); tip=vec(cell['tip']); direction=tip-base; length=direction.Length; direction.normalize()
  return Part.makeCylinder(cell['radius']+padding,length+2*padding,base-direction*padding,direction)
 b=cell['bounds']; lo=[v-padding for v in b[0]]; size=[b[1][i]-b[0][i]+2*padding for i in range(3)]
 return Part.makeBox(*size,vec(lo))
def cell_bounds(c): return bounds(cell_shape(c))
def stocks(s,p):
 kind=s['kind']
 if kind=='transform': return stocks(s['child'],p.multiply(transform(s['translation'],s['rotation'])))
 if kind=='subtract': return stocks(s['children'][0],p)
 if kind=='union': return list(itertools.chain.from_iterable(stocks(c,p) for c in s['children']))
 if kind=='intersect':
  groups=[stocks(c,p) for c in s['children']]
  # The radial layout also needs round stock constraints for its neighbouring
  # columns. An intersection is contained in either full positive cylinder.
  boxes=[bounds(Part.makeCompound([cell_shape(c) for c in group])) for group in groups]
  b=[[max(x[0][a] for x in boxes) for a in range(3)],[min(x[1][a] for x in boxes) for a in range(3)]]
  assert all(b[1][a]>b[0][a] for a in range(3))
  # If one operand's entire stock is inside the other operands' boxes and those
  # operands are single boxes, retain its exact cylinder rather than a box.
  for i,group in enumerate(groups):
   if all(j==i or (len(groups[j])==1 and groups[j][0]['kind']=='box' and all(boxes[j][0][a]<=boxes[i][0][a]+1e-9 and boxes[j][1][a]>=boxes[i][1][a]-1e-9 for a in range(3))) for j in range(len(groups))):
    return group
  return [box_cell(b)]
 if kind=='box':
  lo=s['origin']; hi=[lo[a]+s['size'][a] for a in range(3)]
  pts=[xyz(p.multVec(vec(point))) for point in corners([lo,hi])]
  # All custom positive boxes at neutral are axis aligned after their source transforms.
  b=[[min(x[a] for x in pts) for a in range(3)],[max(x[a] for x in pts) for a in range(3)]]
  assert abs(math.prod(b[1][a]-b[0][a] for a in range(3))-math.prod(s['size']))<1e-6
  return [box_cell(b)]
 if kind=='cylinder': return [cyl_cell(s['radius'],s['height'],s['origin'],{'x':(1,0,0),'y':(0,1,0),'z':(0,0,1)}[s['axis']],p)]
 if kind=='helical-worm': return [cyl_cell(s['tip'],s['length'],(0,0,-s['length']/2),(0,0,1),p)]
 raise AssertionError('Unhandled positive stock '+kind)
def cylinder_cover(shape,axis,center,radius=None):
 b=bounds(shape); a='xyz'.index(axis); others=[i for i in range(3) if i!=a]
 r=radius if radius is not None else math.hypot(*(max(abs(b[0][i]-center[i]),abs(b[1][i]-center[i])) for i in others))
 origin=list(center);origin[a]=b[0][a]
 direction=[int(i==a) for i in range(3)]
 return [cyl_cell(r,b[1][a]-b[0][a],origin,direction,transform())]
def supplier_stocks(c,shape):
 p=c['parameters']; placement=transform(**c['placement']); lib=c['libraryId']; id=c['id']
 if lib=='bolt-screw':
  length=p['length']; head=p['headHeight']; start=-(length+head)/2
  # Both supported purchased heads are contained in their declared head cylinder.
  return [cyl_cell(p['shankDiameter']/2,length,(0,0,start),(0,0,1),placement),cyl_cell(p['headSize']/2,head,(0,0,start+length),(0,0,1),placement)]
 if lib=='dowel-pin':return [cyl_cell(p['diameter']/2,p['length'],(0,0,0),(0,0,1),placement)]
 if lib=='hex-nut': return [cyl_cell(p['acrossFlats']/math.sqrt(3),p['height'],(0,0,0),(0,0,1),placement)]
 if lib=='retaining-ring' and p['mounting']=='external':
  # Authored positive body/ears give a tighter exact circle than the diagonal
  # of its bounding square. Native containment below independently verifies it.
  outer=p['outerDiameter']/2;inner=p['innerDiameter']/2
  ear_center=outer-.3*(outer-inner)
  radius=max(outer,inner+abs(p['eccentricity']),ear_center+p['earDiameter']/2)
  axis='y' if id.startswith('output-') else 'x';center=PIVOT if axis=='y' else (0,0,SCREW_Z)
  return cylinder_cover(shape,axis,center,radius)
 if id=='coupling':return cylinder_cover(shape,'x',(0,0,SCREW_Z),7)
 if id=='gearmotor':
  # The candidate tight cylindrical envelope is verified against every native
  # supplier solid below; this avoids a loose square-corner motor envelope.
  return cylinder_cover(shape,'x',(0,0,SCREW_Z),8)
 if lib=='flanged-ball-bearing':
  axis='y' if id.startswith('output-') else 'x';center=PIVOT if axis=='y' else (0,0,SCREW_Z)
  return cylinder_cover(shape,axis,center,max(p['outer'],p['flangeOuter'])/2)
 if id.startswith('output-'): return cylinder_cover(shape,'y',PIVOT)
 return cylinder_cover(shape,'x',(0,0,SCREW_Z))
def category(id):
 if id in ['lead-nut','nut-yoke'] or id.startswith('nut-flange-'): return 'slide'
 if id.startswith('output-') or id.startswith('quad-'): return 'output'
 return 'invariant'
def extrema(cosine,sine,low=-A,high=A):
 angles=[low,high]
 t=math.atan2(sine,cosine)
 for k in range(-2,3):
  x=t+k*math.pi
  if low<=x<=high:angles.append(x)
 values=[cosine*math.cos(x)+sine*math.sin(x) for x in angles]
 return min(values),max(values)
def swept(c,motion):
 b=cell_bounds(c)
 if motion=='invariant': pass
 elif motion=='slide': b[0][0]-=TRAVEL;b[1][0]+=TRAVEL
 elif c['kind']=='cylinder':
  axis=c['axis'];r=c['radius']
  if abs(abs(axis[1])-1)<1e-7:
   base=c['base']; x,z=base[0]-PIVOT[0],base[2]-PIVOT[2]
   sx=extrema(x,z);sz=extrema(z,-x)
   b=[[PIVOT[0]+sx[0]-r,b[0][1],PIVOT[2]+sz[0]-r],[PIVOT[0]+sx[1]+r,b[1][1],PIVOT[2]+sz[1]+r]]
  elif abs(abs(axis[0])-1)<1e-7:
   # Exact support functions of an axial-X cylinder rotated about Y. Split
   # at zero to resolve abs(sin(theta)); cos(theta) remains positive.
   xx=[];zz=[]
   for p in [c['base'],c['tip']]:
    x,z=p[0]-PIVOT[0],p[2]-PIVOT[2]
    for low,high,sign in [(-A,0,-1),(0,A,1)]:
     for side in [-1,1]:
      xx.extend(PIVOT[0]+v for v in extrema(x,z+side*r*sign,low,high))
      zz.extend(PIVOT[2]+v for v in extrema(z+side*r,-x,low,high))
   b=[[min(xx),b[0][1],min(zz)],[max(xx),b[1][1],max(zz)]]
  else:raise AssertionError(('Unsupported moving cylinder axis',axis))
 else:
  pts=c['points'];xx=[];zz=[]
  for p in pts:
   xx.extend(v+PIVOT[0] for v in extrema(p[0]-PIVOT[0],p[2]-PIVOT[2]));zz.extend(v+PIVOT[2] for v in extrema(p[2]-PIVOT[2],PIVOT[0]-p[0]))
  b=[[min(xx),b[0][1],min(zz)],[max(xx),b[1][1],max(zz)]]
 return [[v-EPS for v in b[0]],[v+EPS for v in b[1]]]
def mount(b,i):
 angle=i*math.pi/2;cs=round(math.cos(angle));sn=round(math.sin(angle))
 shift=[0,cs*RADIUS,sn*RADIUS] if ARRANGEMENT=='radial' else [(i%2)*TIER,-sn*RADIUS,cs*RADIUS]
 pts=[[p[0]+shift[0],cs*p[1]-sn*p[2]+shift[1],sn*p[1]+cs*p[2]+shift[2]] for p in corners(b)]
 return [[min(p[a] for p in pts) for a in range(3)],[max(p[a] for p in pts) for a in range(3)]]

def mounted_cell(c,i):
 angle=i*math.pi/2;cs=round(math.cos(angle));sn=round(math.sin(angle))
 shift=[0,cs*RADIUS,sn*RADIUS] if ARRANGEMENT=='radial' else [(i%2)*TIER,-sn*RADIUS,cs*RADIUS]
 def point(p,translation=True):return [p[0]+(shift[0] if translation else 0),cs*p[1]-sn*p[2]+(shift[1] if translation else 0),sn*p[1]+cs*p[2]+(shift[2] if translation else 0)]
 if c['kind']=='cylinder':return dict(c,base=point(c['base']),tip=point(c['tip']),axis=point(c['axis'],False))
 return box_cell(mount(c['bounds'],i))

def coordinate_gap(a,b): return max(max(a[0][i]-b[1][i],b[0][i]-a[1][i]) for i in range(3))

cases_path=DIRECTORY/'cases.json';cases=json.loads(cases_path.read_text())
layout_path=DIRECTORY/'continuous-layout.json';specification=json.loads(layout_path.read_text());layout=specification['layout']
RADIUS=float(layout['outputRadial']);COMMON_CLOCK=float(layout['clock']);LEVER_RADIUS=float(layout['lever']);SCREW_Z=LEVER_RADIUS;TRAVEL=LEVER_RADIUS*math.tan(A)
report_path=DIRECTORY/'native-report.json';audit=json.loads(report_path.read_text())
assert audit['failed']==0 and audit['casesSha256']==hashlib.sha256(cases_path.read_bytes()).hexdigest()
assert audit['passed']==len(cases)
all_tiers=[]
for neutral_x in sorted(set(layout['outputStations'])):
 neutral=next(c for c in cases if c['parameters']['outputAngle']==0 and c['kinematics']['neutralNutX']==neutral_x)
 audited=next(c for c in audit['cases'] if c['name']==neutral['name']);assert audited['passed']
 PIVOT=(neutral_x,0,0);native_path=DIRECTORY/(neutral['name']+'.FCStd');doc=App.openDocument(str(native_path.resolve()))
 groups={}
 for ob in doc.Objects:
  if hasattr(ob,'AssemblyOccurrenceId') and hasattr(ob,'Shape') and not ob.Shape.isNull():groups.setdefault(ob.AssemblyOccurrenceId,[]).append(ob.Shape.copy())
 occurrences=neutral['billOfMaterials']['components'];assert set(groups)=={c['id'] for c in occurrences}
 cells=[];containment=[]
 for c in occurrences:
  identity=c['id'];actual=Part.makeCompound(groups[identity]);motion='output' if c['libraryId']=='dowel-pin' else category(identity)
  positives=stocks(json.loads(c['parameters']['recipe']),transform(**c['placement'])) if c['libraryId']=='manufactured-detail' else supplier_stocks(c,actual)
  stock=cell_shape(positives[0],EPS)
  for positive in positives[1:]:stock=stock.fuse(cell_shape(positive,EPS))
  residual=actual.cut(stock);escaped=0 if residual.isNull() else residual.Volume
  assert abs(escaped)<=1e-6,('Native escapes positive stock',neutral_x,identity,escaped)
  containment.append(dict(id=identity,stockCells=len(positives),escapedMm3=escaped))
  for index,positive in enumerate(positives):cells.append(dict(id=identity,index=index,motion=motion,stock=positive,sweep=swept(positive,motion)))
  print(json.dumps(dict(stage='contained',neutralNutX=neutral_x,id=identity,cells=len(positives))),flush=True)
 App.closeDocument(doc.Name)
 checks=0
 for item in cells:
  positive=cell_shape(item['stock'])
  for angle in range(-20,21):
   shape=positive.copy()
   if item['motion']=='slide':shape.translate(App.Vector(LEVER_RADIUS*math.tan(math.radians(angle)),0,0))
   elif item['motion']=='output':shape.rotate(vec(PIVOT),App.Vector(0,1,0),angle)
   b=bounds(shape);envelope=item['sweep']
   assert all(b[0][axis]>=envelope[0][axis]-1e-8 and b[1][axis]<=envelope[1][axis]+1e-8 for axis in range(3)),('Analytic enclosure',identity,angle)
   checks+=1
 all_tiers.append(dict(neutralNutX=neutral_x,nativeNeutralFile=native_path.name,nativeNeutralSha256=hashlib.sha256(native_path.read_bytes()).hexdigest(),containment=containment,stockCells=cells,nativeEnclosureImplementationChecks=checks))
channels=[]
for index,channel in enumerate(specification['channels']):
 assert channel['clock']==COMMON_CLOCK+90*index and channel['neutralNutX']==layout['outputStations'][index]
 tier=next(t for t in all_tiers if t['neutralNutX']==channel['neutralNutX'])
 channels.append(dict(channel,stockCells=tier['stockCells']))
unresolved=[];minimum=math.inf;critical=None;checks=0
for first,second in itertools.combinations(range(4),2):
 for a in channels[first]['stockCells']:
  aa=mount(a['sweep'],first)
  for b in channels[second]['stockCells']:
   gap=coordinate_gap(aa,mount(b['sweep'],second));checks+=1
   item=dict(channels=[first,second],first=[a['id'],a['index']],second=[b['id'],b['index']],coordinateGapMm=gap)
   if gap<=0:unresolved.append(item)
   if gap<minimum:minimum=gap;critical=item
result=dict(schemaVersion=2,passed=not unresolved,variant=layout['variant'],scope='Continuous independent four-channel source-positive stocks. Integrated CNC frame and intentional supplier interfaces are audited separately.',freecad='.'.join(App.Version()[:3]),runtimeSha256=hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest(),scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),casesSha256=hashlib.sha256(cases_path.read_bytes()).hexdigest(),nativeAuditSha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),layoutSha256=hashlib.sha256(layout_path.read_bytes()).hexdigest(),layout=layout,kinematics=dict(crankRadius=LEVER_RADIUS,screwAxisZ=SCREW_Z,screwLead=8),outputAngleIntervalDegrees=[-20,20],independentChannelAngles=True,radiusMm=RADIUS,commonClockDegrees=COMMON_CLOCK,outwardNumericalPaddingMm=EPS,tiers=all_tiers,channels=channels,checkedCellPairs=checks,minSeparatingCoordinateGapMm=minimum,criticalPair=critical,unresolvedPairs=unresolved,elapsedSeconds=time.monotonic()-START)
(DIRECTORY/'swept-stock.json').write_text(json.dumps(result,indent=2));print(json.dumps(dict(passed=result['passed'],variant=layout['variant'],checks=checks,minimumGapMm=minimum,criticalPair=critical,unresolved=len(unresolved),firstUnresolved=unresolved[:8])),flush=True)
if unresolved:raise SystemExit(1)
