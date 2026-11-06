import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';
import part from '../src/parts/tr8-quad-geared-rocker-actuator/part';
import { pieces, roleIds, channelTransform, sourceTransform, panelTransform } from '../src/parts/tr8-quad-geared-rocker-actuator/lib/model';
import { fixed, driveParameters } from '../src/parts/tr8-quad-geared-rocker-actuator/lib/layout';
import { sheetPanel, sheetPanelFlatPattern } from '../src/parts/tr8-quad-geared-rocker-actuator/lib/sheet-panel';

const out = resolve(process.argv[2] ?? 'test-results/tr8-quad-geared-rocker');
mkdirSync(out, { recursive: true });
const earlyOnly = process.argv.includes('--early-only');
const limitsOnly = process.argv.includes('--limits-only');
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const primary = String(part.defaults.motor);
const secondary = 'surpass-2845-3100kv';
const stem = (motor: string) => 'TR8x4-quad-geared-rocker-' + motor;
const angles = [
  [0, 0, 0, 0],
  [20, 20, 20, 20],
  [-20, -20, -20, -20],
  [20, -20, 20, -20],
  [-20, 20, -20, 20],
  [20, 0, 0, 0],
  [0, 20, 0, 0],
  [0, 0, 20, 0],
  [0, 0, 0, 20],
  [-20, 0, 0, 0],
  [-10, 5, 10, -5],
] as const;
const parameters = (motor: string, values: readonly number[]) => ({
  ...part.defaults,
  motor,
  ...Object.fromEntries(['A', 'B', 'C', 'D'].map((letter, index) => ['angle' + letter, values[index]])),
});
const hashFiles = (files: string[]) => Object.fromEntries(files.map((file) => [file, digest(readFileSync(resolve(file)))]));
const baseline = JSON.parse(readFileSync(resolve('tests/fixtures/tr8-geared-rocker-before-c4-sha256.json'), 'utf8')) as Record<string, string>;
for (const [file, expected] of Object.entries(baseline)) {
  if (digest(readFileSync(resolve(file))) !== expected) throw new Error('The approved single actuator changed: ' + file);
}
const code = readdirSync(resolve('src/parts/tr8-quad-geared-rocker-actuator'), { recursive: true })
  .filter((path): path is string => typeof path === 'string' && /\.(ts|json)$/.test(path))
  .map((path) => 'src/parts/tr8-quad-geared-rocker-actuator/' + path);
const data = {
  schemaVersion: 6,
  partId: part.id,
  primary,
  secondary,
  layout: fixed,
  sheetPanel,
  flatPatterns: [sheetPanelFlatPattern(1), sheetPanelFlatPattern(-1)],
  roleIds,
  channelTransforms: [0, 1, 2, 3].map((i) => channelTransform(i).elements),
  panelTransforms: [0, 1, 2, 3].map((i) => panelTransform(i).elements),
  sourceTransforms: [0, 1, 2, 3].map((index) => sourceTransform(index % 2 === 0).elements),
  sources: hashFiles(code),
  preserved: baseline,
  dependencySources: hashFiles([
    'src/core/assembly/detail-instances.ts',
    'src/core/assembly/boundary/shapes.ts',
    'src/core/component-recipes.ts',
    'src/core/eskd.ts',
    'src/core/hardware/gears.ts',
    'src/core/hardware/shaft-bore.ts',
    'src/core/geometry-mode.ts',
    'src/core/part-selection.ts',
    'src/parts/e-ring/part.ts',
    'src/parts/spring-pin/part.ts',
    'src/parts/hex-nut/part.ts',
    'src/parts/hex-nut/configurator.ts',
  ]),
  poses: [] as {
    key: string;
    motor: string;
    mode: 'full';
    angles: readonly number[];
    driveAngles: number[];
    source: string;
    occurrences: {
      id: string;
      name: string;
      libraryId: string;
      supply: string;
      requireSingleSolid: boolean;
      geometryKey: string;
      placement: { translation: number[]; rotation: number[] };
    }[];
  }[],
  macros: [] as { motor: string; mode: string; path: string }[],
};
for (const execution of (earlyOnly ? [{ motor: primary, values: [0, 0, 0, 0], index: 0 }] : limitsOnly ? angles.slice(0, 3).map((values, index) => ({ motor: primary, values, index })) : [
  ...angles.map((values, index) => ({ motor: primary, values, index })),
  { motor: secondary, values: [0, 0, 0, 0], index: 0 },
])) withGeometryMode('full', () => {
  const p = parameters(execution.motor, execution.values);
  data.poses.push({
    key: execution.motor + ':' + execution.index,
    motor: execution.motor,
    mode: 'full',
    angles: execution.values,
    driveAngles: [0, 1, 2, 3].map((index) => Number(driveParameters(p, index).outputAngle)),
    source: part.python(p, 'assembled'),
    occurrences: pieces(p, 'assembled').map((piece) => ({
      id: piece.component.id,
      name: piece.component.name,
      libraryId: piece.component.libraryId,
      supply: piece.component.supply,
      requireSingleSolid: Boolean(piece.requireSingleSolid),
      placement: piece.component.placement,
      geometryKey: digest(JSON.stringify({ mode: 'full', libraryId: piece.component.libraryId, state: piece.component.state, parameters: piece.component.parameters, placement: piece.component.placement, angle: piece.angle, position: piece.position, z: piece.z })),
    })),
  });
});
for (const [motor, modes] of (earlyOnly || limitsOnly ? [] : [[primary, ['simple', 'full']], [secondary, ['full']]]) as [string, ('simple' | 'full')[]][]) {
  const p = parameters(motor, [0, 0, 0, 0]);
  for (const mode of modes) {
    const path = resolve(out, stem(motor) + '-' + mode + '.FCMacro');
    writeFileSync(path, withGeometryMode(mode, () => generateScript(part, p, 'assembled', undefined, undefined, mode)));
    data.macros.push({ motor, mode, path });
  }
  if (!process.argv.includes('--geometry-only')) {
    const folder = resolve(out, motor);
    mkdirSync(folder, { recursive: true });
    for (const file of part.fabricationFiles!(p)) writeFileSync(resolve(folder, file.name), file.content);
  }
}
writeFileSync(resolve(out, 'capture.json'), JSON.stringify(data));
console.log(JSON.stringify({ out, poses: data.poses.length, publicMacros: data.macros.length, primary, secondary }));
