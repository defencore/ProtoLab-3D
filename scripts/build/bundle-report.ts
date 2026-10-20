import path from 'node:path';
import { realpathSync } from 'node:fs';
import type { OutputBundle, OutputChunk } from 'rollup';
import type { Plugin } from 'vite';

interface ReportOptions {
  /** Dynamic modules requested immediately during startup, in addition to the static entry graph. */
  startupModules: string[];
}

interface GraphOptions {
  base: string;
  startupModuleIds: string[];
}

function outputBytes(output: OutputBundle[string]): number {
  return output.type === 'chunk'
    ? Buffer.byteLength(output.code)
    : typeof output.source === 'string'
      ? Buffer.byteLength(output.source)
      : output.source.byteLength;
}

/** Count emitted native modules as well as chunks; dynamic worker/product imports stay separate. */
export function createBundleReport(bundle: OutputBundle, options: GraphOptions) {
  const chunks = Object.values(bundle).filter(
    (output): output is OutputChunk => output.type === 'chunk',
  );
  const entries = chunks
    .filter((chunk) => chunk.isEntry)
    .map((chunk) => chunk.fileName)
    .sort();
  const startupModules = options.startupModuleIds.map((id) => {
    const chunk = chunks.find((candidate) => candidate.moduleIds.includes(id));
    if (!chunk) throw new Error(`Startup module is missing from the production bundle: ${id}.`);
    return chunk.fileName;
  });
  const localFile = (reference: string, importer: string) => {
    if (Object.hasOwn(bundle, reference)) return reference;
    const absoluteBase = options.base !== '' && options.base !== './';
    const withoutBase =
      absoluteBase && reference.startsWith(options.base)
        ? reference.slice(options.base.length)
        : reference;
    if (Object.hasOwn(bundle, withoutBase)) return withoutBase;
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(importer), reference));
    return Object.hasOwn(bundle, relative) ? relative : undefined;
  };
  const collect = (roots: string[]) => {
    const visited = new Set<string>();
    const unresolvedImports = new Set<string>();
    const visit = (fileName: string) => {
      if (visited.has(fileName)) return;
      visited.add(fileName);
      const output = bundle[fileName];
      if (output.type !== 'chunk') return;
      for (const reference of output.imports) {
        const file = localFile(reference, fileName);
        if (file) visit(file);
        else unresolvedImports.add(reference);
      }
    };
    roots.forEach(visit);
    const files = [...visited].sort().map((fileName) => ({
      fileName,
      kind: bundle[fileName].type === 'chunk' ? 'chunk' : 'native-cad-module',
      bytes: outputBytes(bundle[fileName]),
    }));
    return {
      files,
      bytes: files.reduce((total, file) => total + file.bytes, 0),
      chunkBytes: files
        .filter((file) => file.kind === 'chunk')
        .reduce((total, file) => total + file.bytes, 0),
      nativeCadBytes: files
        .filter((file) => file.kind === 'native-cad-module')
        .reduce((total, file) => total + file.bytes, 0),
      unresolvedImports: [...unresolvedImports].sort(),
    };
  };
  const javascript = Object.values(bundle)
    .filter((output) => output.type === 'chunk' || output.fileName.endsWith('.js'))
    .map((output) => ({ fileName: output.fileName, bytes: outputBytes(output) }))
    .sort((a, b) => b.bytes - a.bytes || a.fileName.localeCompare(b.fileName));
  return {
    version: 1,
    measurement:
      'Uncompressed emitted JavaScript bytes. Startup includes the static entry closure and explicitly declared immediate dynamic imports. CSS, fonts, HTML, HTTP compression and runtime requests are not included. Each file is counted once per closure.',
    entries,
    immediateDynamicImports: [...new Set(startupModules)].sort(),
    entryStaticDependencies: collect(entries),
    startupDependencies: collect([...entries, ...startupModules]),
    allJavaScript: {
      fileCount: javascript.length,
      bytes: javascript.reduce((total, file) => total + file.bytes, 0),
      largestFiles: javascript.slice(0, 20),
    },
  };
}

export function bundleReportPlugin(options: ReportOptions): Plugin {
  let base: string;
  let startupModuleIds: string[];
  return {
    name: 'protolab-bundle-report',
    apply: 'build',
    configResolved(config) {
      base = config.base;
      startupModuleIds = options.startupModules.map((file) =>
        path.resolve(realpathSync(config.root), file),
      );
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const report = createBundleReport(bundle, { base, startupModuleIds });
        this.emitFile({
          type: 'asset',
          fileName: 'bundle-report.json',
          source: JSON.stringify(report, null, 2) + '\n',
        });
      },
    },
  };
}
