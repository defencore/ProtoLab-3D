import type {
  LibraryWorkerOutput,
  LibraryOutputRequest,
  ProjectOutput,
  WorkerOutputRequest,
} from '../core/library-output';
import type { GeometryMode } from '../core/geometry-mode';
import type { DesignProject } from '../core/product-types';

type PreviewOutput = Extract<LibraryWorkerOutput, { kind: 'preview' }>;

/** One worker owns one request; every completion path releases it and its listeners. */
function requestOutput<T extends { kind: string }>(
  request: WorkerOutputRequest,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const purpose = request.kind === 'preview' ? 'preview' : 'export';
    const cancelled = () =>
      new DOMException(`${purpose === 'preview' ? 'Preview' : 'Export'} cancelled.`, 'AbortError');
    if (signal.aborted) return reject(cancelled());
    const worker = new Worker(new URL('../workers/assembly.worker.ts', import.meta.url), {
      type: 'module',
    });
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      return true;
    };
    const fail = (cause: unknown) => {
      if (finish()) reject(cause);
    };
    const abort = () => {
      fail(cancelled());
    };
    const timer = setTimeout(() => {
      fail(new Error(`The ${purpose} took too long. Try Simple mode or a smaller assembly.`));
    }, 120_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<T | { error: string }>) => {
      if (!finish()) return;
      const output = event.data;
      if (!output || typeof output !== 'object')
        reject(new Error(`The ${purpose} returned an invalid response.`));
      else if ('error' in output)
        reject(
          new Error(
            typeof output.error === 'string' && output.error
              ? output.error
              : `The ${purpose} could not be prepared.`,
          ),
        );
      else if (output.kind !== request.kind)
        reject(new Error(`The ${purpose} does not match the requested format.`));
      else resolve(output);
    };
    worker.onerror = (event) => {
      fail(new Error(event.message || `The ${purpose} could not be prepared.`));
    };
    worker.onmessageerror = () => {
      fail(new Error(`The ${purpose} result could not be read.`));
    };
    try {
      worker.postMessage(request);
    } catch (cause) {
      fail(cause);
    }
  });
}

export function requestPreviewOutput(
  request: Omit<LibraryOutputRequest, 'kind'>,
  signal: AbortSignal,
) {
  return requestOutput<PreviewOutput>({ ...request, kind: 'preview' }, signal);
}

export function requestLibraryOutput(request: LibraryOutputRequest, signal: AbortSignal) {
  return requestOutput<LibraryWorkerOutput>(request, signal);
}

export function requestProjectOutput(
  project: DesignProject,
  geometryMode: GeometryMode,
  signal: AbortSignal,
) {
  return requestOutput<ProjectOutput>({ kind: 'project-script', project, geometryMode }, signal);
}
