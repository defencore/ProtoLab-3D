"""Isolated FreeCAD proof of selected TR8 threads, mating phases and public exports."""
import json, math, sys, time
from pathlib import Path
sys.path.insert(0, '/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part

out=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-selectable-screw')
data=json.loads((out/'lead-capture.json').read_text())
report={'passed':False,'pairs':[],'details':[],'assemblies':[]};start=time.monotonic()
def save(stage):
 report['elapsedSeconds']=time.monotonic()-start
 (out/'lead-native-report.json').write_text(json.dumps(report,indent=2)+'\n')
 print(stage,flush=True)
def execute(path):
 scope={'App':App,'Part':Part,'math':math};exec(Path(path).read_text(),scope);return scope
def valid(shape):
 assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0
def thread(record,row):
 features=json.loads(record['ThreadFeaturesJSON']);assert len(features)==1
 f=features[0];assert f['lead']==row['lead'] and f['starts']==row['starts'] and f['pitch']==2
 assert f['representation']=='machined-helix';return f
try:
 for row in data['pairs']:
  scope=execute(row['path']);screw,nut=scope['components'];valid(screw);valid(nut)
  for record in scope['component_metadata']:thread(record,row)
  overlap=abs(screw.common(nut).Volume);assert overlap<.001,(row,overlap)
  wrong=screw.copy();wrong.rotate(App.Vector(0,0,10),App.Vector(1,0,0),180/row['starts'])
  control=abs(wrong.common(nut).Volume);assert control>.1,(row,control)
  # Translate the nut one complete lead and rotate the screw one revolution:
  # the same stationary nut thread must still mate at the new axial station.
  advanced=nut.copy();advanced.translate(App.Vector(row['lead'],0,0))
  assert abs(screw.common(advanced).Volume)<.001
  report['pairs'].append({**row,'overlapMm3':overlap,'wrongPhaseOverlapMm3':control,'oneLeadTranslationMates':True})
  save('mating '+row['screwModel']+' '+str(row['angle']))
 for row in data['details']:
  scope=execute(row['path']);doc=scope['doc']
  objects=[o for o in doc.Objects if hasattr(o,'ThreadFeaturesJSON')];assert len(objects)==1
  valid(objects[0].Shape);thread({'ThreadFeaturesJSON':objects[0].ThreadFeaturesJSON},row)
  report['details'].append(row);App.closeDocument(doc.Name);save('detail '+row['screwModel']+' '+row['id'])
 for row in data['assemblies']:
  doc=App.newDocument('LeadSelectionAudit');sentinel=doc.addObject('Part::Feature','Sentinel');sentinel.Shape=Part.makeBox(1,1,1)
  execute(row['path']);objects=[o for o in doc.Objects if hasattr(o,'AssemblyOccurrenceId')]
  assert len({o.AssemblyOccurrenceId for o in objects})==115
  working=[o for o in objects if o.AssemblyOccurrenceId.endswith(('lead-screw','lead-nut'))];assert len(working)==8
  for o in objects:
   assert o.Shape.isValid() and o.Shape.isClosed() and o.Shape.Volume>0
  for o in working:
   f=json.loads(o.ThreadFeaturesJSON)[0]
   assert (f['lead'],f['starts'],f['pitch'])==(2,1,2)
   assert f['representation']==('machined-helix' if row['mode']=='full' else 'nominal-cylinder')
  bb=Part.makeCompound([o.Shape for o in objects]).BoundBox
  assert all(abs(a-b)<1e-5 for a,b in zip([bb.XLength,bb.YLength,bb.ZLength],[119,70,70]))
  assert abs(sentinel.Shape.Volume-1)<1e-10
  report['assemblies'].append({**row,'validChildren':len(objects),'occurrences':115,'selectedWorkingThreads':8})
  App.closeDocument(doc.Name);save('assembly '+row['mode'])
 report['passed']=True;save('passed')
except BaseException as error:
 report['error']=str(error);save('FAILED');raise
