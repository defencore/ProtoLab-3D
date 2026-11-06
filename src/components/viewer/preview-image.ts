import {
  Vector2,
  Vector4,
  type OrthographicCamera,
  type Scene,
  type Vector3,
  type WebGLRenderer,
} from 'three';

export interface PreviewImageLabel {
  text: string;
  position: Vector3;
}

export interface PreviewImageOptions {
  width: number;
  height: number;
  backgroundMode: 'dark' | 'light';
  labels?: readonly PreviewImageLabel[];
}

/** Keep the current composition while rendering a fresh, full-resolution image. */
export function previewImageSize(width: number, height: number, longEdge = 2560) {
  if (![width, height, longEdge].every((value) => Number.isFinite(value) && value > 0))
    throw new Error('The preview image dimensions must be positive and finite.');
  const scale = longEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function supportedImageSize(renderer: WebGLRenderer, width: number, height: number) {
  const context = renderer.getContext();
  const bufferLimit = Number(context.getParameter(context.MAX_RENDERBUFFER_SIZE));
  const viewportLimit = context.getParameter(context.MAX_VIEWPORT_DIMS) as Int32Array;
  const scale = Math.min(
    1,
    bufferLimit / width,
    bufferLimit / height,
    viewportLimit[0] / width,
    viewportLimit[1] / height,
  );
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error('This browser cannot render a preview image.');
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

function drawLabels(
  context: CanvasRenderingContext2D,
  camera: OrthographicCamera,
  options: PreviewImageOptions,
  width: number,
  height: number,
) {
  const scale = Math.min(width / options.width, height / options.height);
  const light = options.backgroundMode === 'light';
  context.font = `${10 * scale}px "IBM Plex Mono", "SFMono-Regular", Consolas, monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const label of options.labels ?? []) {
    const projected = label.position.clone().project(camera);
    if (projected.z <= -1 || projected.z >= 1) continue;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const labelWidth = context.measureText(label.text).width + 14 * scale;
    const labelHeight = 21 * scale;
    context.beginPath();
    context.roundRect(x - labelWidth / 2, y - labelHeight / 2, labelWidth, labelHeight, 4 * scale);
    context.fillStyle = light ? '#fffffff0' : '#242932eb';
    context.shadowColor = '#0002';
    context.shadowBlur = 6 * scale;
    context.shadowOffsetY = 2 * scale;
    context.fill();
    context.shadowColor = 'transparent';
    context.lineWidth = scale;
    context.strokeStyle = light ? '#9aa7b866' : '#56617366';
    context.stroke();
    context.fillStyle = light ? '#405069' : '#b8c5d7';
    context.fillText(label.text, x, y);
  }
}

/** Render synchronously and restore the visible viewport before asynchronous PNG encoding. */
export async function capturePreviewImage(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: OrthographicCamera,
  options: PreviewImageOptions,
): Promise<Blob> {
  const requested = previewImageSize(options.width, options.height);
  const output = supportedImageSize(renderer, requested.width, requested.height);
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the preview image.');
    const size = renderer.getSize(new Vector2());
    const pixelRatio = renderer.getPixelRatio();
    const viewport = renderer.getViewport(new Vector4());
    const scissor = renderer.getScissor(new Vector4());
    const scissorTest = renderer.getScissorTest();
    const renderTarget = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace();
    const mipmapLevel = renderer.getActiveMipmapLevel();
    let captureFailed = false;
    try {
      renderer.setRenderTarget(null);
      renderer.setDrawingBufferSize(output.width, output.height, 1);
      renderer.setScissorTest(false);
      renderer.render(scene, camera);
      context.fillStyle = options.backgroundMode === 'light' ? '#eef1f5' : '#17191c';
      context.fillRect(0, 0, output.width, output.height);
      // Copy the freshly rendered framebuffer before WebGL clears its drawing buffer.
      context.drawImage(renderer.domElement, 0, 0, output.width, output.height);
      drawLabels(context, camera, options, output.width, output.height);
    } catch (error) {
      captureFailed = true;
      throw error;
    } finally {
      renderer.setDrawingBufferSize(size.x, size.y, pixelRatio);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.setRenderTarget(renderTarget, cubeFace, mipmapLevel);
      try {
        renderer.render(scene, camera);
      } catch (error) {
        if (!captureFailed) throw error;
      }
    }
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The browser could not encode the preview image as PNG.'));
      }, 'image/png');
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Start clipboard.write in the original user gesture, including browsers that require it. */
export async function copyPreviewImage(capture: () => Promise<Blob>): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
    throw new Error('This browser does not support copying PNG images to the clipboard.');
  const image = Promise.resolve().then(capture);
  // A denied write can settle before image rendering or encoding finishes.
  void image.catch(() => {});
  const writing = navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
  await Promise.all([writing, image]);
}
