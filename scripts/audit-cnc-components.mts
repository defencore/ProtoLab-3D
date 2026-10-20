/** Execute every selected component preset as a complete FreeCAD macro in both modes. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode, type GeometryMode } from '../src/core/geometry-mode';
import type { PartDefinition } from '../src/core/types';
import table from '../src/parts/cnc-worktable/part';
import cooling from '../src/parts/cnc-process-accessory/part';
import probe from '../src/parts/cnc-toolsetter-part/part';
import control from '../src/parts/machine-control/part';
const output = resolve(
  process.env.CNC_AUDIT_REPORT ?? 'test-results/cnc-milling/component-native.json',
);
const nativePython =
  process.env.FREECAD_PYTHON ?? '/Applications/FreeCAD.app/Contents/Resources/bin/python';
const pythonLib = process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib';
const runtimeSignature = JSON.stringify(
  [
    nativePython,
    pythonLib,
    resolve(pythonLib, 'FreeCAD.so'),
    resolve(pythonLib, 'libFreeCADApp.dylib'),
  ].map((path) => ({
    path,
    ...(existsSync(path) ? { modified: statSync(path).mtimeMs, size: statSync(path).size } : {}),
  })),
);
mkdirSync(resolve(output, '..'), { recursive: true });
const oldReport = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : undefined;
const previous = oldReport?.runtimeSignature === runtimeSignature ? oldReport.results : [];
const families: PartDefinition[] = [table, cooling, probe, control];
const cases = families.flatMap((part) =>
  part.presets
    .filter(
      (p) =>
        part !== control ||
        ['ddcs-v3-1', 'lrs35036', 'lrs35048', 'gpenny-huanyang-4kw-220v'].includes(p.id),
    )
    .flatMap((preset) =>
      (['simple', 'full'] as GeometryMode[]).map((mode) => ({ part, preset, mode })),
    ),
);
const results: any[] = [];
for (const { part, preset, mode } of cases) {
  const source = withGeometryMode(mode, () =>
    generateScript(part, preset.parameters, 'default', preset.id, undefined, mode),
  );
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const prior = previous.findLast(
    (p) =>
      p.partId === part.id &&
      p.preset === preset.id &&
      p.mode === mode &&
      p.status === 'passed' &&
      p.sourceHash === sourceHash,
  );
  let result: any;
  if (prior) result = { ...prior, reused: true };
  else {
    const began = Date.now();
    const native = await new Promise<any>((resolveResult) => {
      const child = spawn(
        nativePython,
        [resolve('scripts/library-script-audit/native-worker.py')],
        {
          env: {
            ...process.env,
            PYTHONPATH: pythonLib,
          },
        },
      );
      let stdout = '',
        stderr = '';
      const timeout = setTimeout(() => child.kill('SIGKILL'), 600000);
      child.stdout.on('data', (data) => (stdout += data));
      child.stderr.on('data', (data) => (stderr += data));
      child.on('error', (error) => {
        clearTimeout(timeout);
        resolveResult({ status: 'failed', error: String(error) });
      });
      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        const line = stdout.split('\n').find((l) => l.startsWith('PROTOLAB_AUDIT:'));
        resolveResult(
          code === 0 && line
            ? JSON.parse(line.slice(15))
            : { status: 'failed', code, signal, error: stderr + '\n' + stdout },
        );
      });
      child.stdin.end(
        JSON.stringify({
          key: part.id + '-' + preset.id + '-' + mode,
          phase: 'native',
          partId: part.id,
          parameters: preset.parameters,
          state: 'default',
          presetId: preset.id,
          mode,
          source,
        }),
      );
    });
    result = {
      partId: part.id,
      preset: preset.id,
      mode,
      sourceHash,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - began,
      ...native,
    };
  }
  results.push(result);
  writeFileSync(
    output,
    JSON.stringify(
      {
        scope:
          'Every preset of the selected CNC workholding/cooling/probe and added controller executions, both Simple and Full; native topology, not mechanical qualification.',
        planned: cases.length,
        runtimeSignature,
        completed: results.length,
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    part.id,
    preset.id,
    mode,
    result.status,
    prior ? 'matching hash reused' : 'executed',
    result.error ?? '',
  );
}
console.log(
  'Completed',
  results.length,
  'cases; failures',
  results.filter((r) => r.status !== 'passed').length,
);
if (results.some((r) => r.status !== 'passed')) process.exitCode = 1;
