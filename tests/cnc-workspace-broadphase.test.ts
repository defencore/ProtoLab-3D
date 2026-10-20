import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import {
  workspaceBroadphasePython,
  workspaceDefinition,
} from '../scripts/cnc-workspace-broadphase';
import { withGeometryMode } from '../src/core/geometry-mode';
import machine, { millingComponents, millingLayout } from '../src/parts/cnc-milling-machine/part';

const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

test('workspace configuration guards retain all executed definition fields without procurement metadata', () => {
  const component = {
    id: 'axis-screw',
    libraryId: 'cnc-precision-screw',
    parameters: { diameter: 25, lead: 10, length: 1800 },
    notes: 'Factory order requires inspection.',
    designation: 'ORDER-A',
    supply: 'purchased',
  };
  assert.deepEqual(workspaceDefinition(component), {
    id: component.id,
    libraryId: component.libraryId,
    parameters: component.parameters,
  });
  assert.deepEqual(
    workspaceDefinition({
      ...component,
      notes: 'Revised purchasing instructions.',
      designation: 'ORDER-B',
    }),
    workspaceDefinition(component),
  );
  for (const changed of [
    { ...component, id: 'different-occurrence' },
    { ...component, libraryId: 'different-physical-part' },
    { ...component, parameters: { ...component.parameters, lead: 5 } },
  ])
    assert.notDeepEqual(workspaceDefinition(changed), workspaceDefinition(component));
});

test(
  'native translated bounds preserve actual CNC workspace candidates at all 36 poses, touch and overlap controls',
  { skip: !process.env.FREECAD_PYTHON, timeout: 180_000 },
  () => {
    const directory = resolve('test-results/cnc-milling');
    const checkpointPath = resolve(directory, 'simple-checkpoint.json');
    const checkpointBytes = readFileSync(checkpointPath);
    const checkpoint = JSON.parse(checkpointBytes.toString());
    const parameters = { ...machine.defaults, xPosition: 50, yPosition: 50, zPosition: 50 };
    const pieces = millingComponents(parameters),
      layout = millingLayout(parameters);
    const geometry = withGeometryMode('simple', () => machine.python(parameters, 'assembled'));
    assert.equal(checkpoint.status, 'passed');
    assert.equal(checkpoint.geometrySourceHash, sha(geometry));
    assert.deepEqual(checkpoint.configuration, parameters);
    assert.deepEqual(
      checkpoint.occurrenceIds,
      pieces.map((p) => p.component.id),
    );
    assert.equal(checkpoint.components, pieces.length);
    assert.equal(readFileSync(resolve(directory, 'simple-geometry.py'), 'utf8'), geometry);
    assert.equal(sha(readFileSync(checkpoint.documentPath)), checkpoint.documentFileHash);
    const nativePython = process.env.FREECAD_PYTHON!;
    const nativeLib = process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib';
    const runtimeSignature = JSON.stringify(
      [nativePython, resolve(nativeLib, 'FreeCAD.so')].map((path) => ({
        path,
        size: statSync(path).size,
        modified: statSync(path).mtimeMs,
      })),
    );
    assert.equal(checkpoint.runtimeSignature, runtimeSignature);
    const sampledIds = [
      'fixed-bed-side--1',
      'y-rail-pad-1',
      'gantry-box-beam',
      'x-saddle-rear',
      'x-z-fixed-saddle',
      'moving-z-saddle',
      'y-drive-screw',
      'x-drive-screw',
      'z-drive-screw',
      'x-ball-nut',
      'z-ball-nut',
      'cutting-spindle',
    ];
    const samples = sampledIds.map((id) => {
      const piece = pieces.find((p) => p.component.id === id);
      assert.ok(piece, id);
      return { ...workspaceDefinition(piece.component), motion: piece.motion };
    });
    assert.deepEqual(new Set(samples.map((p) => p.motion)), new Set(['fixed', 'gantry', 'x', 'z']));
    const input = {
      checkpointPath,
      checkpointHash: sha(checkpointBytes),
      cadPath: checkpoint.documentPath,
      cadHash: checkpoint.documentFileHash,
      geometrySourceHash: checkpoint.geometrySourceHash,
      runtimeSignature,
      configuration: parameters,
      ids: checkpoint.occurrenceIds,
      samples,
      work: [layout.workX, layout.workY, layout.workZ],
      tableTop: layout.tableTop,
      spindleY: layout.spindleY,
      stockHeights: [5, 50, 100, 200],
      positions: [-1, 0, 1],
    };
    const source = `import FreeCAD as App, Part, json, math, hashlib
data = json.loads(${JSON.stringify(JSON.stringify(input))})
assert hashlib.sha256(open(data['checkpointPath'],'rb').read()).hexdigest()==data['checkpointHash']
assert hashlib.sha256(open(data['cadPath'],'rb').read()).hexdigest()==data['cadHash']
doc=App.openDocument(data['cadPath'])
root=doc.getObject('CNC_Milling_Machine')
assert root.GeometryMode=='simple' and root.GeometrySourceHash==data['geometrySourceHash']
assert json.loads(root.ConfigurationJSON)==data['configuration']
features=sorted([f for f in root.Group if hasattr(f,'OccurrenceId')],key=lambda f:int(f.Name.split('_')[-1]))
assert [f.OccurrenceId for f in features]==data['ids']
by_id={f.OccurrenceId:f for f in features}
${workspaceBroadphasePython}
samples=[]
for sample in data['samples']:
    f=by_id[sample['id']]
    assert f.LibraryId==sample['libraryId'] and json.loads(f.ConfigurationJSON)==sample['parameters']
    shape=f.Shape
    assert not shape.isNull() and shape.isValid() and shape.isClosed() and math.isfinite(shape.Volume) and shape.Volume>0
    samples.append((sample,shape,_workspace_bounds(shape)))
def old_overlap(a,b):
    return min(a.XMax,b.XMax)-max(a.XMin,b.XMin)>0 and min(a.YMax,b.YMax)-max(a.YMin,b.YMin)>0 and min(a.ZMax,b.ZMax)-max(a.ZMin,b.ZMin)>0
def checked_common(a,b):
    intersection=a.common(b);volume=intersection.Volume
    assert math.isfinite(volume)
    if intersection.Solids:assert intersection.isValid() and intersection.isClosed()
    return volume
poses=[];max_error=0.;old_copies=0;deferred_copies=0
for height in data['stockHeights']:
    stock=Part.makeBox(data['work'][0],data['work'][1],height,App.Vector(-data['work'][0]/2,data['spindleY']-data['work'][1]/2,data['tableTop']))
    stock_bounds=_workspace_bounds(stock)
    for x in data['positions']:
        for y in data['positions']:
            dx,dy,dz=x*data['work'][0]/2,y*data['work'][1]/2,height-data['work'][2]/2
            before=[];after=[];positive_probe=[]
            for sample,component,bounds in samples:
                translation=_workspace_translation(sample['motion'],dx,dy,dz)
                posed=component.copy();posed.translate(App.Vector(*translation));old_copies+=1
                actual=_workspace_bounds(posed);translated=_workspace_translated_bounds(bounds,translation)
                error=max(abs(a-b) for a,b in zip(actual,translated));max_error=max(max_error,error)
                assert error<=1e-9,(sample['id'],translation,actual,translated)
                if old_overlap(stock.BoundBox,posed.BoundBox):before.append(sample['id'])
                if _workspace_bounds_overlap(stock_bounds,translated):
                    after.append(sample['id']);deferred_copies+=1
                    candidate=component.copy();candidate.translate(App.Vector(*translation))
                    old_volume=checked_common(posed,stock);new_volume=checked_common(candidate,stock)
                    assert abs(old_volume-new_volume)<=1e-9
                    assert abs(new_volume)<=.001,('actual stock clash',sample['id'],new_volume)
                # A native box inside each posed bounding envelope exercises positive selection too.
                center=tuple((actual[i]+actual[i+1])/2 for i in (0,2,4))
                probe=Part.makeBox(1,1,1,App.Vector(*(value-.5 for value in center)))
                assert old_overlap(probe.BoundBox,posed.BoundBox)==_workspace_bounds_overlap(_workspace_bounds(probe),translated)
                assert _workspace_bounds_overlap(_workspace_bounds(probe),translated)
                positive_probe.append(sample['id'])
            assert before==after,(height,x,y,before,after)
            poses.append({'height':height,'x':dx,'y':dy,'z':dz,'oldCandidates':before,'newCandidates':after,'positiveProbeCandidates':positive_probe})
assert len(poses)==36
control_box=Part.makeBox(10,10,10)
controls=[]
for name,translation,expected in [('face-touch',(10,0,0),False),('edge-touch',(10,10,0),False),('corner-touch',(10,10,10),False),('gap',(10.25,0,0),False),('overlap',(9.75,0,0),True)]:
    posed=control_box.copy();posed.translate(App.Vector(*translation))
    new_bounds=_workspace_translated_bounds(_workspace_bounds(control_box),translation)
    old=old_overlap(control_box.BoundBox,posed.BoundBox);new=_workspace_bounds_overlap(_workspace_bounds(control_box),new_bounds)
    assert old==new==expected
    volume=checked_common(control_box,posed)
    assert (abs(volume)>.001)==expected
    controls.append({'name':name,'oldCandidate':old,'newCandidate':new,'overlapMm3':volume})
# The overlap control also uses an unchanged actual installed solid, rather than only boxes.
sample,component,bounds=next(item for item in samples if item[0]['id']=='x-ball-nut')
translation=_workspace_translation(sample['motion'],400,-750,100)
posed=component.copy();posed.translate(App.Vector(*translation))
new_bounds=_workspace_translated_bounds(bounds,translation)
assert _workspace_bounds_overlap(_workspace_bounds(posed),new_bounds)
candidate=component.copy();candidate.translate(App.Vector(*translation))
overlap=checked_common(posed,candidate)
assert overlap>.001 and abs(overlap-posed.Volume)<=1e-6
result={'status':'passed','samples':[{'id':s['id'],'motion':s['motion'],'brepSha256':hashlib.sha256(c.exportBrepToString().encode()).hexdigest(),'bounds':b} for s,c,b in samples],'poses':poses,'boundComparisons':len(samples)*len(poses),'maxBoundErrorMm':max_error,'oldCopies':old_copies,'deferredCopies':deferred_copies,'controls':controls,'actualOverlapControl':{'id':sample['id'],'overlapMm3':overlap}}
print('WORKSPACE_BROADPHASE:'+json.dumps(result),flush=True)
`;
    const path = '/tmp/protolab-cnc-workspace-broadphase.py';
    writeFileSync(path, source);
    const result = spawnSync(nativePython, [path], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONPATH: nativeLib },
      timeout: 170_000,
      maxBuffer: 4_000_000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    const line = result.stdout.split('\n').find((one) => one.startsWith('WORKSPACE_BROADPHASE:'));
    assert.ok(line);
    const native = JSON.parse(line.slice('WORKSPACE_BROADPHASE:'.length));
    assert.equal(native.status, 'passed');
    assert.equal(native.poses.length, 36);
    assert.equal(native.boundComparisons, sampledIds.length * 36);
    if (process.env.CNC_WORKSPACE_BROADPHASE_PROOF) {
      const proofPath = resolve(process.env.CNC_WORKSPACE_BROADPHASE_PROOF);
      mkdirSync(dirname(proofPath), { recursive: true });
      const archivedSourcePath = resolve(dirname(proofPath), 'native-proof.py');
      writeFileSync(archivedSourcePath, source);
      writeFileSync(
        proofPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            sourcePath: path,
            archivedSourcePath,
            sourceSha256: sha(source),
            helperSha256: sha(readFileSync(resolve('scripts/cnc-workspace-broadphase.ts'))),
            nativePythonSha256: sha(readFileSync(nativePython)),
            nativeLibrarySha256: sha(readFileSync(resolve(nativeLib, 'FreeCAD.so'))),
            input,
            ...native,
          },
          null,
          2,
        ) + '\n',
      );
    }
    // Loading the accepted document is read-only; both checkpoint and saved CAD remain exact.
    assert.equal(sha(readFileSync(checkpointPath)), input.checkpointHash);
    assert.equal(sha(readFileSync(input.cadPath)), input.cadHash);
  },
);
