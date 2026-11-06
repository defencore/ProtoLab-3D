"""Regression checks for optional proof reuse, using an isolated archived CAD fixture.

Arguments: a freshly recertified prototype directory and its archived whole
cases.json. This never edits production CAD files or production proof reports.
"""
import copy,json,math,sys
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
from tr8_cross_stock import CrossStockGuard,digest

fixture=Path(sys.argv[1]).resolve()
whole_path=Path(sys.argv[2]).resolve()
case=next(c for c in json.loads(whole_path.read_text()) if c['mode']=='full' and all(c['parameters']['angle'+letter]==0 for letter in 'ABCD'))
case['crossChannelStockProof']=dict(report='swept-stock.json',cases='cases.json',audit='native-report.json')
scope=dict(App=App,Part=Part,math=math)
exec(case['source'],scope)
shapes=scope['components'];metadata=scope['component_metadata'];hashes=[digest(s.exportBrepToString()) for s in shapes]
guard=CrossStockGuard(fixture)
channels,report=guard.check(case,scope,shapes,metadata,hashes)
assert channels==set('abcd') and report['freshContainedLocalSources']==1
assert all(record.get('QuadChannel') not in channels for record in metadata if not record['AssemblyOccurrenceId'].startswith(('a-','b-','c-','d-')))
checks=['valid-native-envelope-and-rigid-mount']
def rejected(label,callback):
 try:callback()
 except (AssertionError,KeyError):checks.append(label)
 else:raise AssertionError('Invalid proof reuse was accepted: '+label)

bad=copy.deepcopy(case);bad['channelPlacements'][0]['origin'][0]+=.1
rejected('reject-changed-mount',lambda:guard.check(bad,scope,shapes,metadata,hashes))
changed=list(shapes);changed[0]=shapes[0].copy();changed[0].translate(App.Vector(.1,0,0));changed_hashes=[digest(s.exportBrepToString()) for s in changed]
rejected('reject-actual-world-shape-change',lambda:guard.check(case,scope,changed,metadata,changed_hashes))
local_source=next(iter(scope['_quad_cache']))
# Select a channel scope, not the separate structural frame source.
local_source=next(source for source,value in scope['_quad_cache'].items() if any(r['AssemblyOccurrenceId']=='lead-screw' for r in value['component_metadata']))
raw=scope['_quad_cache'][local_source]['components'];original=raw[0]
try:
 raw[0]=original.copy();raw[0].translate(App.Vector(0,100,0))
 rejected('reject-local-native-escape',lambda:guard.check(case,scope,shapes,metadata,hashes))
finally:raw[0]=original
path=fixture/'swept-stock.json';original_report=path.read_bytes()
try:
 invalid=json.loads(original_report);invalid['scriptSha256']='0'*64;path.write_text(json.dumps(invalid))
 rejected('reject-stale-proof-script',lambda:CrossStockGuard(fixture).check(case,scope,shapes,metadata,hashes))
finally:path.write_bytes(original_report)
print(json.dumps(dict(passed=True,checks=checks,nativeContainment=report)),flush=True)
