import assert from 'node:assert/strict';
import test from 'node:test';
import { OrthographicCamera, Scene, Vector2, Vector3, Vector4, type WebGLRenderer } from 'three';
import {
  capturePreviewImage,
  copyPreviewImage,
  previewImageSize,
} from '../src/components/viewer/preview-image';

const originalGlobals = new WeakMap<object, Map<string, PropertyDescriptor | undefined>>();

function replaceGlobal(
  context: { after(callback: () => void): void },
  key: string,
  value: unknown,
) {
  let originals = originalGlobals.get(context);
  if (!originals) {
    originals = new Map();
    originalGlobals.set(context, originals);
    const saved = originals;
    context.after(() => {
      for (const [name, previous] of saved) {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else Reflect.deleteProperty(globalThis, name);
      }
      originalGlobals.delete(context);
    });
  }
  if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, value });
}

class FakeContext {
  fillStyle = '';
  strokeStyle = '';
  font = '';
  textAlign = '';
  textBaseline = '';
  shadowColor = '';
  shadowBlur = 0;
  shadowOffsetY = 0;
  lineWidth = 0;
  backgrounds: { style: string; bounds: number[] }[] = [];
  copies: unknown[][] = [];
  labels: { text: string; x: number; y: number; font: string }[] = [];
  failure: 'copy' | 'label' | undefined;
  fillRect(...bounds: number[]) {
    this.backgrounds.push({ style: this.fillStyle, bounds });
  }
  drawImage(...args: unknown[]) {
    if (this.failure === 'copy') throw new Error('Framebuffer copy failed.');
    this.copies.push(args);
  }
  beginPath() {}
  roundRect() {}
  fill() {}
  stroke() {}
  measureText(text: string) {
    return { width: text.length * 7 };
  }
  fillText(text: string, x: number, y: number) {
    if (this.failure === 'label') throw new Error('Label rendering failed.');
    this.labels.push({ text, x, y, font: this.font });
  }
}

class FakeCanvas {
  width = 0;
  height = 0;
  context = new FakeContext();
  encoding: { mime?: string; width: number; height: number }[] = [];
  complete: ((blob: Blob | null) => void) | undefined;
  noContext = false;
  encodingFailure: 'null' | 'throw' | undefined;
  deferred = false;
  getContext() {
    return this.noContext ? null : this.context;
  }
  toBlob(callback: (blob: Blob | null) => void, mime?: string) {
    this.encoding.push({ mime, width: this.width, height: this.height });
    if (this.encodingFailure === 'throw') throw new Error('PNG encoding threw.');
    this.complete = callback;
    if (!this.deferred)
      queueMicrotask(() =>
        callback(this.encodingFailure === 'null' ? null : new Blob(['PNG'], { type: mime })),
      );
  }
}

class FakeRenderer {
  size = new Vector2(800, 600);
  ratio = 2;
  viewport = new Vector4(7, 9, 780, 580);
  scissor = new Vector4(3, 4, 700, 500);
  scissorTest = true;
  renderTarget: object | null = { name: 'Original target' };
  cubeFace = 4;
  mipmapLevel = 2;
  limit = 3000;
  domElement = {
    width: 1600,
    height: 1200,
    style: Object.freeze({ width: '800px', height: '600px' }),
  };
  allocations: [number, number][] = [];
  renders: {
    width: number;
    height: number;
    ratio: number;
    camera: OrthographicCamera;
    projection: number[];
  }[] = [];
  renderFailures = new Map<number, Error>();
  getContext() {
    return {
      MAX_RENDERBUFFER_SIZE: 1,
      MAX_VIEWPORT_DIMS: 2,
      getParameter: (key: number) =>
        key === 1 ? this.limit : new Int32Array([this.limit, this.limit]),
    };
  }
  getSize(target: Vector2) {
    return target.copy(this.size);
  }
  getPixelRatio() {
    return this.ratio;
  }
  getViewport(target: Vector4) {
    return target.copy(this.viewport);
  }
  getScissor(target: Vector4) {
    return target.copy(this.scissor);
  }
  getScissorTest() {
    return this.scissorTest;
  }
  getRenderTarget() {
    return this.renderTarget;
  }
  getActiveCubeFace() {
    return this.cubeFace;
  }
  getActiveMipmapLevel() {
    return this.mipmapLevel;
  }
  setRenderTarget(target: object | null, face = 0, mipmapLevel = 0) {
    this.renderTarget = target;
    this.cubeFace = face;
    this.mipmapLevel = mipmapLevel;
  }
  setDrawingBufferSize(width: number, height: number, ratio: number) {
    this.size.set(width, height);
    this.ratio = ratio;
    this.allocate();
    this.viewport.set(0, 0, width, height);
  }
  setPixelRatio(ratio: number) {
    this.setDrawingBufferSize(this.size.x, this.size.y, ratio);
  }
  setSize(width: number, height: number, updateStyle = true) {
    assert.equal(updateStyle, false, 'capture must not resize the visible canvas CSS');
    this.setDrawingBufferSize(width, height, this.ratio);
  }
  setViewport(value: Vector4) {
    this.viewport.copy(value);
  }
  setScissor(value: Vector4) {
    this.scissor.copy(value);
  }
  setScissorTest(value: boolean) {
    this.scissorTest = value;
  }
  render(_scene: Scene, camera: OrthographicCamera) {
    this.renders.push({
      width: this.domElement.width,
      height: this.domElement.height,
      ratio: this.ratio,
      camera,
      projection: camera.projectionMatrix.toArray(),
    });
    const failure = this.renderFailures.get(this.renders.length);
    if (failure) throw failure;
  }
  snapshot() {
    return {
      size: this.size.toArray(),
      ratio: this.ratio,
      viewport: this.viewport.toArray(),
      scissor: this.scissor.toArray(),
      scissorTest: this.scissorTest,
      target: this.renderTarget,
      cubeFace: this.cubeFace,
      mipmapLevel: this.mipmapLevel,
      buffer: [this.domElement.width, this.domElement.height],
      css: { ...this.domElement.style },
    };
  }
  private allocate() {
    const width = Math.floor(this.size.x * this.ratio),
      height = Math.floor(this.size.y * this.ratio);
    this.allocations.push([width, height]);
    assert.ok(
      width <= this.limit && height <= this.limit,
      'no temporary HiDPI allocation may exceed the checked GPU limit',
    );
    this.domElement.width = width;
    this.domElement.height = height;
  }
}

function fixture(context: { after(callback: () => void): void }) {
  const canvas = new FakeCanvas();
  replaceGlobal(context, 'document', {
    createElement: (tag: string) => {
      assert.equal(tag, 'canvas');
      return canvas;
    },
  });
  const renderer = new FakeRenderer();
  const camera = new OrthographicCamera(-100, 100, 75, -75, 0.1, 10000);
  camera.position.set(40, 30, 120);
  camera.zoom = 1.7;
  const target = new Vector3(12, -8, 30);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const scene = new Scene();
  const capture = (backgroundMode: 'light' | 'dark' = 'light') =>
    capturePreviewImage(renderer as unknown as WebGLRenderer, scene, camera, {
      width: 800,
      height: 600,
      backgroundMode,
      labels: [
        { text: '25.5 mm', position: target },
        {
          text: 'Behind camera',
          position: camera.position.clone().sub(target).multiplyScalar(100).add(camera.position),
        },
      ],
    });
  return { renderer, canvas, camera, capture };
}

test('preview image size preserves aspect at a 2560-pixel long edge and rejects invalid dimensions', () => {
  assert.deepEqual(previewImageSize(800, 600), { width: 2560, height: 1920 });
  assert.deepEqual(previewImageSize(600, 800), { width: 1920, height: 2560 });
  assert.deepEqual(previewImageSize(1, 1), { width: 2560, height: 2560 });
  assert.deepEqual(previewImageSize(800, 600, 3840), { width: 3840, height: 2880 });
  assert.ok(previewImageSize(100000, 1).height >= 1);
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => previewImageSize(invalid, 600));
    assert.throws(() => previewImageSize(800, invalid));
    assert.throws(() => previewImageSize(800, 600, invalid));
  }
});

test('capture renders native high resolution, composites background and projected labels, then restores the viewport before PNG encoding', async (context) => {
  const { renderer, canvas, camera, capture } = fixture(context);
  canvas.deferred = true;
  const before = renderer.snapshot();
  const beforeCamera = camera.toJSON();
  const image = capture();
  assert.deepEqual(
    renderer.snapshot(),
    before,
    'restore synchronously before asynchronous PNG encoding',
  );
  assert.deepEqual(camera.toJSON(), beforeCamera, 'camera framing and zoom are unchanged');
  assert.deepEqual(
    renderer.renders.map(({ width, height }) => [width, height]),
    [
      [2560, 1920],
      [1600, 1200],
    ],
  );
  assert.ok(
    renderer.renders.every(
      (render) =>
        render.camera === camera &&
        render.projection.every((value, i) => value === camera.projectionMatrix.elements[i]),
    ),
  );
  assert.deepEqual(canvas.context.backgrounds, [{ style: '#eef1f5', bounds: [0, 0, 2560, 1920] }]);
  assert.strictEqual(
    canvas.context.copies[0][0],
    renderer.domElement,
    'copy only the freshly rendered scene canvas',
  );
  assert.deepEqual(canvas.context.copies[0].slice(1), [0, 0, 2560, 1920]);
  assert.equal(canvas.context.labels.length, 1);
  assert.equal(canvas.context.labels[0].text, '25.5 mm');
  assert.ok(Math.abs(canvas.context.labels[0].x - 1280) < 1e-8);
  assert.ok(Math.abs(canvas.context.labels[0].y - 960) < 1e-8);
  assert.match(canvas.context.labels[0].font, /^32px/);
  assert.deepEqual(canvas.encoding, [{ mime: 'image/png', width: 2560, height: 1920 }]);
  assert.equal(canvas.width, 2560, 'retain the export bitmap while encoding is pending');
  const png = new Blob(['PNG'], { type: 'image/png' });
  canvas.complete!(png);
  assert.strictEqual(await image, png);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
  assert.deepEqual(renderer.snapshot(), before);
});

test('capture uses the dark background and respects hardware limits without oversized intermediate allocations', async (context) => {
  const { renderer, canvas, capture } = fixture(context);
  renderer.limit = 2048;
  const before = renderer.snapshot();
  const image = await capture('dark');
  assert.equal(image.type, 'image/png');
  assert.deepEqual(canvas.context.backgrounds, [{ style: '#17191c', bounds: [0, 0, 2048, 1536] }]);
  assert.ok(
    renderer.allocations.every(
      ([width, height]) => width <= renderer.limit && height <= renderer.limit,
    ),
  );
  assert.deepEqual(renderer.snapshot(), before);
});

test('rendering, framebuffer copying, label drawing and PNG failures restore renderer state and release the export canvas', async (context) => {
  for (const stage of ['render', 'copy', 'label', 'null', 'throw'] as const) {
    const { renderer, canvas, capture } = fixture(context);
    const before = renderer.snapshot();
    if (stage === 'render') {
      renderer.renderFailures.set(1, new Error('Original capture failure.'));
      renderer.renderFailures.set(2, new Error('Secondary restore render failure.'));
    } else if (stage === 'copy' || stage === 'label') canvas.context.failure = stage;
    else canvas.encodingFailure = stage;
    await assert.rejects(
      capture,
      stage === 'render' ? /Original capture failure/ : /failed|encode|encoding/i,
    );
    assert.deepEqual(renderer.snapshot(), before, stage);
    assert.equal(canvas.width, 0, stage);
    assert.equal(canvas.height, 0, stage);
    assert.equal(renderer.renders.length, 2, 'redraw the previous view even after failure');
  }
});

test('unsupported graphics limits and unavailable 2D contexts fail before changing the visible viewport', async (context) => {
  const first = fixture(context);
  first.renderer.limit = 0;
  const firstState = first.renderer.snapshot();
  await assert.rejects(first.capture, /cannot render/);
  assert.deepEqual(first.renderer.snapshot(), firstState);
  assert.equal(first.renderer.renders.length, 0);
  const second = fixture(context);
  second.canvas.noContext = true;
  const secondState = second.renderer.snapshot();
  await assert.rejects(second.capture, /could not prepare/);
  assert.deepEqual(second.renderer.snapshot(), secondState);
  assert.equal(second.canvas.width, 0);
});

class FakeClipboardItem {
  constructor(readonly data: Record<string, Promise<Blob>>) {}
}

test('clipboard PNG write starts synchronously in the user gesture while capture remains pending', async (context) => {
  let writeCalled = false,
    captureCalled = false;
  let resolveImage!: (blob: Blob) => void;
  const image = new Promise<Blob>((resolve) => {
    resolveImage = resolve;
  });
  let item!: FakeClipboardItem;
  replaceGlobal(context, 'ClipboardItem', FakeClipboardItem);
  replaceGlobal(context, 'navigator', {
    clipboard: {
      write: (items: FakeClipboardItem[]) => {
        writeCalled = true;
        assert.equal(items.length, 1);
        item = items[0];
        return item.data['image/png'].then(() => undefined);
      },
    },
  });
  const operation = copyPreviewImage(() => {
    captureCalled = true;
    return image;
  });
  assert.equal(writeCalled, true, 'do not await capture before requesting clipboard access');
  assert.equal(captureCalled, false, 'defer expensive rendering until after write starts');
  assert.deepEqual(Object.keys(item.data), ['image/png']);
  await Promise.resolve();
  assert.equal(captureCalled, true);
  const png = new Blob(['PNG'], { type: 'image/png' });
  resolveImage(png);
  await operation;
  assert.strictEqual(await item.data['image/png'], png);
});

test('unsupported clipboard APIs fail without starting image rendering', async (context) => {
  replaceGlobal(context, 'ClipboardItem', FakeClipboardItem);
  replaceGlobal(context, 'navigator', {});
  let captures = 0;
  await assert.rejects(
    copyPreviewImage(async () => {
      captures++;
      return new Blob();
    }),
    /does not support/,
  );
  assert.equal(captures, 0);
  replaceGlobal(context, 'navigator', { clipboard: { write: async () => {} } });
  replaceGlobal(context, 'ClipboardItem', undefined);
  await assert.rejects(
    copyPreviewImage(async () => {
      captures++;
      return new Blob();
    }),
    /does not support/,
  );
  assert.equal(captures, 0);
});

test('clipboard denial and capture errors reject without late unhandled image failures', async (context) => {
  replaceGlobal(context, 'ClipboardItem', FakeClipboardItem);
  let rejectImage!: (error: Error) => void;
  const image = new Promise<Blob>((_resolve, reject) => {
    rejectImage = reject;
  });
  replaceGlobal(context, 'navigator', {
    clipboard: {
      write: async () => {
        throw new Error('Clipboard permission denied.');
      },
    },
  });
  const operation = copyPreviewImage(() => image);
  await assert.rejects(operation, /permission denied/);
  rejectImage(new Error('Late render failure.'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  replaceGlobal(context, 'navigator', { clipboard: { write: async () => {} } });
  await assert.rejects(
    copyPreviewImage(async () => {
      throw new Error('Image capture failed.');
    }),
    /Image capture failed/,
  );
});
