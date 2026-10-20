/** Check real stock against every installed non-cutting component, using native FreeCAD solids. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import machine, { millingComponents, millingLayout } from '../src/parts/cnc-milling-machine/part';
import { withGeometryMode, type GeometryMode } from '../src/core/geometry-mode';
import { workspaceBroadphasePython, workspaceDefinition } from './cnc-workspace-broadphase';
import {
  hasCurrentNativeEvidence,
  preserveUnselectedNativeResults,
  type CurrentNativeEvidence,
} from './cnc-native-report';

const output = resolve(
  process.env.CNC_WORKSPACE_REPORT ?? 'test-results/cnc-milling/workspace-native.json',
);
const nativePython =
  process.env.FREECAD_PYTHON ?? '/Applications/FreeCAD.app/Contents/Resources/bin/python';
const pythonLib = process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib';
const runtimeSignature = JSON.stringify(
  [nativePython, pythonLib, resolve(pythonLib, 'FreeCAD.so')].map((path) => ({
    path,
    ...(existsSync(path) ? { modified: statSync(path).mtimeMs, size: statSync(path).size } : {}),
  })),
);
mkdirSync(resolve(output, '..'), { recursive: true });
const previous = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : undefined;
const options = machine.parameters.find((d) => d.key === 'spindle')!.options!;
const requestedSpindle = process.env.CNC_WORKSPACE_SPINDLE;
const requestedMode = process.env.CNC_WORKSPACE_MODE;
if (requestedSpindle && !options.some((o) => o.value === requestedSpindle))
  throw new Error('Unknown workspace audit spindle: ' + requestedSpindle);
if (requestedMode && !['simple', 'full'].includes(requestedMode))
  throw new Error('Unknown workspace audit geometry mode: ' + requestedMode);
const supportedCases = options.flatMap((option) =>
  (option.value === machine.defaults.spindle ? ['simple', 'full'] : ['simple']).map((mode) => ({
    spindle: option.value,
    mode,
  })),
);
const planned = supportedCases.filter(
  (c) =>
    (!requestedSpindle || c.spindle === requestedSpindle) &&
    (!requestedMode || c.mode === requestedMode),
);
if (!planned.length)
  throw new Error(
    'No workspace audit cases selected. Full is checked for the default spindle; choose Simple or remove the spindle selector.',
  );
function workspaceInput(
  layout: ReturnType<typeof millingLayout>,
  pieces: ReturnType<typeof millingComponents>,
) {
  return {
    ids: pieces.map((p) => p.component.id),
    motion: pieces.map((p) => p.motion),
    definitions: pieces.map((p) => workspaceDefinition(p.component)),
    work: [layout.workX, layout.workY, layout.workZ],
    tableTop: layout.tableTop,
    spindleY: layout.spindleY,
    toolProjection: layout.toolProjection,
    noseLow: layout.noseLow,
    stockHeights: [5, 50, 100, 200],
    positions: [-1, 0, 1],
  };
}
const caseKey = (record: { spindle: string; mode: string }) => `${record.spindle}:${record.mode}`;
function currentWorkspaceEvidence(record: any): CurrentNativeEvidence | undefined {
  if (!supportedCases.some((one) => caseKey(one) === caseKey(record))) return undefined;
  try {
    const parameters = {
      ...machine.defaults,
      spindle: record.spindle,
      xPosition: 50,
      yPosition: 50,
      zPosition: 50,
    };
    const pieces = millingComponents(parameters),
      layout = millingLayout(parameters);
    const geometrySource = withGeometryMode(record.mode, () =>
      machine.python(parameters, 'assembled'),
    );
    const geometrySourceHash = createHash('sha256').update(geometrySource).digest('hex');
    let cad: CurrentNativeEvidence['cad'];
    if (record.auditedCad) {
      const proof = JSON.parse(readFileSync(record.auditedCad.checkpointPath, 'utf8'));
      const expectedRuntime = JSON.stringify(
        [nativePython, resolve(pythonLib, 'FreeCAD.so')].map((path) => ({
          path,
          ...(existsSync(path)
            ? { size: statSync(path).size, modified: statSync(path).mtimeMs }
            : {}),
        })),
      );
      if (
        proof.status !== 'passed' ||
        proof.runtimeSignature !== expectedRuntime ||
        proof.geometrySourceHash !== geometrySourceHash ||
        record.auditedCad.geometrySourceHash !== geometrySourceHash ||
        proof.documentPath !== record.auditedCad.path ||
        proof.documentFileHash !== record.auditedCad.fileHash ||
        JSON.stringify(proof.configuration) !== JSON.stringify(parameters) ||
        JSON.stringify(proof.occurrenceIds) !== JSON.stringify(pieces.map((p) => p.component.id)) ||
        proof.components !== pieces.length
      )
        return undefined;
      cad = { path: record.auditedCad.path, fileHash: record.auditedCad.fileHash };
    }
    return {
      geometrySourceHash,
      sourcePath: resolve(output, '..', `workspace-${record.spindle}-${record.mode}.py`),
      input: workspaceInput(layout, pieces),
      ...(cad ? { cad } : { geometrySource }),
    };
  } catch {
    return undefined;
  }
}
const results: any[] = preserveUnselectedNativeResults<any>(
  previous,
  runtimeSignature,
  new Set(planned.map(caseKey)),
  caseKey,
  currentWorkspaceEvidence,
);
const retainedCases = results.map((record) => ({ spindle: record.spindle, mode: record.mode }));
const selectedResults: any[] = [];
for (const option of options) {
  if (process.env.CNC_WORKSPACE_SPINDLE && option.value !== process.env.CNC_WORKSPACE_SPINDLE)
    continue;
  // Full has the same outside installation envelope; additionally prove the default physical thread model.
  const modes: GeometryMode[] =
    option.value === machine.defaults.spindle ? ['simple', 'full'] : ['simple'];
  for (const mode of modes) {
    if (process.env.CNC_WORKSPACE_MODE && mode !== process.env.CNC_WORKSPACE_MODE) continue;
    const parameters = {
      ...machine.defaults,
      spindle: option.value,
      xPosition: 50,
      yPosition: 50,
      zPosition: 50,
    };
    const layout = millingLayout(parameters),
      pieces = millingComponents(parameters);
    const geometrySource = withGeometryMode(mode, () => machine.python(parameters, 'assembled'));
    // The checkpoint proves exact configured solids; the assembly pair matrix is a separate audit.
    let auditedCad:
      | { path: string; fileHash: string; geometrySourceHash: string; checkpointPath: string }
      | undefined;
    if (
      process.env.CNC_WORKSPACE_USE_ASSEMBLY_CAD === '1' &&
      option.value === machine.defaults.spindle
    ) {
      const checkpointPath = resolve(output, '..', `${mode}-checkpoint.json`);
      const proof = JSON.parse(readFileSync(checkpointPath, 'utf8'));
      const expectedRuntime = JSON.stringify(
        [nativePython, resolve(pythonLib, 'FreeCAD.so')].map((path) => ({
          path,
          ...(existsSync(path)
            ? { size: statSync(path).size, modified: statSync(path).mtimeMs }
            : {}),
        })),
      );
      const geometrySourceHash = createHash('sha256').update(geometrySource).digest('hex');
      const savedGeometry = readFileSync(resolve(output, '..', `${mode}-geometry.py`), 'utf8');
      if (
        proof.status !== 'passed' ||
        proof.runtimeSignature !== expectedRuntime ||
        proof.geometrySourceHash !== geometrySourceHash ||
        savedGeometry !== geometrySource ||
        JSON.stringify(proof.configuration) !== JSON.stringify(parameters) ||
        JSON.stringify(proof.occurrenceIds) !== JSON.stringify(pieces.map((p) => p.component.id)) ||
        proof.components !== pieces.length
      )
        throw new Error('A matching passed component checkpoint is required before reusing CAD.');
      const fileHash = createHash('sha256').update(readFileSync(proof.documentPath)).digest('hex');
      if (fileHash !== proof.documentFileHash)
        throw new Error('Saved CAD checksum differs from the component checkpoint.');
      auditedCad = { path: proof.documentPath, fileHash, geometrySourceHash, checkpointPath };
    }
    const input = workspaceInput(layout, pieces);
    const loadGeometry = auditedCad
      ? `import hashlib
if hashlib.sha256(open(${JSON.stringify(auditedCad.path)},'rb').read()).hexdigest() != ${JSON.stringify(auditedCad.fileHash)}:
    raise ValueError('Audited CAD file changed before verification')
doc = App.openDocument(${JSON.stringify(auditedCad.path)})
root = doc.getObject('CNC_Milling_Machine')
if root.GeometryMode != ${JSON.stringify(mode)} or root.GeometrySourceHash != ${JSON.stringify(auditedCad.geometrySourceHash)} or json.loads(root.ConfigurationJSON) != json.loads(${JSON.stringify(JSON.stringify(parameters))}):
    raise ValueError('Audited CAD configuration does not match the stock setup')
features = sorted([f for f in root.Group if hasattr(f,'OccurrenceId')],key=lambda f:int(f.Name.split('_')[-1]))
loaded_ids = [f.OccurrenceId for f in features]
components = [f.Shape for f in features]
`
      : geometrySource;
    const source = `import FreeCAD as App, Part, json, math
${loadGeometry}
data = json.loads(${JSON.stringify(JSON.stringify(input))})
if len(components) != len(data['ids']):
    raise ValueError('Installed solids do not match the component list')
${
  auditedCad
    ? `if loaded_ids != data['ids']: raise ValueError('Audited CAD occurrence order differs from the configured assembly')
for feature, definition in zip(features,data['definitions']):
    if feature.LibraryId != definition['libraryId'] or json.loads(feature.ConfigurationJSON) != definition['parameters']:
        raise ValueError('Audited CAD library configuration differs: '+definition['id'])`
    : `invalid = [data['ids'][i] for i,c in enumerate(components) if c.isNull() or not c.isValid() or not c.isClosed() or not math.isfinite(c.Volume) or c.Volume <= 0]
if invalid: raise ValueError('Invalid installed solids: '+repr(invalid))`
}
spindle_base = components[data['ids'].index('cutting-spindle')].optimalBoundingBox(False,False).ZMin
if abs(spindle_base-(data['noseLow']+data['work'][2]/2)) > 0.000001:
    raise ValueError('Native spindle nose differs from the assembly setup datum')
${workspaceBroadphasePython}
component_bounds = [_workspace_bounds(component) for component in components]
results = []
for height in data['stockHeights']:
    stock = Part.makeBox(data['work'][0], data['work'][1], height, App.Vector(-data['work'][0]/2, data['spindleY']-data['work'][1]/2, data['tableTop']))
    stock_bounds = _workspace_bounds(stock)
    for x in data['positions']:
        for y in data['positions']:
            dx,dy,dz = x*data['work'][0]/2, y*data['work'][1]/2, height-data['work'][2]/2
            collisions = []
            for component, bounds, identity, motion in zip(components, component_bounds, data['ids'], data['motion']):
                translation = _workspace_translation(motion,dx,dy,dz)
                if not _workspace_bounds_overlap(stock_bounds,_workspace_translated_bounds(bounds,translation)):
                    continue
                posed = component.copy()
                posed.translate(App.Vector(*translation))
                intersection = posed.common(stock)
                volume = intersection.Volume
                if not math.isfinite(volume) or (intersection.Solids and (not intersection.isValid() or not intersection.isClosed())):
                    raise ValueError('Invalid native stock intersection: '+identity)
                if abs(volume) > 0.001: collisions.append({'component':identity, 'overlapMm3':abs(volume)})
            tip = spindle_base + dz - data['toolProjection']
            if abs(tip-(data['tableTop']+height)) > 0.000001:
                raise ValueError('The reference cutter cannot reach the stock top')
            results.append({'stockHeight':height,'axisX':dx,'axisY':dy,'tipZ':tip,'collisions':collisions})
result = {'status':'passed' if all(not r['collisions'] for r in results) else 'failed', 'components':len(components), 'poses':results}
print('CNC_WORKSPACE:'+json.dumps(result),flush=True)
`;
    const sourceHash = createHash('sha256').update(source).digest('hex');
    const prior =
      previous?.runtimeSignature === runtimeSignature
        ? previous.results.findLast(
            (r: any) =>
              r.spindle === option.value &&
              r.mode === mode &&
              r.sourceHash === sourceHash &&
              r.status === 'passed' &&
              (() => {
                const evidence = currentWorkspaceEvidence(r);
                return evidence && hasCurrentNativeEvidence(r, evidence);
              })(),
          )
        : undefined;
    let result: any;
    if (prior) result = { ...prior, reused: true };
    else {
      const began = Date.now();
      const sourcePath = resolve(output, '..', `workspace-${option.value}-${mode}.py`);
      writeFileSync(sourcePath, source);
      const native = await new Promise<any>((done) => {
        const child = spawn(nativePython, [sourcePath], {
          env: { ...process.env, PYTHONPATH: pythonLib },
        });
        let stdout = '',
          stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), mode === 'full' ? 1800000 : 600000);
        child.stdout.on('data', (value) => (stdout += value));
        child.stderr.on('data', (value) => (stderr += value));
        child.on('error', (error) => {
          clearTimeout(timer);
          done({ status: 'failed', error: String(error) });
        });
        child.on('close', (code, signal) => {
          clearTimeout(timer);
          const line = stdout.split('\n').find((line) => line.startsWith('CNC_WORKSPACE:'));
          done(
            code === 0 && line
              ? JSON.parse(line.slice(14))
              : { status: 'failed', code, signal, error: stderr + '\n' + stdout },
          );
        });
      });
      result = {
        spindle: option.value,
        mode,
        sourceHash,
        sourcePath,
        geometrySourceHash: createHash('sha256').update(geometrySource).digest('hex'),
        ...(auditedCad ? { auditedCad } : {}),
        checkedAt: new Date().toISOString(),
        elapsedMs: Date.now() - began,
        ...native,
      };
    }
    results.push(result);
    selectedResults.push(result);
    writeFileSync(
      output,
      JSON.stringify(
        {
          scope:
            'Full 800x1500 stock slab, heights 5/50/100/200 mm, nine XY positions at its cutting height. Every installed non-cutting solid is checked at the selected tool projection. Clamps and arbitrary tool holders are not part of this stock envelope.',
          runtimeSignature,
          planned,
          completed: selectedResults.length,
          retainedCases,
          results,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      option.value,
      mode,
      result.status,
      result.error ?? '',
      result.poses?.filter((r: any) => r.collisions.length),
    );
  }
}
if (selectedResults.length !== planned.length || selectedResults.some((r) => r.status !== 'passed'))
  process.exitCode = 1;
