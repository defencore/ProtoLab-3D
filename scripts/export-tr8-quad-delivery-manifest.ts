import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import part from '../src/parts/tr8-quad-actuator/part';

const root = process.cwd();
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const files = part.fabricationFiles!(part.defaults).map((file) => {
  if (typeof file.content !== 'string') throw new Error('The delivery expects textual fabrication files.');
  return { name: file.name, bytes: Buffer.byteLength(file.content), sha256: sha(file.content) };
});
const sourcePaths: string[] = [];
const scan = (directory: string) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else sourcePaths.push(path);
  }
};
scan(resolve(root, 'src/parts/tr8-quad-actuator'));
const sourceFiles = sourcePaths.sort().map((path) => ({ path: relative(root, path), sha256: sha(readFileSync(path)) }));
process.stdout.write(JSON.stringify({ partId: part.id, fabricationFiles: files, sourceFiles }, null, 2) + '\n');
