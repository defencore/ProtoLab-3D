/** Resumable real macro audit. Native execution covers all defaults/states plus finite valid extrema;
 * catalog presets are compiled in both modes. Passed results are reused only for identical macros.
 */
import { fork, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parts } from '../src/parts';
import type { GeometryMode } from '../src/core/geometry-mode';
import {
  planCases,
  type AuditCase,
  type AuditPhase,
  type AuditResult,
} from './library-script-audit/cases';

const args = process.argv.slice(2);
function option(name: string, fallback: string) {
  const index = args.indexOf('--' + name);
  return index < 0 ? fallback : args[index + 1];
}
const phase = option('phase', 'all'),
  phases: AuditPhase[] = phase === 'all' ? ['syntax', 'native'] : [phase as AuditPhase],
  modes = option('modes', 'simple,full').split(',') as GeometryMode[],
  jobs = Number(option('jobs', '2')),
  workerCaseLimit = Number(option('worker-cases', '100')),
  extrema = Number(option('extrema', '2')),
  states = option('states', 'all') as 'all' | 'first',
  timeoutMs = Number(option('timeout-ms', '180000')),
  fullTimeoutMs = Number(option('full-timeout-ms', '600000')),
  reportPath = resolve(option('report', '/tmp/protolab-library-scripts.json')),
  ids = option('parts', '').split(',').filter(Boolean),
  selections = parts.filter((part) => !ids.length || ids.includes(part.id)),
  nativePython = option(
    'native-python',
    process.env.FREECAD_PYTHON ?? '/Applications/FreeCAD.app/Contents/Resources/bin/python',
  ),
  syntaxPython = option('syntax-python', 'python3'),
  pythonLib = option(
    'python-lib',
    process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib',
  );
if (
  !phases.every((value) => value === 'native' || value === 'syntax') ||
  !modes.length ||
  !modes.every((value) => value === 'simple' || value === 'full') ||
  new Set(modes).size !== modes.length ||
  !Number.isInteger(jobs) ||
  jobs < 1 ||
  jobs > 8 ||
  !Number.isInteger(workerCaseLimit) ||
  workerCaseLimit < 1 ||
  !Number.isInteger(extrema) ||
  extrema < 0 ||
  !['all', 'first'].includes(states) ||
  !Number.isFinite(timeoutMs) ||
  timeoutMs <= 0 ||
  !Number.isFinite(fullTimeoutMs) ||
  fullTimeoutMs <= 0 ||
  ids.some((id) => !parts.some((part) => part.id === id))
)
  throw new Error(
    'Invalid audit options. Use phase all/syntax/native, distinct modes simple/full, jobs 1–8 and valid part IDs.',
  );
const cases = planCases(selections, {
  phases,
  modes,
  presets: !args.includes('--no-presets'),
  states,
  extrema,
});
const previous =
  args.includes('--resume') && existsSync(reportPath)
    ? (JSON.parse(readFileSync(reportPath, 'utf8')) as {
        scope: { runtimeSignature?: string };
        results: Record<string, AuditResult>;
        resumeCache?: Record<string, AuditResult>;
      })
    : undefined;
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
const previousResults: Record<string, AuditResult> = Object.fromEntries(
  Object.entries({ ...previous?.resumeCache, ...previous?.results }).filter(
    ([, result]) =>
      result.phase === 'syntax' || previous?.scope.runtimeSignature === runtimeSignature,
  ),
);
const plannedKeys = new Set(cases.map((item) => item.key));
const results: Record<string, AuditResult> = {};
const activeCases = new Map<
  string,
  { startedAt: string; stage: 'generation' | 'syntax' | 'native'; sourceHash?: string }
>();
let cursor = 0,
  completed = 0;
const workerPath = fileURLToPath(new URL('./library-script-audit/worker.ts', import.meta.url));
const activeWorkers = new Set<ChildProcess>();
const nativeChildren = new Set<number>();
function spawnWorker() {
  const child = fork(workerPath, [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  activeWorkers.add(child);
  child.once('exit', () => activeWorkers.delete(child));
  return child;
}
function stopWorkers() {
  for (const pid of nativeChildren) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
  for (const worker of activeWorkers) {
    worker.removeAllListeners();
    worker.kill('SIGKILL');
  }
}
function save() {
  const values = Object.values(results);
  const report = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    scope: {
      families: selections.map((part) => part.id),
      phases,
      modes,
      states,
      catalogSyntax: phases.includes('syntax') && !args.includes('--no-presets'),
      validNativeExtremaPerFamily: extrema,
      plannedCases: cases.length,
      jobs,
      workerCaseLimit,
      timeoutsMs: { simple: timeoutMs, full: fullTimeoutMs },
      nativePython,
      pythonLib,
      runtimeSignature,
      statement:
        'Native defaults and authored states plus the listed valid extrema are executed. All catalog preset macros in the first authored state are syntax checked when enabled. This is topology/export verification, not supplier metrology or certification of every parameter combination.',
    },
    completed: values.length,
    active: Object.fromEntries(
      [...activeCases].map(([key, value]) => [
        key,
        { ...value, elapsedMs: Date.now() - Date.parse(value.startedAt) },
      ]),
    ),
    counts: {
      passed: values.filter((value) => value.status === 'passed').length,
      failed: values.filter((value) => value.status === 'failed').length,
      timeout: values.filter((value) => value.status === 'timeout').length,
      reused: values.filter((value) => value.reused).length,
    },
    results,
    // Retain unvisited prior results across interruptions without counting them as
    // current-source passes until their macro hashes have been checked again.
    resumeCache: Object.fromEntries(
      Object.entries(previousResults).filter(([key]) => plannedKeys.has(key) && !results[key]),
    ),
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  const temporary = reportPath + '.tmp';
  writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n');
  renameSync(temporary, reportPath);
}
function runWorker(): Promise<void> {
  return new Promise((resolveWorker, rejectWorker) => {
    let worker = spawnWorker();
    let item: AuditCase | undefined,
      nativePid: number | undefined,
      sourceHash: string | undefined,
      generationMs: number | undefined,
      started = 0,
      timer: NodeJS.Timeout | undefined,
      errors = '';
    let completedByWorker = 0;
    const start = () => {
      if (cursor >= cases.length) {
        worker.disconnect();
        resolveWorker();
        return;
      }
      item = cases[cursor++];
      started = Date.now();
      activeCases.set(item.key, {
        startedAt: new Date(started).toISOString(),
        stage: 'generation',
      });
      nativePid = undefined;
      sourceHash = undefined;
      generationMs = undefined;
      errors = '';
      const limit = item.mode === 'full' ? fullTimeoutMs : timeoutMs;
      timer = setTimeout(() => {
        if (!item) return;
        finish({
          ...item,
          status: 'timeout',
          stage: nativePid ? 'native' : sourceHash ? 'syntax' : 'generation',
          sourceHash,
          generationMs,
          elapsedMs: Date.now() - started,
          checkedAt: new Date().toISOString(),
          error: `Case exceeded ${limit} ms. ${errors}`,
        });
        if (nativePid) {
          try {
            process.kill(nativePid, 'SIGKILL');
          } catch {}
        }
        worker.removeAllListeners();
        worker.kill('SIGKILL');
        worker = spawnWorker();
        completedByWorker = 0;
        listen();
      }, limit);
      worker.send({
        item,
        previous:
          item.phase === 'syntax' || previous?.scope.runtimeSignature === runtimeSignature
            ? previousResults[item.key]
            : undefined,
        nativePython,
        syntaxPython,
        pythonLib,
      });
    };
    const finish = (result: AuditResult) => {
      if (timer) clearTimeout(timer);
      if (nativePid) nativeChildren.delete(nativePid);
      results[result.key] = result;
      activeCases.delete(result.key);
      completed++;
      if (result.status !== 'passed' || completed % (result.phase === 'syntax' ? 100 : 10) === 0) {
        save();
        process.stdout.write(
          `${completed}/${cases.length} ${result.status.toUpperCase()} ${result.key}${result.error ? '\n' + result.error.slice(0, 5000) : ''}\n`,
        );
      }
      item = undefined;
    };
    const listen = () => {
      worker.stderr?.on('data', (chunk: Buffer) => {
        errors = (errors + chunk.toString()).slice(-8000);
      });
      worker.on(
        'message',
        (message: {
          kind: string;
          result?: AuditResult;
          pid?: number;
          sourceHash?: string;
          generationMs?: number;
        }) => {
          if (message.kind === 'ready') start();
          if (message.kind === 'native-started') {
            nativePid = message.pid;
            if (nativePid) nativeChildren.add(nativePid);
            if (item) activeCases.get(item.key)!.stage = 'native';
          }
          if (message.kind === 'generated') {
            sourceHash = message.sourceHash;
            generationMs = message.generationMs;
            if (item)
              Object.assign(activeCases.get(item.key)!, {
                sourceHash,
                stage: item.phase === 'native' ? 'native' : 'syntax',
              });
          }
          if (message.kind === 'result' && message.result) {
            finish(message.result);
            completedByWorker++;
            if (completedByWorker >= workerCaseLimit && cursor < cases.length) {
              const previousWorker = worker;
              previousWorker.removeAllListeners();
              previousWorker.once('exit', () => activeWorkers.delete(previousWorker));
              previousWorker.disconnect();
              worker = spawnWorker();
              completedByWorker = 0;
              listen();
            } else start();
          }
        },
      );
      worker.once('exit', (code, signal) => {
        if (!item) {
          if (cursor < cases.length)
            rejectWorker(
              new Error(
                `Audit worker could not load the library: code ${code}, signal ${signal}.\n${errors}`,
              ),
            );
          return;
        }
        finish({
          ...item,
          status: 'failed',
          stage: nativePid ? 'native' : sourceHash ? 'syntax' : 'generation',
          elapsedMs: Date.now() - started,
          checkedAt: new Date().toISOString(),
          error: `Audit worker exited: code ${code}, signal ${signal}.\n${errors}`,
        });
        if (nativePid) {
          try {
            process.kill(nativePid, 'SIGKILL');
          } catch {}
        }
        worker = spawnWorker();
        completedByWorker = 0;
        listen();
      });
    };
    listen();
  });
}
console.log(`Auditing ${selections.length} families, ${cases.length} cases; report ${reportPath}`);
save();
// Long assemblies must still expose progress while their individual checks run.
const progressTimer = setInterval(save, 15_000);
progressTimer.unref();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    save();
    stopWorkers();
    console.log(`Interrupted after ${completed}/${cases.length}; resume from ${reportPath}`);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
try {
  await Promise.all(Array.from({ length: jobs }, runWorker));
} catch (error) {
  save();
  stopWorkers();
  throw error;
}
save();
clearInterval(progressTimer);
const failures = Object.values(results).filter((result) => result.status !== 'passed');
console.log(
  `Completed ${completed}/${cases.length}: ${completed - failures.length} passed, ${failures.length} failed/timeouts. Report: ${reportPath}`,
);
if (failures.length) process.exitCode = 1;
