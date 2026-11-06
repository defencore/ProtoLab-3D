/** Fresh native metric-thread proof for one integral CNC frame. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import { actuatorExternalThreads } from '../src/parts/tr8-compact-actuator/lib/mating';
import { cncLayout, type CncVariant } from '../src/parts/tr8-quad-cnc-actuator/lib/layout';
import { cncFramePieces } from '../src/parts/tr8-quad-cnc-actuator/lib/frame';
import { libraries } from '../src/parts/tr8-quad-cnc-actuator/lib/channel';
const variant = process.argv[2] as CncVariant;
const layout = cncLayout(variant);
const directory = resolve(process.argv[3] ?? `test-results/${variant === 'coplanar-64' ? 'tr8-quad-cnc-actuator' : 'tr8-quad-staggered-actuator'}/frame`);
mkdirSync(directory,{recursive:true});
const selected=cncFramePieces(layout).filter(p=>p.component.id==='cnc-middle-body'||p.component.libraryId==='bolt-screw');
const ids=selected.map(p=>p.component.id),bolts=selected.filter(p=>p.component.libraryId==='bolt-screw').map(p=>p.component.id);
if(bolts.length!==8)throw new Error('Expected all eight post-end bolts.');
const external=actuatorExternalThreads(selected);
const controls=['frame-front-bolt-1','frame-rear-bolt-1'].map(id=>{
 const datum=external.find(p=>p.componentId===id&&p.diameter===3);if(!datum)throw new Error('Missing M3 phase datum.');
 return{id,origin:datum.origin,axis:datum.axis,angle:90};
});
const source=withGeometryMode('full',()=>componentPython(libraries,selected));
writeFileSync(resolve(directory,'frame-thread-spec.json'),JSON.stringify({variant,layout,ids,bolts,controls,source}));
const code=`import sys,json,math,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
folder=Path(__file__).parent
spec=json.loads((folder/'frame-thread-spec.json').read_text())
scope=dict(App=App,Part=Part,math=math);exec(spec['source'],scope)
shapes=dict(zip(spec['ids'],scope['components']))
assert all(s.isValid() and s.isClosed() and len(s.Solids)==1 for s in shapes.values())
body=shapes['cnc-middle-body'];pairs=[];controls=[]
for identity in spec['bolts']:
 common=body.common(shapes[identity]);volume=0 if common.isNull() else common.Volume
 assert common.isNull() or common.isValid(),('Invalid mate Boolean',identity)
 assert math.isfinite(volume) and abs(volume)<=.001,(identity,volume)
 pairs.append(dict(occurrenceIds=[identity,'cnc-middle-body'],overlapMm3=volume,overlapBudgetMm3=.001))
 print(json.dumps(dict(stage='mate',id=identity,overlapMm3=volume)),flush=True)
for control in spec['controls']:
 wrong=shapes[control['id']].copy();wrong.rotate(App.Vector(*control['origin']),App.Vector(*control['axis']),control['angle'])
 common=body.common(wrong);assert not common.isNull() and common.isValid()
 volume=common.Volume;assert math.isfinite(volume) and volume>.001,(control,volume)
 controls.append(dict(occurrenceIds=[control['id'],'cnc-middle-body'],angleDegrees=control['angle'],overlapMm3=volume))
 print(json.dumps(dict(stage='wrong-phase',id=control['id'],overlapMm3=volume)),flush=True)
report=dict(schemaVersion=1,passed=True,variant=spec['variant'],freecad='.'.join(App.Version()[:3]),sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),specSha256=hashlib.sha256((folder/'frame-thread-spec.json').read_bytes()).hexdigest(),nativeSourceSha256=hashlib.sha256(spec['source'].encode()).hexdigest(),runtimeSha256=hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest(),matedPairs=pairs,positiveControls=controls)
(folder/'thread-mating.json').write_text(json.dumps(report,indent=2));print(json.dumps(dict(passed=True,pairs=len(pairs),controls=len(controls))),flush=True)
`;
writeFileSync(resolve(directory,'frame-thread-proof.py'),code);console.log(JSON.stringify({variant,bolts:bolts.length,directory}));
