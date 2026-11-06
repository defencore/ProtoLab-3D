import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const excludedDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'test-results',
  '__pycache__',
]);
const authoredMacros = new Set([
  'docs/recovery/FixTechDrawLines.FCMacro',
  'docs/recovery/SelectedPartDrawing.FCMacro',
]);
const sourceInputs = new Set(['data/library-expansion.json']);
const cadOutput =
  /\.(?:stl|step|stp|fcstd\d*|fcbak|fcmacro|brep|brp|obj|ply|igs|iges|3mf|amf|gcode|dxf)$/i;
const referenceAttachment =
  /\.(?:apng|avif|bmp|gif|heic|heif|ico|jfif|jpe?g|png|svgz?|tiff?|webp|pdf|docx?|xlsx?|pptx?|mp[34]|mov|mkv|webm|wav|zip|7z|rar|tar|tgz|gz|bz2|xz)$/i;

/** Source CAD is represented by reviewed native JSON and authored code. */
export function artifactIssues(file, { allowGeneratedDirectories = true } = {}) {
  const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
  const segments = normalized.split('/');
  if (segments.some((part) => excludedDirectories.has(part)))
    return allowGeneratedDirectories
      ? []
      : [`${normalized}: generated output and cache directories must remain outside packages`];
  if (
    segments.some((part) =>
      /^(?:\.part-module-backups|\.part-module-staging-.*|\.catalog-snapshot-backup-.*)$/.test(
        part,
      ),
    ) ||
    segments[0] === 'screenshots' || segments.includes('.cache')
  )
    return [`${normalized}: keep generated screenshots, staging and backups under test-results/`];
  if (segments.at(-1) === '.DS_Store') return [`${normalized}: remove operating-system metadata`];
  if (/\.(?:tsbuildinfo|log|tmp|bak|orig|rej)$/i.test(normalized) || normalized.endsWith('~'))
    return [`${normalized}: keep generated caches, logs and backup files under test-results/`];
  if (normalized === 'result.json')
    return [`${normalized}: keep slicer results under test-results/`];
  if (normalized === 'src/catalog/data/gvyntok-fasteners.json')
    return [`${normalized}: keep the raw supplier inventory outside source directories`];
  if (
    referenceAttachment.test(normalized) ||
    segments.some((part) => /^(?:references|reference-images)$/i.test(part))
  )
    return [
      `${normalized}: keep reference attachments and media outside the repository and link to external sources`,
    ];
  if (normalized.startsWith('data/') && !sourceInputs.has(normalized))
    return [
      `${normalized}: data/ is reserved for reviewed source inputs; put generated reports in test-results/`,
    ];
  if (cadOutput.test(normalized) && !authoredMacros.has(normalized))
    return [
      `${normalized}: keep generated CAD, meshes and toolpaths under test-results/`,
    ];
  return [];
}

/** Inspect the working tree even when an artifact is ignored by Git. */
export function checkRepositoryArtifacts(root, options = {}) {
  const trackedFiles =
    options.trackedFiles ??
    execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
      .split('\0')
      .filter(Boolean);
  const issues = [];
  for (const file of trackedFiles) {
    if (file.split('/').some((part) => excludedDirectories.has(part)))
      issues.push(`${file}: generated output and cache directories must remain untracked`);
    else issues.push(...artifactIssues(file));
  }
  let count = 0;
  function visit(relative) {
    let entries;
    try {
      entries = readdirSync(path.join(root, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
      const found = artifactIssues(file);
      issues.push(...found);
      if (entry.isDirectory()) {
        if (!found.length) visit(file);
      } else count++;
    }
  }
  visit('');
  return { count, issues: [...new Set(issues)].sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { count, issues } = checkRepositoryArtifacts(root);
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      `Checked ${count} project files: source directories are free of bundled references and generated artifacts.`,
    );
}
