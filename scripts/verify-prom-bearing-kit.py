"""Native check of stock bearing fits and current public macro/fabrication exports.
The unchanged kinematics retain the earlier proof; this checks the replaced
stationary bearings, thrust sleeves and disc seats, not a strength rating.
"""
import json,math,sys,time,hashlib,importlib.util
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
OUT=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/prom-bearing-kit');DATA=json.loads((OUT/'capture.json').read_text())
START=time.monotonic();R={'passed':False,'captureSha256':hashlib.sha256((OUT/'capture.json').read_bytes()).hexdigest(),'verifierSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'cases':[],'localChecks':[],'laser':[]}
def save(stage):
 R['elapsedSeconds']=time.monotonic()-START;(OUT/'native-report.json').write_text(json.dumps(R,indent=2));print(stage,flush=True)
def execute(source):
 scope={'App':App,'Part':Part,'math':math};exec(source,scope);return scope
def groups(scope):
 result={}
 for s,m in zip(scope['components'],scope['component_metadata']):result.setdefault(m['AssemblyOccurrenceId'],[]).append(s)
 return {key:Part.makeCompound(items) for key,items in result.items()}
def overlap(a,b):
 aa,bb=a.BoundBox,b.BoundBox
 if any(min(getattr(aa,k+'Max'),getattr(bb,k+'Max'))-max(getattr(aa,k+'Min'),getattr(bb,k+'Min'))<1e-8 for k in 'XYZ'):return 0.
 return abs(a.common(b).Volume)
def valid(s):return not s.isNull() and s.isValid() and s.isClosed() and len(s.Solids)>0 and s.Volume>0
try:
 for row in DATA['locals']:
  g=groups(execute(row['source']));assert all(valid(s) for s in g.values());count=0
  for identity in row['changed']:
   for other,s in g.items():
    if identity==other or other in row['changed'] and other<identity:continue
    v=overlap(g[identity],s);assert v<1e-7,('local',row['part'],row['angle'],identity,other,v);count+=1
  if row.get('frameSource'):
   if DATA.get('priorScrewSources'):
    old=groups(execute(next(p['source'] for p in DATA['priorScrewSources'] if p['part']==row['part'])))
    added=abs(g['lead-screw'].cut(old['lead-screw']).Volume);removed=abs(old['lead-screw'].cut(g['lead-screw']).Volume)
    target=2*math.pi*(2.5**2-2.4**2)*.7
    assert removed<1e-7 and abs(added-target)<1e-6,('only two grooves filled',row['part'],added,removed,target)
    for identity in ['fixed-inner-spacer','floating-inner-spacer']:
     assert g[identity].distToShape(g['lead-screw'])[0]<1e-7,('missing shoulder contact',identity)
    R.setdefault('shoulderRetention',[]).append({'part':row['part'],'removedInnerRingsPerScrew':2,'retainedOuterRingsPerScrew':2,'filledGrooveVolumeMm3':added,'removedScrewMaterialMm3':removed,'innerSleeveContactsShoulder':True})
   frame=groups(execute(row['frameSource']));assert all(valid(s) for s in frame.values())
   for channel in row['placedSources']:
    world=dict(zip(channel['ids'],execute(channel['source'])['components']))
    for identity in row['changed']:
     for other,s in frame.items():
      v=overlap(world[identity],s);assert v<1e-7,('frame',identity,other,v);count+=1
   if 'mini' in row['part']:
    probe=Part.makeCylinder(2.45,140,App.Vector(-100,0,0),App.Vector(1,0,0))
    for identity,s in frame.items():assert overlap(probe,s)<1e-7,('central passage',identity)
  R['localChecks'].append({'part':row['part'],'angle':row['angle'],'pairs':count});save('local '+row['part']+' '+str(row['angle']))
 # Read the exact emitted DXF/SVG, independently of the shape builder.
 spec=importlib.util.spec_from_file_location('contours',Path(__file__).with_name('verify-tr8-cnc-fabrication.py'))
 reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
 for folder in [p for p in OUT.iterdir() if p.is_dir() and p.name.startswith('tr8-quad')]:
  for dxf in folder.glob('*.dxf'):
   svg=dxf.with_suffix('.svg');a,ac,_=reader.dxf_read(dxf);b,bc,_=reader.svg_read(svg)
   assert ac==bc and reader.difference(a.extrude(App.Vector(0,0,1)),b.extrude(App.Vector(0,0,1)))<1e-6
   R['laser'].append(str(dxf))
  scope=execute(next(folder.glob('*laser-blanks.FCMacro')).read_text());doc=scope['doc'];shapes=[o.Shape for o in doc.Objects if hasattr(o,'Shape')]
  assert len(shapes)==15 and all(valid(s) and len(s.Solids)==1 for s in shapes)
  App.closeDocument(doc.Name)
 save('laser')
 for case in DATA['cases']:
  doc=App.newDocument('PromBearingAudit');sentinel=doc.addObject('Part::Feature','Sentinel');sentinel.Shape=Part.makeBox(1,1,1)
  before=set(o.Name for o in doc.Objects);execute(Path(case['path']).read_text())
  objects=[o for o in doc.Objects if o.Name not in before and hasattr(o,'Shape') and hasattr(o,'AssemblyOccurrenceId')]
  assert objects and all(valid(o.Shape) for o in objects)
  ids={o.AssemblyOccurrenceId for o in objects};assert len(ids)==case['expected'],(case['name'],len(ids),case['expected'])
  bearings={o.AssemblyOccurrenceId:json.loads(o.ConfigurationJSON) for o in objects if getattr(o,'LibraryId','')=='flanged-ball-bearing'}
  assert len(bearings)==16
  for obj in objects:
   if getattr(obj,'LibraryId','')!='flanged-ball-bearing':continue
   params=json.loads(obj.ConfigurationJSON);size='×'.join(format(float(params[key]),'g') for key in ['bore','outer','width'])+' mm'
   assert size in obj.Label and size in obj.ProductName,('bearing size missing from native name',obj.Label,obj.ProductName,size)
  if case['kit']=='prom-smb':
   assert sum(p['bore']==5 and p['outer']==10 for p in bearings.values())==8
   assert sum(p['bore']==6 and p['outer']==10 for p in bearings.values())==4
   assert sum(p['bore']==3 and p['outer']==6 for p in bearings.values())==4
  if 'mini' in case['part']:
   probe=Part.makeCylinder(2.45,140,App.Vector(-100,0,0),App.Vector(1,0,0))
   for o in objects:assert overlap(probe,o.Shape)<1e-7,('public central passage',o.Label)
  assert abs(sentinel.Shape.Volume-1)<1e-9
  R['cases'].append({'name':case['name'],'validNativeChildren':len(objects),'configuredOccurrences':len(ids),'bearingOccurrences':len(bearings),'bearingLabelsIncludeSizes':True})
  App.closeDocument(doc.Name);save('public '+case['name'])
 R['passed']=True;save('passed')
except BaseException as error:
 R['error']=str(error);save('FAILED');raise
