"""Run in FreeCAD: deterministic source IGES extraction, not shape redesign."""
import FreeCAD as App, Part, json, zlib, base64, math, hashlib, struct
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=Path(SOURCE_ONE_IGES)
shape=Part.Shape();shape.read(str(source));solids=shape.Solids
labels={0:'Rear equipment pad',1:'Battery pad',2:'Lower arm clamp plate',3:'Top deck',4:'Main centre plate',5:'Camera cheek left',6:'Camera cheek right',20:'Camera mount',52:'Keyed arm-root cross plate',53:'Arm front left',54:'Arm front right',55:'Arm rear left',56:'Arm rear right'}
# CAD origin: source motor rectangle centre; rotate +90 degrees to +X nose.
origin=App.Vector(1861.180724606,240.519896926,0)
records=[]
for i,source_shape in enumerate(solids):
 s=source_shape.copy();s.translate(-origin);s.rotate(App.Vector(),App.Vector(0,0,1),90)
 b=s.optimalBoundingBox(False,False)
 place=[(b.XMin+b.XMax)/2,(b.YMin+b.YMax)/2,b.ZMin]
 s.translate(App.Vector(*[-v for v in place]))
 vertices,triangles=s.tessellate(.025)
 label=labels.get(i,'Body standoff '+str(i-6) if 7<=i<=14 else 'Equipment spacer '+str(i-14) if 15<=i<=18 else 'M3 screw '+str(i) if 19<=i<=43 else 'M3 press insert '+str(i-43))
 route='sheet' if i in [2,3,4,5,6,52,53,54,55,56] else 'print' if i==20 else 'soft' if i in [0,1] else 'purchase'
 id='part-'+str(i).zfill(2)
 native=s.exportBrepToString()
 points=[[round(v.x,7),round(v.y,7),round(v.z,7)] for v in vertices]
 low=[min(p[k] for p in points) for k in range(3)];high=[max(p[k] for p in points) for k in range(3)]
 record=dict(id=id,label=label,route=route,sourceIndex=i,placement=[round(v,9) for v in place],dimensions=[high[k]-low[k] for k in range(3)],nativeBounds=[round(v,8) for v in (b.XLength,b.YLength,b.ZLength)],meshMin=low,meshMax=high,volume=s.Volume,brep=base64.b64encode(zlib.compress(native.encode())).decode(),vertices=base64.b64encode(struct.pack('<'+'f'*len(points)*3,*[v for p in points for v in p])).decode(),triangles=base64.b64encode(struct.pack('<'+'I'*len(triangles)*3,*[v for f in triangles for v in f])).decode())
 records.append(record)
# Exact source section areas for a straight-axis Euler-Bernoulli screening model.
arm=solids[53].copy();fixed=App.Vector(1876.430724606,225.270052826,0);motor=App.Vector(1947.743459177,167.88529418,0)
v=motor-fixed;theta=math.degrees(math.atan2(v.y,v.x));length=v.Length
arm.translate(-fixed);arm.rotate(App.Vector(),App.Vector(0,0,1),-theta)
sections=[]
count=100
for k in range(count+1):
 x=(k+.01)/(count+.02)*length
 piece=arm.common(Part.makeBox(.1,200,20,App.Vector(x-.05,-100,-5)))
 area=piece.Volume/.1
 assert area>0
 sections.append(dict(x=x,width=area/6,inertia=area*6*6/12))
data=dict(source={'url':'https://raw.githubusercontent.com/tbs-trappy/source_one/07a8690c6bd73e1300197845eda2ebe547c3a158/SO_V5.iges','repository':'https://github.com/tbs-trappy/source_one','revision':'07a8690c6bd73e1300197845eda2ebe547c3a158','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'license':'GPL-3.0-only','previewChord':.025,'sourceOrigin':[origin.x,origin.y,origin.z],'axisRotationZ':90,'checkedAt':'2026-10-19'},parts=records,beam={'length':length,'thickness':6,'rootBoltPitch':math.sqrt(2*5.25**2),'sections':sections})
(root/'src/parts/multicopter-frame-component/lib/source.json').write_text(json.dumps(data,separators=(',',':')))
print('Extracted source parts',len(records),'bytes',len(json.dumps(data)),'arm length',length,'min section width',min(p['width'] for p in sections))
