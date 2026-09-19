"""Bake official Waveshare HAT(A) STEP into two independent part packages.
Usage: FreeCAD Python scripts/prepare-bus-servo-hat.py supplier.step
No network fetch. Keep source SHA and all normalization/repair notes in the asset.
"""
import sys,os,json,zlib,base64,struct,hashlib,math
from pathlib import Path
sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as A,Part,MeshPart
root=Path(__file__).resolve().parents[1]; path=Path(sys.argv[1])
source=Part.read(str(path)); solids=[];records=[];repairs=[];radius=0
for i,s in enumerate(source.Solids):
 if not s.isValid():
  s=s.copy()
  s.fix(.001,.000001,.1)
  if not s.isValid():
   # Two tiny underside ICs have self-intersecting supplier faces. Preserve
   # their measured envelope explicitly instead of exporting invalid BReps.
   b=s.BoundBox;s=Part.makeBox(b.XLength,b.YLength,b.ZLength,A.Vector(b.XMin,b.YMin,b.ZMin))
   repairs.append(f'Source solid {i}: invalid small underside IC replaced with its measured envelope; internal IC detail omitted.')
  else:repairs.append(f'Source solid {i}: OpenCascade topology fix; volume unchanged.')
 # PCB hole-pattern centre (not board outline centre): X=28, Y=32.5; top face Z=0.
 s.translate(A.Vector(-28,-32.5,0));assert s.isValid()
 solids.append(s)
 mesh=MeshPart.meshFromShape(Shape=s,LinearDeflection=.04,AngularDeflection=.35,Relative=False)
 points,faces=mesh.Topology;radius=max(radius,max(math.hypot(p.x,p.y) for p in points))
 b=s.BoundBox
 def encode(fmt,values):return base64.b64encode(zlib.compress(struct.pack('<'+str(len(values))+fmt,*values),9)).decode()
 color='#176f99' if i==0 else '#242933' if i in [1,83,137,144,152,4,10,5,11,145,146,151] else '#b4b8bd'
 records.append(dict(sourceSolid=i,color=color,positions=encode('f',[v for p in points for v in p]),indices=encode('I',[v for f in faces for v in f])))
 if i%60==0:print('baked',i,flush=True)
s=Part.makeCompound(solids);b=s.BoundBox
asset=dict(previewTessellation=dict(linearDeflection=.04,angularDeflection=.35),model='Waveshare Bus Servo Driver HAT (A)',sku='27577',sourceUrl='https://www.waveshare.com/wiki/Bus_Servo_Driver_HAT_(A)',sourceFile=path.name,sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),normalization='Mounting hole pattern centred at X=0/Y=0; PCB top Z=0; holes (±24.5, ±29), PCB thickness 1.6 mm.',repairs=repairs,mountingHoles=[[-24.5,-29],[24.5,-29],[-24.5,29],[24.5,29]],bounds=[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax],radialEnvelope=radius,volume=s.Volume,brep=base64.b64encode(zlib.compress(s.exportBrepToString().encode(),9)).decode(),components=records)
for folder in ['bus-servo-driver','rocket-release']:
 out=root/'src/parts'/folder/'lib/hat-native.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(asset,separators=(',',':'))+'\n')
print('radius',radius,'bounds',asset['bounds'],'repairs',repairs,flush=True)
