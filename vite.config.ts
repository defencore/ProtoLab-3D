import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { partModulesPlugin } from './scripts/part-modules/vite-plugin';

/** Keep immutable CAD payloads as ES module assets, outside Rollup's code graph. */
function nativeCadDataPlugin(): Plugin {
  const virtualPrefix = '\0protolab-native-cad:';
  const externalModules = new Set<string>();
  let partsDirectory: string;
  let assetsDirectory: string;
  let base: string;
  return {
    name: 'protolab-native-cad-data',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      partsDirectory = path.resolve(config.root, 'src/parts');
      assetsDirectory = config.build.assetsDir;
      base = config.base;
    },
    resolveId(source, importer) {
      if (externalModules.has(source)) return { id: source, external: true };
      if (!importer || !source.endsWith('.json')) return;
      const file = path.resolve(path.dirname(importer), source);
      const relative = path.relative(partsDirectory, file).split(path.sep).join('/');
      if (/^[^/]+\/lib\/native\/[^/]+\.json$/.test(relative)) return virtualPrefix + file + '.js';
    },
    load(id) {
      if (!id.startsWith(virtualPrefix)) return;
      const file = id.slice(virtualPrefix.length, -3);
      this.addWatchFile(file);
      const json = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      const digest = createHash('sha256').update(json).digest('hex').slice(0, 12);
      const packageId = path.relative(partsDirectory, file).split(path.sep)[0];
      const fileName = path.posix.join(
        assetsDirectory,
        `native-${packageId}-${path.basename(file, '.json')}-${digest}.js`,
      );
      this.emitFile({
        type: 'asset',
        fileName,
        source: `export default JSON.parse(${JSON.stringify(json)});\n`,
      });
      const moduleUrl = base + fileName;
      externalModules.add(moduleUrl);
      return `export { default } from ${JSON.stringify(moduleUrl)};`;
    },
  };
}

export default defineConfig({
  plugins: [partModulesPlugin(), nativeCadDataPlugin(), react()],
  base: '/',
  // Catalog and native CAD data use default imports; keep them out of Rollup's property AST.
  json: { stringify: true, namedExports: false },
  worker: { format: 'es', plugins: () => [nativeCadDataPlugin()] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-engine': ['three'],
        },
      },
    },
  },
});
