import { createHash } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createPartLoader, type PartModuleImport } from '../../src/core/lazy-parts';
import { PART_ID_PATTERN } from '../../src/core/part-modules';
import { generateScript } from '../../src/core/freecad';
import { withGeometryMode } from '../../src/core/geometry-mode';
import { caseParameters, type AuditCase, type AuditResult } from './cases';

interface Request {
  item: AuditCase;
  previous?: AuditResult;
  nativePython: string;
  syntaxPython: string;
  pythonLib?: string;
}
const pythonWorker = fileURLToPath(new URL('./native-worker.py', import.meta.url));
const packages = new URL('../../src/parts/', import.meta.url);
const imports: Record<string, PartModuleImport> = Object.fromEntries(
  readdirSync(packages, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        PART_ID_PATTERN.test(entry.name) &&
        existsSync(new URL(`${entry.name}/index.ts`, packages)),
    )
    .map((entry) => [entry.name, () => import(new URL(`${entry.name}/index.ts`, packages).href)]),
);
const loadParts = createPartLoader(imports);
let syntaxProcess: ChildProcessWithoutNullStreams | undefined;
let syntaxReply: ((value: Partial<AuditResult>) => void) | undefined;
function syntax(source: string, request: Request): Promise<Partial<AuditResult>> {
  if (!syntaxProcess) {
    syntaxProcess = spawn(request.syntaxPython, [pythonWorker, '--syntax-stream']);
    const lines = createInterface({ input: syntaxProcess.stdout });
    lines.on('line', (line) => {
      const reply = syntaxReply;
      syntaxReply = undefined;
      reply?.(JSON.parse(line));
    });
    syntaxProcess.once('error', (error) => {
      syntaxReply?.({ status: 'failed', stage: 'syntax', error: String(error) });
      syntaxProcess = undefined;
    });
    syntaxProcess.once('exit', (code) => {
      syntaxReply?.({ status: 'failed', stage: 'syntax', error: 'Syntax worker exited: ' + code });
      syntaxReply = undefined;
      syntaxProcess = undefined;
    });
  }
  return new Promise((resolve) => {
    syntaxReply = resolve;
    syntaxProcess!.stdin.write(JSON.stringify({ ...request.item, source }) + '\n');
  });
}
function native(source: string, parameters: ReturnType<typeof caseParameters>, request: Request) {
  return new Promise<Partial<AuditResult>>((resolve) => {
    const child = spawn(request.nativePython, [pythonWorker], {
      env: {
        ...process.env,
        ...(request.pythonLib ? { PYTHONPATH: request.pythonLib } : {}),
      },
    });
    process.send?.({ kind: 'native-started', pid: child.pid });
    let output = '',
      errors = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-32_000);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      errors = (errors + chunk.toString()).slice(-16_000);
    });
    child.once('error', (error) =>
      resolve({ status: 'failed', stage: 'native', error: String(error) }),
    );
    child.once('close', (code, signal) => {
      const line = output.split('\n').find((value) => value.startsWith('PROTOLAB_AUDIT:'));
      if (line && code === 0) {
        try {
          resolve(JSON.parse(line.slice('PROTOLAB_AUDIT:'.length)));
          return;
        } catch (error) {
          errors += '\nMalformed native result: ' + String(error);
        }
      }
      resolve({
        status: 'failed',
        stage: 'native',
        error: `FreeCAD exited with code ${code}, signal ${signal}.\n${errors}\n${output}`,
      });
    });
    child.stdin.end(JSON.stringify({ ...request.item, source, parameters }));
  });
}

process.on('message', async (request: Request) => {
  const started = performance.now(),
    item = request.item;
  const base = {
    key: item.key,
    partId: item.partId,
    phase: item.phase,
    mode: item.mode,
    state: item.state,
    variant: item.variant,
    ...(item.presetId ? { presetId: item.presetId } : {}),
    ...(item.patch ? { patch: item.patch } : {}),
    checkedAt: new Date().toISOString(),
  };
  let parameters: ReturnType<typeof caseParameters> | undefined;
  try {
    const part = (await loadParts([item.partId])).find((candidate) => candidate.id === item.partId);
    if (!part) throw new Error('Missing part: ' + item.partId);
    parameters = caseParameters(part, item);
    const source = withGeometryMode(item.mode, () =>
      generateScript(part, parameters!, item.state, item.presetId, undefined, item.mode),
    );
    const generationMs = performance.now() - started,
      sourceHash = createHash('sha256').update(source).digest('hex');
    if (request.previous?.status === 'passed' && request.previous.sourceHash === sourceHash) {
      process.send?.({ kind: 'result', result: { ...request.previous, reused: true } });
      return;
    }
    process.send?.({ kind: 'generated', sourceHash, generationMs });
    const validated =
      item.phase === 'syntax'
        ? await syntax(source, request)
        : await native(source, parameters, request);
    process.send?.({
      kind: 'result',
      result: {
        ...base,
        ...validated,
        sourceHash,
        generationMs,
        elapsedMs: performance.now() - started,
        nativeMs: performance.now() - started - generationMs,
        ...(validated.status === 'failed' ? { parameters } : {}),
      },
    });
  } catch (error) {
    process.send?.({
      kind: 'result',
      result: {
        ...base,
        status: 'failed',
        stage: 'generation',
        elapsedMs: performance.now() - started,
        error: error instanceof Error ? error.stack : String(error),
        parameters,
      },
    });
  }
});
process.on('disconnect', () => {
  syntaxProcess?.kill('SIGKILL');
  process.exit();
});
process.send?.({ kind: 'ready' });
