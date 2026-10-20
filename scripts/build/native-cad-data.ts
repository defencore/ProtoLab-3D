import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';

const virtualPrefix = '\0protolab-native-cad:';

// These source meshes and BReps predate the native.json naming convention.
// Keep fabrication settings, fit reports, product metadata and presets as ordinary JSON modules.
const sourceCadFiles = new Set([
  'parts/bevel-gearbox-42/lib/housing.json',
  'parts/multicopter-frame-component/lib/source.json',
  'parts/multicopter-frame-component/lib/additional.json',
  'parts/multicopter-frame-component/lib/multirotors.json',
]);

/** Paths are relative to src; this policy is shared by the application and worker builds. */
export function isNativeCadData(relativeFile: string): boolean {
  const file = relativeFile.split(path.sep).join('/');
  return (
    sourceCadFiles.has(file) ||
    /^parts\/[^/]+\/lib\/(?:[^/]+\/)*native\/[^/]+\.json$/.test(file) ||
    /^parts\/[^/]+\/lib\/(?:[^/]+\/)*(?:native(?:-[^/]+)?|[^/]+-native)\.json$/.test(file) ||
    /^core\/assembly\/recovery\/(?:hat|st3215)-native\.json$/.test(file)
  );
}

/** Preserve exact CAD data as immutable ES modules without adding it to Rollup's code AST. */
export function nativeCadDataPlugin(): Plugin {
  const externalModules = new Map<string, string>();
  const emittedAssets = new Set<string>();
  let sourceDirectory: string;
  let assetsDirectory: string;
  let base: string;
  return {
    name: 'protolab-native-cad-data',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      sourceDirectory = path.resolve(realpathSync(config.root), 'src');
      assetsDirectory = config.build.assetsDir;
      base = config.base;
    },
    buildStart() {
      externalModules.clear();
      emittedAssets.clear();
    },
    resolveId(source, importer) {
      if (externalModules.has(source)) return { id: source, external: true };
      if (!importer || !source.endsWith('.json')) return;
      const file = path.resolve(path.dirname(importer), source);
      if (isNativeCadData(path.relative(sourceDirectory, file)))
        return virtualPrefix + file + '.js';
    },
    load(id) {
      if (!id.startsWith(virtualPrefix)) return;
      const file = id.slice(virtualPrefix.length, -3);
      this.addWatchFile(file);
      const json = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      const digest = createHash('sha256').update(json).digest('hex').slice(0, 12);
      const identity = path.relative(sourceDirectory, file).slice(0, -5).split(path.sep).join('-');
      const fileName = path.posix.join(assetsDirectory, `native-${identity}-${digest}.js`);
      if (!emittedAssets.has(fileName)) {
        try {
          JSON.parse(json);
        } catch (cause) {
          throw new Error(`Invalid native CAD JSON in ${file}.`, { cause });
        }
        this.emitFile({
          type: 'asset',
          fileName,
          source: `export default JSON.parse(${JSON.stringify(json)});\n`,
        });
        emittedAssets.add(fileName);
      }
      const moduleUrl = (base === './' || base === '' ? '/' : base) + fileName;
      externalModules.set(moduleUrl, fileName);
      return `export { default } from ${JSON.stringify(moduleUrl)};`;
    },
    renderChunk(code, chunk, options) {
      if (base !== './' && base !== '') return;
      let rewritten: MagicString | undefined;
      for (let index = 0; index < chunk.imports.length; index++) {
        const imported = chunk.imports[index];
        const fileName = externalModules.get(imported);
        if (!fileName) continue;
        const relative = path.posix.relative(path.posix.dirname(chunk.fileName), fileName);
        const specifier = relative.startsWith('.') ? relative : './' + relative;
        const escaped = imported.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const quoted = new RegExp(`(["'])${escaped}\\1`, 'g');
        let matched = false;
        for (const match of code.matchAll(quoted)) {
          matched = true;
          rewritten ??= new MagicString(code);
          rewritten.overwrite(
            match.index!,
            match.index! + match[0].length,
            JSON.stringify(specifier),
          );
        }
        if (!matched)
          throw new Error(
            `Native CAD import could not be rendered in ${chunk.fileName}: ${imported}.`,
          );
        // Keep the generated dependency graph consistent with the actual browser import.
        chunk.imports[index] = specifier;
      }
      if (rewritten)
        return {
          code: rewritten.toString(),
          map: options.sourcemap ? rewritten.generateMap({ hires: true }) : null,
        };
    },
  };
}
