/** Verify an actual browser clipboard export without re-generating expensive native solids. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import machine, { millingComponents } from '../src/parts/cnc-milling-machine/part';
import { consoleCommand } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';

const directory = resolve('test-results/cnc-milling');
const commandPath = resolve(directory, 'CopyForFreeCAD-Full.txt');
const command = readFileSync(commandPath, 'utf8');
assert.ok(
  command.startsWith('exec(') && command.endsWith(')'),
  'Expected one console exec command.',
);
const macro: string = JSON.parse(command.slice(5, -1));
assert.equal(
  consoleCommand(macro),
  command,
  'The decoded console command must preserve every byte.',
);
const geometry = withGeometryMode('full', () => machine.python(machine.defaults, 'assembled'));
const indented = geometry
  .split('\n')
  .map((line) => '        ' + line)
  .join('\n');
// Chromium and Node can differ at the 12th decimal of computed rotations. This comparison
// normalizes only long computed floating representations, including serialized placement JSON.
const normalize = (value: string) =>
  value.replace(/-?\d+\.\d{11,}(?:e[+-]?\d+)?/gi, (number) =>
    String(Math.round(Number(number) * 1e10) / 1e10),
  );
assert.ok(
  normalize(macro).includes(normalize(indented)),
  'The complete current geometry must be present, without truncation.',
);
const occurrences = (macro.match(/^        component, local_metadata = _pl_component\(/gm) ?? [])
  .length;
assert.equal(occurrences, millingComponents(machine.defaults).length);
const macroPath = resolve(directory, 'Full.FCMacro');
writeFileSync(macroPath, macro);
const compiled = spawnSync(
  'python3',
  [
    '-c',
    "import ast,sys; p=sys.argv[1]; s=open(p).read(); compile(s,p,'exec'); command=open(sys.argv[2]).read(); body=ast.parse(command); assert len(body.body)==1; assert ast.literal_eval(body.body[0].value.args[0])==s; compile(command,sys.argv[2],'exec')",
    macroPath,
    commandPath,
  ],
  { encoding: 'utf8' },
);
assert.equal(compiled.status, 0, compiled.stderr || compiled.error?.message);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const proof = {
  mode: 'full',
  commandBytes: Buffer.byteLength(command),
  macroBytes: Buffer.byteLength(macro),
  components: occurrences,
  completeGeometryPreserved: true,
  consoleDecodingByteExact: true,
  pythonSyntaxCompiled: true,
  comparison:
    'Complete current geometry body, normalizing long computed floating representations to 1e-10 for browser versus Node rounding. Console decoding is byte exact.',
  geometryHash: hash(geometry),
  macroHash: hash(macro),
  commandHash: hash(command),
};
writeFileSync(
  resolve(directory, 'clipboard-native-source.json'),
  JSON.stringify(proof, null, 2) + '\n',
);
console.log(proof);
