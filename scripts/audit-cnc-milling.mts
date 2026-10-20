/** Checkpoint real CAD before checks; resume exact unchanged native pair/pose cases. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import machine, { millingPieces } from '../src/parts/cnc-milling-machine/part';
import { millingLibraries } from '../src/parts/cnc-milling-machine/lib/composition';
import { withGeometryMode, type GeometryMode } from '../src/core/geometry-mode';
import {
  hasCurrentNativeEvidence,
  matchingCheckpointAudit,
  preserveUnselectedNativeResults,
  type CurrentNativeEvidence,
} from './cnc-native-report';
const directory = resolve('test-results/cnc-milling');
mkdirSync(directory, { recursive: true });
const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const nativePython =
  process.env.FREECAD_PYTHON ?? '/Applications/FreeCAD.app/Contents/Resources/bin/python';
const pythonLib = process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib';
const runtimeSignature = JSON.stringify(
  [nativePython, resolve(pythonLib, 'FreeCAD.so')].map((path) => ({
    path,
    ...(existsSync(path) ? { size: statSync(path).size, modified: statSync(path).mtimeMs } : {}),
  })),
);
const reportPath = resolve(directory, 'assembly-native.json');
const previous = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : undefined;
const timeoutMs = Number(process.env.CNC_AUDIT_TIMEOUT_MS ?? 7200000);
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000)
  throw new Error('Use a finite audit execution timeout.');
if (process.env.CNC_ASSEMBLY_MODE && !['simple', 'full'].includes(process.env.CNC_ASSEMBLY_MODE))
  throw new Error('CNC_ASSEMBLY_MODE must be simple or full.');
const selectedModes = (['simple', 'full'] as GeometryMode[]).filter(
  (mode) => !process.env.CNC_ASSEMBLY_MODE || process.env.CNC_ASSEMBLY_MODE === mode,
);
const currentGeometryHashes = new Map<GeometryMode, string>();
function currentAssemblyEvidence(record: any): CurrentNativeEvidence | undefined {
  if (!['simple', 'full'].includes(record.mode)) return undefined;
  try {
    const mode = record.mode as GeometryMode;
    let geometrySourceHash = currentGeometryHashes.get(mode);
    if (!geometrySourceHash) {
      geometrySourceHash = hash(
        withGeometryMode(mode, () => machine.python(machine.defaults, 'assembled')),
      );
      currentGeometryHashes.set(mode, geometrySourceHash);
    }
    const checkpoint = JSON.parse(
      readFileSync(resolve(directory, `${mode}-checkpoint.json`), 'utf8'),
    );
    const pieces = millingPieces(machine.defaults, 'assembled');
    if (
      checkpoint.status !== 'passed' ||
      checkpoint.geometrySourceHash !== geometrySourceHash ||
      checkpoint.runtimeSignature !== runtimeSignature ||
      checkpoint.documentPath !== record.documentPath ||
      checkpoint.documentFileHash !== record.documentFileHash ||
      JSON.stringify(checkpoint.configuration) !== JSON.stringify(machine.defaults) ||
      JSON.stringify(checkpoint.occurrenceIds) !==
        JSON.stringify(pieces.map((p) => p.component.id)) ||
      checkpoint.components !== pieces.length ||
      hash(readFileSync(resolve(directory, `${mode}-geometry.py`))) !== geometrySourceHash
    )
      return undefined;
    return {
      geometrySourceHash,
      sourcePath: record.sourcePath,
      input: {
        mode,
        geometrySourceHash,
        runtimeSignature,
        configuration: machine.defaults,
        ids: pieces.map((p) => p.component.id),
        definitions: pieces.map((p) => p.component),
        documentPath: record.documentPath,
      },
      cad: { path: record.documentPath, fileHash: record.documentFileHash },
    };
  } catch {
    return undefined;
  }
}
const results: any[] = preserveUnselectedNativeResults(
  previous,
  runtimeSignature,
  new Set(selectedModes),
  (record: any) => record.mode,
  currentAssemblyEvidence,
);
const retainedModes = results.map((record) => record.mode);
const selectedResults: any[] = [];
for (const mode of ['simple', 'full'] as GeometryMode[]) {
  if (process.env.CNC_ASSEMBLY_MODE && process.env.CNC_ASSEMBLY_MODE !== mode) continue;
  const pieces = millingPieces(machine.defaults, 'assembled');
  const geometry = withGeometryMode(mode, () => machine.python(machine.defaults, 'assembled'));
  const geometrySourceHash = hash(geometry);
  currentGeometryHashes.set(mode, geometrySourceHash);
  const attempts = resolve(directory, 'attempts');
  mkdirSync(attempts, { recursive: true });
  const kernelHashes = new Map<string, string>();
  const occurrenceSources = pieces.map((piece) => {
    const component = piece.component,
      part = millingLibraries.find((part) => part.id === component.libraryId)!;
    const key = JSON.stringify([component.libraryId, component.parameters, component.state]);
    let kernelHash = kernelHashes.get(key);
    if (!kernelHash) {
      kernelHash = hash(
        withGeometryMode(mode, () => part.python(component.parameters, component.state)),
      );
      kernelHashes.set(key, kernelHash);
    }
    const hashInput = [
      kernelHash,
      component.libraryId,
      component.parameters,
      component.state,
      component.placement,
      piece.position ?? [0, 0, 0],
      (piece as typeof piece & { motion: string }).motion,
    ];
    return { id: component.id, sourceFingerprint: hash(JSON.stringify(hashInput)), hashInput };
  });
  const checkpointPath = resolve(directory, `${mode}-checkpoint.json`),
    pairPath = resolve(directory, `${mode}-pairs.json`);
  let previousPairPath: string | undefined;
  if (existsSync(checkpointPath) && existsSync(pairPath)) {
    const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    if (
      checkpoint.geometrySourceHash !== geometrySourceHash &&
      existsSync(checkpoint.documentPath) &&
      checkpoint.documentFileHash === hash(readFileSync(checkpoint.documentPath))
    ) {
      const prefix = resolve(attempts, checkpoint.geometrySourceHash),
        oldProofPath = prefix + '-occurrence-sources.json',
        archivedProof = existsSync(oldProofPath)
          ? JSON.parse(readFileSync(oldProofPath, 'utf8'))
          : undefined;
      const archiveValid =
        archivedProof?.geometrySourceHash === checkpoint.geometrySourceHash &&
        existsSync(prefix + '.FCStd') &&
        hash(readFileSync(prefix + '.FCStd')) === checkpoint.documentFileHash &&
        archivedProof.auditSourcePath &&
        existsSync(archivedProof.auditSourcePath) &&
        hash(readFileSync(archivedProof.auditSourcePath)) === archivedProof.auditSourceHash &&
        existsSync(prefix + '-geometry.py') &&
        hash(readFileSync(prefix + '-geometry.py')) === checkpoint.geometrySourceHash;
      let reusableArchive = archiveValid;
      if (!archiveValid) {
        copyFileSync(checkpoint.documentPath, prefix + '.FCStd');
        writeFileSync(
          prefix + '-checkpoint.json',
          JSON.stringify({ ...checkpoint, documentPath: prefix + '.FCStd' }, null, 2),
        );
        const recorded = previous?.results.find((result: any) => result.mode === mode),
          oldAuditPath = recorded?.sourcePath,
          oldProofPath = prefix + '-occurrence-sources.json';
        if (oldAuditPath && existsSync(oldAuditPath) && existsSync(oldProofPath)) {
          const audit = matchingCheckpointAudit(
              recorded,
              checkpoint.geometrySourceHash,
              oldAuditPath,
            ),
            proof = JSON.parse(readFileSync(oldProofPath, 'utf8'));
          const motion = audit?.input.motion;
          if (
            audit &&
            Array.isArray(motion) &&
            motion.length === proof.occurrences.length &&
            motion.every((one) => ['fixed', 'gantry', 'x', 'z'].includes(one)) &&
            JSON.stringify(audit.input.ids) ===
              JSON.stringify(proof.occurrences.map((one: any) => one.id))
          ) {
            proof.occurrences.forEach((one: any, index: number) => {
              one.hashInput[6] = motion[index];
              one.sourceFingerprint = hash(JSON.stringify(one.hashInput));
            });
            proof.auditSourceHash = audit.sourceHash;
            proof.auditSourcePath = prefix + '-audit.py';
            writeFileSync(proof.auditSourcePath, audit.source);
            writeFileSync(oldProofPath, JSON.stringify(proof, null, 2));
            reusableArchive = true;
          }
        }
      }
      copyFileSync(pairPath, prefix + '-pairs.json');
      if (reusableArchive) previousPairPath = prefix + '-pairs.json';
    }
  }
  writeFileSync(resolve(attempts, geometrySourceHash + '-geometry.py'), geometry);
  writeFileSync(
    resolve(attempts, geometrySourceHash + '-occurrence-sources.json'),
    JSON.stringify(
      { schemaVersion: 1, geometrySourceHash, mode, occurrences: occurrenceSources },
      null,
      2,
    ),
  );
  writeFileSync(resolve(directory, `${mode}-geometry.py`), geometry);
  const data = {
    ids: pieces.map((p) => p.component.id),
    motion: pieces.map((p: any) => p.motion),
    definitions: pieces.map((p) => p.component),
    colors: pieces.map((p) => p.color),
    mode,
    configuration: machine.defaults,
    issues: machine.composition!(machine.defaults).issues,
    geometrySourceHash,
    runtimeSignature,
    documentPath: resolve(directory, mode === 'simple' ? 'Simple.FCStd' : 'Full.FCStd'),
    checkpointPath,
    pairPath,
    previousPairPath,
    attemptsPath: attempts,
    occurrenceSources,
    geometryPath: resolve(directory, `${mode}-geometry.py`),
    intersectionsPath: resolve(directory, 'intersections', mode),
    templatesPath: resolve(directory, 'templates', hash(runtimeSignature)),
  };
  const source = `import FreeCAD as App, Part, json, math, time, hashlib, os
began=time.time()
data=json.loads(${JSON.stringify(JSON.stringify(data))})
def file_hash(path):
    with open(path,'rb') as handle: return hashlib.sha256(handle.read()).hexdigest()
def save_json(path,value):
    temporary=path+'.tmp'
    with open(temporary,'w') as handle: json.dump(value,handle,indent=2)
    os.replace(temporary,path)
components=None
if os.path.exists(data['checkpointPath']) and os.path.exists(data['documentPath']):
    previous=json.load(open(data['checkpointPath']))
    if previous.get('status')=='passed' and previous.get('geometrySourceHash')==data['geometrySourceHash'] and previous.get('runtimeSignature')==data['runtimeSignature'] and previous.get('documentFileHash')==file_hash(data['documentPath']):
        doc=App.openDocument(data['documentPath'])
        features=sorted([o for o in doc.Objects if hasattr(o,'OccurrenceId')],key=lambda o:int(o.Name.split('_')[-1]))
        if [o.OccurrenceId for o in features]!=data['ids']: raise ValueError('Cached CAD identity/order differs')
        if json.loads(doc.getObject('CNC_Milling_Machine').ConfigurationJSON)!=data['configuration']: raise ValueError('Cached root configuration differs')
        for feature,definition in zip(features,data['definitions']):
            if feature.LibraryId!=definition['libraryId'] or json.loads(feature.ConfigurationJSON)!=definition['parameters']: raise ValueError('Cached library configuration differs: '+definition['id'])
        components=[o.Shape.copy() for o in features]
        print('CNC_STAGE:reused validated CAD checkpoint',flush=True)
if components is None:
    os.makedirs(data['templatesPath'],exist_ok=True)
    # Audit memoization invokes the exact original constructor on a cache miss.
    # The ordinary generated per-occurrence/topology checks remain unchanged.
    persistence='''
_original_component_builder=_pl_component
def _pl_component(source):
    key=hashlib.sha256(source.encode()).hexdigest()
    base=os.path.join(data['templatesPath'],key)
    if source not in _pl_component_cache:
        if os.path.exists(base+'.json') and os.path.exists(base+'.brep'):
            record=json.load(open(base+'.json'))
            if record.get('sourceHash')==key and record.get('fileHash')==file_hash(base+'.brep'):
                cached=Part.Shape();cached.read(base+'.brep')
                _pl_component_cache[source]=(cached,record['metadata'],record['labels'])
        if source not in _pl_component_cache:
            _original_component_builder(source)
            cached,metadata,labels=_pl_component_cache[source]
            cached.exportBrep(base+'.brep')
            save_json(base+'.json',{'sourceHash':key,'fileHash':file_hash(base+'.brep'),'metadata':metadata,'labels':labels})
        print('CNC_TEMPLATE:'+key,flush=True)
    return _original_component_builder(source)
'''
    geometry=open(data['geometryPath']).read()
    if hashlib.sha256(geometry.encode()).hexdigest()!=data['geometrySourceHash']: raise ValueError('Generated source checksum differs')
    marker='\\ncomponents = []\\ncomponent_metadata = []\\n'
    if geometry.count(marker)!=1: raise ValueError('The audit factory checkpoint marker changed')
    exec(geometry.replace(marker,'\\n'+persistence+marker))
    if len(components)!=len(data['ids']): raise ValueError('Component count differs')
    for index,component in enumerate(components):
        if component.isNull() or not component.isValid() or not component.isClosed() or not math.isfinite(component.Volume) or component.Volume<=0:
            raise ValueError('Invalid installed solid: '+data['ids'][index])
        if index%50==0: print('CNC_STAGE:validated '+str(index),flush=True)
    doc=App.newDocument('CNC_'+data['mode'])
    assembly=doc.addObject('App::Part','CNC_Milling_Machine');assembly.Label=${JSON.stringify(machine.name)}
    assembly.addProperty('App::PropertyString','GeometryMode','ProtoLab');assembly.GeometryMode=data['mode']
    assembly.addProperty('App::PropertyString','ConfigurationJSON','ProtoLab');assembly.ConfigurationJSON=json.dumps(data['configuration'])
    assembly.addProperty('App::PropertyString','GeometrySourceHash','ProtoLab');assembly.GeometrySourceHash=data['geometrySourceHash']
    assembly.addProperty('App::PropertyStringList','DesignReviewRequirements','ProtoLab');assembly.DesignReviewRequirements=data['issues']
    for index,(shape,definition) in enumerate(zip(components,data['definitions'])):
        feature=doc.addObject('Part::Feature','Component_'+str(index+1));feature.Label=definition['id'];feature.Shape=shape
        for key,value in {'OccurrenceId':definition['id'],'LibraryId':definition['libraryId'],'ConfigurationJSON':json.dumps(definition['parameters']),'SupplyPolicy':definition['supply'],'OccurrenceDefinitionJSON':json.dumps(definition),**component_metadata[index]}.items():
            if hasattr(feature,key):key='Manufacturing'+key
            feature.addProperty('App::PropertyString',key,'ProtoLab');setattr(feature,key,str(value))
        assembly.addObject(feature)
        if App.GuiUp:
            color=data['colors'][index];feature.ViewObject.ShapeColor=((color>>16&255)/255,(color>>8&255)/255,(color&255)/255)
    doc.recompute();doc.saveAs(data['documentPath'])
    save_json(data['checkpointPath'],{'status':'passed','geometrySourceHash':data['geometrySourceHash'],'runtimeSignature':data['runtimeSignature'],'documentPath':data['documentPath'],'documentFileHash':file_hash(data['documentPath']),'components':len(components),'occurrenceIds':data['ids'],'configuration':data['configuration'],'freecadVersion':App.Version(),'validation':'Every actual component is nonnull, valid, closed, finite and positive-volume. Pair/travel checks are separate.','elapsedSeconds':time.time()-began})
    print('CNC_STAGE:saved validated CAD checkpoint',flush=True)
checkpoint=json.load(open(data['checkpointPath']))
checkPolicy='absolute-volume-0.001-valid-solid-intersections-v1'
state={'geometrySourceHash':data['geometrySourceHash'],'runtimeSignature':data['runtimeSignature'],'documentFileHash':checkpoint['documentFileHash'],'policy':checkPolicy,'candidatePolicy':'strictly-positive-bounding-box-extents','cases':{},'reusedNativePairs':0}
if os.path.exists(data['pairPath']):
    prior=json.load(open(data['pairPath']))
    if all(prior.get(key)==state[key] for key in ['geometrySourceHash','runtimeSignature','documentFileHash','policy']):state=prior
if data.get('previousPairPath') and os.path.exists(data['previousPairPath']):
    prior=json.load(open(data['previousPairPath']))
    prefix=os.path.join(data['attemptsPath'],prior['geometrySourceHash'])
    old_checkpoint=json.load(open(prefix+'-checkpoint.json'))
    proof=json.load(open(prefix+'-occurrence-sources.json'))
    raw=open(prefix+'-geometry.py').read()
    if prior.get('runtimeSignature')==state['runtimeSignature'] and prior.get('policy')==checkPolicy and prior.get('documentFileHash')==old_checkpoint.get('documentFileHash') and file_hash(old_checkpoint['documentPath'])==prior['documentFileHash'] and hashlib.sha256(raw.encode()).hexdigest()==prior['geometrySourceHash'] and proof.get('geometrySourceHash')==prior['geometrySourceHash'] and proof.get('auditSourceHash') and file_hash(proof['auditSourcePath'])==proof['auditSourceHash']:
        # Each legacy fingerprint is linked to its exact actual constructor string.
        kernels=[json.loads(line[len('component, local_metadata = _pl_component('):-1]) for line in raw.splitlines() if line.startswith('component, local_metadata = _pl_component(')]
        old=proof['occurrences']
        if len(old)!=len(kernels) or [one['id'] for one in old]!=old_checkpoint['occurrenceIds']:raise ValueError('Prior occurrence proof does not match actual CAD source/identities')
        for occurrence,kernel in zip(old,kernels):
            if occurrence['hashInput'][0]!=hashlib.sha256(kernel.encode()).hexdigest():raise ValueError('Prior configured constructor differs')
        old_by_id={one['id']:one for one in old}
        new_by_id={one['id']:(index,one) for index,one in enumerate(data['occurrenceSources'])}
        for key,record in prior['cases'].items():
            a,b=record['a'],record['b']
            if a not in new_by_id or b not in new_by_id:continue
            i,aa=new_by_id[a];j,bb=new_by_id[b]
            if aa['sourceFingerprint']!=old_by_id[a]['sourceFingerprint'] or bb['sourceFingerprint']!=old_by_id[b]['sourceFingerprint']:continue
            pose=key.rsplit(':',2)[0];new_key=pose+':'+str(i)+':'+str(j)
            state['cases'][new_key]=dict(record,sourceFingerprintA=aa['sourceFingerprint'],sourceFingerprintB=bb['sourceFingerprint'],reused=True)
            state['reusedNativePairs']+=1
        print('CNC_STAGE:reused '+str(state['reusedNativePairs'])+' unchanged native pair checks',flush=True)
completed=len(state['cases'])
localizationVersion='actual-installed-long-solid-conservative-box-0.1-v1'
def localized_pair(i,j):
    return data['mode']=='full' and any(data['definitions'][k]['libraryId']=='cnc-drive-screw' for k in [i,j])
def exact_intersection(i,a,j,b):
    if not localized_pair(i,j):return a.common(b),'whole-installed-solids'
    long_shape,partner=(a,b) if data['definitions'][i]['libraryId']=='cnc-drive-screw' else(b,a)
    box=partner.BoundBox;margin=0.1
    # The entire partner is contained in this conservative box. Removing source
    # geometry outside it cannot change the pair's physical intersection set.
    envelope=Part.makeBox(box.XLength+2*margin,box.YLength+2*margin,box.ZLength+2*margin,App.Vector(box.XMin-margin,box.YMin-margin,box.ZMin-margin))
    clipped=long_shape.common(envelope)
    if not math.isfinite(clipped.Volume):raise ValueError('Nonfinite exact source clipping')
    if clipped.Volume==0 and (clipped.isNull() or not clipped.Solids):return clipped,'exact-installed-source-localization'
    if not clipped.isValid() or not clipped.isClosed() or clipped.Volume<=0:raise ValueError('Invalid exact source clipping: '+data['ids'][i]+' / '+data['ids'][j])
    return clipped.common(partner),'exact-installed-source-localization'
def collisions(shapes,pose,cross_only=False):
    global completed
    boxes=[c.BoundBox for c in shapes];found=[]
    for i,a in enumerate(shapes):
        for j in range(i+1,len(shapes)):
            if cross_only and data['motion'][i]==data['motion'][j]:continue
            aa,bb=boxes[i],boxes[j]
            if min(aa.XMax,bb.XMax)-max(aa.XMin,bb.XMin)<=0 or min(aa.YMax,bb.YMax)-max(aa.YMin,bb.YMin)<=0 or min(aa.ZMax,bb.ZMax)-max(aa.ZMin,bb.ZMin)<=0:continue
            key=pose+':'+str(i)+':'+str(j)
            previous_whole=None
            if key in state['cases'] and localized_pair(i,j) and state['cases'][key].get('intersectionMethodVersion')!=localizationVersion:previous_whole=state['cases'].pop(key)['overlapMm3']
            if key not in state['cases']:
                print('CNC_PAIR:'+key+' '+data['ids'][i]+' / '+data['ids'][j],flush=True)
                pair_began=time.time()
                intersection,method=exact_intersection(i,a,j,shapes[j]);volume=intersection.Volume
                if not math.isfinite(volume):raise ValueError('Nonfinite intersection: '+key)
                if intersection.Solids and (not intersection.isValid() or not intersection.isClosed()):raise ValueError('Invalid nonempty solid intersection: '+key)
                record={'a':data['ids'][i],'b':data['ids'][j],'overlapMm3':volume,'sourceFingerprintA':data['occurrenceSources'][i]['sourceFingerprint'],'sourceFingerprintB':data['occurrenceSources'][j]['sourceFingerprint'],'intersectionMethod':method,'elapsedSeconds':time.time()-pair_began}
                if method=='exact-installed-source-localization':record['intersectionMethodVersion']=localizationVersion
                if previous_whole is not None:record['previousWholeBooleanVolume']=previous_whole
                if abs(volume)>0.001:
                    os.makedirs(data['intersectionsPath'],exist_ok=True)
                    path=os.path.join(data['intersectionsPath'],hashlib.sha256(key.encode()).hexdigest()+'.brep')
                    intersection.exportBrep(path);record['intersectionPath']=path;record['intersectionFileHash']=file_hash(path)
                state['cases'][key]=record
                completed+=1;save_json(data['pairPath'],state)
            result=state['cases'][key]
            if not math.isfinite(result['overlapMm3']):raise ValueError('Nonfinite cached intersection: '+key)
            if abs(result['overlapMm3'])>0.001:found.append(result)
    return found
installed=collisions(components,'installed')
print('CNC_STAGE:installed '+str(len(installed)),flush=True)
travel=[]
for dx in [-400,400]:
    for dy in [-750,750]:
        for dz in [-100,100]:
            posed=[]
            for shape,motion in zip(components,data['motion']):
                one=shape.copy();one.translate(App.Vector(dx if motion in ['x','z'] else0,dy if motion!='fixed' else0,dz if motion=='z' else0));posed.append(one)
            found=collisions(posed,str((dx,dy,dz)),True)
            travel.append({'axes':[dx,dy,dz],'collisions':found})
            print('CNC_STAGE:travel '+json.dumps(travel[-1]),flush=True)
result={'status':'passed' if not installed and all(not t['collisions'] for t in travel) else'failed','components':len(components),'installedCollisions':installed,'travel':travel,'checkedNativePairs':len(state['cases']),'reusedNativePairs':state.get('reusedNativePairs',0),'fullDriveIntersectionMethodVersion':localizationVersion if data['mode']=='full' else None,'freecadVersion':App.Version(),'elapsedSeconds':time.time()-began,'documentPath':data['documentPath'],'documentFileHash':checkpoint['documentFileHash'],'geometrySourceHash':data['geometrySourceHash']}
print('CNC_RESULT:'+json.dumps(result),flush=True)
`
    .replaceAll('else0', 'else 0')
    .replace("else'failed'", "else 'failed'");
  const sourceHash = hash(source);
  const prior =
    previous?.runtimeSignature === runtimeSignature &&
    previous.results.find(
      (r: any) =>
        r.mode === mode &&
        r.sourceHash === sourceHash &&
        r.status === 'passed' &&
        (() => {
          const evidence = currentAssemblyEvidence(r);
          return evidence && hasCurrentNativeEvidence(r, evidence);
        })(),
    );
  let result: any;
  if (prior) result = { ...prior, reused: true };
  else {
    const sourcePath = resolve(directory, `${mode}-assembly-localized.py`);
    writeFileSync(sourcePath, source);
    const ran = await new Promise<any>((done) => {
      const child = spawn(nativePython, [sourcePath], {
        env: { ...process.env, PYTHONPATH: pythonLib },
      });
      let stdout = '',
        stderr = '',
        timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);
      child.stdout.on('data', (chunk) => {
        const text = String(chunk);
        stdout += text;
        process.stdout.write(text);
      });
      child.stderr.on('data', (chunk) => (stderr += String(chunk)));
      child.on('error', (error) => {
        clearTimeout(timer);
        done({ status: 'failed', error: String(error) });
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const line = stdout.split('\n').find((l) => l.startsWith('CNC_RESULT:'));
        done(
          code === 0 && line
            ? JSON.parse(line.slice(11))
            : {
                status: timedOut ? 'timeout' : 'failed',
                code,
                signal,
                error: stderr + '\n' + stdout.slice(-10000),
              },
        );
      });
    });
    result = {
      mode,
      sourceHash,
      sourcePath,
      geometrySourceHash,
      checkedAt: new Date().toISOString(),
      ...ran,
    };
  }
  results.push(result);
  selectedResults.push(result);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        scope:
          'Native Simple/Full component validity, every installed pair, eight travel corners. Absolute overlap volume 0.001 mm3; nonfinite or invalid solid intersections rejected. Long Full drive intersections use the actual installed solid clipped only outside the partner conservative bounds plus 0.1 mm. Exact source/checksum CAD checkpoint and granular native case resumption.',
        nativePython,
        pythonLib,
        runtimeSignature,
        selectedModes,
        completedSelectedModes: selectedResults.length,
        retainedModes,
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('CNC_AUDIT', mode, result.status, sourceHash);
}
if (
  selectedResults.length !== selectedModes.length ||
  selectedResults.some((r) => r.status !== 'passed')
)
  process.exitCode = 1;
