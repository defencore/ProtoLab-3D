/** Fresh native mating proof for the shared frame's standard threaded column stack. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import { frameColumnPieces } from '../src/parts/tr8-quad-actuator/lib/columns';
import { libraries } from '../src/parts/tr8-quad-actuator/lib/mechanism';

const directory = resolve(process.argv[2] ?? 'test-results/tr8-quad-actuator');
mkdirSync(directory, { recursive: true });
const pieces = frameColumnPieces();
const ids = pieces.map((piece) => piece.component.id);
const pairs: string[][] = [];
for (let line = 1; line <= 4; line++) {
  pairs.push([`frame-column-${line}-1`, `frame-column-${line}-2`]);
  pairs.push([`frame-column-front-bolt-${line}`, `frame-column-${line}-1`], [`frame-column-rear-bolt-${line}`, `frame-column-${line}-2`]);
}
const source = withGeometryMode('full', () => componentPython(libraries, pieces));
writeFileSync(resolve(directory, 'verify-columns.py'), `import sys,json,math,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
${source}
ids=json.loads(${JSON.stringify(JSON.stringify(ids))})
pairs=json.loads(${JSON.stringify(JSON.stringify(pairs))})
assert len(components)==len(ids)==20
assert all(s.isValid() and s.isClosed() and len(s.Solids)==1 and s.Volume>0 for s in components)
rows=[]
for first,second in pairs:
 a,b=components[ids.index(first)],components[ids.index(second)]
 volume=abs(a.common(b).Volume)
 assert volume<.001,(first,second,volume)
 rows.append(dict(first=first,second=second,overlapMm3=volume))
controls=[]
for first,second in pairs[:3]:
 shape=components[ids.index(first)].copy()
 record=component_metadata[ids.index(first)]
 threads=json.loads(record['ThreadFeaturesJSON'])
 feature=threads[0]
 shape.rotate(App.Vector(*feature['origin']),App.Vector(*feature['axis']),90)
 volume=abs(shape.common(components[ids.index(second)]).Volume)
 assert volume>.001,(first,second,'insensitive control',volume)
 controls.append(dict(first=first,second=second,phaseShiftDegrees=90,overlapMm3=volume))
report=dict(passed=True,mode='full',components=len(components),matedPairs=rows,positiveControls=controls,sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),runtimeSha256=hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest())
Path(__file__).with_name('column-thread-mating.json').write_text(json.dumps(report,indent=2))
print(json.dumps(dict(passed=True,pairs=len(rows),controls=len(controls))),flush=True)
`);
console.log(JSON.stringify({ directory, occurrences: pieces.length, pairs: pairs.length }));
