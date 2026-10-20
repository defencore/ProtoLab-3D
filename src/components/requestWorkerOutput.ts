import type {
  LibraryOutput,
  LibraryOutputRequest,
  ProjectOutput,
  WorkerOutputRequest,
} from '../core/library-output';
import type { GeometryMode } from '../core/geometry-mode';
import type { DesignProject } from '../core/product-types';

function requestOutput<T extends { kind: string }>(
  request: WorkerOutputRequest,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Export cancelled.', 'AbortError'));
    const worker = new Worker(new URL('../workers/assembly.worker.ts', import.meta.url), {
      type: 'module',
    });
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException('Export cancelled.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error('The export took too long. Try Simple mode or a smaller assembly.'));
    }, 120_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<T & { error?: string }>) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.kind !== request.kind)
        reject(new Error('The export does not match the requested format.'));
      else resolve(event.data);
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || 'The export could not be prepared.'));
    };
    try {
      worker.postMessage(request);
    } catch (cause) {
      finish();
      reject(cause);
    }
  });
}

export function requestLibraryOutput(request: LibraryOutputRequest, signal: AbortSignal) {
  return requestOutput<LibraryOutput>(request, signal);
}

export function requestProjectOutput(
  project: DesignProject,
  geometryMode: GeometryMode,
  signal: AbortSignal,
) {
  return requestOutput<ProjectOutput>({ kind: 'project-script', project, geometryMode }, signal);
}
