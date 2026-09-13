import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { inspectPackage, syncRegistry } from './library';

/** Keep browser builds and Node scripts on the same generated ESM registry. */
export function partModulesPlugin(): Plugin {
  let root: string;
  let server: ViteDevServer | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<unknown> = Promise.resolve();
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      pending = pending
        .then(() => syncRegistry(root))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          server?.config.logger.error(message);
          server?.ws.send({ type: 'error', err: { message, stack: '' } });
        });
    }, 120);
  }
  return {
    name: 'protolab-part-packages',
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      await syncRegistry(root);
    },
    configureServer(devServer) {
      server = devServer;
      const directory = path.join(root, 'src/parts');
      const changed = (file: string) => {
        const relative = path.relative(directory, file);
        if (!relative.startsWith('..') && relative !== 'index.ts') schedule();
      };
      server.watcher
        .on('add', changed)
        .on('unlink', changed)
        .on('addDir', changed)
        .on('unlinkDir', changed);
      server.httpServer?.once('close', () => {
        clearTimeout(timer);
        server?.watcher
          .off('add', changed)
          .off('unlink', changed)
          .off('addDir', changed)
          .off('unlinkDir', changed);
      });
    },
    async handleHotUpdate(context) {
      const relative = path.relative(path.join(root, 'src/parts'), context.file);
      if (relative.startsWith('..') || relative === 'index.ts') return;
      const id = relative.split(path.sep)[0];
      await inspectPackage(path.join(root, 'src/parts', id), root);
      if (relative === path.join(id, 'index.ts')) await syncRegistry(root);
    },
  };
}
