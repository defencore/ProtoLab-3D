"""Import the FinsROV physical hierarchy and original make/buy BOM.

Input cache: PROTOLAB_ROV_SOURCE_DIR (default /tmp/protolab-rov).
Run using FreeCADCmd. Source audit JSON is checked in beside this script.
Purchased units stay opaque; only six author fabrication files are made.
"""
import base64,hashlib,json,math,os,re,runpy,struct,sys,zlib
from pathlib import Path
sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App,Part,MeshPart,Import
ROOT=Path(__file__).resolve().parents[2]
CACHE=Path(os.environ.get('PROTOLAB_ROV_SOURCE_DIR','/tmp/protolab-rov'))
AUDIT=json.loads(Path(__file__).with_name('fins-bom-audit.json').read_text())
CATALOG=ROOT/'src/parts/rov-component/lib/catalog.json'
BOM_URL='https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/blob/1bc38e83d8af669339c7a86f0a14e2180676347f/Structure/En/BOM.xlsx'
SOURCE_URL='https://raw.githubusercontent.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/1bc38e83d8af669339c7a86f0a14e2180676347f/Structure/En/Configuration.STEP'
def packed(value):return base64.b64encode(zlib.compress(value,9)).decode()
def bounds(s):
 b=s.optimalBoundingBox(False,False)
 return [b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]
def volume(s):return math.fsum(x.Volume for x in s.Solids)
def mesh(s):
 m=MeshPart.meshFromShape(Shape=s,LinearDeflection=.1,AngularDeflection=.25,Relative=False)
 vs,ts=m.Topology;xyz=[float(c) for v in vs for c in v];ids=[i for t in ts for i in t]
 return dict(vertices=packed(struct.pack('<%df'%len(xyz),*xyz)),triangles=packed(struct.pack('<%dI'%len(ids),*ids)),brep=packed(s.exportBrepToString().encode()))
def write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,separators=(',',':'))+'\n')
def run():
 path=CACHE/'finsrov/Structure/En/Configuration.STEP'
 assert hashlib.sha256(path.read_bytes()).hexdigest()==AUDIT['source']['configurationSha256']
 catalog={m['id']:m for m in json.loads(CATALOG.read_text()) if m['projectId']=='finsrov'}
 assert len(catalog)==6
 # Use source labels and root occurrences, not individual vendor internals.
 prefs=App.ParamGet('User parameter:BaseApp/Preferences/Mod/Import');old=prefs.GetBool('ImportCompound',False);prefs.SetBool('ImportCompound',False)
 doc=App.newDocument('FinsPhysicalSource')
 try:
  Import.insert(str(path),doc.Name)
  root=doc.getObject('外形');assert root
  top=[o for o in root.Group if hasattr(o,'Shape') and o.Shape.Solids]
  assert len(top)==50==len(AUDIT['occurrences'])
  # The semantic importer preserves product names but three vendor internals
  # have invalid mirrored topology there. The same original STEP's flattened
  # BREP reader returns all142 valid solids. Group those unchanged world solids
  # by the semantic occurrences, matching bounds, mass and centre of mass.
  flat=Part.read(str(path)).Solids
  assert len(flat)==142 and all(s.isValid() and s.isClosed() and s.Volume>0 for s in flat)
  flat_info=[(bounds(s),s.Volume,s.CenterOfMass) for s in flat];remaining=set(range(len(flat)))
  occurrences=[];equipment=[];native=[];verification=[];placements=[]
  for obj,record in zip(top,AUDIT['occurrences']):
   assert obj.Label.startswith(record['sourceName'].replace('M8','M')), (obj.Label,record['sourceName'])
   pose=obj.Placement
   local=obj.Shape.copy();local.Placement=App.Placement()
   placements.append(dict(name=obj.Name,label=obj.Label,type=obj.TypeId,solids=len(obj.Shape.Solids),volume=volume(obj.Shape),placement=list(pose.toMatrix().A),rotation=list(pose.Rotation.Q),position=list(pose.Base),localBounds=bounds(local),globalBounds=bounds(obj.Shape)))
   grouped=[]
   for child in obj.Shape.Solids:
    b=bounds(child);v=abs(child.Volume);center=child.CenterOfMass
    def error(i):
     bb,vv,cc=flat_info[i]
     return max(abs(a-z) for a,z in zip(b,bb))+(center-cc).Length+abs(v-vv)/max(1,v)
    matched=min(remaining,key=error)
    assert error(matched)<.05,('Cannot match original physical source solid',obj.Name,error(matched))
    remaining.remove(matched);grouped.append(flat[matched])
   yaw,pitch,roll=pose.Rotation.getYawPitchRoll()
   occurrence=dict(id='finsrov-'+record['sourceOccurrenceName'].lower(),label=record['label'],supply=record['supply'],placement=dict(translation=list(pose.Base),rotation=[roll,pitch,yaw]),sourceObject=obj.Name,sourceName=record['sourceName'],sourceOccurrenceId=record['sourceOccurrenceId'],sourceBounds=bounds(obj.Shape),sourceVolume=volume(obj.Shape))
   if record['supply']=='manufactured':
    model=catalog[record['componentId']]
    source=Part.read(str(CACHE/'finsrov'/model['sourcePath']))
    installed=source.copy();installed.Placement=pose.multiply(installed.Placement)
    delta=volume(installed.cut(obj.Shape))+volume(obj.Shape.cut(installed))
    assert delta<.001,('Author fabrication geometry differs from installed assembly',obj.Name,delta)
    assert max(abs(a-b) for a,b in zip(bounds(installed),bounds(obj.Shape)))<1e-5
    route=record['route'];processes=['printing'] if route=='printing' else [route,'drilling']
    occurrence.update(libraryId='rov-component',parameters=dict(component=model['id']),role='printed' if route=='printing' else 'machined',manufacturing=dict(material=record['material'],blank=' x '.join('%.3f'%x for x in model['dimensions'])+' mm',processes=processes,requirements=model['requirements']+['Use original CNC workbook finish, hole and thread callouts; the assembled source placement is verified against the original making file.']))
    verification.append(dict(id=occurrence['id'],component=model['id'],sourceSolidCount=len(installed.Solids),sourceBounds=bounds(installed),sourceVolume=volume(installed),symmetricDifferenceMm3=delta))
   else:
    ident='finsrov-equipment-%02d'%record['ordinal'];shape=Part.makeCompound(grouped)
    # Complete bought units are source-installed references in the same world
    # frame. No inverse/mirror transform or internal contour repair is applied.
    occurrence['originalSourcePlacement']=occurrence['placement']
    occurrence['placement']=dict(translation=[0,0,0],rotation=[0,0,0])
    b=bounds(shape);equipment.append(dict(id=ident,label=record['label']+' — source position %02d'%record['ordinal'],designation=record['procurement']['designation'],manufacturer=record['procurement']['manufacturer'],sourceUrl=record['procurement']['source'],cadSourceUrl=SOURCE_URL,sourceSha256=AUDIT['source']['configurationSha256'],bounds=b,dimensions=[b[i+3]-b[i] for i in range(3)],volume=volume(shape),solidCount=len(shape.Solids),role=record['equipmentKey'],requirements=record['notes']+['Purchased functional equipment. CAD internals are installation references and must never be printed or machined.'],procurementGroupId=record['procurementGroupId'],bomRow=record['bomRow']))
    native.append(dict(id=ident,**mesh(shape)))
    occurrence.update(libraryId='rov-equipment',parameters=dict(equipment=ident),role='equipment',procurement={k:record['procurement'][k] for k in ['designation','manufacturer','source']},procurementGroupId=record['procurementGroupId'],notes=' '.join(record['notes']))
   occurrences.append(occurrence)
  purchase={}
  for r in AUDIT['occurrences']:
   if r['supply']!='purchased':continue
   g=r['procurementGroupId']
   if g not in purchase:purchase[g]=dict(id=g,name=r['procurement'].get('bomDetail',r['label']),quantity=r['bomQuantity'],unit=r['bomUnit'],manufacturer=r['procurement']['manufacturer'],designation=r['procurement']['designation'],source=r['procurement']['source'],cadUnitCount=0,notes=' '.join(r['notes']))
   purchase[g]['cadUnitCount']+=1
  for r in AUDIT['standardHardware']:
   ident='standard-'+str(r['bomRow']);purchase[ident]=dict(id=ident,name=r['category'],quantity=r['quantity'],unit='piece',manufacturer='Specify supplier and grade',designation=r['designation'],source=BOM_URL,cadUnitCount=0,notes='Source standard hardware requirement; omitted from the external CAD. Reconcile exact thread engagement and source reference-only quantities before release.')
  for r in AUDIT['additionalBomItems']:
   ident='other-'+str(r['bomRow']);purchase[ident]=dict(id=ident,name=r['name'],quantity=r['quantity'],unit='piece / source description',manufacturer='Per upstream BOM; verify exact item',designation=r['detail'] or r['name'],source=r['source'],cadUnitCount=0,notes='Upstream BOM item without geometry in the external assembly. Unknown quantities must be specified, not inferred.')
  result=dict(id='finsrov',name='FinsROV — make and buy assembly',revision=AUDIT['source']['revision'],sourceUrl=SOURCE_URL,sourceSha256=AUDIT['source']['configurationSha256'],issues=AUDIT['issues'],occurrences=occurrences,bom=dict(source=BOM_URL,sha256=AUDIT['source']['bomSha256'],procurement=list(purchase.values()),standardHardware=AUDIT['standardHardware'],unmodeled=AUDIT['additionalBomItems']),verification=verification)
  assert not remaining, 'Unassigned source solid'
  assert sum(o['supply']=='manufactured' for o in occurrences)==26
  assert sum(o['role']=='printed' for o in occurrences)==4
  # Source-installed units are an import intermediate, never visible library products.
  intermediate=CACHE/'purchased-source-units'
  write(intermediate/'catalog.json',equipment)
  write(intermediate/'native/equipment.json',dict(components=native))
  write(intermediate/'placements.json',placements)
  previous_args=sys.argv
  try:
   sys.argv=['normalize-purchased-components.py','--source',str(intermediate),'--placements',str(intermediate/'placements.json')]
   runpy.run_path(str(Path(__file__).with_name('normalize-purchased-components.py')),run_name='__main__')
  finally:
   sys.argv=previous_args
  canonical=json.loads((ROOT/'src/parts/rov-project/lib/purchased-instances.json').read_text())
  by_source={item['equipmentId']:item for item in canonical['occurrences']}
  assert len(by_source)==24
  for occurrence in occurrences:
   if occurrence['supply']!='purchased':continue
   instance=by_source[occurrence['parameters']['equipment']]
   occurrence.update(libraryId=instance['libraryId'],parameters=instance['parameters'],placement=instance['placement'],sourceFit=instance['fit'])
   occurrence['label']=re.sub(r', mirrored CAD(?: [0-9]+)?','',occurrence['label'])
   if instance.get('notes'):occurrence['notes']=' '.join([occurrence.get('notes',''),instance['notes']]).strip()
   if not instance['fit'].get('exactRigidFit',True):
    result['issues'].append(occurrence['id']+': '+instance['notes'])
  write(ROOT/'src/parts/rov-project/lib/assembly.json',result)
  print('PHYSICAL_ASSEMBLY',len(occurrences),'MADE26 PRINT4 BUY24; canonical products reused with source discrepancies recorded',flush=True)
 finally:
  App.closeDocument(doc.Name);prefs.SetBool('ImportCompound',old)
run()
