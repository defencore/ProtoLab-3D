import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import {
  requestLibraryOutput,
  requestPreviewOutput,
  requestProjectOutput,
} from '../src/components/requestWorkerOutput';
import type { WorkerOutputRequest } from '../src/core/library-output';
import { createProject } from '../src/core/design-project';

class TestWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  requests: WorkerOutputRequest[] = [];
  terminations = 0;
  postError?: Error;

  postMessage(request: WorkerOutputRequest) {
    if (this.postError) throw this.postError;
    this.requests.push(request);
  }

  terminate() {
    this.terminations++;
  }

  respond(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

function workers(context: TestContext, postError?: Error) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const created: TestWorker[] = [];
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: class extends TestWorker {
      constructor(url: URL, options: WorkerOptions) {
        super();
        assert.match(url.pathname, /\/workers\/assembly\.worker\.ts$/);
        assert.equal(options.type, 'module');
        this.postError = postError;
        created.push(this);
      }
    },
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else Reflect.deleteProperty(globalThis, 'Worker');
  });
  return created;
}

function released(worker: TestWorker) {
  assert.equal(worker.terminations, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
  assert.equal(worker.onmessageerror, null);
}

const configuration = {
  partId: 'test-part',
  parameters: { length: 25 },
  state: 'assembled',
  presetId: 'test-preset',
  geometryMode: 'simple' as const,
};

test('preview requests preserve packed geometry and release their worker after success', async (context) => {
  const created = workers(context);
  const controller = new AbortController();
  const remove = context.mock.method(controller.signal, 'removeEventListener');
  const pending = requestPreviewOutput(configuration, controller.signal);
  const worker = created[0];
  assert.deepEqual(worker.requests, [{ ...configuration, kind: 'preview' }]);
  const output = {
    kind: 'preview',
    model: { geometries: [], materials: [], meshes: [] },
    dimensions: [10, 20, 30],
  };
  worker.respond(output);
  assert.equal(await pending, output);
  assert.equal(remove.mock.callCount(), 1);
  controller.abort();
  released(worker);
});

test('library and project exports use the same isolated request lifecycle', async (context) => {
  const created = workers(context);
  const controller = new AbortController();
  const library = requestLibraryOutput({ ...configuration, kind: 'script' }, controller.signal);
  created[0].respond({ kind: 'script', script: 'library()' });
  assert.equal((await library).script, 'library()');
  const project = createProject();
  const assembly = requestProjectOutput(project, 'full', controller.signal);
  assert.deepEqual(created[1].requests, [
    { kind: 'project-script', project, geometryMode: 'full' },
  ]);
  created[1].respond({ kind: 'project-script', script: 'assembly()' });
  assert.equal((await assembly).script, 'assembly()');
  created.forEach(released);
});

test('already cancelled requests never allocate a worker', async (context) => {
  const created = workers(context);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(requestPreviewOutput(configuration, controller.signal), {
    name: 'AbortError',
  });
  assert.equal(created.length, 0);
});

test('cancellation releases a running worker and ignores late completion', async (context) => {
  const created = workers(context);
  const controller = new AbortController();
  const pending = requestPreviewOutput(configuration, controller.signal);
  const lateMessage = created[0].onmessage!;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  lateMessage({ data: { kind: 'preview' } } as MessageEvent);
  released(created[0]);
});

test('worker responses reject errors, mismatched formats and invalid payloads', async (context) => {
  const created = workers(context);
  for (const [response, expected] of [
    [{ error: 'Invalid dimensions.' }, /Invalid dimensions/],
    [{ error: '' }, /preview could not be prepared/],
    [{ kind: 'script', script: 'wrong()' }, /preview does not match/],
    [null, /preview returned an invalid response/],
  ] as const) {
    const pending = requestPreviewOutput(configuration, new AbortController().signal);
    const worker = created.at(-1)!;
    worker.respond(response);
    await assert.rejects(pending, expected);
    released(worker);
  }
});

test('worker startup, transport and unreadable message failures release resources', async (context) => {
  const created = workers(context);
  const controller = new AbortController();
  const crashed = requestPreviewOutput(configuration, controller.signal);
  created[0].onerror!({ message: 'Cannot load a model module.' } as ErrorEvent);
  await assert.rejects(crashed, /Cannot load a model module/);
  const unreadable = requestPreviewOutput(configuration, controller.signal);
  created[1].onmessageerror!();
  await assert.rejects(unreadable, /preview result could not be read/);
  created.forEach(released);
});

test('a request that cannot be posted releases its worker', async (context) => {
  const created = workers(context, new Error('Cannot clone this request.'));
  await assert.rejects(
    requestPreviewOutput(configuration, new AbortController().signal),
    /Cannot clone this request/,
  );
  released(created[0]);
});

test('preview and export timeouts terminate the worker and keep the correct error context', async (context) => {
  const created = workers(context);
  context.mock.timers.enable({ apis: ['setTimeout'] });
  for (const kind of ['preview', 'script'] as const) {
    const pending = requestLibraryOutput({ ...configuration, kind }, new AbortController().signal);
    const rejected = assert.rejects(
      pending,
      new RegExp(`The ${kind === 'preview' ? 'preview' : 'export'} took too long`),
    );
    context.mock.timers.tick(120_000);
    await rejected;
    released(created.at(-1)!);
  }
});
