import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cyrillic = /\p{Script=Cyrillic}/u;

export function textIssues(file, text) {
  const issues = [];
  if (cyrillic.test(file)) issues.push(`${file}: Cyrillic file name`);
  for (const [index, line] of text.split('\n').entries()) {
    if (cyrillic.test(line)) issues.push(`${file}:${index + 1}: literal Cyrillic text`);
  }
  // Escaping prose is not a substitute for translating authored documentation.
  if (/\.md$/i.test(file) && /\\u(?:04[0-9a-f]{2}|05[0-2][0-9a-f])/i.test(text)) {
    issues.push(`${file}: translate documentation instead of escaping Cyrillic text`);
  }
  return issues;
}

export function checkRepository(root) {
  const files = [
    ...new Set(
      execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      })
        .split('\0')
        .filter(Boolean),
    ),
  ];
  const issues = [];
  let packageReadme;
  let count = 0;
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!existsSync(absolute) || !lstatSync(absolute).isFile()) continue;
    const bytes = readFileSync(absolute);
    if (bytes.includes(0)) {
      issues.push(...textIssues(file, ''));
      continue;
    }
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      issues.push(...textIssues(file, ''));
      continue;
    }
    count++;
    issues.push(...textIssues(file, text));
    if (/^src\/parts\/[^/]+\/README\.md$/.test(file)) {
      packageReadme ??= text;
      if (text !== packageReadme || !text.startsWith('# ProtoLab part package\n')) {
        issues.push(`${file}: use the shared package README; put component details in GUIDE.md`);
      }
    }
  }
  return { count, issues };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const { count, issues } = checkRepository(root);
  if (issues.length) {
    console.error(issues.slice(0, 30).join('\n'));
    console.error(`${issues.length} repository language/documentation issue(s).`);
    process.exitCode = 1;
  } else
    console.log(
      `Checked ${count} repository text files: no literal Cyrillic; package READMEs share the universal workflow.`,
    );
}
