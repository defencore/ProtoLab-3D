"""FreeCAD: import pinned X8 assembly and assemble COMET Y6 at measured hole datums.

No source solid is resized or redrawn. COMET ships individual STEP parts but no
assembly; rigid poses follow docs/build.md and native 35 mm root-hole pairs.
"""
import FreeCAD as App, Part
import base64, hashlib, json, math, struct, zlib, sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from cad_assets import export_sheet_assets
root = Path(__file__).resolve().parents[2]
folder = root/'src/parts/multicopter-frame-component/lib'
inputs = Path('/tmp/multi-rotor-frames')
pinned = {
 'comet-gear.step':'fae1468eb42de2248e33d4e7a5eb3ff7add3abf9fa075356855bc78da7a80d87',
 'source-x8.step':'a08bf68bf016000e348915ef8888fa6ed377f7b19c897aceb5ef26ca7e31f335',
 'comet-arm.step':'939e09aefa61a06e7b36c2c30596fae127e97ce24dc49f6ec2b58e27035aa54d',
 'comet-mount.step':'c349b4fc1f81297b3557db7e21511968032cdee45b9b3314014aa3a641728e56',
 'comet-plate.step':'7630ba7efcf4bd5610cc6810ff349a2db58f3d9b21a381c6018b9b6a0dc20131',
}
for name,digest in pinned.items():
    assert hashlib.sha256((inputs/name).read_bytes()).hexdigest()==digest, 'Pinned CAD hash mismatch: '+name

def read(name):
    s=Part.Shape(); s.read(str(inputs/name)); return s

def cylinders(s, radius):
    return [f.Surface for f in s.Faces if type(f.Surface).__name__=='Cylinder'
            and abs(f.Surface.Axis.z)>.999 and abs(f.Surface.Radius-radius)<1e-6]

def record(shape,index,frame_id,label,route):
    s=shape.copy(); b=s.optimalBoundingBox(False,False)
    place=[(b.XMin+b.XMax)/2,(b.YMin+b.YMax)/2,b.ZMin]
    s.translate(App.Vector(*[-v for v in place])); verts,faces=s.tessellate(.025)
    points=[[v.x,v.y,v.z] for v in verts]
    low=[min(v[k] for v in points) for k in range(3)]
    high=[max(v[k] for v in points) for k in range(3)]
    pack=lambda fmt,values:base64.b64encode(zlib.compress(struct.pack('<'+fmt*len(values),*values))).decode()
    return dict(id=frame_id+'-'+str(index).zfill(2),label=label,route=route,sourceIndex=index,
        placement=place,dimensions=[high[k]-low[k] for k in range(3)],
        nativeBounds=[b.XLength,b.YLength,b.ZLength],meshMin=low,meshMax=high,volume=s.Volume,
        brep=base64.b64encode(zlib.compress(s.exportBrepToString().encode())).decode(),
        vertices=pack('f',[v for p in points for v in p]),
        triangles=pack('I',[v for p in faces for v in p]),meshCompression='zlib')

x8=read('source-x8.step').Solids
assert len(x8)==23 and all(s.isValid() and s.isClosed() for s in x8)
# The centre of the four shaft bores defines the assembly origin, not its canopy.
shaft=[cylinders(x8[i],3.5)[0].Center for i in [15,16,18,19]]
origin=App.Vector(sum(v.x for v in shaft)/4,sum(v.y for v in shaft)/4,0)
for s in x8:s.translate(-origin)
shaft=[v-origin for v in shaft]
labels={0:'V4 upper deck 2 mm',1:'V4 camera cheek left',2:'V4 camera cheek right',
        13:'V4 lower deck 3 mm',14:'X8 root clamp 3 mm',15:'X8 arm front right 5 mm',
        16:'X8 arm rear right 5 mm',17:'Lower motor cover rear right 3 mm',
        18:'X8 arm rear left 5 mm',19:'X8 arm front left 5 mm',
        20:'Lower motor cover front right 3 mm',21:'Lower motor cover rear left 3 mm',
        22:'Lower motor cover front left 3 mm'}
x8_data=dict(id='source-one-x8',body=13,arms=[15,16,18,19],root=[13,14,15,16,18,19],
    source=dict(url='https://raw.githubusercontent.com/shnllsfpv/source_one_X8_lifter/96382c5c8646e8c706dee6a28d13e33177b05b36/SO_v4_X8_LIFTER.stp',
        repository='https://github.com/shnllsfpv/source_one_X8_lifter',revision='96382c5c8646e8c706dee6a28d13e33177b05b36',
        sha256=hashlib.sha256((inputs/'source-x8.step').read_bytes()).hexdigest(),license='GPL-3.0-only',previewChord=.025),
    motorStations=[dict(x=v.x,y=v.y,upperMountZ=6,lowerMountZ=-2,upperPart=arm,lowerPart=cover)
                   for v,arm,cover in zip(shaft,[15,16,18,19],[20,17,21,22])],
    parts=[record(s,i,'source-one-x8',labels.get(i,'V4 M3 x 30 standoff '+str(i-2)),
                  'purchase' if 3<=i<=12 else 'sheet') for i,s in enumerate(x8)])

arm=read('comet-arm.step').Solids[0]
mount=read('comet-mount.step').Solids[0]
plate=read('comet-plate.step').Solids[0]
gear=read('comet-gear.step').Solids[0]
# Three actual pairs, each 35 mm apart; the front arms are not a generic 120-degree array.
holes=[c.Center for c in cylinders(plate,1.6)]
back=sorted([v for v in holes if abs(v.y)<1e-6 and v.x<-25],key=lambda v:v.x,reverse=True)
front=[]
for sign in [1,-1]:
    inner=min((v for v in holes if v.x>20 and sign*v.y>20),key=lambda v:v.Length)
    outer=max((v for v in holes if v.x>30 and sign*v.y>40),key=lambda v:v.Length)
    front.append([inner,outer])
pairs=[back]+front
assert len(back)==2 and all(abs((a-b).Length-35)<1e-6 for a,b in pairs)
shapes=[plate.copy(),plate.copy()]; shapes[1].translate(App.Vector(0,0,14))
comet_labels=['Lower mounting plate 4 mm','Upper mounting plate 4 mm'];stations=[]
for i,(inner,outer) in enumerate(pairs):
    direction=(inner-outer)/35
    angle=math.degrees(math.atan2(direction.y,direction.x))-90
    rotation=App.Rotation(App.Vector(0,0,1),angle)
    offset=inner-rotation.multVec(App.Vector(0,122.6,0))
    a=arm.copy();a.translate(App.Vector(0,0,4))
    lo=mount.copy();lo.rotate(App.Vector(),App.Vector(0,0,1),-90);lo.translate(App.Vector(0,3,-.4))
    hi=mount.copy();hi.rotate(App.Vector(),App.Vector(1,0,0),180);hi.rotate(App.Vector(),App.Vector(0,0,1),-90);hi.translate(App.Vector(0,3,18.4))
    g=gear.copy();g.rotate(App.Vector(),App.Vector(0,1,0),180)
    g.rotate(App.Vector(),App.Vector(0,0,1),180)
    # Gear holes Y=3/38 -> arm Y=122.6/87.6.
    g.translate(App.Vector(0,125.6,0))
    leg=arm.copy()
    leg_rot=App.Rotation(App.Vector(0,.7551072907037708,-.655601235146801),
        App.Vector(0,.655601235146801,.7551072907037708),App.Vector(1,0,0),'ZXY')
    leg.Placement=App.Placement(App.Vector(0,30.540847466412,14.878092884034)-leg_rot.multVec(App.Vector(0,10,5)),leg_rot)
    leg.rotate(App.Vector(),App.Vector(0,1,0),180);leg.rotate(App.Vector(),App.Vector(0,0,1),180);leg.translate(App.Vector(0,125.6,0))
    for s in [a,lo,hi,g,leg]:s.rotate(App.Vector(),App.Vector(0,0,1),angle);s.translate(offset)
    index=len(shapes);shapes.extend([a,lo,hi,g,leg])
    label=['rear','front left','front right'][i]
    comet_labels.extend(['Rotor arm '+label,'Lower motor block '+label,'Upper motor block '+label,'Landing gear mount '+label,'Landing leg '+label])
    centre=rotation.multVec(App.Vector(0,3,0))+offset
    stations.append(dict(x=centre.x,y=centre.y,upperMountZ=18.4,lowerMountZ=-.4,upperPart=index+2,lowerPart=index+1))
assert all(s.isValid() and s.isClosed() and len(s.Solids)==1 for s in shapes)
files=['comet-arm.step','comet-mount.step','comet-plate.step','comet-gear.step']
remote_files=['rotor_arm.step','motor_mount.step','mounting_plate.step','landing_gear_mount.step']
source_files=[dict(file=remote,url='https://raw.githubusercontent.com/uastw-embsys/comet/9837b8dc6f6ddd623634a82f7f9fa2ca6588c662/mechanical/exports/step/'+remote,sha256=hashlib.sha256((inputs/n).read_bytes()).hexdigest()) for n,remote in zip(files,remote_files)]
comet_data=dict(id='comet-y6',body=0,arms=[2,7,12],root=[0,1,2,7,12,5,10,15],
    source=dict(url='https://github.com/uastw-embsys/comet/tree/9837b8dc6f6ddd623634a82f7f9fa2ca6588c662/mechanical/exports/step',
        repository='https://github.com/uastw-embsys/comet',revision='9837b8dc6f6ddd623634a82f7f9fa2ca6588c662',
        sha256=hashlib.sha256(''.join(f['sha256'] for f in source_files).encode()).hexdigest(),
        files=source_files,hashKind='SHA256 of ordered source-file SHA256 hex strings',license='CERN-OHL-W-2.0',previewChord=.025,
        assembly='Local rigid assembly of unchanged source parts, constrained to native hole pairs and the author build manual.'),
    motorStations=stations,parts=[record(s,i,'comet-y6',comet_labels[i],'print') for i,s in enumerate(shapes)])
for i,(shape,m) in enumerate(zip(shapes,comet_data['parts'])):
    m['sourceFile']=source_files[2 if i<2 else [0,1,1,3,0][(i-2)%5]]
    inverse=shape.Placement.Rotation.inverted()
    yaw,pitch,roll=inverse.toEuler()
    native=shape.copy();native.translate(App.Vector(*[-v for v in m['placement']]))
    native.Placement=App.Placement(App.Vector(),inverse).multiply(native.Placement)
    b=native.optimalBoundingBox(False,False)
    m['printPose']=dict(rotation=[roll,pitch,yaw],min=[b.XMin,b.YMin,b.ZMin],size=[b.XLength,b.YLength,b.ZLength])
(folder/'multirotors.json').write_text(json.dumps([comet_data,x8_data],separators=(',',':')))
one=json.loads((folder/'source.json').read_text())
data=json.loads((folder/'additional.json').read_text())+[comet_data,x8_data]
export_sheet_assets(root,[dict(id='source-one-v5',parts=one['parts'])]+data)
print('Imported COMET',len(shapes),'X8',len(x8),'parts; stations',stations,flush=True)
