#!/usr/bin/env python3
"""Run prepared supplier configurations in an installed headless FreeCAD Python runtime.

Example on macOS:
/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/verify-promtehimport-native.py
Pass --freecad-lib when the native FreeCAD module is outside Python's default path.
"""
import argparse, concurrent.futures, hashlib, json, subprocess, sys, tempfile
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('cases',nargs='?',default='/tmp/protolab-promteh-native-cases.json')
parser.add_argument('--freecad-lib',default='/Applications/FreeCAD.app/Contents/Resources/lib')
parser.add_argument('--output',default='/tmp/protolab-promteh-native-results.json')
parser.add_argument('--resume-cache',default='/tmp/protolab-promteh-native-success.json')
parser.add_argument('--jobs',type=int,default=1,help='Independent native processes; each owns its own FreeCAD documents')
args=parser.parse_args()
sys.path.insert(0,args.freecad_lib)
import FreeCAD as App
import Part

cases=json.loads(Path(args.cases).read_text());failures=[];reused=0
cache_path=Path(args.resume_cache)
success=set(json.loads(cache_path.read_text())) if cache_path.exists() else set()
version=App.Version()
def signature(case):
 return hashlib.sha256(json.dumps([version,case['code'],case['dimensions']],sort_keys=True).encode()).hexdigest()
if args.jobs>1:
 pending=[case for case in cases if signature(case) not in success]
 reused=len(cases)-len(pending)
 checked=reused
 print(json.dumps({'cases':len(cases),'reused':reused,'pending':len(pending),'jobs':min(args.jobs,8)}),flush=True)
 with tempfile.TemporaryDirectory(prefix='protolab-freecad-qa-') as folder:
  batches=[pending[index:index+100] for index in range(0,len(pending),100)]
  def check_batch(task):
   index,batch=task;prefix=Path(folder)/str(index)
   input_path=prefix.with_suffix('.json');output_path=prefix.with_suffix('.results.json');success_path=prefix.with_suffix('.success.json')
   input_path.write_text(json.dumps(batch))
   process=subprocess.run([sys.executable,str(Path(__file__).resolve()),str(input_path),'--freecad-lib',args.freecad_lib,'--output',str(output_path),'--resume-cache',str(success_path)],capture_output=True,text=True)
   result=json.loads(output_path.read_text()) if output_path.exists() else {'failures':[{'id':case['id'],'error':'Native worker did not return results: '+process.stderr[-1000:]} for case in batch]}
   passed=json.loads(success_path.read_text()) if success_path.exists() else []
   return len(batch),result['failures'],passed
  with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.jobs,8)) as pool:
   futures=[pool.submit(check_batch,task) for task in enumerate(batches)]
   for future in concurrent.futures.as_completed(futures):
    count,errors,passed=future.result();checked+=count;failures.extend(errors);success.update(passed)
    cache_path.write_text(json.dumps(sorted(success)))
    print(json.dumps({'checked':checked,'total':len(cases),'reused':reused,'failures':len(failures)}),flush=True)
 result={'cases':len(cases),'reused':reused,'failures':failures,'freecadVersion':version}
 Path(args.output).write_text(json.dumps(result,indent=2))
 print(json.dumps(result),flush=True)
 sys.exit(bool(failures))
for i,case in enumerate(cases):
 stamp=signature(case)
 if stamp in success:
  reused+=1
  continue
 doc=App.newDocument('ProtoLabSourceQA')
 try:
  exec(case['code'],{})
  feature=doc.Objects[-1];shape=feature.Shape
  assert shape.isValid() and shape.Solids and shape.Volume>0,'Invalid solid'
  assert all(solid.Volume>0 and solid.isValid() for solid in shape.Solids),'Invalid component'
  bounds=shape.optimalBoundingBox(False,False)
  actual=[bounds.XLength,bounds.YLength,bounds.ZLength]
  assert all(abs(a-b)<=max(.02,b*.002) for a,b in zip(actual,case['dimensions'])),f'Wrong envelope: {actual} != {case["dimensions"]}'
  assert feature.PartId and feature.CatalogSource and feature.CatalogDesignation,'Missing source metadata'
  success.add(stamp)
 except Exception as error:failures.append({'id':case['id'],'error':str(error)})
 finally:App.closeDocument(doc.Name)
 if (i+1)%50==0:
  cache_path.write_text(json.dumps(sorted(success)))
  print(json.dumps({'checked':i+1,'total':len(cases),'reused':reused,'failures':len(failures)}),flush=True)
cache_path.write_text(json.dumps(sorted(success)))
result={'cases':len(cases),'reused':reused,'failures':failures,'freecadVersion':version}
Path(args.output).write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
sys.exit(bool(failures))
