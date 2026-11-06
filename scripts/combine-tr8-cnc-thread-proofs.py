"""Bind fresh carrier and integral-frame thread proofs to one whole case set."""
import json,hashlib,os,sys
from pathlib import Path
folder=Path(sys.argv[1]).resolve();cases_path=folder/'cases.json';cases=json.loads(cases_path.read_text())
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
runtime=sha(os.environ.get('FREECAD_PYTHON','/Applications/FreeCAD.app/Contents/Resources/bin/python'))
frame_path=folder/'frame/thread-mating.json';channel_path=folder/'channel/thread-mating.json'
frame=json.loads(frame_path.read_text());channel=json.loads(channel_path.read_text())
assert frame['passed'] and channel['passed'] and frame['runtimeSha256']==channel['runtimeSha256']==runtime
assert frame['sourceSha256']==sha(folder/'frame/frame-thread-proof.py')
assert channel['sourceSha256']==sha(folder/'channel/thread-pair-proof.py')
assert frame['specSha256']==sha(folder/'frame/frame-thread-spec.json')
spec=json.loads((folder/'frame/frame-thread-spec.json').read_text());assert frame['nativeSourceSha256']==hashlib.sha256(spec['source'].encode()).hexdigest()
assert all(case['frameLayout']==spec['layout'] for case in cases)
pairs=[dict(row) for row in frame['matedPairs']];controls=[dict(row) for row in frame['positiveControls']]
for mount in cases[0]['channelPlacements']:
 for source,target in [(channel['matedPairs'],pairs),(channel['positiveControls'],controls)]:
  selected=[row for row in source if row['neutralNutX']==mount['neutralNutX']]
  assert len(selected)==2
  for row in selected:
   item=dict(row);item['occurrenceIds']=[mount['id']+'-'+identity for identity in row['occurrenceIds']];target.append(item)
assert len(pairs)==16 and len(controls)==10
report=dict(schemaVersion=1,passed=True,runtimeSha256=runtime,matedPairs=pairs,positiveControls=controls,frameProofSha256=sha(frame_path),channelProofSha256=sha(channel_path),casesSha256=sha(cases_path),combinerSha256=sha(__file__))
(folder/'thread-mating.json').write_text(json.dumps(report,indent=2));print(json.dumps(dict(passed=True,pairs=len(pairs),controls=len(controls),folder=str(folder))))
