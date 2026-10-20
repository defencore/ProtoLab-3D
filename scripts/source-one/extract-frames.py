"""Run in FreeCAD. Preserve upstream geometry; flatten sheet faces for cutting."""
import FreeCAD as App, Part, json, math, struct, zlib, base64, hashlib, sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from cad_assets import export_sheet_assets
root = Path(__file__).resolve().parents[2]
folder = root / 'src/parts/multicopter-frame-component/lib'
one = json.loads((folder/'source.json').read_text())
specs = [
 {'id':'source-two-v01','sha256':'5a97211a24a02f845c07ad1c409c05b31f4930286296f9b53771151309e60144','file':'source-two.step','repo':'ps915/source_two','rev':'010ade994a150b2971123d6e0a141ed6f69c57fe','remote':'Source Two v0.1.step','indices':list(range(30)),'sheet':list(range(8)),'print':[], 'body':5,'arms':[1,2,3,6],'root':list(range(8))+list(range(12,16))+list(range(18,28)), 'labels':{0:'Top deck',1:'Arm front left',2:'Arm rear right',3:'Arm front right',4:'Front arm reinforcement',5:'Main lower plate',6:'Arm rear left',7:'Rear arm reinforcement',28:'Camera isolation mount left',29:'Camera isolation mount right'}},
 {'id':'source-v-v1','sha256':'b29bbb1c06413e385f15df10d2be24180684161791763a703c319efac33baabf','file':'source-v.step','repo':'ps915/source_v','rev':'ce54d3bae424068fa7f870cb010af86248fa489b','remote':'source_v_V1_upgraded_arms.step','indices':list(range(18)),'sheet':[i for i in range(18) if i not in range(8,12)],'print':[],'body':17,'arms':[4,5,6,7],'root':[4,5,6,7,16,17], 'labels':{0:'Front lower motor bridge',1:'Front upper motor bridge',2:'Rear lower motor bridge',3:'Rear upper motor bridge',4:'Vertical arm front right',5:'Vertical arm rear right',6:'Vertical arm front left',7:'Vertical arm rear left',12:'Right perimeter web',13:'Left perimeter web',14:'Front perimeter web',15:'Rear perimeter web',16:'Top electronics plate',17:'Lower electronics plate'}},
 {'id':'source-podracer-v1','sha256':'118e1c408f66035c3ac5348ba736975f8e9b6e22f9789f64bd7284d18f75cbb7','file':'podracer.step','repo':'ps915/source_podracer','rev':'9b2d56d92c26a42d8d5cbb88507788389db0317c','remote':'Source_PodRacer_v1.0_assembled.step','indices':list(range(7)),'sheet':list(range(6)),'print':[6],'body':2,'arms':[1,3,4,5],'root':list(range(6)), 'labels':{0:'Top stack plate',1:'Arm rear left',2:'Bottom clamp plate',3:'Arm front right',4:'Arm front left',5:'Arm rear right',6:'Nylon pod canopy'}},
]

def record(s, i, spec):
 b=s.optimalBoundingBox(False,False)
 place=[(b.XMin+b.XMax)/2,(b.YMin+b.YMax)/2,b.ZMin]
 s=s.copy();s.translate(App.Vector(*[-v for v in place]));v,t=s.tessellate(.025)
 points=[[q.x,q.y,q.z] for q in v]
 lo=[min(q[k] for q in points) for k in range(3)];hi=[max(q[k] for q in points) for k in range(3)]
 route='sheet' if i in spec['sheet'] else 'print' if i in spec['print'] else 'purchase'
 label=spec['labels'].get(i,'M3 body standoff '+str(i-7) if 8<=i<=11 else 'M3 nut '+str(i-17) if 18<=i<=21 else 'M3 source screw '+str(i))
 return dict(id=spec['id']+'-'+str(i).zfill(2),label=label,route=route,sourceIndex=i,placement=place,dimensions=[hi[k]-lo[k] for k in range(3)],nativeBounds=[b.XLength,b.YLength,b.ZLength],meshMin=lo,meshMax=hi,volume=s.Volume,brep=base64.b64encode(zlib.compress(s.exportBrepToString().encode())).decode(),vertices=base64.b64encode(struct.pack('<'+'f'*len(points)*3,*[x for q in points for x in q])).decode(),triangles=base64.b64encode(struct.pack('<'+'I'*len(t)*3,*[x for q in t for x in q])).decode())

data=[]
for spec in specs:
 path=Path('/tmp/real-frames')/spec['file'];assert hashlib.sha256(path.read_bytes()).hexdigest()==spec['sha256'], 'Pinned source hash mismatch';s=Part.Shape();s.read(str(path))
 # SOURCE V publishes closed shells, not solid entities. No sewing or contour repair.
 parts=s.Solids or [Part.makeSolid(p) for p in s.Shells]
 assert all(p.isValid() and p.isClosed() and p.Volume>0 for p in parts)
 parts=[parts[i].copy() for i in spec['indices']]
 if spec['id']=='source-two-v01':
  for p in parts:p.rotate(App.Vector(),App.Vector(1,0,0),90)
 b=Part.makeCompound(parts).BoundBox;offset=App.Vector(-(b.XMin+b.XMax)/2,-(b.YMin+b.YMax)/2,-b.ZMin if spec['id']=='source-v-v1' else 0)
 for p in parts:p.translate(offset)
 from urllib.parse import quote
 url='https://raw.githubusercontent.com/'+spec['repo']+'/'+spec['rev']+'/'+quote(spec['remote'])
 source=dict(url=url,repository='https://github.com/'+spec['repo'],revision=spec['rev'],sha256=hashlib.sha256(path.read_bytes()).hexdigest(),license='GPL-3.0-only',previewChord=.025,checkedAt='2026-10-19',shellsToSolids=spec['id']=='source-v-v1',omittedSourceIndices=list(range(30,34)) if spec['id']=='source-two-v01' else [])
 data.append(dict(id=spec['id'],source=source,body=spec['body'],arms=spec['arms'],root=spec['root'],parts=[record(p,i,spec) for i,p in zip(spec['indices'],parts)]))
(folder/'additional.json').write_text(json.dumps(data,separators=(',',':')))

count=export_sheet_assets(root,[dict(id='source-one-v5',parts=one['parts'])]+data)
print('Extracted',[(f['id'],len(f['parts'])) for f in data], 'sheet faces',count)
