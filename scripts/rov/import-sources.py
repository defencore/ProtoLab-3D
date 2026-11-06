"""Import only the six real FinsROV fabrication definitions.

Use fetch-sources.py first, then run with FreeCADCmd. Purchase-unit geometry
belongs to build-fins-assembly.py and can never enter this fabrication import.
"""
import base64,hashlib,json,os,re,struct,sys,zlib
from pathlib import Path
sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App,Part,MeshPart
ROOT=Path(__file__).resolve().parents[2]
CACHE=Path(os.environ.get('PROTOLAB_ROV_SOURCE_DIR','/tmp/protolab-rov'))
HERE=Path(__file__).parent
SOURCES=json.loads((HERE/'sources.json').read_text())
AUDIT=json.loads((HERE/'fins-bom-audit.json').read_text())
OUTPUT=ROOT/'src/parts/rov-component/lib'
REV=AUDIT['source']['revision']
LICENSE='https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/blob/'+REV+'/LICENSE'
def pack(data):return base64.b64encode(zlib.compress(data,9)).decode()
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,separators=(',',':'))+'\n')
def run():
 makers={o['sourceFabricationFile']:o for o in AUDIT['occurrences'] if o['supply']=='manufactured'}
 assert len(makers)==6
 catalog=[];native=[]
 for source in SOURCES:
  if source['path'] not in makers:continue
  record=makers[source['path']];path=CACHE/'finsrov'/source['path']
  assert hashlib.sha256(path.read_bytes()).hexdigest()==source['sha256'],str(path)
  shape=Part.read(str(path));assert shape.isValid() and len(shape.Solids)==1 and shape.isClosed() and shape.Volume>0
  b=shape.optimalBoundingBox(False,False);box=[b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]
  mesh=MeshPart.meshFromShape(Shape=shape,LinearDeflection=.08,AngularDeflection=.22,Relative=False);points,faces=mesh.Topology
  xyz=[float(c) for point in points for c in point];indices=[i for face in faces for i in face]
  ident=record['componentId']
  requirements=['Preserve the original single-solid making file and the source CNC workbook. Resolve material grade, manufacturing tolerances, seal finish and hole/thread specifications before production.']
  if record['route']=='printing':requirements=['Print only this original sensor bracket; the sensor itself is purchased. Establish polymer, orientation and fit to the purchased depth sensor before printing four copies.']
  if ident=='finsrov-rear-cabin-hatch':requirements=['Mill the flat 8mm aluminium rear plate; follow the source 48 M2 threaded-hole pattern and specified 4mm thread depth. Retain sealing lands and establish finish/tolerances.']
  if ident=='finsrov-cable-passing-screw':requirements=['Turn the aluminium cable-passing blank, then machine source cross features and threads. Use purchased OD12mm x1.5mm gaskets; do not print the pressure cable seal.']
  catalog.append(dict(id=ident,projectId='finsrov',projectName='FinsROV',label=record['label'],format='step',sourcePath=source['path'],sourceUrl=source['url'],sourceSha256=source['sha256'],revision=REV,license='MIT',licenseUrl=LICENSE,route=record['route'],material=record['material'],requirements=requirements,dimensions=[box[i+3]-box[i] for i in range(3)],bounds=box,volume=shape.Volume,solidCount=1))
  native.append(dict(id=ident,vertices=pack(struct.pack('<%df'%len(xyz),*xyz)),triangles=pack(struct.pack('<%dI'%len(indices),*indices)),brep=pack(shape.exportBrepToString().encode())))
 assert len(catalog)==6
 write(OUTPUT/'catalog.json',catalog);write(OUTPUT/'native/components.json',dict(components=native))
 write(OUTPUT/'source-audit.json',dict(units='mm',checkedAt='2026-10-29',freecad='.'.join(App.Version()[:3]),retained=6,rejected=[],sourceCount=len(SOURCES),statement='Six original single-solid Fins fabrication definitions. Purchased complete equipment is excluded. The physical assembly importer verifies each making-file placement against the named author assembly.'))
 print('FINS_FABRICATION',len(catalog),'single-solid maker definitions; no purchased equipment',flush=True)
run()
