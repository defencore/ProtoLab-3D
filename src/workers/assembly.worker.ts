import { buildLibraryOutput, type WorkerOutputRequest } from '../core/library-output';
import { generateProjectScript } from '../core/project-freecad';
import { createPartLoader } from '../core/lazy-parts';
import type { PartModule } from '../core/part-modules';

const loadParts = createPartLoader(
  Object.fromEntries(
    Object.entries(import.meta.glob<{ default: PartModule }>('../parts/*/index.ts')).map(
      ([path, load]) => [path.split('/').at(-2)!, load],
    ),
  ),
);

self.onmessage = async (event: MessageEvent<WorkerOutputRequest>) => {
  const request = event.data;
  try {
    if (request.kind === 'project-script') {
      const parts = await loadParts(
        request.project.configurations.map((configuration) => configuration.libraryId),
      );
      self.postMessage({
        kind: 'project-script',
        script: generateProjectScript(request.project, parts, request.geometryMode),
      });
      return;
    }
    const parts = await loadParts([request.partId]);
    const part = parts.find((entry) => entry.id === request.partId);
    if (!part) throw new Error('Unknown library product.');
    const { buffers, ...output } = buildLibraryOutput(part, request);
    self.postMessage(output, { transfer: buffers });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
